
import Dexie from "dexie";
import { supabase } from "./supabase";

export const childOfflineDB = new Dexie("mchms-child-registration-v1");

childOfflineDB.version(1).stores({
  snapshots: "userId",
  mutations: "uuid,userId,createdAt",
});

const userKey = (id) => String(id);
const uid = () => crypto.randomUUID();
const asRelation = (v) => (Array.isArray(v) ? v[0] : v);
const localId = (uuid) => `local:${uuid}`;

export async function getCachedChildren(userId) {
  const snapshot = await childOfflineDB.snapshots.get(userKey(userId));

  const mutations = await childOfflineDB.mutations
    .where("userId")
    .equals(userKey(userId))
    .sortBy("createdAt");

  const children = [...(snapshot?.children || [])];

  for (const m of mutations) {
    if (m.kind === "create-child") {
      const area = (snapshot?.areas || []).find(
        (a) => String(a.id) === String(m.household.local_area_id)
      );

      const child = {
        id: localId(m.uuid),
        first_name: m.resident.first_name,
        middle_name: m.resident.middle_name,
        last_name: m.resident.last_name,
        sex: m.resident.sex,
        birth_date: m.resident.birth_date,
        households: {
          household_code: m.household.household_code,
          household_head: m.household.household_head,
          local_area_id: m.household.local_area_id,
          local_areas: {
            id: area?.id,
            name: area?.name,
            type: area?.type,
            barangays: {
              name: area?.barangay_name || "",
            },
          },
        },
        health_record: {
          ...m.record,
          id: localId(m.uuid),
          resident_id: localId(m.uuid),
          _pending: true,
        },
      };

      children.push(child);
    } else {
      const idx = children.findIndex(
        (c) => String(c.id) === String(m.residentId)
      );

      if (idx < 0) continue;

      if (m.kind === "delete-record") {
        children[idx] = {
          ...children[idx],
          health_record: null,
          _pendingDelete: true,
        };
      } else if (m.kind === "save-record") {
        children[idx] = {
          ...children[idx],
          health_record: {
            ...children[idx].health_record,
            ...m.record,
            id: m.recordId || localId(m.uuid),
            resident_id: m.residentId,
            _pending: true,
          },
        };
      }
    }
  }

  return {
    children,
    areas: snapshot?.areas || [],
    cachedAt: snapshot?.cachedAt || null,
    pending: mutations.length,
  };
}

export async function queueChildMutation(userId, mutation) {
  const uuid = uid();

  const row = {
    ...mutation,
    uuid,
    userId: userKey(userId),
    createdAt: Date.now(),
  };

  await childOfflineDB.mutations.put(row);
  return row;
}

export async function queueRecordChange(
  userId,
  residentId,
  recordId,
  record
) {
  const key = userKey(userId);

  return childOfflineDB.transaction(
    "rw",
    childOfflineDB.mutations,
    async () => {
      const pending = await childOfflineDB.mutations
        .where("userId")
        .equals(key)
        .toArray();

      const existing = pending.find(
        (m) =>
          m.kind === "save-record" &&
          String(m.residentId) === String(residentId)
      );

      if (existing) {
        await childOfflineDB.mutations.update(existing.uuid, {
          record,
          recordId: recordId || existing.recordId,
        });

        return existing;
      }

      const row = {
        uuid: uid(),
        userId: key,
        createdAt: Date.now(),
        kind: "save-record",
        residentId,
        recordId,
        record,
      };

      await childOfflineDB.mutations.add(row);
      return row;
    }
  );
}

export async function queueRecordDeletion(
  userId,
  residentId,
  recordId
) {
  const key = userKey(userId);

  await childOfflineDB.transaction(
    "rw",
    childOfflineDB.mutations,
    async () => {
      const rows = await childOfflineDB.mutations
        .where("userId")
        .equals(key)
        .toArray();

      const existing = rows.find(
        (m) =>
          m.kind === "save-record" &&
          String(m.residentId) === String(residentId)
      );

      if (existing) {
        await childOfflineDB.mutations.delete(existing.uuid);
      }

      if (!recordId || String(recordId).startsWith("local:")) {
        return;
      }

      const priorDelete = rows.find(
        (m) =>
          m.kind === "delete-record" &&
          String(m.recordId) === String(recordId)
      );

      if (!priorDelete) {
        await childOfflineDB.mutations.add({
          uuid: uid(),
          userId: key,
          createdAt: Date.now(),
          kind: "delete-record",
          residentId,
          recordId,
        });
      }
    }
  );
}

