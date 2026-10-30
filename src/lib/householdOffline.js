import Dexie from 'dexie';
import { supabase } from './supabase';

// Separate from the Child Registration cache; both share Supabase tables.
export const householdDB = new Dexie('mchms-bns-households-v1');
householdDB.version(1).stores({
  snapshots: 'userId',
  queue: 'uuid,userId,createdAt',
  mappings: 'localId,userId',
});
const key = (id) => String(id);
const relation = (v) => Array.isArray(v) ? v[0] : v;
const freshId = () => `local:${crypto.randomUUID()}`;
const isLocal = (id) => String(id).startsWith('local:');
const fullName = (r) => [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');
const ordered = (rows) => [...rows].sort((a,b) => Number(b.is_household_head) - Number(a.is_household_head) || String(a.last_name || '').localeCompare(String(b.last_name || '')));

async function queueRows(userId) {
  return householdDB.queue.where('userId').equals(key(userId)).sortBy('createdAt');
}
export async function pendingHouseholdCount(userId) { return householdDB.queue.where('userId').equals(key(userId)).count(); }

export async function getHouseholdCache(userId) {
  const snapshot = await householdDB.snapshots.get(key(userId));
  const houses = (snapshot?.households || []).map(h => ({ ...h }));
  const residents = Object.fromEntries(Object.entries(snapshot?.residents || {}).map(([id,rows]) => [id, rows.map(r => ({...r}))]));
  for (const m of await queueRows(userId)) {
    const hid = String(m.householdId || m.entityId);
    if (m.type === 'household-save') {
      const index = houses.findIndex(h => String(h.id) === String(m.entityId));
      const area = (snapshot?.areas || []).find(a => String(a.id) === String(m.data.local_area_id));
      const item = { ...(index >= 0 ? houses[index] : {}), ...m.data, id: m.entityId, _pending: true,
        local_areas: area || (index >= 0 ? houses[index].local_areas : null) };
      if (index >= 0) houses[index] = item; else houses.unshift(item);
    } else if (m.type === 'household-delete') {
      const index = houses.findIndex(h => String(h.id) === String(m.entityId));
      if (index >= 0) houses.splice(index,1);
      delete residents[String(m.entityId)];
    } else if (m.type === 'resident-save') {
      const arr = residents[hid] || [];
      const index = arr.findIndex(r => String(r.id) === String(m.entityId));
      const item = { ...(index >= 0 ? arr[index] : {}), ...m.data, id: m.entityId, household_id: m.householdId, _pending: true };
      if (item.is_household_head) {
        for (const r of arr) r.is_household_head = false;
        const h = houses.find(x => String(x.id) === hid);
        if (h) h.household_head = fullName(item);
      } else if (index >= 0 && arr[index].is_household_head) {
        const h = houses.find(x => String(x.id) === hid);
        if (h) h.household_head = null;
      }
      if (index >= 0) arr[index] = item; else arr.push(item);
      residents[hid] = ordered(arr);
    } else if (m.type === 'resident-delete') {
      const arr = residents[hid] || [];
      const removed = arr.find(r => String(r.id) === String(m.entityId));
      residents[hid] = arr.filter(r => String(r.id) !== String(m.entityId));
      if (removed?.is_household_head) {
        const h = houses.find(x => String(x.id) === hid);
        if (h) h.household_head = null;
      }
    }
  }
  for (const h of houses) h.resident_count = (residents[String(h.id)] || []).length;
  return { areas: snapshot?.areas || [], households: houses, residents, cachedAt: snapshot?.cachedAt || null, pending: await pendingHouseholdCount(userId) };
}

export async function refreshHouseholdCache(userId) {
  if (!navigator.onLine) throw new Error('Internet unavailable');
  const { data: assignments, error: ae } = await supabase.from('worker_area_assignments')
    .select('local_area_id,local_areas(id,name,type,barangay_id,barangays(id,name))')
    .eq('worker_id', userId).eq('is_active', true);
  if (ae) throw ae;
  const areas = [...new Map((assignments || []).map(x => relation(x.local_areas)).filter(Boolean)
    .map(a => [String(a.id), {...a, barangays: relation(a.barangays)}])).values()];
  let households = [], residents = {};
  if (areas.length) {
    const { data: hs, error: he } = await supabase.from('households')
      .select('*,local_areas(id,name,type,barangays(id,name))')
      .in('local_area_id', areas.map(a => a.id));
    if (he) throw he;
    households = (hs || []).map(h => ({...h,local_areas: relation(h.local_areas)}));
    const ids = households.map(h => h.id);
    if (ids.length) {
      const { data: rs, error: re } = await supabase.from('residents').select('*').in('household_id', ids);
      if (re) throw re;
      for (const h of households) residents[String(h.id)] = ordered((rs || []).filter(r => String(r.household_id) === String(h.id)));
    }
  }
  await householdDB.snapshots.put({ userId: key(userId), areas, households, residents, cachedAt: new Date().toISOString() });
  return getHouseholdCache(userId);
}

export async function saveHouseholdLocal(userId, entityId, data) {
  const id = entityId || freshId();
  await householdDB.queue.add({ uuid: crypto.randomUUID(), userId: key(userId), createdAt: Date.now(), type:'household-save', entityId:id, data });
  return id;
}
export async function deleteHouseholdLocal(userId, entityId) {
  // Local-only household: discard all its queued changes; nothing to upload.
  if (isLocal(entityId)) {
    await householdDB.transaction('rw', householdDB.queue, async () => {
      for (const m of await queueRows(userId)) if (String(m.entityId) === String(entityId) || String(m.householdId) === String(entityId)) await householdDB.queue.delete(m.uuid);
    });
    return;
  }
  await householdDB.queue.add({ uuid: crypto.randomUUID(), userId:key(userId), createdAt:Date.now(), type:'household-delete', entityId });
}
export async function saveResidentLocal(userId, householdId, entityId, data) {
  const id = entityId || freshId();
  await householdDB.queue.add({ uuid: crypto.randomUUID(), userId:key(userId), createdAt:Date.now(), type:'resident-save', householdId, entityId:id, data });
  return id;
}
export async function deleteResidentLocal(userId, householdId, entityId) {
  if (isLocal(entityId)) {
    await householdDB.transaction('rw', householdDB.queue, async () => {
      for (const m of await queueRows(userId)) if (String(m.entityId) === String(entityId)) await householdDB.queue.delete(m.uuid);
    });
    return;
  }
  await householdDB.queue.add({ uuid:crypto.randomUUID(), userId:key(userId), createdAt:Date.now(), type:'resident-delete', householdId, entityId });
}

let syncRunning = false;
async function resolveId(userId, id) {
  if (!isLocal(id)) return id;
  const mapped = await householdDB.mappings.get(String(id));
  if (!mapped || mapped.userId !== key(userId)) throw new Error(`Missing server ID for ${id}`);
  return mapped.serverId;
}
async function storeMap(userId, local, server) {
  await householdDB.mappings.put({ localId:String(local), userId:key(userId), serverId:server });
}
export async function syncHouseholds(userId) {
  if (syncRunning) return { busy:true, uploaded:0 };
  if (!navigator.onLine) return { uploaded:0, error:'Offline: changes are still saved on this device.' };
  syncRunning = true;
  let uploaded = 0;
  try {
    for (const m of await queueRows(userId)) {
      try {
        if (m.type === 'household-save') {
          if (isLocal(m.entityId)) {
            const prior = await householdDB.mappings.get(String(m.entityId));
            if (prior) {
              const {error} = await supabase.from('households').update(m.data).eq('id',prior.serverId);
              if (error) throw error;
            } else {
              const {data,error} = await supabase.from('households').upsert({...m.data,created_by:Number(userId),sync_uuid:m.entityId.slice(6)},{onConflict:'sync_uuid'}).select('id').single();
              if (error) throw error;
              await storeMap(userId,m.entityId,data.id);
            }
          } else {
            const {data,error} = await supabase.from('households').update(m.data).eq('id',m.entityId).select('id');
            if (error) throw error;
            if (!data?.length) throw new Error('Household update not authorized or record missing');
          }
        } else if (m.type === 'household-delete') {
          const id = await resolveId(userId,m.entityId);
          const {error} = await supabase.from('households').delete().eq('id',id);
          if (error) throw error;
        } else if (m.type === 'resident-save') {
          const hid = await resolveId(userId,m.householdId);
          if (m.data.is_household_head) {
            const {error} = await supabase.from('residents').update({is_household_head:false}).eq('household_id',hid);
            if (error) throw error;
          }
          if (isLocal(m.entityId)) {
            const prior = await householdDB.mappings.get(String(m.entityId));
            if (prior) {
              const {error} = await supabase.from('residents').update(m.data).eq('id',prior.serverId);
              if (error) throw error;
            } else {
              const {data,error} = await supabase.from('residents').upsert({...m.data,household_id:hid,sync_uuid:m.entityId.slice(6)},{onConflict:'sync_uuid'}).select('id').single();
              if (error) throw error;
              await storeMap(userId,m.entityId,data.id);
            }
          } else {
            const {data,error} = await supabase.from('residents').update(m.data).eq('id',m.entityId).select('id');
            if (error) throw error;
            if (!data?.length) throw new Error('Resident update not authorized or record missing');
          }
          if (m.data.is_household_head) {
            const {error} = await supabase.from('households').update({household_head:fullName(m.data)}).eq('id',hid);
            if (error) throw error;
          }
        } else if (m.type === 'resident-delete') {
          const id = await resolveId(userId,m.entityId);
          const hid = await resolveId(userId,m.householdId);
          const {data:existing,error:findError} = await supabase.from('residents').select('is_household_head').eq('id',id).maybeSingle();
          if (findError) throw findError;
          const {error} = await supabase.from('residents').delete().eq('id',id);
          if (error) throw error;
          if (existing?.is_household_head) {
            const {error:he} = await supabase.from('households').update({household_head:null}).eq('id',hid);
            if (he) throw he;
          }
        }
        await householdDB.queue.delete(m.uuid);
        uploaded++;
      } catch (error) { return {uploaded,error:error.message || 'Synchronization failed'}; }
    }
    return {uploaded,error:null};
  } finally { syncRunning = false; }
}
