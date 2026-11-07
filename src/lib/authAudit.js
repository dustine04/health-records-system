
import { supabase } from "./supabase";

// Best-effort client audit logging.
// For tamper-resistant security logging, use a trusted
// server-side RPC or Edge Function instead.

export async function logAuthEvent({
  actorId = null,
  action,
  status = "success",
  details = {},
}) {
  try {
    const { error } = await supabase
      .from("it_audit_logs")
      .insert({
        actor_id: actorId ?? null,
        action,
        entity_type: "authentication",
        entity_id:
          actorId == null ? null : String(actorId),
        status,
        details: {
          module: "Authentication",
          ...details,
        },
      });

    if (error) {
      console.warn(
        "Authentication audit log could not be saved:",
        error.message
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "Authentication audit log could not be saved:",
      error
    );
    return false;
  }
}
