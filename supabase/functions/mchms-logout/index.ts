import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get("MCHMS_WEB_ORIGIN");
  const origin = request.headers.get("origin");
  const cors = {
    "Access-Control-Allow-Origin":
      origin && origin === allowedOrigin ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const reply = (body: Record<string, unknown>, status = 200) =>
    Response.json(body, { status, headers: cors });

  if (!allowedOrigin || origin !== allowedOrigin) {
    return reply({ error: "Origin not allowed" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  let body: { session_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Invalid JSON" }, 400);
  }

  const token = body.session_token;
  if (typeof token !== "string" || !/^[a-f0-9]{128}$/.test(token)) {
    return reply({ error: "Invalid session token" }, 400);
  }

  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const { error } = await db.from("mchms_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);

  if (error) {
    console.error("Session revocation error:", error);
    return reply({ error: "Could not revoke session" }, 500);
  }

  return reply({ success: true });
});
