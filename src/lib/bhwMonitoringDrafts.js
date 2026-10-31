
import Dexie from "dexie";

const db = new Dexie("mchms-bhw-monitoring-drafts-v1");

db.version(1).stores({
  drafts: "key,owner,updatedAt",
});

function getOwner(user) {
  if (!user?.id || user.role !== "bhw") {
    throw new Error("A valid BHW session is required.");
  }

  return `bhw:${user.id}`;
}

export function bhwMonitoringDraftKey(
  user,
  pregnancyId,
  kind,
  recordId = "new"
) {
  if (!pregnancyId || !["home", "pregnancy"].includes(kind)) {
    throw new Error("Invalid pregnancy monitoring draft.");
  }

  return [
    getOwner(user),
    pregnancyId,
    kind,
    recordId,
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join(":");
}

export async function readBhwMonitoringDraft(key) {
  return (await db.drafts.get(key)) ?? null;
}

export async function saveBhwMonitoringDraft(user, key, data) {
  const prefix = `${encodeURIComponent(getOwner(user))}:`;

  if (!key.startsWith(prefix)) {
    throw new Error("Draft belongs to another user.");
  }

  await db.drafts.put({
    key,
    owner: getOwner(user),
    data: { ...data },
    savedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
}

export async function deleteBhwMonitoringDraft(key) {
  if (key) {
    await db.drafts.delete(key);
  }
}

export async function clearBhwMonitoringDrafts(user) {
  await db.drafts
    .where("owner")
    .equals(getOwner(user))
    .delete();
}
