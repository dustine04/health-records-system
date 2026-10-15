import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Baby,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  HeartPulse,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const STATUS = {
  submitted: {
    label: "Pending Review",
    className: "bg-amber-100 text-amber-800",
  },
  reviewed: {
    label: "Reviewed",
    className: "bg-emerald-100 text-emerald-800",
  },
  returned: {
    label: "Returned",
    className: "bg-rose-100 text-rose-800",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700",
  },
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const displayName = (user) =>
  [user?.first_name, user?.middle_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || `User #${user?.id ?? ""}`;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLabel = (key) =>
  String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Displays JSON report data without assuming a particular
 * shape for report_data or source_snapshot.
 */
function JsonDataViewer({ data, depth = 0 }) {
  if (data === null || data === undefined) {
    return <p className="text-sm text-slate-500">No data available.</p>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <p className="text-sm italic text-slate-500">No records available.</p>
      );
    }

    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Record {index + 1}
            </p>

            {isObject(item) || Array.isArray(item) ? (
              <JsonDataViewer data={item} depth={depth + 1} />
            ) : (
              <p className="break-words text-sm text-slate-800">
                {formatValue(item) ?? JSON.stringify(item)}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (isObject(data)) {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return (
        <p className="text-sm italic text-slate-500">No details available.</p>
      );
    }

    return (
      <div
        className={
          depth === 0 ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "space-y-3"
        }
      >
        {entries.map(([key, value]) => {
          const simpleValue = formatValue(value);
          const nested = isObject(value) || Array.isArray(value);

          return (
            <div
              key={key}
              className={`min-w-0 rounded-lg border border-slate-200 p-3 ${
                nested && depth === 0 ? "md:col-span-2" : ""
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {formatLabel(key)}
              </p>

              {nested ? (
                <JsonDataViewer data={value} depth={depth + 1} />
              ) : (
                <p className="break-words text-sm font-medium text-slate-800">
                  {simpleValue ?? "—"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <p className="break-words text-sm text-slate-800">
      {formatValue(data) ?? "—"}
    </p>
  );
}

function StatusBadge({ status }) {
  const config = STATUS[status] ?? {
    label: formatLabel(status || "unknown"),
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function ReportDetailsModal({
  report,
  midwife,
  nurse,
  onClose,
  onReview,
  onReturn,
  actionLoading,
}) {
  const [returnNotes, setReturnNotes] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);

  const canReview = report.status === "submitted";
  const canReturn = report.status === "submitted";

  const reportData = report.report_data ?? {};
  const sourceSnapshot = report.source_snapshot ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
      <div className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Consolidated FHSIS Report
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {report.report_title || "Midwife FHSIS Report"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {MONTHS[Number(report.reporting_month) - 1] ?? "Unknown month"}{" "}
              {report.reporting_year}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close report"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Submitted by
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {midwife
                  ? displayName(midwife)
                  : `Midwife #${report.midwife_id}`}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Submitted on
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(report.submitted_at)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Processed By
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {report.reviewed_by
                  ? String(report.reviewed_by) === String(nurse?.id)
                    ? displayName(nurse)
                    : `Nurse #${report.reviewed_by}`
                  : "Not yet processed"}
              </p>

              {report.reviewed_at && (
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(report.reviewed_at)}
                </p>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Report status
              </p>
              <div className="mt-2">
                <StatusBadge status={report.status} />
              </div>
            </div>
          </div>

          {report.review_notes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <MessageSquare size={17} />
                Review comments
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">
                {report.review_notes}
              </p>
            </div>
          )}

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="text-blue-700" size={20} />
              <h3 className="text-lg font-bold text-slate-900">
                Consolidated report summary
              </h3>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <JsonDataViewer data={reportData} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="text-emerald-700" size={20} />
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Source report breakdown
                </h3>
                <p className="text-sm text-slate-500">
                  Snapshot of the BNS and BHW reports used by the Midwife.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <JsonDataViewer data={sourceSnapshot} />
            </div>
          </section>

          {showReturnForm && canReturn && (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <label
                htmlFor="return-notes"
                className="mb-2 block text-sm font-semibold text-rose-900"
              >
                Reason for returning this report
              </label>

              <textarea
                id="return-notes"
                value={returnNotes}
                onChange={(event) => setReturnNotes(event.target.value)}
                rows={4}
                placeholder="Explain what needs to be corrected or verified..."
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              />

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReturnForm(false)}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => onReturn(returnNotes)}
                  disabled={actionLoading || !returnNotes.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <ArrowLeft size={16} />
                  )}
                  Confirm Return
                </button>
              </div>
            </section>
          )}

          {canReview && (
            <div className="flex flex-col justify-end gap-3 border-t border-slate-200 pt-5 sm:flex-row">
              {!showReturnForm && (
                <button
                  type="button"
                  onClick={() => setShowReturnForm(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <ArrowLeft size={17} />
                  Return to Midwife
                </button>
              )}

              <button
                type="button"
                onClick={onReview}
                disabled={actionLoading || showReturnForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                Mark as Reviewed
              </button>
            </div>
          )}

          {report.status !== "submitted" && (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              This report has already been processed. Review actions are
              disabled.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NurseFhsisReports() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [midwives, setMidwives] = useState([]);
  const [districtName, setDistrictName] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const midwifeById = useMemo(
    () => new Map(midwives.map((midwife) => [String(midwife.id), midwife])),
    [midwives],
  );

  const loadReports = useCallback(async (currentUser) => {
    if (!currentUser?.id || !currentUser?.district_id) {
      setError(
        "Your Nurse account does not have a district assigned. Please contact the CHO administrator.",
      );
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Only fetch reports addressed to this Nurse and assigned
      // to the Nurse's district.
      const { data: reportRows, error: reportError } = await supabase
        .from("midwife_nurse_fhsis_reports")
        .select(
          "id, reporting_month, reporting_year, district_id, midwife_id, nurse_id, report_title, report_data, source_snapshot, status, submitted_at, reviewed_at, review_notes, created_at, updated_at",
        )
        .eq("nurse_id", currentUser.id)
        .eq("district_id", currentUser.district_id)
        .in("status", ["submitted", "reviewed", "returned"])
        .order("submitted_at", { ascending: false });

      if (reportError) throw reportError;

      const safeReports = reportRows ?? [];
      setReports(safeReports);

      const midwifeIds = [
        ...new Set(safeReports.map((report) => report.midwife_id)),
      ];

      if (midwifeIds.length > 0) {
        const { data: midwifeRows, error: midwifeError } = await supabase
          .from("users")
          .select(
            "id, username, first_name, middle_name, last_name, role, district_id",
          )
          .in("id", midwifeIds)
          .eq("role", "midwife")
          .eq("district_id", currentUser.district_id);

        if (midwifeError) throw midwifeError;

        setMidwives(midwifeRows ?? []);
      } else {
        setMidwives([]);
      }

      // Load the district name for display.
      const { data: district, error: districtError } = await supabase
        .from("districts")
        .select("id, name")
        .eq("id", currentUser.district_id)
        .maybeSingle();

      if (districtError) throw districtError;

      setDistrictName(district?.name ?? `District ${currentUser.district_id}`);
    } catch (err) {
      console.error("Failed to load Nurse FHSIS reports:", err);
      setError(err.message || "Unable to load FHSIS reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const storedUser = localStorage.getItem("user");

        if (!storedUser) {
          if (mounted) {
            setError("Your session was not found. Please sign in again.");
            setLoading(false);
          }
          return;
        }

        const parsedUser = JSON.parse(storedUser);

        if (parsedUser.role !== "nurse") {
          if (mounted) {
            setError("This page is available only to Nurse accounts.");
            setLoading(false);
          }
          return;
        }

        if (!mounted) return;

        setUser(parsedUser);
        await loadReports(parsedUser);
      } catch (err) {
        console.error("Failed to initialize Nurse report page:", err);

        if (mounted) {
          setError("Unable to initialize your session.");
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [loadReports]);

  const refreshReports = async () => {
    if (!user) return;

    setNotice("");
    await loadReports(user);
  };

  const processReport = async (nextStatus, notes = "") => {
    if (!selectedReport || !user) return;

    if (selectedReport.status !== "submitted") {
      setError("Only pending reports can be reviewed or returned.");
      return;
    }

    // Check that the selected report still belongs to this Nurse
    // and to the Nurse's district before updating it.
    if (
      String(selectedReport.nurse_id) !== String(user.id) ||
      String(selectedReport.district_id) !== String(user.district_id)
    ) {
      setError("This report is not assigned to your Nurse account.");
      return;
    }

    if (nextStatus === "returned" && !notes.trim()) {
      setError("Please provide a reason before returning the report.");
      return;
    }

    const actionLabel =
      nextStatus === "reviewed"
        ? "mark this report as reviewed"
        : "return this report";

    if (!window.confirm(`Are you sure you want to ${actionLabel}?`)) {
      return;
    }

    setActionLoading(true);
    setError("");
    setNotice("");

    try {
      const now = new Date().toISOString();

      const updateValues = {
        status: nextStatus,
        reviewed_by: user.id,
        reviewed_at: now,
        review_notes: notes.trim() || null,
        updated_at: now,
      };

      const { data: updatedRows, error: updateError } = await supabase
        .from("midwife_nurse_fhsis_reports")
        .update(updateValues)
        .eq("id", selectedReport.id)
        .eq("nurse_id", user.id)
        .eq("district_id", user.district_id)
        .eq("status", "submitted")
        .select(
          "id, reporting_month, reporting_year, district_id, midwife_id, nurse_id, report_title, report_data, source_snapshot, status, submitted_at, reviewed_at, review_notes, created_at, updated_at",
        );

      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "The report was not updated. It may have already been processed or its assignment may have changed. Refresh the page and try again.",
        );
      }

      const updatedReport = updatedRows[0];

      setReports((previous) =>
        previous.map((report) =>
          String(report.id) === String(updatedReport.id)
            ? updatedReport
            : report,
        ),
      );

      setSelectedReport(updatedReport);

      setNotice(
        nextStatus === "reviewed"
          ? "The FHSIS report has been marked as reviewed."
          : "The FHSIS report has been returned to the Midwife.",
      );

      setSelectedReport(null);
      await loadReports(user);
    } catch (err) {
      console.error("Failed to process FHSIS report:", err);
      setError(err.message || "Unable to process the report.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "all" || report.status === statusFilter;

      const midwife = midwifeById.get(String(report.midwife_id));
      const midwifeName = midwife ? displayName(midwife) : "";

      const matchesSearch =
        !search ||
        String(report.report_title ?? "")
          .toLowerCase()
          .includes(search) ||
        midwifeName.toLowerCase().includes(search) ||
        String(report.reporting_year).includes(search) ||
        String(MONTHS[Number(report.reporting_month) - 1] ?? "")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [reports, statusFilter, searchTerm, midwifeById]);

  const pendingCount = reports.filter(
    (report) => report.status === "submitted",
  ).length;

  const reviewedCount = reports.filter(
    (report) => report.status === "reviewed",
  ).length;

  const returnedCount = reports.filter(
    (report) => report.status === "returned",
  ).length;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <HeartPulse size={18} />
                Nurse / FHSIS Reports
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Received FHSIS Reports
              </h1>

              <p className="mt-2 text-sm text-slate-600">
                Review consolidated reports submitted by Midwives assigned to
                your district.
              </p>

              {districtName && (
                <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                  {districtName}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={refreshReports}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:self-center"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => setError("")}
                className="rounded p-1 hover:bg-rose-100"
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              <div className="flex-1">{notice}</div>
              <button
                type="button"
                onClick={() => setNotice("")}
                className="rounded p-1 hover:bg-emerald-100"
                aria-label="Dismiss notice"
              >
                <X size={17} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Reports"
              value={reports.length}
              icon={FileText}
              color="bg-blue-50 text-blue-700"
            />

            <StatCard
              title="Pending Review"
              value={pendingCount}
              icon={Clock}
              color="bg-amber-50 text-amber-700"
            />

            <StatCard
              title="Reviewed"
              value={reviewedCount}
              icon={CheckCircle2}
              color="bg-emerald-50 text-emerald-700"
            />

            <StatCard
              title="Returned"
              value={returnedCount}
              icon={ArrowLeft}
              color="bg-rose-50 text-rose-700"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search report title, Midwife, month, or year..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All statuses</option>
                <option value="submitted">Pending Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="returned">Returned</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">
                  Midwife Submissions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredReports.length} report
                  {filteredReports.length === 1 ? "" : "s"} found
                </p>
              </div>

              <Users size={22} className="text-slate-400" />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-slate-500">
                <LoaderCircle
                  size={30}
                  className="animate-spin text-blue-600"
                />
                <p className="text-sm">Loading FHSIS reports...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-slate-100 p-4">
                  <FileText size={30} className="text-slate-400" />
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  No reports found
                </h3>

                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Reports submitted to your Nurse account will appear here. Try
                  changing your search or status filter.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Report</th>
                        <th className="px-5 py-3 font-semibold">
                          Submitted By
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          Reporting Period
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          Submitted At
                        </th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredReports.map((report) => {
                        const midwife = midwifeById.get(
                          String(report.midwife_id),
                        );

                        return (
                          <tr key={report.id} className="hover:bg-slate-50">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900">
                                {report.report_title || "Midwife FHSIS Report"}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Report ID: {report.id}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-medium text-slate-800">
                                {midwife
                                  ? displayName(midwife)
                                  : `Midwife #${report.midwife_id}`}
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {MONTHS[Number(report.reporting_month) - 1] ??
                                "Unknown"}{" "}
                              {report.reporting_year}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                              {formatDate(report.submitted_at)}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge status={report.status} />
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedReport(report)}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                {report.status === "submitted"
                                  ? "Review Report"
                                  : "View Report"}
                                <ChevronRight size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-200 md:hidden">
                  {filteredReports.map((report) => {
                    const midwife = midwifeById.get(String(report.midwife_id));

                    return (
                      <div key={report.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words font-semibold text-slate-900">
                              {report.report_title || "Midwife FHSIS Report"}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Report ID: {report.id}
                            </p>
                          </div>

                          <StatusBadge status={report.status} />
                        </div>

                        <div className="space-y-1 text-sm text-slate-600">
                          <p>
                            <span className="font-medium text-slate-800">
                              Midwife:
                            </span>{" "}
                            {midwife
                              ? displayName(midwife)
                              : `Midwife #${report.midwife_id}`}
                          </p>

                          <p>
                            <span className="font-medium text-slate-800">
                              Period:
                            </span>{" "}
                            {MONTHS[Number(report.reporting_month) - 1] ??
                              "Unknown"}{" "}
                            {report.reporting_year}
                          </p>

                          <p>
                            <span className="font-medium text-slate-800">
                              Submitted:
                            </span>{" "}
                            {formatDate(report.submitted_at)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedReport(report)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          {report.status === "submitted"
                            ? "Review Report"
                            : "View Report"}
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <Activity size={20} className="mt-0.5 shrink-0 text-blue-700" />

            <div className="text-sm text-blue-900">
              <p className="font-semibold">Nurse review workflow</p>
              <p className="mt-1 leading-6">
                Review the consolidated indicators and the saved BNS/BHW source
                snapshots. Mark a report as reviewed when it is acceptable, or
                return it with a clear explanation of the corrections needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          midwife={midwifeById.get(String(selectedReport.midwife_id))}
          nurse={user}
          onClose={() => {
            if (!actionLoading) setSelectedReport(null);
          }}
          onReview={() => processReport("reviewed")}
          onReturn={(notes) => processReport("returned", notes)}
          actionLoading={actionLoading}
        />
      )}
    </DashboardLayout>
  );
}
