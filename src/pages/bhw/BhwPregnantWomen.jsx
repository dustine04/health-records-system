import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Baby,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Save,
  Eye,
  UserRound,
  MapPin,
  CalendarDays,
  RefreshCw,
  Wifi,
  WifiOff,
  FileText,
  Clock3,
  AlertCircle,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";

import {
  getPregnancyCache,
  refreshPregnancyCache,
  queuePregnancySave,
  queuePregnancyDelete,
  syncPregnancyQueue,
} from "../../lib/bhwPregnancyOffline";

import {
  bhwPregnancyDraftKey,
  readBhwPregnancyDraft,
  saveBhwPregnancyDraft,
  deleteBhwPregnancyDraft,
} from "../../lib/bhwPregnancyDrafts";

// =========================================================
// HELPERS
// =========================================================

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const emptyForm = () => ({
  resident_id: "",
  family_record_no: "",
  date_of_registration: today(),

  gravida: "",
  para: "",
  term: "",
  preterm: "",
  abortion: "",
  living: "",

  lmp: "",
  edc: "",

  civil_status: "",
  husband_name: "",
  philhealth_no: "",
  blood_type: "",
  facility_name: "",
});

const numberFields = [
  "gravida",
  "para",
  "term",
  "preterm",
  "abortion",
  "living",
];

const ongoingStatuses = ["active", "for_review", "high_risk", "referred"];

