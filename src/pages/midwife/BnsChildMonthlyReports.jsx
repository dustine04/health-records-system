import { useEffect, useMemo, useState } from "react";
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileCheck2,
  Filter,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  AlertCircle,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
};

const STATUS_CLASSES = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  returned: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
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

function getCurrentYear() {
  return new Date().getFullYear();
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getUserFullName(user) {
  if (!user) return "-";

  const name = [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || user.full_name || user.name || user.username || "-";
}

function getEmptyReportData() {
  return {
    age_0_11: {
      male: 0,
      female: 0,
      trans_out_male: 0,
      trans_out_female: 0,
      deceased_male: 0,
      deceased_female: 0,
    },

    age_0_12: {
      male: 0,
      female: 0,
      trans_out_male: 0,
      trans_out_female: 0,
      deceased_male: 0,
      deceased_female: 0,
    },

    age_13_23: {
      male: 0,
      female: 0,
      trans_out_male: 0,
      trans_out_female: 0,
      deceased_male: 0,
      deceased_female: 0,
    },

    age_24_59: {
      male: 0,
      female: 0,
      trans_out_male: 0,
      trans_out_female: 0,
      deceased_male: 0,
      deceased_female: 0,
    },
  };
}

function normalizeReportData(data) {
  const empty = getEmptyReportData();

  if (!data || typeof data !== "object") {
    return empty;
  }

  const categories = Object.keys(empty);

  categories.forEach((category) => {
    if (data[category] && typeof data[category] === "object") {
      empty[category] = {
        ...empty[category],
        ...data[category],
      };
    }
  });

  return empty;
}

function getTotalForCategory(category) {
  return Number(category?.male || 0) + Number(category?.female || 0);
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        STATUS_CLASSES[status] || STATUS_CLASSES.draft
      }`}
    >
      {status === "approved" && <CheckCircle2 size={13} />}

      {status === "submitted" && <FileCheck2 size={13} />}

      {status === "returned" && <RotateCcw size={13} />}

      {STATUS_LABELS[status] || status}
    </span>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function BnsChildMonthlyReports() {
  const [user, setUser] = useState(null);

  const [reports, setReports] = useState([]);
  const [bnsUsers, setBnsUsers] = useState({});
  const [barangayMap, setBarangayMap] = useState({});
  const [localAreaMap, setLocalAreaMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [monthFilter, setMonthFilter] = useState("all");

  const [yearFilter, setYearFilter] = useState("all");

  const [selectedReport, setSelectedReport] = useState(null);

  const [reviewNotes, setReviewNotes] = useState("");

  const [savingReview, setSavingReview] = useState(false);

  /* =======================================================
     LOAD LOGGED-IN USER
  ======================================================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      setUser(parsedUser);
    } catch (error) {
      console.error("Unable to parse logged-in user:", error);

      setLoading(false);
    }
  }, []);

  /* =======================================================
     LOAD REPORTS
  ======================================================= */

  useEffect(() => {
    if (!user?.id) return;

    loadReports();
  }, [user]);

  /* =======================================================
     LOAD BNS REPORTS
  ======================================================= */

  async function loadReports() {
    try {
      setLoading(true);
      setErrorMessage("");

      /*
        First get all reports.

        We intentionally don't use a deeply nested
        Supabase relationship here because the exact
        FK relationship between the report table,
        users, and barangays can vary.

        Instead, we load the related records separately.
      */

      const { data: reportRows, error: reportError } = await supabase
        .from("bns_child_monthly_reports")
        .select("*")
        .order("report_year", {
          ascending: false,
        })
        .order("report_month", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (reportError) {
        throw reportError;
      }

      const safeReports = reportRows || [];

      /* ---------------------------------------------------
         Get BNS user IDs
      --------------------------------------------------- */

      const bnsIds = [
        ...new Set(safeReports.map((report) => report.bns_id).filter(Boolean)),
      ];

      /* ---------------------------------------------------
         Get barangay IDs
      --------------------------------------------------- */

      const barangayIds = [
        ...new Set(
          safeReports.map((report) => report.barangay_id).filter(Boolean),
        ),
      ];

      let loadedBnsUsers = {};
      let loadedBarangays = {};
      let loadedLocalAreas = {};

      /* ---------------------------------------------------
         Load BNS users
      --------------------------------------------------- */

      if (bnsIds.length > 0) {
        const { data: bnsData, error: bnsError } = await supabase
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
          .in("id", bnsIds);

        if (bnsError) {
          throw bnsError;
        }

        (bnsData || []).forEach((bns) => {
          loadedBnsUsers[String(bns.id)] = bns;
        });
      }

      /* ---------------------------------------------------
         Load barangays
      --------------------------------------------------- */

      if (barangayIds.length > 0) {
        const { data: barangayData, error: barangayError } = await supabase
          .from("barangays")
          .select(
            `
              id,
              name,
              district_id
            `,
          )
          .in("id", barangayIds);

        if (barangayError) {
          throw barangayError;
        }

        (barangayData || []).forEach((barangay) => {
          loadedBarangays[String(barangay.id)] = barangay;
        });
      }
      /* ---------------------------------------------------
   Load BNS assigned Purok / Sitio
--------------------------------------------------- */

      if (bnsIds.length > 0) {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("worker_area_assignments")
          .select(
            `
      worker_id,
      local_area_id,
      is_active,
      local_areas (
        id,
        name,
        type,
        barangay_id
      )
    `,
          )
          .in("worker_id", bnsIds)
          .eq("is_active", true);

        if (assignmentError) {
          throw assignmentError;
        }

        /*
    Store local areas by BNS.

    Example:
    loadedLocalAreas["123"] = [
      {
        id: 1,
        name: "Purok 1",
        type: "Purok",
        barangay_id: 10
      }
    ]
  */

        (assignmentData || []).forEach((assignment) => {
          const localArea = assignment.local_areas;

          if (!localArea?.id) return;

          const workerId = String(assignment.worker_id);

          if (!loadedLocalAreas[workerId]) {
            loadedLocalAreas[workerId] = [];
          }

          loadedLocalAreas[workerId].push({
            id: localArea.id,
            name: localArea.name,
            type: localArea.type,
            barangay_id: localArea.barangay_id,
          });
        });
      }
      /* ---------------------------------------------------
         Attach related information
      --------------------------------------------------- */

      const enrichedReports = safeReports.map((report) => ({
        ...report,

        bns: loadedBnsUsers[String(report.bns_id)] || null,

        barangay: loadedBarangays[String(report.barangay_id)] || null,

        localAreas: loadedLocalAreas[String(report.bns_id)] || [],
      }));

      setReports(enrichedReports);
      setBnsUsers(loadedBnsUsers);
      setBarangayMap(loadedBarangays);
      setLocalAreaMap(loadedLocalAreas);
    } catch (error) {
      console.error("Error loading BNS child reports:", error);

      setErrorMessage(error.message || "Unable to load BNS child reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function handleRefresh() {
    setRefreshing(true);
    await loadReports();
  }

  /* =======================================================
     MIDWIFE ACCESS FILTER
  ======================================================= */

  const scopedReports = useMemo(() => {
    /*
      Your existing Midwife pregnancy page uses:
      
      1. user.barangay_id when available
      2. otherwise user.district_id

      We follow the same pattern here.

      If the Midwife has neither field, we show all
      reports rather than accidentally hiding everything.
    */

    if (!user) return [];

    const hasBarangay =
      user.barangay_id !== null &&
      user.barangay_id !== undefined &&
      user.barangay_id !== "";

    const hasDistrict =
      user.district_id !== null &&
      user.district_id !== undefined &&
      user.district_id !== "";

    if (hasBarangay) {
      return reports.filter(
        (report) => String(report.barangay_id) === String(user.barangay_id),
      );
    }

    if (hasDistrict) {
      return reports.filter(
        (report) =>
          String(report.barangay?.district_id) === String(user.district_id),
      );
    }

    return reports;
  }, [reports, user]);

  /* =======================================================
     FILTER REPORTS
  ======================================================= */

  const filteredReports = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return scopedReports.filter((report) => {
      /* Status */
      if (statusFilter !== "all" && report.status !== statusFilter) {
        return false;
      }

      /* Month */
      if (
        monthFilter !== "all" &&
        Number(report.report_month) !== Number(monthFilter)
      ) {
        return false;
      }

      /* Year */
      if (
        yearFilter !== "all" &&
        Number(report.report_year) !== Number(yearFilter)
      ) {
        return false;
      }

      /* Search */
      if (keyword) {
        const bnsName = getUserFullName(report.bns).toLowerCase();

        const barangayName = String(report.barangay?.name || "").toLowerCase();

        const monthName =
          MONTHS[Number(report.report_month) - 1]?.toLowerCase() || "";

        const searchable = [
          bnsName,
          barangayName,
          monthName,
          String(report.report_year),
        ].join(" ");

        if (!searchable.includes(keyword)) {
          return false;
        }
      }

      return true;
    });
  }, [scopedReports, search, statusFilter, monthFilter, yearFilter]);

  /* =======================================================
     REPORT STATISTICS
  ======================================================= */

  const statistics = useMemo(() => {
    return {
      total: scopedReports.length,

      submitted: scopedReports.filter((report) => report.status === "submitted")
        .length,

      returned: scopedReports.filter((report) => report.status === "returned")
        .length,

      approved: scopedReports.filter((report) => report.status === "approved")
        .length,
    };
  }, [scopedReports]);

  /* =======================================================
     AVAILABLE YEARS
  ======================================================= */

  const availableYears = useMemo(() => {
    const years = [
      ...new Set(
        scopedReports
          .map((report) => Number(report.report_year))
          .filter(Boolean),
      ),
    ];

    return years.sort((a, b) => b - a);
  }, [scopedReports]);

  /* =======================================================
     OPEN REPORT
  ======================================================= */

  function openReport(report) {
    setSelectedReport(report);

    setReviewNotes(report.review_notes || "");
  }

  /* =======================================================
     CLOSE REPORT
  ======================================================= */

  function closeReport() {
    if (savingReview) return;

    setSelectedReport(null);
    setReviewNotes("");
  }

  /* =======================================================
     UPDATE REPORT STATUS
  ======================================================= */

  async function updateReportStatus(nextStatus) {
    if (!selectedReport) {
      return;
    }

    if (nextStatus !== "approved" && nextStatus !== "returned") {
      return;
    }

    /* ---------------------------------------------------
       Require notes when returning
    --------------------------------------------------- */

    if (nextStatus === "returned" && !reviewNotes.trim()) {
      alert(
        "Please enter review notes before returning the report to the BNS.",
      );

      return;
    }

    const actionText = nextStatus === "approved" ? "approve" : "return";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} this report?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingReview(true);
      setErrorMessage("");

      const updatePayload = {
        status: nextStatus,

        reviewed_by: user.id,

        reviewed_at: new Date().toISOString(),

        review_notes: reviewNotes.trim() || null,

        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("bns_child_monthly_reports")
        .update(updatePayload)
        .eq("id", selectedReport.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      /* ---------------------------------------------------
         Update current report
      --------------------------------------------------- */

      const updatedReport = {
        ...selectedReport,
        ...data,
      };

      setSelectedReport(updatedReport);

      /* ---------------------------------------------------
         Update list
      --------------------------------------------------- */

      setReports((previous) =>
        previous.map((report) =>
          String(report.id) === String(selectedReport.id)
            ? {
                ...report,
                ...data,
              }
            : report,
        ),
      );

      if (nextStatus === "approved") {
        alert("The BNS child monitoring report has been approved.");
      } else {
        alert("The report has been returned to the BNS for correction.");
      }
    } catch (error) {
      console.error("Error updating report status:", error);

      setErrorMessage(error.message || "Unable to update the report.");
    } finally {
      setSavingReview(false);
    }
  }

  /* =======================================================
     RENDER REPORT TABLE
  ======================================================= */

  function ReportDataTable({ data }) {
    const rows = [
      {
        key: "age_0_11",
        label: "0–11 mos old",
      },
      {
        key: "age_0_12",
        label: "0–12 mos old",
      },
      {
        key: "age_13_23",
        label: "13–23 mos old",
      },
      {
        key: "age_24_59",
        label: "24–59 mos old",
      },
    ];

    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[950px]">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th rowSpan="2" className="px-4 py-3 text-left">
                Age Group
              </th>

              <th
                colSpan="2"
                className="border-l border-gray-200 px-4 py-3 text-center"
              >
                Actual Population
              </th>

              <th
                colSpan="2"
                className="border-l border-gray-200 px-4 py-3 text-center"
              >
                Trans-out
              </th>

              <th
                colSpan="2"
                className="border-l border-gray-200 px-4 py-3 text-center"
              >
                Deceased
              </th>
            </tr>

            <tr className="border-t border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="border-l border-gray-200 px-4 py-3 text-center">
                Male
              </th>

              <th className="px-4 py-3 text-center">Female</th>

              <th className="border-l border-gray-200 px-4 py-3 text-center">
                Male
              </th>

              <th className="px-4 py-3 text-center">Female</th>

              <th className="border-l border-gray-200 px-4 py-3 text-center">
                Male
              </th>

              <th className="px-4 py-3 text-center">Female</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const item = data?.[row.key] || {};

              return (
                <tr key={row.key} className="border-t border-gray-200">
                  <td className="px-4 py-4 font-semibold text-gray-800">
                    {row.label}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex min-w-[55px] justify-center rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-700">
                      {Number(item.male || 0)}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex min-w-[55px] justify-center rounded-lg bg-pink-50 px-3 py-2 font-semibold text-pink-700">
                      {Number(item.female || 0)}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    {Number(item.trans_out_male || 0)}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {Number(item.trans_out_female || 0)}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {Number(item.deceased_male || 0)}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {Number(item.deceased_female || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /* =======================================================
     REPORT REVIEW MODAL
  ======================================================= */

  function ReportReviewModal() {
    if (!selectedReport) {
      return null;
    }

    const reportData = normalizeReportData(selectedReport.report_data);

    const bns = selectedReport.bns;

    const barangay = selectedReport.barangay;
    const localAreas = selectedReport.localAreas || [];
    const reportMonthName =
      MONTHS[Number(selectedReport.report_month) - 1] || "-";

    const canReview = selectedReport.status === "submitted";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* MODAL HEADER */}
          <div className="flex items-start justify-between border-b border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <Baby size={26} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-800">
                    Child Monitoring Monthly Report
                  </h2>

                  <StatusBadge status={selectedReport.status} />
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Review the monthly report submitted by the BNS.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeReport}
              disabled={savingReview}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              <X size={22} />
            </button>
          </div>

          {/* MODAL BODY */}
          <div className="overflow-y-auto p-6">
            <div className="space-y-6">
              {/* REPORT INFORMATION */}
              <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5 md:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    BNS
                  </p>

                  <p className="mt-1 font-semibold text-gray-800">
                    {getUserFullName(bns)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Barangay
                  </p>

                  <p className="mt-1 font-semibold text-gray-800">
                    {barangay?.name || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Purok / Sitio
                  </p>

                  {localAreas.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {localAreas.map((area) => (
                        <span
                          key={area.id}
                          className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                        >
                          {area.type ? `${area.type}: ` : ""}
                          {area.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 font-semibold text-gray-400">
                      No assigned Purok/Sitio
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Reporting Period
                  </p>

                  <p className="mt-1 font-semibold text-gray-800">
                    {reportMonthName} {selectedReport.report_year}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Submitted
                  </p>

                  <p className="mt-1 font-semibold text-gray-800">
                    {formatDate(selectedReport.submitted_at)}
                  </p>
                </div>
              </div>

              {/* REPORT */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardList size={20} className="text-blue-600" />

                  <h3 className="font-semibold text-gray-800">
                    Actual Population {selectedReport.report_year}
                  </h3>
                </div>

                <ReportDataTable data={reportData} />
              </div>

              {/* TOTALS */}
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  {
                    label: "0–11 months",
                    value: getTotalForCategory(reportData.age_0_11),
                  },
                  {
                    label: "0–12 months",
                    value: getTotalForCategory(reportData.age_0_12),
                  },
                  {
                    label: "13–23 months",
                    value: getTotalForCategory(reportData.age_13_23),
                  },
                  {
                    label: "24–59 months",
                    value: getTotalForCategory(reportData.age_24_59),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <p className="text-xs text-gray-500">{item.label}</p>

                    <p className="mt-1 text-2xl font-bold text-gray-800">
                      {item.value}
                    </p>

                    <p className="text-xs text-gray-400">male + female</p>
                  </div>
                ))}
              </div>

              {/* PREVIOUS REVIEW */}
              {selectedReport.review_notes && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-gray-500" />

                    <h3 className="font-semibold text-gray-800">
                      Review Notes
                    </h3>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                    {selectedReport.review_notes}
                  </p>

                  {selectedReport.reviewed_at && (
                    <p className="mt-2 text-xs text-gray-400">
                      Reviewed on {formatDate(selectedReport.reviewed_at)}
                    </p>
                  )}
                </div>
              )}

              {/* REVIEW AREA */}
              {canReview && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <div className="flex items-start gap-3">
                    <MessageSquare
                      size={20}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div className="w-full">
                      <h3 className="font-semibold text-blue-800">
                        Midwife Review
                      </h3>

                      <p className="mt-1 text-sm text-blue-700">
                        Add notes if the report needs correction. Notes are
                        required when returning the report.
                      </p>

                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={4}
                        placeholder="Enter review notes..."
                        className="mt-4 w-full resize-none rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MODAL FOOTER */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={closeReport}
              disabled={savingReview}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              <X size={18} />
              Close
            </button>

            {canReview && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => updateReportStatus("returned")}
                  disabled={savingReview}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={18} />

                  {savingReview ? "Processing..." : "Return to BNS"}
                </button>

                <button
                  type="button"
                  onClick={() => updateReportStatus("approved")}
                  disabled={savingReview}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />

                  {savingReview ? "Processing..." : "Approve Report"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN RENDER
  ======================================================= */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ===================================================
            HEADER
        ================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <FileCheck2 size={28} />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  BNS Child Monitoring Reports
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Receive, review, and approve monthly child monitoring reports
                  submitted by BNS.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* ===================================================
            ERROR
        ================================================== */}

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />

            <div>
              <p className="font-semibold">Unable to load reports</p>

              <p className="mt-1 text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ===================================================
            STATISTICS
        ================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Reports</p>

                <p className="mt-1 text-3xl font-bold text-gray-800">
                  {statistics.total}
                </p>
              </div>

              <div className="rounded-xl bg-gray-100 p-3 text-gray-600">
                <ClipboardList size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Awaiting Review</p>

                <p className="mt-1 text-3xl font-bold text-blue-800">
                  {statistics.submitted}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-blue-600">
                <FileCheck2 size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Returned</p>

                <p className="mt-1 text-3xl font-bold text-orange-800">
                  {statistics.returned}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-orange-600">
                <RotateCcw size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Approved</p>

                <p className="mt-1 text-3xl font-bold text-green-800">
                  {statistics.approved}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-green-600">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================
            FILTERS
        ================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={19} className="text-blue-600" />

            <h2 className="font-semibold text-gray-800">Filter Reports</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {/* SEARCH */}
            <div className="relative xl:col-span-2">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search BNS or barangay..."
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* STATUS */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Statuses</option>

              <option value="submitted">Submitted</option>

              <option value="returned">Returned</option>

              <option value="approved">Approved</option>

              <option value="draft">Draft</option>
            </select>

            {/* MONTH */}
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Months</option>

              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>

            {/* YEAR */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Years</option>

              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ===================================================
            REPORT LIST
        ================================================== */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">
                  Submitted Child Reports
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Showing {filteredReports.length} report
                  {filteredReports.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

              <span className="ml-3 text-sm text-gray-500">
                Loading reports...
              </span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="rounded-full bg-gray-100 p-4 text-gray-400">
                <ClipboardList size={28} />
              </div>

              <h3 className="mt-4 font-semibold text-gray-700">
                No reports found
              </h3>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                There are no BNS child monitoring reports matching the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4">BNS</th>

                    <th className="px-5 py-4">Barangay</th>

                    <th className="px-5 py-4">Purok / Sitio</th>

                    <th className="px-5 py-4">Reporting Period</th>

                    <th className="px-5 py-4">Submitted</th>

                    <th className="px-5 py-4">Status</th>

                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.map((report) => {
                    const monthName =
                      MONTHS[Number(report.report_month) - 1] || "-";
                    const localAreas = report.localAreas || [];
                    return (
                      <tr
                        key={report.id}
                        className="border-t border-gray-100 transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                              <Baby size={18} />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-800">
                                {getUserFullName(report.bns)}
                              </p>

                              <p className="text-xs text-gray-400">BNS</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-gray-700">
                            {report.barangay?.name || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {localAreas.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {localAreas.map((area) => (
                                <span
                                  key={area.id}
                                  className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                                >
                                  {area.type ? `${area.type}: ` : ""}
                                  {area.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">
                              No assigned area
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-800">
                            {monthName} {report.report_year}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-600">
                            {formatDate(report.submitted_at)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={report.status} />
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openReport(report)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            <Eye size={16} />
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===================================================
            MODAL
        ================================================== */}

        <ReportReviewModal />
      </div>
    </DashboardLayout>
  );
}
