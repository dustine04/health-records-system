
import Dexie from "dexie";

/* =========================================================
   CHILD MONITORING DRAFT DATABASE

   Stores unfinished BNS child monitoring forms locally
   using IndexedDB.

   This is separate from monitoringOffline.js, which
   handles submitted records and Supabase synchronization.
========================================================= */

const db = new Dexie(
  "mchms-bns-child-monitoring-drafts-v1"
);

db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

/* =========================================================
   GENERATE UNIQUE DRAFT KEY

   Each draft belongs to:
   - BNS user
   - Child health record
   - Monitoring section
   - Record being added or edited

   Sections:
   newborn, monitoring, immunization, feeding,
   micronutrients, deworming, followup
========================================================= */

export function monitoringDraftKey(
  userId,
  childHealthRecordId,
  section,
  recordId = "new"
) {
  return [
    "bns",
    userId,
    childHealthRecordId,
    section,
    recordId,
  ]
    .map((part) =>
      encodeURIComponent(String(part))
    )
    .join(":");
}

/* =========================================================
   READ SAVED DRAFT

   Returns the saved draft if one exists.
   Otherwise returns null.
========================================================= */

export async function readMonitoringDraft(key) {
  return (await db.drafts.get(key)) || null;
}

/* =========================================================
   SAVE / UPDATE DRAFT

   Automatically saves form values to IndexedDB.
   Works without internet connectivity.
========================================================= */

export async function saveMonitoringDraft(
  userId,
  key,
  data
) {
  const ownerPrefix =
    ["bns", userId]
      .map((part) =>
        encodeURIComponent(String(part))
      )
      .join(":") + ":";

  if (!key.startsWith(ownerPrefix)) {
    throw new Error(
      "Draft owner does not match the current user."
    );
  }

  const savedAt = new Date().toISOString();

  await db.drafts.put({
    key,
    owner: `bns:${userId}`,
    data: { ...data },
    savedAt,
    updatedAt: Date.now(),
  });

  return savedAt;
}

/* =========================================================
   DELETE SAVED DRAFT

   Called after successful local submission
   or when the user selects Discard Draft.
========================================================= */

export async function deleteMonitoringDraft(key) {
  if (key) {
    await db.drafts.delete(key);
  }
}
