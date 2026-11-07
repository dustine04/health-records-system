import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
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
  Users as UsersIcon,
  Clock3,
  ShieldCheck,
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

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const getAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};
const districtName = (d) =>
  d?.name || d?.district_name || d?.district || `District ${d?.id ?? ""}`;
const cleanStaff = (rows) => (rows || []).map(({ password, ...rest }) => rest);
const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  district_id: "",
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [statusUser, setStatusUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  // Best-effort audit recording. The database change is never rolled back if
  // logging fails; the UI reports that gap instead of claiming it was audited.
  // For tamper-resistant logs, move actor identification to a trusted backend.
  const recordAudit = async ({ action, userId, details }) => {
    const actor = getAdmin();
    const { error } = await supabase.from("it_audit_logs").insert({
      actor_id: actor?.id ?? null,
      action,
      entity_type: "users",
      entity_id: String(userId),
      details: { module: "Staff Management", ...details },
      status: "success",
    });
    if (error) {
      console.error("Staff audit insert failed:", error);
      return false;
    }
    return true;
  };

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount((await pendingStaffActions(getAdmin())).length);
    } catch (e) {
      console.error("Pending staff actions:", e);
    }
  }, []);

  const refreshCache = useCallback(async (nextUsers, nextDistricts) => {
    try {
      const admin = getAdmin();
      const previous = await getStaffCache(admin);
      await saveStaffCache(
        admin,
        nextUsers ?? previous?.users ?? [],
        nextDistricts ?? previous?.districts ?? [],
      );
    } catch (e) {
      console.error("Staff cache:", e);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!navigator.onLine) return;
    const { data, error } = await supabase
      .from("users")
      .select(
        "id,first_name,last_name,email,username,role,district_id,is_active,created_at",
      )
      .in("role", ["nurse", "midwife"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    const cleaned = cleanStaff(data);
    setUsers(cleaned);
    await refreshCache(cleaned, null);
  }, [refreshCache]);

  const fetchDistricts = useCallback(async () => {
    if (!navigator.onLine) return;
    const { data, error } = await supabase.from("districts").select("*");
    if (error) throw error;
    const sorted = [...(data || [])].sort((a, b) =>
      districtName(a).localeCompare(districtName(b)),
    );
    setDistricts(sorted);
    await refreshCache(null, sorted);
  }, [refreshCache]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      await Promise.all([fetchUsers(), fetchDistricts()]);
    } catch (e) {
      setErrorMessage(`Unable to refresh staff: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchDistricts]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    setErrorMessage("");
    try {
      const count = await syncStaffActions(getAdmin());
      await refreshPending();
      await refreshAll();
      setNotice(
        count
          ? `${count} queued staff change(s) synchronized. Note: offline-sync edits are not yet audit-logged; logging must be added inside adminStaffOffline.js.`
          : "Staff directory refreshed.",
      );
    } catch (e) {
      setErrorMessage(
        `Sync stopped: ${e.message}. Remaining changes are still queued.`,
      );
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshPending, refreshAll]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = await getStaffCache(getAdmin());
        if (!active) return;
        if (cached) {
          setUsers(cleanStaff(cached.users));
          setDistricts(cached.districts || []);
          setNotice("Showing cached staff information until refreshed.");
        }
      } catch (e) {
        console.error("Loading staff cache:", e);
      } finally {
        if (active) setCacheReady(true);
      }
      if (active) {
        await refreshAll();
        await refreshPending();
      }
    })();
    const onOnline = () => {
      setOnline(true);
      setNotice(
        "Connection restored. Select Sync Now to refresh staff records.",
      );
    };
    const onOffline = () => {
      setOnline(false);
      setNotice(
        "Offline: showing cached staff. Edits can be queued; approvals require internet.",
      );
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshAll, refreshPending]);

  const districtMap = useMemo(
    () => new Map(districts.map((d) => [String(d.id), districtName(d)])),
    [districts],
  );
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.is_active === true).length,
      inactive: users.filter((u) => u.is_active !== true).length,
    }),
    [users],
  );
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const haystack =
        `${u.first_name || ""} ${u.last_name || ""} ${u.email || ""} ${u.username || ""} ${districtMap.get(String(u.district_id)) || ""}`.toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (roleFilter === "all" || u.role === roleFilter) &&
        (statusFilter === "all" ||
          (statusFilter === "active"
            ? u.is_active === true
            : u.is_active !== true))
      );
    });
  }, [users, search, roleFilter, statusFilter, districtMap]);

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      username: u.username || "",
      district_id: u.district_id == null ? "" : String(u.district_id),
    });
    setErrorMessage("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingUser || saving) return;
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.email.trim() ||
      !form.username.trim() ||
      !form.district_id
    ) {
      setErrorMessage("Complete all required fields before saving.");
      return;
    }
    if (!districts.some((d) => String(d.id) === form.district_id)) {
      setErrorMessage("Select a valid district.");
      return;
    }
    const changes = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      username: form.username.trim(),
      district_id: Number(form.district_id),
    };
    setSaving(true);
    setErrorMessage("");
    try {
      if (!navigator.onLine) {
        const expected = Object.fromEntries(
          Object.keys(changes).map((k) => [k, editingUser[k]]),
        );
        await queueStaffAction(getAdmin(), {
          type: "edit",
          userId: editingUser.id,
          changes,
          expected,
        });
        await refreshPending();
        setNotice(
          "Staff edit queued offline. It will take effect only after a successful sync.",
        );
      } else {
        const { data, error } = await supabase
          .from("users")
          .update(changes)
          .eq("id", editingUser.id)
          .in("role", ["nurse", "midwife"])
          .select(
            "id,first_name,last_name,email,username,role,district_id,is_active,created_at",
          )
          .single();
        if (error) throw error;
        setUsers((current) =>
          current.map((u) => (u.id === editingUser.id ? { ...u, ...data } : u)),
        );
        const changedFields = Object.keys(changes).filter(
          (key) => String(editingUser[key] ?? "") !== String(data[key] ?? ""),
        );
        const audited =
          changedFields.length === 0 ||
          (await recordAudit({
            action: "account_updated",
            userId: editingUser.id,
            details: {
              target_username: editingUser.username,
              target_role: editingUser.role,
              changed_fields: changedFields,
              previous_district_id: editingUser.district_id,
              new_district_id: data.district_id,
              message: `Staff details updated for ${editingUser.username}.`,
            },
          }));
        setNotice(
          audited
            ? "Staff details updated successfully."
            : "Staff details saved, but audit logging failed. Contact your administrator.",
        );
        await fetchUsers();
      }
      setEditingUser(null);
      setForm(emptyForm);
    } catch (e) {
      setErrorMessage(e.message || "Unable to update staff.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!statusUser || saving) return;
    if (!navigator.onLine) {
      setErrorMessage(
        "Approving or deactivating accounts requires an internet connection.",
      );
      setStatusUser(null);
      return;
    }
    const next = statusUser.is_active !== true;
    setSaving(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ is_active: next })
        .eq("id", statusUser.id)
        .in("role", ["nurse", "midwife"])
        .eq("is_active", !next)
        .select(
          "id,first_name,last_name,email,username,role,district_id,is_active,created_at",
        )
        .single();
      if (error) throw error;
      setUsers((current) =>
        current.map((u) => (u.id === statusUser.id ? { ...u, ...data } : u)),
      );
      const audited = await recordAudit({
        action: next ? "account_activated" : "account_deactivated",
        userId: statusUser.id,
        details: {
          target_username: statusUser.username,
          target_role: statusUser.role,
          previous_status: statusUser.is_active === true,
          new_status: data.is_active === true,
          district_id: data.district_id,
          message: `${statusUser.role} account ${next ? "activated" : "deactivated"}: ${statusUser.username}`,
        },
      });
      setNotice(
        audited
          ? next
            ? "Staff account approved and activated."
            : "Staff account deactivated. Historical records were preserved."
          : "Account status changed, but audit logging failed. Contact your administrator.",
      );
      setStatusUser(null);
      await fetchUsers();
    } catch (e) {
      setErrorMessage(e.message || "Unable to change account status.");
      setStatusUser(null);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (u) =>
    u.is_active === true
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-800";
  const roleBadge = (u) =>
    u.role === "nurse"
      ? "bg-blue-50 text-blue-700"
      : "bg-violet-50 text-violet-700";

  const Actions = ({ user }) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => openEdit(user)}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
        title="Edit staff details"
      >
        <Pencil size={15} /> Edit
      </button>
      <button
        type="button"
        disabled={!online || saving}
        onClick={() => setStatusUser(user)}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm disabled:opacity-40 ${user.is_active === true ? "text-red-700 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}
      >
        {user.is_active === true ? (
          <Power size={15} />
        ) : (
          <CheckCircle2 size={15} />
        )}
        {user.is_active === true ? "Deactivate" : "Approve / Activate"}
      </button>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 sm:text-3xl">
              Staff Management
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review self-registered Nurse and Midwife accounts, approve access,
              and manage district assignments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? "Online" : "Offline"}
            </span>
            <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pendingCount} queued offline
            </span>
            <button
              type="button"
              disabled={!online || syncing}
              onClick={syncNow}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />{" "}
              Sync Now
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {notice}
          </div>
        )}
        {errorMessage && !editingUser && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />{" "}
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total Staff",
              value: stats.total,
              Icon: UsersIcon,
              color: "text-blue-600",
            },
            {
              label: "Active Staff",
              value: stats.active,
              Icon: ShieldCheck,
              color: "text-emerald-600",
            },
            {
              label: "Inactive / Awaiting Approval",
              value: stats.inactive,
              Icon: Clock3,
              color: "text-amber-600",
            },
          ].map(({ label, value, Icon, color }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500">{label}</p>
                <Icon size={20} className={color} />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_210px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className={`${inputClass} pl-10`}
                placeholder="Search name, email, username, district..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className={inputClass}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="nurse">Nurses</option>
              <option value="midwife">Midwives</option>
            </select>
            <select
              className={inputClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive / Awaiting Approval</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold text-slate-800">
              Nurses and Midwives
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {filteredUsers.length} staff account(s) displayed. Accounts are
              created through self-registration.
            </p>
          </div>
          {loading && !cacheReady ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-blue-600" size={28} />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Staff</th>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4">District</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <UserRound size={20} className="text-slate-400" />
                            <div>
                              <p className="font-medium text-slate-800">
                                {u.first_name} {u.last_name}
                              </p>
                              <p className="text-xs text-slate-400">
                                ID: {u.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {u.email || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${roleBadge(u)}`}
                          >
                            {u.role === "nurse" ? (
                              <Stethoscope size={13} />
                            ) : (
                              <Baby size={13} />
                            )}
                            {u.role === "nurse" ? "Nurse" : "Midwife"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={15} />
                            {districtMap.get(String(u.district_id)) ||
                              "Not assigned"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${statusBadge(u)}`}
                          >
                            {u.is_active === true
                              ? "Active"
                              : "Inactive / Awaiting Approval"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Actions user={u} />
                        </td>
                      </tr>
                    ))}
                    {!filteredUsers.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-slate-500"
                        >
                          No staff accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="space-y-3 p-4">
                    <div className="flex items-start gap-2">
                      <UserRound className="mt-1 text-slate-400" size={20} />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="break-all text-sm text-slate-500">
                          {u.email || "No email"}
                        </p>
                        <p className="text-xs text-slate-400">ID: {u.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${roleBadge(u)}`}
                      >
                        {u.role === "nurse" ? "Nurse" : "Midwife"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                        {districtMap.get(String(u.district_id)) ||
                          "Not assigned"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${statusBadge(u)}`}
                      >
                        {u.is_active === true
                          ? "Active"
                          : "Inactive / Awaiting Approval"}
                      </span>
                    </div>
                    <Actions user={u} />
                  </div>
                ))}
                {!filteredUsers.length && (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No staff accounts found.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {editingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold">Edit Staff Account</h3>
                  <p className="text-sm text-slate-500">
                    Update details and assigned district.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingUser(null)}
                >
                  <X size={20} />
                </button>
              </div>
              {errorMessage && (
                <p className="mx-6 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
              <form className="space-y-4 p-6" onSubmit={saveEdit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["first_name", "First Name"],
                    ["last_name", "Last Name"],
                  ].map(([name, label]) => (
                    <label
                      key={name}
                      className="block text-sm font-medium text-slate-700"
                    >
                      {label}
                      <input
                        required
                        className={`${inputClass} mt-1`}
                        value={form[name]}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [name]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                {[
                  ["email", "Email Address"],
                  ["username", "Username"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="block text-sm font-medium text-slate-700"
                  >
                    {label}
                    <input
                      required
                      type={name === "email" ? "email" : "text"}
                      className={`${inputClass} mt-1`}
                      value={form[name]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [name]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Staff Role
                  </label>
                  <input
                    disabled
                    className={`${inputClass} mt-1 bg-slate-100`}
                    value={editingUser.role === "nurse" ? "Nurse" : "Midwife"}
                  />
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <Building2 size={16} /> Assigned District
                  </span>
                  <select
                    required
                    className={`${inputClass} mt-1`}
                    value={form.district_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, district_id: e.target.value }))
                    }
                  >
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {districtName(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-3 border-t pt-4">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setEditingUser(null)}
                    className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white disabled:opacity-50"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {statusUser && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${statusUser.is_active === true ? "bg-red-50" : "bg-emerald-50"}`}
              >
                {statusUser.is_active === true ? (
                  <Power className="text-red-600" />
                ) : (
                  <CheckCircle2 className="text-emerald-600" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {statusUser.is_active === true
                  ? "Deactivate Staff Account?"
                  : "Approve / Activate Staff Account?"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {statusUser.first_name} {statusUser.last_name} (
                {statusUser.role === "nurse" ? "Nurse" : "Midwife"}) —{" "}
                {districtMap.get(String(statusUser.district_id)) ||
                  "District not assigned"}
                .
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {statusUser.is_active === true
                  ? "This staff member will lose account access. Historical records remain intact."
                  : "This sets is_active to true and allows this staff member to log in. Confirm their identity and district first."}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStatusUser(null)}
                  className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !online}
                  onClick={toggleStatus}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${statusUser.is_active === true ? "bg-red-600" : "bg-emerald-600"}`}
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {statusUser.is_active === true
                    ? "Deactivate Account"
                    : "Approve / Activate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
