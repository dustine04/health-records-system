
import Dexie from "dexie";
import { supabase } from "./supabase";

const db = new Dexie("mchms-admin-districts-v1");

db.version(1).stores({
  snapshots: "adminId",
  queue: "++id,adminId,districtId,createdAt",
});

function ensureAdmin(admin) {
  if (!admin?.id || admin.role !== "cho_admin") {
    throw new Error("A valid CHO Admin session is required.");
  }
}

function adminKey(admin) {
  ensureAdmin(admin);
  return String(admin.id);
}

export async function getDistrictCache(admin) {
  return (await db.snapshots.get(adminKey(admin))) || null;
}

export async function saveDistrictCache(admin, districts) {
  await db.snapshots.put({
    adminId: adminKey(admin),
    districts,
    cachedAt: new Date().toISOString(),
  });
}

export async function pendingDistrictActions(admin) {
  return db.queue
    .where("adminId")
    .equals(adminKey(admin))
    .sortBy("createdAt");
}

export async function queueDistrictRename(
  admin,
  district,
  newName
) {
  const adminId = adminKey(admin);
  const name = String(newName || "").trim();

  if (!district?.id || !name) {
    throw new Error("A district and a valid name are required.");
  }

  const pending = await pendingDistrictActions(admin);

  if (
    pending.some(
      (action) =>
        String(action.districtId) === String(district.id)
    )
  ) {
    throw new Error(
      "This district already has a pending change. Sync it first."
    );
  }

  await db.queue.add({
    adminId,
    type: "rename",
    districtId: district.id,
    expectedName: district.name,
    newName: name,
    createdAt: Date.now(),
  });
}

let runningSync = null;

export async function syncDistrictActions(admin) {
  ensureAdmin(admin);

  if (!navigator.onLine) {
    throw new Error("You are offline. Changes remain queued.");
  }

  if (runningSync) return runningSync;

  runningSync = (async () => {
    let synced = 0;
    const actions = await pendingDistrictActions(admin);

    for (const action of actions) {
      if (action.type !== "rename") {
        throw new Error("Unsupported district action.");
      }

      const { data: current, error: readError } =
        await supabase
          .from("districts")
          .select("id,name")
          .eq("id", action.districtId)
          .maybeSingle();

      if (readError) throw readError;

      if (!current) {
        throw new Error(
          `District ${action.districtId} no longer exists.`
        );
      }

      if (current.name !== action.newName) {
        if (current.name !== action.expectedName) {
          throw new Error(
            `District ${action.districtId} was changed on another device. Review it before retrying.`
          );
        }

        const { data, error } = await supabase
          .from("districts")
          .update({ name: action.newName })
          .eq("id", action.districtId)
          .eq("name", action.expectedName)
          .select("id")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(
            "The district was changed or the server did not confirm the update."
          );
        }
      }

      await db.queue.delete(action.id);
      synced++;
    }

    return synced;
  })();

  try {
    return await runningSync;
  } finally {
    runningSync = null;
  }
}
