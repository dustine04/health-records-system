
import Dexie from "dexie";
import { supabase } from "./supabase";

const db = new Dexie("mchms-admin-barangay-v1");

db.version(1).stores({
  snapshots: "key",
  queue: "++id,adminId,table,recordId,createdAt",
});

const adminId = (admin) => {
  if (!admin?.id || admin.role !== "cho_admin") {
    throw new Error("CHO Admin account required.");
  }
  return String(admin.id);
};

const cacheKey = (admin, type, id = "") =>
  `${adminId(admin)}:${type}:${id}`;

export async function getBarangayCache(admin) {
  return (
    (await db.snapshots.get(cacheKey(admin, "directory"))) ||
    null
  );
}

export async function saveBarangayCache(
  admin,
  barangays,
  districts
) {
  await db.snapshots.put({
    key: cacheKey(admin, "directory"),
    barangays,
    districts,
    cachedAt: Date.now(),
  });
}

export async function getAreasCache(admin, barangayId) {
  return (
    (await db.snapshots.get(
      cacheKey(admin, "areas", barangayId)
    )) || null
  );
}

export async function saveAreasCache(
  admin,
  barangayId,
  areas
) {
  await db.snapshots.put({
    key: cacheKey(admin, "areas", barangayId),
    areas,
    cachedAt: Date.now(),
  });
}

export async function pendingBarangayActions(admin) {
  return db.queue
    .where("adminId")
    .equals(adminId(admin))
    .sortBy("createdAt");
}

export async function queueBarangayEdit(
  admin,
  table,
  record,
  changes
) {
  if (
    !["barangays", "local_areas"].includes(table) ||
    !record?.id
  ) {
    throw new Error("Invalid edit.");
  }

  const fields =
    table === "barangays"
      ? ["name"]
      : ["name", "type"];

  const keys = Object.keys(changes || {});

  if (
    !keys.length ||
    keys.some((k) => !fields.includes(k))
  ) {
    throw new Error(
      "Only name/type edits can be queued."
    );
  }

  if (
    changes.name !== undefined &&
    !String(changes.name).trim()
  ) {
    throw new Error("Name is required.");
  }

  if (
    changes.type !== undefined &&
    !["purok", "sitio"].includes(changes.type)
  ) {
    throw new Error("Invalid area type.");
  }

  const pending = await pendingBarangayActions(admin);

  if (
    pending.some(
      (a) =>
        a.table === table &&
        String(a.recordId) === String(record.id)
    )
  ) {
    throw new Error(
      "This record already has a pending edit. Sync it before editing again."
    );
  }

  const expected = Object.fromEntries(
    keys.map((k) => [k, record[k]])
  );

  await db.queue.add({
    adminId: adminId(admin),
    table,
    recordId: record.id,
    changes: { ...changes },
    expected,
    createdAt: Date.now(),
  });
}

let running = null;

export async function syncBarangayActions(admin) {
  adminId(admin);

  if (!navigator.onLine) {
    throw new Error(
      "Offline. Changes remain queued."
    );
  }

  if (running) return running;

  running = (async () => {
    let count = 0;

    for (const action of await pendingBarangayActions(admin)) {
      const { data: current, error: readError } =
        await supabase
          .from(action.table)
          .select(
            action.table === "barangays"
              ? "id,name,district_id"
              : "id,name,type,barangay_id"
          )
          .eq("id", action.recordId)
          .maybeSingle();

      if (readError) throw readError;

      if (!current) {
        throw new Error(
          `${action.table} record ${action.recordId} no longer exists.`
        );
      }

      const keys = Object.keys(action.changes);

      const alreadyApplied = keys.every(
        (k) => current[k] === action.changes[k]
      );

      if (!alreadyApplied) {
        if (
          keys.some(
            (k) => current[k] !== action.expected[k]
          )
        ) {
          throw new Error(
            `${action.table} record ${action.recordId} changed on another device. Resolve the conflict before retrying.`
          );
        }

        let query = supabase
          .from(action.table)
          .update(action.changes)
          .eq("id", action.recordId);

        for (const k of keys) {
          query = query.eq(k, action.expected[k]);
        }

        const { data, error } = await query
          .select("id")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(
            "Server did not confirm the edit. It may have changed concurrently."
          );
        }
      }

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
