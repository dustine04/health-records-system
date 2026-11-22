import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const origins = (Deno.env.get("MCHMS_WEB_ORIGIN") || "").split(",").map(x => x.trim().replace(/\/$/, "")).filter(Boolean);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-mchms-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const respond = (origin: string | null, status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: cors(origin) });
const one = (v: any): any => Array.isArray(v) ? v[0] : v;
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);
function todayPH() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function mobile(value: unknown): string | null {
  const d = String(value ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return `0${d.slice(2)}`;
  if (/^9\d{9}$/.test(d)) return `0${d}`;
  return null;
}
async function sha256(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}
const configs = {
  growth: { table: "child_monitoring", visitDate: "monitoring_date" },
  immunization: { table: "child_immunization", visitDate: "vaccination_date" },
} as const;

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (!origin || !origins.includes(origin)) return respond(origin, 403, { error: "Origin not allowed" });
  if (req.method !== "POST") return respond(origin, 405, { error: "Method not allowed" });
  const token = req.headers.get("x-mchms-session") || "";
  if (!/^[0-9a-f]{128}$/.test(token)) return respond(origin, 401, { error: "Please log in again" });
  try {
    const { data: session, error: se } = await db.from("mchms_sessions").select("user_id,expires_at,revoked_at")
      .eq("token_hash", await sha256(token)).maybeSingle();
    if (se) throw se;
    if (!session || session.revoked_at || !session.expires_at || Date.parse(session.expires_at) <= Date.now())
      return respond(origin, 401, { error: "Session expired" });
    const { data: actor, error: ae } = await db.from("users").select("id,role,is_active,district_id")
      .eq("id", session.user_id).maybeSingle();
    if (ae) throw ae;
    const role = String(actor?.role || "").toLowerCase();
    if (!actor || actor.is_active !== true || !["bns", "midwife", "nurse"].includes(role))
      return respond(origin, 403, { error: "Account is not authorized for child SMS" });
    if (role === "nurse") {
      if (actor.district_id == null) return respond(origin, 403, { error: "Nurse has no district" });
      const { data: access, error: accessError } = await db.from("child_monitoring_access")
        .select("id").eq("nurse_id", actor.id).eq("district_id", actor.district_id)
        .eq("is_active", true).limit(1).maybeSingle();
      if (accessError) throw accessError;
      if (!access) return respond(origin, 403, { error: "Nurse child-monitoring access is not authorized" });
    }
    const body = await req.json().catch(() => null);
    const action = body?.action;
    const childId = Number(body?.child_health_record_id);
    if (!Number.isSafeInteger(childId) || childId < 1 || !["history", "send"].includes(action))
      return respond(origin, 400, { error: "Invalid request" });
    const { data: child, error: ce } = await db.from("child_health_records").select("id,resident_id")
      .eq("id", childId).maybeSingle();
    if (ce) throw ce;
    if (!child) return respond(origin, 404, { error: "Child record not found" });
    const { data: resident, error: re } = await db.from("residents")
      .select("id,households (local_area_id,contact_number)").eq("id", child.resident_id).maybeSingle();
    if (re) throw re;
    const household = one(resident?.households);
    if (!household?.local_area_id) return respond(origin, 403, { error: "Child has no assigned household area" });
    if (role === "bns") {
      const { data: assignment, error: we } = await db.from("worker_area_assignments").select("id")
        .eq("worker_id", actor.id).eq("local_area_id", household.local_area_id).eq("is_active", true).limit(1).maybeSingle();
      if (we) throw we;
      if (!assignment) return respond(origin, 403, { error: "Child is outside your assigned areas" });
    } else {
      if (actor.district_id == null) return respond(origin, 403, { error: "Account has no assigned district" });
      const { data: area, error: areaError } = await db.from("local_areas")
        .select("id,barangays(district_id)").eq("id", household.local_area_id).maybeSingle();
      if (areaError) throw areaError;
      const barangay = one(area?.barangays);
      if (!barangay || String(barangay.district_id) !== String(actor.district_id))
        return respond(origin, 403, { error: "Child is outside your assigned district" });
    }
    if (role === "nurse" && action === "send")
      return respond(origin, 403, { error: "Nurses can view child SMS history but cannot send reminders" });

    if (action === "history") {
      const { data: logs, error: le } = await db.from("child_sms_logs")
        .select("id,reminder_type,source_record_id,scheduled_date,status,sent_at,created_at")
        .eq("child_health_record_id", childId).order("created_at", { ascending: false }).limit(200);
      if (le) throw le;
      return respond(origin, 200, { success: true, logs: logs || [], has_household_mobile: Boolean(mobile(household.contact_number)) });
    }
    const kind = String(body?.reminder_type || "") as keyof typeof configs;
    const config = configs[kind];
    const sourceId = Number(body?.source_record_id);
    if (!config || !Number.isSafeInteger(sourceId) || sourceId < 1)
      return respond(origin, 400, { error: "Invalid appointment" });
    if (body?.guardian_confirmed !== true)
      return respond(origin, 400, { error: "Confirm that the household number belongs to the child's parent or guardian" });
    const phone = mobile(household.contact_number);
    if (!phone) return respond(origin, 400, { error: "Household has no valid Philippine mobile number" });
    const { data: latest, error: ve } = await db.from(config.table)
      .select(`id,${config.visitDate},next_visit_date${kind === "immunization" ? ",next_vaccine_name" : ""}`)
      .eq("child_health_record_id", childId)
      .order(config.visitDate, { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
    if (ve) throw ve;
    const scheduledDate = dateOnly(latest?.next_visit_date);
    const completedDate = dateOnly(latest?.[config.visitDate]);
    if (!latest || Number(latest.id) !== sourceId || !scheduledDate || scheduledDate >= todayPH() || completedDate >= scheduledDate)
      return respond(origin, 400, { error: "No eligible missed appointment. Sync records and check the latest visit." });
    const apiKey = Deno.env.get("SEMAPHORE_API_KEY");
    if (!apiKey) return respond(origin, 500, { error: "Semaphore API key not configured" });
    const { data: log, error: insertError } = await db.from("child_sms_logs")
      .insert({ child_health_record_id: childId, reminder_type: kind, source_record_id: sourceId,
        scheduled_date: scheduledDate, status: "pending", phone_last4: phone.slice(-4), guardian_confirmed_by: actor.id })
      .select("id").single();
    if (insertError?.code === "23505") return respond(origin, 409, { error: "This appointment already has an SMS attempt. Check history before retrying." });
    if (insertError) throw insertError;
    const subject = kind === "growth" ? "growth monitoring" : "immunization";
    // Deliberately avoid child names, diagnoses, or vaccine-specific medical details in SMS.
    const message = `Good day! Our records show that a child's ${subject} visit scheduled for ${scheduledDate} may have been missed. Please contact your barangay health center to arrange a visit. - MCHMS`;
    try {
      const params = new URLSearchParams({ apikey: apiKey, number: phone, message });
      const sender = Deno.env.get("SEMAPHORE_SENDER_NAME");
      if (sender) params.set("sendername", sender);
      const response = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result) || !result[0]?.message_id)
        throw new Error(`Semaphore request rejected or uncertain (${response.status})`);
      const { error: updateError } = await db.from("child_sms_logs").update({ status: "sent",
        provider_message_id: String(result[0].message_id), sent_at: new Date().toISOString() }).eq("id", log.id);
      if (updateError) throw updateError;
      return respond(origin, 200, { success: true, message: "SMS accepted by Semaphore; delivery not confirmed" });
    } catch (err) {
      console.error("Child SMS send failure", err);
      await db.from("child_sms_logs").update({ status: "failed", error_message: String(err).slice(0, 500) }).eq("id", log.id);
      return respond(origin, 502, { error: "SMS failed or provider outcome is uncertain. Check history before retrying." });
    }
  } catch (err) {
    console.error("Child SMS function error", err);
    return respond(origin, 500, { error: "Unable to process child SMS request" });
  }
});
