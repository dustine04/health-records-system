import Dexie from 'dexie';
import { supabase } from './supabase';

export const pregnancyDB = new Dexie('mchms-bhw-pregnancy-v1');
pregnancyDB.version(1).stores({ snapshots: 'userId', queue: 'uuid,userId,createdAt' });
const uid = (v) => String(v);
const local = (v) => String(v).startsWith('local:');
const rel = (v) => Array.isArray(v) ? v[0] : v;
const newId = () => `local:${crypto.randomUUID()}`;
const pendingRows = (id) => pregnancyDB.queue.where('userId').equals(uid(id)).sortBy('createdAt');
export const pendingPregnancyCount = (id) => pregnancyDB.queue.where('userId').equals(uid(id)).count();

export async function getPregnancyCache(userId) {
  const snapshot = await pregnancyDB.snapshots.get(uid(userId));
  const residents = (snapshot?.residents || []).map(r => ({...r}));
  const records = (snapshot?.records || []).map(r => ({...r}));
  for (const op of await pendingRows(userId)) {
    const index = records.findIndex(r => uid(r.id) === uid(op.entityId));
    if (op.type === 'delete') {
      if (index >= 0) records.splice(index, 1);
    } else {
      const resident = residents.find(r => uid(r.id) === uid(op.data.resident_id));
      const record = { ...(index >= 0 ? records[index] : {}), ...op.data, id: op.entityId,
        resident: resident || (index >= 0 ? records[index].resident : null), _pending: true };
      if (index >= 0) records[index] = record;
      else records.unshift(record);
    }
  }
  return { areas: snapshot?.areas || [], residents, records, pending: await pendingPregnancyCount(userId), cachedAt: snapshot?.cachedAt || null };
}

export async function refreshPregnancyCache(userId) {
  if (!navigator.onLine) throw new Error('Internet unavailable');
  const {data: assignments,error: ae} = await supabase.from('worker_area_assignments')
    .select('local_area_id,local_areas(id,name,type,barangay_id,barangays(id,name))')
    .eq('worker_id',userId).eq('is_active',true);
  if (ae) throw ae;
  const areas = [...new Map((assignments || []).map(x => rel(x.local_areas)).filter(Boolean)
    .map(a => [uid(a.id), {...a,barangays:rel(a.barangays)}])).values()];
  let residents = [], records = [];
  if (areas.length) {
    const {data: hs,error: he} = await supabase.from('households').select('id,household_code,household_head,address,local_area_id,local_areas(id,name,type,barangays(id,name))')
      .in('local_area_id',areas.map(a => a.id));
    if (he) throw he;
    const houses = (hs || []).map(h => ({...h,local_areas:rel(h.local_areas)}));
    if (houses.length) {
      const {data: rs,error: re} = await supabase.from('residents').select('id,household_id,first_name,middle_name,last_name,sex,birth_date,civil_status,contact_number')
        .in('household_id',houses.map(h => h.id)).eq('sex','Female');
      if (re) throw re;
      residents = (rs || []).map(r => ({...r,households:houses.find(h => uid(h.id) === uid(r.household_id)) || null}));
      if (residents.length) {
        const {data: ps,error: pe} = await supabase.from('pregnant_women').select('*').in('resident_id',residents.map(r => r.id)).order('created_at',{ascending:false});
        if (pe) throw pe;
        records = (ps || []).map(p => ({...p,resident:residents.find(r => uid(r.id) === uid(p.resident_id)) || null}));
      }
    }
  }
  await pregnancyDB.snapshots.put({userId:uid(userId),areas,residents,records,cachedAt:new Date().toISOString()});
  return getPregnancyCache(userId);
}

export async function queuePregnancySave(userId, record, data) {
  // Prevent duplicate registrations, including unsynchronized local saves.
  // Existing records remain editable.
  if (!record) {
    const cache = await getPregnancyCache(userId);
    if (cache.records.some(r => String(r.resident_id) === String(data.resident_id) && ['active','for_review','high_risk','referred'].includes(r.status || 'active'))) {
      throw new Error('This woman already has an ongoing pregnancy. Complete that episode before registering another.');
    }
  }
  const entityId = record?.id ?? newId();
  const uuid = record?.sync_uuid || crypto.randomUUID();
  await pregnancyDB.queue.put({uuid:crypto.randomUUID(),userId:uid(userId),type:'save',entityId,
    data:{...data,...(!record ? {status:'active'} : {}),sync_uuid:uuid},createdAt:Date.now()});
  return entityId;
}
export async function queuePregnancyDelete(userId, record) {
  await pregnancyDB.queue.put({uuid:crypto.randomUUID(),userId:uid(userId),type:'delete',entityId:record.id,createdAt:Date.now()});
}

export async function syncPregnancyQueue(userId) {
  if (!navigator.onLine) throw new Error('Internet unavailable');
  let completed = 0;
  const idMap = new Map();
  for (const op of await pendingRows(userId)) {
    let error;
    if (op.type === 'save') {
      const data = {...op.data};
      const residentId = idMap.get(uid(data.resident_id)) ?? data.resident_id;
      if (local(residentId)) throw new Error('This resident was created offline. Sync BHW Household first, then refresh this page.');
      data.resident_id = Number(residentId);
      if (local(op.entityId)) {
        const result = await supabase.from('pregnant_women').upsert(data,{onConflict:'sync_uuid'}).select('id').single();
        error = result.error;
        if (!error) idMap.set(uid(op.entityId),result.data.id);
      } else {
        const result = await supabase.from('pregnant_women').update(data).eq('id',op.entityId).select('id');
        error = result.error;
        if (!error && !result.data?.length) error = new Error('Pregnancy record not found or update not permitted');
      }
    } else if (!local(op.entityId)) {
      const result = await supabase.from('pregnant_women').delete().eq('id',op.entityId);
      error = result.error;
    }
    if (error) throw error;
    await pregnancyDB.queue.delete(op.uuid);
    completed++;
  }
  return completed;
}
