
import Dexie from "dexie";
import { supabase } from "./supabase";

/* =========================================================
   OFFLINE DATABASE
========================================================= */

const db = new Dexie("mchms-midwife-workers-v2");

// Preserve the existing database structure.
db.version(1).stores({
  snapshots: "key",
  queue: "++id, key, createdAt",
});

// Add an index for synchronization status.
db.version(2).stores({
  snapshots: "key",
  queue: "++id, key, createdAt, syncStatus",
});

const userKey = (user) => `${user.id}:${user.district_id}`;

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function ensureMidwife(user) {
  if (
    !user?.id ||
    user.role !== "midwife" ||
    !user.district_id
  ) {
    throw new Error("A valid Midwife account is required.");
  }
}

function uniqueIds(ids = []) {
  return [...new Set(ids.map((id) => String(id)))];
}

function difference(first, second) {
  const other = new Set(second.map(String));

  return first.filter((id) => !other.has(String(id)));
}

/* =========================================================
   AUDIT LOGGING
========================================================= */

async function recordWorkerAudit(user, payload) {
  ensureMidwife(user);

  const { error } = await supabase
    .from("it_audit_logs")
    .insert({
      actor_id: user.id,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: String(payload.entityId),
      status: "success",
      details: {
        module: "BNS/BHW Worker Management",
        source: "offline_sync",
        district_id: user.district_id,
        ...payload.details,
      },
    });

  if (error) {
    throw new Error(
      `Worker changes were saved, but audit logging failed: ${error.message}`
    );
  }
}

/* =========================================================
   OFFLINE SNAPSHOTS
========================================================= */

export async function getWorkersSnapshot(user) {
  ensureMidwife(user);

  return (
    (await db.snapshots.get(userKey(user))) || null
  );
}

export async function saveWorkersSnapshot(user, data) {
  ensureMidwife(user);

  await db.snapshots.put({
    key: userKey(user),
    ...data,
    cachedAt: new Date().toISOString(),
  });
}

export async function getWorkerAreaSnapshot(user, workerId) {
  ensureMidwife(user);

  return (
    (await db.snapshots.get(
      `${userKey(user)}:areas:${workerId}`
    )) || null
  );
}

export async function saveWorkerAreaSnapshot(
  user,
  workerId,
  data
) {
  ensureMidwife(user);

  await db.snapshots.put({
    key: `${userKey(user)}:areas:${workerId}`,
    ...data,
    cachedAt: new Date().toISOString(),
  });
}

/* =========================================================
   PENDING OFFLINE ACTIONS
========================================================= */

export async function pendingWorkerActions(user) {
  ensureMidwife(user);

  return db.queue
    .where("key")
    .equals(userKey(user))
    .sortBy("createdAt");
}

/* =========================================================
   QUEUE WORKER ACTIONS
========================================================= */

export async function queueWorkerAction(user, action) {
  ensureMidwife(user);

  if (!["status", "areas"].includes(action.type)) {
    throw new Error("Unsupported worker action.");
  }

  if (!action.workerId) {
    throw new Error("Worker ID is required.");
  }

  if (
    action.type === "status" &&
    (
      typeof action.active !== "boolean" ||
      typeof action.expectedActive !== "boolean"
    )
  ) {
    throw new Error("Invalid account status request.");
  }

  if (
    action.type === "areas" &&
    (
      !Array.isArray(action.areaIds) ||
      action.areaIds.some(
        (id) => !Number.isInteger(Number(id))
      )
    )
  ) {
    throw new Error("Invalid area assignment request.");
  }

  const pending = await pendingWorkerActions(user);

  if (
    pending.some(
      (item) =>
        String(item.workerId) === String(action.workerId)
    )
  ) {
    throw new Error(
      "This worker already has a pending change. Synchronize it before making another change."
    );
  }

  await db.queue.add({
    key: userKey(user),
    ...action,
    syncStatus: "pending",
    createdAt: Date.now(),
  });
}

/* =========================================================
   CHECK WORKER DISTRICT
========================================================= */

async function checkedWorker(user, workerId) {
  ensureMidwife(user);

  const { data, error } = await supabase
    .from("users")
    .select(
      `
      id,
      username,
      role,
      is_active,
      barangay_id,
      barangays (
        id,
        district_id
      )
      `
    )
    .eq("id", workerId)
    .maybeSingle();

  if (error) throw error;

  if (
    !data ||
    !["bns", "bhw"].includes(data.role) ||
    String(data.barangays?.district_id) !==
      String(user.district_id)
  ) {
    throw new Error(
      "This worker is no longer eligible for management in your district."
    );
  }

  return data;
}

/* =========================================================
   GET ACTIVE AREA ASSIGNMENTS
========================================================= */

