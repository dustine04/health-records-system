
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const allowedOrigins = (Deno.env.get("MCHMS_WEB_ORIGIN") || "")
  .split(",")
  .map((x) => x.trim().replace(/\/$/, ""))
  .filter(Boolean);

const one = (value: any): any =>
  Array.isArray(value) ? value[0] : value;

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin && allowedOrigins.includes(origin) ? origin : "null",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-mchms-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const reply = (
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
) => Response.json(body, { status, headers: cors(origin) });

async function hash(token: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(bytes))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors(origin),
    });
  }

  if (!origin || !allowedOrigins.includes(origin)) {
    return reply({ error: "Origin not allowed" }, 403, origin);
  }

  if (req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405, origin);
  }

  const token = req.headers.get("x-mchms-session") || "";

  if (!/^[0-9a-f]{128}$/.test(token)) {
    return reply({ error: "Please log in again" }, 401, origin);
  }

  try {
    // 1. Validate the MCHMS session.
    const { data: session, error: sessionError } = await db
      .from("mchms_sessions")
      .select("user_id, expires_at, revoked_at")
      .eq("token_hash", await hash(token))
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (
      !session ||
      session.revoked_at ||
      !session.expires_at ||
      Date.parse(session.expires_at) <= Date.now()
    ) {
      return reply(
        { error: "Session expired. Please log in again" },
        401,
        origin,
      );
    }

    // 2. Identify the logged-in user.
    const { data: actor, error: userError } = await db
      .from("users")
      .select("id, role, is_active, district_id, barangay_id")
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError) throw userError;

    const role = String(actor?.role || "").trim().toLowerCase();

    if (
      !actor ||
      actor.is_active !== true ||
      !["midwife", "bhw", "nurse"].includes(role)
    ) {
      return reply(
        { error: "Account is not authorized for SMS history" },
        403,
        origin,
      );
    }

    // 3. Nurse must have Midwife-granted district authorization.
    if (role === "nurse") {
      if (actor.district_id == null) {
        return reply(
          { error: "Nurse has no assigned district" },
          403,
          origin,
        );
      }

      const { data: access, error: accessError } = await db
        .from("pregnancy_monitoring_access")
        .select("id")
        .eq("nurse_id", actor.id)
        .eq("district_id", actor.district_id)
        .eq("is_active", true)
        .limit(1);

      if (accessError) throw accessError;

      if (!access?.length) {
        return reply(
          {
            error:
              "Nurse has not been authorized by a Midwife to view pregnancy SMS history",
          },
          403,
          origin,
        );
      }
    }

    // 4. Validate requested pregnancy IDs.
    const body = await req.json().catch(() => ({}));

    const requested = Array.isArray(body.pregnancy_ids)
      ? body.pregnancy_ids
      : [];

    if (
      requested.length > 500 ||
      requested.some(
        (x: unknown) =>
          !Number.isSafeInteger(Number(x)) ||
          Number(x) < 1,
      )
    ) {
      return reply(
        { error: "Invalid pregnancy IDs" },
        400,
        origin,
      );
    }

    const ids = [...new Set<number>(requested.map(Number))];

    if (!ids.length) {
      return reply({ success: true, logs: [] }, 200, origin);
    }

    // 5. Load only requested pregnancies.
    const { data: pregnancies, error: pregnancyError } = await db
      .from("pregnant_women")
      .select("id, resident_id")
      .in("id", ids);

    if (pregnancyError) throw pregnancyError;

    const residentIds = [
      ...new Set(
        (pregnancies || [])
          .map((p) => p.resident_id)
          .filter(Boolean),
      ),
    ];

    if (!residentIds.length) {
      return reply({ success: true, logs: [] }, 200, origin);
    }

    // 6. Resolve each patient's barangay and local area.
    const { data: residents, error: residentError } = await db
      .from("residents")
      .select(`
        id,
        households (
          local_area_id,
          local_areas (
            barangay_id,
            barangays (
              district_id
            )
          )
        )
      `)
      .in("id", residentIds);

    if (residentError) throw residentError;

    const residentMap = new Map(
      (residents || []).map((resident) => [
        String(resident.id),
        resident,
      ]),
    );

    // 7. BHWs can access only their active assigned areas.
    let areaIds = new Set<string>();

    if (role === "bhw") {
      const { data: assignments, error: assignmentError } = await db
        .from("worker_area_assignments")
        .select("local_area_id")
        .eq("worker_id", actor.id)
        .eq("is_active", true);

      if (assignmentError) throw assignmentError;

      areaIds = new Set(
        (assignments || []).map((a) => String(a.local_area_id)),
      );
    }

    // 8. Apply role-based patient scope.
    const authorizedIds = (pregnancies || [])
      .filter((pregnancy) => {
        const resident: any = residentMap.get(
          String(pregnancy.resident_id),
        );

        const household = one(resident?.households);
        const area = one(household?.local_areas);
        const barangay = one(area?.barangays);

        if (!area || !barangay) return false;

        if (role === "bhw") {
          return areaIds.has(String(household?.local_area_id));
        }

        if (role === "nurse") {
          // Nurses are restricted to their authorized district.
          return (
            String(barangay.district_id) ===
            String(actor.district_id)
          );
        }

        // Preserve existing Midwife district/barangay scope.
        if (actor.district_id != null) {
          return (
            String(barangay.district_id) ===
            String(actor.district_id)
          );
        }

        return (
          actor.barangay_id != null &&
          String(area.barangay_id) ===
            String(actor.barangay_id)
        );
      })
      .map((pregnancy) => pregnancy.id);

    if (!authorizedIds.length) {
      return reply({ success: true, logs: [] }, 200, origin);
    }

    // 9. Retrieve SMS history, including pagination.
    const logs: any[] = [];

    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from("pregnancy_sms_logs")
        .select(`
          pregnant_woman_id,
          anc_visit_id,
          scheduled_date,
          status,
          sent_at,
          created_at
        `)
        .in("pregnant_woman_id", authorizedIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + 499);

      if (error) throw error;

      logs.push(...(data || []));

      if (!data || data.length < 500) break;
    }

    return reply(
      {
        success: true,
        logs,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("SMS history error:", error);

    return reply(
      { error: "Unable to retrieve SMS history" },
      500,
      origin,
    );
  }
});
