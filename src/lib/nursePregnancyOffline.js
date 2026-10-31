
import Dexie from "dexie";
import { supabase } from "./supabase";

// Health data is sensitive. Use only on managed/trusted devices.
// Never cache passwords or authorization tokens.
const db = new Dexie("mchms-nurse-pregnancy-v1");

db.version(1).stores({
  snapshots: "key",
  queue: "++id,owner,createdAt",
});

const owner = (user) => {
  if (
    !user?.id ||
    !user?.district_id ||
    user.role !== "nurse"
  ) {
    throw new Error(
      "A Nurse with an assigned district is required."
    );
  }

  return `${user.id}:${user.district_id}`;
};

const key = (user, kind, id = "") =>
  `${owner(user)}:${kind}:${id}`;

/* =========================================================
   OFFLINE CACHE
========================================================= */

export async function readPregnancyCache(
  user,
  kind,
  id = ""
) {
  return (
    (await db.snapshots.get(key(user, kind, id))) ||
    null
  );
}

export async function writePregnancyCache(
  user,
  kind,
  data,
  id = ""
) {
  await db.snapshots.put({
    key: key(user, kind, id),
    data,
    cachedAt: Date.now(),
  });
}

/* =========================================================
   PENDING OFFLINE ACTIONS
========================================================= */

export async function getPendingPregnancyActions(user) {
  return db.queue
    .where("owner")
    .equals(owner(user))
    .sortBy("createdAt");
}

export async function queuePregnancyUpdate(
  user,
  table,
  recordId,
  changes
) {
  const allowed = {
    pregnant_women: [
      "status",
      "pregnancy_outcome",
      "birth_status",
      "date_of_delivery",
      "place_of_delivery",
      "facility_name",
      "attended_by",
    ],

    pregnancy_referrals: [
      "status",
      "midwife_notes",
      "reviewed_by",
      "reviewed_at",
    ],

    pregnant_woman_visits: [
      "visit_number",
      "visit_date",
      "emergency_signs",
      "respiratory_rate",
      "systolic_bp",
      "diastolic_bp",
      "pulse_rate",
      "temperature",
      "gestational_age_weeks",
      "vaginal_bleeding",
      "severe_headache",
      "blurred_vision",
      "severe_abdominal_pain",
      "fetal_movement",
      "fundal_height_cm",
      "weight_kg",
      "edema",
      "multiple_pregnancy",
      "presentation",
      "fetal_heart_rate",
      "transverse_or_breech",
      "family_planning_counseled",
      "preeclampsia_check",
      "urine_protein",
      "hemoglobin",
      "anemia_tiredness",
      "anemia_shortness_of_breath",
      "anemia_pallor",
      "no_fetal_movement",
      "ruptured_membranes",
      "fever_or_burning_urination",
      "vaginal_discharge",
      "coughing_or_breathing_difficulty",
      "taking_anti_tb_drugs",
      "smoking_alcohol_drug_use",
      "history_of_violence",
      "signs_of_sti_hiv",
      "hiv_counseling",
      "hiv_test_result",
      "infant_feeding_counseling",
      "tetanus_toxoid",
      "iron_folate_given",
      "oral_care_done",
      "overall_assessment",
      "next_visit_date",
      "assessed_by",
      "updated_at",
    ],
  };

  if (
    !allowed[table] ||
    !recordId ||
    !changes ||
    Object.keys(changes).some(
      (field) => !allowed[table].includes(field)
    )
  ) {
    throw new Error("Unsupported offline update.");
  }

  const pending =
    await getPendingPregnancyActions(user);

  if (
    pending.some(
      (action) =>
        action.table === table &&
        String(action.recordId) === String(recordId)
    )
  ) {
    throw new Error(
      "This record already has an unsynchronized change."
    );
  }

  await db.queue.add({
    owner: owner(user),
    table,
    recordId,
    changes,
    createdAt: Date.now(),
  });
}

/* =========================================================
   VERIFY MIDWIFE AUTHORIZATION
========================================================= */

async function verifyAccess(user) {
  const { data, error } = await supabase
    .from("pregnancy_monitoring_access")
    .select("id")
    .eq("nurse_id", user.id)
    .eq("district_id", user.district_id)
    .eq("is_active", true)
    .limit(1);

  if (error) throw error;

  if (!data?.length) {
    throw new Error(
      "Midwife authorization is no longer active. Sync blocked."
    );
  }
}

/* =========================================================
   VERIFY DISTRICT ACCESS
========================================================= */

async function verifyPregnancyScope(
  user,
  table,
  recordId
) {
  let pregnancyId = recordId;

  if (table !== "pregnant_women") {
    const { data, error } = await supabase
      .from(table)
      .select("pregnant_woman_id")
      .eq("id", recordId)
      .single();

    if (error) throw error;

    pregnancyId = data?.pregnant_woman_id;
  }

  const { data: pregnancy, error: pError } =
    await supabase
      .from("pregnant_women")
      .select("resident_id")
      .eq("id", pregnancyId)
      .single();

  if (pError) throw pError;

  const { data: resident, error: rError } =
    await supabase
      .from("residents")
      .select(
        "households(local_areas(barangays(district_id)))"
      )
      .eq("id", pregnancy.resident_id)
      .single();

  if (rError) throw rError;

  const district =
    resident?.households?.local_areas?.barangays
      ?.district_id;

  if (
    String(district) !== String(user.district_id)
  ) {
    throw new Error(
      "Record is outside your assigned district. Sync blocked."
    );
  }
}

/* =========================================================
   SYNCHRONIZE OFFLINE CHANGES
========================================================= */

let syncLock = null;

export async function syncPregnancyActions(user) {
  owner(user);

  if (!navigator.onLine) {
    throw new Error(
      "Offline: changes remain on this device."
    );
  }

  if (syncLock) return syncLock;

  syncLock = (async () => {
    let count = 0;

    for (
      const action of
      await getPendingPregnancyActions(user)
    ) {
      // Check that the Midwife has not revoked access.
      await verifyAccess(user);

      // Check that the pregnancy belongs to the
      // Nurse's assigned district.
      await verifyPregnancyScope(
        user,
        action.table,
        action.recordId
      );

      const { data, error } = await supabase
        .from(action.table)
        .update(action.changes)
        .eq("id", action.recordId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          `Update ${action.id} was not confirmed by the server.`
        );
      }

      // Remove the action only after the server confirms it.
      await db.queue.delete(action.id);

      count++;
    }

    return count;
  })();

  try {
    return await syncLock;
  } finally {
    syncLock = null;
  }
}

/* =========================================================
   CLEAR OFFLINE DATA
========================================================= */

export async function clearNursePregnancyOffline(
  user
) {
  const prefix = `${owner(user)}:`;

  const snapshots =
    await db.snapshots.toArray();

  await db.snapshots.bulkDelete(
    snapshots
      .filter((snapshot) =>
        snapshot.key.startsWith(prefix)
      )
      .map((snapshot) => snapshot.key)
  );

  await db.queue
    .where("owner")
    .equals(owner(user))
    .delete();
}