async function getActiveAreaIds(workerId) {
  const { data, error } = await supabase
    .from("worker_area_assignments")
    .select("local_area_id")
    .eq("worker_id", workerId)
    .eq("is_active", true);

  if (error) throw error;

  return uniqueIds(
    (data || []).map((row) => row.local_area_id)
  );
}

/* =========================================================
   APPLY WORKER STATUS CHANGE
========================================================= */

async function applyStatus(user, action) {
  const worker = await checkedWorker(
    user,
    action.workerId
  );

  const currentlyActive = worker.is_active === true;

  // Detect changes made on another device.
  if (
    currentlyActive !== action.active &&
    currentlyActive !== action.expectedActive
  ) {
    throw new Error(
      "The worker's status changed on another device. Review before retrying."
    );
  }

  const previousAreaIds = action.active
    ? []
    : await getActiveAreaIds(worker.id);

  let statusChanged = false;

  /* -------------------------------------------------------
     UPDATE ACCOUNT STATUS
  ------------------------------------------------------- */

  if (currentlyActive !== action.active) {
    const { data, error } = await supabase
      .from("users")
      .update({
        is_active: action.active,
      })
      .eq("id", worker.id)
      .eq("role", worker.role)
      .eq("is_active", currentlyActive)
      .select("id,is_active")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "Supabase did not confirm the account status change."
      );
    }

    statusChanged = true;
  }

  /* -------------------------------------------------------
     DEACTIVATE AREA ASSIGNMENTS WHEN ACCOUNT IS INACTIVE
  ------------------------------------------------------- */

  if (action.active === false) {
    const { error } = await supabase
      .from("worker_area_assignments")
      .update({
        is_active: false,
      })
      .eq("worker_id", worker.id)
      .eq("is_active", true);

    if (error) throw error;
  }

  const auditEvents = [];

  /* -------------------------------------------------------
     ACCOUNT STATUS AUDIT
  ------------------------------------------------------- */

  if (statusChanged) {
    auditEvents.push({
      action: action.active
        ? "account_activated"
        : "account_deactivated",

      entityType: "users",
      entityId: worker.id,

      details: {
        worker_id: worker.id,
        target_username: worker.username,
        target_role: worker.role,
        barangay_id: worker.barangay_id,
        previous_status: currentlyActive,
        new_status: action.active,

        message: `${worker.role.toUpperCase()} account ${
          action.active
            ? "activated"
            : "deactivated"
        }: ${worker.username}`,
      },
    });
  }

  /* -------------------------------------------------------
     AREA REMOVAL AUDIT
  ------------------------------------------------------- */

  if (
    action.active === false &&
    previousAreaIds.length > 0
  ) {
    auditEvents.push({
      action: "worker_areas_removed",
      entityType: "worker_area_assignments",
      entityId: worker.id,

      details: {
        worker_id: worker.id,
        target_username: worker.username,
        target_role: worker.role,
        barangay_id: worker.barangay_id,
        previous_area_ids: previousAreaIds,
        new_area_ids: [],
        removed_area_ids: previousAreaIds,

        reason: "Worker account deactivated",

        message:
          `Active area assignments removed for ${worker.username} because the account was deactivated.`,
      },
    });
  }

  return auditEvents;
}

/* =========================================================
   APPLY PUROK / SITIO AREA ASSIGNMENTS
========================================================= */

