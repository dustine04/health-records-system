import Dexie from 'dexie';
import { supabase } from './supabase';
import { getPregnancyCache, refreshPregnancyCache, syncPregnancyQueue } from './bhwPregnancyOffline';

const db = new Dexie('mchms-bhw-monitoring-v1');
db.version(1).stores({ snapshots: 'key', queue: 'uuid,userId,createdAt' });
const id = value => String(value);
const local = value => id(value).startsWith('local:');
const keyFor = (userId, pregnancyId) => `${id(userId)}:${id(pregnancyId)}`;
const queued = userId => db.queue.where('userId').equals(id(userId)).sortBy('createdAt');
export const pendingMonitoringCount = userId => db.queue.where('userId').equals(id(userId)).count();

export async function getMonitoringWomen(userId) {
  const cache = await getPregnancyCache(userId);
  const snapshot = await db.snapshots.get(`list:${id(userId)}`);
  const residents = cache.residents || [];
  const byResident = new Map();
  // One displayed episode per resident, preferring an ongoing episode over completed history.
  const active = new Set(['active','for_review','high_risk','referred']);
  for (const record of cache.records || []) {
    const rid = id(record.resident_id);
    const previous = byResident.get(rid);
    if (!previous || (active.has(record.status || 'active') && !active.has(previous.status || 'active')) ||
      (active.has(record.status || 'active') === active.has(previous.status || 'active') &&
        id(record.created_at || '') > id(previous.created_at || ''))) byResident.set(rid, record);
  }
  const women = residents.map(resident => {
    const pregnancy = byResident.get(id(resident.id));
    if (!pregnancy) return null;
    const anc = (snapshot?.anc || []).filter(v => id(v.pregnant_woman_id) === id(pregnancy.id));
    const homes = (snapshot?.homes || []).filter(v => id(v.pregnant_woman_id) === id(pregnancy.id));
    const today = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
    const next = homes.map(v=>v.next_visit_date).filter(v=>v && v>=today).sort()[0] || null;
    return {...resident, pregnancy, visit_count:anc.length, next_visit_date:next};
  }).filter(Boolean);
  return {areas:cache.areas || [],women,cachedAt:cache.cachedAt};
}

export async function refreshMonitoringWomen(userId) {
  await refreshPregnancyCache(userId);
  const cache = await getPregnancyCache(userId);
  const ids = (cache.records || []).filter(r=>!local(r.id)).map(r=>r.id);
  let anc=[], homes=[];
  if (ids.length) {
    const [a,h] = await Promise.all([
      supabase.from('pregnant_woman_visits').select('id,pregnant_woman_id,visit_number,visit_date').in('pregnant_woman_id',ids),
      supabase.from('pregnant_woman_home_visits').select('id,pregnant_woman_id,visit_date,next_visit_date').in('pregnant_woman_id',ids)
    ]);
    if (a.error) throw a.error;
    if (h.error) throw h.error;
    anc=a.data||[]; homes=h.data||[];
  }
  await db.snapshots.put({key:`list:${id(userId)}`,anc,homes});
  return getMonitoringWomen(userId);
}

