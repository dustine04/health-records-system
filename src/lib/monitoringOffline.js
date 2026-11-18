
import Dexie from "dexie";
import { supabase } from "./supabase";
import {
  getCachedChildren,
  refreshChildSnapshot,
  syncChildMutations,
} from "./childOffline";

/* =========================================================
   MONITORING SECTIONS
========================================================= */

const sections = {
  newborn: ["child_newborn_tracking", null],
  monitoring: ["child_monitoring", "monitoring_date"],
  immunization: ["child_immunization", "vaccination_date"],
  feeding: ["child_feeding", "record_date"],
  micronutrients: ["child_micronutrients", "supplementation_date"],
  deworming: ["child_deworming", "deworming_date"],
  followup: ["child_followups", "followup_date"],
};

/* =========================================================
   SCHEDULING FIELDS

   These fields are saved with the normal monitoring records.
   No additional IndexedDB table is required.
========================================================= */

const schedulingFields = {
  monitoring: ["next_visit_date"],
  immunization: ["next_visit_date", "next_vaccine_name"],
};

/* =========================================================
   INDEXEDDB DATABASE

   Keep version 1 because the object store structure
   has not changed.
========================================================= */

export const monitoringDB = new Dexie(
  "mchms-bns-child-monitoring-v1"
);

monitoringDB.version(1).stores({
  snapshots: "userId",
  queue: "uuid,userId,createdAt",
});

/* =========================================================
   HELPERS
========================================================= */

const key = (id) => String(id);

const isLocalId = (id) =>
  String(id).startsWith("local:");

const uuid = () => crypto.randomUUID();

const emptyRecords = () =>
  Object.fromEntries(
    Object.keys(sections).map((section) => [section, []])
  );

const pendingRows = (userId) =>
  monitoringDB.queue
    .where("userId")
    .equals(key(userId))
    .sortBy("createdAt");

function normalizeSchedulingData(section, data) {
  const normalized = { ...data };

  const fields = schedulingFields[section] || [];

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      const value = normalized[field];

      normalized[field] =
        typeof value === "string"
          ? value.trim() || null
          : value ?? null;
    }
  }

  return normalized;
}

function normalizeRecords(records) {
  const normalized = {
    ...emptyRecords(),
    ...(records || {}),
  };

  for (const section of Object.keys(sections)) {
    if (!Array.isArray(normalized[section])) {
      normalized[section] = [];
    }
  }

  return normalized;
}

function sortRecords(records) {
  for (const [section, [, dateField]] of Object.entries(sections)) {
    if (!dateField) continue;

    records[section].sort((a, b) =>
      String(b[dateField] || "").localeCompare(
        String(a[dateField] || "")
      )
    );
  }

  return records;
}

/* =========================================================
   APPOINTMENT STATUS HELPER

   Exported for use in the BNS Dashboard.

   Uses local calendar dates rather than UTC dates.
========================================================= */

export function getMonitoringScheduleStatus(nextVisitDate) {
  if (!nextVisitDate) {
    return {
      status: "not_scheduled",
      label: "Not Scheduled",
      daysDifference: null,
    };
  }

  const today = new Date();

  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const toDayNumber = (dateString) => {
    const match = String(dateString).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return Math.floor(date.getTime() / 86400000);
  };

  const todayNumber = toDayNumber(todayString);
  const visitNumber = toDayNumber(nextVisitDate);

  if (visitNumber === null) {
    return {
      status: "not_scheduled",
      label: "Not Scheduled",
      daysDifference: null,
    };
  }

  const daysDifference = visitNumber - todayNumber;

  if (daysDifference < 0) {
    return {
      status: "missed",
      label: "Missed / Overdue",
      daysDifference,
    };
  }

  if (daysDifference === 0) {
    return {
      status: "due_today",
      label: "Due Today",
      daysDifference,
    };
  }

  if (daysDifference <= 7) {
    return {
      status: "upcoming",
      label: "Upcoming",
      daysDifference,
    };
  }

  return {
    status: "scheduled",
    label: "Scheduled",
    daysDifference,
  };
}

/* =========================================================
   PENDING MONITORING COUNT
========================================================= */

export async function pendingMonitoringCount(userId) {
  if (!userId) return 0;

  return monitoringDB.queue
    .where("userId")
    .equals(key(userId))
    .count();
}

/* =========================================================
   CACHED CHILDREN
========================================================= */

export async function cachedMonitoringChildren(userId) {
  const base = await getCachedChildren(userId);

  const own = await monitoringDB.snapshots.get(key(userId));

  return base.children.length || base.cachedAt
    ? base.children
    : own?.children || [];
}

/* =========================================================
   REFRESH CHILDREN
========================================================= */

