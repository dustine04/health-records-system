
import Dexie from 'dexie';
import { supabase } from './supabase';

// BNS offline storage. Keep the database name and schema compatible with existing devices.
export const householdDB = new Dexie('mchms-bns-households-v1');
householdDB.version(1).stores({
  snapshots: 'userId',
  queue: 'uuid,userId,createdAt',
  mappings: 'localId,userId',
});

const key = (id) => String(id);
const relation = (value) => Array.isArray(value) ? value[0] : value;
const freshId = () => `local:${crypto.randomUUID()}`;
const isLocal = (id) => String(id).startsWith('local:');
const fullName = (resident) => [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean).join(' ');
const ordered = (rows) => [...rows].sort((a, b) =>
  Number(b.is_household_head) - Number(a.is_household_head) ||
  String(a.last_name || '').localeCompare(String(b.last_name || ''))
);

async function queueRows(userId) {
  return householdDB.queue.where('userId').equals(key(userId)).sortBy('createdAt');
}

export async function pendingHouseholdCount(userId) {
  return householdDB.queue.where('userId').equals(key(userId)).count();
}

export async function getHouseholdCache(userId) {
  const snapshot = await householdDB.snapshots.get(key(userId));
  const houses = (snapshot?.households || []).map((house) => ({ ...house }));
  const residents = Object.fromEntries(
    Object.entries(snapshot?.residents || {}).map(([id, rows]) => [id, rows.map((resident) => ({ ...resident }))])
  );

  for (const mutation of await queueRows(userId)) {
    // Once a remote mutation has succeeded, do not replay it in the local overlay.
    // It is retained only until its audit event has been uploaded.
    if (mutation.syncStatus === 'audit_pending') continue;

    const householdId = String(mutation.householdId || mutation.entityId);
    if (mutation.type === 'household-save') {
      const index = houses.findIndex((house) => String(house.id) === String(mutation.entityId));
      const area = (snapshot?.areas || []).find((item) => String(item.id) === String(mutation.data.local_area_id));
      const item = {
        ...(index >= 0 ? houses[index] : {}),
        ...mutation.data,
        id: mutation.entityId,
        _pending: true,
        local_areas: area || (index >= 0 ? houses[index].local_areas : null),
      };
      if (index >= 0) houses[index] = item;
      else houses.unshift(item);
    } else if (mutation.type === 'household-delete') {
      const index = houses.findIndex((house) => String(house.id) === String(mutation.entityId));
      if (index >= 0) houses.splice(index, 1);
      delete residents[String(mutation.entityId)];
    } else if (mutation.type === 'resident-save') {
      const arr = residents[householdId] || [];
      const index = arr.findIndex((resident) => String(resident.id) === String(mutation.entityId));
      const item = {
        ...(index >= 0 ? arr[index] : {}),
        ...mutation.data,
        id: mutation.entityId,
        household_id: mutation.householdId,
        _pending: true,
      };
      if (item.is_household_head) {
        for (const resident of arr) resident.is_household_head = false;
        const house = houses.find((entry) => String(entry.id) === householdId);
        if (house) house.household_head = fullName(item);
      } else if (index >= 0 && arr[index].is_household_head) {
        const house = houses.find((entry) => String(entry.id) === householdId);
        if (house) house.household_head = null;
      }
      if (index >= 0) arr[index] = item;
      else arr.push(item);
      residents[householdId] = ordered(arr);
    } else if (mutation.type === 'resident-delete') {
      const arr = residents[householdId] || [];
      const removed = arr.find((resident) => String(resident.id) === String(mutation.entityId));
      residents[householdId] = arr.filter((resident) => String(resident.id) !== String(mutation.entityId));
      if (removed?.is_household_head) {
        const house = houses.find((entry) => String(entry.id) === householdId);
        if (house) house.household_head = null;
      }
    }
  }

  for (const house of houses) house.resident_count = (residents[String(house.id)] || []).length;
  return {
    areas: snapshot?.areas || [],
    households: houses,
    residents,
    cachedAt: snapshot?.cachedAt || null,
    pending: await pendingHouseholdCount(userId),
  };
}

