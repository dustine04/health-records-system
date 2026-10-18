import { useEffect, useState } from "react";

import {
  Search,
  Plus,
  Pencil,
  UserRound,
  Baby,
  HeartPulse,
  Loader2,
  MapPin,
  Map as MapIcon,
  Check,
  Power,
  PowerOff,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [confirmStatusWorker, setConfirmStatusWorker] = useState(null);

  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [barangays, setBarangays] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    role: "bns",
    barangay_id: "",
  });

  const [selectedAreas, setSelectedAreas] = useState([]);

  // --------------------------------------------------
  // CURRENT USER
  // --------------------------------------------------

  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
      console.error("Error reading logged-in user:", error);
      return null;
    }
  };

  const getCurrentUserId = () => getCurrentUser()?.id || null;

  // --------------------------------------------------
  // FETCH WORKERS
  // --------------------------------------------------

  const fetchWorkers = async () => {
    setLoading(true);

    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      setWorkers([]);
      setLoading(false);
      alert("Unable to identify the logged-in midwife. Please sign in again.");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        barangays (
          id,
          name,
          district_id
        )
      `,
      )
      .in("role", ["bns", "bhw"])
      .eq("created_by_midwife_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching workers:", error);
      alert("Failed to load workers.");
      setWorkers([]);
    } else {
      setWorkers(data || []);
    }

    setLoading(false);
  };

  // --------------------------------------------------
  // FETCH BARANGAYS
  // --------------------------------------------------

  const fetchBarangays = async () => {
    setLoadingBarangays(true);

    const currentUser = getCurrentUser();

    if (!currentUser?.district_id) {
      setBarangays([]);
      setLoadingBarangays(false);
      console.error("The logged-in midwife has no district_id.");
      return;
    }

    const { data, error } = await supabase
      .from("barangays")
      .select("id, name, district_id")
      .eq("district_id", currentUser.district_id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching barangays:", error);
      alert("Failed to load barangays for your district.");
      setBarangays([]);
    } else {
      setBarangays(data || []);
    }

    setLoadingBarangays(false);
  };

  useEffect(() => {
    fetchWorkers();
    fetchBarangays();
  }, []);

  // --------------------------------------------------
  // FETCH LOCAL AREAS
  // --------------------------------------------------

  const fetchLocalAreas = async (barangayId) => {
    if (!barangayId) {
      setLocalAreas([]);
      return;
    }

    setLoadingAreas(true);

    const { data, error } = await supabase
      .from("local_areas")
      .select("*")
      .eq("barangay_id", barangayId)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching local areas:", error);
      alert("Failed to load Purok/Sitio areas.");
      setLocalAreas([]);
    } else {
      setLocalAreas(data || []);
    }

    setLoadingAreas(false);
  };

  // --------------------------------------------------
  // FETCH ACTIVE WORKER AREA ASSIGNMENTS
  // --------------------------------------------------

  const fetchWorkerAreas = async (workerId) => {
    const { data, error } = await supabase
      .from("worker_area_assignments")
      .select(
        `
        id,
        worker_id,
        local_area_id,
        is_active,
        local_areas (
          id,
          name,
          type,
          barangay_id
        )
      `,
      )
      .eq("worker_id", workerId)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching worker areas:", error);
      return [];
    }

    return data || [];
  };

  // --------------------------------------------------
  // FORM CHANGE
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (name === "barangay_id") {
      setSelectedAreas([]);
      fetchLocalAreas(value);
    }
  };

  // --------------------------------------------------
  // ADD MODAL
  // --------------------------------------------------

  const openAddModal = () => {
    setEditingWorker(null);

    setForm({
      first_name: "",
      last_name: "",
      email: "",
      username: "",
      password: "",
      role: "bns",
      barangay_id: "",
    });

    setSelectedAreas([]);
    setLocalAreas([]);
    setShowPassword(false);
    setShowModal(true);
  };

  // --------------------------------------------------
  // EDIT MODAL
  // --------------------------------------------------

  const openEditModal = async (worker) => {
    setEditingWorker(worker);

    setForm({
      first_name: worker.first_name || "",
      last_name: worker.last_name || "",
      email: worker.email || "",
      username: worker.username || "",
      password: "",
      role: worker.role || "bns",
      barangay_id: worker.barangay_id?.toString() || "",
    });

    setShowPassword(false);
    setSelectedAreas([]);
    setLocalAreas([]);
    setShowModal(true);

    if (worker.barangay_id) {
      await fetchLocalAreas(worker.barangay_id);

      const assignments = await fetchWorkerAreas(worker.id);

      setSelectedAreas(
        assignments
          .map((assignment) => Number(assignment.local_area_id))
          .filter(Boolean),
      );
    }
  };

  // --------------------------------------------------
  // CLOSE MODAL
  // --------------------------------------------------

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingWorker(null);
    setShowPassword(false);
    setSelectedAreas([]);
    setLocalAreas([]);
  };

  // --------------------------------------------------
  // TOGGLE AREA
  // --------------------------------------------------

  const toggleArea = (areaId) => {
    setSelectedAreas((current) => {
      const normalizedId = Number(areaId);

      return current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId];
    });
  };

  // --------------------------------------------------
  // SAVE AREA ASSIGNMENTS
  // --------------------------------------------------

  const saveAreaAssignments = async (workerId) => {
    const { error: deactivateError } = await supabase
      .from("worker_area_assignments")
      .update({ is_active: false })
      .eq("worker_id", workerId);

    if (deactivateError) throw deactivateError;

    if (selectedAreas.length === 0) return;

    const { data: existingAssignments, error: existingError } = await supabase
      .from("worker_area_assignments")
      .select("id, local_area_id")
      .eq("worker_id", workerId);

    if (existingError) throw existingError;

    const existingMap = new Map(
      (existingAssignments || []).map((item) => [
        Number(item.local_area_id),
        item.id,
      ]),
    );

    for (const areaId of selectedAreas) {
      const existingId = existingMap.get(Number(areaId));

      if (existingId) {
        const { error } = await supabase
          .from("worker_area_assignments")
          .update({ is_active: true })
          .eq("id", existingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_area_assignments")
          .insert({
            worker_id: workerId,
            local_area_id: areaId,
            assigned_by: getCurrentUserId(),
            is_active: true,
          });

        if (error) throw error;
      }
    }
  };

  // --------------------------------------------------
  // ADD / EDIT WORKER
  // --------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentUser = getCurrentUser();

    if (!currentUser?.id || currentUser.role !== "midwife") {
      alert("Only the logged-in midwife can manage BNS/BHW accounts here.");
      return;
    }

    if (!currentUser.district_id) {
      alert("Your midwife account has no assigned district.");
      return;
    }

    const selectedBarangay = barangays.find(
      (barangay) => String(barangay.id) === String(form.barangay_id),
    );

    if (
      !selectedBarangay ||
      String(selectedBarangay.district_id) !== String(currentUser.district_id)
    ) {
      alert("Please select a barangay within your assigned district.");
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim()) {
      alert("Please enter the worker's first and last name.");
      return;
    }

    if (!form.email.trim()) {
      alert("Please enter an email address.");
      return;
    }

    if (!form.username.trim()) {
      alert("Please enter a username.");
      return;
    }

    if (!form.barangay_id) {
      alert("Please select a barangay.");
      return;
    }

    if (!editingWorker && !form.password.trim()) {
      alert("Please enter a password.");
      return;
    }

    setSaving(true);

    try {
      if (editingWorker) {
        const updateData = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          role: form.role,
          barangay_id: Number(form.barangay_id),
        };

        if (form.password.trim()) {
          updateData.password = form.password;
        }

        const { data, error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", editingWorker.id)
          .eq("created_by_midwife_id", currentUser.id)
          .select("id")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(
            "Worker was not updated. Confirm that this account was created by your midwife account.",
          );
        }

        // Do not reactivate assignments for an inactive account.
        if (editingWorker.is_active !== false) {
          await saveAreaAssignments(editingWorker.id);
        }

        alert("Worker updated successfully.");
      } else {
        const { data, error } = await supabase
          .from("users")
          .insert({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            username: form.username.trim(),
            password: form.password,
            role: form.role,
            barangay_id: Number(form.barangay_id),
            created_by_midwife_id: currentUser.id,
            is_active: true,
          })
          .select("id")
          .single();

        if (error) throw error;

        if (data?.id) {
          await saveAreaAssignments(data.id);
        }

        alert(
          `${form.role === "bns" ? "BNS" : "BHW"} account created successfully.`,
        );
      }

      setShowModal(false);
      setEditingWorker(null);
      setSelectedAreas([]);
      setLocalAreas([]);

      await fetchWorkers();
    } catch (error) {
      console.error("Error saving worker:", error);
      alert(error.message || "Failed to save worker.");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // ACTIVATE / DEACTIVATE ACCOUNT
  // --------------------------------------------------

  const handleStatusChange = async () => {
    if (!confirmStatusWorker) return;

    const currentUser = getCurrentUser();

    if (!currentUser?.id || currentUser.role !== "midwife") {
      alert("Please sign in again with your midwife account.");
      setConfirmStatusWorker(null);
      return;
    }

    const worker = confirmStatusWorker.worker;
    const nextStatus = confirmStatusWorker.nextStatus;

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("users")
        .update({ is_active: nextStatus })
        .eq("id", worker.id)
        .eq("created_by_midwife_id", currentUser.id)
        .in("role", ["bns", "bhw"])
        .select("id, is_active")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Account status was not changed. You can only manage BNS/BHW accounts created by your account.",
        );
      }

      // Deactivating a worker also disables their area assignments.
      // The assignment history is retained so it can be restored later.
      if (!nextStatus) {
        const { error: assignmentError } = await supabase
          .from("worker_area_assignments")
          .update({ is_active: false })
          .eq("worker_id", worker.id);

        if (assignmentError) {
          console.error(
            "Could not deactivate worker assignments:",
            assignmentError,
          );

          alert(
            "The account was deactivated, but its area assignments could not all be disabled. Please check the worker's assignments.",
          );
        }
      } else {
        // Restore the worker's existing assignments.
        // Only restore assignments whose local area still belongs to the
        // worker's currently assigned barangay.
        const { data: areas, error: areasError } = await supabase
          .from("local_areas")
          .select("id")
          .eq("barangay_id", worker.barangay_id);

        if (areasError) throw areasError;

        const validAreaIds = (areas || []).map((area) => area.id);

        if (validAreaIds.length > 0) {
          const { error: assignmentError } = await supabase
            .from("worker_area_assignments")
            .update({ is_active: true })
            .eq("worker_id", worker.id)
            .in("local_area_id", validAreaIds);

          if (assignmentError) throw assignmentError;
        }
      }

      setWorkers((current) =>
        current.map((item) =>
          item.id === worker.id ? { ...item, is_active: nextStatus } : item,
        ),
      );

      setConfirmStatusWorker(null);

      alert(
        nextStatus
          ? "Worker account activated successfully."
          : "Worker account deactivated successfully.",
      );

      await fetchWorkers();
    } catch (error) {
      console.error("Error changing worker status:", error);
      alert(error.message || "Failed to update worker account status.");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // SEARCH / FILTER
  // --------------------------------------------------

  const filteredWorkers = workers.filter((worker) => {
    const fullName =
      `${worker.first_name || ""} ${worker.last_name || ""}`.toLowerCase();

    const searchValue = search.toLowerCase();

    const matchesSearch =
      fullName.includes(searchValue) ||
      (worker.email || "").toLowerCase().includes(searchValue) ||
      (worker.username || "").toLowerCase().includes(searchValue);

    const matchesRole = roleFilter === "all" || worker.role === roleFilter;

    const active = worker.is_active !== false;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && active) ||
      (statusFilter === "inactive" && !active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // --------------------------------------------------
  // ROLE INFO
  // --------------------------------------------------

  const getRoleInfo = (role) => {
    if (role === "bns") {
      return {
        label: "BNS",
        fullLabel: "Barangay Nutrition Scholar",
        className: "bg-green-50 text-green-700",
        icon: HeartPulse,
      };
    }

    if (role === "bhw") {
      return {
        label: "BHW",
        fullLabel: "Barangay Health Worker",
        className: "bg-orange-50 text-orange-700",
        icon: Baby,
      };
    }

    return {
      label: role,
      fullLabel: role,
      className: "bg-gray-100 text-gray-700",
      icon: UserRound,
    };
  };

  const activeCount = workers.filter(
    (worker) => worker.is_active !== false,
  ).length;

  const inactiveCount = workers.length - activeCount;

  // --------------------------------------------------
  // REUSABLE STATUS BADGE
  // --------------------------------------------------

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

  // --------------------------------------------------
  // REUSABLE STATUS ACTION
  // --------------------------------------------------

  const StatusAction = ({ worker }) => {
    const active = worker.is_active !== false;

    return (
      <button
        type="button"
        onClick={() =>
          setConfirmStatusWorker({
            worker,
            nextStatus: !active,
          })
        }
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
          active
            ? "text-red-600 hover:bg-red-50"
            : "text-green-700 hover:bg-green-50"
        }`}
        title={active ? "Deactivate account" : "Activate account"}
      >
        {active ? <PowerOff size={16} /> : <Power size={16} />}
        <span>{active ? "Deactivate" : "Activate"}</span>
      </button>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              BNS &amp; BHW
            </h2>
            <p className="mt-1 text-gray-500">
              Manage Barangay Nutrition Scholars and Barangay Health Workers.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Worker
          </button>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                <UserRound size={21} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Workers</p>
                <p className="text-2xl font-bold text-gray-800">
                  {workers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50">
                <ShieldCheck size={21} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Workers</p>
                <p className="text-2xl font-bold text-green-700">
                  {activeCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50">
                <ShieldAlert size={21} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inactive Workers</p>
                <p className="text-2xl font-bold text-red-700">
                  {inactiveCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* WORKER LIST */}
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
                  placeholder="Search by name, username, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="bns">BNS</option>
                <option value="bhw">BHW</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {[
                    "Worker",
                    "Barangay",
                    "Areas",
                    "Role",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={`px-5 py-4 text-xs font-semibold uppercase text-gray-500 ${
                        heading === "Actions" ? "text-right" : "text-left"
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center">
                      <Loader2
                        className="mx-auto animate-spin text-blue-600"
                        size={28}
                      />
                      <p className="mt-3 text-sm text-gray-500">
                        Loading workers...
                      </p>
                    </td>
                  </tr>
                ) : filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center">
                      <UserRound size={24} className="mx-auto text-gray-400" />
                      <p className="mt-3 text-sm text-gray-500">
                        No workers found.
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
                                {worker.first_name} {worker.last_name}
                              </p>
                              <p className="text-xs text-gray-400">
                                @{worker.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {worker.barangays ? (
                            <div className="flex items-center gap-2">
                              <MapPin size={15} className="text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {worker.barangays.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">
                              Not assigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => openEditModal(worker)}
                            disabled={!active}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              active
                                ? "Manage assigned areas"
                                : "Activate the worker before editing area assignments"
                            }
                          >
                            <MapIcon size={14} />
                            Manage Areas
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <span
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
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(worker)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-blue-50 hover:text-blue-600"
                              title="Edit worker"
                            >
                              <Pencil size={17} />
                            </button>

                            <StatusAction worker={worker} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE LIST */}
          <div className="divide-y divide-gray-100 md:hidden">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2
                  className="mx-auto animate-spin text-blue-600"
                  size={28}
                />
                <p className="mt-3 text-sm text-gray-500">Loading workers...</p>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">No workers found.</p>
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
                          {worker.first_name} {worker.last_name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {worker.barangays?.name || "No barangay assigned"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          @{worker.username}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${role.className}`}
                          >
                            <RoleIcon size={14} />
                            {role.label}
                          </span>
                          <StatusBadge active={active} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(worker)}
                        className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>

                      <StatusAction worker={worker} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ADD / EDIT MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingWorker ? "Edit Worker" : "Add Worker"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {editingWorker
                      ? "Update worker information and area assignments."
                      : "Create a BNS or BHW account."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="Enter first name"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Enter last name"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="Enter username"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder={
                        editingWorker
                          ? "Leave blank to keep current password"
                          : "Enter password"
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      required={!editingWorker}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bns">
                      BNS - Barangay Nutrition Scholar
                    </option>
                    <option value="bhw">BHW - Barangay Health Worker</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Barangay
                  </label>
                  <select
                    name="barangay_id"
                    value={form.barangay_id}
                    onChange={handleChange}
                    disabled={loadingBarangays}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    required
                  >
                    <option value="">
                      {loadingBarangays
                        ? "Loading barangays..."
                        : "Select Barangay"}
                    </option>
                    {barangays.map((barangay) => (
                      <option key={barangay.id} value={barangay.id}>
                        {barangay.name}
                      </option>
                    ))}
                  </select>
                </div>

                {form.barangay_id && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Assigned Purok / Sitio
                        </label>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Select the areas covered by this worker.
                        </p>
                      </div>

                      {selectedAreas.length > 0 && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                          {selectedAreas.length} selected
                        </span>
                      )}
                    </div>

                    {loadingAreas ? (
                      <div className="flex items-center justify-center rounded-lg border border-gray-200 p-6">
                        <Loader2
                          size={20}
                          className="animate-spin text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-500">
                          Loading areas...
                        </span>
                      </div>
                    ) : localAreas.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center">
                        <MapIcon size={24} className="mx-auto text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">
                          No Purok/Sitio found.
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Add local areas under the Barangays page first.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
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
                                    {area.type}
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
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingWorker ? "Save Changes" : "Add Worker"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ACTIVATE / DEACTIVATE CONFIRMATION */}
        {confirmStatusWorker && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                  confirmStatusWorker.nextStatus ? "bg-green-50" : "bg-red-50"
                }`}
              >
                {confirmStatusWorker.nextStatus ? (
                  <Power size={22} className="text-green-600" />
                ) : (
                  <PowerOff size={22} className="text-red-600" />
                )}
              </div>

              <h3 className="text-lg font-semibold text-gray-800">
                {confirmStatusWorker.nextStatus
                  ? "Activate Worker?"
                  : "Deactivate Worker?"}
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {confirmStatusWorker.nextStatus ? (
                  <>
                    Are you sure you want to activate{" "}
                    <span className="font-medium text-gray-800">
                      {confirmStatusWorker.worker.first_name}{" "}
                      {confirmStatusWorker.worker.last_name}
                    </span>
                    ? The account will be marked active and its valid area
                    assignments will be restored.
                  </>
                ) : (
                  <>
                    Are you sure you want to deactivate{" "}
                    <span className="font-medium text-gray-800">
                      {confirmStatusWorker.worker.first_name}{" "}
                      {confirmStatusWorker.worker.last_name}
                    </span>
                    ? The account will remain in the database, and its active
                    area assignments will be disabled.
                  </>
                )}
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmStatusWorker(null)}
                  disabled={saving}
                  className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleStatusChange}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                    confirmStatusWorker.nextStatus
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {confirmStatusWorker.nextStatus
                    ? "Activate Account"
                    : "Deactivate Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Workers;
