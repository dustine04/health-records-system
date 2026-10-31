
import Dexie from "dexie";
import { supabase } from "./supabase";

/* =========================================================
   OFFLINE DATABASE
========================================================= */

const db = new Dexie("mchms-admin-staff-v1");

db.version(1).stores({
  snapshots: "adminId",
  queue: "++id,adminId,createdAt",
});

const key = (admin) => String(admin?.id ?? "");

/* =========================================================
   VALIDATION AND SECURITY HELPERS
========================================================= */

const ensureAdmin = (admin) => {
  if (!admin?.id || admin.role !== "cho_admin") {
    throw new Error("CHO Admin session required.");
  }
};

// Never cache passwords.
const stripPassword = (row) => {
  const { password, ...safe } = row;
  return safe;
};

/* =========================================================
   GET CACHED STAFF AND DISTRICTS
========================================================= */

export async function getStaffCache(admin) {
  ensureAdmin(admin);

  return db.snapshots.get(key(admin));
}

/* =========================================================
   SAVE STAFF AND DISTRICTS OFFLINE
========================================================= */

export async function saveStaffCache(admin, users, districts) {
  ensureAdmin(admin);

  await db.snapshots.put({
    adminId: key(admin),
    users: users.map(stripPassword),
    districts,
    cachedAt: Date.now(),
  });
}

/* =========================================================
   GET PENDING OFFLINE ACTIONS
========================================================= */

export async function pendingStaffActions(admin) {
  ensureAdmin(admin);

  return db.queue
    .where("adminId")
    .equals(key(admin))
    .sortBy("createdAt");
}

/* =========================================================
   QUEUE OFFLINE STAFF ACTIONS
========================================================= */

export async function queueStaffAction(admin, action) {
  ensureAdmin(admin);

  if (!["edit", "status"].includes(action.type)) {
    throw new Error("Unsupported offline action.");
  }

  if (action.type === "edit") {
    const allowed = [
      "first_name",
      "last_name",
      "email",
      "username",
      "district_id",
    ];

    if (
      Object.keys(action.changes || {}).some(
        (k) => !allowed.includes(k)
      )
    ) {
      throw new Error(
        "Passwords and roles cannot be queued offline."
      );
    }
  }

  if (
    action.type === "status" &&
    typeof action.active !== "boolean"
  ) {
    throw new Error("Invalid status.");
  }

  // Prevent multiple pending changes for the same staff member.
  const pending = await pendingStaffActions(admin);

  if (
    pending.some(
      (x) => String(x.userId) === String(action.userId)
    )
  ) {
    throw new Error(
      "This staff member has a pending change. Sync it before editing again."
    );
  }

  await db.queue.add({
    adminId: key(admin),
    ...action,
    createdAt: Date.now(),
  });
}

/* =========================================================
   SYNCHRONIZE OFFLINE ACTIONS
========================================================= */

let running = null;

export async function syncStaffActions(admin) {
  ensureAdmin(admin);

  if (!navigator.onLine) {
    throw new Error("Offline. Changes are still queued.");
  }

  if (running) {
    return running;
  }

  running = (async () => {
    let count = 0;

    const actions = await pendingStaffActions(admin);

    for (const action of actions) {
      // Always fetch the latest staff record before updating.
      const { data: current, error: readError } =
        await supabase
          .from("users")
          .select(
            "id,role,is_active,first_name,last_name,email,username,district_id"
          )
          .eq("id", action.userId)
          .maybeSingle();

      if (readError) {
        throw readError;
      }

      if (
        !current ||
        !["nurse", "midwife"].includes(current.role)
      ) {
        throw new Error(
          "Staff record is no longer eligible."
        );
      }

      /* ---------------------------------------------------
         SYNC STAFF PROFILE EDITS
      --------------------------------------------------- */

      if (action.type === "edit") {
        const keys = Object.keys(action.changes);

        // Detect edits made from another device.
        if (
          keys.some(
            (k) => current[k] !== action.expected[k]
          )
        ) {
          throw new Error(
            `Staff ${current.id} was edited on another device. Review before retrying.`
          );
        }

        const { data, error } = await supabase
          .from("users")
          .update(action.changes)
          .eq("id", current.id)
          .eq("role", current.role)
          .select("id")
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error(
            "Server did not confirm staff update."
          );
        }
      }

      /* ---------------------------------------------------
         SYNC ACCOUNT ACTIVATION / DEACTIVATION
      --------------------------------------------------- */

      else {
        const currentlyActive = current.is_active !== false;

        if (currentlyActive !== action.active) {
          if (
            currentlyActive !== action.expectedActive
          ) {
            throw new Error(
              "Account status changed on another device."
            );
          }

          const { data, error } = await supabase
            .from("users")
            .update({
              is_active: action.active,
            })
            .eq("id", current.id)
            .eq("role", current.role)
            .select("id")
            .maybeSingle();

          if (error) {
            throw error;
          }

          if (!data) {
            throw new Error(
              "Server did not confirm status change."
            );
          }
        }
      }

      // Remove the queued action only after successful sync.
      await db.queue.delete(action.id);

      count++;
    }

    return count;
  })();

  try {
    return await running;
  } finally {
    running = null;
  }
}
