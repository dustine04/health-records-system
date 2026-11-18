
import Dexie from "dexie";
import { supabase } from "./supabase";

// This database is separate from the BNS offline queue.
const db = new Dexie("mchms-midwife-child-monitoring-v1");

db.version(1).stores({
  snapshots: "key",
  queue: "++id, owner, createdAt",
  drafts: "key",
});

const owner = (user) =>
  `${user.id}:${user.role}:${user.district_id}`;

const key = (user, type, id = "all") =>
  `${owner(user)}:${type}:${id}`;

// =========================================================
// OFFLINE CACHE
// =========================================================

export async function readChildMonitoringCache(user, type, id) {
  return (
    await db.snapshots.get(key(user, type, id))
  )?.data ?? null;
}

export async function writeChildMonitoringCache(user, type, id, data) {
  await db.snapshots.put({
    key: key(user, type, id),
    data,
    savedAt: new Date().toISOString(),
  });
}

// =========================================================
// AUTOMATIC LOCAL DRAFTS
// =========================================================

export async function readChildMonitoringDraft(
  user,
  childId,
  section,
  recordId
) {
  return (
    await db.drafts.get(
      key(user, `draft:${section}:${recordId}`, childId)
    )
  )?.data ?? null;
}

export async function writeChildMonitoringDraft(
  user,
  childId,
  section,
  recordId,
  data
) {
  await db.drafts.put({
    key: key(user, `draft:${section}:${recordId}`, childId),
    data,
    savedAt: new Date().toISOString(),
  });
}

export async function deleteChildMonitoringDraft(
  user,
  childId,
  section,
  recordId
) {
  await db.drafts.delete(
    key(user, `draft:${section}:${recordId}`, childId)
  );
}

// =========================================================
// PENDING SYNCHRONIZATION
// =========================================================

export async function pendingChildMonitoringChanges(user) {
  return db.queue
    .where("owner")
    .equals(owner(user))
    .sortBy("createdAt");
}

export const TABLES = {
  newborn: "child_newborn_tracking",
  monitoring: "child_monitoring",
  immunization: "child_immunization",
  feeding: "child_feeding",
  micronutrients: "child_micronutrients",
  deworming: "child_deworming",
  followup: "child_followups",
};

export async function queueChildMonitoringChange(user, operation) {
  if (
    !user?.id ||
    !user?.district_id ||
    !["midwife", "nurse"].includes(user.role)
  ) {
    throw new Error(
      "A valid district-assigned Midwife or Nurse session is required."
    );
  }

  if (!["insert", "update", "delete"].includes(operation.method)) {
    throw new Error("Invalid operation.");
  }

  if (!Object.values(TABLES).includes(operation.table)) {
    throw new Error("Invalid monitoring table.");
  }

  if (!operation.childHealthRecordId) {
    throw new Error("Missing child health record ID.");
  }

  if (operation.method !== "insert" && operation.rowId == null) {
    throw new Error("Missing record ID.");
  }

  return db.queue.add({
    ...operation,
    owner: owner(user),
    createdAt: new Date().toISOString(),
  });
}

// =========================================================
// VERIFY DISTRICT AND NURSE AUTHORIZATION
// =========================================================

async function checkScope(user, childHealthRecordId) {
  const { data: child, error: ce } = await supabase
    .from("child_health_records")
    .select("id,resident_id")
    .eq("id", childHealthRecordId)
    .single();

  if (ce) throw ce;

  const { data: resident, error: re } = await supabase
    .from("residents")
    .select("households(local_areas(barangays(district_id)))")
    .eq("id", child.resident_id)
    .single();

  if (re) throw re;

  const district =
    resident?.households?.local_areas?.barangays?.district_id;

  if (String(district) !== String(user.district_id)) {
    throw new Error("Child is outside your district.");
  }

  if (user.role === "nurse") {
    const { data, error } = await supabase
      .from("child_monitoring_access")
      .select("id")
      .eq("nurse_id", user.id)
      .eq("district_id", user.district_id)
      .eq("is_active", true)
      .limit(1);

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "Nurse monitoring authorization is not active."
      );
    }
  }
}

// =========================================================
// SYNCHRONIZE OFFLINE CHANGES
// =========================================================

// Stop at the first failure.
// Failed operations remain in the local queue.
// Supabase must enforce the required permissions/RLS.

export async function syncChildMonitoringChanges(user) {
  if (!navigator.onLine) {
    throw new Error(
      "Connect to the internet to synchronize."
    );
  }

  const entries = await pendingChildMonitoringChanges(user);

  let completed = 0;

  for (const item of entries) {
    if (!Object.values(TABLES).includes(item.table)) {
      throw new Error("Unsupported monitoring table.");
    }

    // Check district and authorization before syncing.
    await checkScope(user, item.childHealthRecordId);

    let request;

    if (item.method === "insert") {
      request = supabase
        .from(item.table)
        .insert(item.payload)
        .select("id");

    } else if (item.method === "update") {
      request = supabase
        .from(item.table)
        .update(item.payload)
        .eq("id", item.rowId)
        .eq(
          "child_health_record_id",
          item.childHealthRecordId
        )
        .select("id");

    } else if (item.method === "delete") {
      request = supabase
        .from(item.table)
        .delete()
        .eq("id", item.rowId)
        .eq(
          "child_health_record_id",
          item.childHealthRecordId
        )
        .select("id");

    } else {
      throw new Error("Unsupported operation.");
    }

    const { data, error } = await request;

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "Server did not confirm the change; synchronization stopped."
      );
    }

    // Remove the operation only after Supabase confirms it.
    await db.queue.delete(item.id);

    completed += 1;
  }

  return completed;
}
