import { useEffect, useState } from "react";

import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  UserRound,
  Baby,
  HeartPulse,
  Loader2,
  MapPin,
  Map as MapIcon,
  Check,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";

import { supabase } from "../../lib/supabase";

function Workers() {
  // =========================

  // WORKERS

  // =========================

  const [workers, setWorkers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [roleFilter, setRoleFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);

  const [editingWorker, setEditingWorker] = useState(null);

  const [deleteWorker, setDeleteWorker] = useState(null);

  const [saving, setSaving] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // =========================

  // BARANGAYS / LOCAL AREAS

  // =========================

  const [barangays, setBarangays] = useState([]);

  const [localAreas, setLocalAreas] = useState([]);

  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const [loadingAreas, setLoadingAreas] = useState(false);

  // =========================

  // FORM

  // =========================

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

  // =========================

  // FETCH WORKERS

  // =========================

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
      alert(
        "Failed to load workers created by your account. Confirm that the created_by_midwife_id column exists.",
      );
    } else {
      setWorkers(data || []);
    }

    setLoading(false);
  };

  // =========================

  // FETCH BARANGAYS

  // =========================

  const fetchBarangays = async () => {
    setLoadingBarangays(true);

    const currentUser = getCurrentUser();
    if (!currentUser?.district_id) {
      setBarangays([]);
      setLoadingBarangays(false);
      console.error(
        "The logged-in midwife has no district_id in localStorage user data.",
      );
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
    } else {
      setBarangays(data || []);
    }

    setLoadingBarangays(false);
  };

  useEffect(() => {
    fetchWorkers();

    fetchBarangays();
  }, []);

  // =========================

  // FETCH LOCAL AREAS

  // =========================

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

  // =========================

  // FETCH WORKER AREAS

  // =========================

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

  // =========================

  // FORM CHANGE

  // =========================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,

      [name]: value,
    }));

    // When barangay changes,

    // clear selected areas and load new areas

    if (name === "barangay_id") {
      setSelectedAreas([]);

      fetchLocalAreas(value);
    }
  };

  // =========================

  // ADD MODAL

  // =========================

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

  // =========================

  // EDIT MODAL

  // =========================

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

    // Load areas for worker's barangay

    if (worker.barangay_id) {
      await fetchLocalAreas(worker.barangay_id);

      const assignments = await fetchWorkerAreas(worker.id);

      const areaIds = assignments

        .map((assignment) => assignment.local_area_id)

        .filter(Boolean);

      setSelectedAreas(areaIds);
    }
  };

  // =========================

  // CLOSE MODAL

  // =========================

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);

    setEditingWorker(null);

    setShowPassword(false);

    setSelectedAreas([]);

    setLocalAreas([]);
  };

  // =========================

  // TOGGLE AREA

  // =========================

  const toggleArea = (areaId) => {
    setSelectedAreas((current) => {
      if (current.includes(areaId)) {
        return current.filter((id) => id !== areaId);
      }

      return [...current, areaId];
    });
  };

  // =========================

  // SAVE AREA ASSIGNMENTS

  // =========================

  const saveAreaAssignments = async (workerId) => {
    // First deactivate existing assignments

    const { error: deactivateError } = await supabase

      .from("worker_area_assignments")

      .update({
        is_active: false,
      })

      .eq("worker_id", workerId);

    if (deactivateError) {
      throw deactivateError;
    }

    // Nothing selected

    if (selectedAreas.length === 0) {
      return;
    }

    // Check existing assignments

    const { data: existingAssignments, error: existingError } = await supabase

      .from("worker_area_assignments")

      .select("id, local_area_id")

      .eq("worker_id", workerId);

    if (existingError) {
      throw existingError;
    }

    const existingMap = new Map(
      (existingAssignments || []).map((item) => [item.local_area_id, item.id]),
    );

    // Reactivate existing assignments or create new ones

    for (const areaId of selectedAreas) {
      const existingId = existingMap.get(areaId);

      if (existingId) {
        const { error } = await supabase

          .from("worker_area_assignments")

          .update({
            is_active: true,
          })

          .eq("id", existingId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase

          .from("worker_area_assignments")

          .insert([
            {
              worker_id: workerId,

              local_area_id: areaId,

              assigned_by: getCurrentUserId(),

              is_active: true,
            },
          ]);

        if (error) {
          throw error;
        }
      }
    }
  };

  // =========================

  // CURRENT LOGGED-IN USER

  // =========================

  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
      console.error("Error reading current user:", error);
      return null;
    }
  };

  const getCurrentUserId = () => {
    return getCurrentUser()?.id || null;
  };

  // =========================

  // ADD / EDIT WORKER

  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser?.id || currentUser.role !== "midwife") {
      alert(
        "Only the logged-in midwife can manage BNS/BHW accounts here. Please sign in again.",
      );
      return;
    }

    if (!currentUser.district_id) {
      alert(
        "Your midwife account has no assigned district. Ask the CHO administrator to assign your district.",
      );
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
      // =========================

      // EDIT

      // =========================

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

        const { error } = await supabase

          .from("users")

          .update(updateData)
          .eq("id", editingWorker.id)
          .eq("created_by_midwife_id", currentUser.id);

        if (error) {
          console.error(error);

          alert(error.message);

          return;
        }

        await saveAreaAssignments(editingWorker.id);

        alert("Worker updated successfully.");
      }

      // =========================

      // ADD

      // =========================
      else {
        const { data, error } = await supabase

          .from("users")

          .insert([
            {
              first_name: form.first_name.trim(),

              last_name: form.last_name.trim(),

              email: form.email.trim(),

              username: form.username.trim(),

              password: form.password,

              role: form.role,

              barangay_id: Number(form.barangay_id),
              created_by_midwife_id: currentUser.id,
            },
          ])

          .select()

          .single();

        if (error) {
          console.error(error);

          alert(error.message);

          return;
        }

        // Assign areas to new worker

        if (data?.id) {
          await saveAreaAssignments(data.id);
        }

        alert(
          `${form.role === "bns" ? "BNS" : "BHW"} account added successfully.`,
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

  // =========================

  // DELETE

  // =========================

  const handleDelete = async () => {
    if (!deleteWorker) return;

    setSaving(true);

    try {
      const { error } = await supabase

        .from("users")

        .delete()
        .eq("id", deleteWorker.id)
        .eq("created_by_midwife_id", getCurrentUserId());

      if (error) {
        console.error(error);

        alert(error.message);

        return;
      }

      setWorkers((current) =>
        current.filter((worker) => worker.id !== deleteWorker.id),
      );

      alert("Worker deleted successfully.");
    } catch (error) {
      console.error(error);

      alert(error.message || "Failed to delete worker.");
    } finally {
      setSaving(false);

      setDeleteWorker(null);
    }
  };

  // =========================

  // SEARCH / FILTER

  // =========================

  const filteredWorkers = workers.filter((worker) => {
    const fullName =
      `${worker.first_name || ""} ${worker.last_name || ""}`.toLowerCase();

    const searchValue = search.toLowerCase();

    const matchesSearch =
      fullName.includes(searchValue) ||
      (worker.email || "").toLowerCase().includes(searchValue) ||
      (worker.username || "").toLowerCase().includes(searchValue);

    const matchesRole = roleFilter === "all" || worker.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // =========================

  // ROLE INFO

  // =========================

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =========================

            HEADER

        ========================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              BNS & BHW
            </h2>

            <p className="mt-1 text-gray-500">
              Manage Barangay Nutrition Scholars and Barangay Health Workers.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="

              inline-flex items-center justify-center gap-2

              rounded-lg

              bg-blue-600

              px-4 py-2.5

              text-sm font-medium

              text-white

              transition

              hover:bg-blue-700

            "
          >
            <Plus size={18} />
            Add Worker
          </button>
        </div>

        {/* =========================

            LIST

        ========================= */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* FILTERS */}

          <div className="border-b border-gray-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              {/* SEARCH */}

              <div className="relative flex-1">
                <Search
                  size={18}
                  className="

                    absolute left-3 top-1/2

                    -translate-y-1/2

                    text-gray-400

                  "
                />

                <input
                  type="text"
                  placeholder="Search by name, username, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="

                    w-full

                    rounded-lg

                    border border-gray-300

                    py-2.5 pl-10 pr-4

                    text-sm

                    outline-none

                    focus:border-blue-500

                    focus:ring-2

                    focus:ring-blue-500

                  "
                />
              </div>

              {/* ROLE */}

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="

                  rounded-lg

                  border border-gray-300

                  bg-white

                  px-4 py-2.5

                  text-sm

                  outline-none

                  focus:ring-2

                  focus:ring-blue-500

                "
              >
                <option value="all">All Workers</option>

                <option value="bns">BNS</option>

                <option value="bhw">BHW</option>
              </select>
            </div>
          </div>

          {/* =========================

              DESKTOP TABLE

          ========================= */}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Worker
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Barangay
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Areas
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Role
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center">
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
                    <td colSpan="5" className="py-12 text-center">
                      <div
                        className="

                          mx-auto

                          flex h-12 w-12

                          items-center justify-center

                          rounded-full

                          bg-gray-100

                        "
                      >
                        <UserRound size={21} className="text-gray-400" />
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
                        No workers found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((worker) => {
                    const role = getRoleInfo(worker.role);

                    const RoleIcon = role.icon;

                    return (
                      <tr
                        key={worker.id}
                        className="transition hover:bg-gray-50"
                      >
                        {/* WORKER */}

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="

                                flex h-10 w-10

                                items-center justify-center

                                rounded-full

                                bg-blue-50

                              "
                            >
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

                        {/* BARANGAY */}

                        <td className="px-6 py-4">
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

                        {/* AREAS */}

                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => openEditModal(worker)}
                            className="

                              inline-flex items-center gap-1.5

                              rounded-lg

                              bg-blue-50

                              px-2.5 py-1.5

                              text-xs font-medium

                              text-blue-600

                              transition

                              hover:bg-blue-100

                            "
                          >
                            <MapIcon size={14} />
                            Manage Areas
                          </button>
                        </td>

                        {/* ROLE */}

                        <td className="px-6 py-4">
                          <span
                            className={`

                              inline-flex items-center gap-1.5

                              rounded-full

                              px-2.5 py-1

                              text-xs font-medium

                              ${role.className}

                            `}
                          >
                            <RoleIcon size={14} />

                            {role.label}
                          </span>
                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(worker)}
                              className="

                                flex h-9 w-9

                                items-center justify-center

                                rounded-lg

                                text-gray-500

                                transition

                                hover:bg-blue-50

                                hover:text-blue-600

                              "
                              title="Edit worker"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              onClick={() => setDeleteWorker(worker)}
                              className="

                                flex h-9 w-9

                                items-center justify-center

                                rounded-lg

                                text-gray-500

                                transition

                                hover:bg-red-50

                                hover:text-red-600

                              "
                              title="Delete worker"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* =========================

              MOBILE

          ========================= */}

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

                return (
                  <div key={worker.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="

                          flex h-10 w-10

                          shrink-0

                          items-center justify-center

                          rounded-full

                          bg-blue-50

                        "
                      >
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
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className={`

                          inline-flex items-center gap-1.5

                          rounded-full

                          px-2.5 py-1

                          text-xs font-medium

                          ${role.className}

                        `}
                      >
                        <RoleIcon size={14} />

                        {role.label}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(worker)}
                          className="

                            flex h-9 w-9

                            items-center justify-center

                            rounded-lg

                            text-gray-500

                            hover:bg-blue-50

                            hover:text-blue-600

                          "
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => setDeleteWorker(worker)}
                          className="

                            flex h-9 w-9

                            items-center justify-center

                            rounded-lg

                            text-gray-500

                            hover:bg-red-50

                            hover:text-red-600

                          "
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =====================================================

          ADD / EDIT WORKER MODAL

      ===================================================== */}

      {showModal && (
        <div
          className="

            fixed inset-0 z-[60]

            flex items-center justify-center

            bg-black/40

            p-4

          "
        >
          <div
            className="

              max-h-[90vh]

              w-full max-w-lg

              overflow-y-auto

              rounded-2xl

              bg-white

              shadow-xl

            "
          >
            {/* HEADER */}

            <div
              className="

                flex items-center justify-between

                border-b border-gray-200

                px-6 py-5

              "
            >
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
                onClick={closeModal}
                className="

                  flex h-9 w-9

                  items-center justify-center

                  rounded-lg

                  text-gray-400

                  hover:bg-gray-100

                  hover:text-gray-600

                "
              >
                <X size={20} />
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* FIRST / LAST NAME */}

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
                    className="

                      w-full

                      rounded-lg

                      border border-gray-300

                      px-4 py-2.5

                      text-sm

                      outline-none

                      focus:border-blue-500

                      focus:ring-2

                      focus:ring-blue-500

                    "
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
                    className="

                      w-full

                      rounded-lg

                      border border-gray-300

                      px-4 py-2.5

                      text-sm

                      outline-none

                      focus:border-blue-500

                      focus:ring-2

                      focus:ring-blue-500

                    "
                    required
                  />
                </div>
              </div>

              {/* EMAIL */}

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
                  className="

                    w-full

                    rounded-lg

                    border border-gray-300

                    px-4 py-2.5

                    text-sm

                    outline-none

                    focus:border-blue-500

                    focus:ring-2

                    focus:ring-blue-500

                  "
                  required
                />
              </div>

              {/* USERNAME */}

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
                  className="

                    w-full

                    rounded-lg

                    border border-gray-300

                    px-4 py-2.5

                    text-sm

                    outline-none

                    focus:border-blue-500

                    focus:ring-2

                    focus:ring-blue-500

                  "
                  required
                />
              </div>

              {/* PASSWORD */}

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
                    className="

                      w-full

                      rounded-lg

                      border border-gray-300

                      px-4 py-2.5 pr-11

                      text-sm

                      outline-none

                      focus:border-blue-500

                      focus:ring-2

                      focus:ring-blue-500

                    "
                    required={!editingWorker}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="

                      absolute right-3 top-1/2

                      -translate-y-1/2

                      text-gray-400

                      hover:text-gray-600

                    "
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* ROLE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Role
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="

                    w-full

                    rounded-lg

                    border border-gray-300

                    bg-white

                    px-4 py-2.5

                    text-sm

                    outline-none

                    focus:ring-2

                    focus:ring-blue-500

                  "
                >
                  <option value="bns">BNS - Barangay Nutrition Scholar</option>

                  <option value="bhw">BHW - Barangay Health Worker</option>
                </select>
              </div>

              {/* BARANGAY */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Barangay
                </label>

                <select
                  name="barangay_id"
                  value={form.barangay_id}
                  onChange={handleChange}
                  disabled={loadingBarangays}
                  className="

                    w-full

                    rounded-lg

                    border border-gray-300

                    bg-white

                    px-4 py-2.5

                    text-sm

                    outline-none

                    focus:ring-2

                    focus:ring-blue-500

                    disabled:bg-gray-100

                  "
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

              {/* LOCAL AREAS */}

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
                        const isSelected = selectedAreas.includes(area.id);

                        return (
                          <button
                            key={area.id}
                            type="button"
                            onClick={() => toggleArea(area.id)}
                            className={`

                              flex w-full items-center

                              justify-between

                              border-b border-gray-100

                              px-4 py-3

                              text-left

                              last:border-b-0

                              transition

                              ${
                                isSelected
                                  ? "bg-blue-50"
                                  : "bg-white hover:bg-gray-50"
                              }

                            `}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`

                                  flex h-9 w-9

                                  items-center justify-center

                                  rounded-lg

                                  ${
                                    isSelected
                                      ? "bg-blue-100 text-blue-600"
                                      : "bg-gray-100 text-gray-500"
                                  }

                                `}
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
                              className={`

                                flex h-5 w-5

                                items-center justify-center

                                rounded border

                                ${
                                  isSelected
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-gray-300 bg-white"
                                }

                              `}
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

              {/* BUTTONS */}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="

                    rounded-lg

                    bg-gray-100

                    px-4 py-2.5

                    text-sm font-medium

                    text-gray-600

                    transition

                    hover:bg-gray-200

                  "
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="

                    inline-flex items-center gap-2

                    rounded-lg

                    bg-blue-600

                    px-5 py-2.5

                    text-sm font-medium

                    text-white

                    transition

                    hover:bg-blue-700

                    disabled:opacity-50

                  "
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}

                  {editingWorker ? "Save Changes" : "Add Worker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================

          DELETE MODAL

      ===================================================== */}

      {deleteWorker && (
        <div
          className="

            fixed inset-0 z-[70]

            flex items-center justify-center

            bg-black/40

            p-4

          "
        >
          <div
            className="

              w-full max-w-md

              rounded-2xl

              bg-white

              p-6

              shadow-xl

            "
          >
            <div
              className="

                mb-4

                flex h-12 w-12

                items-center justify-center

                rounded-full

                bg-red-50

              "
            >
              <Trash2 size={22} className="text-red-600" />
            </div>

            <h3 className="text-lg font-semibold text-gray-800">
              Delete Worker?
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-700">
                {deleteWorker.first_name} {deleteWorker.last_name}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteWorker(null)}
                disabled={saving}
                className="

                  rounded-lg

                  bg-gray-100

                  px-4 py-2.5

                  text-sm font-medium

                  text-gray-600

                  hover:bg-gray-200

                "
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={saving}
                className="

                  inline-flex items-center gap-2

                  rounded-lg

                  bg-red-600

                  px-4 py-2.5

                  text-sm font-medium

                  text-white

                  hover:bg-red-700

                  disabled:opacity-50

                "
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// =====================================================

// EYE ICONS

// =====================================================

function EyeIcon() {
  return (
    <svg
      xmlns="http\://www\.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />

      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http\://www\.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-.5-1.5" />

      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />

      <path d="m3 3 18 18" />

      <path d="M10.584 10.584a3 3 0 0 0 4.243 4.243" />
    </svg>
  );
}

export default Workers;
