
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages";

function todayInPhilippines(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;

  return null;
}

function active(status: unknown): boolean {
  return ![
    "delivered",
    "miscarriage",
    "stillbirth",
    "inactive",
  ].includes(String(status ?? "active").toLowerCase());
}

Deno.serve(async (request) => {
  // This endpoint is for a trusted scheduler, not browser clients.
  const secret = Deno.env.get("SMS_CRON_SECRET");
  const supplied = request.headers.get("x-cron-secret");

  if (!secret || !supplied || supplied !== secret) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 },
    );
  }

  const apiKey = Deno.env.get("SEMAPHORE_API_KEY");
  if (!apiKey) {
    return Response.json(
      { error: "Semaphore API key is missing" },
      { status: 500 },
    );
  }

  const today = todayInPhilippines();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Fetch all active pregnancy records in pages.
    const pregnancies: any[] = [];

    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("pregnant_women")
        .select("id, resident_id, status")
        .order("id")
        .range(offset, offset + 499);

      if (error) throw error;
      pregnancies.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }

    for (const pregnancy of pregnancies) {
      if (!active(pregnancy.status)) {
        skipped++;
        continue;
      }

      // Latest ANC visit, following the dashboard's visit order.
      const { data: visit, error: visitError } = await supabase
        .from("pregnant_woman_visits")
        .select("id, visit_number, visit_date, next_visit_date")
        .eq("pregnant_woman_id", pregnancy.id)
        .order("visit_number", { ascending: false })
        .order("visit_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (visitError) throw visitError;

      if (
        !visit?.next_visit_date ||
        visit.next_visit_date >= today
      ) {
        skipped++;
        continue;
      }

      // Do not send if a visit was recorded on or after the
      // scheduled appointment date.
      if (
        visit.visit_date &&
        visit.visit_date >= visit.next_visit_date
      ) {
        skipped++;
        continue;
      }

      const { data: resident, error: residentError } =
        await supabase
          .from("residents")
          .select("first_name, contact_number")
          .eq("id", pregnancy.resident_id)
          .maybeSingle();

      if (residentError) throw residentError;

      const phone = normalizePhone(resident?.contact_number);

      if (!phone) {
        skipped++;
        continue;
      }

      // Reserve this appointment before calling Semaphore.
      // A duplicate appointment is not sent again.
      const { data: log, error: logError } = await supabase
        .from("pregnancy_sms_logs")
        .insert({
          pregnant_woman_id: pregnancy.id,
          anc_visit_id: visit.id,
          scheduled_date: visit.next_visit_date,
          phone_last4: phone.slice(-4),
          status: "pending",
        })
        .select("id")
        .single();

      if (logError) {
        if (logError.code === "23505") {
          skipped++;
          continue;
        }
        throw logError;
      }

      const firstName =
        String(resident.first_name ?? "").trim() || "Ma'am";

      // Keep the message neutral and avoid sensitive clinical details.
      const message =
        `Good day, ${firstName}. Our records show that your ` +
        `scheduled check-up on ${visit.next_visit_date} ` +
        `may have been missed. Please contact your barangay ` +
        `health worker or health center to arrange a visit. ` +
        `- MCHMS`;

      try {
        const form = new URLSearchParams({
          apikey: apiKey,
          number: phone,
          message,
        });

        const sender = Deno.env.get("SEMAPHORE_SENDER_NAME");
        if (sender) form.set("sendername", sender);

        const response = await fetch(SEMAPHORE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        });

        const result = await response.json();

        if (!response.ok || !Array.isArray(result) ||
            !result[0]?.message_id) {
          throw new Error(
            `Semaphore rejected request: ${response.status}`,
          );
        }

        const { error: updateError } = await supabase
          .from("pregnancy_sms_logs")
          .update({
            status: "sent",
            provider_message_id: String(result[0].message_id),
            sent_at: new Date().toISOString(),
          })
          .eq("id", log.id);

        if (updateError) throw updateError;
        sent++;
      } catch (error) {
        failed++;

        await supabase
          .from("pregnancy_sms_logs")
          .update({
            status: "failed",
            error_message: String(error).slice(0, 500),
          })
          .eq("id", log.id);
      }
    }

    return Response.json({
      success: true,
      sent,
      skipped,
      failed,
      checked_at: today,
    });
  } catch (error) {
    console.error("Missed ANC SMS job failed:", error);

    return Response.json(
      { error: "SMS processing failed" },
      { status: 500 },
    );
  }
});
