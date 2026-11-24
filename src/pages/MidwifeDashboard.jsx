import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Clock,
  Users,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  RefreshCw,
  HeartPulse,
  MapPin,
  CheckCircle2,
  Search,
  Activity,
  Stethoscope,
  Filter,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  ChevronRight,
  CalendarCheck,
  UserRound,
  Bell,
  MessageSquare,
  Send,
  ShieldAlert,
  Baby,
  Syringe,
  Ruler,
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getFullName = (resident) => {
  if (!resident) return "Unknown";

  return [resident.first_name, resident.middle_name, resident.last_name]
    .filter(Boolean)
    .join(" ");
};

const normalizeStatus = (value) =>
  String(value || "active")
    .toLowerCase()
    .trim();

const inactiveStatuses = ["delivered", "miscarriage", "stillbirth", "inactive"];

const isActivePregnancy = (pregnancy) =>
  !inactiveStatuses.includes(normalizeStatus(pregnancy.status));

const PREGNANCY_COLORS = {
  active: "#16a34a",
  for_review: "#eab308",
  high_risk: "#dc2626",
  referred: "#8b5cf6",
  delivered: "#0891b2",
  miscarriage: "#f97316",
  stillbirth: "#64748b",
  inactive: "#9ca3af",
};

const ANC_COLORS = {
  missed: "#dc2626",
  today: "#f97316",
  upcoming: "#eab308",
  scheduled: "#2563eb",
  none: "#9ca3af",
};

const REPORT_COLORS = {
  submitted: "#2563eb",
  approved: "#16a34a",
  returned: "#dc2626",
  draft: "#9ca3af",
  pending: "#eab308",
};

const formatStatus = (status) =>
  String(status || "active")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getCheckupStatus = (nextVisitDate, pregnancyStatus = "active") => {
  if (!isActivePregnancy({ status: pregnancyStatus })) {
    return {
      key: "inactive",
      label: "Not Applicable",
      className: "bg-gray-100 text-gray-500",
    };
  }

  if (!nextVisitDate) {
    return {
      key: "none",
      label: "No Schedule",
      className: "bg-gray-100 text-gray-600",
    };
  }

  const todayDate = new Date(`${getLocalDate()}T00:00:00`);
  const visitDate = new Date(`${nextVisitDate}T00:00:00`);

  if (Number.isNaN(visitDate.getTime())) {
    return {
      key: "none",
      label: "Invalid Schedule",
      className: "bg-gray-100 text-gray-600",
    };
  }

  const diffDays = Math.round(
    (visitDate.getTime() - todayDate.getTime()) / 86400000,
  );

  if (diffDays < 0) {
    return {
      key: "missed",
      label: "Missed Check-up",
      className: "bg-red-100 text-red-700",
      daysOverdue: Math.abs(diffDays),
    };
  }

  if (diffDays === 0) {
    return {
      key: "today",
      label: "Due Today",
      className: "bg-orange-100 text-orange-700",
    };
  }

  if (diffDays <= 7) {
    return {
      key: "upcoming",
      label: "Upcoming",
      className: "bg-yellow-100 text-yellow-700",
      daysUntil: diffDays,
    };
  }

  return {
    key: "scheduled",
    label: "Scheduled",
    className: "bg-blue-100 text-blue-700",
    daysUntil: diffDays,
  };
};

/* =========================================================
   COMPONENT
========================================================= */

function MidwifeDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [pregnancies, setPregnancies] = useState([]);
  const [homeVisits, setHomeVisits] = useState([]);
  const [workerCount, setWorkerCount] = useState(0);

  const [reportCounts, setReportCounts] = useState({
    submitted: 0,
    approved: 0,
    returned: 0,
    draft: 0,
    other: 0,
  });

  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [assignedDistrict, setAssignedDistrict] = useState(null);
  const [showMissedNotifications, setShowMissedNotifications] = useState(false);
  const bellRef = useRef(null);
  const [bellPosition, setBellPosition] = useState({});
  useEffect(() => {
    if (!showMissedNotifications) return;
    const update = () => {
      const rect = bellRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBellPosition({
        "--bell-left": `${Math.max(12, Math.min(rect.right - 384, window.innerWidth - 396))}px`,
        "--bell-top": `${Math.min(rect.bottom + 12, Math.max(12, window.innerHeight - 440))}px`,
      });
    };
    const escape = (e) => {
      if (e.key === "Escape") setShowMissedNotifications(false);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("keydown", escape);
    };
  }, [showMissedNotifications]);

  const [smsLogs, setSmsLogs] = useState([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [smsTarget, setSmsTarget] = useState(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState("");

  // Child reminders use the same server-authorized function as Child Monitoring.
  const [childAppointments, setChildAppointments] = useState([]);
  const [childLoading, setChildLoading] = useState(false);
  const [childError, setChildError] = useState("");
  const [childSmsHistory, setChildSmsHistory] = useState({});
  const [childSmsTarget, setChildSmsTarget] = useState(null);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [childSending, setChildSending] = useState(false);
  const [childFeedback, setChildFeedback] = useState("");
  const [childSuccess, setChildSuccess] = useState("");

  // The browser cannot read pg_cron schedules or Edge Function secrets.
  // Show SMS history only; Cron activity must be verified in Supabase.
  const loadSmsLogs = useCallback(async () => {
    if (!user?.id) return;
    setSmsLoading(true);
    setSmsError("");
    try {
      const token = sessionStorage.getItem("mchms_session_token");
      if (!token) throw new Error("Please log in again to load SMS history.");
      const ids = pregnancies.map((p) => p.id).filter(Boolean);
      if (!ids.length) {
        setSmsLogs([]);
        return;
      }
      const allLogs = [];
      for (let offset = 0; offset < ids.length; offset += 500) {
        const { data, error } = await supabase.functions.invoke(
          "mchms-sms-history",
          {
            headers: { "x-mchms-session": token },
            body: { pregnancy_ids: ids.slice(offset, offset + 500) },
          },
        );
        if (error) throw error;
        if (!data?.success)
          throw new Error(data?.error || "Could not load SMS history.");
        allLogs.push(...(data.logs || []));
      }
      setSmsLogs(allLogs);
    } catch (error) {
      console.error("SMS history load failed:", error);
      setSmsError(error?.message || "Could not load SMS history.");
    } finally {
      setSmsLoading(false);
    }
  }, [user?.id, pregnancies]);

  useEffect(() => {
    if (user?.id && pregnancies.length) loadSmsLogs();
  }, [user?.id, pregnancies, loadSmsLogs]);

  // Match the specific scheduled ANC appointment, regardless of whether the
  // reminder came from Cron or a manual send. Prefer successful records.
  const smsLogFor = useCallback(
    (pregnancy) => {
      const matches = smsLogs.filter(
        (log) =>
          String(log.pregnant_woman_id) === String(pregnancy.id) &&
          String(log.scheduled_date).slice(0, 10) ===
            String(pregnancy.next_visit_date).slice(0, 10),
      );
      return (
        matches.find((log) => String(log.status).toLowerCase() === "sent") ||
        matches.find(
          (log) =>
            String(log.anc_visit_id) === String(pregnancy.latest_anc_visit?.id),
        ) ||
        matches[0] ||
        null
      );
    },
    [smsLogs],
  );

  const [smsSuccess, setSmsSuccess] = useState("");

  const submitManualSms = async () => {
    if (!smsTarget || smsSending) return;
    setSmsSending(true);
    setSmsFeedback("");
    setSmsSuccess("");
    try {
      // Requires a separately deployed, server-authorized manual endpoint.
      // NEVER send SMS_CRON_SECRET or SEMAPHORE_API_KEY from React.
      const sessionToken = sessionStorage.getItem("mchms_session_token");
      if (!sessionToken)
        throw new Error("Please log in again to send SMS reminders.");
      const { data, error } = await supabase.functions.invoke(
        "send-missed-anc-sms-manual",
        {
          headers: { "x-mchms-session": sessionToken },
          body: { pregnancy_id: smsTarget.id },
        },
      );
      if (error) throw error;
      if (!data?.success || data?.sent !== 1) {
        throw new Error(
          data?.message ||
            "SMS was not sent. Check eligibility and SMS history.",
        );
      }
      setSmsSuccess(
        `SMS reminder successfully submitted for ${getFullName(smsTarget.resident)}.`,
      );
      // Optimistically update status, then retrieve the authoritative server log.
      setSmsLogs((previous) => [
        {
          pregnant_woman_id: smsTarget.id,
          anc_visit_id: smsTarget.latest_anc_visit?.id,
          scheduled_date: smsTarget.next_visit_date,
          status: "sent",
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        },
        ...previous,
      ]);
      setSmsTarget(null);
      await loadSmsLogs();
    } catch (error) {
      setSmsFeedback(error?.message || "Manual SMS request failed.");
    } finally {
      setSmsSending(false);
    }
  };
  // Load district-scoped children and their latest completed growth/immunization
  // records. The server independently rechecks all eligibility before sending.
  const loadChildAppointments = useCallback(async () => {
    if (!user?.id || user.role !== "midwife" || user.district_id == null) {
      setChildAppointments([]);
      return;
    }
    setChildLoading(true);
    setChildError("");
    try {
      const children = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from("child_health_records")
          .select(
            `id,resident_id,residents(id,first_name,middle_name,last_name,households(id,household_code,local_area_id,local_areas(id,name,barangays(id,name,district_id))))`,
          )
          .order("id", { ascending: true })
          .range(offset, offset + 499);
        if (error) throw error;
        children.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      const single = (v) => (Array.isArray(v) ? v[0] : v);
      const scoped = children
        .map((child) => {
          const resident = single(child.residents);
          const household = single(resident?.households);
          const area = single(household?.local_areas);
          const barangay = single(area?.barangays);
          return { ...child, resident, household, area, barangay };
        })
        .filter(
          (child) =>
            String(child.barangay?.district_id) === String(user.district_id),
        );
      const ids = scoped.map((child) => child.id);
      const latest = { growth: new Map(), immunization: new Map() };
      for (const [kind, table, dateField] of [
        ["growth", "child_monitoring", "monitoring_date"],
        ["immunization", "child_immunization", "vaccination_date"],
      ]) {
        for (let offset = 0; offset < ids.length; offset += 100) {
          const batch = ids.slice(offset, offset + 100);
          const { data, error } = await supabase
            .from(table)
            .select(`id,child_health_record_id,${dateField},next_visit_date`)
            .in("child_health_record_id", batch)
            .order(dateField, { ascending: false })
            .order("id", { ascending: false });
          if (error) throw error;
          for (const visit of data || []) {
            const key = String(visit.child_health_record_id);
            if (!latest[kind].has(key)) latest[kind].set(key, visit);
          }
        }
      }
      const today = getLocalDate();
      const result = [];
      for (const child of scoped) {
        for (const kind of ["growth", "immunization"]) {
          const visit = latest[kind].get(String(child.id));
          const scheduled = String(visit?.next_visit_date || "").slice(0, 10);
          const completed = String(
            visit?.[
              kind === "growth" ? "monitoring_date" : "vaccination_date"
            ] || "",
          ).slice(0, 10);
          if (
            !visit ||
            !scheduled ||
            scheduled >= today ||
            completed >= scheduled
          )
            continue;
          result.push({
            id: `${kind}-${child.id}-${visit.id}`,
            childId: child.id,
            sourceId: visit.id,
            kind,
            date: scheduled,
            name: getFullName(child.resident),
            barangay: child.barangay?.name || "Unknown barangay",
            householdCode: child.household?.household_code || "—",
          });
        }
      }
      result.sort((a, b) => a.date.localeCompare(b.date));
      setChildAppointments(result);
    } catch (error) {
      console.error("Child appointment load failed:", error);
      setChildError(error?.message || "Could not load child appointments.");
    } finally {
      setChildLoading(false);
    }
  }, [user?.id, user?.role, user?.district_id]);

  useEffect(() => {
    loadChildAppointments();
  }, [loadChildAppointments]);

  const loadChildSmsHistory = useCallback(async (childId) => {
    const token = sessionStorage.getItem("mchms_session_token");
    if (!token)
      throw new Error("Please log in again to check child SMS history.");
    const { data, error } = await supabase.functions.invoke("mchms-child-sms", {
      headers: { "x-mchms-session": token },
      body: { action: "history", child_health_record_id: childId },
    });
    if (error) throw error;
    if (!data?.success)
      throw new Error(data?.error || "Child SMS history unavailable.");
    setChildSmsHistory((previous) => ({ ...previous, [childId]: data }));
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(childAppointments.map((item) => item.childId))];
    if (!ids.length) {
      setChildSmsHistory({});
      return;
    }
    (async () => {
      try {
        for (let i = 0; i < ids.length && !cancelled; i += 5) {
          await Promise.all(
            ids.slice(i, i + 5).map(async (id) => {
              try {
                await loadChildSmsHistory(id);
              } catch (error) {
                if (!cancelled)
                  setChildSmsHistory((prev) => ({
                    ...prev,
                    [id]: { error: error?.message || "History unavailable" },
                  }));
              }
            }),
          );
        }
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childAppointments, loadChildSmsHistory]);

  const childLogFor = (appointment) => {
    const history = childSmsHistory[appointment.childId];
    return (
      history?.logs?.find(
        (log) =>
          log.reminder_type === appointment.kind &&
          String(log.source_record_id) === String(appointment.sourceId) &&
          String(log.scheduled_date).slice(0, 10) === appointment.date,
      ) || null
    );
  };

  const submitChildSms = async () => {
    if (!childSmsTarget || childSending || !guardianConfirmed) return;
    setChildSending(true);
    setChildFeedback("");
    setChildSuccess("");
    try {
      const token = sessionStorage.getItem("mchms_session_token");
      if (!token) throw new Error("Please log in again to send child SMS.");
      const { data, error } = await supabase.functions.invoke(
        "mchms-child-sms",
        {
          headers: { "x-mchms-session": token },
          body: {
            action: "send",
            child_health_record_id: childSmsTarget.childId,
            reminder_type: childSmsTarget.kind,
            source_record_id: childSmsTarget.sourceId,
            guardian_confirmed: true,
          },
        },
      );
      if (error) throw error;
      if (!data?.success)
        throw new Error(data?.error || "SMS was not accepted.");
      setChildSuccess(
        `Child ${childSmsTarget.kind} reminder accepted by SMS provider; delivery is not confirmed.`,
      );
      await loadChildSmsHistory(childSmsTarget.childId);
      setChildSmsTarget(null);
      setGuardianConfirmed(false);
    } catch (error) {
      setChildFeedback(error?.message || "Could not send child SMS.");
      if (childSmsTarget) {
        try {
          await loadChildSmsHistory(childSmsTarget.childId);
        } catch {
          /* keep original error */
        }
      }
    } finally {
      setChildSending(false);
    }
  };

  /* =========================================================
     LOAD CURRENT SESSION
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        if (!cancelled) {
          setUser(null);
          setErrorMessage("Please log in again to access the dashboard.");
        }
        return;
      }

      const parsedUser = JSON.parse(storedUser);

      if (!parsedUser?.id) {
        if (!cancelled) {
          setUser(null);
          setErrorMessage("Your session is invalid. Please log in again.");
        }
        return;
      }

      if (parsedUser.role !== "midwife") {
        if (!cancelled) {
          setUser(null);
          setErrorMessage(
            "This dashboard is available only to midwife accounts.",
          );
        }
        return;
      }

      if (!cancelled) {
        setUser(parsedUser);
        setErrorMessage("");
      }
    } catch (error) {
      console.error("Invalid user session:", error);

      if (!cancelled) {
        setUser(null);
        setErrorMessage("Your session is invalid. Please log in again.");
      }
    } finally {
      if (!cancelled) {
        setSessionChecked(true);
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
     LOAD DASHBOARD DATA
  ========================================================= */

  const loadDashboard = useCallback(async () => {
    if (!user?.id || user.role !== "midwife") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setWorkerCount(0);
    setReportCounts({
      submitted: 0,
      approved: 0,
      returned: 0,
      draft: 0,
      other: 0,
    });
    try {
      /*
       * LOAD THE DISTRICT ASSIGNED TO THE CURRENT MIDWIFE.
       * Keep this inside try/catch so a lookup failure does not leave the
       * dashboard stuck in its loading state.
       */
      if (user.district_id != null) {
        const { data: districtData, error: districtError } = await supabase
          .from("districts")
          .select("id, name")
          .eq("id", user.district_id)
          .maybeSingle();

        if (districtError) throw districtError;
        setAssignedDistrict(districtData || null);
      } else {
        setAssignedDistrict(null);
      }

      /*
       * STEP 1:
       * Load pregnancy records.
       */
      const { data: pregnancyData, error: pregnancyError } = await supabase
        .from("pregnant_women")
        .select("*")
        .order("created_at", { ascending: false });

      if (pregnancyError) throw pregnancyError;

      const allPregnancies = pregnancyData || [];

      /*
       * STEP 2:
       * Load resident and household location information.
       */
      const residentIds = [
        ...new Set(
          allPregnancies
            .map((pregnancy) => pregnancy.resident_id)
            .filter(Boolean),
        ),
      ];

      let residentMap = {};

      if (residentIds.length > 0) {
        const { data: residentData, error: residentError } = await supabase
          .from("residents")
          .select(
            `
              id,
              first_name,
              middle_name,
              last_name,
              household_id,
              households (
                id,
                household_code,
                local_area_id,
                local_areas (
                  id,
                  name,
                  barangay_id,
                  barangays (
                    id,
                    name,
                    district_id,
                    districts (
                      id,
                      name
                    )
                  )
                )
              )
            `,
          )
          .in("id", residentIds);

        if (residentError) throw residentError;

        residentMap = Object.fromEntries(
          (residentData || []).map((resident) => [
            String(resident.id),
            resident,
          ]),
        );
      }

      let combined = allPregnancies.map((pregnancy) => ({
        ...pregnancy,
        resident: residentMap[String(pregnancy.resident_id)] || null,
      }));

      /*
       * STEP 3:
       * Load ANC visits and get the latest visit by visit number/date.
       */
      const pregnancyIds = combined
        .map((pregnancy) => pregnancy.id)
        .filter(Boolean);

      const latestAncMap = {};

      if (pregnancyIds.length > 0) {
        const { data: ancData, error: ancError } = await supabase
          .from("pregnant_woman_visits")
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
          .order("visit_number", { ascending: false })
          .order("visit_date", { ascending: false });

        if (ancError) throw ancError;

        (ancData || []).forEach((visit) => {
          const pregnancyId = String(visit.pregnant_woman_id);

          if (!latestAncMap[pregnancyId]) {
            latestAncMap[pregnancyId] = visit;
          }
        });
      }

      combined = combined.map((pregnancy) => {
        const latestVisit = latestAncMap[String(pregnancy.id)] || null;

        return {
          ...pregnancy,
          latest_anc_visit: latestVisit,
          next_visit_date: latestVisit?.next_visit_date || null,
        };
      });

      /*
       * STEP 4:
       * Scope pregnancy records to the midwife's assigned area.
       *
       * If a barangay is assigned, use that barangay.
       * Otherwise, if a district is assigned, use that district.
       * If neither is assigned, return no pregnancy records.
       */
      if (user.district_id != null) {
        combined = combined.filter((pregnancy) => {
          const districtId =
            pregnancy.resident?.households?.local_areas?.barangays?.district_id;
          return (
            districtId != null &&
            String(districtId) === String(user.district_id)
          );
        });
      } else if (user.barangay_id != null) {
        combined = combined.filter((pregnancy) => {
          const barangayId =
            pregnancy.resident?.households?.local_areas?.barangays?.id;
          return (
            barangayId != null &&
            String(barangayId) === String(user.barangay_id)
          );
        });
      } else {
        combined = [];
      }

      setPregnancies(combined);

      // BHW home visits are separate from ANC clinical check-ups.
      // Fetch only pregnancies within the midwife's authorized district.
      const scopedPregnancyIds = combined
        .map((pregnancy) => pregnancy.id)
        .filter(Boolean);
      const latestHomeVisitMap = new Map();
      if (scopedPregnancyIds.length) {
        // Batch IDs to avoid excessively large PostgREST URL filters.
        for (
          let offset = 0;
          offset < scopedPregnancyIds.length;
          offset += 100
        ) {
          const batch = scopedPregnancyIds.slice(offset, offset + 100);
          const { data: visits, error: visitsError } = await supabase
            .from("pregnant_woman_home_visits")
            .select(
              "id, pregnant_woman_id, visit_number, visit_date, next_visit_date",
            )
            .in("pregnant_woman_id", batch)
            .order("visit_date", { ascending: false })
            .order("visit_number", { ascending: false });
          if (visitsError) throw visitsError;
          for (const visit of visits || []) {
            const pregnancyId = String(visit.pregnant_woman_id);
            if (!latestHomeVisitMap.has(pregnancyId)) {
              latestHomeVisitMap.set(pregnancyId, visit);
            }
          }
        }
      }
      setHomeVisits(Array.from(latestHomeVisitMap.values()));

      /*
       * STEP 5:
       * Load all registered BNS/BHW workers assigned to barangays in this
       * midwife's district. BNS and BHW workers register their own accounts,
       * so account creator/ownership is not used to determine district scope.
       */
      let districtBarangayIds = [];
      let workers = [];

      if (user.district_id != null) {
        const { data: districtBarangays, error: barangayError } = await supabase
          .from("barangays")
          .select("id")
          .eq("district_id", user.district_id);

        if (barangayError) throw barangayError;

        districtBarangayIds = (districtBarangays || []).map(
          (barangay) => barangay.id,
        );
      }

      if (districtBarangayIds.length > 0) {
        const { data: districtWorkers, error: workersError } = await supabase
          .from("users")
          .select("id, role, barangay_id, is_active")
          .in("role", ["bns", "bhw"])
          .in("barangay_id", districtBarangayIds);

        if (workersError) throw workersError;
        workers = districtWorkers || [];
      }

      setWorkerCount(workers.length);

      /*
       * STEP 6:
       * Load BHW monthly reports for BHW workers whose barangays belong to
       * this midwife's district. BNS monthly reports are stored separately.
       */
      const districtBhwIds = workers
        .filter((worker) => worker.role === "bhw")
        .map((worker) => worker.id);

      let reports = [];

      if (districtBhwIds.length > 0) {
        const { data: reportData, error: reportError } = await supabase
          .from("bhw_monthly_reports")
          .select("id, status, bhw_id")
          .in("bhw_id", districtBhwIds);

        if (reportError) throw reportError;
        reports = reportData || [];
      }

      /*
       * STEP 7:
       * Count report statuses using only the filtered reports.
       */
      const nextReportCounts = {
        submitted: 0,
        approved: 0,
        returned: 0,
        draft: 0,
        other: 0,
      };

      reports.forEach((report) => {
        const status = normalizeStatus(report.status);

        if (Object.hasOwn(nextReportCounts, status)) {
          nextReportCounts[status] += 1;
        } else {
          nextReportCounts.other += 1;
        }
      });

      setReportCounts(nextReportCounts);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading midwife dashboard:", error);

      setErrorMessage(
        error?.message || "Failed to load dashboard information.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && user.role === "midwife") {
      loadDashboard();
    } else if (sessionChecked) {
      setLoading(false);
    }
  }, [user, sessionChecked, loadDashboard]);

  /* =========================================================
     DERIVED STATISTICS
  ========================================================= */

  const enrichedPregnancies = useMemo(
    () =>
      pregnancies.map((pregnancy) => ({
        ...pregnancy,
        checkupStatus: getCheckupStatus(
          pregnancy.next_visit_date,
          pregnancy.status,
        ),
      })),
    [pregnancies],
  );

  // Keep ANC statistics unchanged. Combine both services for the bell only.
  const appointmentNotifications = useMemo(() => {
    const results = [];
    const pregnancyById = new Map(pregnancies.map((p) => [String(p.id), p]));
    const append = (pregnancy, visitId, type, date) => {
      if (!pregnancy || !isActivePregnancy(pregnancy) || !date) return;
      const status = getCheckupStatus(date, pregnancy.status);
      if (!["missed", "today", "upcoming"].includes(status.key)) return;
      results.push({
        id: `${type}-${visitId || pregnancy.id}`,
        name: getFullName(pregnancy.resident),
        barangay:
          pregnancy.resident?.households?.local_areas?.barangays?.name ||
          "Unknown barangay",
        type,
        date,
        status: status.key,
        daysOverdue: status.daysOverdue || 0,
        daysUntil: status.daysUntil || 0,
      });
    };
    for (const pregnancy of enrichedPregnancies) {
      append(
        pregnancy,
        pregnancy.latest_anc_visit?.id,
        "anc",
        pregnancy.next_visit_date,
      );
    }
    for (const visit of homeVisits) {
      append(
        pregnancyById.get(String(visit.pregnant_woman_id)),
        visit.id,
        "home",
        visit.next_visit_date,
      );
    }
    const priority = { missed: 0, today: 1, upcoming: 2 };
    return results.sort(
      (a, b) =>
        priority[a.status] - priority[b.status] ||
        String(a.date).localeCompare(String(b.date)),
    );
  }, [pregnancies, enrichedPregnancies, homeVisits]);

  const notificationCounts = useMemo(
    () => ({
      total: appointmentNotifications.length,
      missedANC: appointmentNotifications.filter(
        (n) => n.type === "anc" && n.status === "missed",
      ).length,
      missedHome: appointmentNotifications.filter(
        (n) => n.type === "home" && n.status === "missed",
      ).length,
      dueToday: appointmentNotifications.filter((n) => n.status === "today")
        .length,
      upcoming: appointmentNotifications.filter((n) => n.status === "upcoming")
        .length,
    }),
    [appointmentNotifications],
  );

  const statistics = useMemo(() => {
    const activePregnancies = enrichedPregnancies.filter(isActivePregnancy);

    const missedCheckups = activePregnancies
      .filter((pregnancy) => pregnancy.checkupStatus.key === "missed")
      .sort(
        (a, b) => b.checkupStatus.daysOverdue - a.checkupStatus.daysOverdue,
      );

    const dueToday = activePregnancies.filter(
      (pregnancy) => pregnancy.checkupStatus.key === "today",
    );

    const upcoming = activePregnancies.filter(
      (pregnancy) => pregnancy.checkupStatus.key === "upcoming",
    );

    const scheduled = activePregnancies.filter((pregnancy) =>
      ["scheduled", "upcoming", "today"].includes(pregnancy.checkupStatus.key),
    );

    const forReview = pregnancies.filter(
      (pregnancy) => normalizeStatus(pregnancy.status) === "for_review",
    );

    const highRisk = pregnancies.filter(
      (pregnancy) => normalizeStatus(pregnancy.status) === "high_risk",
    );

    return {
      healthRecords: pregnancies.length,
      activePregnancies: activePregnancies.length,
      pendingRecords: reportCounts.submitted + forReview.length,
      workers: workerCount,
      missedCheckups,
      dueToday,
      upcoming,
      scheduled,
      forReview,
      highRisk,
    };
  }, [enrichedPregnancies, pregnancies, workerCount, reportCounts]);

  const pregnancyChartData = useMemo(() => {
    const counts = {};

    pregnancies.forEach((pregnancy) => {
      const status = normalizeStatus(pregnancy.status);
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([status, value]) => ({
        name: formatStatus(status),
        status,
        value,
        fill: PREGNANCY_COLORS[status] || "#64748b",
      }))
      .sort((a, b) => b.value - a.value);
  }, [pregnancies]);

  const ancChartData = useMemo(() => {
    const counts = {
      missed: 0,
      today: 0,
      upcoming: 0,
      scheduled: 0,
      none: 0,
    };

    enrichedPregnancies.filter(isActivePregnancy).forEach((pregnancy) => {
      const status = pregnancy.checkupStatus.key;

      if (Object.hasOwn(counts, status)) {
        counts[status] += 1;
      }
    });

    return [
      {
        name: "Missed",
        key: "missed",
        count: counts.missed,
        fill: ANC_COLORS.missed,
      },
      {
        name: "Due today",
        key: "today",
        count: counts.today,
        fill: ANC_COLORS.today,
      },
      {
        name: "Upcoming",
        key: "upcoming",
        count: counts.upcoming,
        fill: ANC_COLORS.upcoming,
      },
      {
        name: "Scheduled",
        key: "scheduled",
        count: counts.scheduled,
        fill: ANC_COLORS.scheduled,
      },
      {
        name: "No schedule",
        key: "none",
        count: counts.none,
        fill: ANC_COLORS.none,
      },
    ];
  }, [enrichedPregnancies]);

  const reportChartData = useMemo(
    () => [
      {
        name: "Submitted",
        key: "submitted",
        count: reportCounts.submitted,
        fill: REPORT_COLORS.submitted,
      },
      {
        name: "Approved",
        key: "approved",
        count: reportCounts.approved,
        fill: REPORT_COLORS.approved,
      },
      {
        name: "Returned",
        key: "returned",
        count: reportCounts.returned,
        fill: REPORT_COLORS.returned,
      },
      {
        name: "Draft",
        key: "draft",
        count: reportCounts.draft,
        fill: REPORT_COLORS.draft,
      },
      {
        name: "Other",
        key: "other",
        count: reportCounts.other,
        fill: "#64748b",
      },
    ],
    [reportCounts],
  );

  const barangayOptions = useMemo(() => {
    const unique = new Map();

    pregnancies.forEach((pregnancy) => {
      const barangay = pregnancy.resident?.households?.local_areas?.barangays;

      if (barangay?.id != null) {
        unique.set(String(barangay.id), {
          id: String(barangay.id),
          name: barangay.name || "Unnamed barangay",
        });
      }
    });

    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pregnancies]);

  const filteredAppointments = useMemo(() => {
    return enrichedPregnancies
      .filter(isActivePregnancy)
      .filter((pregnancy) => {
        const key = pregnancy.checkupStatus.key;

        if (selectedFilter === "missed") return key === "missed";
        if (selectedFilter === "today") return key === "today";
        if (selectedFilter === "upcoming") return key === "upcoming";

        if (selectedFilter === "scheduled") {
          return ["scheduled", "upcoming", "today"].includes(key);
        }

        if (selectedFilter === "no_schedule") {
          return key === "none";
        }

        return true;
      })
      .filter((pregnancy) => {
        if (barangayFilter === "all") return true;

        const barangayId =
          pregnancy.resident?.households?.local_areas?.barangays?.id;

        return String(barangayId) === barangayFilter;
      })
      .filter((pregnancy) => {
        if (!searchTerm.trim()) return true;

        const query = searchTerm.toLowerCase().trim();
        const resident = pregnancy.resident;
        const localArea = resident?.households?.local_areas;
        const barangay = localArea?.barangays;

        const searchable = [
          getFullName(resident),
          pregnancy.family_record_no,
          resident?.households?.household_code,
          localArea?.name,
          barangay?.name,
          pregnancy.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .sort((a, b) => {
        const priority = {
          missed: 0,
          today: 1,
          upcoming: 2,
          none: 3,
          scheduled: 4,
        };

        const statusDifference =
          (priority[a.checkupStatus.key] ?? 5) -
          (priority[b.checkupStatus.key] ?? 5);

        if (statusDifference !== 0) return statusDifference;

        if (
          a.checkupStatus.key === "missed" &&
          b.checkupStatus.key === "missed"
        ) {
          return b.checkupStatus.daysOverdue - a.checkupStatus.daysOverdue;
        }

        return String(a.next_visit_date || "9999-12-31").localeCompare(
          String(b.next_visit_date || "9999-12-31"),
        );
      });
  }, [enrichedPregnancies, selectedFilter, barangayFilter, searchTerm]);

  const visibleAppointments = showAllAppointments
    ? filteredAppointments
    : filteredAppointments.slice(0, 8);

  /* =========================================================
     NAVIGATION / INTERACTIONS
  ========================================================= */

  const openPregnancyMonitoring = () =>
    navigate("/dashboard/midwife/pregnancy-monitoring");

  const openRecords = () => navigate("/dashboard/midwife/records");

  const openChildMonitoring = () =>
    navigate("/dashboard/midwife/child-monitoring");

  const openWorkers = () => navigate("/dashboard/midwife/workers");

  const selectAppointmentFilter = (filter) => {
    setSelectedFilter(filter);
    setShowAllAppointments(false);

    document
      .getElementById("appointment-queue")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openMissedNotifications = () => {
    setShowMissedNotifications(false);
    selectAppointmentFilter("missed");
  };

  const clearFilters = () => {
    setSelectedFilter("all");
    setSearchTerm("");
    setBarangayFilter("all");
    setShowAllAppointments(false);
  };

  /* =========================================================
     SESSION / ACCESS STATES
  ========================================================= */

  if (!sessionChecked) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <RefreshCw className="mx-auto animate-spin text-teal-600" size={28} />
          <p className="mt-3 text-sm text-gray-500">Checking your session...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto h-10 w-10 text-gray-400" />

          <p className="mt-3 font-semibold text-gray-800">
            Unable to access the dashboard
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {errorMessage ||
              "No valid midwife session was found. Please log in again."}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* HEADER */}
        <section className="relative z-30 overflow-visible rounded-2xl bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-700 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <Activity size={14} />
                MIDWIFE HEALTH OVERVIEW
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Welcome, {user.first_name || "Midwife"}!
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50 sm:text-base">
                Monitor maternal health, follow up missed ANC appointments, and
                review reports submitted by your community health workers.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-teal-50 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={15} />
                  {new Date().toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  <MapPin size={15} />

                  <span>
                    District:{" "}
                    <strong className="font-semibold text-white">
                      {loading
                        ? "Loading..."
                        : assignedDistrict?.name || "Not assigned"}
                    </strong>
                  </span>
                </span>

                {lastUpdated && (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={15} />
                    Updated{" "}
                    {lastUpdated.toLocaleTimeString("en-PH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* ANC AND BHW HOME-VISIT NOTIFICATIONS */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowMissedNotifications((current) => !current)
                  }
                  ref={bellRef}
                  aria-label={`${notificationCounts.total} maternal appointment alerts`}
                  aria-expanded={showMissedNotifications}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <Bell size={20} />
                  {notificationCounts.total > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-teal-700 bg-red-500 px-1 text-[10px] font-bold text-white">
                      {notificationCounts.total > 99
                        ? "99+"
                        : notificationCounts.total}
                    </span>
                  )}
                </button>
                {showMissedNotifications &&
                  createPortal(
                    <div
                      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-3 lg:block lg:bg-transparent lg:p-0"
                      onClick={(e) => {
                        if (e.target === e.currentTarget)
                          setShowMissedNotifications(false);
                      }}
                    >
                      <div
                        style={bellPosition}
                        role="dialog"
                        aria-label="Maternal health notifications"
                        className="relative flex w-full max-w-sm max-h-[85dvh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left text-gray-800 shadow-2xl lg:fixed lg:left-[var(--bell-left)] lg:top-[var(--bell-top)] lg:max-h-[min(75dvh,calc(100dvh_-_var(--bell-top)_-_12px))]"
                      >
                        <div className="shrink-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                          <div>
                            <p className="font-bold text-gray-800">
                              Maternal Health Notifications
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {notificationCounts.total} appointments requiring
                              attention
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowMissedNotifications(false)}
                            aria-label="Close notifications"
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                          >
                            <X size={17} />
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 p-3">
                            {[
                              [
                                "Missed ANC",
                                notificationCounts.missedANC,
                                "bg-red-50 text-red-700",
                              ],
                              [
                                "Missed Home Visits",
                                notificationCounts.missedHome,
                                "bg-orange-50 text-orange-700",
                              ],
                              [
                                "Due Today",
                                notificationCounts.dueToday,
                                "bg-amber-50 text-amber-800",
                              ],
                              [
                                "Upcoming (7 Days)",
                                notificationCounts.upcoming,
                                "bg-blue-50 text-blue-700",
                              ],
                            ].map(([label, count, style]) => (
                              <div
                                key={label}
                                className={`rounded-xl p-3 ${style}`}
                              >
                                <p className="text-xs">{label}</p>
                                <p className="mt-1 text-xl font-bold">
                                  {count}
                                </p>
                              </div>
                            ))}
                          </div>
                          {appointmentNotifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                              <CheckCircle2
                                size={28}
                                className="mx-auto text-green-500"
                              />
                              <p className="mt-2 text-sm font-semibold">
                                No appointment alerts
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                No overdue, due-today, or upcoming ANC or home
                                visits found.
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {appointmentNotifications.map((notice) => (
                                <button
                                  key={notice.id}
                                  type="button"
                                  onClick={() => {
                                    setShowMissedNotifications(false);
                                    if (notice.type === "anc") {
                                      selectAppointmentFilter(notice.status);
                                    } else {
                                      openPregnancyMonitoring();
                                    }
                                  }}
                                  className="flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                                >
                                  <span
                                    className={`mt-0.5 rounded-full p-2 ${notice.status === "missed" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                                  >
                                    {notice.status === "missed" ? (
                                      <AlertTriangle size={17} />
                                    ) : (
                                      <CalendarDays size={17} />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-gray-900">
                                      {notice.name}
                                    </span>
                                    <span className="mt-1 block text-xs font-medium text-gray-600">
                                      {notice.type === "anc"
                                        ? "ANC Check-up"
                                        : "BHW Home Visit"}
                                    </span>
                                    <span className="mt-1 block text-xs text-gray-500">
                                      {notice.barangay} ·{" "}
                                      {formatDate(notice.date)}
                                    </span>
                                    <span
                                      className={`mt-1 block text-xs font-semibold ${notice.status === "missed" ? "text-red-600" : "text-blue-600"}`}
                                    >
                                      {notice.status === "missed"
                                        ? `${notice.daysOverdue} day(s) overdue`
                                        : notice.status === "today"
                                          ? "Due today"
                                          : `In ${notice.daysUntil} day(s)`}
                                    </span>
                                  </span>
                                  <ChevronRight
                                    size={16}
                                    className="mt-2 shrink-0 text-gray-400"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 border-t border-gray-100 bg-gray-50 p-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowMissedNotifications(false);
                              openPregnancyMonitoring();
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                          >
                            Open Pregnancy Monitoring <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh data
              </button>

              <button
                type="button"
                onClick={openPregnancyMonitoring}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"
              >
                <HeartPulse size={16} />
                Pregnancy records
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* ERROR */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-800">
                Unable to load all dashboard data
              </p>

              <p className="mt-1 break-words text-sm text-red-700">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="mt-2 text-sm font-semibold text-red-800 underline disabled:opacity-50"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* MAIN KPI CARDS */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">At a glance</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select a card to explore the related records.
              </p>
            </div>

            {loading && (
              <span className="text-xs text-gray-500">Updating...</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Pregnancy Records"
              value={statistics.healthRecords}
              description={`${statistics.activePregnancies} active pregnancies`}
              icon={FileText}
              iconClass="bg-blue-50 text-blue-600"
              loading={loading}
              onClick={openPregnancyMonitoring}
            />

            <StatCard
              title="Reports to Review"
              value={statistics.pendingRecords}
              description={`${reportCounts.submitted} submitted reports`}
              icon={ClipboardList}
              iconClass="bg-amber-50 text-amber-600"
              loading={loading}
              onClick={openRecords}
              urgent={statistics.pendingRecords > 0}
            />

            <StatCard
              title="BNS / BHW Workers"
              value={statistics.workers}
              description="Registered BNS and BHW workers in your district"
              icon={Users}
              iconClass="bg-violet-50 text-violet-600"
              loading={loading}
              onClick={openWorkers}
            />

            <StatCard
              title="Missed Check-ups"
              value={statistics.missedCheckups.length}
              description="Scheduled ANC visits past due"
              icon={AlertTriangle}
              iconClass="bg-red-50 text-red-600"
              loading={loading}
              urgent={statistics.missedCheckups.length > 0}
              onClick={() => selectAppointmentFilter("missed")}
            />
          </div>
        </section>

        {/* APPOINTMENT SUMMARY CARDS */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniStatCard
            title="Due today"
            value={statistics.dueToday.length}
            description="Appointments scheduled for today"
            icon={CalendarCheck}
            color="orange"
            onClick={() => selectAppointmentFilter("today")}
          />

          <MiniStatCard
            title="Upcoming this week"
            value={statistics.upcoming.length}
            description="Appointments within seven days"
            icon={Clock}
            color="amber"
            onClick={() => selectAppointmentFilter("upcoming")}
          />

          <MiniStatCard
            title="High-risk pregnancies"
            value={statistics.highRisk.length}
            description="Records marked high risk"
            icon={HeartPulse}
            color="rose"
            onClick={openPregnancyMonitoring}
          />
        </section>

        {/* CHARTS */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800">
              Maternal health analytics
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Visual summaries based on the pregnancy records loaded for your
              assigned area.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* ANC APPOINTMENT CHART */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                      <BarChart3 size={19} />
                    </div>
                    <h3 className="font-bold text-gray-800">
                      ANC appointment status
                    </h3>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    Click a bar to filter the appointment queue.
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {statistics.activePregnancies} active
                </span>
              </div>

              <div className="mt-5 h-72 w-full">
                {loading ? (
                  <ChartLoading />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ancChartData}
                      margin={{
                        top: 10,
                        right: 8,
                        left: -20,
                        bottom: 5,
                      }}
                      barCategoryGap="25%"
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#f3f4f6" }}
                        formatter={(value) => [value, "Pregnancies"]}
                      />
                      <Bar
                        dataKey="count"
                        name="Pregnancies"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                        onClick={(data) => {
                          if (data?.key) {
                            selectAppointmentFilter(
                              data.key === "none" ? "no_schedule" : data.key,
                            );
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {ancChartData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.fill}
                            cursor="pointer"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {ancChartData.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      selectAppointmentFilter(
                        item.key === "none" ? "no_schedule" : item.key,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    {item.name}: <strong>{item.count}</strong>
                  </button>
                ))}
              </div>
            </div>

            {/* PREGNANCY STATUS PIE CHART */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                      <PieChartIcon size={19} />
                    </div>
                    <h3 className="font-bold text-gray-800">
                      Pregnancy record distribution
                    </h3>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    Click a segment to open pregnancy monitoring.
                  </p>
                </div>

                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {pregnancies.length} records
                </span>
              </div>

              <div className="mt-4 h-72 w-full">
                {loading ? (
                  <ChartLoading />
                ) : pregnancyChartData.length === 0 ? (
                  <EmptyChart message="No pregnancy records available." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pregnancyChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={62}
                        outerRadius={100}
                        paddingAngle={3}
                        stroke="#ffffff"
                        strokeWidth={2}
                        onClick={openPregnancyMonitoring}
                        className="cursor-pointer"
                      >
                        {pregnancyChartData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={entry.fill}
                            cursor="pointer"
                          />
                        ))}
                      </Pie>

                      <Tooltip formatter={(value, name) => [value, name]} />

                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <button
                type="button"
                onClick={openPregnancyMonitoring}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                Explore pregnancy records
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* REPORT ANALYTICS */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <ClipboardList size={19} />
                </div>
                <h3 className="font-bold text-gray-800">
                  Monthly report workflow
                </h3>
              </div>

              <p className="mt-2 text-sm text-gray-500">
                BHW monthly report counts for workers registered in your
                district.
              </p>
            </div>

            <button
              type="button"
              onClick={openRecords}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Open report reviews
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-2">
              <ReportProgressRow
                label="Submitted — awaiting review"
                count={reportCounts.submitted}
                color="bg-blue-500"
                total={Object.values(reportCounts).reduce(
                  (sum, value) => sum + value,
                  0,
                )}
              />

              <ReportProgressRow
                label="Approved"
                count={reportCounts.approved}
                color="bg-green-500"
                total={Object.values(reportCounts).reduce(
                  (sum, value) => sum + value,
                  0,
                )}
              />

              <ReportProgressRow
                label="Returned"
                count={reportCounts.returned}
                color="bg-red-500"
                total={Object.values(reportCounts).reduce(
                  (sum, value) => sum + value,
                  0,
                )}
              />

              <ReportProgressRow
                label="Draft"
                count={reportCounts.draft}
                color="bg-gray-400"
                total={Object.values(reportCounts).reduce(
                  (sum, value) => sum + value,
                  0,
                )}
              />
            </div>

            <div className="h-64 lg:col-span-3">
              {loading ? (
                <ChartLoading />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportChartData}
                    layout="vertical"
                    margin={{
                      top: 5,
                      right: 20,
                      left: 10,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={75}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(value) => [value, "Reports"]} />
                    <Bar
                      dataKey="count"
                      name="Reports"
                      radius={[0, 5, 5, 0]}
                      maxBarSize={28}
                    >
                      {reportChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-gray-500">
            These counts include records in <code>bhw_monthly_reports</code>{" "}
            submitted by BHW workers assigned to barangays within your district.
            BNS monthly reports are stored in a separate table and are not
            included in these BHW report counts.
          </p>
        </section>

        {/* SMS feedback stays visible without the technical SMS summary panel. */}
        {(smsSuccess || smsFeedback) && (
          <div
            className="fixed right-4 top-20 z-[190] w-[min(26rem,calc(100vw-2rem))]"
            role={smsFeedback ? "alert" : "status"}
          >
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ${smsFeedback ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
            >
              {smsFeedback ? (
                <AlertTriangle size={20} className="shrink-0" />
              ) : (
                <CheckCircle2 size={20} className="shrink-0" />
              )}
              <p className="flex-1 text-sm font-medium">
                {smsFeedback || smsSuccess}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSmsSuccess("");
                  setSmsFeedback("");
                }}
                aria-label="Dismiss SMS notification"
                className="rounded p-1 hover:bg-black/5"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {smsTarget && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm manual SMS"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <ShieldAlert size={20} /> Confirm SMS reminder
              </h3>
              <p className="mt-3 text-sm text-gray-700">
                Send one missed ANC reminder to{" "}
                <strong>{getFullName(smsTarget.resident)}</strong> for the
                appointment dated{" "}
                <strong>{formatDate(smsTarget.next_visit_date)}</strong>?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Only send if the recipient has consented. The server must verify
                your authorization, district, eligibility, and duplicate status.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={smsSending}
                  onClick={() => {
                    setSmsTarget(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={smsSending}
                  onClick={submitManualSms}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {smsSending ? "Sending..." : "Confirm send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CHILD GROWTH AND IMMUNIZATION SMS REMINDERS */}
        <section
          id="child-sms-queue"
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <Baby size={21} className="text-teal-700" /> Child SMS reminders
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Missed growth monitoring and immunization appointments in your
                district. Reminders are manual only.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadChildAppointments}
                disabled={childLoading}
                className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={childLoading ? "animate-spin" : ""}
                />
              </button>
              <button
                type="button"
                onClick={openChildMonitoring}
                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Child monitoring
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-4 sm:grid-cols-3">
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-700">Missed growth visits</p>
              <p className="mt-1 text-2xl font-bold text-red-800">
                {childAppointments.filter((a) => a.kind === "growth").length}
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-3">
              <p className="text-xs text-orange-700">Missed immunizations</p>
              <p className="mt-1 text-2xl font-bold text-orange-800">
                {
                  childAppointments.filter((a) => a.kind === "immunization")
                    .length
                }
              </p>
            </div>
            <div className="col-span-2 rounded-xl bg-teal-50 p-3 sm:col-span-1">
              <p className="text-xs text-teal-700">SMS accepted</p>
              <p className="mt-1 text-2xl font-bold text-teal-800">
                {
                  childAppointments.filter(
                    (a) => childLogFor(a)?.status === "sent",
                  ).length
                }
              </p>
            </div>
          </div>
          {childError && (
            <p
              role="alert"
              className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {childError}
            </p>
          )}
          {childLoading ? (
            <p className="p-6 text-sm text-gray-500">
              Loading child appointments...
            </p>
          ) : childAppointments.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              No missed child growth or immunization appointments found.
            </p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Child / household</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Missed date</th>
                    <th className="px-4 py-3">SMS status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {childAppointments.map((appointment) => {
                    const history = childSmsHistory[appointment.childId];
                    const log = childLogFor(appointment);
                    const checked = Boolean(history && !history.error);
                    const canSend =
                      checked &&
                      history.has_household_mobile &&
                      !log &&
                      navigator.onLine;
                    return (
                      <tr key={appointment.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">
                            {appointment.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {appointment.barangay} · {appointment.householdCode}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1">
                            {appointment.kind === "growth" ? (
                              <Ruler size={15} />
                            ) : (
                              <Syringe size={15} />
                            )}
                            {appointment.kind === "growth"
                              ? "Growth monitoring"
                              : "Immunization"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-700">
                          {formatDate(appointment.date)}
                        </td>
                        <td className="px-4 py-3">
                          {history?.error ? (
                            <span className="text-red-600">
                              History unavailable
                            </span>
                          ) : !checked ? (
                            "Checking..."
                          ) : log ? (
                            <span
                              className={
                                log.status === "sent"
                                  ? "font-semibold text-green-700"
                                  : "font-semibold text-amber-700"
                              }
                            >
                              {formatStatus(log.status)}
                            </span>
                          ) : !history.has_household_mobile ? (
                            "No valid household mobile"
                          ) : (
                            "Not sent"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={!canSend}
                            title={
                              !navigator.onLine
                                ? "Connect to the internet to send SMS"
                                : !history?.has_household_mobile
                                  ? "No valid household mobile"
                                  : log
                                    ? "SMS attempt already recorded"
                                    : "Send manual reminder"
                            }
                            onClick={() => {
                              setChildSmsTarget(appointment);
                              setGuardianConfirmed(false);
                              setChildFeedback("");
                              setChildSuccess("");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                          >
                            <Send size={13} /> Send SMS
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            SMS is sent only after guardian confirmation. The provider's
            acceptance does not confirm handset delivery. Failed or uncertain
            attempts require review before retrying.
          </p>
        </section>

        {(childFeedback || childSuccess) && (
          <div
            role={childFeedback ? "alert" : "status"}
            className={`rounded-xl border p-4 text-sm ${childFeedback ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
          >
            {childFeedback || childSuccess}
          </div>
        )}
        {childSmsTarget && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm child SMS reminder"
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <ShieldAlert size={20} /> Confirm child SMS reminder
              </h3>
              <p className="mt-3 text-sm text-gray-700">
                Send a missed{" "}
                <strong>
                  {childSmsTarget.kind === "growth"
                    ? "growth monitoring"
                    : "immunization"}
                </strong>{" "}
                reminder for <strong>{childSmsTarget.name}</strong> (scheduled{" "}
                {formatDate(childSmsTarget.date)})?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                The server uses households.contact_number, not a number entered
                here. Verify the recipient before sending.
              </p>
              <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={guardianConfirmed}
                  onChange={(event) =>
                    setGuardianConfirmed(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  I have verified that the household mobile number belongs to
                  the child's parent or authorized guardian and that SMS contact
                  is permitted.
                </span>
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={childSending}
                  onClick={() => setChildSmsTarget(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={childSending || !guardianConfirmed}
                  onClick={submitChildSms}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {childSending ? "Sending..." : "Confirm send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENT QUEUE */}
        <section
          id="appointment-queue"
          className="scroll-mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="border-b border-gray-200 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-50 p-3 text-red-600">
                  <AlertTriangle size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    ANC appointment follow-up queue
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Search records and filter appointments that need attention.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openPregnancyMonitoring}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Pregnancy monitoring
                <ArrowRight size={15} />
              </button>
            </div>

            {/* FILTER CHIPS */}
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { key: "all", label: "All active" },
                { key: "missed", label: "Missed" },
                { key: "today", label: "Due today" },
                { key: "upcoming", label: "Upcoming this week" },
                { key: "scheduled", label: "Scheduled" },
                { key: "no_schedule", label: "No schedule" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setSelectedFilter(filter.key);
                    setShowAllAppointments(false);
                  }}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    selectedFilter === filter.key
                      ? "border-teal-700 bg-teal-700 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* SEARCH AND BARANGAY FILTER */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px_auto]">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, family record no., area..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div className="relative">
                <Filter
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <select
                  value={barangayFilter}
                  onChange={(event) => setBarangayFilter(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-8 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">All barangays</option>

                  {barangayOptions.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                <X size={15} />
                Clear filters
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-5 py-3 sm:px-6">
            <p className="text-sm text-gray-600">
              Showing{" "}
              <strong className="text-gray-800">
                {loading ? "—" : visibleAppointments.length}
              </strong>{" "}
              of{" "}
              <strong className="text-gray-800">
                {loading ? "—" : filteredAppointments.length}
              </strong>{" "}
              matching records
            </p>

            {selectedFilter === "missed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                <AlertTriangle size={13} />
                Prioritize overdue visits
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="mx-auto animate-spin text-teal-600" />

              <p className="mt-3 text-sm text-gray-500">
                Loading appointment records...
              </p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <CheckCircle2 size={26} className="text-gray-500" />
              </div>

              <h4 className="mt-4 font-semibold text-gray-800">
                No matching appointments
              </h4>

              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                Try another status, barangay, or search term. This result does
                not necessarily mean all ANC visits are complete.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-semibold text-teal-700 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">
                        Pregnant woman
                      </th>
                      <th className="px-5 py-4 font-semibold">
                        Barangay / Area
                      </th>
                      <th className="px-5 py-4 font-semibold">
                        Next ANC visit
                      </th>
                      <th className="px-5 py-4 font-semibold">
                        Appointment status
                      </th>
                      <th className="px-5 py-4 font-semibold">SMS reminder</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {visibleAppointments.map((pregnancy) => {
                      const resident = pregnancy.resident;
                      const localArea = resident?.households?.local_areas;
                      const barangay = localArea?.barangays;
                      const checkup = pregnancy.checkupStatus;

                      return (
                        <tr
                          key={pregnancy.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600">
                                <HeartPulse size={18} />
                              </div>

                              <div>
                                <p className="font-semibold text-gray-800">
                                  {getFullName(resident)}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  Family Record:{" "}
                                  {pregnancy.family_record_no || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-start gap-2">
                              <MapPin
                                size={15}
                                className="mt-0.5 shrink-0 text-gray-400"
                              />

                              <div>
                                <p className="font-medium text-gray-700">
                                  {barangay?.name || "—"}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {localArea?.name || "No local area"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <p className="font-medium text-gray-800">
                              {formatDate(pregnancy.next_visit_date)}
                            </p>

                            {checkup.key === "missed" && (
                              <p className="mt-1 text-xs text-red-600">
                                {checkup.daysOverdue} day
                                {checkup.daysOverdue === 1 ? "" : "s"} overdue
                              </p>
                            )}

                            {checkup.key === "upcoming" && (
                              <p className="mt-1 text-xs text-amber-700">
                                Due in {checkup.daysUntil} day
                                {checkup.daysUntil === 1 ? "" : "s"}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${checkup.className}`}
                            >
                              {checkup.key === "missed" && (
                                <AlertTriangle size={12} />
                              )}

                              {checkup.key === "today" && (
                                <CalendarCheck size={12} />
                              )}

                              {checkup.label}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-xs">
                            {checkup.key !== "missed" ? (
                              <span className="text-gray-400">Not overdue</span>
                            ) : smsLoading ? (
                              <span className="text-gray-500">
                                Checking SMS...
                              </span>
                            ) : smsError ? (
                              <span className="text-red-600">
                                Status unavailable
                              </span>
                            ) : smsLogFor(pregnancy)?.status === "sent" ? (
                              <span className="font-semibold text-green-700">
                                SMS sent
                              </span>
                            ) : smsLogFor(pregnancy) ? (
                              <span className="font-semibold text-amber-700">
                                {formatStatus(smsLogFor(pregnancy).status)}
                              </span>
                            ) : (
                              <span className="font-semibold text-gray-500">
                                Not sent
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            {checkup.key === "missed" &&
                              !smsLoading &&
                              !smsError &&
                              !smsLogFor(pregnancy) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSmsFeedback("");
                                    setSmsSuccess("");
                                    setSmsTarget(pregnancy);
                                  }}
                                  className="mr-2 inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                                >
                                  <Send size={13} /> Send SMS
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={openPregnancyMonitoring}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                            >
                              View record
                              <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredAppointments.length > 8 && (
                <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:px-6">
                  <p className="text-xs text-gray-500">
                    {showAllAppointments
                      ? "Showing all matching appointments."
                      : `Showing 8 of ${filteredAppointments.length} matching appointments.`}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowAllAppointments((current) => !current)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    {showAllAppointments ? "Show less" : "Show all"}

                    <ArrowRight
                      size={15}
                      className={
                        showAllAppointments ? "-rotate-90" : "rotate-90"
                      }
                    />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* QUICK ACTIONS */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800">Quick actions</h2>

            <p className="mt-1 text-sm text-gray-500">
              Continue to your most-used midwife workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuickAction
              icon={Stethoscope}
              iconClass="bg-teal-50 text-teal-700"
              title="Pregnancy monitoring"
              description="Review maternal records, ANC visits, referrals, and pregnancy outcomes."
              buttonText="Open monitoring"
              onClick={openPregnancyMonitoring}
            />

            <QuickAction
              icon={ClipboardList}
              iconClass="bg-blue-50 text-blue-700"
              title="Health report reviews"
              description="Open submitted BHW monthly reports and continue the review workflow."
              buttonText="Review reports"
              onClick={openRecords}
            />

            <QuickAction
              icon={Users}
              iconClass="bg-violet-50 text-violet-700"
              title="Community health workers"
              description="View registered BNS and BHW workers in your district and assign their Purok/Sitio areas."
              buttonText="Manage workers"
              onClick={openWorkers}
            />
          </div>
        </section>

        {/* REPORT REVIEW SUMMARY */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <FileText size={22} />
              </div>

              <div>
                <h3 className="font-bold text-gray-800">
                  Report review overview
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Review the report workload before opening the review page.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openRecords}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Go to report reviews
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ReportSummaryTile
              title="Awaiting review"
              count={reportCounts.submitted}
              description="Submitted reports"
              color="blue"
            />

            <ReportSummaryTile
              title="Approved"
              count={reportCounts.approved}
              description="Approved reports"
              color="green"
            />

            <ReportSummaryTile
              title="Returned"
              count={reportCounts.returned}
              description="Reports needing correction"
              color="red"
            />

            <ReportSummaryTile
              title="Drafts"
              count={reportCounts.draft}
              description="Not yet submitted"
              color="gray"
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
  loading,
  urgent,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <p
            className={`mt-3 text-3xl font-bold tracking-tight ${
              urgent ? "text-red-700" : "text-gray-900"
            }`}
          >
            {loading ? "—" : value}
          </p>

          <p className="mt-1.5 text-xs leading-5 text-gray-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${iconClass}`}
        >
          <Icon size={23} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-semibold text-teal-700">
        Explore records
        <ArrowRight
          size={15}
          className="transition group-hover:translate-x-1"
        />
      </div>
    </button>
  );
}

function MiniStatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  onClick,
}) {
  const styles = {
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        styles[color] || styles.orange
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          <p className="mt-1 text-xs opacity-80">{description}</p>
        </div>

        <Icon size={23} />
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs font-semibold">
        View details <ArrowRight size={13} />
      </div>
    </button>
  );
}

function QuickAction({
  icon: Icon,
  iconClass,
  title,
  description,
  buttonText,
  onClick,
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={22} />
        </div>

        <div className="min-w-0">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-teal-700 transition hover:text-teal-900"
      >
        {buttonText}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

function ReportProgressRow({ label, count, color, total }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-800">{count}</span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ReportSummaryTile({ title, count, description, color }) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    green: "border-green-100 bg-green-50 text-green-800",
    red: "border-red-100 bg-red-50 text-red-800",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[color] || styles.gray}`}>
      <p className="text-xs font-semibold opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-bold">{count}</p>
      <p className="mt-1 text-xs opacity-75">{description}</p>
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-gray-400">
      <RefreshCw size={24} className="animate-spin text-teal-600" />
      <p className="mt-3 text-sm">Loading chart data...</p>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

export default MidwifeDashboard;
