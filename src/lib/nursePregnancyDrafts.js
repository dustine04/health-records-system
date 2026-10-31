
import Dexie from "dexie";

// =========================================================
// NURSE PREGNANCY FORM DRAFTS
// =========================================================
//
// Stores unfinished pregnancy monitoring forms locally
// using IndexedDB.
//
// Supported forms:
// - ANC assessment
// - Referral review
// - Pregnancy outcome
//
// Drafts are separate from official Supabase records.
//
// IMPORTANT:
// IndexedDB is not encrypted. Use trusted devices only.
// =========================================================

const db = new Dexie("mchms-nurse-pregnancy-drafts-v1");

db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

// =========================================================
// NURSE IDENTITY
// =========================================================

function identity(user) {
  if (
    !user?.id ||
    !user?.district_id ||
    user.role !== "nurse"
  ) {
    throw new Error(
      "A Nurse session with a district is required."
    );
  }

  return `${user.id}:${user.district_id}`;
}

// =========================================================
// GENERATE UNIQUE DRAFT KEY
// =========================================================

function draftKey(
  user,
  kind,
  pregnancyId,
  recordId = "new"
) {
  if (
    !pregnancyId ||
    !["anc", "referral", "outcome"].includes(kind)
  ) {
    throw new Error(
      "Invalid pregnancy draft identity."
    );
  }

  return `${identity(user)}:${kind}:${pregnancyId}:${recordId}`;
}

// =========================================================
// READ SAVED DRAFT
// =========================================================

export async function readNursePregnancyDraft(
  user,
  kind,
  pregnancyId,
  recordId
) {
  const key = draftKey(
    user,
    kind,
    pregnancyId,
    recordId
  );

  const draft = await db.drafts.get(key);

  return draft || null;
}

// =========================================================
// AUTO SAVE FORM DRAFT
// =========================================================

export async function saveNursePregnancyDraft(
  user,
  kind,
  pregnancyId,
  recordId,
  values
) {
  const key = draftKey(
    user,
    kind,
    pregnancyId,
    recordId
  );

  await db.drafts.put({
    key,
    owner: identity(user),
    values,
    updatedAt: Date.now(),
  });
}

// =========================================================
// DELETE DRAFT AFTER SUCCESSFUL SUBMISSION
// =========================================================

export async function deleteNursePregnancyDraft(
  user,
  kind,
  pregnancyId,
  recordId
) {
  const key = draftKey(
    user,
    kind,
    pregnancyId,
    recordId
  );

  await db.drafts.delete(key);
}

// =========================================================
// CLEAR ALL DRAFTS FOR CURRENT NURSE
// =========================================================

export async function clearNursePregnancyDrafts(user) {
  await db.drafts
    .where("owner")
    .equals(identity(user))
    .delete();
}
