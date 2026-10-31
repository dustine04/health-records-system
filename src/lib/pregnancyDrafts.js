
import Dexie from "dexie";

// =========================================================
// PREGNANCY MONITORING - AUTO-SAVE DRAFTS
// =========================================================
//
// Saves unfinished pregnancy monitoring forms locally.
//
// Supported forms:
// - ANC Assessment
// - Referral Review
// - Pregnancy Outcome
//
// Drafts are separate from official Supabase records.
//
// NOTE:
// IndexedDB is not encrypted. Use trusted devices only.
// =========================================================

// Create the local IndexedDB database
const db = new Dexie("mchms-pregnancy-form-drafts-v1");

// Database schema
db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

// =========================================================
// IDENTIFY THE CURRENT USER
// =========================================================

function owner(user) {
  if (
    !user?.id ||
    !["midwife", "nurse"].includes(user.role)
  ) {
    throw new Error(
      "A Midwife or Nurse session is required."
    );
  }

  return `${user.role}:${user.id}:${user.district_id ?? "none"}`;
}

// =========================================================
// GENERATE A UNIQUE DRAFT KEY
// =========================================================
//
// Each draft is associated with:
// - User role
// - User ID
// - District
// - Pregnancy ID
// - Form type
// - Record ID
//
// This prevents one patient's form from overwriting another.
// =========================================================

export function pregnancyDraftKey(
  user,
  pregnancyId,
  kind,
  recordId = "new"
) {
  if (
    !pregnancyId ||
    !["anc", "referral", "outcome"].includes(kind)
  ) {
    throw new Error("Invalid pregnancy draft key.");
  }

  return [
    owner(user),
    pregnancyId,
    kind,
    recordId,
  ]
    .map((value) =>
      encodeURIComponent(String(value))
    )
    .join(":");
}

// =========================================================
// READ AN EXISTING DRAFT
// =========================================================
//
// Used when the user reopens an unfinished form.
// =========================================================

export async function readPregnancyDraft(key) {
  const draft = await db.drafts.get(key);

  return draft ?? null;
}

// =========================================================
// AUTO-SAVE A DRAFT
// =========================================================
//
// Called by PregnancyMonitoring.jsx after form changes.
//
// Example:
// await savePregnancyDraft(user, key, formData);
// =========================================================

export async function savePregnancyDraft(
  user,
  key,
  data
) {
  const userPrefix = `${encodeURIComponent(owner(user))}:`;

  if (!key.startsWith(userPrefix)) {
    throw new Error(
      "Draft belongs to a different session."
    );
  }

  await db.drafts.put({
    key,
    owner: owner(user),
    data: structuredClone(data),
    savedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
}

// =========================================================
// DELETE A SAVED DRAFT
// =========================================================
//
// Used after successful submission or when the user
// explicitly discards an unfinished form.
// =========================================================

export async function deletePregnancyDraft(key) {
  if (key) {
    await db.drafts.delete(key);
  }
}

// =========================================================
// CLEAR ALL DRAFTS FOR A USER
// =========================================================
//
// Optional cleanup function.
// Do not call automatically on logout if unfinished
// forms must remain available when the user returns.
// =========================================================

export async function clearPregnancyDrafts(user) {
  await db.drafts
    .where("owner")
    .equals(owner(user))
    .delete();
}
