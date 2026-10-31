import { useCallback, useEffect, useRef, useState } from "react";
import {
  Home,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Users,
  Eye,
  Save,
  UserRound,
  RefreshCw,
  CloudOff,
  Cloud,
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
} from "../../lib/bhwHouseholdOffline";

import {
  householdDraftKey,
  readHouseholdDraft,
  saveHouseholdDraft,
  deleteHouseholdDraft,
} from "../../lib/bhwHouseholdDrafts";

/* =========================================================
   DEFAULT FORMS
========================================================= */

const EMPTY_HOUSEHOLD = {
  household_code: "",
  household_head: "",
  contact_number: "",
  address: "",
  local_area_id: "",
};

const EMPTY_RESIDENT = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "Male",
  birth_date: "",
  civil_status: "",
  relationship_to_head: "",
  contact_number: "",
  is_household_head: false,
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatDraftTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function FormField({ label, required = false, children }) {
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

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "max-w-2xl",
  zIndex = "z-50",
}) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 p-3 sm:p-5`}
    >
      <div
        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function BhwHousehold() {
  const [user] = useState(getStoredUser);
  const userId = user?.id;

  /* =====================================================
     HOUSEHOLD AND RESIDENT DATA
  ===================================================== */

  const [households, setHouseholds] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);
  const [residents, setResidents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [residentsLoading, setResidentsLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [selectedHousehold, setSelectedHousehold] = useState(null);

  /* =====================================================
     MODALS
  ===================================================== */

  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showResidentModal, setShowResidentModal] = useState(false);

  const [editingHousehold, setEditingHousehold] = useState(null);
  const [editingResident, setEditingResident] = useState(null);

  const [form, setForm] = useState({
    ...EMPTY_HOUSEHOLD,
  });

  const [residentForm, setResidentForm] = useState({
    ...EMPTY_RESIDENT,
  });

  const [savingHousehold, setSavingHousehold] = useState(false);
  const [savingResident, setSavingResident] = useState(false);

  /* =====================================================
     OFFLINE STATUS
  ===================================================== */

  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  /* =====================================================
     DRAFT STATE

     Each form has its own draft key.
     Drafts are kept separate from submitted offline data.
  ===================================================== */

  const [activeDraft, setActiveDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const draftTimerRef = useRef(null);
  const draftRequestRef = useRef(0);
  const draftKeyRef = useRef(null);
  const draftValuesRef = useRef(null);

  // Serialize IndexedDB operations so a late autosave
  // cannot recreate a draft after it was deleted.
  const draftWriteRef = useRef(Promise.resolve());

  // Used to prevent autosave while submitting or closing.
  const draftBusyRef = useRef(false);

  const stopDraftTimer = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
  }, []);

  const enqueueDraftOperation = useCallback((operation) => {
    const result = draftWriteRef.current.catch(() => {}).then(operation);

    draftWriteRef.current = result.catch(() => {});

    return result;
  }, []);

  const resetDraftState = useCallback(() => {
    stopDraftTimer();

    draftRequestRef.current += 1;
    draftKeyRef.current = null;
    draftValuesRef.current = null;
    draftBusyRef.current = false;

    setActiveDraft(null);
    setDraftLoading(false);
    setDraftBusy(false);
    setDraftStatus("");
    setDraftSavedAt(null);
  }, [stopDraftTimer]);

  const startDraft = async ({
    kind,
    parentId = "new",
    recordId = "new",
    initialValues,
  }) => {
    if (!user || user.role !== "bhw") {
      alert("A valid BHW account is required.");
      return false;
    }

    stopDraftTimer();

    const requestId = ++draftRequestRef.current;

    draftBusyRef.current = true;
    setDraftLoading(true);
    setDraftStatus("Checking saved draft...");
    setDraftSavedAt(null);
    setActiveDraft(null);

    let key;

    try {
      key = householdDraftKey(user, kind, parentId, recordId);

      await draftWriteRef.current;

      const saved = await readHouseholdDraft(key);

      if (requestId !== draftRequestRef.current) {
        return false;
      }

      let values = { ...initialValues };
      let restored = false;

      if (saved?.data) {
        const answer = window.confirm(
          `An unfinished ${kind} form was found.\n\n` +
            `Last saved: ${formatDraftTime(saved.savedAt)}\n\n` +
            "Press OK to restore it, or Cancel to start fresh.",
        );

        if (answer) {
          values = {
            ...initialValues,
            ...saved.data,
          };
          restored = true;
          setDraftSavedAt(saved.savedAt);
        } else {
          await enqueueDraftOperation(() => deleteHouseholdDraft(key));
        }
      }

      if (requestId !== draftRequestRef.current) {
        return false;
      }

      draftKeyRef.current = key;
      draftValuesRef.current = values;

      if (kind === "household") {
        setForm(values);
      } else {
        setResidentForm(values);
      }

      setActiveDraft({ key, kind });
      setDraftStatus(
        restored
          ? "Unfinished draft restored"
          : "Automatic draft saving enabled",
      );

      return true;
    } catch (error) {
      console.error("Draft restoration failed:", error);

      if (requestId !== draftRequestRef.current) {
        return false;
      }

      // Do not silently overwrite a draft if reading
      // storage failed.
      setDraftStatus("Unable to access local draft storage.");

      alert(
        "The saved draft could not be loaded. Please check your browser storage and try again.",
      );

      return false;
    } finally {
      if (requestId === draftRequestRef.current) {
        draftBusyRef.current = false;
        setDraftLoading(false);
      }
    }
  };

  const persistDraft = async (key, values) => {
    return enqueueDraftOperation(() =>
      saveHouseholdDraft(user, key, { ...values }),
    );
  };

  /* =====================================================
     AUTOMATIC DRAFT SAVE
  ===================================================== */

  useEffect(() => {
    if (!activeDraft || draftLoading || draftBusyRef.current) {
      return;
    }

    const formIsOpen =
      activeDraft.kind === "household" ? showModal : showResidentModal;

    if (!formIsOpen) return;

    const values = activeDraft.kind === "household" ? form : residentForm;

    const key = activeDraft.key;
    const requestId = draftRequestRef.current;

    draftValuesRef.current = { ...values };

    stopDraftTimer();
    setDraftStatus("Saving draft...");

    draftTimerRef.current = setTimeout(async () => {
      if (
        draftBusyRef.current ||
        draftKeyRef.current !== key ||
        draftRequestRef.current !== requestId
      ) {
        return;
      }

      try {
        const savedAt = new Date().toISOString();

        await persistDraft(key, values);

        if (
          draftKeyRef.current === key &&
          draftRequestRef.current === requestId &&
          !draftBusyRef.current
        ) {
          setDraftSavedAt(savedAt);
          setDraftStatus("Draft saved on this device");
        }
      } catch (error) {
        console.error("Draft autosave failed:", error);

        if (draftKeyRef.current === key) {
          setDraftStatus("Draft autosave failed");
        }
      }
    }, 650);

    return () => {
      stopDraftTimer();
    };
  }, [
    activeDraft,
    draftLoading,
    form,
    residentForm,
    showModal,
    showResidentModal,
    stopDraftTimer,
  ]);

  /* =====================================================
     SAVE DRAFT AND CLOSE
  ===================================================== */

  const closeDraftForm = async (kind) => {
    if (
      draftLoading ||
      draftBusyRef.current ||
      savingHousehold ||
      savingResident
    ) {
      return;
    }

    draftBusyRef.current = true;
    setDraftBusy(true);
    stopDraftTimer();

    try {
      if (
        activeDraft &&
        activeDraft.kind === kind &&
        draftKeyRef.current === activeDraft.key
      ) {
        const values = kind === "household" ? form : residentForm;

        await persistDraft(activeDraft.key, values);
      }

      resetDraftState();

      if (kind === "household") {
        setShowModal(false);
        setEditingHousehold(null);
      } else {
        setShowResidentModal(false);
        setEditingResident(null);
      }
    } catch (error) {
      console.error("Unable to save draft:", error);

      alert(
        "Your draft could not be saved. The form will remain open so you can try again.",
      );
    } finally {
      draftBusyRef.current = false;
      setDraftBusy(false);
    }
  };

  /* =====================================================
     DISCARD DRAFT
  ===================================================== */

  const discardDraft = async (kind) => {
    if (!activeDraft || activeDraft.kind !== kind || draftBusyRef.current) {
      return;
    }

    if (
      !window.confirm(
        "Discard this unfinished form? The saved draft will be permanently removed from this device.",
      )
    ) {
      return;
    }

    draftBusyRef.current = true;
    setDraftBusy(true);
    stopDraftTimer();

    try {
      await enqueueDraftOperation(() => deleteHouseholdDraft(activeDraft.key));

      resetDraftState();

      if (kind === "household") {
        setShowModal(false);
        setEditingHousehold(null);
      } else {
        setShowResidentModal(false);
        setEditingResident(null);
      }
    } catch (error) {
      alert(error.message || "Unable to discard the draft.");
    } finally {
      draftBusyRef.current = false;
      setDraftBusy(false);
    }
  };

  /* =====================================================
     REMOVE DRAFT AFTER SUCCESSFUL LOCAL SAVE
  ===================================================== */

  const clearSubmittedDraft = async (kind) => {
    stopDraftTimer();

    if (activeDraft && activeDraft.kind === kind) {
      try {
        await enqueueDraftOperation(() =>
          deleteHouseholdDraft(activeDraft.key),
        );
      } catch (error) {
        // The submitted record is already stored locally.
        // A cleanup failure must not cause another submission.
        console.error("Saved record, but draft cleanup failed:", error);
        setSyncError(
          "Record saved locally, but its old draft could not be removed.",
        );
      }
    }

    resetDraftState();
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

      setLocalAreas(cache.areas || []);
      setHouseholds(cache.households || []);
      setPending(cache.pending || 0);

      setSelectedHousehold((previous) =>
        previous
          ? (cache.households || []).find(
              (item) => String(item.id) === String(previous.id),
            ) || null
          : null,
      );

      return cache;
    },
    [userId],
  );

  const fetchHouseholds = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      await applyCache(false);

      if (navigator.onLine) {
        try {
          await applyCache(true);
          setSyncError("");
        } catch (error) {
          setSyncError(
            `Refresh failed: ${error.message}. Cached data is shown.`,
          );
        }
      }
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setLoading(false);
    }
  }, [applyCache, userId]);

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
          setSyncError(`Uploaded, but refresh failed: ${error.message}`);
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

    let cancelled = false;

    const initialize = async () => {
      await fetchHouseholds();

      if (!cancelled && navigator.onLine) {
        await doSync();
      }
    };

    void initialize();

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
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId, fetchHouseholds, doSync]);

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
    if (!userId) return;

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

  /* =====================================================
     HOUSEHOLD ADD / EDIT
  ===================================================== */

  const openAddModal = async () => {
    if (draftBusyRef.current || draftLoading) return;

    setEditingHousehold(null);

    const initialValues = {
      ...EMPTY_HOUSEHOLD,
      household_code: `HH-${Date.now()}`,
      local_area_id: localAreas.length === 1 ? String(localAreas[0].id) : "",
    };

    const opened = await startDraft({
      kind: "household",
      parentId: "new",
      recordId: "new",
      initialValues,
    });

    if (opened) setShowModal(true);
  };

  const openEditModal = async (household) => {
    if (draftBusyRef.current || draftLoading) return;

    setEditingHousehold(household);

    const initialValues = {
      household_code: household.household_code || "",
      household_head: household.household_head || "",
      contact_number: household.contact_number || "",
      address: household.address || "",
      local_area_id:
        household.local_area_id != null ? String(household.local_area_id) : "",
    };

    const opened = await startDraft({
      kind: "household",
      parentId: household.id,
      recordId: household.id,
      initialValues,
    });

    if (opened) {
      setShowModal(true);
    } else {
      setEditingHousehold(null);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      draftValuesRef.current = next;
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      savingHousehold ||
      draftLoading ||
      draftBusyRef.current ||
      activeDraft?.kind !== "household"
    ) {
      return;
    }

    if (!form.household_head.trim()) {
      alert("Please enter the household head.");
      return;
    }

    if (
      !localAreas.some((area) => String(area.id) === String(form.local_area_id))
    ) {
      alert("Please select an assigned Purok/Sitio.");
      return;
    }

    draftBusyRef.current = true;
    setDraftBusy(true);
    setSavingHousehold(true);
    stopDraftTimer();

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

      await clearSubmittedDraft("household");

      setShowModal(false);
      setEditingHousehold(null);

      await updateLocal();
    } catch (error) {
      if (savedLocally) {
        setShowModal(false);
        setEditingHousehold(null);
        setSyncError(
          `Record saved locally, but refreshing failed: ${error.message}`,
        );
      } else {
        alert(error.message || "Unable to save household locally.");
      }
    } finally {
      draftBusyRef.current = false;
      setDraftBusy(false);
      setSavingHousehold(false);
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Delete this household? Deletion may fail during sync if other records reference it.",
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
     VIEW HOUSEHOLD
  ===================================================== */

  const viewHousehold = async (household) => {
    setSelectedHousehold(household);
    setShowDetailsModal(true);

    await fetchResidents(household.id);
  };

  const closeDetailsModal = () => {
    if (showResidentModal) return;

    setShowDetailsModal(false);
    setSelectedHousehold(null);
    setResidents([]);
  };

  /* =====================================================
     RESIDENT ADD / EDIT
  ===================================================== */

  const openAddResidentModal = async () => {
    if (!selectedHousehold || draftBusyRef.current || draftLoading) {
      return;
    }

    setEditingResident(null);

    const opened = await startDraft({
      kind: "resident",
      parentId: selectedHousehold.id,
      recordId: "new",
      initialValues: { ...EMPTY_RESIDENT },
    });

    if (opened) setShowResidentModal(true);
  };

  const openEditResidentModal = async (resident) => {
    if (!selectedHousehold || draftBusyRef.current || draftLoading) {
      return;
    }

    setEditingResident(resident);

    const initialValues = {
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

    const opened = await startDraft({
      kind: "resident",
      parentId: selectedHousehold.id,
      recordId: resident.id,
      initialValues,
    });

    if (opened) {
      setShowResidentModal(true);
    } else {
      setEditingResident(null);
    }
  };

  const handleResidentChange = (event) => {
    const { name, value, type, checked } = event.target;

    setResidentForm((previous) => {
      const next = {
        ...previous,
        [name]: type === "checkbox" ? checked : value,
      };

      draftValuesRef.current = next;
      return next;
    });
  };

  const closeResidentModal = () => {
    if (savingResident) return;
    void closeDraftForm("resident");
  };

  /* =====================================================
     SAVE RESIDENT
  ===================================================== */

  const handleResidentSubmit = async (event) => {
    event.preventDefault();

    if (
      !selectedHousehold ||
      savingResident ||
      draftLoading ||
      draftBusyRef.current ||
      activeDraft?.kind !== "resident"
    ) {
      return;
    }

    if (
      !residentForm.first_name.trim() ||
      !residentForm.last_name.trim() ||
      !residentForm.birth_date
    ) {
      alert("Please enter first name, last name, and birth date.");
      return;
    }

    draftBusyRef.current = true;
    setDraftBusy(true);
    setSavingResident(true);
    stopDraftTimer();

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
          birth_date: residentForm.birth_date,
          civil_status: residentForm.civil_status || null,
          relationship_to_head:
            residentForm.relationship_to_head.trim() || null,
          contact_number: residentForm.contact_number.trim() || null,
          is_household_head: Boolean(residentForm.is_household_head),
        },
      );

      savedLocally = true;

      await clearSubmittedDraft("resident");

      setShowResidentModal(false);
      setEditingResident(null);
      setResidentForm({ ...EMPTY_RESIDENT });

      await updateLocal(householdId);
    } catch (error) {
      if (savedLocally) {
        setShowResidentModal(false);
        setEditingResident(null);
        setSyncError(
          `Resident saved locally, but refreshing failed: ${error.message}`,
        );
      } else {
        alert(error.message || "Unable to save resident locally.");
      }
    } finally {
      draftBusyRef.current = false;
      setDraftBusy(false);
      setSavingResident(false);
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
      await deleteResidentLocal(userId, selectedHousehold.id, resident.id);

      await updateLocal(selectedHousehold.id);
    } catch (error) {
      alert(error.message);
    }
  };

  /* =====================================================
     FILTER HOUSEHOLDS
  ===================================================== */

  const filteredHouseholds = households.filter((household) => {
    const searchText = search.toLowerCase();

    return (
      household.household_code?.toLowerCase().includes(searchText) ||
      household.household_head?.toLowerCase().includes(searchText) ||
      household.local_areas?.name?.toLowerCase().includes(searchText)
    );
  });

  /* =====================================================
     DRAFT STATUS UI
  ===================================================== */

  const renderDraftStatus = (kind) => {
    if (draftLoading) {
      return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          Checking for saved drafts...
        </div>
      );
    }

    if (activeDraft?.kind !== kind) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
        <div className="flex items-start gap-2">
          <Clock3 size={18} className="mt-0.5 text-teal-700" />

          <div>
            <p className="text-sm font-medium text-teal-800">
              {draftStatus || "Automatic draft saving enabled"}
            </p>

            {draftSavedAt && (
              <p className="mt-1 text-xs text-teal-700">
                Last saved: {formatDraftTime(draftSavedAt)}
              </p>
            )}

            <p className="mt-1 text-xs text-gray-600">
              Drafts stay on this device until submitted or discarded.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={draftBusy || savingHousehold || savingResident}
          onClick={() => discardDraft(kind)}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 size={14} />
          Discard Draft
        </button>
      </div>
    );
  };

  if (!user || user.role !== "bhw") {
    return (
      <DashboardLayout>
        <div className="rounded-xl border bg-white p-6 text-red-600">
          A valid BHW session is required to access this page.
        </div>
      </DashboardLayout>
    );
  }

  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* OFFLINE STATUS */}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <div
            className={`flex items-center gap-2 font-semibold ${
              online ? "text-green-700" : "text-amber-700"
            }`}
          >
            {online ? <Cloud size={18} /> : <CloudOff size={18} />}

            <span>
              {online ? "Online" : "Offline — changes are saved on this device"}
            </span>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
            {pending} pending change
            {pending === 1 ? "" : "s"}
          </span>

          <button
            type="button"
            onClick={doSync}
            disabled={!online || syncing}
            className={buttonPrimary}
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          <button
            type="button"
            onClick={fetchHouseholds}
            disabled={!online || syncing}
            className={buttonSecondary}
          >
            Refresh
          </button>

          {syncError && (
            <p role="alert" className="w-full text-sm text-red-600">
              {syncError}
            </p>
          )}
        </div>

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              Households
            </h2>

            <p className="mt-1 text-gray-500">
              Manage households in your assigned area.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            disabled={draftLoading || draftBusy}
            className={buttonPrimary}
          >
            <Plus size={18} />
            Add Household
          </button>
        </div>

        {/* ASSIGNED AREAS */}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
              <Home size={20} className="text-teal-600" />
            </div>

            <div>
              <p className="text-sm text-gray-500">Assigned Purok/Sitio</p>

              <div className="mt-2 flex flex-wrap gap-2">
                {localAreas.length > 0 ? (
                  localAreas.map((area) => (
                    <span
                      key={area.id}
                      className="rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700"
                    >
                      {area.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">
                    No assigned areas
                  </span>
                )}
              </div>
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
            placeholder="Search households..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} py-3 pl-10`}
          />
        </div>

        {/* HOUSEHOLD TABLE */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading households...
            </div>
          ) : filteredHouseholds.length === 0 ? (
            <div className="p-10 text-center">
              <Home size={40} className="mx-auto text-gray-300" />

              <p className="mt-3 text-gray-500">No households found.</p>

              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                <Plus size={16} />
                Add your first household
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    {[
                      "Household",
                      "Household Head",
                      "Purok/Sitio",
                      "Members",
                      "Contact",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-6 py-4 text-left font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}

                    <th className="px-6 py-4 text-right font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredHouseholds.map((household) => (
                    <tr key={household.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {household.household_code}
                      </td>

                      <td className="px-6 py-4 text-gray-700">
                        {household.household_head}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {household.local_areas?.name || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users size={16} />
                          {household.resident_count ?? 0}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {household.contact_number || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => viewHousehold(household)}
                            title="View Household"
                            className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(household)}
                            title="Edit Household"
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Edit size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(household.id)}
                            title="Delete Household"
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =================================================
            ADD / EDIT HOUSEHOLD MODAL
        ================================================= */}

        {showModal && (
          <ModalShell
            title={editingHousehold ? "Edit Household" : "Add Household"}
            subtitle="Enter household information."
            onClose={() => void closeDraftForm("household")}
            maxWidth="max-w-lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {renderDraftStatus("household")}

              <FormField label="Household Code">
                <input
                  type="text"
                  value={form.household_code}
                  readOnly
                  className={`${inputClass} bg-gray-50`}
                />
              </FormField>

              <FormField label="Household Head" required>
                <input
                  type="text"
                  name="household_head"
                  value={form.household_head}
                  onChange={handleChange}
                  placeholder="Enter household head"
                  className={inputClass}
                  required
                />
              </FormField>

              <FormField label="Contact Number">
                <input
                  type="text"
                  name="contact_number"
                  value={form.contact_number}
                  onChange={handleChange}
                  placeholder="09XXXXXXXXX"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Address">
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="House number / street / additional address"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </FormField>

              <FormField label="Purok / Sitio" required>
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
                      {area.name} ({area.type})
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => void closeDraftForm("household")}
                  disabled={draftBusy || savingHousehold}
                  className={buttonSecondary}
                >
                  Save Draft & Close
                </button>

                <button
                  type="submit"
                  disabled={draftBusy || draftLoading || savingHousehold}
                  className={buttonPrimary}
                >
                  <Save size={17} />

                  {savingHousehold
                    ? "Saving..."
                    : editingHousehold
                      ? "Save Changes"
                      : "Add Household"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {/* =================================================
            HOUSEHOLD DETAILS MODAL
        ================================================= */}

        {showDetailsModal && selectedHousehold && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5 md:p-8">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}

              <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
                    <Home size={22} className="text-teal-600" />
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
                  onClick={closeDetailsModal}
                  className="rounded-lg p-2.5 hover:bg-gray-100"
                  title="Close"
                >
                  <X size={22} />
                </button>
              </div>

              {/* CONTENT */}

              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
                {/* HOUSEHOLD INFORMATION */}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                    <h3 className="font-semibold text-gray-800">
                      Household Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Household Code", selectedHousehold.household_code],
                      [
                        "Household Head",
                        selectedHousehold.household_head || "Not assigned",
                      ],
                      ["Purok / Sitio", selectedHousehold.local_areas?.name],
                      [
                        "Barangay",
                        selectedHousehold.local_areas?.barangays?.name,
                      ],
                      ["Contact Number", selectedHousehold.contact_number],
                      ["Address", selectedHousehold.address],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="mb-1 text-xs text-gray-500">{label}</p>

                        <p className="break-words font-medium text-gray-800">
                          {value || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RESIDENTS */}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                        <Users size={20} className="text-green-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Household Members
                        </h3>

                        <p className="text-sm text-gray-500">
                          {residents.length}{" "}
                          {residents.length === 1 ? "resident" : "residents"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={openAddResidentModal}
                      disabled={draftLoading || draftBusy}
                      className={buttonPrimary}
                    >
                      <Plus size={16} />
                      Add Resident
                    </button>
                  </div>

                  {residentsLoading ? (
                    <div className="p-10 text-center text-gray-500">
                      Loading residents...
                    </div>
                  ) : residents.length === 0 ? (
                    <div className="p-10 text-center">
                      <Users size={40} className="mx-auto text-gray-300" />

                      <p className="mt-3 text-gray-500">No residents yet.</p>

                      <button
                        type="button"
                        onClick={openAddResidentModal}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teal-600"
                      >
                        <Plus size={16} />
                        Add First Resident
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-sm">
                        <thead className="border-b border-gray-200 bg-white">
                          <tr>
                            {[
                              "Name",
                              "Sex",
                              "Birth Date",
                              "Civil Status",
                              "Relationship",
                              "Contact",
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="px-5 py-4 text-left font-semibold text-gray-600"
                              >
                                {heading}
                              </th>
                            ))}

                            <th className="px-5 py-4 text-right font-semibold text-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {residents.map((resident) => (
                            <tr key={resident.id} className="hover:bg-gray-50">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50">
                                    <UserRound
                                      size={17}
                                      className="text-teal-600"
                                    />
                                  </div>

                                  <div>
                                    <p className="font-medium text-gray-800">
                                      {resident.first_name}{" "}
                                      {resident.middle_name
                                        ? `${resident.middle_name} `
                                        : ""}
                                      {resident.last_name}
                                    </p>

                                    {resident.is_household_head && (
                                      <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                        Household Head
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.sex}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.birth_date || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.civil_status || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.relationship_to_head || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.contact_number || "—"}
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditResidentModal(resident)
                                    }
                                    title="Edit Resident"
                                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Edit size={17} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteResident(resident)
                                    }
                                    title="Delete Resident"
                                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            ADD / EDIT RESIDENT MODAL
        ================================================= */}

        {showResidentModal && (
          <ModalShell
            title={editingResident ? "Edit Resident" : "Add Resident"}
            subtitle="Enter the resident's information."
            onClose={closeResidentModal}
            maxWidth="max-w-2xl"
            zIndex="z-[60]"
          >
            <form onSubmit={handleResidentSubmit} className="space-y-5 p-6">
              {renderDraftStatus("resident")}

              {/* PERSONAL INFORMATION */}

              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-700">
                  Personal Information
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField label="First Name" required>
                    <input
                      type="text"
                      name="first_name"
                      value={residentForm.first_name}
                      onChange={handleResidentChange}
                      className={inputClass}
                      required
                    />
                  </FormField>

                  <FormField label="Middle Name">
                    <input
                      type="text"
                      name="middle_name"
                      value={residentForm.middle_name}
                      onChange={handleResidentChange}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Last Name" required>
                    <input
                      type="text"
                      name="last_name"
                      value={residentForm.last_name}
                      onChange={handleResidentChange}
                      className={inputClass}
                      required
                    />
                  </FormField>
                </div>
              </div>

              {/* SEX / BIRTH DATE */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Sex" required>
                  <select
                    name="sex"
                    value={residentForm.sex}
                    onChange={handleResidentChange}
                    className={inputClass}
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </FormField>

                <FormField label="Birth Date" required>
                  <input
                    type="date"
                    name="birth_date"
                    value={residentForm.birth_date}
                    onChange={handleResidentChange}
                    className={inputClass}
                    required
                  />
                </FormField>
              </div>

              {/* CIVIL STATUS / RELATIONSHIP */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Civil Status">
                  <select
                    name="civil_status"
                    value={residentForm.civil_status}
                    onChange={handleResidentChange}
                    className={inputClass}
                  >
                    <option value="">Select status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </FormField>

                <FormField label="Relationship to Household Head">
                  <select
                    name="relationship_to_head"
                    value={residentForm.relationship_to_head}
                    onChange={handleResidentChange}
                    className={inputClass}
                  >
                    <option value="">Select relationship</option>

                    {[
                      "Household Head",
                      "Spouse",
                      "Son",
                      "Daughter",
                      "Father",
                      "Mother",
                      "Brother",
                      "Sister",
                      "Grandparent",
                      "Grandchild",
                      "Other Relative",
                      "Non-relative",
                    ].map((relationship) => (
                      <option key={relationship} value={relationship}>
                        {relationship}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* CONTACT NUMBER */}

              <FormField label="Contact Number">
                <input
                  type="text"
                  name="contact_number"
                  value={residentForm.contact_number}
                  onChange={handleResidentChange}
                  placeholder="09XXXXXXXXX"
                  className={inputClass}
                />
              </FormField>

              {/* HOUSEHOLD HEAD */}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name="is_household_head"
                    checked={residentForm.is_household_head}
                    onChange={handleResidentChange}
                    className="mt-1 h-4 w-4 rounded text-teal-600"
                  />

                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Household Head
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Selecting this will make this resident the household head.
                    </p>
                  </div>
                </label>
              </div>

              {/* BUTTONS */}

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={closeResidentModal}
                  disabled={savingResident || draftBusy}
                  className={buttonSecondary}
                >
                  Save Draft & Close
                </button>

                <button
                  type="submit"
                  disabled={savingResident || draftLoading || draftBusy}
                  className={buttonPrimary}
                >
                  <Save size={17} />

                  {savingResident
                    ? "Saving..."
                    : editingResident
                      ? "Update Resident"
                      : "Add Resident"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </DashboardLayout>
  );
}

export default BhwHousehold;