async function applyAreas(user, action) {
  const worker = await checkedWorker(
    user,
    action.workerId
  );

  if (worker.is_active !== true) {
    throw new Error(
      "Activate this worker before assigning Purok/Sitio areas."
    );
  }

  /* -------------------------------------------------------
     VALIDATE AVAILABLE AREAS
  ------------------------------------------------------- */

  const { data: areas, error: areasError } =
    await supabase
      .from("local_areas")
      .select("id,barangay_id")
      .eq("barangay_id", worker.barangay_id);

  if (areasError) throw areasError;

  const allowedIds = new Set(
    (areas || []).map((area) => String(area.id))
  );

  const requestedIds = uniqueIds(
    action.areaIds || []
  );

  if (
    requestedIds.some(
      (id) => !allowedIds.has(id)
    )
  ) {
    throw new Error(
      "One or more selected areas no longer belong to this worker's barangay."
    );
  }

  /* -------------------------------------------------------
     GET EXISTING ASSIGNMENTS
  ------------------------------------------------------- */

  const { data: existing, error: existingError } =
    await supabase
      .from("worker_area_assignments")
      .select(
        "id,local_area_id,is_active"
      )
      .eq("worker_id", worker.id);

  if (existingError) throw existingError;

  const existingRows = existing || [];

  const existingByArea = new Map(
    existingRows.map((row) => [
      String(row.local_area_id),
      row,
    ])
  );

  const previousIds = uniqueIds(
    existingRows
      .filter((row) => row.is_active === true)
      .map((row) => row.local_area_id)
  );

  const selected = new Set(requestedIds);

  const addedIds = difference(
    requestedIds,
    previousIds
  );

  const removedIds = difference(
    previousIds,
    requestedIds
  );

  /* -------------------------------------------------------
     NO CHANGES
  ------------------------------------------------------- */

  if (
    addedIds.length === 0 &&
    removedIds.length === 0
  ) {
    return [];
  }

  /* -------------------------------------------------------
     DEACTIVATE REMOVED ASSIGNMENTS
  ------------------------------------------------------- */

  for (const row of existingRows) {
    if (
      row.is_active === true &&
      !selected.has(String(row.local_area_id))
    ) {
      const { error } = await supabase
        .from("worker_area_assignments")
        .update({
          is_active: false,
        })
        .eq("id", row.id);

      if (error) throw error;
    }
  }

  /* -------------------------------------------------------
     ACTIVATE / INSERT SELECTED AREAS
  ------------------------------------------------------- */

  for (const areaId of requestedIds) {
    const previous = existingByArea.get(areaId);

    if (previous) {
      if (previous.is_active !== true) {
        const { error } = await supabase
          .from("worker_area_assignments")
          .update({
            is_active: true,
            assigned_by: user.id,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", previous.id);

        if (error) throw error;
      }
    } else {
      const { error } = await supabase
        .from("worker_area_assignments")
        .insert({
          worker_id: worker.id,
          local_area_id: Number(areaId),
          assigned_by: user.id,
          is_active: true,
        });

      if (error) throw error;
    }
  }

  /* -------------------------------------------------------
     RETURN AUDIT EVENT
  ------------------------------------------------------- */

  return [
    {
      action: "worker_areas_updated",
      entityType: "worker_area_assignments",
      entityId: worker.id,

      details: {
        worker_id: worker.id,
        target_username: worker.username,
        target_role: worker.role,
        barangay_id: worker.barangay_id,

        previous_area_ids: previousIds,
        new_area_ids: requestedIds,
        added_area_ids: addedIds,
        removed_area_ids: removedIds,

        message:
          `Purok/Sitio assignments updated for ${worker.username}.`,
      },
    },
  ];
}

/* =========================================================
   AUDIT PENDING EVENTS
========================================================= */

async function flushAuditEvents(user, action) {
  const events = action.auditEvents || [];

  for (
    let index = action.auditIndex || 0;
    index < events.length;
    index++
  ) {
    await recordWorkerAudit(
      user,
      events[index]
    );

    // Store progress after each successful insert.
    await db.queue.update(action.id, {
      auditIndex: index + 1,
    });
  }
}

/* =========================================================
   SYNCHRONIZE OFFLINE ACTIONS
========================================================= */

let activeSync = null;

export async function syncWorkerActions(user) {
  ensureMidwife(user);

  if (activeSync) {
    return activeSync;
  }

  activeSync = performSync(user);

  try {
    return await activeSync;
  } finally {
    activeSync = null;
  }
}

async function performSync(user) {
  if (!navigator.onLine) {
    throw new Error(
      "Offline. Changes remain queued."
    );
  }

  ensureMidwife(user);

  const actions = await pendingWorkerActions(user);

  let synced = 0;

  for (const action of actions) {
    /* -----------------------------------------------------
       DATABASE UPDATE ALREADY COMPLETED
       ONLY AUDIT LOGGING REMAINS
    ----------------------------------------------------- */

    if (action.syncStatus === "audit_pending") {
      await flushAuditEvents(user, action);

      await db.queue.delete(action.id);

      synced++;
      continue;
    }

    /* -----------------------------------------------------
       APPLY DATABASE CHANGES
    ----------------------------------------------------- */

    let auditEvents = [];

    if (action.type === "status") {
      auditEvents = await applyStatus(
        user,
        action
      );
    } else if (action.type === "areas") {
      auditEvents = await applyAreas(
        user,
        action
      );
    } else {
      throw new Error(
        "Unknown queued action."
      );
    }

    /* -----------------------------------------------------
       SAVE AUDIT INFORMATION LOCALLY
    ----------------------------------------------------- */

    await db.queue.update(action.id, {
      syncStatus: "audit_pending",
      auditEvents,
      auditIndex: 0,
    });

    /* -----------------------------------------------------
       INSERT AUDIT LOGS
    ----------------------------------------------------- */

    await flushAuditEvents(user, {
      ...action,
      auditEvents,
      auditIndex: 0,
    });

    /* -----------------------------------------------------
       REMOVE COMPLETED QUEUED ACTION
    ----------------------------------------------------- */

    await db.queue.delete(action.id);

    synced++;
  }

  return synced;
}
