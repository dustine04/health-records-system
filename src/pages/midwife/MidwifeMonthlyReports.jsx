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
    return String(date);
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

  return new Date(Number(year), monthNumber - 1, 1).toLocaleDateString(
    "en-PH",
    {
      month: "long",
      year: "numeric",
    },
  );
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
  const tracking = report?.report_data?.pregnancy_tracking;

  if (tracking?.total !== undefined && tracking?.total !== null) {
    return Number(tracking.total) || 0;
  }

  return getPregnantWomenCount(report);
}

function getNewPregnancyCount(report) {
  const tracking = report?.report_data?.pregnancy_tracking;

  if (tracking?.new !== undefined && tracking?.new !== null) {
    return Number(tracking.new) || 0;
  }

  return 0;
}

/**
 * Safely retrieve the currently logged-in user.
 *
 * This project stores the logged-in user in localStorage
 * under the key "user".
 */
function getCurrentUser() {
  try {
    const storedUser = localStorage.getItem("user");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Unable to read logged-in user:", error);
    return null;
  }
}

export default function MidwifeMonthlyReports() {
  const navigate = useNavigate();

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
    // Initial loading for the currently logged-in Midwife.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * =========================================================
   * FETCH REPORTS BELONGING ONLY TO THIS MIDWIFE'S BHW USERS
   * =========================================================
   *
   * Step 1:
   * Read the logged-in Midwife from localStorage.
   *
   * Step 2:
   * Retrieve users where:
   *   role = "bhw"
   *   created_by_midwife_id = current Midwife ID
   *
   * Step 3:
   * Retrieve monthly reports where bhw_id belongs to those
   * BHW accounts.
   *
   * Step 4:
   * Attach the corresponding BHW information to each report.
   *
   * Reports are not regenerated here. The page displays the
   * report_data snapshot saved by the BHW.
   */
  async function fetchReports(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const currentUser = getCurrentUser();

      if (!currentUser?.id) {
        throw new Error(
          "Unable to identify the logged-in Midwife. Please log in again.",
        );
      }

      if (currentUser.role && currentUser.role !== "midwife") {
        throw new Error("Only a Midwife account can access this page.");
      }

      const midwifeId = Number(currentUser.id);

      if (!Number.isSafeInteger(midwifeId) || midwifeId <= 0) {
        throw new Error("The logged-in Midwife ID is invalid.");
      }

      // -------------------------------------------------------
      // STEP 1: Retrieve BHW accounts created by this Midwife.
      // -------------------------------------------------------

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
          district_id,
          created_by_midwife_id
        `,
        )
        .eq("role", "bhw")
        .eq("created_by_midwife_id", midwifeId);

      if (userError) {
        throw userError;
      }

      const ownBhwUsers = userData || [];

      setBhwUsers(ownBhwUsers);

      // No BHW accounts created by this Midwife means there
      // cannot be any reports belonging to their BHW accounts.

      if (ownBhwUsers.length === 0) {
        setReports([]);
        setSelectedReport(null);
        return;
      }

      // -------------------------------------------------------
      // STEP 2: Get the IDs of those BHW accounts.
      // -------------------------------------------------------

      const bhwIds = [
        ...new Set(
          ownBhwUsers
            .map((user) => Number(user.id))
            .filter((id) => Number.isSafeInteger(id) && id > 0),
        ),
      ];

      if (bhwIds.length === 0) {
        setReports([]);
        setSelectedReport(null);
        return;
      }

      // -------------------------------------------------------
      // STEP 3: Retrieve only reports submitted by those BHWs.
      // -------------------------------------------------------

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
        .in("bhw_id", bhwIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("submitted_at", { ascending: false });

      if (reportError) {
        throw reportError;
      }

      const reportRows = reportData || [];

      // -------------------------------------------------------
      // STEP 4: Match each report with its BHW account.
      // -------------------------------------------------------

      const userMap = new Map(
        ownBhwUsers.map((user) => [String(user.id), user]),
      );

      const combinedReports = reportRows
        .filter((report) => userMap.has(String(report.bhw_id)))
        .map((report) => ({
          ...report,
          bhw: userMap.get(String(report.bhw_id)) || null,
        }));

      setReports(combinedReports);

      // Clear a preview if the selected report no longer exists
      // in the current Midwife's accessible report list.
      setSelectedReport((previous) => {
        if (!previous) return null;

        return (
          combinedReports.find(
            (report) => String(report.id) === String(previous.id),
          ) || null
        );
      });
    } catch (err) {
      console.error("Error loading Midwife monthly reports:", err);

      setReports([]);
      setBhwUsers([]);
      setSelectedReport(null);

      setError(err?.message || "Unable to load monthly pregnancy reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /**
   * =========================================================
   * FILTERED REPORTS
   * =========================================================
   */
  const filteredReports = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      if (statusFilter !== "all" && report.status !== statusFilter) {
        return false;
      }

      if (!search) return true;

      const searchableText = [
        getFullName(report.bhw),
        report.bhw?.username,
        formatMonthYear(report.month, report.year),
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

  /**
   * =========================================================
   * STATISTICS
   * =========================================================
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

  /**
   * =========================================================
   * LOADING SCREEN
   * =========================================================
   */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

            <p className="text-sm text-gray-500">
              Loading your BHW monthly pregnancy reports...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <FileCheck2 className="h-6 w-6 text-blue-600" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Monthly Pregnancy Reports
              </h1>

              <p className="text-sm text-gray-500">
                Review monthly reports submitted by your BHW accounts.
              </p>
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

        {/* ERROR */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0 flex-1">
              <p className="font-semibold">Unable to load reports</p>

              <p className="mt-1 text-sm">{error}</p>

              <button
                type="button"
                onClick={() => fetchReports(true)}
                className="mt-3 text-sm font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* STATISTICS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* BHW ACCOUNT SUMMARY */}

        <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <p className="font-semibold text-blue-900">
                Your assigned BHW accounts
              </p>

              <p className="mt-1 text-sm text-blue-800">
                Only reports submitted by BHW accounts you created are displayed
                on this page.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-center">
            <p className="text-xs text-gray-500">BHW Accounts</p>

            <p className="text-xl font-bold text-blue-700">{bhwUsers.length}</p>
          </div>
        </div>

        {/* SEARCH AND STATUS FILTER */}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
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
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

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

        {/* REPORT LIST */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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

          {filteredReports.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <ClipboardList className="h-7 w-7 text-gray-400" />
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">
                No monthly reports found
              </h3>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                {bhwUsers.length === 0
                  ? "You have no BHW accounts created under your Midwife account yet."
                  : "No reports from your BHW accounts match the current search and status filter."}
              </p>

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

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

                      return (
                        <tr
                          key={report.id}
                          className="transition hover:bg-gray-50"
                        >
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

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              <CalendarDays className="h-4 w-4 text-gray-400" />

                              {formatMonthYear(report.month, report.year)}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-gray-900">
                              {getPregnantWomenCount(report)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-blue-600">
                              {getNewPregnancyCount(report)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-600">
                              {formatDate(report.submitted_at)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              {config.label}
                            </span>
                          </td>

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

              {/* MOBILE CARDS */}

              <div className="divide-y divide-gray-100 md:hidden">
                {filteredReports.map((report) => {
                  const config =
                    statusConfig[report.status] || statusConfig.submitted;

                  const StatusIcon = config.icon;

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
                            {getPregnantWomenCount(report)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-blue-50 p-3">
                          <p className="text-xs text-gray-500">
                            New This Month
                          </p>

                          <p className="mt-1 text-lg font-bold text-blue-700">
                            {getNewPregnancyCount(report)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/dashboard/midwife/monthly-reports/${report.id}`,
                          )
                        }
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

      {/* QUICK REPORT PREVIEW MODAL */}

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
            {/* MODAL HEADER */}

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
                aria-label="Close report preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="overflow-y-auto p-5">
              <div className="space-y-5">
                {/* SUBMITTED BY */}

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

                {/* REPORT INFORMATION */}

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

                    <div className="rounded-lg border border-gray-200 p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500">Total Pregnancies</p>

                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {getTotalPregnancyCount(selectedReport)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PREGNANT WOMEN */}

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Pregnant Women Included
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    These records are taken from the submitted report snapshot.
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

                {/* REVIEW INFORMATION */}

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                    <div>
                      <p className="font-semibold text-blue-900">
                        Review workflow
                      </p>

                      <p className="mt-1 text-sm leading-6 text-blue-800">
                        This preview displays the report snapshot submitted by
                        the BHW. Open the full report to inspect the available
                        details and continue the review process.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}

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
