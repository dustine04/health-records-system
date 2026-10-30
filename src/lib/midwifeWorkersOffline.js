import Dexie from "dexie";
import { supabase } from "./supabase";

const db = new Dexie("mchms-midwife-workers-v2");

db.version(1).stores({
  snapshots: "key",
  queue: "++id, key, createdAt",
});

const userKey = (user) => `${user.id}:${user.district_id}`;

export async function getWorkersSnapshot(user) {
  return (await db.snapshots.get(userKey(user))) || null;
}

export async function saveWorkersSnapshot(user, data) {
  await db.snapshots.put({
    key: userKey(user),
    ...data,
    cachedAt: new Date().toISOString(),
  });
}

export async function getWorkerAreaSnapshot(user, workerId) {
  return (
    (await db.snapshots.get(
      `${userKey(user)}:areas:${workerId}`
    )) || null
  );
}

export async function saveWorkerAreaSnapshot(user, workerId, data) {
  await db.snapshots.put({
    key: `${userKey(user)}:areas:${workerId}`,
    ...data,
    cachedAt: new Date().toISOString(),
  });
}

export async function pendingWorkerActions(user) {
  return db.queue
    .where("key")
    .equals(userKey(user))
    .sortBy("createdAt");
}

export async function queueWorkerAction(user, action) {
  if (!user?.id || user.role !== "midwife" || !user.district_id) {
    throw new Error("A valid Midwife account is required.");
  }

  await db.queue.add({
    key: userKey(user),
    ...action,
    createdAt: Date.now(),
  });
}

async function checkedWorker(user, workerId) {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, role, is_active, barangay_id, barangays(id, district_id)"
    )
    .eq("id", workerId)
    .maybeSingle();

  if (error) throw error;

  if (
    !data ||
    !["bns", "bhw"].includes(data.role) ||
    String(data.barangays?.district_id) !==
      String(user.district_id)
  ) {
    throw new Error(
      "This worker is no longer eligible for management in your district."
    );
  }

  return data;
}

async function applyStatus(user, action) {
  const worker = await checkedWorker(user, action.workerId);

  if (worker.is_active !== action.active) {
    if (worker.is_active !== action.expectedActive) {
      throw new Error(
        "The worker's status changed on another device. Review the record before retrying."
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({ is_active: action.active })
      .eq("id", worker.id)
      .eq("is_active", action.expectedActive)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "Supabase did not confirm the account status change."
      );
    }
  }

  if (action.active === false) {
    const { error } = await supabase
      .from("worker_area_assignments")
      .update({ is_active: false })
      .eq("worker_id", worker.id)
      .eq("is_active", true);

    if (error) throw error;
  }
}

async function applyAreas(user, action) {
  const worker = await checkedWorker(user, action.workerId);

  if (worker.is_active !== true) {
    throw new Error(
      "Activate this worker before assigning Purok/Sitio areas."
    );
  }

  const { data: areas, error: areasError } = await supabase
    .from("local_areas")
    .select("id, barangay_id")
    .eq("barangay_id", worker.barangay_id);

  if (areasError) throw areasError;

  const allowedIds = new Set(
    (areas || []).map((area) => String(area.id))
  );

  const requestedIds = [...new Set(action.areaIds.map(String))];

  if (requestedIds.some((id) => !allowedIds.has(id))) {
    throw new Error(
      "One or more selected areas no longer belong to this worker's barangay."
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("worker_area_assignments")
    .select("id, local_area_id, is_active")
    .eq("worker_id", worker.id);

  if (existingError) throw existingError;

  const existingByArea = new Map(
    (existing || []).map((row) => [
      String(row.local_area_id),
      row,
    ])
  );

  const selected = new Set(requestedIds);

  for (const row of existing || []) {
    if (
      row.is_active &&
      !selected.has(String(row.local_area_id))
    ) {
      const { error } = await supabase
        .from("worker_area_assignments")
        .update({ is_active: false })
        .eq("id", row.id);

      if (error) throw error;
    }
  }

  for (const areaId of requestedIds) {
    const previous = existingByArea.get(areaId);

    if (previous) {
      if (!previous.is_active) {
        const { error } = await supabase
          .from("worker_area_assignments")
          .update({
            is_active: true,
            assigned_by: user.id,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", previous.id);

        if (error) throw error;
      }
    } else {
      const { error } = await supabase
        .from("worker_area_assignments")
        .insert({
          worker_id: worker.id,
          local_area_id: Number(areaId),
          assigned_by: user.id,
          is_active: true,
        });

      if (error) throw error;
    }
  }
}

let activeSync = null;

export async function syncWorkerActions(user) {
  if (activeSync) return activeSync;

  activeSync = performSync(user);

  try {
    return await activeSync;
  } finally {
    activeSync = null;
  }
}

async function performSync(user) {
  if (!navigator.onLine) {
    throw new Error("Offline. Changes remain queued.");
  }

  if (!user?.id || user.role !== "midwife" || !user.district_id) {
    throw new Error("Invalid Midwife session.");
  }

  const actions = await pendingWorkerActions(user);
  let synced = 0;

  for (const action of actions) {
    if (action.type === "status") {
      await applyStatus(user, action);
    } else if (action.type === "areas") {
      await applyAreas(user, action);
    } else {
      throw new Error("Unknown queued action.");
    }

    await db.queue.delete(action.id);
    synced++;
  }

  return synced;
}