export async function refreshMonitoringChildren(userId) {
  const result = await refreshChildSnapshot(userId);

  const previous =
    (await monitoringDB.snapshots.get(key(userId))) || {};

  await monitoringDB.snapshots.put({
    ...previous,
    userId: key(userId),
    children: result.children,
  });

  return result.children;
}

/* =========================================================
   GET CACHED MONITORING RECORDS

   Includes pending offline changes and scheduling fields.
========================================================= */

export async function cachedMonitoringRecords(userId, childId) {
  const snapshot = await monitoringDB.snapshots.get(key(userId));

  const cached =
    snapshot?.records?.[key(childId)] || emptyRecords();

  const data = normalizeRecords(structuredClone(cached));

  const pending = await pendingRows(userId);

  for (const mutation of pending) {
    if (key(mutation.childId) !== key(childId)) continue;

    const section = mutation.section;

    if (!data[section]) continue;

    const records = data[section];

    const index = records.findIndex(
      (record) => key(record.id) === key(mutation.recordId)
    );

    if (mutation.kind === "delete") {
      if (index >= 0) {
        records.splice(index, 1);
      }

      continue;
    }

    const normalized = normalizeSchedulingData(
      section,
      mutation.data || {}
    );

    const item = {
      ...(index >= 0 ? records[index] : {}),
      ...normalized,
      id: mutation.recordId,
      child_health_record_id: childId,
      _pending: true,
    };

    if (index >= 0) {
      records[index] = item;
    } else {
      records.unshift(item);
    }
  }

  return sortRecords(data);
}

/* =========================================================
   REFRESH MONITORING RECORDS FROM SUPABASE

   Uses select("*") so new scheduling columns are included.
========================================================= */

export async function refreshMonitoringRecords(userId, childId) {
  if (!navigator.onLine || isLocalId(childId)) {
    return cachedMonitoringRecords(userId, childId);
  }

  const entries = await Promise.all(
    Object.entries(sections).map(
      async ([section, [table, dateField]]) => {
        let query = supabase
          .from(table)
          .select("*")
          .eq("child_health_record_id", childId);

        if (dateField) {
          query = query.order(dateField, {
            ascending: false,
          });
        }

        const { data, error } = await query;

        if (error) throw error;

        return [section, data || []];
      }
    )
  );

  const snapshot =
    (await monitoringDB.snapshots.get(key(userId))) || {
      userId: key(userId),
      records: {},
    };

  snapshot.records ||= {};

  snapshot.records[key(childId)] = Object.fromEntries(entries);

  await monitoringDB.snapshots.put(snapshot);

  return cachedMonitoringRecords(userId, childId);
}

/* =========================================================
   SAVE MONITORING RECORD LOCALLY

   Supports offline scheduling fields.
========================================================= */

export async function saveMonitoringLocal(
  userId,
  childId,
  section,
  recordId,
  data
) {
  if (!sections[section]) {
    throw new Error("Unknown monitoring section.");
  }

  const id = recordId || `local:${uuid()}`;

  const normalizedData = normalizeSchedulingData(
    section,
    data
  );

  await monitoringDB.transaction(
    "rw",
    monitoringDB.queue,
    async () => {
      const rows = await pendingRows(userId);

      const previous = rows.find(
        (mutation) =>
          mutation.section === section &&
          key(mutation.childId) === key(childId) &&
          key(mutation.recordId) === key(id)
      );

      if (previous) {
        await monitoringDB.queue.update(previous.uuid, {
          kind: "save",
          data: normalizedData,
        });
      } else {
        await monitoringDB.queue.add({
          uuid: uuid(),
          userId: key(userId),
          childId,
          section,
          recordId: id,
          kind: "save",
          data: normalizedData,
          createdAt: Date.now(),
        });
      }
    }
  );

  return id;
}

/* =========================================================
   DELETE MONITORING RECORD LOCALLY
========================================================= */

export async function deleteMonitoringLocal(
  userId,
  childId,
  section,
  recordId
) {
  if (!sections[section]) {
    throw new Error("Unknown monitoring section.");
  }

  await monitoringDB.transaction(
    "rw",
    monitoringDB.queue,
    async () => {
      const rows = await pendingRows(userId);

      const previous = rows.find(
        (mutation) =>
          mutation.section === section &&
          key(mutation.childId) === key(childId) &&
          key(mutation.recordId) === key(recordId)
      );

      if (previous) {
        await monitoringDB.queue.delete(previous.uuid);
      }

      // Unsynced local records do not exist in Supabase.
      if (isLocalId(recordId)) return;

      await monitoringDB.queue.add({
        uuid: uuid(),
        userId: key(userId),
        childId,
        section,
        recordId,
        kind: "delete",
        createdAt: Date.now(),
      });
    }
  );
}

