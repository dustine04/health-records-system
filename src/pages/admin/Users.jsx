import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Power,
  CheckCircle2,
  X,
  UserRound,
  Stethoscope,
  Baby,
  Loader2,
  MapPin,
  Building2,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";
import {
  getStaffCache,
  saveStaffCache,
  pendingStaffActions,
  queueStaffAction,
  syncStaffActions,
} from "../../lib/adminStaffOffline";

const getAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  password: "",
  role: "nurse",
  district_id: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getDistrictName(district) {
  return (
    district?.name ||
    district?.district_name ||
    district?.district ||
    `District ${district?.id ?? ""}`
  );
}

function Users() {
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [statusChangeUser, setStatusChangeUser] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);

  const [errorMessage, setErrorMessage] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [cacheReady, setCacheReady] = useState(false);
  const refreshPending = async () => {
    try {
      setPendingCount((await pendingStaffActions(getAdmin())).length);
    } catch (error) {
      console.error(error);
    }
  };
  const refreshCache = async (nextUsers, nextDistricts) => {
    const admin = getAdmin();
    const previous = await getStaffCache(admin);
    await saveStaffCache(
      admin,
      nextUsers ?? previous?.users ?? [],
      nextDistricts ?? previous?.districts ?? [],
    );
  };
  const loadCache = async () => {
    try {
      const cached = await getStaffCache(getAdmin());
      if (cached) {
        setUsers(cached.users || []);
        setDistricts(cached.districts || []);
        setNotice(
          `Cached staff directory from ${new Date(cached.cachedAt).toLocaleString()}.`,
        );
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setCacheReady(true);
    }
  };
  const syncNow = async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const count = await syncStaffActions(getAdmin());
      await refreshPending();
      await fetchUsers();
      await fetchDistricts();
      setNotice(
        count
          ? `${count} staff change(s) synchronized.`
          : "Staff directory refreshed.",
      );
    } catch (error) {
      setErrorMessage(
        `Sync stopped: ${error.message}. Remaining changes are still queued.`,
      );
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);

    try {
      if (!navigator.onLine) return;
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .in("role", ["nurse", "midwife"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers((data || []).map(({ password, ...rest }) => rest));
      await refreshCache(
        (data || []).map(({ password, ...rest }) => rest),
        null,
      );
    } catch (error) {
      console.error("Error fetching users:", error);
      setErrorMessage(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchDistricts = async () => {
    setDistrictsLoading(true);

    try {
      if (!navigator.onLine) return;
      const { data, error } = await supabase.from("districts").select("*");

      if (error) throw error;

      const sorted = (data || []).sort((a, b) =>
        getDistrictName(a).localeCompare(getDistrictName(b)),
      );
      setDistricts(sorted);
      await refreshCache(null, sorted);
    } catch (error) {
      console.error("Error fetching districts:", error);
      setErrorMessage(
        `Failed to load districts. Please verify your districts table: ${error.message}`,
      );
    } finally {
      setDistrictsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadCache();
      if (!mounted) return;
      await fetchUsers();
      await fetchDistricts();
      await refreshPending();
    })();
    const onOnline = () => {
      setOnline(true);
      syncNow();
    };
    const onOffline = () => {
      setOnline(false);
      setNotice("Offline mode: account changes are pending until synced.");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const districtMap = useMemo(() => {
    return new Map(
      districts.map((district) => [
        String(district.id),
        getDistrictName(district),
      ]),
    );
  }, [districts]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();

      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.username || "").toLowerCase().includes(query);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const openAddModal = () => {
    setEditingUser(null);
    setForm({ ...INITIAL_FORM });
    setErrorMessage("");
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
      district_id: user.district_id ? String(user.district_id) : "",
    });

    setErrorMessage("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingUser(null);
    setForm({ ...INITIAL_FORM });
    setErrorMessage("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setErrorMessage("Please enter the user's first and last name.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Please enter an email address.");
      return;
    }

    if (!form.username.trim()) {
      setErrorMessage("Please enter a username.");
      return;
    }

    if (!form.district_id) {
      setErrorMessage("Please assign a district to this user.");
      return;
    }

    if (!editingUser && !form.password.trim()) {
      setErrorMessage("Please enter a password.");
      return;
    }

    const districtExists = districts.some(
      (district) => String(district.id) === String(form.district_id),
    );

    if (!districtExists) {
      setErrorMessage(
        "The selected district is invalid. Please select a district again.",
      );
      return;
    }

    setSaving(true);

    try {
      const userData = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        role: form.role,
        district_id: Number(form.district_id),
      };

      if (form.password.trim()) {
        userData.password = form.password;
      }

      if (!navigator.onLine) {
        if (!editingUser)
          throw new Error("Creating accounts requires an internet connection.");
        if (form.password.trim())
          throw new Error("Password changes require an internet connection.");
        const expected = Object.fromEntries(
          ["first_name", "last_name", "email", "username", "district_id"].map(
            (k) => [k, editingUser[k]],
          ),
        );
        await queueStaffAction(getAdmin(), {
          type: "edit",
          userId: editingUser.id,
          changes: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email,
            username: userData.username,
            district_id: userData.district_id,
          },
          expected,
        });
        await refreshPending();
        setNotice(
          "Staff edit queued offline. It is not applied until sync succeeds.",
        );
        setShowModal(false);
        setEditingUser(null);
        setForm({ ...INITIAL_FORM });
        return;
      }
      if (editingUser) {
        const { error } = await supabase
          .from("users")
          .update(userData)
          .eq("id", editingUser.id);

        if (error) throw error;

        alert("User updated successfully.");
      } else {
        // District assignment is saved with the new account.
        userData.password = form.password;

        const { error } = await supabase.from("users").insert([userData]);

        if (error) throw error;

        alert("User created successfully.");
      }

      setShowModal(false);
      setEditingUser(null);
      setForm({ ...INITIAL_FORM });

      await fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      setErrorMessage(error.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusChangeUser) return;

    const user = statusChangeUser;
    const currentlyActive = user.is_active !== false;
    const nextStatus = !currentlyActive;

    setSaving(true);

    try {
      if (!navigator.onLine) {
        await queueStaffAction(getAdmin(), {
          type: "status",
          userId: user.id,
          active: nextStatus,
          expectedActive: user.is_active !== false,
        });
        await refreshPending();
        setNotice(
          "Account status change queued offline; it is not active until synchronization.",
        );
        setStatusChangeUser(null);
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .update({ is_active: nextStatus })
        .eq("id", user.id)
        .select(
          "id,first_name,last_name,email,username,role,district_id,is_active,created_at",
        )
        .single();

      if (error) throw error;

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, ...data, is_active: nextStatus }
            : item,
        ),
      );

      setStatusChangeUser(null);
      alert(
        nextStatus
          ? "User account activated successfully."
          : "User account deactivated successfully.",
      );
    } catch (error) {
      console.error("Error updating account status:", error);
      alert(
        error.message ||
          `Failed to ${nextStatus ? "activate" : "deactivate"} the account. Verify that the users table has an is_active column.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const getRoleInfo = (role) => {
    if (role === "nurse") {
      return {
        label: "Nurse",
        icon: Stethoscope,
        className: "bg-blue-50 text-blue-700",
      };
    }

    return {
      label: "Midwife",
      icon: Baby,
      className: "bg-purple-50 text-purple-700",
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              Staff Management
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create staff accounts, assign districts, and deactivate accounts
              without deleting historical records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm">
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}{" "}
              {online ? "Online" : "Offline"}
            </span>
            <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pendingCount} pending
            </span>
            <button
              type="button"
              onClick={syncNow}
              disabled={!online || syncing}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              Sync Now
            </button>
            <button
              type="button"
              disabled={!online}
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Staff
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {notice}
          </div>
        )}
        {/* Error message */}
        {errorMessage && !showModal && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Search and filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search name, email, or username..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className={inputClass + " md:w-48"}
            >
              <option value="all">All Staff</option>
              <option value="nurse">Nurses</option>
              <option value="midwife">Midwives</option>
            </select>
          </div>
        </div>

        {/* Staff table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="font-semibold text-gray-800">
                Nurses and Midwives
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {filteredUsers.length} staff account(s)
              </p>
            </div>
          </div>

          {(loading || districtsLoading) && !cacheReady ? (
            <div className="py-16 text-center">
              <Loader2
                size={30}
                className="mx-auto animate-spin text-blue-600"
              />
              <p className="mt-3 text-sm text-gray-500">
                Loading staff and districts...
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                        Staff Member
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                        Email
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                        Role
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                        Assigned District
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                        Account Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => {
                      const role = getRoleInfo(user.role);
                      const RoleIcon = role.icon;

                      return (
                        <tr
                          key={user.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                <UserRound
                                  size={19}
                                  className="text-gray-600"
                                />
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

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {user.email || "—"}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${role.className}`}
                            >
                              <RoleIcon size={14} />
                              {role.label}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <MapPin size={16} className="text-gray-400" />
                              {districtMap.get(String(user.district_id)) ||
                                "Not assigned"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                user.is_active === false
                                  ? "bg-red-50 text-red-700"
                                  : "bg-green-50 text-green-700"
                              }`}
                            >
                              {user.is_active === false ? "Inactive" : "Active"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                title="Edit staff"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Pencil size={17} />
                              </button>

                              {user.is_active === false ? (
                                <button
                                  type="button"
                                  onClick={() => setStatusChangeUser(user)}
                                  title="Activate staff account"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-green-600 transition hover:bg-green-50 hover:text-green-700"
                                >
                                  <CheckCircle2 size={18} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setStatusChangeUser(user)}
                                  title="Deactivate staff account"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600"
                                >
                                  <Power size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-gray-500"
                        >
                          No staff accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-gray-100 md:hidden">
                {filteredUsers.map((user) => {
                  const role = getRoleInfo(user.role);
                  const RoleIcon = role.icon;

                  return (
                    <div key={user.id} className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <UserRound size={19} className="text-gray-600" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="break-all text-sm text-gray-500">
                            {user.email || "No email"}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            ID: {user.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${role.className}`}
                        >
                          <RoleIcon size={14} />
                          {role.label}
                        </span>

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                          <MapPin size={13} />
                          {districtMap.get(String(user.district_id)) ||
                            "Not assigned"}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.is_active === false
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {user.is_active === false ? "Inactive" : "Active"}
                        </span>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>

                        {user.is_active === false ? (
                          <button
                            type="button"
                            onClick={() => setStatusChangeUser(user)}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                          >
                            <CheckCircle2 size={15} />
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setStatusChangeUser(user)}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                          >
                            <Power size={15} />
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <p className="px-6 py-12 text-center text-sm text-gray-500">
                    No staff accounts found.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Add/Edit modal */}
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingUser ? "Edit Staff Account" : "Add Staff Account"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Assign the staff member to a district.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              {errorMessage && (
                <div className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <input
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="First name"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <input
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="staff@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder={
                      editingUser
                        ? "Leave blank to keep current password"
                        : "Enter password"
                    }
                    required={!editingUser}
                  />
                </div>

                {/* Staff Role */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Staff Role
                  </label>

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className={`${inputClass} ${
                      editingUser
                        ? "cursor-not-allowed bg-gray-100 text-gray-500"
                        : ""
                    }`}
                    required
                    disabled={!!editingUser}
                  >
                    <option value="nurse">Nurse</option>
                    <option value="midwife">Midwife</option>
                  </select>

                  {editingUser && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      The staff role cannot be changed after the account is
                      created.
                    </p>
                  )}
                </div>

                {/* District assignment */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Building2 size={16} className="text-blue-600" />
                    Assigned District
                  </label>

                  <select
                    name="district_id"
                    value={form.district_id}
                    onChange={handleChange}
                    className={inputClass}
                    required
                    disabled={districtsLoading || districts.length === 0}
                  >
                    <option value="">
                      {districtsLoading
                        ? "Loading districts..."
                        : districts.length === 0
                          ? "No districts available"
                          : "Select a district"}
                    </option>

                    {districts.map((district) => (
                      <option key={district.id} value={String(district.id)}>
                        {getDistrictName(district)}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1.5 text-xs text-gray-500">
                    This determines the district associated with the nurse or
                    midwife account.
                  </p>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
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
                    disabled={
                      saving || districtsLoading || districts.length === 0
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingUser ? "Save Changes" : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Activate / Deactivate confirmation */}
        {statusChangeUser &&
          (() => {
            const isCurrentlyActive = statusChangeUser.is_active !== false;
            const action = isCurrentlyActive ? "Deactivate" : "Activate";
            const ActionIcon = isCurrentlyActive ? Power : CheckCircle2;

            return (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                      isCurrentlyActive ? "bg-red-50" : "bg-green-50"
                    }`}
                  >
                    <ActionIcon
                      size={22}
                      className={
                        isCurrentlyActive ? "text-red-600" : "text-green-600"
                      }
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800">
                    {action} Staff Account?
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Are you sure you want to {action.toLowerCase()} the account
                    for{" "}
                    <span className="font-medium text-gray-800">
                      {statusChangeUser.first_name} {statusChangeUser.last_name}
                    </span>
                    ?{" "}
                    {isCurrentlyActive
                      ? "The account will be marked inactive. Historical records and related data will be preserved."
                      : "The account will be marked active again. Historical records and related data will be preserved."}
                  </p>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setStatusChangeUser(null)}
                      disabled={saving}
                      className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleStatus}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isCurrentlyActive
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ActionIcon size={16} />
                      )}
                      {saving ? `${action}ing...` : `${action} Account`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    </DashboardLayout>
  );
}

export default Users;
