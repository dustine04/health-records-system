import Dexie from 'dexie';
import { supabase } from './supabase';
import { getCachedChildren, refreshChildSnapshot, syncChildMutations } from './childOffline';

const sections = {
  newborn: ['child_newborn_tracking', null],
  monitoring: ['child_monitoring', 'monitoring_date'],
  immunization: ['child_immunization', 'vaccination_date'],
  feeding: ['child_feeding', 'record_date'],
  micronutrients: ['child_micronutrients', 'supplementation_date'],
  deworming: ['child_deworming', 'deworming_date'],
  followup: ['child_followups', 'followup_date'],
};
export const monitoringDB = new Dexie('mchms-bns-child-monitoring-v1');
monitoringDB.version(1).stores({ snapshots:'userId', queue:'uuid,userId,createdAt' });
const key = id => String(id);
const local = id => String(id).startsWith('local:');
const uuid = () => crypto.randomUUID();
const emptyRecords = () => Object.fromEntries(Object.keys(sections).map(s => [s, []]));
const pendingRows = id => monitoringDB.queue.where('userId').equals(key(id)).sortBy('createdAt');
export const pendingMonitoringCount = id => monitoringDB.queue.where('userId').equals(key(id)).count();

export async function cachedMonitoringChildren(userId) {
  const base = await getCachedChildren(userId);
  const own = await monitoringDB.snapshots.get(key(userId));
  return base.children.length || base.cachedAt ? base.children : (own?.children || []);
}
export async function refreshMonitoringChildren(userId) {
  const result = await refreshChildSnapshot(userId);
  await monitoringDB.snapshots.put({ ...(await monitoringDB.snapshots.get(key(userId)) || {}), userId:key(userId), children:result.children });
  return result.children;
}
export async function cachedMonitoringRecords(userId, childId) {
  const snapshot = await monitoringDB.snapshots.get(key(userId));
  const data = structuredClone(snapshot?.records?.[key(childId)] || emptyRecords());
  for (const section of Object.keys(sections)) data[section] ||= [];
  for (const m of await pendingRows(userId)) {
    if (key(m.childId) !== key(childId)) continue;
    const arr = data[m.section];
    const index = arr.findIndex(r => key(r.id) === key(m.recordId));
    if (m.kind === 'delete') { if (index >= 0) arr.splice(index,1); continue; }
    const item = { ...(index >= 0 ? arr[index] : {}), ...m.data, id:m.recordId, child_health_record_id:childId, _pending:true };
    if (index >= 0) arr[index] = item; else arr.unshift(item);
  }
  for (const [section, [,dateField]] of Object.entries(sections)) {
    if (dateField) data[section].sort((a,b) => String(b[dateField]||'').localeCompare(String(a[dateField]||'')));
  }
  return data;
}
export async function refreshMonitoringRecords(userId, childId) {
  if (!navigator.onLine || local(childId)) return cachedMonitoringRecords(userId,childId);
  const entries = await Promise.all(Object.entries(sections).map(async ([section,[table,dateField]]) => {
    let query = supabase.from(table).select('*').eq('child_health_record_id',childId);
    if (dateField) query = query.order(dateField,{ascending:false});
    const {data,error} = await query;
    if (error) throw error;
    return [section,data || []];
  }));
  const snapshot = await monitoringDB.snapshots.get(key(userId)) || {userId:key(userId), records:{}};
  snapshot.records ||= {};
  snapshot.records[key(childId)] = Object.fromEntries(entries);
  await monitoringDB.snapshots.put(snapshot);
  return cachedMonitoringRecords(userId,childId);
}
export async function saveMonitoringLocal(userId, childId, section, recordId, data) {
  const id = recordId || `local:${uuid()}`;
  await monitoringDB.transaction('rw',monitoringDB.queue,async () => {
    const rows = await pendingRows(userId);
    const previous = rows.find(m => m.section === section && key(m.recordId) === key(id));
    if (previous) await monitoringDB.queue.update(previous.uuid,{kind:'save',data});
    else await monitoringDB.queue.add({uuid:uuid(),userId:key(userId),childId,section,recordId:id,kind:'save',data,createdAt:Date.now()});
  });
  return id;
}
export async function deleteMonitoringLocal(userId, childId, section, recordId) {
  await monitoringDB.transaction('rw',monitoringDB.queue,async () => {
    const rows = await pendingRows(userId);
    const previous = rows.find(m => m.section === section && key(m.recordId) === key(recordId));
    if (previous) await monitoringDB.queue.delete(previous.uuid);
    if (!local(recordId)) await monitoringDB.queue.add({uuid:uuid(),userId:key(userId),childId,section,recordId,kind:'delete',createdAt:Date.now()});
  });
}
async function serverChildId(childId) {
  if (!local(childId)) return childId;
  const id = String(childId).slice(6);
  const {data,error} = await supabase.from('child_health_records').select('id').eq('sync_uuid',id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Child registration is not synchronized yet. Sync Child Registration first.');
  return data.id;
}
let syncing = false;
export async function syncMonitoring(userId) {
  if (syncing) return {uploaded:0,error:'Sync already in progress'};
  if (!navigator.onLine) return {uploaded:0,error:'Offline. Changes remain on this device.'};
  syncing=true; let uploaded=0;
  try {
    // Parent records must exist before monitoring records can be uploaded.
    const parent = await syncChildMutations(userId);
    if (parent?.error) return {uploaded,error:`Child Registration: ${parent.error}`};
    for (const m of await pendingRows(userId)) {
      try {
        const [table] = sections[m.section];
        if (!table) throw new Error('Unknown monitoring section');
        if (m.kind === 'delete') {
          const {data,error} = await supabase.from(table).delete().eq('id',m.recordId).select('id');
          if (error) throw error;
          // Already deleted records are treated as completed.
        } else {
          const child_health_record_id = await serverChildId(m.childId);
          if (local(m.recordId)) {
            const sync_uuid = String(m.recordId).slice(6);
            const {error} = await supabase.from(table).upsert({ ...m.data,child_health_record_id,sync_uuid },{onConflict:'sync_uuid'});
            if (error) throw error;
          } else {
            const {data,error} = await supabase.from(table).update({...m.data,child_health_record_id}).eq('id',m.recordId).select('id');
            if (error) throw error;
            if (!data?.length) throw new Error('Update not permitted or record missing');
          }
        }
        await monitoringDB.queue.delete(m.uuid);
        uploaded++;
      } catch(error) { return {uploaded,error:error.message || 'Sync failed'}; }
    }
    return {uploaded,error:null};
  } finally {syncing=false;}
}
