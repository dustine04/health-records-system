import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Home,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  CalendarClock,
  ArrowRight,
  RefreshCw,
  Activity,
  MapPin,
  Baby,
  TrendingUp,
  Filter,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Bell,
  BellRing,
  MessageSquare,
  Send,
  Check,
  X,
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

import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

const CLOSED_PREGNANCY_STATUSES = [
  "delivered",
  "miscarriage",
  "stillbirth",
  "inactive",
];

const getLocalDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "Not scheduled";

  const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getDaysOverdue = (dateString) => {
  if (!dateString) return 0;

  const todayDate = new Date(`${getLocalDate()}T00:00:00`);
  const dueDate = new Date(`${String(dateString).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(todayDate.getTime()) || Number.isNaN(dueDate.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((todayDate.getTime() - dueDate.getTime()) / 86400000),
  );
};

const getResidentName = (resident) => {
  if (!resident) return "Unknown resident";

  return (
    [resident.first_name, resident.middle_name, resident.last_name]
      .filter(Boolean)
      .join(" ") || "Unnamed resident"
  );
};

const getRelation = (relation) => {
  return Array.isArray(relation) ? relation[0] : relation;
};

const getErrorMessage = (error) =>
  error?.message || "Something went wrong while loading dashboard data.";

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

  return "Monthly report";
};

const getReportDate = (report) => {
  const dateValue = report?.submitted_at;

  if (!dateValue) {
    return report?.status === "draft"
      ? "Not yet submitted"
      : "Date unavailable";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function BhwDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [assignedAreas, setAssignedAreas] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);

  const [missedHomeVisits, setMissedHomeVisits] = useState([]);
  const [scheduledHomeVisits, setScheduledHomeVisits] = useState([]);
  const [missedAncVisits, setMissedAncVisits] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [smsSuccess, setSmsSuccess] = useState("");
  const [smsTarget, setSmsTarget] = useState(null);
  const [smsSending, setSmsSending] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [reportCount, setReportCount] = useState(0);

  const [selectedAreaId, setSelectedAreaId] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const today = useMemo(() => getLocalDate(), []);

  const loadSmsHistory = useCallback(async (pregnancyIds) => {
    setSmsLoading(true);
    setSmsError("");
    try {
      const token = sessionStorage.getItem("mchms_session_token");
      if (!token)
        throw new Error("Your SMS session is missing. Please log in again.");
      const ids = [...new Set(pregnancyIds.map(Number))];
      const allLogs = [];
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error: requestError } = await supabase.functions.invoke(
          "mchms-sms-history",
          {
            headers: { "x-mchms-session": token },
            body: { pregnancy_ids: ids.slice(i, i + 500) },
          },
        );
        if (requestError) throw requestError;
        if (data?.error) throw new Error(data.error);
        allLogs.push(...(data?.logs || []));
      }
      setSmsLogs(allLogs);
    } catch (err) {
      console.error("BHW SMS history error:", err);
      setSmsLogs([]);
      setSmsError(err?.message || "Unable to check SMS reminders.");
    } finally {
      setSmsLoading(false);
    }
  }, []);

  const smsLogFor = useCallback(
    (visit) => {
      const matches = smsLogs.filter(
        (log) =>
          String(log.pregnant_woman_id) === String(visit.pregnancyId) &&
          String(log.scheduled_date || "").slice(0, 10) === visit.nextVisitDate,
      );
      return (
        matches.find((log) => log.status === "sent") ||
        matches.find((log) => log.status === "pending") ||
        matches[0] ||
        null
      );
    },
    [smsLogs],
  );

  const sendManualSms = useCallback(async () => {
    if (!smsTarget || smsSending) return;
    setSmsSending(true);
    setSmsError("");
    try {
      const token = sessionStorage.getItem("mchms_session_token");
      if (!token)
        throw new Error("Your SMS session is missing. Please log in again.");
      const { data, error: requestError } = await supabase.functions.invoke(
        "send-missed-anc-sms-manual",
        {
          headers: { "x-mchms-session": token },
          body: { pregnancy_id: smsTarget.pregnancyId },
        },
      );
      if (requestError) {
        const details = await requestError.context?.json?.().catch(() => null);
        throw new Error(
          details?.message || details?.error || requestError.message,
        );
      }
      if (!data?.success || data?.sent !== 1)
        throw new Error(data?.message || "SMS request was not accepted.");
      setSmsLogs((previous) => [
        {
          pregnant_woman_id: smsTarget.pregnancyId,
          anc_visit_id: smsTarget.ancVisitId,
          scheduled_date: smsTarget.nextVisitDate,
          status: "sent",
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        ...previous,
      ]);
      setSmsSuccess(
        `SMS reminder successfully submitted for ${smsTarget.residentName}.`,
      );
      setSmsTarget(null);
      // Refresh authoritative records across the BHW's ANC appointments.
      await loadSmsHistory(missedAncVisits.map((visit) => visit.pregnancyId));
    } catch (err) {
      setSmsError(err?.message || "Unable to send SMS reminder.");
    } finally {
      setSmsSending(false);
    }
  }, [smsTarget, smsSending, missedAncVisits, loadSmsHistory]);

  const loadDashboard = useCallback(
    async (currentUser, isRefresh = false) => {
      if (!currentUser?.id) {
        setError("Unable to identify the logged-in BHW account.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        // 1. Load active area assignments.
        const { data: assignments, error: assignmentsError } = await supabase
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
          .eq("worker_id", currentUser.id)
          .eq("is_active", true);

        if (assignmentsError) throw assignmentsError;

        const areaMap = new Map();

        (assignments || []).forEach((assignment) => {
          const area = getRelation(assignment.local_areas);

          if (area?.id) {
            areaMap.set(String(area.id), area);
          }
        });

        const areas = Array.from(areaMap.values());
        setAssignedAreas(areas);

        const areaIds = areas.map((area) => area.id);

        let householdRows = [];
        let residentRows = [];
        let pregnancyRows = [];
        let homeVisitRows = [];

        // 2. Load households within the BHW's assigned areas.
        if (areaIds.length > 0) {
          const { data: householdData, error: householdsError } = await supabase
            .from("households")
            .select(
              `
              id,
              household_code,
              household_head,
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
            .in("local_area_id", areaIds);

          if (householdsError) throw householdsError;

          householdRows = householdData || [];
        }

        setHouseholds(householdRows);

        // 3. Load residents in the assigned households.
        const householdIds = householdRows.map((household) => household.id);

        if (householdIds.length > 0) {
          const { data: residentData, error: residentsError } = await supabase
            .from("residents")
            .select(
              `
              id,
              household_id,
              first_name,
              middle_name,
              last_name,
              sex,
              birth_date,
              households (
                id,
                household_code,
                household_head,
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
              )
            `,
            )
            .in("household_id", householdIds);

          if (residentsError) throw residentsError;

          residentRows = residentData || [];
        }

        setResidents(residentRows);

        // 4. Load pregnancy records for residents in assigned areas.
        const femaleResidentIds = residentRows
          .filter(
            (resident) => String(resident.sex || "").toLowerCase() === "female",
          )
          .map((resident) => resident.id);

        if (femaleResidentIds.length > 0) {
          const { data: pregnancyData, error: pregnanciesError } =
            await supabase
              .from("pregnant_women")
              .select("id, resident_id, status")
              .in("resident_id", femaleResidentIds)
              .order("created_at", { ascending: false });

          if (pregnanciesError) throw pregnanciesError;

          pregnancyRows = (pregnancyData || []).filter((pregnancy) => {
            const status = String(pregnancy.status || "active").toLowerCase();

            return !CLOSED_PREGNANCY_STATUSES.includes(status);
          });
        }

        // 5. Load scheduled pregnancy home-visit follow-ups.
        const pregnancyIds = [
          ...new Set(pregnancyRows.map((pregnancy) => pregnancy.id)),
        ];

        if (pregnancyIds.length > 0) {
          const { data: homeVisitData, error: homeVisitsError } = await supabase
            .from("pregnant_woman_home_visits")
            .select(
              `
              id,
              pregnant_woman_id,
              visit_number,
              visit_date,
              next_visit_date
            `,
            )
            .in("pregnant_woman_id", pregnancyIds)
            .not("next_visit_date", "is", null)
            .order("visit_date", { ascending: false });

          if (homeVisitsError) throw homeVisitsError;

          homeVisitRows = homeVisitData || [];
        }

        // 6. Identify the latest scheduled follow-up per pregnancy.
        const latestVisitByPregnancy = new Map();

        for (const visit of homeVisitRows) {
          if (!latestVisitByPregnancy.has(visit.pregnant_woman_id)) {
            latestVisitByPregnancy.set(visit.pregnant_woman_id, visit);
          }
        }

        const residentById = new Map(
          residentRows.map((resident) => [String(resident.id), resident]),
        );

        const allScheduledVisits = pregnancyRows
          .map((pregnancy) => {
            const latestVisit = latestVisitByPregnancy.get(pregnancy.id);

            const resident = residentById.get(String(pregnancy.resident_id));

            if (!latestVisit?.next_visit_date || !resident) {
              return null;
            }

            const nextVisitDate = String(latestVisit.next_visit_date).slice(
              0,
              10,
            );

            const household = getRelation(resident.households);
            const localArea = getRelation(household?.local_areas);
            const barangay = getRelation(localArea?.barangays);

            return {
              pregnancyId: pregnancy.id,
              residentId: resident.id,
              residentName: getResidentName(resident),
              householdCode: household?.household_code || "N/A",
              localAreaName: localArea?.name || "N/A",
              barangayName: barangay?.name || "N/A",
              visitDate: latestVisit.visit_date,
              nextVisitDate,
              daysOverdue: getDaysOverdue(nextVisitDate),
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.daysOverdue - a.daysOverdue);

        setScheduledHomeVisits(allScheduledVisits);
        setMissedHomeVisits(
          allScheduledVisits.filter((visit) => visit.nextVisitDate < today),
        );

        // 7. Missed ANC appointments (separate from missed BHW home visits).
        let ancRows = [];
        if (pregnancyIds.length > 0) {
          // Fetch in batches to avoid excessively large IN filters.
          for (let i = 0; i < pregnancyIds.length; i += 500) {
            const { data: visitsData, error: ancError } = await supabase
              .from("pregnant_woman_visits")
              .select(
                "id, pregnant_woman_id, visit_number, visit_date, next_visit_date",
              )
              .in("pregnant_woman_id", pregnancyIds.slice(i, i + 500))
              .order("visit_number", { ascending: false })
              .order("visit_date", { ascending: false });
            if (ancError) throw ancError;
            ancRows.push(...(visitsData || []));
          }
        }
        const latestAncByPregnancy = new Map();
        for (const visit of ancRows) {
          if (!latestAncByPregnancy.has(String(visit.pregnant_woman_id))) {
            latestAncByPregnancy.set(String(visit.pregnant_woman_id), visit);
          }
        }
        const overdueAnc = pregnancyRows
          .map((pregnancy) => {
            const anc = latestAncByPregnancy.get(String(pregnancy.id));
            const due = String(anc?.next_visit_date || "").slice(0, 10);
            const visitDate = String(anc?.visit_date || "").slice(0, 10);
            if (!due || due >= today || (visitDate && visitDate >= due))
              return null;
            const resident = residentById.get(String(pregnancy.resident_id));
            if (!resident) return null;
            const household = getRelation(resident.households);
            const area = getRelation(household?.local_areas);
            return {
              pregnancyId: pregnancy.id,
              ancVisitId: anc.id,
              residentName: getResidentName(resident),
              nextVisitDate: due,
              daysOverdue: getDaysOverdue(due),
              localAreaId: String(household?.local_area_id || ""),
              localAreaName: area?.name || "N/A",
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.daysOverdue - a.daysOverdue);
        setMissedAncVisits(overdueAnc);
        await loadSmsHistory(overdueAnc.map((v) => v.pregnancyId));

        // 8. Load this BHW's monthly reports.
        // The dashboard no longer queries health_records or submissions.
        const { data: reportsData, error: reportsError } = await supabase
          .from("bhw_monthly_reports")
          .select("*")
          .eq("bhw_id", currentUser.id)
          .order("submitted_at", { ascending: false })
          .limit(10);

        if (reportsError) {
          // Report errors should not prevent the rest of the dashboard
          // from displaying.
          console.warn(
            "Unable to load BHW monthly reports:",
            reportsError.message,
          );

          setRecentReports([]);
          setReportCount(0);
        } else {
          setRecentReports(reportsData || []);

          const { count, error: reportCountError } = await supabase
            .from("bhw_monthly_reports")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("bhw_id", currentUser.id);

          if (reportCountError) {
            console.warn(
              "Unable to count BHW monthly reports:",
              reportCountError.message,
            );

            setReportCount((reportsData || []).length);
          } else {
            setReportCount(count || 0);
          }
        }
      } catch (err) {
        console.error("Error loading BHW dashboard:", err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [today, loadSmsHistory],
  );

  // Restore the logged-in user from localStorage.
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      setError("Your session was not found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      if (!parsedUser?.id) {
        setError("Your saved user session is invalid. Please log in again.");
        setLoading(false);
        return;
      }

      setUser(parsedUser);
      loadDashboard(parsedUser);
    } catch {
      setError("Your saved user session is invalid. Please log in again.");
      setLoading(false);
    }
  }, [loadDashboard]);

  // Persist read notifications per BHW account and per scheduled visit.
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem(`mchms_bhw_notification_read_${user.id}`) || "[]",
      );
      setReadNotificationIds(Array.isArray(stored) ? stored : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [user?.id]);

  const saveReadNotifications = useCallback(
    (ids) => {
      setReadNotificationIds(ids);
      if (user?.id) {
        try {
          localStorage.setItem(
            `mchms_bhw_notification_read_${user.id}`,
            JSON.stringify(ids),
          );
        } catch (error) {
          console.warn("Unable to save notification read status:", error);
        }
      }
    },
    [user?.id],
  );

  const notifications = useMemo(() => {
    const day = new Date(`${getLocalDate()}T00:00:00`);
    const selected = scheduledHomeVisits.filter(
      (visit) =>
        selectedAreaId === "all" ||
        assignedAreas.some(
          (area) =>
            String(area.id) === selectedAreaId &&
            area.name === visit.localAreaName,
        ),
    );

    return selected
      .map((visit) => {
        const due = new Date(`${visit.nextVisitDate}T00:00:00`);
        const days = Math.round((due.getTime() - day.getTime()) / 86400000);
        if (!Number.isFinite(days) || days > 7) return null;
        const priority = days < 0 ? 0 : days === 0 ? 1 : 2;
        return {
          ...visit,
          id: `pregnancy-${visit.pregnancyId}-${visit.nextVisitDate}`,
          priority,
          title:
            days < 0
              ? "Overdue pregnancy follow-up"
              : days === 0
                ? "Pregnancy follow-up due today"
                : "Upcoming pregnancy follow-up",
          description:
            days < 0
              ? `${Math.abs(days)} day(s) overdue`
              : days === 0
                ? "Scheduled for today"
                : `Due in ${days} day(s)`,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          a.nextVisitDate.localeCompare(b.nextVisitDate),
      );
  }, [scheduledHomeVisits, selectedAreaId, assignedAreas]);

  const unreadNotifications = notifications.filter(
    (item) => !readNotificationIds.includes(item.id),
  ).length;

  const markNotificationRead = (id) => {
    if (!readNotificationIds.includes(id)) {
      saveReadNotifications([...readNotificationIds, id]);
    }
  };

  // Apply the area filter to household and resident statistics.
  const filteredHouseholds = useMemo(() => {
    if (selectedAreaId === "all") return households;

    return households.filter(
      (household) => String(household.local_area_id) === selectedAreaId,
    );
  }, [households, selectedAreaId]);

  const filteredHouseholdIds = useMemo(
    () => new Set(filteredHouseholds.map((household) => String(household.id))),
    [filteredHouseholds],
  );

  const filteredResidents = useMemo(() => {
    if (selectedAreaId === "all") return residents;

    return residents.filter((resident) =>
      filteredHouseholdIds.has(String(resident.household_id)),
    );
  }, [residents, selectedAreaId, filteredHouseholdIds]);

  // Prepare household and resident data for the chart.
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

      const barangay = getRelation(area.barangays);

      return {
        id: area.id,
        name: area.name || "Unnamed area",
        barangayName: barangay?.name || "Barangay not specified",
        households: areaHouseholds.length,
        residents: areaResidents.length,
      };
    });
  }, [assignedAreas, households, residents]);

  const selectedArea = useMemo(() => {
    if (selectedAreaId === "all") return null;

    return assignedAreas.find((area) => String(area.id) === selectedAreaId);
  }, [assignedAreas, selectedAreaId]);

  const activePregnancyCount = useMemo(
    () => missedHomeVisits.length + 0,
    [missedHomeVisits],
  );

  const statCards = [
    {
      label: "Assigned Areas",
      value: assignedAreas.length,
      icon: MapPin,
      description: "Active Purok/Sitio assignments",
      color: "blue",
    },
    {
      label: "Households",
      value: filteredHouseholds.length,
      icon: Home,
      description: "Households in selected area",
      color: "green",
      action: "/dashboard/bhw/households",
    },
    {
      label: "Residents",
      value: filteredResidents.length,
      icon: Users,
      description: "Residents in selected area",
      color: "purple",
      action: "/dashboard/bhw/households",
    },
    {
      label: "Monthly Reports",
      value: reportCount,
      icon: ClipboardCheck,
      description: "Reports recorded for your account",
      color: "orange",
      action: "/dashboard/bhw/monthly-report",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
    orange: "bg-amber-50 text-amber-600",
  };

  const quickActions = [
    {
      title: "Household Details",
      description:
        "View households and resident information in your assigned areas.",
      icon: Home,
      iconClass: "bg-blue-50 text-blue-600",
      path: "/dashboard/bhw/households",
    },
    {
      title: "Pregnancy Monitoring",
      description:
        "Record home visits and monitor scheduled pregnancy follow-ups.",
      icon: Activity,
      iconClass: "bg-pink-50 text-pink-600",
      path: "/dashboard/bhw/pregnant-monitoring",
    },
    {
      title: "Monthly Report",
      description: "Prepare, update, and submit your monthly BHW report.",
      icon: ClipboardCheck,
      iconClass: "bg-emerald-50 text-emerald-600",
      path: "/dashboard/bhw/monthly-report",
    },
  ];

  if (!user && !loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />

            <h2 className="text-xl font-bold text-gray-900">
              Session not found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {error || "Please log in again to access your dashboard."}
            </p>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Dashboard heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Barangay Health Worker
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Welcome
              {user?.first_name
                ? `, ${user.first_name}`
                : user?.full_name
                  ? `, ${user.full_name}`
                  : ""}
              ! <span aria-hidden="true">👋</span>
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Monitor your assigned community, pregnancy follow-ups, and monthly
              reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                type="button"
                aria-label={`Notifications, ${unreadNotifications} unread`}
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                {unreadNotifications > 0 ? (
                  <BellRing size={21} />
                ) : (
                  <Bell size={21} />
                )}
                {unreadNotifications > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[90] bg-black/30 lg:hidden"
                    aria-hidden="true"
                    onClick={() => setNotificationOpen(false)}
                  />
                  <div
                    role="region"
                    aria-label="Pregnancy notifications"
                    className="fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-[100] mx-auto flex max-h-[calc(100dvh-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-14 lg:mx-0 lg:w-[390px]"
                  >
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 p-4">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          Pregnancy Notifications
                        </h3>
                        <p className="text-xs text-gray-500">
                          {unreadNotifications} unread · Overdue, today and next
                          7 days
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationOpen(false)}
                        aria-label="Close notifications"
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    {notifications.length > 0 && (
                      <div className="flex shrink-0 justify-end border-b border-gray-100 px-4 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            saveReadNotifications([
                              ...new Set([
                                ...readNotificationIds,
                                ...notifications.map((n) => n.id),
                              ]),
                            ])
                          }
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Mark all as read
                        </button>
                      </div>
                    )}
                    <div className="min-h-0 max-h-96 overflow-y-auto overscroll-contain">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500">
                          No upcoming or overdue pregnancy follow-ups in this
                          area.
                        </div>
                      ) : (
                        notifications.map((notice) => {
                          const unread = !readNotificationIds.includes(
                            notice.id,
                          );
                          return (
                            <div
                              key={notice.id}
                              className={`border-b border-gray-100 p-4 last:border-b-0 ${unread ? "bg-blue-50/50" : "bg-white"}`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${unread ? "bg-blue-600" : "bg-gray-200"}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm font-semibold ${notice.priority === 0 ? "text-rose-700" : "text-gray-900"}`}
                                  >
                                    {notice.title}
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-gray-800">
                                    {notice.residentName}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {notice.localAreaName} ·{" "}
                                    {formatDate(notice.nextVisitDate)}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-600">
                                    {notice.description}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        markNotificationRead(notice.id);
                                        setNotificationOpen(false);
                                        navigate(
                                          "/dashboard/bhw/pregnant-monitoring",
                                        );
                                      }}
                                      className="text-xs font-semibold text-blue-700 hover:underline"
                                    >
                                      Open Monitoring
                                    </button>
                                    {unread && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          markNotificationRead(notice.id)
                                        }
                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                                      >
                                        <Check size={13} /> Mark read
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => user && loadDashboard(user, true)}
              disabled={loading || refreshing || !user}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading || refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-start"
          >
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-rose-600"
            />

            <div className="flex-1">
              <p className="font-semibold text-rose-800">
                Unable to load some dashboard data
              </p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => user && loadDashboard(user, true)}
              disabled={refreshing}
              className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Area filter */}
        <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Filter size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">Dashboard Filter</h2>
              <p className="mt-1 text-sm text-gray-500">
                Filter household and resident totals by assigned area.
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
              const barangay = getRelation(area.barangays);

              return (
                <option key={area.id} value={String(area.id)}>
                  {area.name}
                  {barangay?.name ? ` — ${barangay.name}` : ""}
                </option>
              );
            })}
          </select>
        </section>

        {selectedArea && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <MapPin size={20} className="mt-0.5 shrink-0 text-blue-600" />

            <div>
              <p className="font-semibold text-blue-900">{selectedArea.name}</p>

              <p className="mt-1 text-sm text-blue-700">
                {getRelation(selectedArea.barangays)?.name
                  ? `Barangay ${getRelation(selectedArea.barangays).name}`
                  : "Barangay not specified"}
                {selectedArea.type ? ` · ${selectedArea.type}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Statistics */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.label}
                type="button"
                onClick={() => card.action && navigate(card.action)}
                disabled={!card.action || loading}
                className={`group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition ${
                  card.action
                    ? "hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                    : "cursor-default"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {card.label}
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                      {loading ? (
                        <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-gray-100" />
                      ) : (
                        card.value.toLocaleString()
                      )}
                    </p>
                  </div>

                  <div className={`rounded-xl p-3 ${colorClasses[card.color]}`}>
                    <Icon size={22} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">{card.description}</p>

                  {card.action && (
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-blue-600 transition group-hover:translate-x-1"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </section>

        {/* Quick actions */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
              Quick Actions
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Quickly access your daily BHW tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

        {/* Community chart */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Community Overview
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Compare household and resident counts across your assigned
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
              <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
                <RefreshCw size={18} className="animate-spin" />
                Loading community statistics...
              </div>
            ) : areaChartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
                <MapPin size={32} className="text-gray-300" />

                <p className="mt-3 font-semibold text-gray-700">
                  No assigned areas found
                </p>

                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Your area statistics will appear here once an authorized
                  administrator or midwife assigns a Purok/Sitio to your
                  account.
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
                            {data?.barangayName}
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
                View the Purok/Sitio areas assigned to your account.
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
                Contact your administrator or authorized midwife to confirm your
                area assignment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {areaChartData.map((area) => {
                const originalArea = assignedAreas.find(
                  (item) => String(item.id) === String(area.id),
                );

                return (
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
                            {area.barangayName}
                          </p>

                          <p className="mt-1 text-xs capitalize text-gray-400">
                            {originalArea?.type || "Local area"}
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
                );
              })}
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

        {/* Missed / overdue pregnancy follow-ups */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                <CalendarClock size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Missed / Overdue Pregnancy Follow-ups
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Pregnant residents whose recorded follow-up date has passed.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                  missedHomeVisits.length > 0
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {loading ? "…" : missedHomeVisits.length} overdue
              </span>

              <button
                type="button"
                onClick={() => navigate("/dashboard/bhw/pregnant-monitoring")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Open Monitoring
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-gray-500">
              <RefreshCw size={18} className="animate-spin" />
              Loading pregnancy follow-ups...
            </div>
          ) : missedHomeVisits.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <div className="rounded-full bg-emerald-50 p-4 text-emerald-600">
                <Activity size={28} />
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">
                No overdue follow-ups found
              </h3>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                No recorded pregnancy follow-up dates earlier than today were
                found for pregnancies in your assigned areas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Pregnant Resident
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Household / Area
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Follow-up Date
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {missedHomeVisits.map((visit) => (
                    <tr
                      key={visit.pregnancyId}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {visit.residentName}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Last home visit: {formatDate(visit.visitDate)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-800">
                          Household: {visit.householdCode}
                        </p>

                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={12} />
                          {visit.localAreaName}, {visit.barangayName}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(visit.nextVisitDate)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <AlertTriangle size={13} />
                          {visit.daysOverdue}{" "}
                          {visit.daysOverdue === 1 ? "day" : "days"} overdue
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate("/dashboard/bhw/pregnant-monitoring")
                          }
                          className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Missed ANC appointments and SMS reminders */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-pink-50 p-2.5 text-pink-600">
                <MessageSquare size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Missed ANC Check-ups
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Check reminder status for pregnant residents in your assigned
                  areas.
                </p>
              </div>
            </div>
          </div>
          {smsSuccess && (
            <div
              role="status"
              className="m-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              <span>
                <CheckCircle2 size={16} className="mr-2 inline" />
                {smsSuccess}
              </span>
              <button
                type="button"
                aria-label="Dismiss SMS success"
                onClick={() => setSmsSuccess("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {smsError && (
            <div
              role="alert"
              className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              {smsError}
            </div>
          )}
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              Loading ANC appointments...
            </p>
          ) : missedAncVisits.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              No missed ANC appointments found in your assigned areas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Pregnant Resident</th>
                    <th className="px-5 py-3">Missed ANC Date</th>
                    <th className="px-5 py-3">SMS Reminder</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {missedAncVisits
                    .filter(
                      (v) =>
                        selectedAreaId === "all" ||
                        v.localAreaId === selectedAreaId,
                    )
                    .map((visit) => {
                      const log = smsLogFor(visit);
                      const sent = log?.status === "sent";
                      return (
                        <tr key={visit.pregnancyId}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-gray-900">
                              {visit.residentName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {visit.localAreaName}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {formatDate(visit.nextVisitDate)}
                            <p className="text-xs text-rose-600">
                              {visit.daysOverdue} days overdue
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {smsLoading ? (
                              <span className="text-gray-500">Checking...</span>
                            ) : smsError ? (
                              <span className="text-amber-700">
                                Status unavailable
                              </span>
                            ) : sent ? (
                              <span className="font-semibold text-emerald-700">
                                SMS sent
                              </span>
                            ) : log ? (
                              <span className="text-amber-700">
                                {log.status === "failed"
                                  ? "Previous attempt failed"
                                  : "Reminder recorded"}
                              </span>
                            ) : (
                              <span className="text-gray-500">Not sent</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!smsLoading && !smsError && !log && (
                              <button
                                type="button"
                                onClick={() => setSmsTarget(visit)}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
                              >
                                <Send size={14} /> Send SMS
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {smsTarget && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm SMS reminder"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">
                Send ANC SMS Reminder?
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Send a reminder for <strong>{smsTarget.residentName}</strong>{" "}
                regarding the missed ANC appointment on{" "}
                <strong>{formatDate(smsTarget.nextVisitDate)}</strong>?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                The SMS will be sent to the mobile number saved in the
                resident's record.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={smsSending}
                  onClick={() => setSmsTarget(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={smsSending}
                  onClick={sendManualSms}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {smsSending ? "Sending..." : "Confirm Send"}
                </button>
              </div>
            </div>
          </div>
        )}

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
              onClick={() => navigate("/dashboard/bhw/monthly-report")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <ClipboardCheck size={17} />
              Open Monthly Report
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading monthly reports...
            </div>
          ) : recentReports.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <FileText size={30} className="mx-auto text-gray-300" />

              <p className="mt-3 font-semibold text-gray-700">
                No monthly reports to display
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Open Monthly Report to prepare or submit a report.
              </p>

              <button
                type="button"
                onClick={() => navigate("/dashboard/bhw/monthly-report")}
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
                      Submitted
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentReports.map((report, index) => {
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
                                Monthly BHW report
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
                              navigate("/dashboard/bhw/monthly-report")
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

        {/* Dashboard note */}
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Activity size={19} className="mt-0.5 shrink-0 text-gray-500" />

          <p className="text-sm leading-6 text-gray-600">
            Household and resident totals are based on your active area
            assignments. Overdue pregnancy follow-ups are identified using
            recorded next-visit dates. Monthly report totals are based on the
            reports stored under your BHW account.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
