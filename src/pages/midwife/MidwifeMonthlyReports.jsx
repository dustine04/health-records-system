import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Eye,
  FileCheck2,
  Loader2,
  Search,
  UserRound,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock3,
  RotateCcw,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
const statusConfig = {
  submitted: {
    label: "Submitted",
    icon: Clock3,
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  reviewed: {
    label: "Reviewed",
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700 border border-green-200",
  },
  returned: {
    label: "Returned",
    icon: RotateCcw,
    className: "bg-orange-50 text-orange-700 border border-orange-200",
  },
  draft: {
    label: "Draft",
    icon: ClipboardList,
    className: "bg-gray-50 text-gray-600 border border-gray-200",
  },
};

function getFullName(user) {
  if (!user) return "Unknown BHW";

  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ");
}

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMonthYear(month, year) {
  if (!month || !year) return "—";

  const monthNumber = Number(month);

  if (Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return `${month} ${year}`;
  }

  const date = new Date(year, monthNumber - 1, 1);

  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function getPregnantWomenCount(report) {
  const data = report?.report_data;

  if (!data) return 0;

  if (Array.isArray(data.pregnant_women)) {
    return data.pregnant_women.length;
  }

  return 0;
}

function getTotalPregnancyCount(report) {
  const data = report?.report_data;

  if (!data) return 0;

  const pregnancyTracking = data.pregnancy_tracking;

  if (
    pregnancyTracking &&
    pregnancyTracking.total !== undefined &&
    pregnancyTracking.total !== null
  ) {
    return Number(pregnancyTracking.total) || 0;
  }

  return getPregnantWomenCount(report);
}

function getNewPregnancyCount(report) {
  const data = report?.report_data;

  if (!data) return 0;

  const pregnancyTracking = data.pregnancy_tracking;

  if (
    pregnancyTracking &&
    pregnancyTracking.new !== undefined &&
    pregnancyTracking.new !== null
  ) {
    return Number(pregnancyTracking.new) || 0;
  }

  return 0;
}

export default function MidwifeMonthlyReports() {
  const [reports, setReports] = useState([]);
  const [bhwUsers, setBhwUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("submitted");

  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      /*
       * ---------------------------------------------------------
       * 1. Get monthly reports
       * ---------------------------------------------------------
       *
       * We only load pregnancy monthly reports from BHWs.
       *
       * We intentionally do NOT regenerate the report here.
       * The Midwife reviews the report_data snapshot that the
       * BHW submitted.
       */

      const { data: reportData, error: reportError } = await supabase
        .from("bhw_monthly_reports")
        .select(
          `
            id,
            bhw_id,
            month,
            year,
            status,
            report_data,
            submitted_at,
            updated_at
          `,
        )
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("submitted_at", { ascending: false });

      if (reportError) {
        throw reportError;
      }

      const reportRows = reportData || [];

      /*
       * ---------------------------------------------------------
       * 2. Get BHW IDs
       * ---------------------------------------------------------
       */

      const bhwIds = [
        ...new Set(reportRows.map((report) => report.bhw_id).filter(Boolean)),
      ];

      let users = [];

      if (bhwIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select(
            `
              id,
              first_name,
              middle_name,
              last_name,
              username,
              role,
              barangay_id,
              district_id
            `,
          )
          .in("id", bhwIds);

        if (userError) {
          throw userError;
        }

        users = userData || [];
      }

      setBhwUsers(users);

      /*
       * ---------------------------------------------------------
       * 3. Combine report + BHW information
       * ---------------------------------------------------------
       */

      const userMap = {};

      users.forEach((user) => {
        userMap[user.id] = user;
      });

      const combinedReports = reportRows.map((report) => ({
        ...report,
        bhw: userMap[report.bhw_id] || null,
      }));

      setReports(combinedReports);
    } catch (err) {
      console.error("Error loading Midwife monthly reports:", err);

      setError(
        err?.message || "Unable to load the BHW monthly pregnancy reports.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /*
   * -----------------------------------------------------------
   * Filtered reports
   * -----------------------------------------------------------
   */
  const navigate = useNavigate();
  const filteredReports = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      /*
       * Status filter
       */

      if (statusFilter !== "all" && report.status !== statusFilter) {
        return false;
      }

      /*
       * Search
       */

      if (!search) {
        return true;
      }

      const bhwName = getFullName(report.bhw);

      const monthYear = formatMonthYear(report.month, report.year);

      const searchableText = [
        bhwName,
        report.bhw?.username,
        monthYear,
        report.status,
        String(report.month || ""),
        String(report.year || ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [reports, searchTerm, statusFilter]);

  /*
   * -----------------------------------------------------------
   * Statistics
   * -----------------------------------------------------------
   */

  const statistics = useMemo(() => {
    const submitted = reports.filter(
      (report) => report.status === "submitted",
    ).length;

    const reviewed = reports.filter(
      (report) => report.status === "reviewed",
    ).length;

    const returned = reports.filter(
      (report) => report.status === "returned",
    ).length;

    const pregnancyCount = reports.reduce(
      (total, report) => total + getPregnantWomenCount(report),
      0,
    );

    return {
      submitted,
      reviewed,
      returned,
      pregnancyCount,
    };
  }, [reports]);

  /*
   * -----------------------------------------------------------
   * Loading
   * -----------------------------------------------------------
   */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

            <p className="text-sm text-gray-500">
              Loading BHW monthly pregnancy reports...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <FileCheck2 className="h-6 w-6 text-blue-600" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Monthly Pregnancy Reports
                </h1>

                <p className="text-sm text-gray-500">
                  Review monthly reports submitted by BHWs.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchReports(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">Unable to load reports</p>

              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* =====================================================
            STATISTICS
        ====================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Submitted */}

          <button
            type="button"
            onClick={() => setStatusFilter("submitted")}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "submitted"
                ? "border-blue-300 ring-2 ring-blue-100"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Pending Review
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {statistics.submitted}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Clock3 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </button>

          {/* Reviewed */}

          <button
            type="button"
            onClick={() => setStatusFilter("reviewed")}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "reviewed"
                ? "border-green-300 ring-2 ring-green-100"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Reviewed</p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {statistics.reviewed}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </button>

          {/* Returned */}

          <button
            type="button"
            onClick={() => setStatusFilter("returned")}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "returned"
                ? "border-orange-300 ring-2 ring-orange-100"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Returned</p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {statistics.returned}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <RotateCcw className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </button>

          {/* Pregnant Women */}

          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Women in Reports
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {statistics.pregnancyCount}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                <UserRound className="h-5 w-5 text-pink-600" />
              </div>
            </div>
          </button>
        </div>

        {/* =====================================================
            SEARCH / FILTER
        ====================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            {/* Search */}

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search BHW name, month, year..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Status */}

            <div className="w-full lg:w-52">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="submitted">Submitted</option>

                <option value="reviewed">Reviewed</option>

                <option value="returned">Returned</option>

                <option value="draft">Draft</option>

                <option value="all">All Statuses</option>
              </select>
            </div>
          </div>
        </div>

        {/* =====================================================
            REPORT LIST
        ====================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  BHW Submitted Reports
                </h2>

                <p className="text-sm text-gray-500">
                  {filteredReports.length} report
                  {filteredReports.length !== 1 ? "s" : ""} found
                </p>
              </div>

              {statusFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Show all reports
                </button>
              )}
            </div>
          </div>

          {/* Empty */}

          {filteredReports.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <ClipboardList className="h-7 w-7 text-gray-400" />
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">
                No monthly reports found
              </h3>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                There are no reports matching the current search and status
                filter.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        BHW
                      </th>

                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Report Period
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Women
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                        New
                      </th>

                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Submitted
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredReports.map((report) => {
                      const config =
                        statusConfig[report.status] || statusConfig.submitted;

                      const StatusIcon = config.icon;

                      const womenCount = getPregnantWomenCount(report);

                      const newCount = getNewPregnancyCount(report);

                      return (
                        <tr
                          key={report.id}
                          className="transition hover:bg-gray-50"
                        >
                          {/* BHW */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                                <UserRound className="h-5 w-5 text-orange-600" />
                              </div>

                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900">
                                  {getFullName(report.bhw)}
                                </p>

                                <p className="text-xs text-gray-500">
                                  {report.bhw?.username || "BHW"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Period */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              <CalendarDays className="h-4 w-4 text-gray-400" />

                              {formatMonthYear(report.month, report.year)}
                            </div>
                          </td>

                          {/* Women */}

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-gray-900">
                              {womenCount}
                            </span>
                          </td>

                          {/* New */}

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-blue-600">
                              {newCount}
                            </span>
                          </td>

                          {/* Submitted */}

                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-600">
                              {formatDate(report.submitted_at)}
                            </span>
                          </td>

                          {/* Status */}

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />

                              {config.label}
                            </span>
                          </td>

                          {/* Action */}

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/dashboard/midwife/monthly-reports/${report.id}`,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                            >
                              <Eye className="h-4 w-4" />
                              View Report
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}

              <div className="divide-y divide-gray-100 md:hidden">
                {filteredReports.map((report) => {
                  const config =
                    statusConfig[report.status] || statusConfig.submitted;

                  const StatusIcon = config.icon;

                  const womenCount = getPregnantWomenCount(report);

                  const newCount = getNewPregnancyCount(report);

                  return (
                    <div key={report.id} className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                            <UserRound className="h-5 w-5 text-orange-600" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {getFullName(report.bhw)}
                            </p>

                            <p className="text-xs text-gray-500">
                              {report.bhw?.username || "BHW"}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />

                          {config.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Report Period</p>

                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {formatMonthYear(report.month, report.year)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Submitted</p>

                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {formatDate(report.submitted_at)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-pink-50 p-3">
                          <p className="text-xs text-gray-500">
                            Pregnant Women
                          </p>

                          <p className="mt-1 text-lg font-bold text-pink-700">
                            {womenCount}
                          </p>
                        </div>

                        <div className="rounded-lg bg-blue-50 p-3">
                          <p className="text-xs text-gray-500">
                            New This Month
                          </p>

                          <p className="mt-1 text-lg font-bold text-blue-700">
                            {newCount}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Report
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* =======================================================
          QUICK REPORT PREVIEW MODAL
      ======================================================== */}

      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedReport(null);
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}

            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-blue-600" />

                  <h2 className="text-lg font-bold text-gray-900">
                    Monthly Pregnancy Report
                  </h2>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  {formatMonthYear(selectedReport.month, selectedReport.year)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}

            <div className="overflow-y-auto p-5">
              <div className="space-y-5">
                {/* BHW */}

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Submitted By
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100">
                      <UserRound className="h-5 w-5 text-orange-600" />
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">
                        {getFullName(selectedReport.bhw)}
                      </p>

                      <p className="text-sm text-gray-500">
                        {selectedReport.bhw?.username ||
                          "Barangay Health Worker"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Report information */}

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Report Information
                  </h3>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Reporting Period</p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {formatMonthYear(
                          selectedReport.month,
                          selectedReport.year,
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Submitted Date</p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {formatDate(selectedReport.submitted_at)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Pregnant Women</p>

                      <p className="mt-1 text-xl font-bold text-pink-600">
                        {getPregnantWomenCount(selectedReport)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Newly Registered</p>

                      <p className="mt-1 text-xl font-bold text-blue-600">
                        {getNewPregnancyCount(selectedReport)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pregnancy names */}

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Pregnant Women Included
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    These are the women included in the submitted monthly
                    report.
                  </p>

                  <div className="mt-3 space-y-2">
                    {Array.isArray(
                      selectedReport.report_data?.pregnant_women,
                    ) &&
                    selectedReport.report_data.pregnant_women.length > 0 ? (
                      selectedReport.report_data.pregnant_women.map(
                        (woman, index) => (
                          <div
                            key={
                              woman.pregnant_woman_id ||
                              `${selectedReport.id}-${index}`
                            }
                            className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">
                              {index + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900">
                                {woman.name || "Unnamed pregnant woman"}
                              </p>

                              <p className="text-xs text-gray-500">
                                Pregnancy ID: {woman.pregnant_woman_id || "—"}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-gray-500">ANC</p>

                              <p className="font-semibold text-gray-900">
                                {woman.anc ?? 0}
                              </p>
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                        No individual pregnancy records were included in this
                        report.
                      </div>
                    )}
                  </div>
                </div>

                {/* Important note */}

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                    <div>
                      <p className="font-semibold text-blue-900">
                        Review workflow
                      </p>

                      <p className="mt-1 text-sm leading-6 text-blue-800">
                        This is a preview of the report submitted by the BHW.
                        The detailed review page will allow the Midwife to
                        inspect each pregnant woman, ANC visits, home visits,
                        and other report information before accepting or
                        returning the report.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate(
                    `/dashboard/midwife/monthly-reports/${selectedReport.id}`,
                  );
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <Eye className="h-4 w-4" />
                Open Full Report
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
