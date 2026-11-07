
import Dexie from "dexie";
import { supabase } from "./supabase";

/* =========================================================
   OFFLINE DATABASE
========================================================= */

const db = new Dexie("mchms-admin-staff-v1");

// Version 2 keeps the existing records and adds
// an index for tracking synchronization status.
db.version(1).stores({
  snapshots: "adminId",
  queue: "++id,adminId,createdAt",
});

db.version(2).stores({
  snapshots: "adminId",
  queue: "++id,adminId,createdAt,syncStatus",
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

const allowedFields = [
  "first_name",
  "last_name",
  "email",
  "username",
  "district_id",
];

/* =========================================================
   AUDIT LOGGING
========================================================= */

async function recordStaffAudit(admin, action, current, details) {
  const { error } = await supabase
    .from("it_audit_logs")
    .insert({
      actor_id: admin.id,
      action,
      entity_type: "users",
      entity_id: String(current.id),
      details: {
        module: "Staff Management",
        source: "offline_sync",
        target_username: current.username,
        target_role: current.role,
        ...details,
      },
      status: "success",
    });

  if (error) {
    throw new Error(
      `Staff update synchronized, but audit logging failed: ${error.message}`
    );
  }
}

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
    users: (users || []).map(stripPassword),
    districts: districts || [],
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

  if (!action.userId) {
    throw new Error("Staff ID is required.");
  }

  if (action.type === "edit") {
    const changes = action.changes || {};

    if (
      Object.keys(changes).some(
        (field) => !allowedFields.includes(field)
      )
    ) {
      throw new Error(
        "Passwords and roles cannot be queued offline."
      );
    }

    if (!action.expected) {
      throw new Error(
        "Original staff values are required for conflict detection."
      );
    }
  }

  if (
    action.type === "status" &&
    typeof action.active !== "boolean"
  ) {
    throw new Error("Invalid account status.");
  }

  // Prevent multiple pending changes for the same staff member.
  const pending = await pendingStaffActions(admin);

  if (
    pending.some(
      (item) =>
        String(item.userId) === String(action.userId)
    )
  ) {
    throw new Error(
      "This staff member has a pending change. Sync it before editing again."
    );
  }

  await db.queue.add({
    adminId: key(admin),
    ...action,
    syncStatus: "pending",
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
      /* ---------------------------------------------------
         ALREADY APPLIED, AUDIT STILL PENDING
      --------------------------------------------------- */

      if (action.syncStatus === "audit_pending") {
        if (!action.auditPayload) {
          throw new Error(
            "Audit information is missing for a synchronized staff action."
          );
        }

        await recordStaffAudit(
          admin,
          action.auditPayload.action,
          action.auditPayload.current,
          action.auditPayload.details
        );

        await db.queue.delete(action.id);

        count++;
        continue;
      }

      /* ---------------------------------------------------
         FETCH CURRENT STAFF RECORD
      --------------------------------------------------- */

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

      let auditPayload = null;

      /* ---------------------------------------------------
         SYNC STAFF PROFILE EDITS
      --------------------------------------------------- */

      if (action.type === "edit") {
        const changes = action.changes || {};
        const keys = Object.keys(changes);

        if (!keys.length) {
          await db.queue.delete(action.id);
          count++;
          continue;
        }

        // Detect changes made from another device.
        if (
          keys.some(
            (field) =>
              String(current[field] ?? "") !==
              String(action.expected?.[field] ?? "")
          )
        ) {
          throw new Error(
            `Staff ${current.id} was edited on another device. Review before retrying.`
          );
        }

        const changedFields = keys.filter(
          (field) =>
            String(current[field] ?? "") !==
            String(changes[field] ?? "")
        );

        if (!changedFields.length) {
          await db.queue.delete(action.id);
          count++;
          continue;
        }

        const { data, error } = await supabase
          .from("users")
          .update(changes)
          .eq("id", current.id)
          .eq("role", current.role)
          .select(
            "id,role,username,district_id"
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error(
            "Server did not confirm staff update."
          );
        }

        auditPayload = {
          action: "account_updated",

          current: {
            id: current.id,
            username: current.username,
            role: current.role,
          },

          details: {
            changed_fields: changedFields,

            previous_district_id:
              current.district_id,

            new_district_id:
              data.district_id,

            message:
              `Offline staff changes synchronized for ${current.username}.`,
          },
        };
      }

      /* ---------------------------------------------------
         SYNC ACCOUNT ACTIVATION / DEACTIVATION
      --------------------------------------------------- */

      else if (action.type === "status") {
        const currentlyActive =
          current.is_active === true;

        if (currentlyActive === action.active) {
          // Desired status already exists.
          await db.queue.delete(action.id);
          count++;
          continue;
        }

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
          .select(
            "id,role,username,district_id,is_active"
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error(
            "Server did not confirm status change."
          );
        }

        auditPayload = {
          action: action.active
            ? "account_activated"
            : "account_deactivated",

          current: {
            id: current.id,
            username: current.username,
            role: current.role,
          },

          details: {
            previous_status: currentlyActive,
            new_status: data.is_active,

            district_id: data.district_id,

            message:
              `${current.role} account ${
                action.active
                  ? "activated"
                  : "deactivated"
              } during offline synchronization: ${current.username}`,
          },
        };
      }

      /* ---------------------------------------------------
         MARK DATABASE UPDATE AS COMPLETED
      --------------------------------------------------- */

      if (auditPayload) {
        // Save the audit information before attempting
        // to insert the audit record.
        await db.queue.update(action.id, {
          syncStatus: "audit_pending",
          auditPayload,
        });

        /* ---------------------------------------------------
           INSERT AUDIT LOG
        --------------------------------------------------- */

        await recordStaffAudit(
          admin,
          auditPayload.action,
          auditPayload.current,
          auditPayload.details
        );
      }

      /* ---------------------------------------------------
         REMOVE SUCCESSFULLY SYNCHRONIZED ACTION
      --------------------------------------------------- */

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
