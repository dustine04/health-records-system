import { useCallback, useEffect, useRef, useState } from "react";
import Dexie from "dexie";
import {
  Home,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Users,
  Eye,
  UserPlus,
  Save,
  RefreshCw,
  Cloud,
  CloudOff,
  Clock3,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";

import {
  getHouseholdCache,
  refreshHouseholdCache,
  saveHouseholdLocal,
  deleteHouseholdLocal,
  saveResidentLocal,
  deleteResidentLocal,
  syncHouseholds,
} from "../../lib/householdOffline";

/* =========================================================
   LOCAL DRAFT DATABASE
   Separate from the existing offline submission queue.
========================================================= */

const draftDB = new Dexie("mchms-bns-household-drafts-v1");

draftDB.version(1).stores({
  drafts: "key,owner,updatedAt",
});

const getDraftKey = (userId, kind, householdId = "new", recordId = "new") =>
  ["bns", userId, kind, householdId, recordId]
    .map((value) => encodeURIComponent(String(value)))
    .join(":");

const readDraft = (key) => draftDB.drafts.get(key);

const writeDraft = (key, userId, values) =>
  draftDB.drafts.put({
    key,
    owner: `bns:${userId}`,
    data: { ...values },
    savedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });

const removeDraft = (key) => draftDB.drafts.delete(key);

/* =========================================================
   DEFAULT FORMS
========================================================= */

const emptyResident = () => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "Male",
  birth_date: "",
  civil_status: "",
  relationship_to_head: "",
  contact_number: "",
  is_household_head: false,
});

const emptyHousehold = () => ({
  household_code: "",
  household_head: "",
  contact_number: "",
  address: "",
  local_area_id: "",
});

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

