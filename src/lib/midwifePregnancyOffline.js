
import Dexie from 'dexie';
import { supabase } from './supabase';

const db = new Dexie('mchms-midwife-pregnancy-monitoring-v1');

db.version(1).stores({
  snapshots: 'key',
  queue: '++id,owner,createdAt'
});

const ownerKey = (user) =>
  `${user.id}:${user.role}:${user.district_id}`;

export async function getPregnancyCache(user, name) {
  return (
    await db.snapshots.get(`${ownerKey(user)}:${name}`)
  )?.data ?? null;
}

export async function setPregnancyCache(user, name, data) {
  await db.snapshots.put({
    key: `${ownerKey(user)}:${name}`,
    data,
    savedAt: new Date().toISOString()
  });
}

export async function pendingPregnancyChanges(user) {
  return db.queue
    .where('owner')
    .equals(ownerKey(user))
    .sortBy('createdAt');
}

export async function queuePregnancyChange(user, operation) {
  return db.queue.add({
    owner: ownerKey(user),
    createdAt: new Date().toISOString(),
    ...operation
  });
}

// Process in order. Failed operations stay on this device;
// do not discard them.
export async function syncPregnancyChanges(user) {
  if (!navigator.onLine) {
    throw new Error('Device is offline');
  }

  const entries = await pendingPregnancyChanges(user);
  let completed = 0;

  for (const item of entries) {
    // Nurse access must be rechecked at sync time,
    // not just when data was queued.
    if (user.role === 'nurse') {
      const { data, error } = await supabase
        .from('pregnancy_monitoring_access')
        .select('id')
        .eq('nurse_id', user.id)
        .eq('district_id', user.district_id)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          'Nurse authorization is no longer active'
        );
      }
    }

    const {
      table,
      method,
      payload,
      rowId,
      pregnancyId
    } = item;

    if (
      ![
        'pregnant_woman_visits',
        'pregnancy_referrals',
        'pregnant_women'
      ].includes(table)
    ) {
      throw new Error('Unsupported queued operation');
    }

    // Verify pregnancy still belongs to the user's
    // district before replaying writes.
    const { data: pregnancy, error: pError } =
      await supabase
        .from('pregnant_women')
        .select('id,resident_id')
        .eq('id', pregnancyId)
        .single();

    if (pError) throw pError;

    const { data: resident, error: rError } =
      await supabase
        .from('residents')
        .select(
          'households(local_areas(barangays(district_id)))'
        )
        .eq('id', pregnancy.resident_id)
        .single();

    if (rError) throw rError;

    const district =
      resident?.households?.local_areas?.barangays
        ?.district_id;

    if (
      String(district) !== String(user.district_id)
    ) {
      throw new Error(
        'Pregnancy is outside your district'
      );
    }

    let query;

    if (
      method === 'insert' &&
      table === 'pregnant_woman_visits'
    ) {
      query = supabase.from(table).insert(payload);
    } else if (
      method === 'update' &&
      rowId != null
    ) {
      query = supabase
        .from(table)
        .update(payload)
        .eq('id', rowId);
    } else if (
      method === 'delete' &&
      table === 'pregnant_woman_visits' &&
      rowId != null
    ) {
      query = supabase
        .from(table)
        .delete()
        .eq('id', rowId);
    } else {
      throw new Error(
        'Unsupported queued operation'
      );
    }

    const { error } = await query;

    if (error) throw error;

    await db.queue.delete(item.id);
    completed++;
  }

  return completed;
}
