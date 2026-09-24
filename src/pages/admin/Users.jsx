import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  UserRound,
  ShieldCheck,
  Stethoscope,
  Baby,
  Loader2,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [deleteUser, setDeleteUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    role: "nurse",
  });

  // =========================
  // FETCH USERS
  // =========================

  const fetchUsers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .in("role", ["nurse", "midwife"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users.");
    } else {
      setUsers(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
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
    setEditingUser(null);

    setForm({
      first_name: "",
      last_name: "",
      email: "",
      username: "",
      password: "",
      role: "nurse",
    });

    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);

    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      role: user.role || "nurse",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingUser(null);
  };

  // =========================
  // ADD / EDIT USER
  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.first_name.trim() || !form.last_name.trim()) {
      alert("Please enter the user's first and last name.");
      return;
    }

    if (!form.email.trim()) {
      alert("Please enter an email address.");
      return;
    }

    if (!editingUser && !form.password) {
      alert("Please enter a password.");
      return;
    }

    setSaving(true);

    try {
      // =========================
      // EDIT USER
      // =========================

      if (editingUser) {
        const updateData = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          role: form.role,
        };

        // Only update password if entered
        if (form.password.trim()) {
          updateData.password = form.password;
        }

        const { error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", editingUser.id);

        if (error) {
          console.error(error);
          alert(error.message);
          return;
        }

        alert("User updated successfully.");
      }

      // =========================
      // ADD USER
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

        alert("User added successfully.");
      }

      setShowModal(false);
      setEditingUser(null);

      await fetchUsers();
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // DELETE USER
  // =========================

  const handleDelete = async () => {
    if (!deleteUser) return;

    setSaving(true);

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", deleteUser.id);

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      setUsers((current) =>
        current.filter((user) => user.id !== deleteUser.id),
      );

      alert("User deleted successfully.");
    }

    setSaving(false);
    setDeleteUser(null);
  };

  // =========================
  // SEARCH / FILTER
  // =========================

  const filteredUsers = users.filter((user) => {
    const fullName =
      `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();

    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      (user.email || "").toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // =========================
  // ROLE DISPLAY
  // =========================

  const getRoleInfo = (role) => {
    if (role === "nurse") {
      return {
        label: "Nurse",
        className: "bg-blue-50 text-blue-700",
        icon: Stethoscope,
      };
    }

    if (role === "midwife") {
      return {
        label: "Midwife",
        className: "bg-purple-50 text-purple-700",
        icon: Baby,
      };
    }

    return {
      label: role,
      className: "bg-gray-100 text-gray-700",
      icon: UserRound,
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =========================
            PAGE HEADER
        ========================= */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Users
            </h2>

            <p className="text-gray-500 mt-1">
              Manage nurses and midwives in the health records system.
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
            Add User
          </button>
        </div>

        {/* =========================
            USER LIST
        ========================= */}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Filters */}
          <div className="p-4 sm:p-5 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
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
                  placeholder="Search by name or email..."
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

              {/* Role Filter */}
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
                <option value="all">All Roles</option>
                <option value="nurse">Nurse</option>
                <option value="midwife">Midwife</option>
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
                    User
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
                    <td colSpan="4" className="py-12 text-center">
                      <Loader2
                        className="animate-spin mx-auto text-blue-600"
                        size={28}
                      />

                      <p className="text-sm text-gray-500 mt-3">
                        Loading users...
                      </p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center">
                      <div
                        className="
                        w-12 h-12
                        mx-auto
                        rounded-full
                        bg-gray-100
                        flex items-center justify-center
                      "
                      >
                        <UsersIcon />
                      </div>

                      <p className="text-sm text-gray-500 mt-3">
                        No users found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const role = getRoleInfo(user.role);
                    const RoleIcon = role.icon;

                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition">
                        {/* User */}
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
                                {user.first_name} {user.last_name}
                              </p>

                              <p className="text-xs text-gray-400">
                                ID: {user.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.email}
                        </td>

                        {/* Role */}
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

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="
                                w-9 h-9
                                flex items-center justify-center
                                rounded-lg
                                text-gray-500
                                hover:text-blue-600
                                hover:bg-blue-50
                                transition
                              "
                              title="Edit user"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              onClick={() => setDeleteUser(user)}
                              className="
                                w-9 h-9
                                flex items-center justify-center
                                rounded-lg
                                text-gray-500
                                hover:text-red-600
                                hover:bg-red-50
                                transition
                              "
                              title="Delete user"
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
              MOBILE CARDS
          ========================= */}

          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2
                  className="animate-spin mx-auto text-blue-600"
                  size={28}
                />

                <p className="text-sm text-gray-500 mt-3">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">No users found.</p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const role = getRoleInfo(user.role);
                const RoleIcon = role.icon;

                return (
                  <div key={user.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
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

                        <div>
                          <p className="font-medium text-gray-800">
                            {user.first_name} {user.last_name}
                          </p>

                          <p className="text-sm text-gray-500 break-all">
                            {user.email}
                          </p>
                        </div>
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
                          onClick={() => openEditModal(user)}
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
                          onClick={() => setDeleteUser(user)}
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
            {/* Modal Header */}
            <div
              className="
              flex items-center justify-between
              px-6 py-5
              border-b border-gray-200
            "
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingUser ? "Edit User" : "Add User"}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {editingUser
                    ? "Update the user's account information."
                    : "Create a Nurse or Midwife account."}
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* First Name */}
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

              {/* Last Name */}
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

              {/* Email */}
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

              {/* Username */}
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

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>

                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={
                    editingUser
                      ? "Leave blank to keep current password"
                      : "Enter password"
                  }
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
                  required={!editingUser}
                />
              </div>

              {/* Role */}
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
                  <option value="nurse">Nurse</option>
                  <option value="midwife">Midwife</option>
                </select>
              </div>

              {/* Buttons */}
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

                  {editingUser ? "Save Changes" : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================
          DELETE CONFIRMATION
      ========================= */}

      {deleteUser && (
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
              Delete User?
            </h3>

            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-700">
                {deleteUser.first_name} {deleteUser.last_name}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteUser(null)}
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

// Simple icon for empty state
function UsersIcon() {
  return <UserRound size={21} className="text-gray-400" />;
}

export default Users;
