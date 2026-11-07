import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const ROLE_NAMES = {
  cho_admin: "CHO Administrator",
  it_admin: "IT Administrator",
  nurse: "Nurse",
  midwife: "Midwife",
  bns: "BNS",
  bhw: "BHW",
};

const nameOf = (user) =>
  [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ") || user.username;

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState({});
  const [barangays, setBarangays] = useState({});

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [confirmUser, setConfirmUser] = useState(null);

  // ==========================================
  // LOAD USERS, DISTRICTS, AND BARANGAYS
  // ==========================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [u, d, b] = await Promise.all([
        supabase
          .from("users")
          .select(
            "id,username,first_name,middle_name,last_name,role,is_active,district_id,barangay_id,created_at",
          )
          .order("id", { ascending: false })
          .limit(1000),

        supabase.from("districts").select("id,name"),

        supabase.from("barangays").select("id,name"),
      ]);

      for (const result of [u, d, b]) {
        if (result.error) throw result.error;
      }

      setUsers(u.data || []);

      setDistricts(
        Object.fromEntries((d.data || []).map((item) => [item.id, item.name])),
      );

      setBarangays(
        Object.fromEntries((b.data || []).map((item) => [item.id, item.name])),
      );
    } catch (err) {
      console.error("Error loading users:", err);
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ==========================================
  // FILTER USERS
  // ==========================================

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const keyword = search.toLowerCase().trim();

      const matchesSearch = `
        ${nameOf(user)}
        ${user.username}
        ${user.role}
      `
        .toLowerCase()
        .includes(keyword);

      const matchesRole = role === "all" || user.role === role;

      const matchesStatus =
        status === "all" ||
        (status === "active"
          ? user.is_active === true
          : user.is_active !== true);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, status]);

  // ==========================================
  // ACCOUNT STATISTICS
  // ==========================================

  const totalUsers = users.length;

  const activeUsers = users.filter((user) => user.is_active === true).length;

  const inactiveUsers = users.filter((user) => user.is_active !== true).length;

  // ==========================================
  // ACTIVATE / DEACTIVATE USER
  // ==========================================

  const toggleUserStatus = async () => {
    if (!confirmUser || updatingId !== null) return;

    const user = confirmUser;
    const newStatus = user.is_active !== true;

    setUpdatingId(user.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: updateError } = await supabase
        .from("users")
        .update({
          is_active: newStatus,
        })
        .eq("id", user.id)
        .select("id,is_active")
        .single();

      if (updateError) throw updateError;

      // Update the local table immediately.
      setUsers((previousUsers) =>
        previousUsers.map((item) =>
          item.id === data.id
            ? {
                ...item,
                is_active: data.is_active,
              }
            : item,
        ),
      );

      setSuccess(
        `${nameOf(user)} has been successfully ${
          newStatus ? "activated" : "deactivated"
        }.`,
      );

      setConfirmUser(null);
    } catch (err) {
      console.error("Error updating user status:", err);

      setError(err.message || "Failed to update the user's account status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* PAGE HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              IT Administration
            </span>

            <h1 className="mt-3 text-3xl font-bold text-slate-800">
              User Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage staff accounts, assigned locations, and activation status.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <Users size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">Total Accounts</p>

                <h2 className="text-2xl font-bold text-slate-800">
                  {totalUsers}
                </h2>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <CheckCircle2 size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">Active Accounts</p>

                <h2 className="text-2xl font-bold text-slate-800">
                  {activeUsers}
                </h2>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <XCircle size={22} />
              </div>

              <div>
                <p className="text-sm text-slate-500">Inactive Accounts</p>

                <h2 className="text-2xl font-bold text-slate-800">
                  {inactiveUsers}
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={19} className="shrink-0" />

            <p>{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* SUCCESS MESSAGE */}
        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2 size={19} className="shrink-0" />

            <p>{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* USERS TABLE */}
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-800">
              <Users size={20} />
              Accounts ({filtered.length})
            </h2>

            <span className="text-xs text-slate-500">
              Up to 1,000 accounts shown
            </span>
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-3 text-slate-400"
              />

              <input
                type="text"
                aria-label="Search users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, username, or role"
                className="w-full rounded-lg border border-slate-200 px-10 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              aria-label="Filter by role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All roles</option>

              {Object.entries(ROLE_NAMES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    "Name",
                    "Username",
                    "Role",
                    "Status",
                    "District",
                    "Barangay",
                    "Registered",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-5 py-3 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    {/* NAME */}
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {nameOf(user)}
                    </td>

                    {/* USERNAME */}
                    <td className="px-5 py-3 text-slate-600">
                      {user.username}
                    </td>

                    {/* ROLE */}
                    <td className="px-5 py-3 text-slate-600">
                      {ROLE_NAMES[user.role] || user.role}
                    </td>

                    {/* STATUS */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          user.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* DISTRICT */}
                    <td className="px-5 py-3 text-slate-600">
                      {districts[user.district_id] || "—"}
                    </td>

                    {/* BARANGAY */}
                    <td className="px-5 py-3 text-slate-600">
                      {barangays[user.barangay_id] || "—"}
                    </td>

                    {/* REGISTERED */}
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-PH")
                        : "—"}
                    </td>

                    {/* ACTIVATE / DEACTIVATE */}
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setSuccess("");
                          setConfirmUser(user);
                        }}
                        disabled={updatingId !== null}
                        className={`inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          user.is_active
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {updatingId === user.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Updating
                          </>
                        ) : user.is_active ? (
                          <>
                            <XCircle size={14} />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-500">
                      No matching accounts found.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Loading accounts...
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* CONFIRMATION MODAL */}
        {confirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="status-confirm-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                  confirmUser.is_active
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {confirmUser.is_active ? (
                  <XCircle size={25} />
                ) : (
                  <CheckCircle2 size={25} />
                )}
              </div>

              <h2
                id="status-confirm-title"
                className="text-xl font-bold text-slate-800"
              >
                {confirmUser.is_active
                  ? "Deactivate Account?"
                  : "Activate Account?"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Are you sure you want to{" "}
                <strong>
                  {confirmUser.is_active ? "deactivate" : "activate"}
                </strong>{" "}
                the account of <strong>{nameOf(confirmUser)}</strong>?
              </p>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Username</p>

                <p className="font-semibold text-slate-800">
                  {confirmUser.username}
                </p>

                <p className="mt-3 text-slate-500">Role</p>

                <p className="font-semibold text-slate-800">
                  {ROLE_NAMES[confirmUser.role] || confirmUser.role}
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmUser(null)}
                  disabled={updatingId !== null}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={toggleUserStatus}
                  disabled={updatingId !== null}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                    confirmUser.is_active
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {updatingId !== null && (
                    <Loader2 size={16} className="animate-spin" />
                  )}

                  {updatingId !== null
                    ? "Saving..."
                    : confirmUser.is_active
                      ? "Yes, Deactivate"
                      : "Yes, Activate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
