import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  CalendarDays,
  Eye,
  X,
  Users,
  Filter,
  Loader2,
  Clock3,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

/* ==========================================
   CONSTANTS
========================================== */

const ROLE_NAMES = {
  cho_admin: "CHO Administrator",
  it_admin: "IT Administrator",
  nurse: "Nurse",
  midwife: "Midwife",
  bns: "BNS",
  bhw: "BHW",
};

const ACTION_LABELS = {
  account_activated: "Account Activated",
  account_deactivated: "Account Deactivated",
  account_created: "Account Created",
  account_updated: "Account Updated",
  account_deleted: "Account Deleted",
  role_changed: "Role Changed",
  password_reset: "Password Reset",

  login_success: "Successful Login",
  login_failed: "Failed Login",
  logout: "Logout",

  data_exported: "Data Exported",
  data_imported: "Data Imported",
  backup_created: "Backup Created",

  record_created: "Record Created",
  record_updated: "Record Updated",
  record_deleted: "Record Deleted",

  report_submitted: "Report Submitted",
  report_approved: "Report Approved",
  report_returned: "Report Returned",
  report_forwarded: "Report Forwarded",

  unauthorized_access: "Unauthorized Access Attempt",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/* ==========================================
   HELPERS
========================================== */

function dateText(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function dateOnly(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fullName(user) {
  if (!user) return "Unknown User";

  return (
    [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.username ||
    "Unknown User"
  );
}

function actionLabel(action) {
  if (!action) return "Unknown Action";

  return (
    ACTION_LABELS[action] ||
    String(action)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function moduleName(log) {
  if (log.details?.module) {
    return String(log.details.module);
  }

  const entity = String(log.entity_type || "").toLowerCase();
  const action = String(log.action || "").toLowerCase();

  if (
    entity === "users" ||
    action.includes("account") ||
    action.includes("role") ||
    action.includes("password")
  ) {
    return "User Management";
  }

  if (
    action.includes("login") ||
    action.includes("logout") ||
    action.includes("access")
  ) {
    return "Authentication";
  }

  if (
    action.includes("export") ||
    action.includes("import") ||
    action.includes("backup")
  ) {
    return "Data Management";
  }

  if (action.includes("report") || entity.includes("report")) {
    return "Reports";
  }

  if (
    entity.includes("pregnan") ||
    entity.includes("child") ||
    entity.includes("resident") ||
    entity.includes("household")
  ) {
    return "Health Records";
  }

  return entity ? actionLabel(entity) : "System";
}

function getStatus(log) {
  const value = String(log.status || "success").toLowerCase();

  return value === "failed" ? "failed" : "success";
}

function getDetails(log) {
  if (!log.details) return "—";

  if (typeof log.details === "string") {
    return log.details;
  }

  if (typeof log.details === "object" && log.details.message) {
    return String(log.details.message);
  }

  if (
    typeof log.details === "object" &&
    "previous_status" in log.details &&
    "new_status" in log.details
  ) {
    return `Account status changed from ${
      log.details.previous_status ? "Active" : "Inactive"
    } to ${log.details.new_status ? "Active" : "Inactive"}.`;
  }

  return JSON.stringify(log.details);
}

function statusBadge(status) {
  return status === "success"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : "bg-red-50 text-red-700 border-red-100";
}

function actionBadge(action) {
  const value = String(action || "").toLowerCase();

  if (
    value.includes("deactivat") ||
    value.includes("delet") ||
    value.includes("failed") ||
    value.includes("unauthorized")
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    value.includes("activat") ||
    value.includes("approv") ||
    value.includes("success")
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    value.includes("updat") ||
    value.includes("chang") ||
    value.includes("return")
  ) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-blue-50 text-blue-700";
}

/* ==========================================
   COMPONENT
========================================== */

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedLog, setSelectedLog] = useState(null);

  /* ==========================================
     LOAD AUDIT LOGS
  ========================================== */

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotConfigured(false);

    try {
      const { data: logData, error: logError } = await supabase
        .from("it_audit_logs")
        .select(
          "id,created_at,actor_id,action,entity_type,entity_id,details,status",
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(1000);

      if (logError) {
        if (["42P01", "PGRST205"].includes(logError.code)) {
          setNotConfigured(true);
          setLogs([]);
          return;
        }

        throw logError;
      }

      const fetchedLogs = logData || [];

      setLogs(fetchedLogs);

      // Fetch only users referenced by the logs.
      const actorIds = [
        ...new Set(
          fetchedLogs
            .map((log) => log.actor_id)
            .filter((id) => id !== null && id !== undefined),
        ),
      ];

      if (actorIds.length === 0) {
        setUsers({});
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id,username,first_name,middle_name,last_name,role")
        .in("id", actorIds);

      if (userError) {
        console.error("Unable to retrieve audit actors:", userError);

        setUsers({});
      } else {
        setUsers(
          Object.fromEntries(
            (userData || []).map((user) => [String(user.id), user]),
          ),
        );
      }
    } catch (err) {
      console.error("Audit logs error:", err);

      setError(err.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ==========================================
     FILTER OPTIONS
  ========================================== */

  const actionOptions = useMemo(() => {
    return [...new Set(logs.map((log) => log.action).filter(Boolean))].sort();
  }, [logs]);

  /* ==========================================
     FILTER LOGS
  ========================================== */

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return logs.filter((log) => {
      const actor = users[String(log.actor_id)];

      const searchableText = [
        fullName(actor),
        actor?.username,
        actor?.role,
        log.action,
        actionLabel(log.action),
        log.entity_type,
        log.entity_id,
        moduleName(log),
        getDetails(log),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);

      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      const matchesStatus =
        statusFilter === "all" || getStatus(log) === statusFilter;

      const matchesDate =
        !dateFilter || dateOnly(log.created_at) === dateFilter;

      return matchesSearch && matchesAction && matchesStatus && matchesDate;
    });
  }, [logs, users, search, actionFilter, statusFilter, dateFilter]);

  /* ==========================================
     STATISTICS
  ========================================== */

  const stats = useMemo(() => {
    const today = dateOnly(new Date());

    return {
      total: logs.length,

      today: logs.filter((log) => dateOnly(log.created_at) === today).length,

      success: logs.filter((log) => getStatus(log) === "success").length,

      failed: logs.filter((log) => getStatus(log) === "failed").length,
    };
  }, [logs]);

  /* ==========================================
     RESET FILTERS
  ========================================== */

  const resetFilters = () => {
    setSearch("");
    setActionFilter("all");
    setStatusFilter("all");
    setDateFilter("");
  };

  /* ==========================================
     RENDER
  ========================================== */

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
              Audit Logs
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monitor system activities, account changes, and administrative
              events.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Events",
              value: stats.total,
              icon: ScrollText,
              color: "bg-blue-50 text-blue-600",
            },
            {
              label: "Today's Events",
              value: stats.today,
              icon: CalendarDays,
              color: "bg-violet-50 text-violet-600",
            },
            {
              label: "Successful Actions",
              value: stats.success,
              icon: CheckCircle2,
              color: "bg-emerald-50 text-emerald-600",
            },
            {
              label: "Failed Actions",
              value: stats.failed,
              icon: XCircle,
              color: "bg-red-50 text-red-600",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-3 ${stat.color}`}>
                    <Icon size={22} />
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>

                    <h2 className="text-2xl font-bold text-slate-800">
                      {stat.value}
                    </h2>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={20} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* TABLE NOT CONFIGURED */}
        {notConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Audit log table not available</p>

            <p className="mt-2">
              The it_audit_logs table could not be found. Check your Supabase
              database configuration.
            </p>
          </div>
        )}

        {/* AUDIT LOGS TABLE */}
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <ScrollText size={21} className="text-slate-700" />

              <div>
                <h2 className="font-bold text-slate-800">Activity History</h2>

                <p className="text-xs text-slate-500">
                  {filteredLogs.length} matching events
                </p>
              </div>
            </div>

            <span className="text-xs text-slate-500">Latest 1,000 events</span>
          </div>

          {/* FILTERS */}
          <div className="grid gap-3 border-b border-slate-100 p-5 lg:grid-cols-[1fr_190px_150px_170px_auto]">
            {/* SEARCH */}
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-3 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search actor, action, module..."
                className={`${inputClass} pl-10`}
              />
            </div>

            {/* ACTION FILTER */}
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">All Actions</option>

              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {actionLabel(action)}
                </option>
              ))}
            </select>

            {/* STATUS FILTER */}
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>

            {/* DATE FILTER */}
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className={inputClass}
            />

            {/* RESET */}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Filter size={16} />
              Reset
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    "Date & Time",
                    "Performed By",
                    "Role",
                    "Action",
                    "Module",
                    "Record ID",
                    "Status",
                    "Details",
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
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader2 size={20} className="animate-spin" />
                        Loading audit logs...
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  !notConfigured &&
                  filteredLogs.map((log) => {
                    const actor = users[String(log.actor_id)];

                    const result = getStatus(log);

                    return (
                      <tr
                        key={log.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50"
                      >
                        {/* DATE */}
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {dateText(log.created_at)}
                        </td>

                        {/* ACTOR */}
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800">
                            {fullName(actor)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {actor?.username
                              ? `@${actor.username}`
                              : log.actor_id
                                ? `User ID: ${log.actor_id}`
                                : "System"}
                          </p>
                        </td>

                        {/* ROLE */}
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {actor ? ROLE_NAMES[actor.role] || actor.role : "—"}
                        </td>

                        {/* ACTION */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${actionBadge(
                              log.action,
                            )}`}
                          >
                            {actionLabel(log.action)}
                          </span>
                        </td>

                        {/* MODULE */}
                        <td className="px-5 py-4 text-slate-600">
                          {moduleName(log)}
                        </td>

                        {/* RECORD ID */}
                        <td className="px-5 py-4 text-slate-600">
                          {log.entity_id ?? "—"}
                        </td>

                        {/* STATUS */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(
                              result,
                            )}`}
                          >
                            {result === "success" ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <XCircle size={13} />
                            )}

                            {result === "success" ? "Success" : "Failed"}
                          </span>
                        </td>

                        {/* DETAILS */}
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                          >
                            <Eye size={15} />
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && !notConfigured && filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ScrollText size={35} className="text-slate-300" />

                        <p className="font-semibold text-slate-600">
                          No audit logs found
                        </p>

                        <p className="text-sm text-slate-400">
                          Recorded system activities will appear here once
                          logging is implemented in your modules.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* FOOTER NOTE */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <ShieldCheck size={19} className="shrink-0 text-slate-500" />

          <p>
            Audit logs are retrieved from the <strong>it_audit_logs</strong>{" "}
            table. This page does not create, modify, or delete audit records.
            Events must be recorded by the corresponding system modules or
            trusted backend.
          </p>
        </div>

        {/* VIEW DETAILS MODAL */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-detail-title"
              className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
            >
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h2
                    id="audit-detail-title"
                    className="text-xl font-bold text-slate-800"
                  >
                    Audit Event Details
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Event #{selectedLog.id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* MODAL CONTENT */}
              <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      label: "Date & Time",
                      value: dateText(selectedLog.created_at),
                    },
                    {
                      label: "Performed By",
                      value: fullName(users[String(selectedLog.actor_id)]),
                    },
                    {
                      label: "Role",
                      value:
                        ROLE_NAMES[users[String(selectedLog.actor_id)]?.role] ||
                        users[String(selectedLog.actor_id)]?.role ||
                        "—",
                    },
                    {
                      label: "Action",
                      value: actionLabel(selectedLog.action),
                    },
                    {
                      label: "Module",
                      value: moduleName(selectedLog),
                    },
                    {
                      label: "Entity Type",
                      value: selectedLog.entity_type || "—",
                    },
                    {
                      label: "Record ID",
                      value: selectedLog.entity_id ?? "—",
                    },
                    {
                      label: "Status",
                      value:
                        getStatus(selectedLog) === "success"
                          ? "Success"
                          : "Failed",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-slate-50 p-4"
                    >
                      <p className="text-xs font-medium text-slate-500">
                        {item.label}
                      </p>

                      <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* DETAILS */}
                <div>
                  <h3 className="mb-3 font-bold text-slate-800">
                    Activity Details
                  </h3>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm text-slate-700">
                      {getDetails(selectedLog)}
                    </p>

                    {selectedLog.details &&
                      typeof selectedLog.details === "object" && (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-4 text-xs text-slate-600">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      )}
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex justify-end border-t border-slate-100 p-5">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