function getUser() {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  zIndex = "z-50",
}) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 p-3 sm:p-5`}
    >
      <div
        className={`flex max-h-[95vh] w-full ${
          wide ? "max-w-2xl" : "max-w-lg"
        } flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>

            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function BnsHousehold() {
  const [user] = useState(getUser);
  const userId = user?.id;

  /* =====================================================
     HOUSEHOLD DATA
  ===================================================== */

  const [households, setHouseholds] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showHouseholdModal, setShowHouseholdModal] = useState(false);

  const [editingHousehold, setEditingHousehold] = useState(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [selectedHousehold, setSelectedHousehold] = useState(null);

  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);

  const [showResidentModal, setShowResidentModal] = useState(false);

  const [editingResident, setEditingResident] = useState(null);

  const [residentSaving, setResidentSaving] = useState(false);

  const [householdSaving, setHouseholdSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState(emptyHousehold);
  const [residentForm, setResidentForm] = useState(emptyResident);

  /* =====================================================
     OFFLINE STATUS
  ===================================================== */

  const [online, setOnline] = useState(() => navigator.onLine);

  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  /* =====================================================
     DRAFT STATE
  ===================================================== */

  const [activeDraft, setActiveDraft] = useState(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);

  const draftTimer = useRef(null);
  const draftGeneration = useRef(0);
  const draftOperations = useRef(Promise.resolve());
  const draftLocked = useRef(false);
  const activeDraftRef = useRef(null);

  const cancelDraftTimer = useCallback(() => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }
  }, []);

  // Run draft writes and deletions sequentially.
  // This prevents delayed writes from recreating
  // a draft after a successful submission.

  const enqueueDraftOperation = useCallback((operation) => {
    const result = draftOperations.current.catch(() => {}).then(operation);

    draftOperations.current = result.catch(() => {});

    return result;
  }, []);

  const resetDraft = useCallback(() => {
    cancelDraftTimer();

    draftGeneration.current += 1;
    activeDraftRef.current = null;

    setActiveDraft(null);
    setDraftStatus("");
    setDraftSavedAt(null);
    setDraftLoading(false);
  }, [cancelDraftTimer]);

  /* =====================================================
     RESTORE DRAFT WHEN OPENING A FORM
  ===================================================== */

  const prepareDraft = async (kind, householdId, recordId, initialValues) => {
    if (!userId || user?.role !== "bns") {
      alert("A valid BNS session is required.");
      return false;
    }

    if (draftLocked.current || draftLoading) {
      return false;
    }

    draftLocked.current = true;
    setDraftBusy(true);
    setDraftLoading(true);

    cancelDraftTimer();

    const generation = ++draftGeneration.current;

    try {
      const key = getDraftKey(userId, kind, householdId, recordId);

      await draftOperations.current;

      const existing = await readDraft(key);

      if (generation !== draftGeneration.current) {
        return false;
      }

      let values = { ...initialValues };
      let restored = false;

      if (existing?.data) {
        const restore = window.confirm(
          `An unfinished ${kind === "household" ? "household" : "resident"} form was found.\n\n` +
            `Last saved: ${formatDateTime(existing.savedAt)}\n\n` +
            "Press OK to restore your previous entries.\n" +
            "Press Cancel to start a new draft.",
        );

        if (restore) {
          values = {
            ...initialValues,
            ...existing.data,
          };

          restored = true;
        } else {
          await enqueueDraftOperation(() => removeDraft(key));
        }
      }

      if (generation !== draftGeneration.current) {
        return false;
      }

      activeDraftRef.current = { key, kind };
      setActiveDraft({ key, kind });

      if (kind === "household") {
        setForm(values);
      } else {
        setResidentForm(values);
      }

      setDraftSavedAt(restored ? existing.savedAt : null);

      setDraftStatus(
        restored ? "Previous draft restored" : "Automatic draft saving enabled",
      );

      return true;
    } catch (error) {
      console.error("Draft restoration error:", error);

      alert(
        "Unable to load local drafts. Please check your browser storage before continuing.",
      );

      return false;
    } finally {
      if (generation === draftGeneration.current) {
        setDraftLoading(false);
      }

      draftLocked.current = false;
      setDraftBusy(false);
    }
  };

  /* =====================================================
     AUTOMATIC DRAFT SAVING
     Saves after 650ms without changes.
  ===================================================== */

  useEffect(() => {
    if (!activeDraft || draftLoading || draftLocked.current) {
      return;
    }

    const formOpen =
      activeDraft.kind === "household" ? showHouseholdModal : showResidentModal;

    if (!formOpen) return;

    const values = activeDraft.kind === "household" ? form : residentForm;

    const key = activeDraft.key;
    const generation = draftGeneration.current;

    cancelDraftTimer();
    setDraftStatus("Saving draft...");

    draftTimer.current = setTimeout(async () => {
      if (
        draftLocked.current ||
        draftGeneration.current !== generation ||
        activeDraftRef.current?.key !== key
      ) {
        return;
      }

      try {
        const savedAt = new Date().toISOString();

        await enqueueDraftOperation(() => writeDraft(key, userId, values));

        if (
          draftGeneration.current === generation &&
          activeDraftRef.current?.key === key &&
          !draftLocked.current
        ) {
          setDraftSavedAt(savedAt);
          setDraftStatus("Draft saved on this device");
        }
      } catch (error) {
        console.error("Autosave failed:", error);

        if (draftGeneration.current === generation) {
          setDraftStatus("Unable to save draft");
        }
      }
    }, 650);

    return cancelDraftTimer;
  }, [
    activeDraft,
    draftLoading,
    form,
    residentForm,
    showHouseholdModal,
    showResidentModal,
    userId,
    cancelDraftTimer,
    enqueueDraftOperation,
  ]);

  /* =====================================================
     SAVE DRAFT AND CLOSE
  ===================================================== */

  const saveDraftAndClose = async (kind) => {
    if (draftLocked.current || householdSaving || residentSaving) {
      return;
    }

    draftLocked.current = true;
    setDraftBusy(true);

    cancelDraftTimer();

    try {
      const draft = activeDraftRef.current;

      if (draft?.kind === kind) {
        const values = kind === "household" ? form : residentForm;

        await enqueueDraftOperation(() =>
          writeDraft(draft.key, userId, values),
        );
      }

      resetDraft();

      if (kind === "household") {
        setShowHouseholdModal(false);
        setEditingHousehold(null);
      } else {
        setShowResidentModal(false);
        setEditingResident(null);
      }
    } catch (error) {
      alert(`Could not save the draft: ${error.message}`);
    } finally {
      draftLocked.current = false;
      setDraftBusy(false);
    }
  };

  /* =====================================================
     DISCARD DRAFT
  ===================================================== */

  const discardCurrentDraft = async (kind) => {
    if (draftLocked.current) return;

    const draft = activeDraftRef.current;

    if (!draft || draft.kind !== kind) return;

    if (
      !window.confirm(
        "Discard this unfinished form? Its locally saved draft will be deleted.",
      )
    ) {
      return;
    }

    draftLocked.current = true;
    setDraftBusy(true);
    cancelDraftTimer();

    try {
      await enqueueDraftOperation(() => removeDraft(draft.key));

      resetDraft();

      if (kind === "household") {
        setShowHouseholdModal(false);
        setEditingHousehold(null);
      } else {
        setShowResidentModal(false);
        setEditingResident(null);
      }
    } catch (error) {
      alert(`Unable to discard draft: ${error.message}`);
    } finally {
      draftLocked.current = false;
      setDraftBusy(false);
    }
  };

  /* =====================================================
     REMOVE DRAFT AFTER SUCCESSFUL SAVE
  ===================================================== */

  const clearSavedDraft = async (kind) => {
    cancelDraftTimer();

    const draft = activeDraftRef.current;

    if (draft?.kind === kind) {
      try {
        await enqueueDraftOperation(() => removeDraft(draft.key));
      } catch (error) {
        console.error("Record saved but draft cleanup failed:", error);

        setSyncError(
          "Record saved locally, but the old draft could not be removed.",
        );
      }
    }

    resetDraft();
  };

  /* =====================================================
     DRAFT STATUS DISPLAY
  ===================================================== */

  const renderDraftStatus = (kind) => {
    if (activeDraft?.kind !== kind) return null;

    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Clock3 size={18} className="mt-0.5 text-green-700" />

            <div>
              <p className="text-sm font-semibold text-green-800">
                {draftStatus}
              </p>

              {draftSavedAt && (
                <p className="mt-1 text-xs text-green-700">
                  Last saved: {formatDateTime(draftSavedAt)}
                </p>
              )}

              <p className="mt-1 text-xs text-gray-600">
                Unfinished entries are saved on this device and can be restored
                later.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => discardCurrentDraft(kind)}
            disabled={draftBusy || householdSaving || residentSaving}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Discard Draft
          </button>
        </div>
      </div>
    );
  };

  /* =====================================================
     OFFLINE CACHE
  ===================================================== */

  const applyCache = useCallback(
    async (remote = false) => {
      if (!userId) return null;

      const cache = remote
        ? await refreshHouseholdCache(userId)
        : await getHouseholdCache(userId);

      setHouseholds(cache.households || []);
      setLocalAreas(cache.areas || []);
      setPending(cache.pending || 0);

      setSelectedHousehold((current) =>
        current
          ? (cache.households || []).find(
              (h) => String(h.id) === String(current.id),
            ) || null
          : null,
      );

      return cache;
    },
    [userId],
  );

  const loadData = useCallback(
    async (remote = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const cache = await applyCache(false);

        if (remote && navigator.onLine) {
          try {
            await applyCache(true);
            setSyncError("");
          } catch (error) {
            setSyncError(
              `Server refresh failed: ${error.message}. Showing cached data.`,
            );
          }
        }

        return cache;
      } catch (error) {
        setSyncError(`Local storage error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    },
    [applyCache, userId],
  );

  const doSync = useCallback(async () => {
    if (!userId || !navigator.onLine) return;

    setSyncing(true);

    try {
      const result = await syncHouseholds(userId);

      if (result.error) {
        setSyncError(result.error);
      } else if (!result.busy) {
        setSyncError("");

        try {
          await applyCache(true);
        } catch (error) {
          setSyncError(`Upload finished, but refresh failed: ${error.message}`);
        }
      }

      await applyCache(false);
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setSyncing(false);
    }
  }, [userId, applyCache]);

  useEffect(() => {
    if (!userId) return;

    void loadData(true);

    const onOnline = () => {
      setOnline(true);
      void doSync();
    };

    const onOffline = () => {
      setOnline(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId, loadData, doSync]);

  const updateLocal = async (householdId = selectedHousehold?.id) => {
    const cache = await applyCache(false);

    if (cache && householdId != null) {
      setResidents(cache.residents?.[String(householdId)] || []);
    }

    if (navigator.onLine) {
      void doSync();
    }
  };

  const fetchResidents = async (householdId) => {
    setResidentsLoading(true);

    try {
      const cache = await getHouseholdCache(userId);

      setResidents(cache.residents?.[String(householdId)] || []);
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setResidentsLoading(false);
    }
  };

  const refreshSelectedHousehold = async (householdId) => {
    const cache = await getHouseholdCache(userId);

    setSelectedHousehold(
      (cache.households || []).find(
        (h) => String(h.id) === String(householdId),
      ) || null,
    );
  };

  /* =====================================================
     HOUSEHOLD ADD / EDIT
  ===================================================== */

  const openAddModal = async () => {
    const values = {
      ...emptyHousehold(),
      household_code: `HH-${Date.now()}`,
      local_area_id: localAreas.length === 1 ? String(localAreas[0].id) : "",
    };

    const opened = await prepareDraft("household", "new", "new", values);

    if (opened) {
      setEditingHousehold(null);
      setShowHouseholdModal(true);
    }
  };

  const openEditModal = async (household) => {
    const values = {
      household_code: household.household_code || "",
      household_head: household.household_head || "",
      contact_number: household.contact_number || "",
      address: household.address || "",
      local_area_id: String(household.local_area_id || ""),
    };

    const opened = await prepareDraft(
      "household",
      household.id,
      household.id,
      values,
    );

    if (opened) {
      setEditingHousehold(household);
      setShowHouseholdModal(true);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleHouseholdSubmit = async (event) => {
    event.preventDefault();

    if (
      householdSaving ||
      draftLocked.current ||
      activeDraftRef.current?.kind !== "household"
    ) {
      return;
    }

    if (!form.household_head.trim() || !form.household_code.trim()) {
      alert("Enter household code and head.");
      return;
    }

    if (
      !localAreas.some((area) => String(area.id) === String(form.local_area_id))
    ) {
      alert("Select an assigned Purok/Sitio.");
      return;
    }

    draftLocked.current = true;
    setDraftBusy(true);
    setHouseholdSaving(true);
    cancelDraftTimer();

    let savedLocally = false;

    try {
      await saveHouseholdLocal(userId, editingHousehold?.id ?? null, {
        household_code: form.household_code.trim(),
        household_head: form.household_head.trim(),
        contact_number: form.contact_number.trim() || null,
        address: form.address.trim() || null,
        local_area_id: Number(form.local_area_id),
      });

      savedLocally = true;

      await clearSavedDraft("household");

      setShowHouseholdModal(false);
      setEditingHousehold(null);

      await updateLocal();
    } catch (error) {
      if (savedLocally) {
        resetDraft();
        setShowHouseholdModal(false);
        setEditingHousehold(null);

        setSyncError(
          `Household saved locally, but refreshing failed: ${error.message}`,
        );
      } else {
        alert(error.message);
      }
    } finally {
      draftLocked.current = false;
      setDraftBusy(false);
      setHouseholdSaving(false);
    }
  };

  const handleDeleteHousehold = async (id) => {
    if (
      !window.confirm(
        "Delete this household? This can fail on sync if related records exist.",
      )
    ) {
      return;
    }

    try {
      await deleteHouseholdLocal(userId, id);
      await updateLocal();
    } catch (error) {
      alert(error.message);
    }
  };

  /* =====================================================
     HOUSEHOLD DETAILS
  ===================================================== */

  const viewHousehold = async (household) => {
    setSelectedHousehold(household);
    setShowDetailsModal(true);

    await fetchResidents(household.id);
  };

  const closeDetails = () => {
    if (showResidentModal) return;

    setShowDetailsModal(false);
    setSelectedHousehold(null);
    setResidents([]);
  };

  /* =====================================================
     RESIDENT ADD / EDIT
  ===================================================== */

  const openAddResidentModal = async () => {
    if (!selectedHousehold) return;

    const opened = await prepareDraft(
      "resident",
      selectedHousehold.id,
      "new",
      emptyResident(),
    );

    if (opened) {
      setEditingResident(null);
      setShowResidentModal(true);
    }
  };

  const openEditResidentModal = async (resident) => {
    if (!selectedHousehold) return;

    const values = {
      first_name: resident.first_name || "",
      middle_name: resident.middle_name || "",
      last_name: resident.last_name || "",
      sex: resident.sex || "Male",
      birth_date: resident.birth_date || "",
      civil_status: resident.civil_status || "",
      relationship_to_head: resident.relationship_to_head || "",
      contact_number: resident.contact_number || "",
      is_household_head: Boolean(resident.is_household_head),
    };

    const opened = await prepareDraft(
      "resident",
      selectedHousehold.id,
      resident.id,
      values,
    );

    if (opened) {
      setEditingResident(resident);
      setShowResidentModal(true);
    }
  };

  const handleResidentChange = (event) => {
    const { name, value, type, checked } = event.target;

    setResidentForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleResidentSubmit = async (event) => {
    event.preventDefault();

    if (
      !selectedHousehold ||
      residentSaving ||
      draftLocked.current ||
      activeDraftRef.current?.kind !== "resident"
    ) {
      return;
    }

    if (!residentForm.first_name.trim() || !residentForm.last_name.trim()) {
      alert("Enter first and last name.");
      return;
    }

    draftLocked.current = true;
    setDraftBusy(true);
    setResidentSaving(true);
    cancelDraftTimer();

    const householdId = selectedHousehold.id;
    let savedLocally = false;

    try {
      await saveResidentLocal(
        userId,
        householdId,
        editingResident?.id ?? null,
        {
          first_name: residentForm.first_name.trim(),
          middle_name: residentForm.middle_name.trim() || null,
          last_name: residentForm.last_name.trim(),
          sex: residentForm.sex,
          birth_date: residentForm.birth_date || null,
          civil_status: residentForm.civil_status || null,
          relationship_to_head: residentForm.relationship_to_head || null,
          contact_number: residentForm.contact_number.trim() || null,
          is_household_head: Boolean(residentForm.is_household_head),
        },
      );

      savedLocally = true;

      await clearSavedDraft("resident");

      setShowResidentModal(false);
      setEditingResident(null);
      setResidentForm(emptyResident());

      await updateLocal(householdId);
      await refreshSelectedHousehold(householdId);
    } catch (error) {
      if (savedLocally) {
        resetDraft();
        setShowResidentModal(false);
        setEditingResident(null);

        setSyncError(
          `Resident saved locally, but refreshing failed: ${error.message}`,
        );
      } else {
        alert(error.message);
      }
    } finally {
      draftLocked.current = false;
      setDraftBusy(false);
      setResidentSaving(false);
    }
  };

  const handleDeleteResident = async (resident) => {
    if (
      !selectedHousehold ||
      !window.confirm(`Delete ${resident.first_name} ${resident.last_name}?`)
    ) {
      return;
    }

    try {
      const householdId = selectedHousehold.id;

      await deleteResidentLocal(userId, householdId, resident.id);

      await updateLocal(householdId);
      await refreshSelectedHousehold(householdId);
    } catch (error) {
      alert(error.message);
    }
  };

  /* =====================================================
     FILTERING
  ===================================================== */

  const filteredHouseholds = households.filter((household) =>
    [
      household.household_code,
      household.household_head,
      household.local_areas?.name,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );

  /* =====================================================
     ACCESS CHECK
  ===================================================== */

  if (!user || user.role !== "bns") {
    return (
      <DashboardLayout>
        <div className="rounded-xl border bg-white p-6 text-red-600">
          A valid BNS session is required to access this page.
        </div>
      </DashboardLayout>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* OFFLINE STATUS */}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm">
          <span
            className={`inline-flex items-center gap-2 font-semibold ${
              online ? "text-green-700" : "text-amber-700"
            }`}
          >
            {online ? <Cloud size={18} /> : <CloudOff size={18} />}

            {online ? "Online" : "Offline"}
          </span>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
            {pending} pending change
            {pending === 1 ? "" : "s"}
          </span>

          <button
            type="button"
            onClick={doSync}
            disabled={!online || syncing}
            className={primaryButton}
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />

            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={!online || syncing}
            className={secondaryButton}
          >
            Refresh
          </button>

          {syncError && (
            <p className="w-full text-sm text-red-600">{syncError}</p>
          )}
        </div>

        {/* PAGE HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100">
              <Home className="h-6 w-6 text-green-600" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-800">Households</h1>

              <p className="text-sm text-gray-500">
                Manage households and household members
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            disabled={draftBusy || draftLoading}
            className={primaryButton}
          >
            <Plus size={18} />
            Add Household
          </button>
        </div>

        {/* ASSIGNED AREAS */}

        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Users size={18} className="text-green-600" />

            <span className="text-sm font-medium text-gray-700">
              Assigned Purok/Sitio:
            </span>

            <div className="flex flex-wrap gap-2">
              {localAreas.length > 0 ? (
                localAreas.map((area) => (
                  <span
                    key={area.id}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-green-700 shadow-sm"
                  >
                    {area.name}
                    {area.barangays?.name ? ` - ${area.barangays.name}` : ""}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">
                  No assigned Purok/Sitio
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH */}

        <div className="relative">
          <Search
            size={19}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search household code, household head, or Purok/Sitio..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} py-3 pl-10`}
          />
        </div>

        {/* HOUSEHOLDS TABLE */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  {[
                    "Household Code",
                    "Household Head",
                    "Purok/Sitio",
                    "Barangay",
                    "Members",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-4 text-left text-xs font-semibold uppercase text-gray-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-gray-500"
                    >
                      Loading households...
                    </td>
                  </tr>
                ) : filteredHouseholds.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <Home className="mx-auto mb-3 h-10 w-10 text-gray-300" />

                      <p className="text-sm font-medium text-gray-600">
                        No households found
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Add a household to get started.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredHouseholds.map((household) => (
                    <tr
                      key={household.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-gray-800">
                        {household.household_code}

                        {household._pending && (
                          <span className="ml-2 text-xs text-amber-600">
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {household.household_head || "No household head"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {household.local_areas?.name || "-"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {household.local_areas?.barangays?.name || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          <Users size={14} />
                          {household.resident_count ?? 0}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => viewHousehold(household)}
                            title="View Household"
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Eye size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(household)}
                            title="Edit Household"
                            className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                          >
                            <Edit size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteHousehold(household.id)}
                            title="Delete Household"
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =================================================
            ADD / EDIT HOUSEHOLD MODAL
        ================================================= */}

        {showHouseholdModal && (
          <Modal
            title={editingHousehold ? "Edit Household" : "Add Household"}
            subtitle="Enter household information"
            onClose={() => void saveDraftAndClose("household")}
          >
            <form onSubmit={handleHouseholdSubmit} className="space-y-4 p-6">
              {renderDraftStatus("household")}

              <Field label="Household Code" required>
                <input
                  type="text"
                  name="household_code"
                  value={form.household_code}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </Field>

              <Field label="Household Head" required>
                <input
                  type="text"
                  name="household_head"
                  value={form.household_head}
                  onChange={handleChange}
                  placeholder="Enter household head"
                  className={inputClass}
                  required
                />
              </Field>

              <Field label="Contact Number">
                <input
                  type="text"
                  name="contact_number"
                  value={form.contact_number}
                  onChange={handleChange}
                  placeholder="09XXXXXXXXX"
                  className={inputClass}
                />
              </Field>

              <Field label="Address">
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="House number, street, etc."
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <Field label="Purok/Sitio" required>
                <select
                  name="local_area_id"
                  value={form.local_area_id}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option value="">Select Purok/Sitio</option>

                  {localAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                      {area.barangays?.name ? ` - ${area.barangays.name}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => void saveDraftAndClose("household")}
                  disabled={draftBusy || householdSaving}
                  className={secondaryButton}
                >
                  Save Draft & Close
                </button>

                <button
                  type="submit"
                  disabled={householdSaving || draftBusy || draftLoading}
                  className={primaryButton}
                >
                  <Save size={17} />

                  {householdSaving
                    ? "Saving..."
                    : editingHousehold
                      ? "Save Changes"
                      : "Add Household"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* =================================================
            HOUSEHOLD DETAILS MODAL
        ================================================= */}

        {showDetailsModal && selectedHousehold && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5">
            <div className="mx-auto flex h-full max-h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}

              <div className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                    <Home className="h-6 w-6 text-green-600" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Household Details
                    </h2>

                    <p className="text-sm text-gray-500">
                      {selectedHousehold.household_code}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                >
                  <X size={24} />
                </button>
              </div>

              {/* CONTENT */}

              <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                {/* HOUSEHOLD INFORMATION */}

                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Home size={19} className="text-green-600" />

                    <h3 className="font-semibold text-gray-800">
                      Household Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Household Code", selectedHousehold.household_code],
                      ["Household Head", selectedHousehold.household_head],
                      ["Contact Number", selectedHousehold.contact_number],
                      [
                        "Barangay",
                        selectedHousehold.local_areas?.barangays?.name,
                      ],
                      ["Purok/Sitio", selectedHousehold.local_areas?.name],
                      ["Address", selectedHousehold.address],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs font-medium uppercase text-gray-400">
                          {label}
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                          {value || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RESIDENTS */}

                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                        <Users size={18} className="text-green-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Household Members
                        </h3>

                        <p className="text-xs text-gray-500">
                          {residents.length} member
                          {residents.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={openAddResidentModal}
                      disabled={draftBusy || draftLoading}
                      className={primaryButton}
                    >
                      <UserPlus size={17} />
                      Add Member
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                      <thead className="bg-gray-50">
                        <tr className="border-b">
                          {[
                            "Name",
                            "Sex",
                            "Birth Date",
                            "Civil Status",
                            "Relationship",
                            "Contact",
                            "Actions",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {residentsLoading ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-5 py-10 text-center text-sm text-gray-500"
                            >
                              Loading household members...
                            </td>
                          </tr>
                        ) : residents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-10 text-center">
                              <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />

                              <p className="text-sm font-medium text-gray-600">
                                No household members yet
                              </p>

                              <p className="mt-1 text-xs text-gray-400">
                                Click Add Member to add a resident.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          residents.map((resident) => (
                            <tr
                              key={resident.id}
                              className="border-b last:border-0 hover:bg-gray-50"
                            >
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800">
                                    {resident.first_name}{" "}
                                    {resident.middle_name
                                      ? `${resident.middle_name} `
                                      : ""}
                                    {resident.last_name}
                                  </span>

                                  {resident._pending && (
                                    <span className="text-xs text-amber-600">
                                      Pending
                                    </span>
                                  )}

                                  {resident.is_household_head && (
                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                      HEAD
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.sex || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.birth_date || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.civil_status || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.relationship_to_head || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.contact_number || "-"}
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditResidentModal(resident)
                                    }
                                    title="Edit Member"
                                    className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                                  >
                                    <Edit size={17} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteResident(resident)
                                    }
                                    title="Delete Member"
                                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FOOTER */}

              <div className="flex shrink-0 justify-end border-t bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={closeDetails}
                  className={secondaryButton}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            ADD / EDIT RESIDENT MODAL
        ================================================= */}

        {showResidentModal && selectedHousehold && (
          <Modal
            title={
              editingResident ? "Edit Household Member" : "Add Household Member"
            }
            subtitle={selectedHousehold.household_code}
            onClose={() => void saveDraftAndClose("resident")}
            wide
            zIndex="z-[60]"
          >
            <form onSubmit={handleResidentSubmit} className="space-y-5 p-6">
              {renderDraftStatus("resident")}

              {/* PERSONAL INFORMATION */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="First Name" required>
                    <input
                      type="text"
                      name="first_name"
                      value={residentForm.first_name}
                      onChange={handleResidentChange}
                      className={inputClass}
                      required
                    />
                  </Field>

                  <Field label="Middle Name">
                    <input
                      type="text"
                      name="middle_name"
                      value={residentForm.middle_name}
                      onChange={handleResidentChange}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Last Name" required>
                    <input
                      type="text"
                      name="last_name"
                      value={residentForm.last_name}
                      onChange={handleResidentChange}
                      className={inputClass}
                      required
                    />
                  </Field>
                </div>
              </div>

              {/* BASIC DETAILS */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Sex">
                  <select
                    name="sex"
                    value={residentForm.sex}
                    onChange={handleResidentChange}
                    className={inputClass}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </Field>

                <Field label="Birth Date">
                  <input
                    type="date"
                    name="birth_date"
                    value={residentForm.birth_date}
                    onChange={handleResidentChange}
                    className={inputClass}
                  />
                </Field>

                <Field label="Civil Status">
                  <select
                    name="civil_status"
                    value={residentForm.civil_status}
                    onChange={handleResidentChange}
                    className={inputClass}
                  >
                    <option value="">Select Civil Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </Field>

                <Field label="Relationship to Household Head">
                  <select
                    name="relationship_to_head"
                    value={residentForm.relationship_to_head}
                    onChange={handleResidentChange}
                    className={inputClass}
                  >
                    <option value="">Select Relationship</option>

                    {[
                      "Household Head",
                      "Spouse",
                      "Son",
                      "Daughter",
                      "Parent",
                      "Sibling",
                      "Grandchild",
                      "Relative",
                      "Non-relative",
                    ].map((relationship) => (
                      <option key={relationship} value={relationship}>
                        {relationship}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* CONTACT */}

              <Field label="Contact Number">
                <input
                  type="text"
                  name="contact_number"
                  value={residentForm.contact_number}
                  onChange={handleResidentChange}
                  placeholder="09XXXXXXXXX"
                  className={inputClass}
                />
              </Field>

              {/* HOUSEHOLD HEAD */}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-green-100 bg-green-50 p-4">
                <input
                  type="checkbox"
                  name="is_household_head"
                  checked={residentForm.is_household_head}
                  onChange={handleResidentChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600"
                />

                <div>
                  <p className="text-sm font-medium text-gray-800">
                    This resident is the household head
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Selecting this will automatically remove the household-head
                    status from other members.
                  </p>
                </div>
              </label>

              {/* BUTTONS */}

              <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={() => void saveDraftAndClose("resident")}
                  disabled={residentSaving || draftBusy}
                  className={secondaryButton}
                >
                  Save Draft & Close
                </button>

                <button
                  type="submit"
                  disabled={residentSaving || draftBusy || draftLoading}
                  className={primaryButton}
                >
                  <Save size={17} />

                  {residentSaving
                    ? "Saving..."
                    : editingResident
                      ? "Save Changes"
                      : "Add Member"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}

export default BnsHousehold;
