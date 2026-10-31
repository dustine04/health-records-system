import Dexie from "dexie";

// Unsubmitted forms only.
// Submitted offline records use bhwHouseholdOffline.js.
//
// IndexedDB is not encrypted. Use protected devices.

const db = new Dexie("mchms-bhw-household-drafts-v1");

db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

function owner(user) {
  if (!user?.id || user.role !== "bhw") {
    throw new Error("A valid BHW session is required.");
  }

  return `bhw:${user.id}`;
}

export function householdDraftKey(
  user,
  kind,
  parentId = "new",
  recordId = "new",
) {
  if (!["household", "resident"].includes(kind)) {
    throw new Error("Invalid household draft type.");
  }

  if (kind === "resident" && !parentId) {
    throw new Error("A household is required for resident drafts.");
  }

  return [owner(user), kind, parentId, recordId]
    .map((part) => encodeURIComponent(String(part)))
    .join(":");
}

export async function readHouseholdDraft(key) {
  return (await db.drafts.get(key)) ?? null;
}

export async function saveHouseholdDraft(user, key, data) {
  const prefix = `${encodeURIComponent(owner(user))}:`;

  if (typeof key !== "string" || !key.startsWith(prefix)) {
    throw new Error("Draft belongs to another user.");
  }

  const now = new Date().toISOString();

  await db.drafts.put({
    key,
    owner: owner(user),
    data: { ...data },
    savedAt: now,
    updatedAt: Date.now(),
  });
}

export async function deleteHouseholdDraft(key) {
  if (key) {
    await db.drafts.delete(key);
  }
}

export async function clearHouseholdDrafts(user) {
  await db.drafts.where("owner").equals(owner(user)).delete();
}
