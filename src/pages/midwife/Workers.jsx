import { useCallback, useEffect, useState } from "react";
import {
  Search,
  UserRound,
  Baby,
  HeartPulse,
  Loader2,
  MapPin,
  Map as MapIcon,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  Save,
  RefreshCw,
  UserCheck,
  UserX,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBarangays, setLoadingBarangays] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedWorker, setSelectedWorker] = useState(null);
  const [localAreas, setLocalAreas] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [savingAreas, setSavingAreas] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);

  const [updatingWorkerId, setUpdatingWorkerId] = useState(null);

  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
      console.error("Unable to read logged-in user:", error);
      return null;
    }
  };

  const currentUser = getCurrentUser();

  const fetchWorkers = useCallback(async () => {
    const user = getCurrentUser();

    if (!user?.id || user.role !== "midwife") {
      setWorkers([]);
      setBarangays([]);
      setLoading(false);
      setLoadingBarangays(false);
      alert("Please sign in again using your midwife account.");
      return;
    }

    if (!user.district_id) {
      setWorkers([]);
      setBarangays([]);
      setLoading(false);
      setLoadingBarangays(false);
      alert("Your midwife account does not have a district assigned.");
      return;
    }

    setLoading(true);
    setLoadingBarangays(true);

    try {
      const { data: districtBarangays, error: barangayError } = await supabase
        .from("barangays")
        .select("id, name, district_id")
        .eq("district_id", user.district_id)
        .order("name", { ascending: true });

      if (barangayError) throw barangayError;

      const validBarangays = districtBarangays || [];
      setBarangays(validBarangays);

      const barangayIds = validBarangays.map((barangay) => barangay.id);

      if (barangayIds.length === 0) {
        setWorkers([]);
        return;
      }

      // Show registered BNS/BHW accounts whose barangays are in this
      // midwife's district, including accounts that are still inactive.
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

      setWorkers(data || []);
    } catch (error) {
      console.error("Error loading district workers:", error);
      alert(error.message || "Failed to load workers for your district.");
      setWorkers([]);
    } finally {
      setLoading(false);
      setLoadingBarangays(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // Activate or deactivate a BNS/BHW only if the account's current
  // barangay still belongs to this midwife's district.
  const toggleWorkerStatus = async (worker) => {
    const user = getCurrentUser();

    if (!user?.id || user.role !== "midwife" || !user.district_id) {
      alert("Please sign in again using your midwife account.");
      return;
    }

    if (!["bns", "bhw"].includes(worker.role)) {
      alert("You can only manage BNS and BHW accounts.");
      return;
    }

    if (updatingWorkerId !== null) return;

    const activating = worker.is_active === false;
    const action = activating ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} the account of ${worker.first_name} ${worker.last_name}?`,
    );

    if (!confirmed) return;

    setUpdatingWorkerId(worker.id);

    try {
      // Recheck the worker's current database record before changing status.
      const { data: latestWorker, error: latestError } = await supabase
        .from("users")
        .select(
          `
          id,
          role,
          barangay_id,
          is_active,
          barangays (
            id,
            district_id
          )
        `,
        )
        .eq("id", worker.id)
        .maybeSingle();

      if (latestError) throw latestError;

      if (!latestWorker) {
        throw new Error("This worker account could not be found.");
      }

      if (!["bns", "bhw"].includes(latestWorker.role)) {
        throw new Error("Only BNS and BHW accounts can be managed here.");
      }

      if (
        !latestWorker.barangays ||
        String(latestWorker.barangays.district_id) !== String(user.district_id)
      ) {
        throw new Error(
          "You cannot change the status of a worker outside your district.",
        );
      }

      // Avoid changing a status that another administrator already changed.
      if (latestWorker.is_active !== worker.is_active) {
        await fetchWorkers();
        throw new Error(
          "This worker's status has changed. The directory has been refreshed; please try again.",
        );
      }

      const newStatus = activating;

      const { data: updatedWorker, error: updateError } = await supabase
        .from("users")
        .update({ is_active: newStatus })
        .eq("id", worker.id)
        .eq("is_active", worker.is_active)
        .select("id, is_active")
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedWorker) {
        throw new Error(
          "The account status was not changed. Check your permissions and refresh the directory.",
        );
      }

      // Deactivating an account also disables its active area assignments.
      // If reactivated later, the midwife can assign areas again.
      if (!newStatus) {
        const { error: assignmentError } = await supabase
          .from("worker_area_assignments")
          .update({ is_active: false })
          .eq("worker_id", worker.id)
          .eq("is_active", true);

        if (assignmentError) {
          console.error(
            "Account deactivated, but area assignments could not be disabled:",
            assignmentError,
          );

          alert(
            "The account was deactivated, but its area assignments could not be disabled. Please check your database permissions and assignment records.",
          );
        } else {
          alert("Worker account deactivated successfully.");
        }
      } else {
        alert(
          "Worker account activated successfully. You can now assign Purok/Sitio areas to this worker.",
        );
      }

      await fetchWorkers();
    } catch (error) {
      console.error("Error changing worker account status:", error);
      alert(error.message || `Failed to ${action} worker account.`);
    } finally {
      setUpdatingWorkerId(null);
    }
  };

  const fetchWorkerAssignments = async (workerId) => {
    const { data, error } = await supabase
      .from("worker_area_assignments")
      .select("id, local_area_id, is_active")
      .eq("worker_id", workerId)
      .eq("is_active", true);

    if (error) throw error;

    return (data || []).map((item) => Number(item.local_area_id));
  };

  const openAssignmentModal = async (worker) => {
    if (worker.is_active === false) {
      alert("Activate this worker's account before assigning areas.");
      return;
    }

    const allowedBarangay = barangays.some(
      (barangay) => String(barangay.id) === String(worker.barangay_id),
    );

    if (!allowedBarangay) {
      alert(
        "You can only assign areas to workers whose barangay belongs to your district.",
      );
      return;
    }

    setSelectedWorker(worker);
    setSelectedAreas([]);
    setLocalAreas([]);
    setAreaModalOpen(true);
    setLoadingAreas(true);

    try {
      const [areasResult, assignedIds] = await Promise.all([
        supabase
          .from("local_areas")
          .select("id, name, type, barangay_id")
          .eq("barangay_id", worker.barangay_id)
          .order("type", { ascending: true })
          .order("name", { ascending: true }),
        fetchWorkerAssignments(worker.id),
      ]);

      if (areasResult.error) throw areasResult.error;

      setLocalAreas(areasResult.data || []);

      const availableIds = new Set(
        (areasResult.data || []).map((area) => Number(area.id)),
      );

      setSelectedAreas(assignedIds.filter((id) => availableIds.has(id)));
    } catch (error) {
      console.error("Error opening worker area assignments:", error);
      alert(error.message || "Failed to load this worker's area assignments.");
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
    const normalizedId = Number(areaId);

    setSelectedAreas((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId],
    );
  };

  const saveAreaAssignments = async (event) => {
    event.preventDefault();

    if (!selectedWorker) return;

    const user = getCurrentUser();

    if (!user?.id || user.role !== "midwife" || !user.district_id) {
      alert("Please sign in again using your midwife account.");
      return;
    }

    const workerStillInDistrict = barangays.some(
      (barangay) => String(barangay.id) === String(selectedWorker.barangay_id),
    );

    if (!workerStillInDistrict) {
      alert("This worker's barangay is not within your assigned district.");
      return;
    }

    // Recheck the account before saving assignments.
    const { data: latestWorker, error: workerCheckError } = await supabase
      .from("users")
      .select("id, role, is_active, barangay_id, barangays(id, district_id)")
      .eq("id", selectedWorker.id)
      .maybeSingle();

    if (workerCheckError) {
      alert(workerCheckError.message);
      return;
    }

    if (
      !latestWorker ||
      !["bns", "bhw"].includes(latestWorker.role) ||
      latestWorker.is_active !== true ||
      String(latestWorker.barangays?.district_id) !== String(user.district_id)
    ) {
      alert(
        "This worker is inactive or no longer belongs to your district. Refresh the directory and try again.",
      );
      closeAssignmentModal();
      await fetchWorkers();
      return;
    }

    const allowedAreaIds = new Set(localAreas.map((area) => Number(area.id)));

    if (selectedAreas.some((id) => !allowedAreaIds.has(Number(id)))) {
      alert(
        "One or more selected areas do not belong to this worker's barangay. Please refresh and try again.",
      );
      return;
    }

    setSavingAreas(true);

    try {
      const { data: existingAssignments, error: existingError } = await supabase
        .from("worker_area_assignments")
        .select("id, local_area_id")
        .eq("worker_id", selectedWorker.id);

      if (existingError) throw existingError;

      const { error: deactivateError } = await supabase
        .from("worker_area_assignments")
        .update({ is_active: false })
        .eq("worker_id", selectedWorker.id);

      if (deactivateError) throw deactivateError;

      const existingByArea = new Map(
        (existingAssignments || []).map((assignment) => [
          Number(assignment.local_area_id),
          assignment.id,
        ]),
      );

      for (const areaId of selectedAreas) {
        const existingId = existingByArea.get(Number(areaId));

        if (existingId) {
          const { error } = await supabase
            .from("worker_area_assignments")
            .update({
              is_active: true,
              assigned_by: user.id,
              assigned_at: new Date().toISOString(),
            })
            .eq("id", existingId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("worker_area_assignments")
            .insert({
              worker_id: selectedWorker.id,
              local_area_id: areaId,
              assigned_by: user.id,
              is_active: true,
            });

          if (error) throw error;
        }
      }

      alert("Worker area assignments saved successfully.");
      closeAssignmentModal();
    } catch (error) {
      console.error("Error saving worker area assignments:", error);
      alert(error.message || "Failed to save area assignments.");
    } finally {
      setSavingAreas(false);
    }
  };

  const getRoleInfo = (role) => {
    if (role === "bns") {
      return {
        label: "BNS",
        fullLabel: "Barangay Nutrition Scholar",
        className: "bg-green-50 text-green-700",
        icon: HeartPulse,
      };
    }

    return {
      label: "BHW",
      fullLabel: "Barangay Health Worker",
      className: "bg-orange-50 text-orange-700",
      icon: Baby,
    };
  };

  const StatusBadge = ({ active }) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {active ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
      {active ? "Active" : "Inactive"}
    </span>
  );

  const WorkerStatusButton = ({ worker }) => {
    const active = worker.is_active !== false;
    const updating = String(updatingWorkerId) === String(worker.id);

    return (
      <button
        type="button"
        onClick={() => toggleWorkerStatus(worker)}
        disabled={updating || updatingWorkerId !== null}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
        title={active ? "Deactivate worker account" : "Activate worker account"}
      >
        {updating ? (
          <Loader2 size={15} className="animate-spin" />
        ) : active ? (
          <UserX size={15} />
        ) : (
          <UserCheck size={15} />
        )}
        {updating ? "Updating..." : active ? "Deactivate" : "Activate"}
      </button>
    );
  };

  const filteredWorkers = workers.filter((worker) => {
    const fullName =
      `${worker.first_name || ""} ${worker.middle_name || ""} ${worker.last_name || ""}`.toLowerCase();

    const searchValue = search.toLowerCase();

    const matchesSearch =
      fullName.includes(searchValue) ||
      (worker.email || "").toLowerCase().includes(searchValue) ||
      (worker.username || "").toLowerCase().includes(searchValue) ||
      (worker.barangays?.name || "").toLowerCase().includes(searchValue);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              BNS &amp; BHW Directory
            </h2>

            <p className="mt-1 text-gray-500">
              Review registrations, activate workers in your district, and
              assign their Purok/Sitio areas.
            </p>

            <p className="mt-1 text-sm text-blue-700">
              District:{" "}
              {currentUser?.district_id
                ? `District ID ${currentUser.district_id}`
                : "Not assigned"}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchWorkers}
            disabled={loading || updatingWorkerId !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh List
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Workers",
              value: workers.length,
              icon: UserRound,
              color: "blue",
            },
            {
              label: "BNS",
              value: bnsCount,
              icon: HeartPulse,
              color: "green",
            },
            {
              label: "BHW",
              value: bhwCount,
              icon: Baby,
              color: "orange",
            },
            {
              label: "Inactive Workers",
              value: inactiveCount,
              icon: ShieldAlert,
              color: "red",
            },
          ].map((item) => {
            const Icon = item.icon;

            const colorClasses = {
              blue: "bg-blue-50 text-blue-600",
              green: "bg-green-50 text-green-600",
              orange: "bg-orange-50 text-orange-600",
              red: "bg-red-50 text-red-600",
            };

            return (
              <div
                key={item.label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${colorClasses[item.color]}`}
                  >
                    <Icon size={21} />
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">{item.label}</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {item.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Search by name, username, email, or barangay..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="bns">BNS</option>
                <option value="bhw">BHW</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Worker", "Barangay", "Role", "Status", "Actions"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-5 py-4 text-left text-xs font-semibold uppercase text-gray-500"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading || loadingBarangays ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader2
                        className="mx-auto animate-spin text-blue-600"
                        size={28}
                      />
                      <p className="mt-3 text-sm text-gray-500">
                        Loading district workers...
                      </p>
                    </td>
                  </tr>
                ) : filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <UserRound size={25} className="mx-auto text-gray-400" />
                      <p className="mt-3 text-sm text-gray-500">
                        No registered BNS/BHW workers found in your district.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((worker) => {
                    const role = getRoleInfo(worker.role);
                    const RoleIcon = role.icon;
                    const active = worker.is_active !== false;

                    return (
                      <tr
                        key={worker.id}
                        className={`transition hover:bg-gray-50 ${
                          !active ? "bg-gray-50/70" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                              <UserRound size={19} className="text-blue-600" />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {worker.first_name}{" "}
                                {worker.middle_name
                                  ? `${worker.middle_name} `
                                  : ""}
                                {worker.last_name}
                              </p>

                              <p className="text-xs text-gray-400">
                                @{worker.username || "No username"}
                              </p>

                              <p className="text-xs text-gray-400">
                                {worker.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin size={15} className="text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {worker.barangays?.name || "Not assigned"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            title={role.fullLabel}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${role.className}`}
                          >
                            <RoleIcon size={14} />
                            {role.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge active={active} />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <WorkerStatusButton worker={worker} />

                            {active && (
                              <button
                                type="button"
                                onClick={() => openAssignmentModal(worker)}
                                disabled={updatingWorkerId !== null}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                                title="Assign Purok/Sitio areas"
                              >
                                <MapIcon size={15} />
                                Assign Areas
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {loading || loadingBarangays ? (
              <div className="py-12 text-center">
                <Loader2
                  className="mx-auto animate-spin text-blue-600"
                  size={28}
                />
                <p className="mt-3 text-sm text-gray-500">
                  Loading district workers...
                </p>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                No registered BNS/BHW workers found in your district.
              </div>
            ) : (
              filteredWorkers.map((worker) => {
                const role = getRoleInfo(worker.role);
                const RoleIcon = role.icon;
                const active = worker.is_active !== false;

                return (
                  <div
                    key={worker.id}
                    className={`p-4 ${!active ? "bg-gray-50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                        <UserRound size={19} className="text-blue-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800">
                          {worker.first_name}{" "}
                          {worker.middle_name ? `${worker.middle_name} ` : ""}
                          {worker.last_name}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {worker.barangays?.name || "Not assigned"}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          @{worker.username || "No username"}
                        </p>

                        <p className="text-xs text-gray-400">
                          {worker.email || "No email"}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            title={role.fullLabel}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${role.className}`}
                          >
                            <RoleIcon size={14} />
                            {role.label}
                          </span>

                          <StatusBadge active={active} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <WorkerStatusButton worker={worker} />
                      </div>

                      {active && (
                        <button
                          type="button"
                          onClick={() => openAssignmentModal(worker)}
                          disabled={updatingWorkerId !== null}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <MapIcon size={16} />
                          Assign Purok/Sitio Areas
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Purok/Sitio assignment modal */}
        {areaModalOpen && selectedWorker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Assign Purok / Sitio Areas
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedWorker.first_name} {selectedWorker.last_name} ·{" "}
                    {selectedWorker.barangays?.name || "Barangay"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeAssignmentModal}
                  disabled={savingAreas}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-50"
                  aria-label="Close assignment dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={saveAreaAssignments} className="space-y-5 p-6">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Available areas
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        Only areas in this worker's registered barangay are
                        shown.
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                      {selectedAreas.length} selected
                    </span>
                  </div>

                  {loadingAreas ? (
                    <div className="flex items-center justify-center rounded-lg border border-gray-200 p-8">
                      <Loader2
                        size={20}
                        className="animate-spin text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-500">
                        Loading areas...
                      </span>
                    </div>
                  ) : localAreas.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                      <MapIcon size={24} className="mx-auto text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        No Purok/Sitio areas found.
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Add local areas from the Barangays page first.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                      {localAreas.map((area) => {
                        const isSelected = selectedAreas.includes(
                          Number(area.id),
                        );

                        return (
                          <button
                            key={area.id}
                            type="button"
                            onClick={() => toggleArea(area.id)}
                            className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${
                              isSelected
                                ? "bg-blue-50"
                                : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                  isSelected
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                <MapPin size={16} />
                              </div>

                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {area.name}
                                </p>
                                <p className="text-xs capitalize text-gray-400">
                                  {area.type || "Local area"}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded border ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check size={13} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeAssignmentModal}
                    disabled={savingAreas}
                    className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingAreas || loadingAreas}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
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
