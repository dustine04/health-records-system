import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Baby,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRound,
  UserRoundCheck,
  UserRoundCog,
  AlertCircle,
  ArrowRight,
  Clock,
  Home,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

const ROLE_STYLES = {
  cho_admin: {
    label: "CHO Admin",
    color: "#7c3aed",
    badge: "bg-violet-100 text-violet-700",
  },
  nurse: {
    label: "Nurse",
    color: "#2563eb",
    badge: "bg-blue-100 text-blue-700",
  },
  midwife: {
    label: "Midwife",
    color: "#db2777",
    badge: "bg-pink-100 text-pink-700",
  },
  bns: {
    label: "BNS",
    color: "#059669",
    badge: "bg-emerald-100 text-emerald-700",
  },
  bhw: {
    label: "BHW",
    color: "#d97706",
    badge: "bg-amber-100 text-amber-700",
  },
};

const REPORT_STATUS_STYLES = {
  submitted: "bg-blue-100 text-blue-700",
  reviewed: "bg-emerald-100 text-emerald-700",
  returned: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
  approved: "bg-emerald-100 text-emerald-700",
};

const CHART_COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed"];

const EMPTY_DATA = {
  districts: [],
  barangays: [],
  users: [],
  localAreas: [],
  households: [],
  residents: [],
  childHealthRecords: [],
  pregnantWomen: [],
  bhwReports: [],
  bnsReports: [],
  fhsisReports: [],
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(value || 0);
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

function getFullName(user) {
  if (!user) return "Unknown user";

  const firstName = user.first_name || "";
  const middleName = user.middle_name || "";
  const lastName = user.last_name || "";

  const name = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || user.username || "Unknown user";
}

function getStatusClass(status) {
  return (
    REPORT_STATUS_STYLES[String(status || "").toLowerCase()] ||
    "bg-gray-100 text-gray-600"
  );
}

function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      /*
       * These queries use the table names and relationships from
       * the existing HRMS database.
       *
       * Optional health/report tables are loaded separately so that
       * a missing optional table does not prevent the dashboard from
       * displaying districts, users, households, and residents.
       */
      const results = await Promise.allSettled([
        supabase.from("districts").select("id, name").order("name"),
        supabase
          .from("barangays")
          .select("id, name, district_id")
          .order("name"),
        supabase
          .from("users")
          .select(
            "id, username, first_name, middle_name, last_name, role, district_id, barangay_id, is_active, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("local_areas").select("id, name, type, barangay_id"),
        supabase.from("households").select("id, household_code, local_area_id"),
        supabase.from("residents").select("id, household_id"),
        supabase.from("child_health_records").select("id"),
        supabase.from("pregnant_women").select("id"),
        supabase
          .from("bhw_monthly_reports")
          .select("id, bhw_id, month, year, status, submitted_at, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("bns_child_monthly_reports")
          .select("id, bns_id, month, year, status, submitted_at, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("midwife_nurse_fhsis_reports")
          .select(
            "id, reporting_month, reporting_year, district_id, midwife_id, nurse_id, report_title, status, submitted_at, reviewed_at",
          )
          .order("submitted_at", { ascending: false }),
      ]);

      const unpack = (result, label, optional = false) => {
        if (result.status !== "fulfilled") {
          if (!optional) {
            console.error(`Failed to load ${label}:`, result.reason);
          }

          return [];
        }

        const response = result.value;

        if (response.error) {
          if (!optional) {
            console.error(`Failed to load ${label}:`, response.error);
          }

          return [];
        }

        return response.data || [];
      };

      const [
        districts,
        barangays,
        users,
        localAreas,
        households,
        residents,
        childHealthRecords,
        pregnantWomen,
        bhwReports,
        bnsReports,
        fhsisReports,
      ] = results.map((result, index) =>
        unpack(
          result,
          [
            "districts",
            "barangays",
            "users",
            "local areas",
            "households",
            "residents",
            "child health records",
            "pregnant women",
            "BHW reports",
            "BNS reports",
            "FHSIS reports",
          ][index],
          index >= 6,
        ),
      );

      /*
       * Core location/account tables are required for a complete
       * district overview. Do not silently present a failed core query
       * as if the database contained zero records.
       */
      const coreResults = results.slice(0, 6);
      const coreFailed = coreResults.some(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value.error),
      );

      if (coreFailed) {
        setError(
          "Some dashboard data could not be loaded. Check the browser console and your Supabase table permissions.",
        );
      }

      setData({
        districts,
        barangays,
        users,
        localAreas,
        households,
        residents,
        childHealthRecords,
        pregnantWomen,
        bhwReports,
        bnsReports,
        fhsisReports,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Admin dashboard loading error:", err);
      setError(
        "Unable to load the dashboard. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statistics = useMemo(() => {
    const countRole = (role) =>
      data.users.filter(
        (account) =>
          String(account.role || "").toLowerCase() === role &&
          account.is_active !== false,
      ).length;

    const activeAccounts = data.users.filter(
      (account) => account.is_active !== false,
    ).length;

    return [
      {
        title: "Districts",
        value: data.districts.length,
        description: "Health service districts",
        icon: Building2,
        iconStyle: "bg-blue-50 text-blue-600",
      },
      {
        title: "Barangays",
        value: data.barangays.length,
        description: "Registered barangays",
        icon: MapPin,
        iconStyle: "bg-violet-50 text-violet-600",
      },
      {
        title: "Nurses",
        value: countRole("nurse"),
        description: "Active nurse accounts",
        icon: UserRoundCheck,
        iconStyle: "bg-sky-50 text-sky-600",
      },
      {
        title: "Midwives",
        value: countRole("midwife"),
        description: "Active midwife accounts",
        icon: HeartPulse,
        iconStyle: "bg-pink-50 text-pink-600",
      },
      {
        title: "BNS Workers",
        value: countRole("bns"),
        description: "Active BNS accounts",
        icon: Baby,
        iconStyle: "bg-emerald-50 text-emerald-600",
      },
      {
        title: "BHW Workers",
        value: countRole("bhw"),
        description: "Active BHW accounts",
        icon: UserRound,
        iconStyle: "bg-amber-50 text-amber-600",
      },
      {
        title: "Households",
        value: data.households.length,
        description: "Registered households",
        icon: Home,
        iconStyle: "bg-indigo-50 text-indigo-600",
      },
      {
        title: "Residents",
        value: data.residents.length,
        description: "Registered residents",
        icon: Users,
        iconStyle: "bg-teal-50 text-teal-600",
      },
      {
        title: "Health Records",
        value: data.childHealthRecords.length + data.pregnantWomen.length,
        description: "Child and pregnancy records",
        icon: Activity,
        iconStyle: "bg-rose-50 text-rose-600",
      },
      {
        title: "Active Accounts",
        value: activeAccounts,
        description: "All active system users",
        icon: ShieldCheck,
        iconStyle: "bg-green-50 text-green-600",
      },
    ];
  }, [data]);

  /*
   * Resolve each household's district through:
   * household.local_area_id
   *   -> local_areas.id / barangay_id
   *   -> barangays.id / district_id
   */
  const districtOverview = useMemo(() => {
    const localAreaById = new Map(
      data.localAreas.map((area) => [String(area.id), area]),
    );

    const barangayById = new Map(
      data.barangays.map((barangay) => [String(barangay.id), barangay]),
    );

    const districtById = new Map(
      data.districts.map((district) => [String(district.id), district]),
    );

    const overview = data.districts.map((district) => {
      const districtBarangays = data.barangays.filter(
        (barangay) => String(barangay.district_id) === String(district.id),
      );

      const districtBarangayIds = new Set(
        districtBarangays.map((barangay) => String(barangay.id)),
      );

      const districtUsers = data.users.filter(
        (account) => String(account.district_id) === String(district.id),
      );

      const districtNurses = districtUsers.filter(
        (account) => account.role === "nurse",
      );

      const districtMidwives = districtUsers.filter(
        (account) => account.role === "midwife",
      );

      const districtBns = districtUsers.filter(
        (account) => account.role === "bns",
      );

      const districtBhw = districtUsers.filter(
        (account) => account.role === "bhw",
      );

      const districtHouseholds = data.households.filter((household) => {
        const area = localAreaById.get(String(household.local_area_id));

        return area && districtBarangayIds.has(String(area.barangay_id));
      });

      const householdIds = new Set(
        districtHouseholds.map((household) => String(household.id)),
      );

      const districtResidents = data.residents.filter((resident) =>
        householdIds.has(String(resident.household_id)),
      );

      const barangayRows = districtBarangays.map((barangay) => {
        const barangayLocalAreaIds = new Set(
          data.localAreas
            .filter((area) => String(area.barangay_id) === String(barangay.id))
            .map((area) => String(area.id)),
        );

        const barangayHouseholds = data.households.filter((household) =>
          barangayLocalAreaIds.has(String(household.local_area_id)),
        );

        const barangayHouseholdIds = new Set(
          barangayHouseholds.map((household) => String(household.id)),
        );

        const barangayResidents = data.residents.filter((resident) =>
          barangayHouseholdIds.has(String(resident.household_id)),
        );

        const barangayUsers = data.users.filter(
          (account) => String(account.barangay_id) === String(barangay.id),
        );

        return {
          ...barangay,
          householdCount: barangayHouseholds.length,
          residentCount: barangayResidents.length,
          nurseCount: barangayUsers.filter(
            (account) => account.role === "nurse",
          ).length,
          midwifeCount: barangayUsers.filter(
            (account) => account.role === "midwife",
          ).length,
        };
      });

      return {
        ...district,
        barangayCount: districtBarangays.length,
        nurseCount: districtNurses.length,
        midwifeCount: districtMidwives.length,
        bnsCount: districtBns.length,
        bhwCount: districtBhw.length,
        householdCount: districtHouseholds.length,
        residentCount: districtResidents.length,
        barangays: barangayRows,
      };
    });

    // Avoid unused-variable warnings if schema data is later expanded.
    void barangayById;
    void districtById;

    return overview.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
  }, [data]);

  const roleChartData = useMemo(() => {
    return Object.entries(ROLE_STYLES)
      .map(([role, details]) => ({
        name: details.label,
        role,
        count: data.users.filter(
          (account) => account.role === role && account.is_active !== false,
        ).length,
        color: details.color,
      }))
      .filter((item) => item.count > 0);
  }, [data.users]);

  const barangayChartData = useMemo(() => {
    return [...districtOverview]
      .sort((a, b) => b.barangayCount - a.barangayCount)
      .map((district) => ({
        name: district.name,
        barangays: district.barangayCount,
      }));
  }, [districtOverview]);

  const householdChartData = useMemo(() => {
    return [...districtOverview]
      .sort((a, b) => b.householdCount - a.householdCount)
      .map((district) => ({
        name: district.name,
        households: district.householdCount,
      }));
  }, [districtOverview]);

  const reportSummary = useMemo(() => {
    const reports = [
      ...data.bhwReports.map((report) => ({
        ...report,
        reportType: "BHW Monthly Report",
        date: report.submitted_at || report.created_at,
      })),
      ...data.bnsReports.map((report) => ({
        ...report,
        reportType: "BNS Child Monthly Report",
        date: report.submitted_at || report.created_at,
      })),
      ...data.fhsisReports.map((report) => ({
        ...report,
        reportType: report.report_title || "District FHSIS Report",
        date: report.submitted_at || report.reviewed_at,
      })),
    ];

    const counts = reports.reduce((acc, report) => {
      const status = String(report.status || "unknown").toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const recentReports = reports
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )
      .slice(0, 6);

    return {
      total: reports.length,
      counts,
      recentReports,
    };
  }, [data]);

  const recentUsers = useMemo(() => data.users.slice(0, 6), [data.users]);

  const welcomeName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username
    : "Administrator";

  const quickActions = [
    {
      title: "Manage Users",
      description: "Create and manage nurses, midwives, BNS, and BHW accounts.",
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      path: "/dashboard/admin/users",
    },
    {
      title: "Manage Districts",
      description: "Review district assignments and health service areas.",
      icon: Building2,
      color: "bg-violet-50 text-violet-600",
      path: "/dashboard/admin/districts",
    },
    {
      title: "Manage Barangays",
      description: "Review barangays assigned to each district.",
      icon: MapPin,
      color: "bg-emerald-50 text-emerald-600",
      path: "/dashboard/admin/barangays",
    },
    {
      title: "Health Records",
      description: "Open the health records section of the system.",
      icon: HeartPulse,
      color: "bg-rose-50 text-rose-600",
      path: "/dashboard/admin/health-records",
    },
    {
      title: "Reports",
      description: "Review monthly reports and consolidated FHSIS submissions.",
      icon: FileText,
      color: "bg-amber-50 text-amber-600",
      path: "/dashboard/admin/reports",
    },
    {
      title: "District Coverage",
      description: "Review the city's district and barangay coverage overview.",
      icon: ClipboardList,
      color: "bg-cyan-50 text-cyan-600",
      path: "/dashboard/admin/district-coverage",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck size={16} />
              <span>City Health Office</span>
              <span>/</span>
              <span>Administration</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Welcome back, {welcomeName}. Here is the city-wide health records
              overview.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="hidden text-right sm:block">
                <p className="text-xs text-gray-400">Last updated</p>
                <p className="text-sm font-medium text-gray-600">
                  {lastUpdated.toLocaleTimeString("en-PH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Some data may be incomplete</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Statistics */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                System Overview
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Current totals from the HRMS database
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statistics.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {stat.title}
                      </p>
                      <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                        {loading ? "—" : formatNumber(stat.value)}
                      </p>
                    </div>

                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.iconStyle}`}
                    >
                      <Icon size={22} />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    {stat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Charts */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Analytics and Distribution
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Understand how health workers and household records are
              distributed throughout the city.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* User role chart */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <h3 className="font-bold text-gray-900">Health Workforce</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Active accounts by role
                </p>
              </div>

              {loading ? (
                <div className="flex h-72 items-center justify-center text-sm text-gray-400">
                  Loading workforce data...
                </div>
              ) : roleChartData.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center text-center">
                  <Users size={32} className="text-gray-300" />
                  <p className="mt-3 font-medium text-gray-600">
                    No active accounts found
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    Account totals will appear when users are registered.
                  </p>
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleChartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="46%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {roleChartData.map((entry) => (
                          <Cell key={entry.role} fill={entry.color} />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value, name) => [formatNumber(value), name]}
                      />

                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Barangays per district */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <h3 className="font-bold text-gray-900">
                  Barangays per District
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Number of registered barangays in each district
                </p>
              </div>

              {loading ? (
                <div className="flex h-72 items-center justify-center text-sm text-gray-400">
                  Loading district data...
                </div>
              ) : barangayChartData.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-gray-400">
                  No district data available.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barangayChartData}
                      margin={{
                        top: 10,
                        right: 10,
                        left: -15,
                        bottom: 15,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="barangays"
                        name="Barangays"
                        fill="#2563eb"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Households per district */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
              <div className="mb-5">
                <h3 className="font-bold text-gray-900">
                  Household Distribution by District
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Registered households grouped through their Purok/Sitio and
                  barangay assignments
                </p>
              </div>

              {loading ? (
                <div className="flex h-72 items-center justify-center text-sm text-gray-400">
                  Loading household data...
                </div>
              ) : householdChartData.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-gray-400">
                  No household distribution data available.
                </div>
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={householdChartData}
                      margin={{
                        top: 10,
                        right: 20,
                        left: 0,
                        bottom: 10,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [
                          formatNumber(value),
                          "Households",
                        ]}
                      />
                      <Bar
                        dataKey="households"
                        name="Households"
                        fill="#059669"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={65}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* District and barangay overview */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                District and Barangay Overview
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                District assignments, workforce, households, and residents
              </p>
            </div>

            <span className="w-fit rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
              {formatNumber(data.districts.length)} Districts
            </span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">
              Loading district overview...
            </div>
          ) : districtOverview.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 size={34} className="mx-auto text-gray-300" />
              <p className="mt-3 font-semibold text-gray-700">
                No districts found
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Add districts to Supabase to see the district overview.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {districtOverview.map((district) => (
                <details key={district.id} className="group">
                  <summary className="cursor-pointer list-none p-5 transition hover:bg-gray-50 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Building2 size={21} />
                        </div>

                        <div>
                          <h3 className="font-bold text-gray-900">
                            {district.name}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {formatNumber(district.barangayCount)} barangays
                            {" · "}
                            {formatNumber(district.householdCount)} households
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[480px]">
                        <div className="rounded-lg bg-blue-50/70 px-3 py-2">
                          <p className="text-xs text-blue-600">Nurses</p>
                          <p className="mt-1 font-bold text-gray-900">
                            {formatNumber(district.nurseCount)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-pink-50/70 px-3 py-2">
                          <p className="text-xs text-pink-600">Midwives</p>
                          <p className="mt-1 font-bold text-gray-900">
                            {formatNumber(district.midwifeCount)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-emerald-50/70 px-3 py-2">
                          <p className="text-xs text-emerald-600">BNS</p>
                          <p className="mt-1 font-bold text-gray-900">
                            {formatNumber(district.bnsCount)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-amber-50/70 px-3 py-2">
                          <p className="text-xs text-amber-600">BHW</p>
                          <p className="mt-1 font-bold text-gray-900">
                            {formatNumber(district.bhwCount)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500">
                        {formatNumber(district.residentCount)} residents
                      </p>

                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                        View barangays
                        <ArrowRight
                          size={14}
                          className="transition-transform group-open:rotate-90"
                        />
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-6">
                    {district.barangays.length === 0 ? (
                      <p className="py-3 text-sm text-gray-500">
                        No barangays are assigned to this district.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                        <table className="min-w-full divide-y divide-gray-100 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                                Barangay
                              </th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                Households
                              </th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                Residents
                              </th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                Nurses
                              </th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                Midwives
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-gray-100">
                            {district.barangays.map((barangay) => (
                              <tr
                                key={barangay.id}
                                className="hover:bg-gray-50"
                              >
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                                  {barangay.name}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {formatNumber(barangay.householdCount)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {formatNumber(barangay.residentCount)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {formatNumber(barangay.nurseCount)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {formatNumber(barangay.midwifeCount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        {/* Recent users and reports */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Recent users */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 sm:p-6">
              <div>
                <h2 className="font-bold text-gray-900">Recent Accounts</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Recently created system users
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <UserRoundCog size={20} />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Loading accounts...
              </div>
            ) : recentUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No user accounts found.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentUsers.map((account) => {
                  const roleStyle =
                    ROLE_STYLES[account.role] || ROLE_STYLES.cho_admin;

                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 px-5 py-4 sm:px-6"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                        {getFullName(account)
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {getFullName(account)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          @{account.username || "no-username"}
                          {" · "}
                          {formatDate(account.created_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleStyle.badge}`}
                        >
                          {roleStyle.label}
                        </span>

                        <span
                          className={`text-xs ${
                            account.is_active === false
                              ? "text-red-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {account.is_active === false ? "Inactive" : "Active"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={() => window.location.assign("/dashboard/admin/users")}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                Manage users
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Reports */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 sm:p-6">
              <div>
                <h2 className="font-bold text-gray-900">
                  Monthly Reporting Overview
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  BHW, BNS, and consolidated FHSIS reports
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                <FileText size={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 sm:p-6">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Total Reports
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {loading ? "—" : formatNumber(reportSummary.total)}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-600">Submitted</p>
                <p className="mt-2 text-2xl font-bold text-blue-800">
                  {loading
                    ? "—"
                    : formatNumber(reportSummary.counts.submitted || 0)}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-medium text-emerald-600">Reviewed</p>
                <p className="mt-2 text-2xl font-bold text-emerald-800">
                  {loading
                    ? "—"
                    : formatNumber(reportSummary.counts.reviewed || 0)}
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-xs font-medium text-red-600">Returned</p>
                <p className="mt-2 text-2xl font-bold text-red-800">
                  {loading
                    ? "—"
                    : formatNumber(reportSummary.counts.returned || 0)}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Recent Reports
              </h3>

              {loading ? (
                <p className="py-4 text-sm text-gray-400">Loading reports...</p>
              ) : reportSummary.recentReports.length === 0 ? (
                <div className="py-4 text-center">
                  <ClipboardList size={28} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    No monthly reports found.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportSummary.recentReports.map((report, index) => (
                    <div
                      key={`${report.reportType}-${report.id}-${index}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {report.reportType}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={12} />
                          {formatDate(report.date)}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                          report.status,
                        )}`}
                      >
                        {report.status || "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  window.location.assign("/dashboard/admin/reports")
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                View reports
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Shortcuts to common administrative tasks
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => window.location.assign(action.path)}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.color}`}
                  >
                    <Icon size={23} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-gray-900">
                        {action.title}
                      </h3>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-gray-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
                      />
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {action.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <div className="flex flex-col justify-between gap-2 border-t border-gray-200 pt-5 text-xs text-gray-400 sm:flex-row sm:items-center">
          <p>Health Records Management System · City Health Office</p>
          <p>
            {lastUpdated
              ? `Data refreshed ${lastUpdated.toLocaleString("en-PH")}`
              : "Waiting for dashboard data"}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboard;