export async function refreshHouseholdCache(userId) {
  if (!navigator.onLine) throw new Error('Internet unavailable');
  const { data: assignments, error: assignmentError } = await supabase
    .from('worker_area_assignments')
    .select('local_area_id,local_areas(id,name,type,barangay_id,barangays(id,name))')
    .eq('worker_id', userId)
    .eq('is_active', true);
  if (assignmentError) throw assignmentError;

  const areas = [...new Map(
    (assignments || []).map((entry) => relation(entry.local_areas)).filter(Boolean)
      .map((area) => [String(area.id), { ...area, barangays: relation(area.barangays) }])
  ).values()];

  let households = [];
  const residents = {};
  if (areas.length) {
    const { data: rows, error: householdError } = await supabase
      .from('households')
      .select('*,local_areas(id,name,type,barangays(id,name))')
      .in('local_area_id', areas.map((area) => area.id));
    if (householdError) throw householdError;
    households = (rows || []).map((house) => ({ ...house, local_areas: relation(house.local_areas) }));
    const ids = households.map((house) => house.id);
    if (ids.length) {
      const { data: residentRows, error: residentError } = await supabase
        .from('residents').select('*').in('household_id', ids);
      if (residentError) throw residentError;
      for (const house of households) {
        residents[String(house.id)] = ordered(
          (residentRows || []).filter((resident) => String(resident.household_id) === String(house.id))
        );
      }
    }
  }

  await householdDB.snapshots.put({
    userId: key(userId), areas, households, residents, cachedAt: new Date().toISOString(),
  });
  return getHouseholdCache(userId);
}

export async function saveHouseholdLocal(userId, entityId, data) {
  const id = entityId || freshId();
  await householdDB.queue.add({
    uuid: crypto.randomUUID(), userId: key(userId), createdAt: Date.now(),
    type: 'household-save', entityId: id, data,
  });
  return id;
}

export async function deleteHouseholdLocal(userId, entityId) {
  if (isLocal(entityId)) {
    const mapped = await householdDB.mappings.get(String(entityId));
    if (!mapped) {
      await householdDB.transaction('rw', householdDB.queue, async () => {
        for (const mutation of await queueRows(userId)) {
          if (mutation.syncStatus === 'audit_pending') continue;
          if (String(mutation.entityId) === String(entityId) || String(mutation.householdId) === String(entityId)) {
            await householdDB.queue.delete(mutation.uuid);
          }
        }
      });
      return;
    }
  }
  await householdDB.queue.add({
    uuid: crypto.randomUUID(), userId: key(userId), createdAt: Date.now(),
    type: 'household-delete', entityId,
  });
}

export async function saveResidentLocal(userId, householdId, entityId, data) {
  const id = entityId || freshId();
  await householdDB.queue.add({
    uuid: crypto.randomUUID(), userId: key(userId), createdAt: Date.now(),
    type: 'resident-save', householdId, entityId: id, data,
  });
  return id;
}

export async function deleteResidentLocal(userId, householdId, entityId) {
  if (isLocal(entityId)) {
    const mapped = await householdDB.mappings.get(String(entityId));
    if (!mapped) {
      await householdDB.transaction('rw', householdDB.queue, async () => {
        for (const mutation of await queueRows(userId)) {
          if (mutation.syncStatus === 'audit_pending') continue;
          if (String(mutation.entityId) === String(entityId)) {
            await householdDB.queue.delete(mutation.uuid);
          }
        }
      });
      return;
    }
  }
  await householdDB.queue.add({
    uuid: crypto.randomUUID(), userId: key(userId), createdAt: Date.now(),
    type: 'resident-delete', householdId, entityId,
  });
}

let syncRunning = false;

async function resolveId(userId, id) {
  if (!isLocal(id)) return id;
  const mapped = await householdDB.mappings.get(String(id));
  if (!mapped || mapped.userId !== key(userId)) {
    throw new Error(`Missing server ID for ${id}`);
  }
  return mapped.serverId;
}

async function storeMap(userId, local, server) {
  await householdDB.mappings.put({
    localId: String(local), userId: key(userId), serverId: server,
  });
}

function auditDescriptor(mutation, action, entityType, serverId, householdId = null) {
  return {
    action,
    entity_type: entityType,
    entity_id: String(serverId),
    details: {
      module: 'BNS Household Management',
      source: 'offline_sync',
      queue_uuid: mutation.uuid,
      ...(householdId != null ? { household_id: String(householdId) } : {}),
      ...(mutation.type.endsWith('-save')
        ? { changed_fields: Object.keys(mutation.data || {}) }
        : {}),
    },
  };
}

async function writeAudit(userId, descriptor) {
  const { error } = await supabase.from('it_audit_logs').insert({
    actor_id: Number(userId),
    action: descriptor.action,
    entity_type: descriptor.entity_type,
    entity_id: descriptor.entity_id,
    details: descriptor.details,
    status: 'success',
  });
  if (error) throw error;
}