/* =========================================================
   RESOLVE CHILD SERVER ID

   A child registered offline must be synchronized first.
========================================================= */

async function serverChildId(childId) {
  if (!isLocalId(childId)) {
    return childId;
  }

  const syncId = String(childId).slice(6);

  const { data, error } = await supabase
    .from("child_health_records")
    .select("id")
    .eq("sync_uuid", syncId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "Child registration is not synchronized yet. " +
      "Sync Child Registration first."
    );
  }

  return data.id;
}

/* =========================================================
   RESOLVE LOCAL MONITORING RECORD ID

   Used after a record is synchronized.
========================================================= */

async function resolveServerRecordId(table, recordId) {
  if (!isLocalId(recordId)) return recordId;

  const syncId = String(recordId).slice(6);

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("sync_uuid", syncId)
    .maybeSingle();

  if (error) throw error;

  return data?.id || null;
}

/* =========================================================
   REFRESH CACHED RECORDS AFTER SYNC
========================================================= */

async function refreshAffectedChildren(userId, childIds) {
  for (const childId of childIds) {
    try {
      const resolvedId = await serverChildId(childId);

      await refreshMonitoringRecords(userId, resolvedId);

      // Remove obsolete temporary child cache after sync.
      if (isLocalId(childId)) {
        const snapshot = await monitoringDB.snapshots.get(
          key(userId)
        );

        if (snapshot?.records?.[key(childId)]) {
          delete snapshot.records[key(childId)];

          await monitoringDB.snapshots.put(snapshot);
        }
      }
    } catch (error) {
      // Cache refresh failure must not undo successful uploads.
      console.warn(
        "Unable to refresh monitoring cache:",
        error
      );
    }
  }
}

/* =========================================================
   SYNCHRONIZATION

   - Syncs parent child registration first
   - Uploads pending monitoring changes
   - Includes next_visit_date and next_vaccine_name
   - Keeps failed changes in the offline queue
   - Refreshes affected child records after successful sync
========================================================= */

let syncing = false;

export async function syncMonitoring(userId) {
  if (syncing) {
    return {
      uploaded: 0,
      error: "Sync already in progress",
    };
  }

  if (!navigator.onLine) {
    return {
      uploaded: 0,
      error: "Offline. Changes remain on this device.",
    };
  }

  syncing = true;

  let uploaded = 0;

  const affectedChildren = new Set();

  try {
    // Parent child registrations must be synchronized first.
    const parent = await syncChildMutations(userId);

    if (parent?.error) {
      return {
        uploaded,
        error: `Child Registration: ${parent.error}`,
      };
    }

    const mutations = await pendingRows(userId);

    for (const mutation of mutations) {
      try {
        const section = mutation.section;

        const [table] = sections[section] || [];

        if (!table) {
          throw new Error("Unknown monitoring section.");
        }

        if (mutation.kind === "delete") {
          const resolvedId = await resolveServerRecordId(
            table,
            mutation.recordId
          );

          if (resolvedId) {
            const { error } = await supabase
              .from(table)
              .delete()
              .eq("id", resolvedId);

            if (error) throw error;
          }
        } else {
          const child_health_record_id =
            await serverChildId(mutation.childId);

          const normalizedData = normalizeSchedulingData(
            section,
            mutation.data || {}
          );

          if (isLocalId(mutation.recordId)) {
            const sync_uuid = String(
              mutation.recordId
            ).slice(6);

            const { error } = await supabase
              .from(table)
              .upsert(
                {
                  ...normalizedData,
                  child_health_record_id,
                  sync_uuid,
                },
                {
                  onConflict: "sync_uuid",
                }
              );

            if (error) throw error;
          } else {
            const { data, error } = await supabase
              .from(table)
              .update({
                ...normalizedData,
                child_health_record_id,
              })
              .eq("id", mutation.recordId)
              .select("id");

            if (error) throw error;

            if (!data?.length) {
              throw new Error(
                "Update not permitted or record missing."
              );
            }
          }
        }

        // Remove the mutation only after server success.
        await monitoringDB.queue.delete(mutation.uuid);

        affectedChildren.add(key(mutation.childId));

        uploaded++;
      } catch (error) {
        // Refresh successful uploads before returning.
        if (affectedChildren.size > 0) {
          await refreshAffectedChildren(
            userId,
            affectedChildren
          );
        }

        return {
          uploaded,
          error: error.message || "Sync failed",
        };
      }
    }

    if (affectedChildren.size > 0) {
      await refreshAffectedChildren(
        userId,
        affectedChildren
      );
    }

    return {
      uploaded,
      error: null,
    };
  } catch (error) {
    return {
      uploaded,
      error: error.message || "Synchronization failed",
    };
  } finally {
    syncing = false;
  }
}
