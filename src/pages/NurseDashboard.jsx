import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

const STATUS_STYLES = {
  submitted: "bg-amber-100 text-amber-700",
  reviewed: "bg-emerald-100 text-emerald-700",
  returned: "bg-rose-100 text-rose-700",
  draft: "bg-gray-100 text-gray-600",
};

function getDisplayName(user) {
  if (!user) return "Unknown Midwife";

  const name = [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || user.username || "Unknown Midwife";
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatReportingPeriod(month, year) {
  if (!month || !year) return "Period not specified";

  const monthNumber = Number(month);

  if (monthNumber < 1 || monthNumber > 12) {
    return `${month} ${year}`;
  }

  const date = new Date(Number(year), monthNumber - 1, 1);

  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor,
  iconBackground,
  loading,
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {loading ? (
              <span className="inline-block h-9 w-12 animate-pulse rounded-md bg-gray-100" />
            ) : (
              value
            )}
          </div>

          <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBackground}`}
        >
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
          <Icon className="h-5 w-5 text-emerald-700" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>

      {action}
    </div>
  );
}

function NurseDashboard() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const [districtName, setDistrictName] = useState("");
  const [barangayCount, setBarangayCount] = useState(0);
  const [reports, setReports] = useState([]);
  const [midwives, setMidwives] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async (isRefresh = false) => {
    if (!user?.id) {
      setError("Your user session could not be found. Please log in again.");
      setLoading(false);
      return;
    }

    if (user.district_id == null) {
      setDistrictName("");
      setBarangayCount(0);
      setReports([]);
      setMidwives({});
      setError(
        "Your account has no assigned district. Please contact the City Health Office administrator.",
      );
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
      // 1. Get the nurse's assigned district.
      const districtRequest = supabase
        .from("districts")
        .select("id, name")
        .eq("id", user.district_id)
        .maybeSingle();

      // 2. Count barangays within the nurse's district.
      const barangayRequest = supabase
        .from("barangays")
        .select("id", { count: "exact", head: true })
        .eq("district_id", user.district_id);

      // 3. Load FHSIS reports assigned to this nurse
      //    within the nurse's own district.
      const reportsRequest = supabase
        .from("midwife_nurse_fhsis_reports")
        .select(
          [
            "id",
            "report_title",
            "reporting_month",
            "reporting_year",
            "midwife_id",
            "status",
            "submitted_at",
            "reviewed_at",
            "created_at",
          ].join(", "),
        )
        .eq("nurse_id", user.id)
        .eq("district_id", user.district_id)
        .in("status", ["submitted", "reviewed", "returned"])
        .order("submitted_at", { ascending: false, nullsFirst: false });

      const [
        { data: district, error: districtError },
        { count: barangays, error: barangayError },
        { data: reportData, error: reportsError },
      ] = await Promise.all([districtRequest, barangayRequest, reportsRequest]);

      if (districtError) throw districtError;
      if (barangayError) throw barangayError;
      if (reportsError) throw reportsError;

      setDistrictName(district?.name || "District not found");
      setBarangayCount(barangays ?? 0);

      const loadedReports = reportData || [];
      setReports(loadedReports);

      // 4. Resolve midwife names for the recent reports.
      const midwifeIds = [
        ...new Set(
          loadedReports
            .map((report) => report.midwife_id)
            .filter((id) => id != null),
        ),
      ];

      if (midwifeIds.length > 0) {
        const { data: midwifeData, error: midwifeError } = await supabase
          .from("users")
          .select("id, username, first_name, middle_name, last_name")
          .in("id", midwifeIds);

        if (midwifeError) throw midwifeError;

        const midwifeMap = {};

        (midwifeData || []).forEach((midwife) => {
          midwifeMap[String(midwife.id)] = getDisplayName(midwife);
        });

        setMidwives(midwifeMap);
      } else {
        setMidwives({});
      }
    } catch (err) {
      console.error("Error loading Nurse Dashboard:", err);

      setError(
        err?.message ||
          "Unable to load dashboard information. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // Load when the logged-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.district_id]);

  const submittedCount = reports.filter(
    (report) => report.status === "submitted",
  ).length;

  const reviewedCount = reports.filter(
    (report) => report.status === "reviewed",
  ).length;

  const returnedCount = reports.filter(
    (report) => report.status === "returned",
  ).length;

  const recentReports = reports.slice(0, 5);

  const currentDate = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Page heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Nurse Portal
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Welcome back, {getDisplayName(user)}. Here is the latest reporting
              activity for your assigned district.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Error / missing account information */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

            <div>
              <p className="font-semibold text-amber-900">
                Dashboard information
              </p>
              <p className="mt-1 text-sm text-amber-800">{error}</p>
            </div>
          </div>
        )}

        {/* Assigned district banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[24px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                <MapPin className="h-4 w-4" />
                Your Assigned District
              </div>

              <h2 className="mt-3 break-words text-2xl font-bold sm:text-3xl">
                {loading && !districtName
                  ? "Loading district..."
                  : districtName || "District not assigned"}
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100">
                Monitor consolidated FHSIS reports submitted by midwives
                assigned to your district.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                  <Users className="h-4 w-4" />
                  {loading ? "..." : barangayCount} barangays
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {currentDate}
                </span>
              </div>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center self-start rounded-2xl border border-white/15 bg-white/10 md:self-center">
              <Building2 className="h-10 w-10 text-white" />
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Reports Overview
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Summary of FHSIS reports assigned to your account.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Reports Received"
              value={reports.length}
              description="All received reports in your district"
              icon={FileText}
              iconColor="text-blue-700"
              iconBackground="bg-blue-50"
              loading={loading}
            />

            <StatCard
              title="Pending Reviews"
              value={submittedCount}
              description="Submitted and awaiting your review"
              icon={Clock}
              iconColor="text-amber-700"
              iconBackground="bg-amber-50"
              loading={loading}
            />

            <StatCard
              title="Reviewed Reports"
              value={reviewedCount}
              description="Reports marked as reviewed"
              icon={CheckCircle2}
              iconColor="text-emerald-700"
              iconBackground="bg-emerald-50"
              loading={loading}
            />

            <StatCard
              title="Returned Reports"
              value={returnedCount}
              description="Reports sent back for corrections"
              icon={Activity}
              iconColor="text-rose-700"
              iconBackground="bg-rose-50"
              loading={loading}
            />
          </div>
        </section>

        {/* Recent reports */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            icon={BarChart3}
            title="Recent FHSIS Reports"
            description="Latest consolidated reports submitted by midwives."
            action={
              <button
                type="button"
                onClick={() =>
                  (window.location.href = "/dashboard/nurse/fhsis-reports")
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                View All Reports
                <ArrowRight className="h-4 w-4" />
              </button>
            }
          />

          <div className="mt-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-xl bg-gray-50"
                  />
                ))}
              </div>
            ) : recentReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
                  <FileText className="h-7 w-7 text-gray-400" />
                </div>

                <h3 className="mt-4 font-semibold text-gray-900">
                  No reports received yet
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                  Consolidated FHSIS reports assigned to your account will
                  appear here when midwives submit them.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    (window.location.href = "/dashboard/nurse/fhsis-reports")
                  }
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Open FHSIS Reports
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col gap-4 rounded-xl border border-gray-100 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                        <FileText className="h-5 w-5 text-emerald-700" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-gray-900">
                          {report.report_title || `FHSIS Report #${report.id}`}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Submitted by{" "}
                          <span className="font-medium text-gray-700">
                            {midwives[String(report.midwife_id)] || "Midwife"}
                          </span>
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatReportingPeriod(
                              report.reporting_month,
                              report.reporting_year,
                            )}
                          </span>

                          <span>
                            Submitted: {formatDate(report.submitted_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center sm:justify-end">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                          STATUS_STYLES[report.status] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {formatStatus(report.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* District information and workflow */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading
              icon={Building2}
              title="District Information"
              description="Your assigned health service coverage."
            />

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Building2 className="h-5 w-5 text-emerald-700" />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Assigned District
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      District health center
                    </p>
                  </div>
                </div>

                <span className="max-w-[50%] break-words text-right text-sm font-semibold text-gray-800">
                  {loading ? "Loading..." : districtName || "Not assigned"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Users className="h-5 w-5 text-blue-700" />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Covered Barangays
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Barangays linked to this district
                    </p>
                  </div>
                </div>

                <span className="text-2xl font-bold text-gray-900">
                  {loading ? "—" : barangayCount}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading
              icon={ShieldCheck}
              title="Reporting Workflow"
              description="Your role in the district reporting process."
            />

            <div className="mt-6 space-y-5">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                  1
                </div>

                <div>
                  <p className="font-semibold text-gray-900">
                    Receive consolidated reports
                  </p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    Receive FHSIS reports submitted by midwives assigned to your
                    district.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                  2
                </div>

                <div>
                  <p className="font-semibold text-gray-900">
                    Review report information
                  </p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    Check reporting periods, consolidated data, and the included
                    BNS and BHW reports.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                  3
                </div>

                <div>
                  <p className="font-semibold text-gray-900">
                    Record your review decision
                  </p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    Mark reports as reviewed or return them for correction using
                    the FHSIS Reports page.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  (window.location.href = "/dashboard/nurse/fhsis-reports")
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                Go to FHSIS Reports
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-5 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Health Records Management System</p>
          <p>City Health Office · Nurse Dashboard</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default NurseDashboard;
