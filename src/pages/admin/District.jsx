import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Map,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  Clock3,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

import {
  getDistrictCache,
  saveDistrictCache,
  pendingDistrictActions,
  queueDistrictRename,
  syncDistrictActions,
} from "../../lib/adminDistrictOffline";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export default function District() {
  const [districts, setDistricts] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [online, setOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState([]);
  const [cachedAt, setCachedAt] = useState(null);
  const [notice, setNotice] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingDistrict, setEditingDistrict] = useState(null);
  const [deletingDistrict, setDeletingDistrict] = useState(null);
  const [name, setName] = useState("");

  const currentUser = getCurrentUser();
  const validAdmin = currentUser?.id && currentUser.role === "cho_admin";

  const refreshPending = useCallback(async () => {
    const user = getCurrentUser();
    if (!user?.id || user.role !== "cho_admin") return;

    const actions = await pendingDistrictActions(user);
    setPendingActions(actions);
  }, []);

  const fetchDistricts = useCallback(async () => {
    const user = getCurrentUser();

    if (!user?.id || user.role !== "cho_admin") {
      setNotice("Please sign in using your CHO Admin account.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const cached = await getDistrictCache(user);

      if (cached) {
        setDistricts(cached.districts || []);
        setCachedAt(cached.cachedAt);
      }

      if (!navigator.onLine) {
        setNotice(
          cached
            ? "Offline mode: showing previously cached districts."
            : "No cached districts available. Connect to the internet first.",
        );
        return;
      }

      const { data, error } = await supabase
        .from("districts")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      const rows = data || [];
      setDistricts(rows);

      await saveDistrictCache(user, rows);
      setCachedAt(new Date().toISOString());
      setNotice("");
    } catch (error) {
      console.error("Failed to load districts:", error);
      setNotice(
        `Unable to refresh districts: ${error.message}. Cached records may still be available.`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const user = getCurrentUser();

    if (!user?.id || user.role !== "cho_admin") return;

    if (!navigator.onLine) {
      setNotice("Offline. Pending changes remain on this device.");
      return;
    }

    setSyncing(true);

    try {
      const count = await syncDistrictActions(user);

      await refreshPending();
      await fetchDistricts();

      setNotice(
        count > 0
          ? `${count} district change(s) synchronized successfully.`
          : "Synchronization complete. No pending changes.",
      );
    } catch (error) {
      await refreshPending();
      setNotice(
        `Synchronization stopped: ${error.message}. Unsynchronized changes remain queued.`,
      );
    } finally {
      setSyncing(false);
    }
  }, [fetchDistricts, refreshPending]);

  useEffect(() => {
    fetchDistricts();
    refreshPending();
  }, [fetchDistricts, refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncNow();
    };

    const handleOffline = () => {
      setOnline(false);
      setNotice("Offline mode enabled. District renames can be queued.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  const pendingDistrictIds = useMemo(
    () => new Set(pendingActions.map((action) => String(action.districtId))),
    [pendingActions],
  );

  const filteredDistricts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return districts.filter((district) =>
      (district.name || "").toLowerCase().includes(query),
    );
  }, [districts, search]);

  const handleAdd = () => {
    if (!online) {
      setNotice("Adding a new district requires an internet connection.");
      return;
    }

    setEditingDistrict(null);
    setName("");
    setShowModal(true);
  };

  const handleEdit = (district) => {
    if (pendingDistrictIds.has(String(district.id))) {
      setNotice(
        "This district has a pending rename. Synchronize it before editing again.",
      );
      return;
    }

    setEditingDistrict(district);
    setName(district.name || "");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingDistrict(null);
    setName("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const user = getCurrentUser();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNotice("Please enter a district name.");
      return;
    }

    if (!validAdmin || saving || syncing) return;

    if (!editingDistrict && !navigator.onLine) {
      setNotice("Creating districts requires an internet connection.");
      return;
    }

    if (editingDistrict && trimmedName === editingDistrict.name) {
      closeModal();
      return;
    }

    setSaving(true);

    try {
      if (editingDistrict) {
        await queueDistrictRename(user, editingDistrict, trimmedName);

        await refreshPending();
        closeModal();

        if (navigator.onLine) {
          await syncNow();
        } else {
          setNotice(
            "District rename saved offline. The official name will change after successful synchronization.",
          );
        }
      } else {
        const { data, error } = await supabase
          .from("districts")
          .insert([{ name: trimmedName }])
          .select("*")
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error("Supabase did not confirm district creation.");
        }

        closeModal();
        await fetchDistricts();
        setNotice("District created successfully.");
      }
    } catch (error) {
      console.error("Error saving district:", error);
      setNotice(error.message || "Failed to save district.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (district) => {
    if (!navigator.onLine) {
      setNotice("Deleting districts requires an internet connection.");
      return;
    }

    if (pendingDistrictIds.has(String(district.id))) {
      setNotice(
        "Synchronize the pending rename before deleting this district.",
      );
      return;
    }

    setDeletingDistrict(district);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingDistrict || saving || syncing) return;

    if (!navigator.onLine) {
      setNotice("Deleting districts requires an internet connection.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("districts")
        .delete()
        .eq("id", deletingDistrict.id)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          "The server did not confirm deletion. Check your permissions.",
        );
      }

      setShowDeleteModal(false);
      setDeletingDistrict(null);

      await fetchDistricts();
      setNotice("District deleted successfully.");
    } catch (error) {
      console.error("Error deleting district:", error);

      setNotice(
        error.code === "23503"
          ? "This district cannot be deleted because other records reference it."
          : error.message || "Failed to delete district.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!validAdmin) {
    return (
      <DashboardLayout>
        <div className="rounded-xl border bg-white p-8 text-red-600">
          Please sign in using your CHO Admin account.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Districts</h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage health center districts with offline viewing and pending
              rename synchronization.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                online
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? "Online" : "Offline"}
            </span>

            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Clock3 size={16} />
              {pendingActions.length} Pending
            </span>

            <button
              type="button"
              onClick={syncNow}
              disabled={!online || syncing || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>

            <button
              type="button"
              onClick={fetchDistricts}
              disabled={loading || syncing || saving}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!online || saving || syncing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus size={18} />
              Add District
            </button>
          </div>
        </div>

        {/* STATUS MESSAGE */}
        {notice && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="flex-1">{notice}</p>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notice"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {cachedAt && (
          <p className="text-xs text-gray-500">
            Last cached: {new Date(cachedAt).toLocaleString()}
          </p>
        )}

        {/* SEARCH */}
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search district..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green-500"
          />
        </div>

        {/* DISTRICT TABLE */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-gray-800">
              Health Center Districts
            </h2>
            <p className="text-xs text-gray-500">
              {filteredDistricts.length} district(s)
            </p>
          </div>

          {loading && districts.length === 0 ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-green-600" />
            </div>
          ) : filteredDistricts.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              No districts found.
            </div>
          ) : (
            <>
              {/* DESKTOP */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "#",
                        "District",
                        "Created",
                        "Sync Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filteredDistricts.map((district, index) => {
                      const pending = pendingDistrictIds.has(
                        String(district.id),
                      );

                      return (
                        <tr key={district.id}>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {index + 1}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-green-100 p-2 text-green-600">
                                <Map size={18} />
                              </div>

                              <span className="font-medium text-gray-800">
                                {district.name}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-500">
                            {district.created_at
                              ? new Date(
                                  district.created_at,
                                ).toLocaleDateString()
                              : "—"}
                          </td>

                          <td className="px-6 py-4">
                            {pending ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                Pending Rename
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                No pending change
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(district)}
                                disabled={pending || syncing}
                                title="Edit district"
                                className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                              >
                                <Pencil size={17} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteClick(district)}
                                disabled={pending || !online || syncing}
                                title="Delete district"
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="divide-y md:hidden">
                {filteredDistricts.map((district) => {
                  const pending = pendingDistrictIds.has(String(district.id));

                  return (
                    <div key={district.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-green-100 p-3 text-green-600">
                          <Map size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800">
                            {district.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {district.created_at
                              ? new Date(
                                  district.created_at,
                                ).toLocaleDateString()
                              : "No date"}
                          </p>

                          {pending && (
                            <p className="mt-1 text-xs text-amber-700">
                              Rename pending synchronization
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(district)}
                          disabled={pending || syncing}
                          className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 disabled:opacity-40"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteClick(district)}
                          disabled={pending || !online || syncing}
                          className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ADD / EDIT MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {editingDistrict ? "Edit District" : "Add District"}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {editingDistrict
                      ? "Rename an existing health center district."
                      : "Create a new health center district."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <X size={19} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  District Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter district name"
                  required
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500"
                />

                {!online && editingDistrict && (
                  <p className="mt-3 text-xs text-amber-700">
                    Offline: the rename will be queued and applied after
                    synchronization.
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-lg border px-4 py-2.5 text-sm"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || syncing}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingDistrict
                      ? online
                        ? "Update District"
                        : "Queue Rename"
                      : "Add District"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION */}
        {showDeleteModal && deletingDistrict && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={20} />
              </div>

              <h2 className="text-lg font-semibold text-gray-800">
                Delete District?
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to delete{" "}
                <strong>{deletingDistrict.name}</strong>? Districts referenced
                by other records cannot be deleted.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingDistrict(null);
                  }}
                  disabled={saving}
                  className="rounded-lg border px-4 py-2.5 text-sm"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || syncing || !online}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