async function overlay(userId, pregnancyId, kind) {
  const snap = await db.snapshots.get(keyFor(userId,pregnancyId));
  const rows = [...(snap?.[kind] || [])];
  for (const op of await queued(userId)) {
    if (op.kind !== kind || id(op.pregnancyId)!==id(pregnancyId)) continue;
    const index = rows.findIndex(r=>id(r.id)===id(op.entityId));
    if (op.type==='delete') { if (index>=0) rows.splice(index,1); continue; }
    const row = {...(index>=0?rows[index]:{}),...op.data,id:op.entityId,_pending:true};
    if(index>=0) rows[index]=row; else rows.push(row);
  }
  return rows.sort((a,b)=>Number(a.visit_number||0)-Number(b.visit_number||0));
}
export const cachedAncVisits = (userId,pregnancyId) => overlay(userId,pregnancyId,'anc');
export const cachedHomeVisits = (userId,pregnancyId) => overlay(userId,pregnancyId,'homes');
export async function refreshMonitoringVisits(userId,pregnancyId) {
  if (!navigator.onLine || local(pregnancyId)) return {
    anc:await cachedAncVisits(userId,pregnancyId),homes:await cachedHomeVisits(userId,pregnancyId)
  };
  const [a,h] = await Promise.all([
    supabase.from('pregnant_woman_visits').select('*').eq('pregnant_woman_id',pregnancyId).order('visit_number',{ascending:true}),
    supabase.from('pregnant_woman_home_visits').select('*').eq('pregnant_woman_id',pregnancyId).order('visit_number',{ascending:true})
  ]);
  if(a.error) throw a.error;
  if(h.error) throw h.error;
  await db.snapshots.put({key:keyFor(userId,pregnancyId),anc:a.data||[],homes:h.data||[]});
  return {anc:await cachedAncVisits(userId,pregnancyId),homes:await cachedHomeVisits(userId,pregnancyId)};
}
export async function queueMonitoringSave(userId,pregnancyId,kind,record,data) {
  if (kind!=='homes') throw new Error('ANC records are read-only for BHW.');
  const entityId = record?.id ?? `local:${crypto.randomUUID()}`;
  const previous = (await queued(userId)).filter(op=>op.kind===kind && id(op.entityId)===id(entityId));
  const syncUuid = record?.sync_uuid || previous.find(op=>op.data?.sync_uuid)?.data.sync_uuid || crypto.randomUUID();
  await db.queue.bulkDelete(previous.map(op=>op.uuid));
  await db.queue.put({uuid:crypto.randomUUID(),userId:id(userId),pregnancyId,kind,type:'save',entityId,
    data:{...data,sync_uuid:syncUuid},createdAt:Date.now()});
  return entityId;
}
export async function queueMonitoringDelete(userId,pregnancyId,kind,record) {
  if (kind!=='homes') throw new Error('ANC records are read-only for BHW.');
  const previous=(await queued(userId)).filter(op=>op.kind===kind && id(op.entityId)===id(record.id));
  await db.queue.bulkDelete(previous.map(op=>op.uuid));
  if (!local(record.id)) await db.queue.put({uuid:crypto.randomUUID(),userId:id(userId),pregnancyId,kind,type:'delete',entityId:record.id,createdAt:Date.now()});
}
let syncing=false;
export async function syncMonitoringQueue(userId) {
  if (!navigator.onLine) throw new Error('Internet unavailable');
  if(syncing) return 0;
  syncing=true;
  try {
    const pregnancyBeforeSync = await getPregnancyCache(userId);
    const localPregnancyUuids = new Map((pregnancyBeforeSync.records || []).filter(r => local(r.id) && r.sync_uuid).map(r => [id(r.id),r.sync_uuid]));
    await syncPregnancyQueue(userId);
    let count=0;
    for(const op of await queued(userId)) {
      let pregnancyId=op.pregnancyId;
      if(local(pregnancyId)) {
        const uuid = localPregnancyUuids.get(id(pregnancyId)) || (await getPregnancyCache(userId)).records.find(r=>id(r.id)===id(pregnancyId))?.sync_uuid;
        if (!uuid) throw new Error('Sync the pregnancy registration first.');
        const found=await supabase.from('pregnant_women').select('id').eq('sync_uuid',uuid).maybeSingle();
        if(found.error) throw found.error;
        if(!found.data) throw new Error('Pregnancy registration has not synchronized yet.');
        pregnancyId=found.data.id;
      }
      let error;
      if(op.type==='save') {
        const data={...op.data,pregnant_woman_id:pregnancyId};
        if(local(op.entityId)) {
          const result=await supabase.from('pregnant_woman_home_visits').upsert(data,{onConflict:'sync_uuid'});
          error=result.error;
        } else {
          const result=await supabase.from('pregnant_woman_home_visits').update(data).eq('id',op.entityId).select('id');
          error=result.error;
          if(!error && !result.data?.length) error=new Error('Home visit was not found or update is not allowed');
        }
      } else if(!local(op.entityId)) {
        const result=await supabase.from('pregnant_woman_home_visits').delete().eq('id',op.entityId);
        error=result.error;
      }
      if(error) throw error;
      await db.queue.delete(op.uuid);
      count++;
    }
    return count;
  } finally {syncing=false;}
}
