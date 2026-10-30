import { useCallback, useEffect, useState } from "react";
import {
  Search,
  UserRound,
  Baby,
  HeartPulse,
  Loader2,
  MapPin,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  Save,
  RefreshCw,
  UserCheck,
  UserX,
  Wifi,
  WifiOff,
  Map as MapIcon,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

import {
  getWorkersSnapshot,
  saveWorkersSnapshot,
  getWorkerAreaSnapshot,
  saveWorkerAreaSnapshot,
  pendingWorkerActions,
  queueWorkerAction,
  syncWorkerActions,
} from "../../lib/midwifeWorkersOffline";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {active ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Workers() {
  const currentUser = getCurrentUser();

  const [workers, setWorkers] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedWorker, setSelectedWorker] = useState(null);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [localAreas, setLocalAreas] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [savingAreas, setSavingAreas] = useState(false);

  const [updatingWorkerId, setUpdatingWorkerId] = useState(null);

  const validUser =
    currentUser?.id &&
    currentUser?.role === "midwife" &&
    currentUser?.district_id;

  const updatePending = useCallback(async () => {
    const user = getCurrentUser();
    if (!user?.id || !user.district_id) return;

    try {
      const actions = await pendingWorkerActions(user);
      setPendingCount(actions.length);
    } catch (error) {
      console.error("Pending action count:", error);
    }
  }, []);

  const fetchWorkers = useCallback(async () => {
    const user = getCurrentUser();

    if (!user?.id || user.role !== "midwife" || !user.district_id) {
      setWorkers([]);
      setBarangays([]);
      setLoading(false);
      setNotice("A Midwife account with an assigned district is required.");
      return;
    }

    setLoading(true);

    let cached = null;

    try {
      cached = await getWorkersSnapshot(user);

      if (cached) {
        setWorkers(cached.workers || []);
        setBarangays(cached.barangays || []);
        setNotice(
          `Showing cached directory from ${new Date(
            cached.cachedAt,
          ).toLocaleString()}.`,
        );
      }

      if (!navigator.onLine) {
        if (!cached) {
          setNotice(
            "No offline directory is available. Connect to the internet to load workers.",
          );
        }
        return;
      }

      const { data: districtBarangays, error: barangayError } = await supabase
        .from("barangays")
        .select("id, name, district_id")
        .eq("district_id", user.district_id)
        .order("name");

      if (barangayError) throw barangayError;

      const allowedBarangays = districtBarangays || [];
      const barangayIds = allowedBarangays.map((b) => b.id);

      let workerData = [];

      if (barangayIds.length > 0) {
        const { data, error } = await supabase
          .from("users")
          .select(
            `
            id,
            first_name,
            middle_name,
            last_name,
            email,
            username,
            role,
            district_id,
            barangay_id,
            is_active,
            created_at,
            barangays (
              id,
              name,
              district_id
            )
          `,
          )
          .in("role", ["bns", "bhw"])
          .in("barangay_id", barangayIds)
          .order("created_at", { ascending: false });

        if (error) throw error;

        workerData = data || [];
      }

      setWorkers(workerData);
      setBarangays(allowedBarangays);

      await saveWorkersSnapshot(user, {
        workers: workerData,
        barangays: allowedBarangays,
      });

      setNotice("");
    } catch (error) {
      console.error("Worker directory:", error);

      setNotice(
        cached
          ? `Unable to refresh. Showing cached records. ${error.message}`
          : `Unable to load workers: ${error.message}`,
      );

      if (!cached) {
        setWorkers([]);
        setBarangays([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const user = getCurrentUser();

    if (!user?.id || user.role !== "midwife" || !user.district_id) {
      return;
    }

    if (!navigator.onLine) {
      setNotice("Offline. Your changes remain queued.");
      return;
    }

    setSyncing(true);

    try {
      const count = await syncWorkerActions(user);

      await updatePending();
      await fetchWorkers();

      setNotice(
        count > 0
          ? `${count} change(s) synchronized successfully.`
          : "Synchronization complete. No pending changes.",
      );
    } catch (error) {
      await updatePending();

      setNotice(
        `Synchronization stopped: ${error.message}. Pending changes remain on this device.`,
      );
    } finally {
      setSyncing(false);
    }
  }, [fetchWorkers, updatePending]);

  useEffect(() => {
    fetchWorkers();
    updatePending();
  }, [fetchWorkers, updatePending]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncNow();
    };

    const handleOffline = () => {
      setOnline(false);
      setNotice("Offline mode. Changes will be queued.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  const toggleWorkerStatus = async (worker) => {
    const user = getCurrentUser();

    if (!validUser || updatingWorkerId !== null) return;

    const allowed = barangays.some(
      (b) => String(b.id) === String(worker.barangay_id),
    );

    if (!allowed || !["bns", "bhw"].includes(worker.role)) {
      alert("You can only manage BNS/BHW workers in your district.");
      return;
    }

    const currentlyActive = worker.is_active !== false;
    const newStatus = !currentlyActive;

    const action = newStatus ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Queue request to ${action} ${worker.first_name} ${worker.last_name}?`,
      )
    ) {
      return;
    }

    setUpdatingWorkerId(worker.id);

    try {
      const queued = await pendingWorkerActions(user);

      if (queued.some((item) => String(item.workerId) === String(worker.id))) {
        throw new Error(
          "This worker already has a pending change. Synchronize it before making another change.",
        );
      }

      await queueWorkerAction(user, {
        type: "status",
        workerId: worker.id,
        active: newStatus,
        expectedActive: currentlyActive,
      });

      await updatePending();

      if (navigator.onLine) {
        await syncNow();
      } else {
        setNotice(
          `${action} request saved offline. The account remains unchanged until synchronization succeeds.`,
        );
      }
    } catch (error) {
      alert(error.message || "Unable to queue account change.");
    } finally {
      setUpdatingWorkerId(null);
    }
  };

  const openAssignmentModal = async (worker) => {
    const user = getCurrentUser();

    if (!validUser) return;

    if (worker.is_active === false) {
      alert("Activate this worker before assigning areas.");
      return;
    }

    if (!barangays.some((b) => String(b.id) === String(worker.barangay_id))) {
      alert("This worker is outside your district.");
      return;
    }

    setSelectedWorker(worker);
    setAreaModalOpen(true);
    setLocalAreas([]);
    setSelectedAreas([]);
    setLoadingAreas(true);

    try {
      const cached = await getWorkerAreaSnapshot(user, worker.id);

      if (cached) {
        setLocalAreas(cached.areas || []);
        setSelectedAreas(cached.assignedIds || []);
      }

      if (!navigator.onLine) {
        if (!cached) {
          setNotice(
            "Open this worker's assignments online at least once before editing offline.",
          );
        }
        return;
      }

      const [areasResult, assignmentsResult] = await Promise.all([
        supabase
          .from("local_areas")
          .select("id, name, type, barangay_id")
          .eq("barangay_id", worker.barangay_id)
          .order("name"),

        supabase
          .from("worker_area_assignments")
          .select("id, local_area_id, is_active")
          .eq("worker_id", worker.id)
          .eq("is_active", true),
      ]);

      if (areasResult.error) throw areasResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      const areas = areasResult.data || [];

      const allowedIds = new Set(areas.map((area) => String(area.id)));

      const assignedIds = (assignmentsResult.data || [])
        .map((row) => Number(row.local_area_id))
        .filter((id) => allowedIds.has(String(id)));

      setLocalAreas(areas);
      setSelectedAreas(assignedIds);

      await saveWorkerAreaSnapshot(user, worker.id, {
        areas,
        assignedIds,
      });
    } catch (error) {
      setNotice(`Unable to refresh assignments: ${error.message}`);
    } finally {
      setLoadingAreas(false);
    }
  };

  const closeAssignmentModal = () => {
    if (savingAreas) return;

    setAreaModalOpen(false);
    setSelectedWorker(null);
    setLocalAreas([]);
    setSelectedAreas([]);
  };

  const toggleArea = (areaId) => {
    const id = Number(areaId);

    setSelectedAreas((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  };

  const saveAreaAssignments = async (event) => {
    event.preventDefault();

    const user = getCurrentUser();

    if (!validUser || !selectedWorker) return;

    if (
      !barangays.some(
        (b) => String(b.id) === String(selectedWorker.barangay_id),
      )
    ) {
      alert("Worker is outside your district.");
      return;
    }

    const allowedIds = new Set(localAreas.map((area) => String(area.id)));

    if (selectedAreas.some((id) => !allowedIds.has(String(id)))) {
      alert("Invalid Purok/Sitio selection.");
      return;
    }

    setSavingAreas(true);

    try {
      const queued = await pendingWorkerActions(user);

      if (
        queued.some(
          (item) => String(item.workerId) === String(selectedWorker.id),
        )
      ) {
        throw new Error(
          "This worker already has a pending change. Synchronize it before assigning areas again.",
        );
      }

      await queueWorkerAction(user, {
        type: "areas",
        workerId: selectedWorker.id,
        areaIds: selectedAreas.map(Number),
      });

      await updatePending();

      setAreaModalOpen(false);
      setSelectedWorker(null);

      if (navigator.onLine) {
        await syncNow();
      } else {
        setNotice(
          "Area assignments saved offline. They will take effect after successful synchronization.",
        );
      }
    } catch (error) {
      alert(error.message || "Unable to queue assignments.");
    } finally {
      setSavingAreas(false);
    }
  };

  const filteredWorkers = workers.filter((worker) => {
    const name = [worker.first_name, worker.middle_name, worker.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const query = search.toLowerCase().trim();

    const matchesSearch =
      name.includes(query) ||
      (worker.username || "").toLowerCase().includes(query) ||
      (worker.email || "").toLowerCase().includes(query) ||
      (worker.barangays?.name || "").toLowerCase().includes(query);

    const matchesRole = roleFilter === "all" || worker.role === roleFilter;

    const active = worker.is_active !== false;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && active) ||
      (statusFilter === "inactive" && !active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeCount = workers.filter(
    (worker) => worker.is_active !== false,
  ).length;

  const inactiveCount = workers.length - activeCount;

  const bnsCount = workers.filter((worker) => worker.role === "bns").length;

  const bhwCount = workers.filter((worker) => worker.role === "bhw").length;

  const roleInfo = (role) =>
    role === "bns"
      ? {
          label: "BNS",
          Icon: HeartPulse,
          color: "bg-green-50 text-green-700",
        }
      : {
          label: "BHW",
          Icon: Baby,
          color: "bg-orange-50 text-orange-700",
        };

  if (!validUser) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-white p-8 text-red-600">
          Please sign in with a Midwife account assigned to a district.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              BNS &amp; BHW Directory
            </h2>

            <p className="mt-1 text-gray-500">
              Manage workers and Purok/Sitio assignments in your district.
            </p>

            <p className="mt-1 text-sm text-blue-700">
              District ID: {currentUser.district_id}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                online
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? "Online" : "Offline"}
            </span>

            <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pendingCount} pending
            </span>

            <button
              type="button"
              onClick={syncNow}
              disabled={!online || syncing}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>

            <button
              type="button"
              onClick={fetchWorkers}
              disabled={loading || syncing}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* NOTICE */}
        {notice && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {notice}
          </div>
        )}

        {/* STATISTICS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Workers", value: workers.length },
            { label: "BNS", value: bnsCount },
            { label: "BHW", value: bhwCount },
            { label: "Inactive", value: inactiveCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-800">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search worker, username, email, barangay..."
                className="w-full rounded-lg border px-4 py-2.5 pl-10 outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border bg-white px-4 py-2.5"
            >
              <option value="all">All Roles</option>
              <option value="bns">BNS</option>
              <option value="bhw">BHW</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border bg-white px-4 py-2.5"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* WORKER DIRECTORY */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {loading && workers.length === 0 ? (
            <div className="flex items-center justify-center gap-3 p-12 text-gray-500">
              <Loader2 className="animate-spin" />
              Loading workers...
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No BNS/BHW workers found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-5 py-4">Worker</th>
                    <th className="px-5 py-4">Barangay</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredWorkers.map((worker) => {
                    const active = worker.is_active !== false;
                    const role = roleInfo(worker.role);
                    const RoleIcon = role.Icon;

                    return (
                      <tr key={worker.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                              <UserRound size={20} />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-800">
                                {[
                                  worker.first_name,
                                  worker.middle_name,
                                  worker.last_name,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              </p>

                              <p className="text-xs text-gray-500">
                                @{worker.username}
                              </p>

                              <p className="text-xs text-gray-400">
                                {worker.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          <span className="flex items-center gap-2">
                            <MapPin size={15} />
                            {worker.barangays?.name || "Not assigned"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${role.color}`}
                          >
                            <RoleIcon size={14} />
                            {role.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge active={active} />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => toggleWorkerStatus(worker)}
                              disabled={updatingWorkerId !== null || syncing}
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                                active
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {active ? (
                                <UserX size={15} />
                              ) : (
                                <UserCheck size={15} />
                              )}
                              {active ? "Deactivate" : "Activate"}
                            </button>

                            {active && (
                              <button
                                type="button"
                                onClick={() => openAssignmentModal(worker)}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                              >
                                <MapIcon size={15} />
                                Assign Areas
                              </button>
                            )}
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

        {/* AREA ASSIGNMENT MODAL */}
        {areaModalOpen && selectedWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b p-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Assign Purok / Sitio
                  </h3>

                  <p className="text-sm text-gray-500">
                    {selectedWorker.first_name} {selectedWorker.last_name}
                  </p>

                  <p className="text-xs text-gray-400">
                    {selectedWorker.barangays?.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeAssignmentModal}
                  disabled={savingAreas}
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={saveAreaAssignments} className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">
                    Available Areas
                  </p>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    {selectedAreas.length} selected
                  </span>
                </div>

                {loadingAreas ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-blue-600" />
                  </div>
                ) : localAreas.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
                    No cached or available Purok/Sitio areas.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-lg border">
                    {localAreas.map((area) => {
                      const selected = selectedAreas.includes(Number(area.id));

                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => toggleArea(area.id)}
                          className={`flex w-full items-center justify-between border-b px-4 py-3 text-left last:border-0 ${
                            selected ? "bg-blue-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <MapPin size={17} className="text-blue-500" />

                            <div>
                              <p className="text-sm font-medium">{area.name}</p>

                              <p className="text-xs text-gray-400">
                                {area.type || "Local area"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {selected && <Check size={13} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t pt-4">
                  <button
                    type="button"
                    onClick={closeAssignmentModal}
                    disabled={savingAreas}
                    className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      savingAreas || loadingAreas || localAreas.length === 0
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingAreas ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Assignments
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Workers;
