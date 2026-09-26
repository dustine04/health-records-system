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
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);

  const [deleteWorker, setDeleteWorker] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    role: "bns",
  });

  // =========================
  // FETCH BNS / BHW
  // =========================

  const fetchWorkers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .in("role", ["bns", "bhw"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching workers:", error);
      alert("Failed to load BNS and BHW accounts.");
    } else {
      setWorkers(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  // =========================
  // FORM
  // =========================

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const openAddModal = () => {
    setEditingWorker(null);

    setForm({
      first_name: "",
      last_name: "",
      email: "",
      username: "",
      password: "",
      role: "bns",
    });

    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (worker) => {
    setEditingWorker(worker);

    setForm({
      first_name: worker.first_name || "",
      last_name: worker.last_name || "",
      email: worker.email || "",
      username: worker.username || "",
      password: "",
      role: worker.role || "bns",
    });

    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingWorker(null);
    setShowPassword(false);
  };

  // =========================
  // ADD / EDIT WORKER
  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

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
        };

        // Only change password when entered
        if (form.password.trim()) {
          updateData.password = form.password;
        }

        const { error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", editingWorker.id);

        if (error) {
          console.error(error);
          alert(error.message);
          return;
        }

        alert("Worker updated successfully.");
      }

      // =========================
      // ADD
      // =========================
      else {
        const { error } = await supabase.from("users").insert([
          {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            username: form.username.trim(),
            password: form.password,
            role: form.role,
          },
        ]);

        if (error) {
          console.error(error);
          alert(error.message);
          return;
        }

        alert(
          `${form.role === "bns" ? "BNS" : "BHW"} account added successfully.`,
        );
      }

      setShowModal(false);
      setEditingWorker(null);

      await fetchWorkers();
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

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", deleteWorker.id);

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      setWorkers((current) =>
        current.filter((worker) => worker.id !== deleteWorker.id),
      );

      alert("Worker deleted successfully.");
    }

    setSaving(false);
    setDeleteWorker(null);
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
              BNS & BHW
            </h2>

            <p className="text-gray-500 mt-1">
              Manage Barangay Nutrition Scholars and Barangay Health Workers.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="
              inline-flex items-center justify-center gap-2
              bg-blue-600 hover:bg-blue-700
              text-white
              px-4 py-2.5
              rounded-lg
              text-sm font-medium
              transition
            "
          >
            <Plus size={18} />
            Add Worker
          </button>
        </div>

        {/* =========================
            LIST
        ========================= */}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* FILTERS */}

          <div className="p-4 sm:p-5 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-3">
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
                    pl-10 pr-4 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                    focus:border-blue-500
                  "
                />
              </div>

              {/* ROLE */}

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="
                  px-4 py-2.5
                  border border-gray-300
                  rounded-lg
                  text-sm
                  bg-white
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

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    Worker
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    Username
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    Email
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    Role
                  </th>

                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center">
                      <Loader2
                        className="animate-spin mx-auto text-blue-600"
                        size={28}
                      />

                      <p className="text-sm text-gray-500 mt-3">
                        Loading workers...
                      </p>
                    </td>
                  </tr>
                ) : filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center">
                      <div
                        className="
                          w-12 h-12
                          mx-auto
                          rounded-full
                          bg-gray-100
                          flex items-center justify-center
                        "
                      >
                        <UserRound size={21} className="text-gray-400" />
                      </div>

                      <p className="text-sm text-gray-500 mt-3">
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
                        className="hover:bg-gray-50 transition"
                      >
                        {/* WORKER */}

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="
                                w-10 h-10
                                rounded-full
                                bg-blue-50
                                flex items-center justify-center
                              "
                            >
                              <UserRound size={19} className="text-blue-600" />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {worker.first_name} {worker.last_name}
                              </p>

                              <p className="text-xs text-gray-400">
                                ID: {worker.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* USERNAME */}

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {worker.username}
                        </td>

                        {/* EMAIL */}

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {worker.email}
                        </td>

                        {/* ROLE */}

                        <td className="px-6 py-4">
                          <span
                            className={`
                              inline-flex items-center gap-1.5
                              px-2.5 py-1
                              rounded-full
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
                                w-9 h-9
                                flex items-center justify-center
                                rounded-lg
                                text-gray-500
                                hover:text-blue-600
                                hover:bg-blue-50
                                transition
                              "
                              title="Edit worker"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              onClick={() => setDeleteWorker(worker)}
                              className="
                                w-9 h-9
                                flex items-center justify-center
                                rounded-lg
                                text-gray-500
                                hover:text-red-600
                                hover:bg-red-50
                                transition
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

          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2
                  className="animate-spin mx-auto text-blue-600"
                  size={28}
                />

                <p className="text-sm text-gray-500 mt-3">Loading workers...</p>
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
                          w-10 h-10
                          rounded-full
                          bg-blue-50
                          flex items-center justify-center
                          flex-shrink-0
                        "
                      >
                        <UserRound size={19} className="text-blue-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800">
                          {worker.first_name} {worker.last_name}
                        </p>

                        <p className="text-sm text-gray-500 break-all">
                          {worker.email}
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          @{worker.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <span
                        className={`
                          inline-flex items-center gap-1.5
                          px-2.5 py-1
                          rounded-full
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
                            w-9 h-9
                            flex items-center justify-center
                            rounded-lg
                            text-gray-500
                            hover:text-blue-600
                            hover:bg-blue-50
                          "
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => setDeleteWorker(worker)}
                          className="
                            w-9 h-9
                            flex items-center justify-center
                            rounded-lg
                            text-gray-500
                            hover:text-red-600
                            hover:bg-red-50
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

      {/* =========================
          ADD / EDIT MODAL
      ========================= */}

      {showModal && (
        <div
          className="
            fixed inset-0 z-[60]
            bg-black/40
            flex items-center justify-center
            p-4
          "
        >
          <div
            className="
              bg-white
              w-full max-w-lg
              rounded-2xl
              shadow-xl
              max-h-[90vh]
              overflow-y-auto
            "
          >
            {/* HEADER */}

            <div
              className="
                flex items-center justify-between
                px-6 py-5
                border-b border-gray-200
              "
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingWorker ? "Edit Worker" : "Add Worker"}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {editingWorker
                    ? "Update the worker's account information."
                    : "Create a BNS or BHW account."}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="
                  w-9 h-9
                  flex items-center justify-center
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

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* FIRST NAME */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    px-4 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                  required
                />
              </div>

              {/* LAST NAME */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    px-4 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                  required
                />
              </div>

              {/* EMAIL */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    px-4 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                  required
                />
              </div>

              {/* USERNAME */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    px-4 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                  required
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                      px-4 py-2.5 pr-11
                      border border-gray-300
                      rounded-lg
                      text-sm
                      outline-none
                      focus:ring-2
                      focus:ring-blue-500
                    "
                    required={!editingWorker}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="
                      absolute
                      right-3
                      top-1/2
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="
                    w-full
                    px-4 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    bg-white
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                >
                  <option value="bns">BNS - Barangay Nutrition Scholar</option>

                  <option value="bhw">BHW - Barangay Health Worker</option>
                </select>
              </div>

              {/* BUTTONS */}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="
                    px-4 py-2.5
                    rounded-lg
                    text-sm font-medium
                    text-gray-600
                    bg-gray-100
                    hover:bg-gray-200
                    transition
                  "
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="
                    inline-flex items-center gap-2
                    px-5 py-2.5
                    rounded-lg
                    text-sm font-medium
                    text-white
                    bg-blue-600
                    hover:bg-blue-700
                    disabled:opacity-50
                    transition
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

      {/* =========================
          DELETE MODAL
      ========================= */}

      {deleteWorker && (
        <div
          className="
            fixed inset-0 z-[70]
            bg-black/40
            flex items-center justify-center
            p-4
          "
        >
          <div
            className="
              bg-white
              w-full max-w-md
              rounded-2xl
              shadow-xl
              p-6
            "
          >
            <div
              className="
                w-12 h-12
                rounded-full
                bg-red-50
                flex items-center justify-center
                mb-4
              "
            >
              <Trash2 size={22} className="text-red-600" />
            </div>

            <h3 className="text-lg font-semibold text-gray-800">
              Delete Worker?
            </h3>

            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-700">
                {deleteWorker.first_name} {deleteWorker.last_name}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteWorker(null)}
                disabled={saving}
                className="
                  px-4 py-2.5
                  rounded-lg
                  text-sm font-medium
                  bg-gray-100
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
                  px-4 py-2.5
                  rounded-lg
                  text-sm font-medium
                  bg-red-600
                  hover:bg-red-700
                  text-white
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

// Simple eye icons
function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      xmlns="http://www.w3.org/2000/svg"
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
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-1.468 2.582" />
      <path d="m3 3 18 18" />
      <path d="M10.584 10.584a3 3 0 0 0 4.243 4.243" />
    </svg>
  );
}

export default Workers;
