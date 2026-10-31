
import Dexie from "dexie";

// =========================================================
// BHW PREGNANCY REGISTRATION - LOCAL DRAFTS
// =========================================================
//
// Stores unfinished pregnancy registration forms locally.
//
// This is separate from bhwPregnancyOffline.js:
// - Drafts: unfinished forms that have not been submitted
// - Offline queue: submitted records awaiting Supabase sync
//
// IndexedDB is not encrypted. Use trusted devices only.
// =========================================================

const db = new Dexie("mchms-bhw-pregnancy-drafts-v1");

db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

// =========================================================
// IDENTIFY CURRENT BHW
// =========================================================

function owner(user) {
  if (!user?.id || user.role !== "bhw") {
    throw new Error(
      "A BHW session is required to access pregnancy drafts."
    );
  }

  return `bhw:${user.id}`;
}

// =========================================================
// GENERATE UNIQUE DRAFT KEY
// =========================================================
//
// New registration: recordId = "new"
// Existing registration: recordId = pregnancy record ID
//
// Each BHW has separate drafts.
// =========================================================

export function bhwPregnancyDraftKey(
  user,
  recordId = "new"
) {
  return `${owner(user)}:pregnancy-registration:${encodeURIComponent(
    String(recordId)
  )}`;
}

// =========================================================
// READ SAVED DRAFT
// =========================================================

export async function readBhwPregnancyDraft(key) {
  return (await db.drafts.get(key)) ?? null;
}

// =========================================================
// SAVE UNFINISHED REGISTRATION
// =========================================================

export async function saveBhwPregnancyDraft(
  user,
  key,
  data
) {
  if (
    !key.startsWith(
      `${owner(user)}:pregnancy-registration:`
    )
  ) {
    throw new Error(
      "This draft does not belong to the current BHW."
    );
  }

  await db.drafts.put({
    key,
    owner: owner(user),
    data: { ...data },
    savedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
}

// =========================================================
// DELETE DRAFT AFTER SUCCESSFUL LOCAL SUBMISSION
// =========================================================

export async function deleteBhwPregnancyDraft(key) {
  if (key) {
    await db.drafts.delete(key);
  }
}

// =========================================================
// CLEAR ALL DRAFTS FOR CURRENT BHW
// =========================================================
//
// Optional cleanup function.
// Do not automatically call this on logout if users
// should be able to resume unfinished forms later.
// =========================================================

export async function clearBhwPregnancyDrafts(user) {
  await db.drafts
    .where("owner")
    .equals(owner(user))
    .delete();
}