async function applyRemoteMutation(userId, mutation) {
  if (mutation.type === 'household-save') {
    const mapped = isLocal(mutation.entityId)
      ? await householdDB.mappings.get(String(mutation.entityId)) : null;
    if (mapped && mapped.userId !== key(userId)) throw new Error('Invalid household ID mapping');

    if (isLocal(mutation.entityId) && !mapped) {
      const { data, error } = await supabase.from('households').upsert({
        ...mutation.data,
        created_by: Number(userId),
        sync_uuid: String(mutation.entityId).slice(6),
      }, { onConflict: 'sync_uuid' }).select('id').single();
      if (error) throw error;
      await storeMap(userId, mutation.entityId, data.id);
      return auditDescriptor(mutation, 'bns_household_created', 'households', data.id);
    }

    const id = mapped ? mapped.serverId : mutation.entityId;
    const { data, error } = await supabase.from('households')
      .update(mutation.data).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Household update not authorized or record missing');
    return auditDescriptor(mutation, 'bns_household_updated', 'households', id);
  }

  if (mutation.type === 'household-delete') {
    const id = await resolveId(userId, mutation.entityId);
    const { data, error } = await supabase.from('households')
      .delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Household deletion not authorized or record missing');
    return auditDescriptor(mutation, 'bns_household_deleted', 'households', id);
  }

  if (mutation.type === 'resident-save') {
    const householdId = await resolveId(userId, mutation.householdId);
    if (mutation.data.is_household_head) {
      const { error } = await supabase.from('residents')
        .update({ is_household_head: false }).eq('household_id', householdId);
      if (error) throw error;
    }

    const mapped = isLocal(mutation.entityId)
      ? await householdDB.mappings.get(String(mutation.entityId)) : null;
    if (mapped && mapped.userId !== key(userId)) throw new Error('Invalid resident ID mapping');
    let id;
    let action;

    if (isLocal(mutation.entityId) && !mapped) {
      const { data, error } = await supabase.from('residents').upsert({
        ...mutation.data,
        household_id: householdId,
        sync_uuid: String(mutation.entityId).slice(6),
      }, { onConflict: 'sync_uuid' }).select('id').single();
      if (error) throw error;
      id = data.id;
      action = 'bns_resident_created';
      await storeMap(userId, mutation.entityId, id);
    } else {
      id = mapped ? mapped.serverId : mutation.entityId;
      const { data, error } = await supabase.from('residents')
        .update(mutation.data).eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Resident update not authorized or record missing');
      action = 'bns_resident_updated';
    }

    if (mutation.data.is_household_head) {
      const { error } = await supabase.from('households')
        .update({ household_head: fullName(mutation.data) }).eq('id', householdId);
      if (error) throw error;
    }
    return auditDescriptor(mutation, action, 'residents', id, householdId);
  }

  if (mutation.type === 'resident-delete') {
    const id = await resolveId(userId, mutation.entityId);
    const householdId = await resolveId(userId, mutation.householdId);
    const { data: existing, error: findError } = await supabase.from('residents')
      .select('is_household_head').eq('id', id).maybeSingle();
    if (findError) throw findError;
    const { data, error } = await supabase.from('residents')
      .delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Resident deletion not authorized or record missing');
    if (existing?.is_household_head) {
      const { error: householdError } = await supabase.from('households')
        .update({ household_head: null }).eq('id', householdId);
      if (householdError) throw householdError;
    }
    return auditDescriptor(mutation, 'bns_resident_deleted', 'residents', id, householdId);
  }

  throw new Error(`Unknown queued mutation: ${mutation.type}`);
}

export async function syncHouseholds(userId) {
  if (syncRunning) return { busy: true, uploaded: 0 };
  if (!navigator.onLine) {
    return { uploaded: 0, error: 'Offline: changes are still saved on this device.' };
  }

  syncRunning = true;
  let uploaded = 0;
  try {
    for (const mutation of await queueRows(userId)) {
      try {
        let descriptor = mutation.audit;
        if (mutation.syncStatus !== 'audit_pending') {
          descriptor = await applyRemoteMutation(userId, mutation);
          // Persist remote completion before attempting audit insertion.
          await householdDB.queue.update(mutation.uuid, {
            syncStatus: 'audit_pending',
            audit: descriptor,
          });
        }

        if (!descriptor) throw new Error('Missing audit details for synchronized change');
        await writeAudit(userId, descriptor);
        await householdDB.queue.delete(mutation.uuid);
        uploaded += 1;
      } catch (error) {
        return { uploaded, error: error.message || 'Synchronization or audit logging failed' };
      }
    }
    return { uploaded, error: null };
  } finally {
    syncRunning = false;
  }
}