const getFullName = (person) => {
  if (!person) return "Unknown";

  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ");
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const calculateAge = (birthDate) => {
  if (!birthDate) return "—";

  const birth = new Date(`${String(birthDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "—";

  const current = new Date();

  let age = current.getFullYear() - birth.getFullYear();

  const monthDifference = current.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && current.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
};

const calculateEdcFromLmp = (lmp) => {
  if (!lmp) return "";

  const [year, month, day] = lmp.split("-").map(Number);

  if (!year || !month || !day) return "";

  const targetMonthIndex = year * 12 + (month - 1) + 9;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;

  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();

  const targetDay = Math.min(day, lastDay);

  return [
    targetYear,
    String(targetMonth + 1).padStart(2, "0"),
    String(targetDay).padStart(2, "0"),
  ].join("-");
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  disabled = false,
  min,
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>

      <input
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        className={`${inputClass} disabled:bg-gray-100`}
      />
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800">
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function FormSection({ title, description, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200">
      <div className="border-b bg-gray-50 px-5 py-4">
        <h4 className="font-semibold text-gray-800">{title}</h4>

        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

// =========================================================
// MAIN COMPONENT
// =========================================================

export default function BhwPregnantWomen() {
  const [user] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [pregnantWomen, setPregnantWomen] = useState([]);
  const [eligibleResidents, setEligibleResidents] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [offlineError, setOfflineError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // =========================================================
  // AUTO-SAVE STATES
  // =========================================================

  const [draftKey, setDraftKey] = useState(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);

  const draftRef = useRef(null);
  const draftTimer = useRef(null);
  const draftRequest = useRef(0);
  const savingRef = useRef(false);

  // =========================================================
  // CACHE
  // =========================================================

  const applyCache = useCallback((cache) => {
    setLocalAreas(cache?.areas || []);
    setEligibleResidents(cache?.residents || []);
    setPregnantWomen(cache?.records || []);
    setPending(cache?.pending || 0);
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      applyCache(await getPregnancyCache(user.id));

      if (navigator.onLine) {
        try {
          const updated = await refreshPregnancyCache(user.id);
          applyCache(updated);
          setOfflineError("");
        } catch (error) {
          setOfflineError(`Using locally cached data: ${error.message}`);
        }
      }
    } catch (error) {
      console.error("Error loading pregnancy cache:", error);
      setOfflineError(error.message || "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, applyCache]);

  const syncNow = useCallback(async () => {
    if (!user?.id || !navigator.onLine || syncing) return;

    setSyncing(true);
    setOfflineError("");

    try {
      await syncPregnancyQueue(user.id);

      const updated = await refreshPregnancyCache(user.id);
      applyCache(updated);
    } catch (error) {
      console.error("Pregnancy synchronization failed:", error);

      setOfflineError(`Synchronization stopped: ${error.message}`);

      try {
        applyCache(await getPregnancyCache(user.id));
      } catch (cacheError) {
        console.error(cacheError);
      }
    } finally {
      setSyncing(false);
    }
  }, [user?.id, syncing, applyCache]);

  useEffect(() => {
    if (!user?.id) return;

    loadData();

    const handleOnline = () => {
      setOnline(true);
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user?.id, loadData]);

  // =========================================================
  // AVAILABLE WOMEN
  // =========================================================

  const availableWomen = useMemo(() => {
    if (editingRecord) {
      return eligibleResidents.filter(
        (resident) => String(resident.id) === String(editingRecord.resident_id),
      );
    }

    const registeredIds = new Set(
      pregnantWomen
        .filter((record) => ongoingStatuses.includes(record.status || "active"))
        .map((record) => String(record.resident_id)),
    );

    return eligibleResidents.filter(
      (resident) => !registeredIds.has(String(resident.id)),
    );
  }, [eligibleResidents, pregnantWomen, editingRecord]);

  // =========================================================
  // DRAFT HELPERS
  // =========================================================

  const clearDraftTimer = () => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }
  };

  const restoreDraft = async (recordId, initialData) => {
    if (!user?.id) return;

    const requestId = ++draftRequest.current;

    clearDraftTimer();

    setDraftReady(false);
    setDraftLoading(true);
    setDraftStatus("Checking saved draft...");

    const key = bhwPregnancyDraftKey(user, recordId);

    try {
      const savedDraft = await readBhwPregnancyDraft(key);

      if (requestId !== draftRequest.current) return;

      let values = initialData;

      if (savedDraft?.data) {
        const savedTime = savedDraft.savedAt
          ? new Date(savedDraft.savedAt).toLocaleString()
          : "previously";

        const shouldRestore = window.confirm(
          `An unfinished pregnancy registration draft was found.\n\nLast saved: ${savedTime}\n\nWould you like to restore it?`,
        );

        if (shouldRestore) {
          values = {
            ...initialData,
            ...savedDraft.data,
          };

          setDraftStatus("Previous draft restored");
          setDraftSavedAt(savedDraft.savedAt);
        } else {
          await deleteBhwPregnancyDraft(key);
          setDraftStatus("New draft ready");
          setDraftSavedAt(null);
        }
      } else {
        setDraftStatus("Auto-save enabled");
        setDraftSavedAt(null);
      }

      if (requestId !== draftRequest.current) return;

      draftRef.current = { key, data: values };

      setDraftKey(key);
      setForm(values);
      setDraftReady(true);
    } catch (error) {
      console.error("Draft restore error:", error);

      if (requestId !== draftRequest.current) return;

      draftRef.current = {
        key,
        data: initialData,
      };

      setDraftKey(key);
      setForm(initialData);
      setDraftReady(true);
      setDraftStatus("Draft storage unavailable");
    } finally {
      if (requestId === draftRequest.current) {
        setDraftLoading(false);
      }
    }
  };

  // =========================================================
  // AUTOMATIC SAVE WHEN FORM CHANGES
  // =========================================================

  useEffect(() => {
    if (
      !showModal ||
      !draftReady ||
      !draftKey ||
      !user?.id ||
      savingRef.current
    ) {
      return;
    }

    clearDraftTimer();

    draftRef.current = {
      key: draftKey,
      data: form,
    };

    setDraftStatus("Saving draft...");

    draftTimer.current = setTimeout(async () => {
      const snapshot = draftRef.current;

      if (!snapshot || snapshot.key !== draftKey) return;

      try {
        await saveBhwPregnancyDraft(user, snapshot.key, snapshot.data);

        if (draftRef.current?.key === snapshot.key) {
          const savedAt = new Date().toISOString();

          setDraftSavedAt(savedAt);
          setDraftStatus("Draft saved on this device");
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
        setDraftStatus("Unable to save draft");
      }
    }, 500);

    return clearDraftTimer;
  }, [form, showModal, draftReady, draftKey, user]);

  // =========================================================
  // SAVE IMMEDIATELY WHEN FORM CLOSES
  // =========================================================

  const closeForm = async () => {
    if (saving || draftLoading) return;

    clearDraftTimer();

    if (draftKey && user?.id && draftReady) {
      try {
        await saveBhwPregnancyDraft(user, draftKey, form);
      } catch (error) {
        console.error("Unable to preserve unfinished form:", error);

        alert(
          "Your unfinished form could not be saved. Please try again before closing.",
        );

        return;
      }
    }

    ++draftRequest.current;

    draftRef.current = null;

    setDraftKey(null);
    setDraftReady(false);
    setDraftStatus("");
    setDraftSavedAt(null);

    setShowModal(false);
    setEditingRecord(null);
  };

  // =========================================================
  // DISCARD UNFINISHED DRAFT
  // =========================================================

  const discardDraft = async () => {
    if (!draftKey || !user?.id) return;

    if (
      !window.confirm(
        "Discard this unfinished registration draft? All unsaved changes will be lost.",
      )
    ) {
      return;
    }

    clearDraftTimer();

    try {
      await deleteBhwPregnancyDraft(draftKey);

      ++draftRequest.current;

      draftRef.current = null;

      setDraftKey(null);
      setDraftReady(false);
      setDraftStatus("");
      setDraftSavedAt(null);

      setShowModal(false);
      setEditingRecord(null);
    } catch (error) {
      console.error("Unable to discard draft:", error);
      alert(error.message || "Unable to discard draft.");
    }
  };

  // =========================================================
  // OPEN ADD MODAL
  // =========================================================

  const openAddModal = async () => {
    setEditingRecord(null);
    setShowModal(true);

    await restoreDraft("new", emptyForm());
  };

  // =========================================================
  // OPEN EDIT MODAL
  // =========================================================

  const openEditModal = async (record) => {
    setEditingRecord(record);
    setShowModal(true);

    const initialData = {
      resident_id: String(record.resident_id ?? ""),
      family_record_no: record.family_record_no || "",
      date_of_registration: record.date_of_registration || "",

      gravida: record.gravida != null ? String(record.gravida) : "",

      para: record.para != null ? String(record.para) : "",

      term: record.term != null ? String(record.term) : "",

      preterm: record.preterm != null ? String(record.preterm) : "",

      abortion: record.abortion != null ? String(record.abortion) : "",

      living: record.living != null ? String(record.living) : "",

      lmp: record.lmp || "",
      edc: record.edc || "",

      civil_status: record.civil_status || "",
      husband_name: record.husband_name || "",
      philhealth_no: record.philhealth_no || "",
      blood_type: record.blood_type || "",
      facility_name: record.facility_name || "",
    };

    await restoreDraft(record.id, initialData);
  };

  // =========================================================
  // HANDLE FORM CHANGES
  // =========================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => {
      const updated = {
        ...previous,
        [name]: value,
      };

      if (name === "lmp") {
        updated.edc = calculateEdcFromLmp(value);
      }

      draftRef.current = draftKey ? { key: draftKey, data: updated } : null;

      return updated;
    });
  };

  // =========================================================
  // SAVE REGISTRATION TO OFFLINE QUEUE
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user?.id || saving) return;

    if (!form.resident_id) {
      alert("Please select a woman.");
      return;
    }

    if (!form.date_of_registration) {
      alert("Please enter the registration date.");
      return;
    }

    if (
      !editingRecord &&
      pregnantWomen.some(
        (record) =>
          String(record.resident_id) === String(form.resident_id) &&
          ongoingStatuses.includes(record.status || "active"),
      )
    ) {
      alert(
        "This woman already has an ongoing pregnancy. Complete that episode before registering another.",
      );
      return;
    }

    const payload = {
      resident_id: Number(form.resident_id),
      family_record_no: form.family_record_no.trim() || null,
      date_of_registration: form.date_of_registration,

      gravida: form.gravida !== "" ? Number(form.gravida) : null,

      para: form.para !== "" ? Number(form.para) : null,

      term: form.term !== "" ? Number(form.term) : null,

      preterm: form.preterm !== "" ? Number(form.preterm) : null,

      abortion: form.abortion !== "" ? Number(form.abortion) : null,

      living: form.living !== "" ? Number(form.living) : null,

      lmp: form.lmp || null,
      edc: form.edc || null,

      civil_status: form.civil_status || null,
      husband_name: form.husband_name.trim() || null,
      philhealth_no: form.philhealth_no.trim() || null,
      blood_type: form.blood_type || null,
      facility_name: form.facility_name.trim() || null,

      ...(!editingRecord
        ? {
            status: "active",
            created_by: user.id,
          }
        : {}),

      updated_at: new Date().toISOString(),
    };

    try {
      setSaving(true);
      savingRef.current = true;
      clearDraftTimer();

      // Queueing is the submission point.
      // The queue itself persists the submitted record locally.
      await queuePregnancySave(user.id, editingRecord, payload);

      // Delete the unfinished draft only after queueing succeeds.
      if (draftKey) {
        try {
          await deleteBhwPregnancyDraft(draftKey);
        } catch (error) {
          console.error(
            "Registration queued, but draft cleanup failed:",
            error,
          );
        }
      }

      ++draftRequest.current;

      draftRef.current = null;

      setDraftKey(null);
      setDraftReady(false);
      setDraftStatus("");
      setDraftSavedAt(null);

      setShowModal(false);
      setEditingRecord(null);

      applyCache(await getPregnancyCache(user.id));

      alert(
        "Pregnancy registration saved locally. Pending changes will synchronize when online.",
      );

      if (navigator.onLine) {
        await syncNow();
      }
    } catch (error) {
      console.error("Error saving pregnancy:", error);

      alert(error.message || "Failed to save pregnancy registration.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE RECORD
  // =========================================================

  const handleDelete = async (record) => {
    const name = getFullName(record.resident);

    if (
      !window.confirm(
        `Are you sure you want to delete the pregnancy record of ${name}?`,
      )
    ) {
      return;
    }

    try {
      await queuePregnancyDelete(user.id, record);

      applyCache(await getPregnancyCache(user.id));

      if (navigator.onLine) {
        await syncNow();
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to queue deletion.");
    }
  };

  // =========================================================
  // FILTER
  // =========================================================

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return pregnantWomen;

    return pregnantWomen.filter((record) => {
      const resident = record.resident;

      return [
        getFullName(resident),
        record.family_record_no,
        resident?.households?.household_code,
        resident?.households?.local_areas?.name,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [pregnantWomen, search]);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="rounded-xl border bg-white p-6">
          Please log in to access pregnancy registration.
        </div>
      </DashboardLayout>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              Pregnant Women
            </h2>

            <p className="mt-1 text-gray-500">
              Register and manage pregnant women in your assigned areas.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus size={18} />
            Register Pregnancy
          </button>
        </div>

        {/* OFFLINE STATUS */}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm">
          <span
            className={`inline-flex items-center gap-2 font-semibold ${
              online ? "text-green-700" : "text-amber-700"
            }`}
          >
            {online ? <Wifi size={18} /> : <WifiOff size={18} />}
            {online ? "Online" : "Offline"}
          </span>

          <span className="text-gray-600">
            Pending changes: <strong>{pending}</strong>
          </span>

          <button
            type="button"
            onClick={syncNow}
            disabled={!online || syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />

            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          {offlineError && (
            <p className="w-full text-amber-700">{offlineError}</p>
          )}
        </div>

        {/* ASSIGNED AREAS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">
              <MapPin size={20} className="text-teal-600" />
            </div>

            <div>
              <p className="text-sm text-gray-500">Assigned Purok / Sitio</p>

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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pregnant women..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* RECORD TABLE */}

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading pregnant women...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-10 text-center">
              <Baby size={42} className="mx-auto text-gray-300" />

              <p className="mt-3 text-gray-500">No pregnancy records found.</p>

              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teal-600"
              >
                <Plus size={16} />
                Register a pregnant woman
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="border-b bg-gray-50 text-left">
                  <tr>
                    {[
                      "Name",
                      "Age",
                      "Household",
                      "Purok / Sitio",
                      "EDC",
                      "Record No.",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-4 font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredRecords.map((record) => {
                    const resident = record.resident;

                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-50">
                              <UserRound size={17} className="text-pink-600" />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {getFullName(resident)}
                              </p>

                              <p className="text-xs text-gray-500">
                                {resident?.contact_number || "No contact"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {calculateAge(resident?.birth_date)}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {resident?.households?.household_code || "—"}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {resident?.households?.local_areas?.name || "—"}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {formatDate(record.edc)}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {record.family_record_no || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowViewModal(true);
                              }}
                              title="View"
                              className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"
                            >
                              <Eye size={18} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(record)}
                              title="Edit"
                              className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                            >
                              <Edit size={18} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(record)}
                              title="Delete"
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =====================================================
            ADD / EDIT REGISTRATION MODAL
        ===================================================== */}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              {/* MODAL HEADER */}

              <div className="flex items-center justify-between border-b px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingRecord
                      ? "Edit Pregnancy Registration"
                      : "Pregnant Woman Registration"}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Enter the information from the antenatal care record.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving || draftLoading}
                  className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* AUTOSAVE INDICATOR */}

              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-teal-50 px-6 py-3">
                <div className="flex items-center gap-2 text-sm text-teal-800">
                  <Clock3 size={17} />

                  <span>{draftStatus || "Auto-save enabled"}</span>

                  {draftSavedAt && (
                    <span className="text-xs text-teal-700">
                      ({new Date(draftSavedAt).toLocaleTimeString()})
                    </span>
                  )}
                </div>

                {draftKey && (
                  <button
                    type="button"
                    onClick={discardDraft}
                    disabled={saving || draftLoading}
                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    Discard draft
                  </button>
                )}
              </div>

              {draftLoading ? (
                <div className="p-10 text-center text-gray-500">
                  Loading registration draft...
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6 p-6">
                  {/* WOMAN INFORMATION */}

                  <FormSection
                    title="Woman Information"
                    description="Select a female resident from your assigned area."
                  >
                    <label className={labelClass}>Woman *</label>

                    <select
                      name="resident_id"
                      value={form.resident_id}
                      onChange={handleChange}
                      disabled={!!editingRecord}
                      required
                      className={`${inputClass} disabled:bg-gray-100`}
                    >
                      <option value="">Select woman</option>

                      {availableWomen.map((resident) => (
                        <option key={resident.id} value={resident.id}>
                          {getFullName(resident)}
                          {" — "}
                          {resident.birth_date || "No birth date"}
                          {" — "}
                          {resident.households?.household_code || ""}
                        </option>
                      ))}
                    </select>

                    {form.resident_id &&
                      (() => {
                        const resident = eligibleResidents.find(
                          (item) =>
                            String(item.id) === String(form.resident_id),
                        );

                        if (!resident) return null;

                        return (
                          <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-teal-100 bg-teal-50 p-4 sm:grid-cols-3">
                            <DetailItem
                              label="Date of Birth"
                              value={formatDate(resident.birth_date)}
                            />

                            <DetailItem
                              label="Age"
                              value={calculateAge(resident.birth_date)}
                            />

                            <DetailItem
                              label="Household"
                              value={resident.households?.household_code}
                            />

                            <DetailItem
                              label="Address"
                              value={resident.households?.address}
                            />

                            <DetailItem
                              label="Purok / Sitio"
                              value={resident.households?.local_areas?.name}
                            />
                          </div>
                        );
                      })()}
                  </FormSection>

                  {/* REGISTRATION INFORMATION */}

                  <FormSection title="Registration Information">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        label="Family Record No."
                        name="family_record_no"
                        value={form.family_record_no}
                        onChange={handleChange}
                        placeholder="Family record number"
                      />

                      <FormField
                        label="Date of Registration *"
                        name="date_of_registration"
                        type="date"
                        value={form.date_of_registration}
                        onChange={handleChange}
                        required
                      />

                      <div>
                        <label className={labelClass}>Civil Status</label>

                        <select
                          name="civil_status"
                          value={form.civil_status}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select status</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Widowed">Widowed</option>
                          <option value="Separated">Separated</option>
                          <option value="Divorced">Divorced</option>
                        </select>
                      </div>

                      <FormField
                        label="Name of Husband"
                        name="husband_name"
                        value={form.husband_name}
                        onChange={handleChange}
                        placeholder="Name of husband"
                      />

                      <FormField
                        label="PhilHealth No."
                        name="philhealth_no"
                        value={form.philhealth_no}
                        onChange={handleChange}
                        placeholder="PhilHealth number"
                      />

                      <div>
                        <label className={labelClass}>Blood Type</label>

                        <select
                          name="blood_type"
                          value={form.blood_type}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select blood type</option>

                          {[
                            "A+",
                            "A-",
                            "B+",
                            "B-",
                            "AB+",
                            "AB-",
                            "O+",
                            "O-",
                            "Unknown",
                          ].map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          label="Name of Facility"
                          name="facility_name"
                          value={form.facility_name}
                          onChange={handleChange}
                          placeholder="Health facility"
                        />
                      </div>
                    </div>
                  </FormSection>

                  {/* OBSTETRIC HISTORY */}

                  <FormSection
                    title="Obstetric History"
                    description="Based on the G / P (F / P / A / L) section of the antenatal form."
                  >
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        ["gravida", "Gravida (G)"],
                        ["para", "Para (P)"],
                        ["term", "Full Term (F)"],
                        ["preterm", "Preterm (P)"],
                        ["abortion", "Abortion (A)"],
                        ["living", "Living (L)"],
                      ].map(([name, label]) => (
                        <FormField
                          key={name}
                          label={label}
                          name={name}
                          type="number"
                          min="0"
                          value={form[name]}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  </FormSection>

                  {/* PREGNANCY DATES */}

                  <FormSection title="Pregnancy Information">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <FormField
                          label="LMP"
                          name="lmp"
                          type="date"
                          value={form.lmp}
                          onChange={handleChange}
                        />

                        <p className="mt-1 text-xs text-gray-500">
                          Last Menstrual Period. Selecting this date
                          automatically calculates EDC.
                        </p>
                      </div>

                      <div>
                        <FormField
                          label="EDC"
                          name="edc"
                          type="date"
                          value={form.edc}
                          onChange={handleChange}
                        />

                        <p className="mt-1 text-xs text-gray-500">
                          Expected Date of Confinement. Calculated as nine
                          calendar months after LMP; adjust if clinically
                          confirmed otherwise.
                        </p>
                      </div>
                    </div>
                  </FormSection>

                  {/* ACTIONS */}

                  <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                    <button
                      type="button"
                      onClick={closeForm}
                      disabled={saving}
                      className="rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Save Draft & Close
                    </button>

                    <button
                      type="submit"
                      disabled={saving || !draftReady}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      <Save size={17} />

                      {saving
                        ? "Saving..."
                        : editingRecord
                          ? "Update Registration"
                          : "Register Pregnancy"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* =====================================================
            VIEW MODAL
        ===================================================== */}

        {showViewModal && selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-pink-50 p-3">
                    <Baby size={22} className="text-pink-600" />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">Pregnancy Record</h3>

                    <p className="text-sm text-gray-500">
                      {getFullName(selectedRecord.resident)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRecord(null);
                  }}
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <FormSection title="Woman Information">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <DetailItem
                      label="Name"
                      value={getFullName(selectedRecord.resident)}
                    />

                    <DetailItem
                      label="Date of Birth"
                      value={formatDate(selectedRecord.resident?.birth_date)}
                    />

                    <DetailItem
                      label="Age"
                      value={calculateAge(selectedRecord.resident?.birth_date)}
                    />

                    <DetailItem
                      label="Civil Status"
                      value={selectedRecord.civil_status}
                    />

                    <DetailItem
                      label="Husband"
                      value={selectedRecord.husband_name}
                    />

                    <DetailItem
                      label="Contact"
                      value={selectedRecord.resident?.contact_number}
                    />

                    <DetailItem
                      label="Household"
                      value={
                        selectedRecord.resident?.households?.household_code
                      }
                    />

                    <DetailItem
                      label="Address"
                      value={selectedRecord.resident?.households?.address}
                    />

                    <DetailItem
                      label="Purok / Sitio"
                      value={
                        selectedRecord.resident?.households?.local_areas?.name
                      }
                    />
                  </div>
                </FormSection>

                <FormSection title="Pregnancy Information">
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                    {numberFields.map((field) => (
                      <DetailItem
                        key={field}
                        label={field.charAt(0).toUpperCase() + field.slice(1)}
                        value={selectedRecord[field]}
                      />
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-5 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem
                      label="LMP"
                      value={formatDate(selectedRecord.lmp)}
                    />

                    <DetailItem
                      label="EDC"
                      value={formatDate(selectedRecord.edc)}
                    />

                    <DetailItem
                      label="Blood Type"
                      value={selectedRecord.blood_type}
                    />

                    <DetailItem
                      label="PhilHealth No."
                      value={selectedRecord.philhealth_no}
                    />
                  </div>
                </FormSection>

                <FormSection title="Facility">
                  <DetailItem
                    label="Name of Facility"
                    value={selectedRecord.facility_name}
                  />
                </FormSection>

                <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4">
                  <CalendarDays size={20} className="text-teal-600" />

                  <DetailItem
                    label="Date of Registration"
                    value={formatDate(selectedRecord.date_of_registration)}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRecord(null);
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