export async function refreshChildSnapshot(userId) {
  if (!navigator.onLine) {
    throw new Error("Offline");
  }

  const { data: assignments, error: ae } = await supabase
    .from("worker_area_assignments")
    .select(
      "local_area_id,local_areas(id,name,type,barangays(id,name))"
    )
    .eq("worker_id", userId)
    .eq("is_active", true);

  if (ae) throw ae;

  const areas = (assignments || [])
    .map((a) => {
      const area = asRelation(a.local_areas);

      return (
        area && {
          id: area.id,
          name: area.name,
          type: area.type,
          barangay_name: asRelation(area.barangays)?.name || "",
        }
      );
    })
    .filter(Boolean)
    .filter(
      (a, i, arr) =>
        arr.findIndex((b) => String(a.id) === String(b.id)) === i
    );

  const areaIds = areas.map((a) => a.id);
  let children = [];

  if (areaIds.length) {
    const { data: households, error: he } = await supabase
      .from("households")
      .select("id,household_code,household_head,local_area_id")
      .in("local_area_id", areaIds);

    if (he) throw he;

    const householdIds = (households || []).map((h) => h.id);

    if (householdIds.length) {
      const { data: residents, error: re } = await supabase
        .from("residents")
        .select(
          "id,household_id,first_name,middle_name,last_name,sex,birth_date,households(id,household_code,household_head,local_area_id,local_areas(id,name,type,barangays(id,name)))"
        )
        .in("household_id", householdIds);

      if (re) throw re;

      const now = new Date();

      const eligible = (residents || []).filter((r) => {
        if (!r.birth_date) return false;

        const b = new Date(`${r.birth_date}T00:00:00`);

        if (Number.isNaN(b.getTime()) || b > now) {
          return false;
        }

        const fifth = new Date(b);
        fifth.setFullYear(fifth.getFullYear() + 5);

        return now < fifth;
      });

      let records = [];
      const ids = eligible.map((r) => r.id);

      if (ids.length) {
        const { data, error } = await supabase
          .from("child_health_records")
          .select("*")
          .in("resident_id", ids);

        if (error) throw error;

        records = data || [];
      }

      children = eligible.map((r) => ({
        ...r,
        households: asRelation(r.households),
        health_record:
          records.find(
            (rec) => String(rec.resident_id) === String(r.id)
          ) || null,
      }));
    }
  }

  await childOfflineDB.snapshots.put({
    userId: userKey(userId),
    areas,
    children,
    cachedAt: new Date().toISOString(),
  });

  return getCachedChildren(userId);
}

let running = false;

export async function syncChildMutations(userId) {
  if (running) {
    return { busy: true };
  }

  if (!navigator.onLine) {
    throw new Error(
      "No internet connection. Changes remain saved on this device."
    );
  }

  running = true;
  let uploaded = 0;

  try {
    const rows = await childOfflineDB.mutations
      .where("userId")
      .equals(userKey(userId))
      .sortBy("createdAt");

    for (const m of rows) {
      try {
        if (m.kind === "create-child") {
          const { data: household, error: he } = await supabase
            .from("households")
            .upsert(
              {
                ...m.household,
                sync_uuid: m.uuid,
              },
              { onConflict: "sync_uuid" }
            )
            .select("id")
            .single();

          if (he) throw he;

          const { data: resident, error: re } = await supabase
            .from("residents")
            .upsert(
              {
                ...m.resident,
                household_id: household.id,
                sync_uuid: m.uuid,
              },
              { onConflict: "sync_uuid" }
            )
            .select("id")
            .single();

          if (re) throw re;

          const { error: ce } = await supabase
            .from("child_health_records")
            .upsert(
              {
                ...m.record,
                resident_id: resident.id,
                sync_uuid: m.uuid,
              },
              { onConflict: "sync_uuid" }
            );

          if (ce) throw ce;
        } else if (m.kind === "save-record") {
          if (
            m.recordId &&
            !String(m.recordId).startsWith("local:")
          ) {
            const { data, error } = await supabase
              .from("child_health_records")
              .update(m.record)
              .eq("id", m.recordId)
              .select("id");

            if (error) throw error;

            if (!data?.length) {
              throw new Error(
                "Record not found or update not permitted"
              );
            }
          } else {
            const { error } = await supabase
              .from("child_health_records")
              .upsert(
                {
                  ...m.record,
                  resident_id: Number(m.residentId),
                  sync_uuid: m.uuid,
                },
                { onConflict: "sync_uuid" }
              );

            if (error) throw error;
          }
        } else if (m.kind === "delete-record") {
          const { error } = await supabase
            .from("child_health_records")
            .delete()
            .eq("id", m.recordId);

          if (error) throw error;
        }

        await childOfflineDB.mutations.delete(m.uuid);
        uploaded++;
      } catch (error) {
        return {
          uploaded,
          error: error.message || "Synchronization failed",
        };
      }
    }

    return {
      uploaded,
      error: null,
    };
  } finally {
    running = false;
  }
}

export async function clearChildOfflineCache(userId) {
  const pending = await childOfflineDB.mutations
    .where("userId")
    .equals(userKey(userId))
    .count();

  if (pending) {
    throw new Error(
      `Cannot clear: ${pending} unsynchronized change(s). Sync first.`
    );
  }

  await childOfflineDB.snapshots.delete(userKey(userId));
}
