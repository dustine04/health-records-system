import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages";
const allowedOrigins = (Deno.env.get("MCHMS_WEB_ORIGIN") || "").split(",").map((x) => x.trim().replace(/\/$/, "")).filter(Boolean);
const one = (v: any): any => Array.isArray(v) ? v[0] : v;
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mchms-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const respond = (body: Record<string, unknown>, status: number, origin: string | null) =>
  Response.json(body, { status, headers: headers(origin) });
function todayPH() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function phoneNumber(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}
function isActive(status: unknown) {
  return !["delivered", "miscarriage", "stillbirth", "inactive"].includes(String(status ?? "active").trim().toLowerCase());
}
async function hash(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (!origin || !allowedOrigins.includes(origin)) return respond({ error: "Origin not allowed" }, 403, origin);
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin);
  const token = req.headers.get("x-mchms-session") || "";
  if (!/^[0-9a-f]{128}$/.test(token)) return respond({ error: "Please log in again" }, 401, origin);
  const apiKey = Deno.env.get("SEMAPHORE_API_KEY");
  if (!apiKey) return respond({ error: "SMS configuration incomplete" }, 500, origin);
  try {
    const { data: session, error: se } = await db.from("mchms_sessions")
      .select("user_id, expires_at, revoked_at").eq("token_hash", await hash(token)).maybeSingle();
    if (se) throw se;
    if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now())
      return respond({ error: "Session expired. Please log in again" }, 401, origin);
    const { data: actor, error: ue } = await db.from("users")
      .select("id, role, is_active, district_id, barangay_id").eq("id", session.user_id).maybeSingle();
    if (ue) throw ue;
    const role = String(actor?.role || "").toLowerCase();
    if (!actor || actor.is_active !== true || !["midwife", "bhw"].includes(role))
      return respond({ error: "Account is not authorized to send SMS" }, 403, origin);

    const payload = await req.json().catch(() => null);
    const pregnancyId = Number(payload?.pregnancy_id);
    if (!Number.isSafeInteger(pregnancyId) || pregnancyId < 1)
      return respond({ error: "Invalid pregnancy ID" }, 400, origin);
    const { data: pregnancy, error: pe } = await db.from("pregnant_women")
      .select("id, resident_id, status").eq("id", pregnancyId).maybeSingle();
    if (pe) throw pe;
    if (!pregnancy || !isActive(pregnancy.status))
      return respond({ error: "Pregnancy is not eligible for a reminder" }, 400, origin);
    const { data: resident, error: re } = await db.from("residents")
      .select("first_name, contact_number, households (local_area_id, local_areas (barangay_id, barangays (district_id)))")
      .eq("id", pregnancy.resident_id).maybeSingle();
    if (re) throw re;
    const household = one(resident?.households);
    const area = one(household?.local_areas);
    const barangay = one(area?.barangays);
    let authorized = false;
    if (area && barangay && role === "midwife") {
      authorized = actor.district_id != null
        ? String(barangay.district_id) === String(actor.district_id)
        : actor.barangay_id != null && String(area.barangay_id) === String(actor.barangay_id);
    } else if (area && barangay && role === "bhw") {
      const { data: assignment, error: ae } = await db.from("worker_area_assignments")
        .select("id").eq("worker_id", actor.id).eq("local_area_id", household.local_area_id)
        .eq("is_active", true).limit(1).maybeSingle();
      if (ae) throw ae;
      authorized = Boolean(assignment);
    }
    if (!authorized) return respond({ error: "Patient is outside your assigned area" }, 403, origin);

    const { data: visit, error: ve } = await db.from("pregnant_woman_visits")
      .select("id, visit_number, visit_date, next_visit_date")
      .eq("pregnant_woman_id", pregnancyId)
      .order("visit_number", { ascending: false })
      .order("visit_date", { ascending: false }).limit(1).maybeSingle();
    if (ve) throw ve;
    const dueDate = visit?.next_visit_date ? String(visit.next_visit_date).slice(0, 10) : "";
    const visitDate = visit?.visit_date ? String(visit.visit_date).slice(0, 10) : "";
    if (!dueDate || dueDate >= todayPH() || (visitDate && visitDate >= dueDate))
      return respond({ error: "There is no eligible missed ANC appointment" }, 400, origin);
    const phone = phoneNumber(resident?.contact_number);
    if (!phone) return respond({ error: "Patient has no valid mobile number" }, 400, origin);

    // Claim the appointment before calling Semaphore. UNIQUE (anc_visit_id, scheduled_date)
    // prevents duplicate sends from BHW, Midwife, and the automatic job.
    const { data: log, error: le } = await db.from("pregnancy_sms_logs")
      .insert({ pregnant_woman_id: pregnancyId, anc_visit_id: visit.id,
        scheduled_date: dueDate, phone_last4: phone.slice(-4), status: "pending" })
      .select("id").single();
    if (le?.code === "23505") return respond({ success: false, sent: 0,
      message: "A reminder for this appointment has already been recorded." }, 409, origin);
    if (le) throw le;

    const firstName = String(resident?.first_name ?? "").trim() || "Ma'am";
    const message = `Good day, ${firstName}. Our records show that your scheduled check-up on ${dueDate} may have been missed. Please contact your barangay health worker or health center to arrange a visit. - MCHMS`;
    try {
      const form = new URLSearchParams({ apikey: apiKey, number: phone, message });
      const sender = Deno.env.get("SEMAPHORE_SENDER_NAME");
      if (sender) form.set("sendername", sender);
      const response = await fetch(SEMAPHORE_URL, { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result) || !result[0]?.message_id)
        throw new Error(`Semaphore rejected request (${response.status})`);
      const { error: updateError } = await db.from("pregnancy_sms_logs")
        .update({ status: "sent", provider_message_id: String(result[0].message_id),
          sent_at: new Date().toISOString() }).eq("id", log.id);
      if (updateError) throw updateError;
      return respond({ success: true, sent: 1, message: "SMS accepted by Semaphore" }, 200, origin);
    } catch (error) {
      console.error("Manual SMS error:", error);
      await db.from("pregnancy_sms_logs").update({ status: "failed",
        error_message: String(error).slice(0, 500) }).eq("id", log.id);
      return respond({ success: false, sent: 0,
        message: "SMS failed or provider status is uncertain. Check logs before retrying." }, 502, origin);
    }
  } catch (error) {
    console.error("Manual SMS function error:", error);
    return respond({ error: "Unable to process manual SMS request" }, 500, origin);
  }
});
