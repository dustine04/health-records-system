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
  AlertTriangle,
  TrendingUp,
  Filter,
  Syringe,
  Scale,
  CalendarCheck,
  Search,
  Bell,
  BellRing,
  MessageSquare,
  Send,
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

import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

const MONITORING_PATH = "/dashboard/bns/child-monitoring";

function relation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function getToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateNumber(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(date.getTime() / 86400000);
}

function getVisitStatus(dateValue) {
  const visit = dateNumber(dateValue);
  const today = dateNumber(getToday());

  if (visit === null || today === null) {
    return {
      key: "not_scheduled",
      label: "Not Scheduled",
      days: null,
    };
  }

  const days = visit - today;

  if (days < 0) {
    return {
      key: "missed",
      label: "Missed / Overdue",
      days,
    };
  }

  if (days === 0) {
    return {
      key: "due_today",
      label: "Due Today",
      days,
    };
  }

  if (days <= 7) {
    return {
      key: "upcoming",
      label: "Upcoming",
      days,
    };
  }

  return {
    key: "scheduled",
    label: "Scheduled",
    days,
  };
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  const parts = String(value).split("-");

  if (parts.length !== 3) return String(value);

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
  );

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getChildName(record) {
  const resident = relation(record?.residents);

  if (record?.child_name) return record.child_name;

  const fullName = [
    resident?.first_name,
    resident?.middle_name,
    resident?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || `Child #${record?.id || "Unknown"}`;
}

function getReportStatus(report) {
  const status = String(report?.status || "draft").toLowerCase();

  if (["approved", "accepted", "reviewed"].includes(status)) {
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
}

function getReportPeriod(report) {
  const month = report?.month ?? report?.report_month;
  const year = report?.year ?? report?.report_year;

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
}

function getReportDate(report) {
  const value =
    report?.submitted_at || report?.created_at || report?.updated_at;

  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_CLASSES = {
  missed: "bg-rose-100 text-rose-700",
  due_today: "bg-amber-100 text-amber-800",
  upcoming: "bg-blue-100 text-blue-700",
  scheduled: "bg-emerald-100 text-emerald-700",
  not_scheduled: "bg-gray-100 text-gray-600",
};

const CARD_COLORS = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  violet: "bg-violet-100 text-violet-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
  cyan: "bg-cyan-100 text-cyan-600",
  teal: "bg-teal-100 text-teal-600",
};

/* =========================================================
   DASHBOARD
========================================================= */

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
  const [scheduleError, setScheduleError] = useState("");

  const [assignedAreas, setAssignedAreas] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [children, setChildren] = useState([]);
  const [monthlyReports, setMonthlyReports] = useState([]);

  const [growthRecords, setGrowthRecords] = useState([]);
  const [immunizationRecords, setImmunizationRecords] = useState([]);
  const [childSms, setChildSms] = useState({});
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [smsNotice, setSmsNotice] = useState("");
  const [smsTarget, setSmsTarget] = useState(null);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [smsSending, setSmsSending] = useState(false);

  const [selectedAreaId, setSelectedAreaId] = useState("all");
  const [appointmentFilter, setAppointmentFilter] = useState("all");
  const [appointmentSearch, setAppointmentSearch] = useState("");

  const [reportCount, setReportCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const stored = localStorage.getItem(
        `mchms_bns_read_notifications_${user?.id}`,
      );
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(
      `mchms_bns_read_notifications_${user.id}`,
      JSON.stringify(readNotificationIds),
    );
  }, [readNotificationIds, user?.id]);

  /* =======================================================
     LOAD DATA
  ======================================================= */

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
      setScheduleError("");

      try {
        // 1. Load active assigned areas.
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
          const area = relation(assignment.local_areas);

          if (area?.id) {
            areaMap.set(String(area.id), area);
          }
        });

        const areas = Array.from(areaMap.values());

        setAssignedAreas(areas);

        const areaIds = areas.map((area) => area.id);

        // 2. Load households.
        let householdRows = [];

        if (areaIds.length > 0) {
          const { data, error } = await supabase
            .from("households")
            .select("id, local_area_id")
            .in("local_area_id", areaIds);

          if (error) throw error;

          householdRows = data || [];
        }

        setHouseholds(householdRows);

        // 3. Load residents.
        const householdIds = householdRows.map((item) => item.id);

        let residentRows = [];

        if (householdIds.length > 0) {
          const { data, error } = await supabase
            .from("residents")
            .select("id, household_id")
            .in("household_id", householdIds);

          if (error) throw error;

          residentRows = data || [];
        }

        setResidents(residentRows);

        // 4. Load children registered in assigned areas.
        const residentIds = residentRows.map((item) => item.id);

        let childRows = [];

        if (residentIds.length > 0) {
          const { data, error } = await supabase
            .from("child_health_records")
            .select("id, resident_id, child_name")
            .in("resident_id", residentIds);

          if (error) throw error;

          childRows = data || [];
        }

        setChildren(childRows);

        // 5. Load scheduled monitoring and immunization.
        const childIds = childRows.map((item) => item.id);

        let growthRows = [];
        let vaccineRows = [];

        if (childIds.length > 0) {
          const [growthResult, vaccineResult] = await Promise.all([
            supabase
              .from("child_monitoring")
              .select(
                "id, child_health_record_id, monitoring_date, next_visit_date",
              )
              .in("child_health_record_id", childIds)
              .order("monitoring_date", { ascending: false }),

            supabase
              .from("child_immunization")
              .select(
                "id, child_health_record_id, vaccination_date, vaccine_name, dose, next_visit_date, next_vaccine_name",
              )
              .in("child_health_record_id", childIds)
              .order("vaccination_date", { ascending: false }),
          ]);

          if (growthResult.error || vaccineResult.error) {
            const message =
              growthResult.error?.message ||
              vaccineResult.error?.message ||
              "Unable to load appointment records.";

            console.warn("BNS scheduling:", message);

            setScheduleError(message);
          } else {
            growthRows = growthResult.data || [];
            vaccineRows = vaccineResult.data || [];
          }
        }

        setGrowthRecords(growthRows);
        setImmunizationRecords(vaccineRows);

        // 6. Load monthly reports.
        const { data: reportData, error: reportsError } = await supabase
          .from("bns_child_monthly_reports")
          .select("*")
          .eq("bns_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (reportsError) {
          console.warn(
            "Unable to load BNS monthly reports:",
            reportsError.message,
          );

          setMonthlyReports([]);
          setReportCount(0);
        } else {
          setMonthlyReports(reportData || []);

          const { count, error: countError } = await supabase
            .from("bns_child_monthly_reports")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("bns_id", user.id);

          setReportCount(countError ? (reportData || []).length : count || 0);
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

  /* =======================================================
     AREA FILTERING
  ======================================================= */

  const filteredHouseholds = useMemo(() => {
    if (selectedAreaId === "all") return households;

    return households.filter(
      (item) => String(item.local_area_id) === selectedAreaId,
    );
  }, [households, selectedAreaId]);

  const filteredHouseholdIds = useMemo(
    () => new Set(filteredHouseholds.map((item) => String(item.id))),
    [filteredHouseholds],
  );

  const filteredResidents = useMemo(() => {
    if (selectedAreaId === "all") return residents;

    return residents.filter((item) =>
      filteredHouseholdIds.has(String(item.household_id)),
    );
  }, [residents, selectedAreaId, filteredHouseholdIds]);

  const filteredResidentIds = useMemo(
    () => new Set(filteredResidents.map((item) => String(item.id))),
    [filteredResidents],
  );

  const filteredChildren = useMemo(() => {
    return children.filter((child) =>
      filteredResidentIds.has(String(child.resident_id)),
    );
  }, [children, filteredResidentIds]);

  /* =======================================================
     APPOINTMENT CALCULATIONS

     Use the latest recorded entry for each child and service.
     This avoids counting multiple old appointments.
  ======================================================= */

  const appointments = useMemo(() => {
    const childMap = new Map(
      filteredChildren.map((child) => [String(child.id), child]),
    );

    const residentMap = new Map(
      residents.map((resident) => [String(resident.id), resident]),
    );

    const householdMap = new Map(
      households.map((household) => [String(household.id), household]),
    );

    const areaMap = new Map(
      assignedAreas.map((area) => [String(area.id), area]),
    );

    function getChildInfo(childId) {
      const child = childMap.get(String(childId));

      if (!child) return null;

      const resident = residentMap.get(String(child.resident_id));
      const household = resident
        ? householdMap.get(String(resident.household_id))
        : null;
      const area = household
        ? areaMap.get(String(household.local_area_id))
        : null;

      return {
        childId: child.id,
        childName: getChildName(child),
        areaName: area?.name || "Unknown area",
        areaId: area?.id || null,
      };
    }

    function latestByChild(rows, dateField) {
      const latest = new Map();

      const sorted = [...rows].sort((a, b) => {
        const dateCompare = String(b[dateField] || "").localeCompare(
          String(a[dateField] || ""),
        );

        if (dateCompare !== 0) return dateCompare;

        return Number(b.id || 0) - Number(a.id || 0);
      });

      for (const record of sorted) {
        const id = String(record.child_health_record_id);

        if (!latest.has(id)) {
          latest.set(id, record);
        }
      }

      return Array.from(latest.values());
    }

    const result = [];

    // Growth monitoring appointments.
    const latestGrowth = latestByChild(growthRecords, "monitoring_date");

    for (const record of latestGrowth) {
      if (!record.next_visit_date) continue;

      const child = getChildInfo(record.child_health_record_id);

      if (!child) continue;

      const status = getVisitStatus(record.next_visit_date);

      result.push({
        id: `growth-${record.id}`,
        sourceRecordId: record.id,
        ...child,
        type: "growth",
        typeLabel: "Growth Check-up",
        nextVisitDate: record.next_visit_date,
        plannedVaccine: null,
        status: status.key,
        statusLabel: status.label,
        daysDifference: status.days,
      });
    }

    // Immunization appointments.
    const latestImmunization = latestByChild(
      immunizationRecords,
      "vaccination_date",
    );

    for (const record of latestImmunization) {
      if (!record.next_visit_date) continue;

      const child = getChildInfo(record.child_health_record_id);

      if (!child) continue;

      const status = getVisitStatus(record.next_visit_date);

      result.push({
        id: `immunization-${record.id}`,
        sourceRecordId: record.id,
        ...child,
        type: "immunization",
        typeLabel: "Immunization",
        nextVisitDate: record.next_visit_date,
        plannedVaccine: record.next_vaccine_name || null,
        status: status.key,
        statusLabel: status.label,
        daysDifference: status.days,
      });
    }

    return result.sort((a, b) =>
      String(a.nextVisitDate).localeCompare(String(b.nextVisitDate)),
    );
  }, [
    filteredChildren,
    residents,
    households,
    assignedAreas,
    growthRecords,
    immunizationRecords,
  ]);

  const appointmentStats = useMemo(() => {
    const missedImmunizations = appointments.filter(
      (item) => item.type === "immunization" && item.status === "missed",
    ).length;

    const missedGrowth = appointments.filter(
      (item) => item.type === "growth" && item.status === "missed",
    ).length;

    const dueToday = appointments.filter(
      (item) => item.status === "due_today",
    ).length;

    const upcoming = appointments.filter(
      (item) => item.status === "upcoming",
    ).length;

    const scheduled = appointments.filter(
      (item) => item.status === "scheduled",
    ).length;

    return {
      missedImmunizations,
      missedGrowth,
      dueToday,
      upcoming,
      scheduled,
      totalMissed: missedImmunizations + missedGrowth,
    };
  }, [appointments]);

  // Notification IDs include the schedule and status, so a changed
  // appointment or a newly overdue appointment becomes unread again.
  const notifications = useMemo(() => {
    const priority = { missed: 0, due_today: 1, upcoming: 2 };
    return appointments
      .filter((item) =>
        ["missed", "due_today", "upcoming"].includes(item.status),
      )
      .map((item) => ({
        ...item,
        notificationId: `${item.id}:${item.nextVisitDate}:${item.status}`,
        title:
          item.status === "missed"
            ? "Overdue appointment"
            : item.status === "due_today"
              ? "Appointment due today"
              : "Upcoming appointment",
      }))
      .sort(
        (a, b) =>
          priority[a.status] - priority[b.status] ||
          a.nextVisitDate.localeCompare(b.nextVisitDate),
      );
  }, [appointments]);

  const unreadCount = useMemo(() => {
    const readSet = new Set(readNotificationIds);
    return notifications.filter((item) => !readSet.has(item.notificationId))
      .length;
  }, [notifications, readNotificationIds]);

  const markNotificationRead = (id) => {
    setReadNotificationIds((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((previous) => [
      ...new Set([
        ...previous,
        ...notifications.map((item) => item.notificationId),
      ]),
    ]);
  };

  const filteredAppointments = useMemo(() => {
    const search = appointmentSearch.trim().toLowerCase();

    return appointments.filter((item) => {
      if (appointmentFilter === "missed" && item.status !== "missed") {
        return false;
      }

      if (appointmentFilter === "due_today" && item.status !== "due_today") {
        return false;
      }

      if (appointmentFilter === "upcoming" && item.status !== "upcoming") {
        return false;
      }

      if (
        appointmentFilter === "immunization" &&
        item.type !== "immunization"
      ) {
        return false;
      }

      if (appointmentFilter === "growth" && item.type !== "growth") {
        return false;
      }

      if (!search) return true;

      return [
        item.childName,
        item.areaName,
        item.typeLabel,
        item.plannedVaccine,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [appointments, appointmentFilter, appointmentSearch]);

  // SMS history and sending are authorized by the Edge Function, not by this UI.
  // Only server-synchronized, overdue appointments can be sent reminders.
  const smsStatus = (appointment) => {
    const state = childSms[String(appointment.childId)];
    if (!state || state.error) return "unavailable";
    const log = (state.logs || []).find(
      (entry) =>
        entry.reminder_type === appointment.type &&
        String(entry.source_record_id) === String(appointment.sourceRecordId) &&
        entry.scheduled_date === appointment.nextVisitDate,
    );
    return log?.status || "not_sent";
  };

  const loadChildSms = useCallback(async (childIds) => {
    if (!navigator.onLine || !childIds.length) {
      if (!navigator.onLine)
        setSmsError("SMS status requires an internet connection.");
      return;
    }
    const token = sessionStorage.getItem("mchms_session_token");
    if (!token) {
      setSmsError("SMS session unavailable. Please sign in again.");
      return;
    }
    setSmsLoading(true);
    setSmsError("");
    const results = {};
    try {
      // Limit concurrent requests to avoid flooding the Edge Function.
      for (let i = 0; i < childIds.length; i += 5) {
        const batch = childIds.slice(i, i + 5);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const { data, error } = await supabase.functions.invoke(
                "mchms-child-sms",
                {
                  headers: { "x-mchms-session": token },
                  body: { action: "history", child_health_record_id: id },
                },
              );
              if (error || !data?.success)
                throw new Error(
                  data?.error || error?.message || "History unavailable",
                );
              results[String(id)] = {
                logs: data.logs || [],
                hasMobile: data.has_household_mobile === true,
              };
            } catch (error) {
              console.warn("Child SMS history:", error);
              results[String(id)] = { error: true, logs: [] };
            }
          }),
        );
      }
      setChildSms((previous) => ({ ...previous, ...results }));
      if (Object.values(results).some((value) => value.error)) {
        setSmsError(
          "Some SMS statuses could not be loaded. Refresh to try again.",
        );
      }
    } finally {
      setSmsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !scheduleError && appointments.length) {
      const ids = [
        ...new Set(
          appointments
            .filter((a) => a.status === "missed")
            .map((a) => a.childId),
        ),
      ];
      void loadChildSms(ids);
    }
  }, [loading, scheduleError, appointments, loadChildSms]);

  async function sendChildSms() {
    if (!smsTarget || !guardianConfirmed || smsSending || !navigator.onLine)
      return;
    const token = sessionStorage.getItem("mchms_session_token");
    if (!token) {
      setSmsError("SMS session unavailable. Please sign in again.");
      return;
    }
    setSmsSending(true);
    setSmsError("");
    setSmsNotice("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "mchms-child-sms",
        {
          headers: { "x-mchms-session": token },
          body: {
            action: "send",
            child_health_record_id: smsTarget.childId,
            reminder_type: smsTarget.type,
            source_record_id: smsTarget.sourceRecordId,
            guardian_confirmed: true,
          },
        },
      );
      if (error || !data?.success) {
        let detail = data?.error || error?.message || "Unable to send SMS";
        if (error?.context && typeof error.context.json === "function") {
          const payload = await error.context.json().catch(() => null);
          if (payload?.error) detail = payload.error;
        }
        throw new Error(detail);
      }
      setSmsNotice(
        `Semaphore accepted the ${smsTarget.typeLabel.toLowerCase()} SMS request. Delivery is not confirmed.`,
      );
      const childId = smsTarget.childId;
      setSmsTarget(null);
      setGuardianConfirmed(false);
      await loadChildSms([childId]);
    } catch (error) {
      const failureMessage =
        error.message ||
        "Unable to send SMS. Check the history before retrying.";
      await loadChildSms([smsTarget.childId]);
      setSmsError(failureMessage);
    } finally {
      setSmsSending(false);
    }
  }

  /* =======================================================
     COMMUNITY CHART
  ======================================================= */

  const areaChartData = useMemo(() => {
    return assignedAreas.map((area) => {
      const areaHouseholds = households.filter(
        (item) => String(item.local_area_id) === String(area.id),
      );

      const householdIds = new Set(
        areaHouseholds.map((item) => String(item.id)),
      );

      const areaResidents = residents.filter((item) =>
        householdIds.has(String(item.household_id)),
      );

      const barangay = relation(area.barangays);

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

  /* =======================================================
     DASHBOARD CARDS
  ======================================================= */

  const communityStats = [
    {
      label: "Assigned Areas",
      value: assignedAreas.length,
      description: "Active Purok/Sitio assignments",
      icon: MapPin,
      color: "blue",
    },
    {
      label: "Households",
      value: filteredHouseholds.length,
      description: "Households in selected area",
      icon: Home,
      color: "emerald",
      path: "/dashboard/bns/households",
    },
    {
      label: "Residents",
      value: filteredResidents.length,
      description: "Residents in selected area",
      icon: Users,
      color: "violet",
      path: "/dashboard/bns/households",
    },
    {
      label: "Registered Children",
      value: filteredChildren.length,
      description: "Children in selected area",
      icon: Baby,
      color: "cyan",
      path: "/dashboard/bns/child-registration",
    },
    {
      label: "Monthly Reports",
      value: reportCount,
      description: "Reports recorded for your account",
      icon: FileText,
      color: "amber",
      path: "/dashboard/bns/monthly-report",
    },
  ];

  const schedulingCards = [
    {
      label: "Missed Immunizations",
      value: appointmentStats.missedImmunizations,
      description: "Overdue immunization appointments",
      icon: Syringe,
      color: "rose",
      filter: "missed",
    },
    {
      label: "Missed Growth Check-ups",
      value: appointmentStats.missedGrowth,
      description: "Overdue growth monitoring visits",
      icon: Scale,
      color: "amber",
      filter: "missed",
    },
    {
      label: "Due Today",
      value: appointmentStats.dueToday,
      description: "Appointments scheduled for today",
      icon: CalendarCheck,
      color: "teal",
      filter: "due_today",
    },
    {
      label: "Upcoming Visits",
      value: appointmentStats.upcoming,
      description: "Appointments within the next 7 days",
      icon: CalendarDays,
      color: "blue",
      filter: "upcoming",
    },
  ];

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
      title: "Child Registration",
      description: "Register and manage child health records.",
      icon: Plus,
      iconClass: "bg-violet-100 text-violet-600",
      path: "/dashboard/bns/child-registration",
    },
    {
      title: "Child Monitoring",
      description:
        "Record growth, immunization, nutrition, and next appointments.",
      icon: Baby,
      iconClass: "bg-pink-100 text-pink-600",
      path: MONITORING_PATH,
    },
    {
      title: "Monthly Report",
      description: "Prepare, review, and submit monthly child health reports.",
      icon: ClipboardList,
      iconClass: "bg-emerald-100 text-emerald-600",
      path: "/dashboard/bns/monthly-report",
    },
  ];

  /* =======================================================
     REUSABLE STAT CARD
  ======================================================= */

  const renderStatCard = (stat, index) => {
    const Icon = stat.icon;

    const content = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? (
                <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-gray-100" />
              ) : (
                Number(stat.value || 0).toLocaleString()
              )}
            </p>
          </div>

          <div
            className={`rounded-xl p-3 ${
              CARD_COLORS[stat.color] || CARD_COLORS.blue
            }`}
          >
            <Icon size={22} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{stat.description}</p>

          {stat.path && (
            <ArrowRight
              size={16}
              className="text-gray-400 transition group-hover:translate-x-1"
            />
          )}
        </div>
      </>
    );

    return (
      <button
        key={`${stat.label}-${index}`}
        type="button"
        disabled={loading || (!stat.path && !stat.filter)}
        onClick={() => {
          if (stat.path) {
            navigate(stat.path);
          } else if (stat.filter) {
            setAppointmentFilter(stat.filter);

            document.getElementById("bns-appointments")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }}
        className={`group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition ${
          stat.path || stat.filter
            ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            : "cursor-default"
        }`}
      >
        {content}
      </button>
    );
  };

  /* =======================================================
     SESSION CHECK
  ======================================================= */

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />

          <h2 className="text-xl font-bold text-gray-800">Session not found</h2>

          <p className="mt-2 text-sm text-gray-500">
            Please log in again to access your BNS dashboard.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* WELCOME HEADER */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-green-600">
              Barangay Nutrition Scholar
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Welcome, {user.first_name || user.username || "BNS"}!
              <span className="ml-2" aria-hidden="true">
                👋
              </span>
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Monitor your assigned communities, child health appointments, and
              monthly reports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                aria-label={`Notifications, ${unreadCount} unread`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((value) => !value)}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="fixed left-4 right-4 top-24 z-50 max-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-[min(90vw,420px)] sm:max-h-none">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          Notifications
                        </h3>
                        <p className="text-xs text-gray-500">
                          {unreadCount} unread · {notifications.length} active
                          alerts
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        aria-label="Close notifications"
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex items-center justify-end border-b border-gray-100 px-4 py-2">
                      <button
                        type="button"
                        disabled={unreadCount === 0}
                        onClick={markAllNotificationsRead}
                        className="text-xs font-semibold text-green-700 hover:underline disabled:cursor-default disabled:opacity-40"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-[min(65vh,420px)] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                          <CheckCircle2
                            className="mx-auto text-emerald-500"
                            size={28}
                          />
                          <p className="mt-2 font-semibold text-gray-800">
                            No appointment alerts
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            New alerts will appear for overdue, due today, or
                            upcoming visits.
                          </p>
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const unread = !readNotificationIds.includes(
                            item.notificationId,
                          );
                          return (
                            <button
                              type="button"
                              key={item.notificationId}
                              onClick={() => {
                                markNotificationRead(item.notificationId);
                                setNotificationsOpen(false);
                                navigate(MONITORING_PATH);
                              }}
                              className={`flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${unread ? "bg-green-50/40" : "bg-white"}`}
                            >
                              <span
                                className={`mt-1 shrink-0 rounded-lg p-2 ${item.status === "missed" ? "bg-rose-100 text-rose-700" : item.status === "due_today" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
                              >
                                {item.type === "immunization" ? (
                                  <Syringe size={17} />
                                ) : (
                                  <Scale size={17} />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {item.title}
                                  </span>
                                  {unread && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-green-600" />
                                  )}
                                </span>
                                <span className="mt-0.5 block text-sm text-gray-700">
                                  {item.childName}
                                </span>
                                <span className="mt-1 block text-xs text-gray-500">
                                  {item.typeLabel}
                                  {item.plannedVaccine
                                    ? ` · ${item.plannedVaccine}`
                                    : ""}{" "}
                                  · {formatDate(item.nextVisitDate)}
                                </span>
                                <span className="mt-1 block text-xs text-gray-500">
                                  {item.areaName}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        document
                          .getElementById("bns-appointments")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                      className="w-full border-t border-gray-100 px-4 py-3 text-center text-sm font-semibold text-green-700 hover:bg-gray-50"
                    >
                      View appointment schedule
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={loading || refreshing}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loading || refreshing ? "animate-spin" : ""}
              />

              {refreshing ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </div>
        </div>

        {/* ERRORS */}

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 text-rose-600" />

              <div>
                <p className="font-semibold text-rose-800">
                  Unable to load dashboard data
                </p>

                <p className="mt-1 text-sm text-rose-700">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {scheduleError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="shrink-0 text-amber-600" />

              <div>
                <p className="font-semibold text-amber-900">
                  Scheduling records could not be loaded
                </p>

                <p className="mt-1 text-sm text-amber-800">{scheduleError}</p>

                <p className="mt-2 text-xs text-amber-700">
                  Check that the new scheduling columns exist in Supabase and
                  that your account can read them.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AREA FILTER */}

        <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-2.5 text-green-600">
              <Filter size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">Dashboard Filter</h2>

              <p className="text-sm text-gray-500">
                Filter community totals and child appointments by area.
              </p>
            </div>
          </div>

          <select
            value={selectedAreaId}
            onChange={(event) => setSelectedAreaId(event.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 sm:max-w-xs"
          >
            <option value="all">All Assigned Areas</option>

            {assignedAreas.map((area) => {
              const barangay = relation(area.barangays);

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
          <div className="flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 p-4">
            <MapPin size={20} className="mt-0.5 shrink-0 text-green-600" />

            <div>
              <p className="font-semibold text-green-900">
                {selectedArea.name}
              </p>

              <p className="mt-1 text-sm text-green-700">
                {relation(selectedArea.barangays)?.name
                  ? `Barangay ${relation(selectedArea.barangays).name}`
                  : "Barangay not specified"}

                {selectedArea.type ? ` · ${selectedArea.type}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* COMMUNITY STATISTICS */}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
              Community Statistics
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Overview of your assigned areas and registered records.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {communityStats.map(renderStatCard)}
          </div>
        </section>

        {/* APPOINTMENT STATISTICS */}

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                Child Health Appointments
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Monitor immunization and growth check-up schedules.
              </p>
            </div>

            <span className="w-fit rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              {appointments.length} scheduled records
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {schedulingCards.map(renderStatCard)}
          </div>

          {appointmentStats.totalMissed > 0 && !loading && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <AlertTriangle
                size={21}
                className="mt-0.5 shrink-0 text-rose-600"
              />

              <div className="flex-1">
                <p className="font-semibold text-rose-800">
                  Appointments requiring follow-up
                </p>

                <p className="mt-1 text-sm text-rose-700">
                  There are {appointmentStats.totalMissed} overdue appointment
                  records in the selected area. Review whether these visits were
                  completed, rescheduled, or still need follow-up.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* APPOINTMENT TABLE */}

        <section
          id="bns-appointments"
          className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Immunization & Growth Visit Schedule
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Latest scheduled visit for each child and service.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(MONITORING_PATH)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <Plus size={17} />
              Manage Child Monitoring
            </button>
          </div>

          {/* TABLE FILTERS */}

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={appointmentSearch}
                onChange={(event) => setAppointmentSearch(event.target.value)}
                placeholder="Search child, area, or vaccine..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <select
              value={appointmentFilter}
              onChange={(event) => setAppointmentFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-green-500 md:w-56"
            >
              <option value="all">All Appointments</option>
              <option value="missed">Missed / Overdue</option>
              <option value="due_today">Due Today</option>
              <option value="upcoming">Upcoming (7 Days)</option>
              <option value="immunization">Immunization Only</option>
              <option value="growth">Growth Check-ups Only</option>
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              <RefreshCw size={22} className="mx-auto mb-3 animate-spin" />
              Loading child appointments...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
              <CalendarDays size={32} className="mx-auto text-gray-300" />

              <p className="mt-3 font-semibold text-gray-700">
                No matching appointments found
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Schedule the next visit from Child Monitoring, or change your
                search and filters.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Child
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Visit Type
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Next Visit
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      SMS Reminder
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAppointments.map((appointment) => {
                    const isImmunization = appointment.type === "immunization";

                    return (
                      <tr
                        key={appointment.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">
                            {appointment.childName}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {appointment.areaName}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`rounded-lg p-2 ${
                                isImmunization
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              {isImmunization ? (
                                <Syringe size={17} />
                              ) : (
                                <Scale size={17} />
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {appointment.typeLabel}
                              </p>

                              {appointment.plannedVaccine && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {appointment.plannedVaccine}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-800">
                            {formatDate(appointment.nextVisitDate)}
                          </p>

                          {appointment.daysDifference < 0 && (
                            <p className="mt-1 text-xs text-rose-600">
                              {Math.abs(appointment.daysDifference)} day(s)
                              overdue
                            </p>
                          )}

                          {appointment.daysDifference > 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                              In {appointment.daysDifference} day(s)
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              STATUS_CLASSES[appointment.status]
                            }`}
                          >
                            {appointment.statusLabel}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {appointment.status !== "missed" ? (
                            <span className="text-xs text-gray-500">
                              Not applicable
                            </span>
                          ) : (
                            <div className="flex flex-col items-start gap-2">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                  smsStatus(appointment) === "sent"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : smsStatus(appointment) === "not_sent"
                                      ? "bg-amber-100 text-amber-800"
                                      : smsStatus(appointment) === "failed"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {smsLoading &&
                                !childSms[String(appointment.childId)]
                                  ? "Loading..."
                                  : {
                                      sent: "SMS sent",
                                      not_sent: "Not sent",
                                      pending: "Pending",
                                      failed: "SMS failed",
                                      unavailable: "Unavailable",
                                    }[smsStatus(appointment)] || "Unavailable"}
                              </span>
                              {smsStatus(appointment) === "not_sent" && (
                                <button
                                  type="button"
                                  disabled={
                                    !navigator.onLine ||
                                    smsLoading ||
                                    !childSms[String(appointment.childId)]
                                      ?.hasMobile
                                  }
                                  onClick={() => {
                                    setSmsTarget(appointment);
                                    setGuardianConfirmed(false);
                                    setSmsError("");
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Send size={13} /> Send SMS
                                </button>
                              )}
                              {smsStatus(appointment) === "not_sent" &&
                                !childSms[String(appointment.childId)]
                                  ?.hasMobile && (
                                  <span className="text-xs text-rose-600">
                                    Valid household mobile required
                                  </span>
                                )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(MONITORING_PATH)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 hover:text-green-800"
                          >
                            Open Monitoring
                            <ArrowRight size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {smsError && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
            >
              {smsError}
            </p>
          )}
          {smsNotice && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              {smsNotice}
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-gray-500">
            Appointment status is calculated from the latest saved monitoring or
            immunization record. An overdue date indicates a follow-up is
            needed; it does not confirm that a vaccine was missed.
            Unsynchronized offline changes are not included until uploaded to
            Supabase.
          </p>
        </section>

        {smsTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="child-sms-confirm"
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    id="child-sms-confirm"
                    className="text-lg font-bold text-gray-900"
                  >
                    Confirm Child SMS Reminder
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {smsTarget.childName} · {smsTarget.typeLabel} ·{" "}
                    {formatDate(smsTarget.nextVisitDate)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={smsSending}
                  onClick={() => setSmsTarget(null)}
                  aria-label="Close"
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <X size={19} />
                </button>
              </div>
              <p className="mt-4 text-sm text-gray-700">
                A missed-appointment reminder will be sent to the household
                contact number stored in MCHMS. No child name or medical details
                are included in the SMS.
              </p>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={guardianConfirmed}
                  onChange={(e) => setGuardianConfirmed(e.target.checked)}
                  disabled={smsSending}
                  className="mt-1"
                />
                <span>
                  I have verified that the household contact number belongs to
                  the child's parent or authorized guardian, and that this
                  person may receive appointment reminders.
                </span>
              </label>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={smsSending}
                  onClick={() => setSmsTarget(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!guardianConfirmed || smsSending}
                  onClick={sendChildSms}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <MessageSquare size={16} />
                  {smsSending ? "Sending..." : "Confirm & Send SMS"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUICK ACTIONS */}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
              Quick Actions
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Quickly access your daily BNS tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${action.iconClass}`}>
                      <Icon size={22} />
                    </div>

                    <ArrowRight
                      size={18}
                      className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-green-600"
                    />
                  </div>

                  <h3 className="mt-4 font-semibold text-gray-900">
                    {action.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-6 text-gray-500">
                    {action.description}
                  </p>

                  <span className="mt-4 text-sm font-semibold text-green-600">
                    Open page
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* COMMUNITY CHART */}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
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
              <TrendingUp size={17} className="text-green-600" />
              {assignedAreas.length} assigned{" "}
              {assignedAreas.length === 1 ? "area" : "areas"}
            </div>
          </div>

          <div className="mt-6 h-80 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Loading community statistics...
              </div>
            ) : areaChartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
                <MapPin size={32} className="text-gray-300" />

                <p className="mt-3 font-semibold text-gray-700">
                  No assigned areas found
                </p>

                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Assigned Purok/Sitio statistics will appear here.
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

        {/* ASSIGNED AREAS */}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                My Assigned Areas
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Barangays and Purok/Sitio areas assigned to your account.
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              {assignedAreas.length} Areas
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading assigned areas...
            </div>
          ) : areaChartData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <MapPin size={30} className="mx-auto text-gray-300" />

              <p className="mt-3 font-semibold text-gray-700">
                No assigned areas yet
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Contact your authorized midwife or administrator.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {areaChartData.map((area) => (
                <button
                  type="button"
                  key={area.id}
                  onClick={() => setSelectedAreaId(String(area.id))}
                  className={`rounded-xl border p-4 text-left transition hover:border-green-300 hover:bg-green-50/40 ${
                    selectedAreaId === String(area.id)
                      ? "border-green-300 bg-green-50/60"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-green-100 p-2.5 text-green-600">
                        <MapPin size={20} />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900">
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

                    <ArrowRight size={17} className="text-gray-400" />
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
              className="mt-4 text-sm font-semibold text-green-600 hover:text-green-700"
            >
              Clear area filter
            </button>
          )}
        </section>

        {/* MONTHLY REPORTS */}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Recent Monthly Reports
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Latest monthly child health reports associated with your
                account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/bns/monthly-report")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
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
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Report Period
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                      Date
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
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
                            <div className="rounded-lg bg-green-50 p-2 text-green-600">
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
                            className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 hover:text-green-800"
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

        {/* FOOTER */}

        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Activity size={19} className="mt-0.5 shrink-0 text-gray-500" />

          <p className="text-sm leading-6 text-gray-600">
            Dashboard totals are based on active assigned areas. Immunization
            and growth schedules are calculated from saved next-visit dates.
            Update the child's monitoring record when an appointment is
            completed or rescheduled.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default BnsDashboard;
