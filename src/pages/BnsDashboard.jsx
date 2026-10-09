import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Home,
  MapPin,
  ClipboardList,
  Plus,
  ArrowRight,
  Baby,
  Activity,
  RefreshCw,
  FileText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertCircle,
  TrendingUp,
  Filter,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

function BnsDashboard() {
  const navigate = useNavigate();

  const [user] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [assignedAreas, setAssignedAreas] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [monthlyReports, setMonthlyReports] = useState([]);

  const [selectedAreaId, setSelectedAreaId] = useState("all");

  const [reportCount, setReportCount] = useState(0);

  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        // 1. Load the BNS worker's assigned areas.
        const { data: assignments, error: assignmentError } = await supabase
          .from("worker_area_assignments")
          .select(
            `
            local_area_id,
            local_areas (
              id,
              name,
              type,
              barangay_id,
              barangays (
                id,
                name
              )
            )
          `,
          )
          .eq("worker_id", user.id)
          .eq("is_active", true);

        if (assignmentError) throw assignmentError;

        const areaMap = new Map();

        (assignments || []).forEach((assignment) => {
          const relatedArea = assignment.local_areas;
          const area = Array.isArray(relatedArea)
            ? relatedArea[0]
            : relatedArea;

          if (area?.id) {
            areaMap.set(String(area.id), area);
          }
        });

        const areas = Array.from(areaMap.values());

        setAssignedAreas(areas);

        const areaIds = areas.map((area) => area.id);

        let householdRows = [];
        let residentRows = [];

        // 2. Load households belonging to the assigned areas.
        if (areaIds.length > 0) {
          const { data: householdData, error: householdError } = await supabase
            .from("households")
            .select("id, local_area_id")
            .in("local_area_id", areaIds);

          if (householdError) throw householdError;

          householdRows = householdData || [];
        }

        // 3. Load residents belonging to those households.
        const householdIds = householdRows.map((household) => household.id);

        if (householdIds.length > 0) {
          const { data: residentData, error: residentError } = await supabase
            .from("residents")
            .select("id, household_id")
            .in("household_id", householdIds);

          if (residentError) throw residentError;

          residentRows = residentData || [];
        }

        setHouseholds(householdRows);
        setResidents(residentRows);

        // 4. Load monthly reports submitted by this BNS.
        // No health_records queries are used in this dashboard.
        const { data: reportData, error: reportsError } = await supabase
          .from("bns_child_monthly_reports")
          .select("*")
          .eq("bns_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (reportsError) {
          // Keep the household dashboard usable if the report table
          // does not contain the expected query fields.
          console.warn(
            "Unable to load BNS monthly reports:",
            reportsError.message,
          );

          setMonthlyReports([]);
          setReportCount(0);
        } else {
          setMonthlyReports(reportData || []);

          // Count all reports rather than only the latest 10.
          const { count, error: reportCountError } = await supabase
            .from("bns_child_monthly_reports")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("bns_id", user.id);

          if (reportCountError) {
            console.warn(
              "Unable to count BNS monthly reports:",
              reportCountError.message,
            );

            setReportCount((reportData || []).length);
          } else {
            setReportCount(count || 0);
          }
        }
      } catch (error) {
        console.error("Error loading BNS dashboard:", error);

        setErrorMessage(
          error.message || "Unable to load dashboard data. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Filter household and resident totals by the selected assigned area.
  const filteredHouseholds = useMemo(() => {
    if (selectedAreaId === "all") {
      return households;
    }

    return households.filter(
      (household) => String(household.local_area_id) === selectedAreaId,
    );
  }, [households, selectedAreaId]);

  const filteredHouseholdIds = useMemo(
    () => new Set(filteredHouseholds.map((household) => String(household.id))),
    [filteredHouseholds],
  );

  const filteredResidents = useMemo(() => {
    if (selectedAreaId === "all") {
      return residents;
    }

    return residents.filter((resident) =>
      filteredHouseholdIds.has(String(resident.household_id)),
    );
  }, [residents, selectedAreaId, filteredHouseholdIds]);

  // Create a chart showing the number of households and residents
  // in each assigned Purok/Sitio.
  const areaChartData = useMemo(() => {
    return assignedAreas.map((area) => {
      const areaHouseholds = households.filter(
        (household) => String(household.local_area_id) === String(area.id),
      );

      const areaHouseholdIds = new Set(
        areaHouseholds.map((household) => String(household.id)),
      );

      const areaResidents = residents.filter((resident) =>
        areaHouseholdIds.has(String(resident.household_id)),
      );

      const barangayRelation = area.barangays;
      const barangay = Array.isArray(barangayRelation)
        ? barangayRelation[0]
        : barangayRelation;

      return {
        id: area.id,
        name: area.name || "Unnamed area",
        barangay: barangay?.name || "Barangay not specified",
        households: areaHouseholds.length,
        residents: areaResidents.length,
      };
    });
  }, [assignedAreas, households, residents]);

  const selectedArea = useMemo(() => {
    if (selectedAreaId === "all") return null;

    return assignedAreas.find((area) => String(area.id) === selectedAreaId);
  }, [assignedAreas, selectedAreaId]);

  const stats = [
    {
      label: "Assigned Areas",
      value: assignedAreas.length,
      description: "Active Purok/Sitio assignments",
      icon: MapPin,
      color: "blue",
      action: null,
    },
    {
      label: "Households",
      value: filteredHouseholds.length,
      description: "Households in selected area",
      icon: Home,
      color: "emerald",
      action: () => navigate("/dashboard/bns/households"),
    },
    {
      label: "Residents",
      value: filteredResidents.length,
      description: "Residents in selected area",
      icon: Users,
      color: "violet",
      action: () => navigate("/dashboard/bns/households"),
    },
    {
      label: "Monthly Reports",
      value: reportCount,
      description: "Reports recorded for your account",
      icon: FileText,
      color: "amber",
      action: () => navigate("/dashboard/bns/monthly-report"),
    },
  ];

  const colorClasses = {
    blue: {
      icon: "bg-blue-100 text-blue-600",
      accent: "text-blue-600",
    },
    emerald: {
      icon: "bg-emerald-100 text-emerald-600",
      accent: "text-emerald-600",
    },
    violet: {
      icon: "bg-violet-100 text-violet-600",
      accent: "text-violet-600",
    },
    amber: {
      icon: "bg-amber-100 text-amber-600",
      accent: "text-amber-600",
    },
  };

  const quickActions = [
    {
      title: "Manage Households",
      description:
        "View households and resident information in your assigned areas.",
      icon: Home,
      iconClass: "bg-blue-100 text-blue-600",
      path: "/dashboard/bns/households",
    },
    {
      title: "Child Monitoring",
      description:
        "View and update child growth, nutrition, and monitoring records.",
      icon: Baby,
      iconClass: "bg-pink-100 text-pink-600",
      path: "/dashboard/bns/child-monitoring",
    },
    {
      title: "Monthly Report",
      description:
        "Prepare, review, and submit your monthly child health report.",
      icon: ClipboardList,
      iconClass: "bg-emerald-100 text-emerald-600",
      path: "/dashboard/bns/monthly-report",
    },
    {
      title: "Add Record",
      description: "Open the record-entry page available to your account.",
      icon: Plus,
      iconClass: "bg-violet-100 text-violet-600",
      path: "/dashboard/bns/add-record",
    },
  ];

  const getReportStatus = (report) => {
    const status = String(report?.status || "draft").toLowerCase();

    if (["approved", "accepted"].includes(status)) {
      return {
        label: "Approved",
        className: "bg-emerald-100 text-emerald-700",
        icon: CheckCircle2,
      };
    }

    if (["submitted", "pending", "for_review"].includes(status)) {
      return {
        label: "Submitted",
        className: "bg-blue-100 text-blue-700",
        icon: Clock3,
      };
    }

    if (["returned", "rejected"].includes(status)) {
      return {
        label: status === "returned" ? "Returned" : "Rejected",
        className: "bg-rose-100 text-rose-700",
        icon: AlertCircle,
      };
    }

    return {
      label: "Draft",
      className: "bg-gray-100 text-gray-600",
      icon: FileText,
    };
  };

  const getReportPeriod = (report) => {
    const month = report?.month;
    const year = report?.year;

    if (month && year) {
      const monthNumber = Number(month);

      if (monthNumber >= 1 && monthNumber <= 12) {
        return new Date(Number(year), monthNumber - 1, 1).toLocaleDateString(
          "en-PH",
          {
            month: "long",
            year: "numeric",
          },
        );
      }

      return `${month} ${year}`;
    }

    if (report?.report_month) {
      return String(report.report_month);
    }

    const dateValue =
      report?.created_at || report?.submitted_at || report?.updated_at;

    if (dateValue) {
      const date = new Date(dateValue);

      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
        });
      }
    }

    return "Monthly report";
  };

  const getReportDate = (report) => {
    const dateValue =
      report?.submitted_at || report?.created_at || report?.updated_at;

    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />

          <h2 className="text-xl font-bold text-gray-800">Session not found</h2>

          <p className="mt-2 text-sm text-gray-500">
            Please log in again to access your BNS dashboard.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Welcome header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Barangay Nutrition Scholar
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Welcome, {user.first_name || user.username || "BNS"}!
              <span className="ml-2" aria-hidden="true">
                👋
              </span>
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Monitor assigned communities, child health activities, and monthly
              reports from one place.
            </p>
          </div>

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={loading || refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading || refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh Dashboard"}
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-rose-600"
              />

              <div>
                <p className="font-semibold text-rose-800">
                  Unable to load some dashboard data
                </p>
                <p className="mt-1 text-sm text-rose-700">{errorMessage}</p>
              </div>
            </div>

            <button
              onClick={() => fetchDashboardData(true)}
              className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Area filter */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Filter size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">Dashboard Filter</h2>
              <p className="text-sm text-gray-500">
                Filter household and resident totals by area.
              </p>
            </div>
          </div>

          <select
            value={selectedAreaId}
            onChange={(event) => setSelectedAreaId(event.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
          >
            <option value="all">All Assigned Areas</option>

            {assignedAreas.map((area) => {
              const barangayRelation = area.barangays;
              const barangay = Array.isArray(barangayRelation)
                ? barangayRelation[0]
                : barangayRelation;

              return (
                <option key={area.id} value={String(area.id)}>
                  {area.name}
                  {barangay?.name ? ` — ${barangay.name}` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {selectedArea && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <MapPin size={20} className="mt-0.5 shrink-0 text-blue-600" />

            <div>
              <p className="font-semibold text-blue-900">{selectedArea.name}</p>
              <p className="mt-1 text-sm text-blue-700">
                {(() => {
                  const relation = selectedArea.barangays;
                  const barangay = Array.isArray(relation)
                    ? relation[0]
                    : relation;

                  return barangay?.name
                    ? `Barangay ${barangay.name}`
                    : "Barangay not specified";
                })()}
                {selectedArea.type ? ` · ${selectedArea.type}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const colors = colorClasses[stat.color];

            return (
              <button
                key={stat.label}
                type="button"
                onClick={stat.action || undefined}
                disabled={!stat.action || loading}
                className={`group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition ${
                  stat.action
                    ? "cursor-pointer hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                    : "cursor-default"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {stat.label}
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                      {loading ? (
                        <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-gray-100" />
                      ) : (
                        stat.value.toLocaleString()
                      )}
                    </p>
                  </div>

                  <div className={`rounded-xl p-3 ${colors.icon}`}>
                    <Icon size={22} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">{stat.description}</p>

                  {stat.action && (
                    <ArrowRight
                      size={16}
                      className={`${colors.accent} transition group-hover:translate-x-1`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                Quick Actions
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Quickly access your daily BNS tasks.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className={`rounded-xl p-3 ${action.iconClass}`}>
                      <Icon size={22} />
                    </div>

                    <ArrowRight
                      size={18}
                      className="mt-1 text-gray-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                    />
                  </div>

                  <h3 className="mt-4 font-semibold text-gray-900">
                    {action.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-6 text-gray-500">
                    {action.description}
                  </p>

                  <span className="mt-4 text-sm font-semibold text-blue-600">
                    Open page
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Assigned area chart */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Community Overview
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Household and resident distribution across your assigned
                Purok/Sitio areas.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingUp size={17} className="text-blue-600" />
              {assignedAreas.length} assigned{" "}
              {assignedAreas.length === 1 ? "area" : "areas"}
            </div>
          </div>

          <div className="mt-6 h-80 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw size={18} className="animate-spin" />
                  Loading community statistics...
                </div>
              </div>
            ) : areaChartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
                <MapPin size={32} className="text-gray-300" />

                <p className="mt-3 font-semibold text-gray-700">
                  No assigned areas found
                </p>

                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Once an administrator or authorized midwife assigns a
                  Purok/Sitio to your account, its statistics will appear here.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={areaChartData}
                  margin={{
                    top: 12,
                    right: 12,
                    left: 0,
                    bottom: 45,
                  }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                  />

                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }

                      const data = payload[0]?.payload;

                      return (
                        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                          <p className="font-semibold text-gray-900">{label}</p>

                          <p className="mt-1 text-xs text-gray-500">
                            {data?.barangay}
                          </p>

                          <p className="mt-2 text-sm text-blue-600">
                            Households: {data?.households ?? 0}
                          </p>

                          <p className="text-sm text-emerald-600">
                            Residents: {data?.residents ?? 0}
                          </p>
                        </div>
                      );
                    }}
                  />

                  <Legend verticalAlign="top" height={36} />

                  <Bar
                    dataKey="households"
                    name="Households"
                    fill="#3B82F6"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={38}
                  />

                  <Bar
                    dataKey="residents"
                    name="Residents"
                    fill="#10B981"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Assigned areas list */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                My Assigned Areas
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Barangays and Purok/Sitio areas assigned to your account.
              </p>
            </div>

            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {assignedAreas.length}{" "}
              {assignedAreas.length === 1 ? "Area" : "Areas"}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading assigned areas...
            </div>
          ) : assignedAreas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <MapPin size={30} className="mx-auto text-gray-300" />

              <p className="mt-3 font-semibold text-gray-700">
                No assigned areas yet
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Contact the authorized administrator or midwife to confirm your
                area assignment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {areaChartData.map((area) => (
                <button
                  type="button"
                  key={area.id}
                  onClick={() => setSelectedAreaId(String(area.id))}
                  className={`rounded-xl border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 ${
                    selectedAreaId === String(area.id)
                      ? "border-blue-300 bg-blue-50/60"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
                        <MapPin size={20} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-gray-900">
                          {area.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {area.barangay}
                        </p>

                        <p className="mt-1 text-xs capitalize text-gray-400">
                          {assignedAreas.find(
                            (item) => String(item.id) === String(area.id),
                          )?.type || "Local area"}
                        </p>
                      </div>
                    </div>

                    <ArrowRight
                      size={17}
                      className="mt-1 shrink-0 text-gray-400"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-xs text-gray-500">Households</p>

                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {area.households}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Residents</p>

                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {area.residents}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedAreaId !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedAreaId("all")}
              className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Clear area filter
            </button>
          )}
        </section>

        {/* Recent monthly reports */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Recent Monthly Reports
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Check the latest monthly reports associated with your account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/bns/monthly-report")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <ClipboardList size={17} />
              Open Monthly Report
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading monthly reports...
            </div>
          ) : monthlyReports.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <CalendarDays size={30} className="mx-auto text-gray-300" />

              <p className="mt-3 font-semibold text-gray-700">
                No monthly reports to display
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Open Monthly Report to prepare or submit a report.
              </p>

              <button
                type="button"
                onClick={() => navigate("/dashboard/bns/monthly-report")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Go to Monthly Report
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Report Period
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {monthlyReports.map((report, index) => {
                    const status = getReportStatus(report);
                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={report.id || index}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                              <FileText size={18} />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-800">
                                {getReportPeriod(report)}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                Monthly child health report
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                          >
                            <StatusIcon size={13} />
                            {status.label}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-500">
                          {getReportDate(report)}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate("/dashboard/bns/monthly-report")
                            }
                            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Open
                            <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Footer note */}
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Activity size={19} className="mt-0.5 shrink-0 text-gray-500" />

          <p className="text-sm leading-6 text-gray-600">
            Dashboard totals are based on the households and residents
            associated with your active area assignments. Monthly report
            statuses depend on the records saved in your monthly report table.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default BnsDashboard;
