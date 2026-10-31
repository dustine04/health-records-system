
import Dexie from "dexie";

// Unsubmitted child registration drafts only.
// These drafts are stored separately from childOffline.js,
// which handles submitted offline records and synchronization.

const db = new Dexie("mchms-bns-child-registration-drafts-v1");

// IndexedDB table for unfinished child registration forms.
db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

/**
 * Generate a unique draft key for each BNS user and form.
 *
 * kind:
 *   "register"  - Register an existing child
 *   "new-child" - Create a new household and child
 *   "edit"      - Edit an existing child health record
 */
export function childDraftKey(
  userId,
  kind,
  residentId,
  recordId = "new"
) {
  return [
    "bns",
    userId,
    kind,
    residentId,
    recordId,
  ]
    .map((value) => encodeURIComponent(String(value)))
    .join(":");
}

/**
 * Read a previously saved draft.
 * Returns null if no draft exists.
 */
export async function readChildDraft(key) {
  return (await db.drafts.get(key)) || null;
}

/**
 * Save or update an unfinished draft.
 *
 * This stores form values in IndexedDB, even when
 * the device has no internet connection.
 */
export async function saveChildDraft(userId, key, data) {
  const prefix =
    `${encodeURIComponent("bns")}:` +
    `${encodeURIComponent(String(userId))}:`;

  if (!key.startsWith(prefix)) {
    throw new Error(
      "Draft owner does not match session."
    );
  }

  const savedAt = new Date().toISOString();

  await db.drafts.put({
    key,
    owner: `bns:${userId}`,
    data,
    savedAt,
    updatedAt: Date.now(),
  });
}

/**
 * Delete a draft after successful submission
 * or when the user selects Discard Draft.
 */
export async function deleteChildDraft(key) {
  if (key) {
    await db.drafts.delete(key);
  }
}
