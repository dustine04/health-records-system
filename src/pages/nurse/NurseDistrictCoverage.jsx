import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Building2,
  Users,
  FileCheck2,
  Clock,
  CheckCircle2,
  RotateCcw,
  Search,
  RefreshCw,
  CalendarDays,
  AlertCircle,
  FileText,
  ChevronDown,
  X,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const STATUS_STYLES = {
  submitted: {
    label: "Submitted",
    className: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  reviewed: {
    label: "Reviewed",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  returned: {
    label: "Returned",
    className: "bg-rose-50 text-rose-700 ring-rose-600/20",
  },
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function parseJson(value) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getReportDate(report) {
  return (
    report.submitted_at ||
    report.reviewed_at ||
    report.created_at ||
    report.updated_at ||
    null
  );
}

function getDisplayName(user) {
  if (!user) return "Unknown Midwife";

  const fullName = [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user.username || "Unknown Midwife";
}

function getReportStatus(report) {
  const status = String(report?.status || "").toLowerCase();

  if (STATUS_STYLES[status]) {
    return STATUS_STYLES[status];
  }

  return {
    label: status
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : "Unknown",
    className: "bg-gray-100 text-gray-600 ring-gray-500/20",
  };
}

/**
 * Extract barangay IDs/names explicitly represented in saved report data.
 *
 * Supported examples:
 * { barangay_id: 3 }
 * { barangay_name: "Barangay San Vicente" }
 * { barangay: { id: 3, name: "Barangay San Vicente" } }
 * { barangays: [{ id: 3, name: "Barangay San Vicente" }] }
 *
 * The function deliberately avoids treating every generic "id" field
 * as a barangay ID unless it is inside a barangay-specific object.
 */
function findBarangayMatches(report, barangays) {
  const matchedIds = new Set();
  const matchedNames = new Set();

  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\bbarangay\b|\bbrgy\b\.?/g, "")
      .replace(/[^a-z0-9]/g, "");

  const parsedReport = parseJson(report) || {};
  const snapshot = parseJson(parsedReport.source_snapshot) || {};
  const reportData = parseJson(parsedReport.report_data) || {};

  const addBarangay = (id, name) => {
    if (id !== null && id !== undefined && String(id).trim() !== "") {
      matchedIds.add(String(id).trim());
    }

    const normalizedName = normalize(name);
    if (normalizedName) matchedNames.add(normalizedName);
  };

  const inspect = (value) => {
    value = parseJson(value);

    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }

    // Only use explicit barangay fields; do not treat local-area IDs
    // or covered_area_ids as barangay IDs.
    const barangayId =
      value.barangay_id ?? value.brgy_id ?? value.barangayId ?? value.brgyId;

    const barangayName =
      value.barangay_name ??
      value.brgy_name ??
      value.barangayName ??
      value.brgyName;

    if (barangayId != null || barangayName != null) {
      addBarangay(barangayId, barangayName);
    }

    // Inspect nested report payloads and source reports.
    [
      "source_snapshot",
      "report_data",
      "bhw_monthly_reports",
      "bns_child_monthly_reports",
    ].forEach((key) => {
      if (value[key] != null) inspect(value[key]);
    });

    // Support source-report objects that directly contain nested details.
    if (value.source_report != null) inspect(value.source_report);
  };

  inspect(snapshot);
  inspect(reportData);

  const matches = barangays.filter((barangay) => {
    const idMatches = matchedIds.has(String(barangay.id));
    const nameMatches = matchedNames.has(normalize(barangay.name));

    return idMatches || nameMatches;
  });
  return matches;
}

function StatCard({ title, value, subtitle, icon: Icon, color, loading }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {loading ? (
              <span className="inline-block h-9 w-14 animate-pulse rounded-md bg-gray-100" />
            ) : (
              value
            )}
          </div>

          <p className="mt-2 text-xs leading-5 text-gray-500">{subtitle}</p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function NurseDistrictCoverage() {
  const user = useMemo(() => getStoredUser(), []);

  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [district, setDistrict] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [reports, setReports] = useState([]);
  const [midwives, setMidwives] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCoverage = async (isRefresh = false) => {
    if (!user?.id) {
      setError("Your session could not be found. Please log in again.");
      setLoading(false);
      return;
    }

    if (user.district_id == null) {
      setError(
        "Your account does not have an assigned district. Please contact the CHO administrator.",
      );
      setDistrict(null);
      setBarangays([]);
      setReports([]);
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [
        { data: districtData, error: districtError },
        { data: barangayData, error: barangayError },
        { data: reportData, error: reportError },
      ] = await Promise.all([
        supabase
          .from("districts")
          .select("id, name")
          .eq("id", user.district_id)
          .maybeSingle(),

        supabase
          .from("barangays")
          .select("id, name, district_id")
          .eq("district_id", user.district_id)
          .order("name", { ascending: true }),

        supabase
          .from("midwife_nurse_fhsis_reports")
          .select("*")
          .eq("nurse_id", user.id)
          .eq("district_id", user.district_id)
          .eq("reporting_month", Number(selectedMonth))
          .eq("reporting_year", Number(selectedYear))
          .in("status", ["submitted", "reviewed", "returned"])
          .order("submitted_at", {
            ascending: false,
            nullsFirst: false,
          }),
      ]);

      if (districtError) throw districtError;
      if (barangayError) throw barangayError;
      if (reportError) throw reportError;

      setDistrict(districtData || null);

      const currentBarangays = barangayData || [];
      const currentReports = reportData || [];

      setBarangays(currentBarangays);
      setReports(currentReports);

      // Load midwife names for reports.
      const midwifeIds = [
        ...new Set(
          currentReports
            .map((report) => report.midwife_id)
            .filter((id) => id != null),
        ),
      ];

      if (midwifeIds.length) {
        const { data: midwifeData, error: midwifeError } = await supabase
          .from("users")
          .select("id, username, first_name, middle_name, last_name")
          .in("id", midwifeIds);

        if (midwifeError) throw midwifeError;

        const nameMap = {};

        (midwifeData || []).forEach((midwife) => {
          nameMap[String(midwife.id)] = getDisplayName(midwife);
        });

        setMidwives(nameMap);
      } else {
        setMidwives({});
      }
    } catch (err) {
      console.error("Failed to load Nurse District Coverage:", err);

      setError(
        err?.message || "Unable to load district coverage. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCoverage();

    // Reload coverage when the period or assigned district changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.district_id, selectedMonth, selectedYear]);

  const coverageRows = useMemo(() => {
    return barangays.map((barangay) => {
      const matchedReports = reports
        .filter((report) =>
          findBarangayMatches(report, barangays).some(
            (matchedBarangay) =>
              String(matchedBarangay.id) === String(barangay.id),
          ),
        )
        .sort((a, b) => {
          const dateA = new Date(getReportDate(a) || 0).getTime();
          const dateB = new Date(getReportDate(b) || 0).getTime();
          return dateB - dateA;
        });

      const latestReport = matchedReports[0] || null;
      return {
        ...barangay,
        matchedReports,
        latestReport,
        isCovered: matchedReports.length > 0,
        status: latestReport?.status || "missing",
      };
    });
  }, [barangays, reports]);

  const coveredCount = coverageRows.filter((row) => row.isCovered).length;

  const uncoveredCount = coverageRows.length - coveredCount;

  const reviewedBarangayCount = coverageRows.filter(
    (row) => row.status === "reviewed",
  ).length;

  const returnedBarangayCount = coverageRows.filter(
    (row) => row.status === "returned",
  ).length;

  const coveragePercentage =
    coverageRows.length > 0
      ? Math.round((coveredCount / coverageRows.length) * 100)
      : 0;

  const filteredRows = coverageRows.filter((row) => {
    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      !searchText || row.name?.toLowerCase().includes(searchText);

    let matchesStatus = true;

    if (statusFilter === "covered") {
      matchesStatus = row.isCovered;
    } else if (statusFilter === "missing") {
      matchesStatus = !row.isCovered;
    } else if (statusFilter === "reviewed") {
      matchesStatus = row.status === "reviewed";
    } else if (statusFilter === "returned") {
      matchesStatus = row.status === "returned";
    } else if (statusFilter === "submitted") {
      matchesStatus = row.status === "submitted";
    }

    return matchesSearch && matchesStatus;
  });

  const periodLabel = new Date(
    Number(selectedYear),
    Number(selectedMonth) - 1,
    1,
  ).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  const yearOptions = Array.from(
    { length: 7 },
    (_, index) => today.getFullYear() - 5 + index,
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <MapPin className="h-3.5 w-3.5" />
              Nurse Portal
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              District Coverage
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
              Monitor barangay reporting coverage for your assigned district and
              selected reporting period.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadCoverage(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />

            <div>
              <p className="font-semibold text-rose-900">
                Unable to load coverage
              </p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
          </div>
        )}

        {/* District banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[28px] border-white/5" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                <Building2 className="h-4 w-4" />
                Assigned District
              </div>

              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                {loading && !district
                  ? "Loading district..."
                  : district?.name || "District not found"}
              </h2>

              <p className="mt-2 text-sm text-emerald-100">
                Reporting period: {periodLabel}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
                  {loading ? "—" : barangays.length} barangays
                </span>

                <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
                  {loading ? "—" : reports.length} reports received
                </span>
              </div>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center self-start rounded-2xl border border-white/15 bg-white/10 sm:self-center">
              <MapPin className="h-10 w-10" />
            </div>
          </div>
        </div>

        {/* Reporting period selector */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-bold text-gray-900">
                Select Reporting Period
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Coverage statistics are based on reports assigned to you for the
                selected month and year.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="coverage-month"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Month
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <select
                    id="coverage-month"
                    value={selectedMonth}
                    onChange={(event) =>
                      setSelectedMonth(Number(event.target.value))
                    }
                    className="w-full min-w-40 appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="coverage-year"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Year
                </label>

                <div className="relative">
                  <select
                    id="coverage-year"
                    value={selectedYear}
                    onChange={(event) =>
                      setSelectedYear(Number(event.target.value))
                    }
                    className="w-full min-w-32 appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Coverage Overview
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Barangay coverage for {periodLabel}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Barangays"
              value={barangays.length}
              subtitle="Barangays in your assigned district"
              icon={Building2}
              color="bg-blue-50 text-blue-700"
              loading={loading}
            />

            <StatCard
              title="Barangays Covered"
              value={coveredCount}
              subtitle="Barangays identified in saved report data"
              icon={FileCheck2}
              color="bg-emerald-50 text-emerald-700"
              loading={loading}
            />

            <StatCard
              title="Not Yet Confirmed"
              value={uncoveredCount}
              subtitle="No matching barangay found in the reports"
              icon={Clock}
              color="bg-amber-50 text-amber-700"
              loading={loading}
            />

            <StatCard
              title="Reviewed Coverage"
              value={reviewedBarangayCount}
              subtitle="Covered barangays whose latest matching report was reviewed"
              icon={CheckCircle2}
              color="bg-violet-50 text-violet-700"
              loading={loading}
            />
          </div>
        </section>

        {/* Progress */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                District Reporting Progress
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Percentage of district barangays identified in reports for{" "}
                {periodLabel}.
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-3xl font-bold text-emerald-700">
                {loading ? "—" : `${coveragePercentage}%`}
              </p>

              <p className="text-xs text-gray-500">
                {loading
                  ? "Loading coverage"
                  : `${coveredCount} of ${barangays.length} barangays`}
              </p>
            </div>
          </div>

          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-label="District reporting coverage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loading ? 0 : coveragePercentage}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{
                width: `${loading ? 0 : coveragePercentage}%`,
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Confirmed coverage
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
              Not yet confirmed
            </span>

            {returnedBarangayCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                {returnedBarangayCount} barangays with returned reports
              </span>
            )}
          </div>
        </section>

        {/* Barangay table */}
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Barangay Coverage
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Check the report status of each barangay in your district.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search barangay..."
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-56"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter barangays by report status"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All Barangays</option>
                  <option value="covered">Covered</option>
                  <option value="missing">Not Confirmed</option>
                  <option value="submitted">Submitted</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Barangay</th>
                  <th className="px-5 py-4 font-semibold">Coverage Status</th>
                  <th className="px-5 py-4 font-semibold">Latest Report</th>
                  <th className="px-5 py-4 font-semibold">Submitted By</th>
                  <th className="px-5 py-4 font-semibold">Report Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 5 }).map((__, cell) => (
                        <td key={cell} className="px-5 py-5">
                          <div className="h-4 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50">
                        <Search className="h-6 w-6 text-gray-400" />
                      </div>

                      <p className="mt-3 font-semibold text-gray-900">
                        No barangays found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Try changing your search or status filter.
                      </p>

                      {(search || statusFilter !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("all");
                          }}
                          className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const status = row.latestReport
                      ? getReportStatus(row.latestReport)
                      : {
                          label: "Not Confirmed",
                          className:
                            "bg-amber-50 text-amber-700 ring-amber-600/20",
                        };

                    return (
                      <tr
                        key={row.id}
                        className="transition hover:bg-gray-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                              <MapPin className="h-5 w-5 text-emerald-700" />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-900">
                                {row.name}
                              </p>

                              <p className="mt-0.5 text-xs text-gray-400">
                                Barangay ID: {row.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.className}`}
                          >
                            {status.label}
                          </span>

                          {row.matchedReports.length > 1 && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              {row.matchedReports.length} matching reports
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {row.latestReport ? (
                            <div>
                              <p className="max-w-56 truncate font-medium text-gray-800">
                                {row.latestReport.report_title ||
                                  `FHSIS Report #${row.latestReport.id}`}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                Report ID: {row.latestReport.id}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">
                              No matching report
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {row.latestReport ? (
                            <span className="text-gray-700">
                              {midwives[String(row.latestReport.midwife_id)] ||
                                "Midwife"}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {row.latestReport
                            ? formatDate(getReportDate(row.latestReport))
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredRows.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {filteredRows.length} of {barangays.length} barangays
              </p>

              <p>
                Reporting period:{" "}
                <span className="font-semibold text-gray-700">
                  {periodLabel}
                </span>
              </p>
            </div>
          )}
        </section>

        {/* Explanation */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

          <div>
            <p className="font-semibold text-blue-900">
              How coverage is determined
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-800">
              A barangay is counted as covered only when its ID or name can be
              matched in the saved report data. If a consolidated report does
              not identify its included barangays, those barangays remain
              unconfirmed until the report data can establish their coverage.
              This does not necessarily mean the barangay failed to submit its
              data.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 text-xs text-gray-400">
          Health Records Management System · Nurse District Coverage
        </div>
      </div>
    </DashboardLayout>
  );
}

export default NurseDistrictCoverage;
