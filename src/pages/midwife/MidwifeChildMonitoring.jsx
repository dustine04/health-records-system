import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Baby,
  Syringe,
  Apple,
  Pill,
  ShieldCheck,
  ClipboardList,
  Search,
  Eye,
  X,
  Plus,
  Pencil,
  Trash2,
  Save,
  RefreshCw,
  UserCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  Clock3,
  MessageSquare,
  Send,
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";
import {
  readChildMonitoringCache,
  writeChildMonitoringCache,
  readChildMonitoringDraft,
  writeChildMonitoringDraft,
  deleteChildMonitoringDraft,
  pendingChildMonitoringChanges,
  queueChildMonitoringChange,
  syncChildMonitoringChanges,
} from "../../lib/midwifeChildMonitoringOffline";

/*
  Midwife Child Monitoring
  - District-wide scope, independent of BNS worker_area_assignments
  - Shares BNS child_health_records and seven monitoring tables
  - Separate offline cache and queue; BNS offline queues are not reused
  - Enforce district/role permissions in Supabase, not just this UI
*/

const SECTIONS = {
  newborn: {
    label: "Newborn Tracking",
    icon: Baby,
    table: "child_newborn_tracking",
    fields: {
      place_of_delivery: "text",
      delivery_date: "date",
      birth_weight_kg: "number",
      home_visit_24hrs_date: "date",
      home_visit_1week_date: "date",
      home_visit_2_3weeks_date: "date",
      home_visit_4_6weeks_date: "date",
      family_planning_method: "text",
      newborn_screening_done: "boolean",
      newborn_screening_date: "date",
      newborn_screening_result: "text",
      exclusive_breastfeeding: "boolean",
      remarks: "textarea",
    },
    date: "delivery_date",
  },
  monitoring: {
    label: "Growth Monitoring",
    icon: Activity,
    table: "child_monitoring",
    fields: {
      monitoring_date: "date",
      weight_kg: "number",
      height_cm: "number",
      muac_cm: "number",
      next_visit_date: "date",
    },
    date: "monitoring_date",
  },
  immunization: {
    label: "Immunization",
    icon: Syringe,
    table: "child_immunization",
    fields: {
      vaccination_date: "date",
      vaccine_name: "text",
      dose: "text",
      facility: "text",
      next_visit_date: "date",
      next_vaccine_name: "text",
      remarks: "textarea",
    },
    date: "vaccination_date",
  },
  feeding: {
    label: "Feeding",
    icon: Apple,
    table: "child_feeding",
    fields: {
      record_date: "date",
      breastfeeding_status: "text",
      complementary_feeding_status: "text",
      feeding_notes: "textarea",
    },
    date: "record_date",
  },
  micronutrients: {
    label: "Micronutrients",
    icon: Pill,
    table: "child_micronutrients",
    fields: {
      supplementation_date: "date",
      supplement_name: "text",
      dosage: "text",
      status: "text",
      remarks: "textarea",
    },
    date: "supplementation_date",
  },
  deworming: {
    label: "Deworming",
    icon: ShieldCheck,
    table: "child_deworming",
    fields: {
      deworming_date: "date",
      medicine: "text",
      dosage: "text",
      status: "text",
      remarks: "textarea",
    },
    date: "deworming_date",
  },
  followup: {
    label: "SOAP / Follow-up",
    icon: ClipboardList,
    table: "child_followups",
    fields: {
      followup_date: "date",
      subjective: "textarea",
      objective: "textarea",
      assessment: "textarea",
      plan: "textarea",
      referral: "textarea",
      remarks: "textarea",
    },
    date: "followup_date",
  },
};
const EMPTY = Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, []]));
const label = (key) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatDate = (v) => {
  if (!v) return "—";
  const d = new Date(`${dateOnly(v)}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};
const nameOf = (c) =>
  [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");
const ageMonths = (v) => {
  if (!v) return null;
  const b = new Date(`${dateOnly(v)}T12:00:00`),
    n = new Date();
  let months =
    (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months--;
  return months;
};
const statusOf = (d) => {
  if (!d) return null;
  const x = dateOnly(d),
    now = today();
  if (x < now)
    return {
      text: "Missed / overdue",
      style: "bg-red-100 text-red-700",
      key: "missed",
    };
  if (x === now)
    return {
      text: "Due today",
      style: "bg-amber-100 text-amber-800",
      key: "today",
    };
  const days = Math.round(
    (new Date(`${x}T12:00:00`) - new Date(`${now}T12:00:00`)) / 86400000,
  );
  return days <= 7
    ? { text: "Upcoming", style: "bg-blue-100 text-blue-700", key: "upcoming" }
    : {
        text: "Scheduled",
        style: "bg-emerald-100 text-emerald-700",
        key: "scheduled",
      };
};
const chunks = (arr, size = 100) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const baseInput =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function MidwifeChildMonitoring() {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const isMidwife = user?.role === "midwife";
  const isNurse = user?.role === "nurse";
  const [authorizationChecked, setAuthorizationChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [nurses, setNurses] = useState([]);
  const [accessBusy, setAccessBusy] = useState(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [barangay, setBarangay] = useState("all");
  const [selected, setSelected] = useState(null);
  const [section, setSection] = useState("monitoring");
  const [records, setRecords] = useState(EMPTY);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const draftRef = useRef(null);
  const [busyId, setBusyId] = useState(null);
  const [childSms, setChildSms] = useState({});
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [smsNotice, setSmsNotice] = useState("");
  const [smsTarget, setSmsTarget] = useState(null);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);

  const refreshPending = useCallback(async () => {
    if (!user?.id || !user?.district_id) return;
    try {
      setPending(await pendingChildMonitoringChanges(user));
    } catch (e) {
      setError(`Unable to read pending changes: ${e.message}`);
    }
  }, [user?.id, user?.role, user?.district_id]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void refreshPending();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshPending]);

  const syncNow = useCallback(async () => {
    if (!user?.id || !navigator.onLine || syncing || (isNurse && !authorized))
      return;
    setSyncing(true);
    try {
      const count = await syncChildMonitoringChanges(user);
      await refreshPending();
      setError(
        count
          ? `${count} pending change(s) synchronized.`
          : "Synchronization complete.",
      );
      // Refresh current child after synchronization; otherwise cached values may be stale.
      if (selected?.health_record?.id) await loadRecords(selected);
      await loadChildren();
    } catch (e) {
      setError(
        `Sync stopped: ${e.message}. Unsynchronized changes remain on this device.`,
      );
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, isNurse, authorized, refreshPending, selected]);

  const loadNurseAccess = useCallback(async () => {
    if (!isMidwife || !user?.district_id) return;
    setAccessLoading(true);
    setAccessError("");
    try {
      const [people, grants] = await Promise.all([
        supabase
          .from("users")
          .select(
            "id,first_name,middle_name,last_name,username,email,is_active,district_id",
          )
          .eq("role", "nurse")
          .eq("district_id", user.district_id)
          .order("last_name"),
        supabase
          .from("child_monitoring_access")
          .select("id,nurse_id,is_active,granted_at,granted_by")
          .eq("midwife_id", user.id)
          .eq("district_id", user.district_id),
      ]);
      if (people.error) throw people.error;
      if (grants.error) throw grants.error;
      const byNurse = new Map(
        (grants.data || []).map((g) => [String(g.nurse_id), g]),
      );
      setNurses(
        (people.data || []).map((n) => ({
          ...n,
          access: byNurse.get(String(n.id)) || null,
        })),
      );
    } catch (e) {
      setAccessError(e.message || "Unable to load nurse permissions.");
    } finally {
      setAccessLoading(false);
    }
  }, [isMidwife, user?.id, user?.district_id]);

  const checkAuthorization = useCallback(async () => {
    setAuthorizationChecked(false);
    setAuthorized(false);
    if (!navigator.onLine && isNurse) {
      setAccessError(
        "Nurse authorization must be verified online before accessing monitoring records.",
      );
      setAuthorizationChecked(true);
      return;
    }
    if (!isNurse || !user?.id || !user?.district_id) {
      setAuthorizationChecked(true);
      return;
    }
    try {
      const { data, error: e } = await supabase
        .from("child_monitoring_access")
        .select("id")
        .eq("nurse_id", user.id)
        .eq("district_id", user.district_id)
        .eq("is_active", true)
        .limit(1);
      if (e) throw e;
      setAuthorized(Boolean(data?.length));
    } catch (e) {
      setAccessError(e.message || "Unable to verify authorization.");
    } finally {
      setAuthorizationChecked(true);
    }
  }, [isNurse, user?.id, user?.district_id]);

  useEffect(() => {
    void checkAuthorization();
  }, [checkAuthorization]);
  useEffect(() => {
    void loadNurseAccess();
  }, [loadNurseAccess]);

  const changeAccess = async (nurse, enable) => {
    if (
      !isMidwife ||
      !user?.district_id ||
      !nurse?.id ||
      nurse.is_active === false
    )
      return;
    if (
      !window.confirm(
        `${enable ? "Authorize" : "Revoke access for"} ${nameOf(nurse)} to monitor children in this district?`,
      )
    )
      return;
    setAccessBusy(nurse.id);
    setAccessError("");
    try {
      const old = nurse.access;
      const values = {
        is_active: enable,
        granted_by: user.id,
        granted_at: enable ? new Date().toISOString() : old?.granted_at || null,
        revoked_at: enable ? null : new Date().toISOString(),
      };
      const result = old?.id
        ? await supabase
            .from("child_monitoring_access")
            .update(values)
            .eq("id", old.id)
            .eq("midwife_id", user.id)
            .eq("district_id", user.district_id)
            .select("id")
            .single()
        : await supabase
            .from("child_monitoring_access")
            .insert({
              ...values,
              midwife_id: user.id,
              nurse_id: nurse.id,
              district_id: user.district_id,
            })
            .select("id")
            .single();
      if (result.error) throw result.error;
      const { error: auditError } = await supabase
        .from("it_audit_logs")
        .insert({
          actor_id: user.id,
          action: enable
            ? "child_monitoring_access_granted"
            : "child_monitoring_access_revoked",
          entity_type: "child_monitoring_access",
          entity_id: String(result.data.id),
          details: {
            audit_status: "success",
            module: "Child Monitoring",
            nurse_id: nurse.id,
            district_id: user.district_id,
          },
        });
      if (auditError)
        console.warn(
          "Authorization changed, but audit logging failed:",
          auditError,
        );
      await loadNurseAccess();
    } catch (e) {
      setAccessError(e.message || "Unable to update access.");
    } finally {
      setAccessBusy(null);
    }
  };

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!user?.id || (!isMidwife && !isNurse) || user.district_id == null)
        throw new Error(
          "A Midwife or Nurse account with an assigned district is required.",
        );
      if (isNurse && (!authorizationChecked || !authorized)) {
        setChildren([]);
        return;
      }

      const cachedChildren = await readChildMonitoringCache(
        user,
        "children",
        "district",
      );
      if (cachedChildren) setChildren(cachedChildren);
      if (!navigator.onLine) {
        if (!cachedChildren)
          setError("No cached child directory. Open this page online first.");
        return;
      }
      // Scope the query at the barangay/district relationship before loading children.
      const { data: scopedBarangays, error: bErr } = await supabase
        .from("barangays")
        .select("id,name,district_id")
        .eq("district_id", user.district_id);
      if (bErr) throw bErr;
      const barangayIds = (scopedBarangays || []).map((b) => b.id);
      if (!barangayIds.length) {
        setChildren([]);
        return;
      }

      let areas = [];
      for (const group of chunks(barangayIds)) {
        const { data, error: e } = await supabase
          .from("local_areas")
          .select("id,name,barangay_id")
          .in("barangay_id", group);
        if (e) throw e;
        areas.push(...(data || []));
      }
      const areaIds = areas.map((a) => a.id);
      if (!areaIds.length) {
        setChildren([]);
        return;
      }

      let households = [];
      for (const group of chunks(areaIds)) {
        // Paginate to avoid Supabase's default 1000-row limit.
        for (let start = 0; ; start += 1000) {
          const { data, error: e } = await supabase
            .from("households")
            .select("id,household_code,household_head,local_area_id")
            .in("local_area_id", group)
            .range(start, start + 999);
          if (e) throw e;
          households.push(...(data || []));
          if ((data || []).length < 1000) break;
        }
      }
      const householdIds = households.map((h) => h.id);
      if (!householdIds.length) {
        setChildren([]);
        return;
      }

      let residents = [];
      for (const group of chunks(householdIds)) {
        for (let start = 0; ; start += 1000) {
          const { data, error: e } = await supabase
            .from("residents")
            .select(
              "id,household_id,first_name,middle_name,last_name,sex,birth_date",
            )
            .in("household_id", group)
            .range(start, start + 999);
          if (e) throw e;
          residents.push(...(data || []));
          if ((data || []).length < 1000) break;
        }
      }
      const underFive = residents.filter((r) => {
        const m = ageMonths(r.birth_date);
        return m !== null && m >= 0 && m < 60;
      });
      const residentIds = underFive.map((r) => r.id);
      let healthRecords = [];
      for (const group of chunks(residentIds)) {
        const { data, error: e } = await supabase
          .from("child_health_records")
          .select("id,resident_id,date_of_registration,document_record_no")
          .in("resident_id", group);
        if (e) throw e;
        healthRecords.push(...(data || []));
      }
      const areaMap = new Map(areas.map((a) => [String(a.id), a]));
      const barangayMap = new Map(
        (scopedBarangays || []).map((b) => [String(b.id), b]),
      );
      const householdMap = new Map(households.map((h) => [String(h.id), h]));
      const healthMap = new Map(
        healthRecords.map((r) => [String(r.resident_id), r]),
      );
      const nextChildren = underFive
        .map((r) => {
          const house = householdMap.get(String(r.household_id));
          const area = areaMap.get(String(house?.local_area_id));
          const bg = barangayMap.get(String(area?.barangay_id));
          return {
            ...r,
            household: house,
            area,
            barangay: bg,
            health_record: healthMap.get(String(r.id)) || null,
          };
        })
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      setChildren(nextChildren);
      await writeChildMonitoringCache(
        user,
        "children",
        "district",
        nextChildren,
      );
    } catch (e) {
      setError(e.message || "Could not load district children.");
      // Keep previously cached children when network refresh fails.
    } finally {
      setLoading(false);
    }
  }, [
    user?.id,
    user?.role,
    user?.district_id,
    isMidwife,
    isNurse,
    authorized,
    authorizationChecked,
  ]);

  useEffect(() => {
    if (isMidwife || (isNurse && authorizationChecked)) void loadChildren();
  }, [loadChildren, isMidwife, isNurse, authorizationChecked]);

  const loadRecords = useCallback(
    async (child) => {
      if (!child?.health_record?.id) return;
      setLoadingRecords(true);
      try {
        const cachedRecords = await readChildMonitoringCache(
          user,
          "records",
          child.health_record.id,
        );
        if (cachedRecords) setRecords(cachedRecords);
        if (!navigator.onLine) {
          if (!cachedRecords)
            setError(
              "No cached monitoring details for this child. Open online first.",
            );
          return;
        }
        const entries = await Promise.all(
          Object.entries(SECTIONS).map(async ([key, cfg]) => {
            const { data, error: e } = await supabase
              .from(cfg.table)
              .select("*")
              .eq("child_health_record_id", child.health_record.id)
              .order(cfg.date, { ascending: false });
            if (e) throw new Error(`${cfg.label}: ${e.message}`);
            return [key, data || []];
          }),
        );
        const nextRecords = Object.fromEntries(entries);
        setRecords(nextRecords);
        await writeChildMonitoringCache(
          user,
          "records",
          child.health_record.id,
          nextRecords,
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingRecords(false);
      }
    },
    [user],
  );

  const loadChildSms = useCallback(async (childId) => {
    if (!navigator.onLine || !childId) return;
    const token = sessionStorage.getItem("mchms_session_token");
    if (!token) {
      setSmsError("SMS session unavailable. Sign in again.");
      return;
    }
    setSmsLoading(true);
    try {
      const { data, error: requestError } = await supabase.functions.invoke(
        "mchms-child-sms",
        {
          headers: { "x-mchms-session": token },
          body: { action: "history", child_health_record_id: childId },
        },
      );
      if (requestError || !data?.success) {
        let detail =
          data?.error || requestError?.message || "SMS history unavailable";
        if (requestError?.context?.json) {
          const payload = await requestError.context.json().catch(() => null);
          if (payload?.error) detail = payload.error;
        }
        throw new Error(detail);
      }
      setChildSms((prev) => ({
        ...prev,
        [String(childId)]: {
          logs: data.logs || [],
          hasMobile: data.has_household_mobile === true,
        },
      }));
      setSmsError("");
    } catch (e) {
      setChildSms((prev) => ({ ...prev, [String(childId)]: { error: true } }));
      setSmsError(e.message || "Unable to retrieve child SMS history.");
    } finally {
      setSmsLoading(false);
    }
  }, []);

  const smsAppointment = useMemo(() => {
    if (
      !selected?.health_record?.id ||
      !["monitoring", "immunization"].includes(section)
    )
      return null;
    const cfg = SECTIONS[section];
    const latest = [...(records[section] || [])]
      .filter((r) => !String(r.id).startsWith("pending-"))
      .sort(
        (a, b) =>
          dateOnly(b[cfg.date]).localeCompare(dateOnly(a[cfg.date])) ||
          Number(b.id) - Number(a.id),
      )[0];
    if (!latest?.next_visit_date) return null;
    const date = dateOnly(latest.next_visit_date);
    return {
      childId: selected.health_record.id,
      sourceRecordId: latest.id,
      type: section === "monitoring" ? "growth" : "immunization",
      typeLabel:
        section === "monitoring" ? "Growth Monitoring" : "Immunization",
      childName: nameOf(selected),
      nextVisitDate: date,
      missed: date < today() && dateOnly(latest[cfg.date]) < date,
    };
  }, [selected, section, records]);

  const smsState = selected?.health_record?.id
    ? childSms[String(selected.health_record.id)]
    : null;
  const smsLog =
    smsAppointment &&
    smsState?.logs?.find(
      (entry) =>
        entry.reminder_type === smsAppointment.type &&
        String(entry.source_record_id) ===
          String(smsAppointment.sourceRecordId) &&
        entry.scheduled_date === smsAppointment.nextVisitDate,
    );
  const smsStatus =
    smsLog?.status ||
    (smsState && !smsState.error ? "not_sent" : "unavailable");

  async function sendChildSms() {
    if (
      !isMidwife ||
      !smsTarget ||
      !guardianConfirmed ||
      smsSending ||
      !navigator.onLine
    )
      return;
    const token = sessionStorage.getItem("mchms_session_token");
    if (!token) {
      setSmsError("SMS session unavailable. Sign in again.");
      return;
    }
    setSmsSending(true);
    setSmsError("");
    setSmsNotice("");
    try {
      const { data, error: requestError } = await supabase.functions.invoke(
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
      if (requestError || !data?.success) {
        let detail =
          data?.error || requestError?.message || "Unable to send SMS";
        if (requestError?.context?.json) {
          const payload = await requestError.context.json().catch(() => null);
          if (payload?.error) detail = payload.error;
        }
        throw new Error(detail);
      }
      const id = smsTarget.childId;
      setSmsNotice("SMS sent.");
      setSmsTarget(null);
      setGuardianConfirmed(false);
      await loadChildSms(id);
    } catch (e) {
      setSmsError(
        e.message || "SMS outcome uncertain. Check history before retrying.",
      );
      await loadChildSms(smsTarget.childId);
    } finally {
      setSmsSending(false);
    }
  }

  const openChild = (child) => {
    if (!child.health_record) return;
    setSelected(child);
    setSection("monitoring");
    setRecords(EMPTY);
    setSmsError("");
    setSmsNotice("");
    void loadRecords(child);
    if (navigator.onLine) void loadChildSms(child.health_record.id);
  };
  const startForm = async (record) => {
    const cfg = SECTIONS[section];
    const initial = Object.fromEntries(
      Object.entries(cfg.fields).map(([field, type]) => [
        field,
        record?.[field] ?? (type === "boolean" ? false : ""),
      ]),
    );
    const recordKey = record?.id || "new";
    setEditing(record || null);
    setForm(initial);
    setFormOpen(true);
    setDraftReady(false);
    setDraftMessage("Loading draft...");
    let value = initial;
    try {
      const saved = await readChildMonitoringDraft(
        user,
        selected.health_record.id,
        section,
        recordKey,
      );
      if (
        saved &&
        window.confirm("Restore unfinished changes for this monitoring form?")
      ) {
        value = { ...initial, ...saved };
        setDraftMessage("Draft restored");
      } else if (saved) {
        await deleteChildMonitoringDraft(
          user,
          selected.health_record.id,
          section,
          recordKey,
        );
        setDraftMessage("New draft");
      } else setDraftMessage("Draft saves automatically");
    } catch (e) {
      setDraftMessage(`Draft storage unavailable: ${e.message}`);
    }
    draftRef.current = {
      childId: selected.health_record.id,
      section,
      recordKey,
      data: value,
    };
    setForm(value);
    setDraftReady(true);
  };

  useEffect(() => {
    if (!formOpen || !draftReady || !draftRef.current || !user?.id) return;
    draftRef.current = { ...draftRef.current, data: form };
    const snapshot = draftRef.current;
    const timer = window.setTimeout(async () => {
      try {
        await writeChildMonitoringDraft(
          user,
          snapshot.childId,
          snapshot.section,
          snapshot.recordKey,
          snapshot.data,
        );
        setDraftMessage("Draft saved locally");
      } catch (e) {
        setDraftMessage(`Draft save failed: ${e.message}`);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form, formOpen, draftReady, user]);

  const closeForm = async () => {
    if (saving) return;
    if (draftRef.current) {
      try {
        const d = draftRef.current;
        await writeChildMonitoringDraft(
          user,
          d.childId,
          d.section,
          d.recordKey,
          form,
        );
      } catch (e) {
        alert(`Cannot preserve draft: ${e.message}`);
        return;
      }
    }
    setFormOpen(false);
    setDraftReady(false);
    draftRef.current = null;
  };

  const clearDraft = async () => {
    const d = draftRef.current;
    draftRef.current = null;
    setDraftReady(false);
    if (d)
      await deleteChildMonitoringDraft(user, d.childId, d.section, d.recordKey);
  };

  const save = async () => {
    if (!selected?.health_record?.id || saving || (isNurse && !authorized))
      return;
    const cfg = SECTIONS[section];
    const requiredDate = cfg.date;
    if (requiredDate && !form[requiredDate] && section !== "newborn") {
      alert(`Please enter ${label(requiredDate)}.`);
      return;
    }
    if (
      form.next_visit_date &&
      form[requiredDate] &&
      form.next_visit_date < form[requiredDate]
    ) {
      alert("Next visit cannot be before the recorded visit date.");
      return;
    }
    const data = {
      child_health_record_id: selected.health_record.id,
      updated_at: new Date().toISOString(),
    };
    for (const [key, type] of Object.entries(cfg.fields)) {
      const value = form[key];
      data[key] =
        type === "boolean"
          ? Boolean(value)
          : value === "" || value == null
            ? null
            : type === "number"
              ? Number(value)
              : typeof value === "string"
                ? value.trim()
                : value;
    }
    setSaving(true);
    try {
      const operation = {
        table: cfg.table,
        section,
        method: editing?.id ? "update" : "insert",
        rowId: editing?.id ?? null,
        childHealthRecordId: selected.health_record.id,
        payload: editing?.id ? data : { ...data, created_by: user.id },
      };
      await queueChildMonitoringChange(user, operation);
      await clearDraft();
      const temporary = {
        ...operation.payload,
        id: editing?.id || `pending-${Date.now()}`,
      };
      const nextRecords = {
        ...records,
        [section]: editing?.id
          ? (records[section] || []).map((r) =>
              String(r.id) === String(editing.id) ? temporary : r,
            )
          : [temporary, ...(records[section] || [])],
      };
      setRecords(nextRecords);
      await writeChildMonitoringCache(
        user,
        "records",
        selected.health_record.id,
        nextRecords,
      );
      setFormOpen(false);
      setEditing(null);
      await refreshPending();
      setError(
        "Change queued on this device. Use Sync Now to send it to Supabase.",
      );
    } catch (e) {
      alert(`Unable to queue record: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (record) => {
    if (
      (isNurse && !authorized) ||
      !window.confirm("Delete this monitoring record? This cannot be undone.")
    )
      return;
    const cfg = SECTIONS[section];
    if (String(record.id).startsWith("pending-")) {
      alert(
        "This is a locally queued new record. Synchronize it before deleting or editing it.",
      );
      return;
    }
    setBusyId(record.id);
    try {
      await queueChildMonitoringChange(user, {
        table: cfg.table,
        section,
        method: "delete",
        rowId: record.id,
        childHealthRecordId: selected.health_record.id,
      });
      const nextRecords = {
        ...records,
        [section]: (records[section] || []).filter((r) => r.id !== record.id),
      };
      setRecords(nextRecords);
      await writeChildMonitoringCache(
        user,
        "records",
        selected.health_record.id,
        nextRecords,
      );
      await refreshPending();
      setError(
        "Deletion queued. It will take effect on the server after synchronization.",
      );
    } catch (e) {
      alert(`Unable to queue deletion: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const barangays = useMemo(
    () =>
      Array.from(
        new Map(
          children
            .filter((c) => c.barangay)
            .map((c) => [String(c.barangay.id), c.barangay]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [children],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children.filter(
      (c) =>
        (barangay === "all" || String(c.barangay?.id) === barangay) &&
        (!q ||
          [
            nameOf(c),
            c.household?.household_code,
            c.barangay?.name,
            c.area?.name,
          ].some((s) =>
            String(s || "")
              .toLowerCase()
              .includes(q),
          )),
    );
  }, [children, barangay, search]);
  const registered = filtered.filter((c) => c.health_record).length;
  const sectionCfg = SECTIONS[section];
  const Icon = sectionCfg.icon;
  const list = records[section] || [];

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-100 p-3 text-teal-700">
              <Baby size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Child Monitoring
              </h1>
              <p className="text-sm text-slate-500">
                District-wide monitoring of children under five, including BNS
                records.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${online ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
            >
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? "Online" : "Offline"}
            </span>
            <button
              type="button"
              onClick={() => {
                void refreshPending();
                setPendingOpen(true);
              }}
              className="rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Clock3 size={15} className="mr-1 inline" /> View Pending Changes
              ({pending.length})
            </button>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={!online || syncing || (isNurse && !authorized)}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={loadChildren}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
              Refresh
            </button>
          </div>
        </div>
        {isNurse && !authorizationChecked && (
          <p className="rounded-xl border bg-white p-4 text-sm">
            Checking child-monitoring authorization...
          </p>
        )}
        {isNurse && authorizationChecked && !authorized && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <strong>Child Monitoring access is not authorized.</strong> A
            Midwife in your district must grant you access before you can view
            or edit child monitoring records.
            <button
              type="button"
              onClick={checkAuthorization}
              className="ml-3 rounded-lg border border-amber-300 px-3 py-1.5 font-semibold"
            >
              Check again
            </button>
          </div>
        )}
        {isMidwife && (
          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                  <UserCheck size={19} /> Nurse Child-Monitoring Authorization
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Grant or revoke district-wide monitoring access when you are
                  unavailable. Pregnancy-monitoring access is managed
                  separately.
                </p>
              </div>
              <button
                onClick={loadNurseAccess}
                disabled={accessLoading}
                className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {accessLoading ? "Refreshing..." : "Refresh Nurses"}
              </button>
            </div>
            {accessError && (
              <p
                role="alert"
                className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {accessError}
              </p>
            )}
            {accessLoading ? (
              <p className="p-5 text-sm text-slate-500">Loading nurses...</p>
            ) : !nurses.length ? (
              <p className="p-5 text-sm text-slate-500">
                No nurses assigned to your district.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Nurse</th>
                      <th className="px-5 py-3">Account</th>
                      <th className="px-5 py-3">Authorization</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {nurses.map((n) => (
                      <tr key={n.id}>
                        <td className="px-5 py-3">
                          <strong>{nameOf(n)}</strong>
                          <p className="text-xs text-slate-500">
                            {n.email || n.username || "—"}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          {n.is_active === false ? "Inactive" : "Active"}
                        </td>
                        <td className="px-5 py-3">
                          {n.access?.is_active
                            ? "Authorized"
                            : "Not authorized"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            disabled={
                              accessBusy === n.id || n.is_active === false
                            }
                            onClick={() =>
                              changeAccess(n, !n.access?.is_active)
                            }
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-white disabled:opacity-40 ${n.access?.is_active ? "bg-red-600" : "bg-teal-700"}`}
                          >
                            {n.access?.is_active ? (
                              <ShieldOff size={15} />
                            ) : (
                              <UserCheck size={15} />
                            )}{" "}
                            {accessBusy === n.id
                              ? "Saving..."
                              : n.access?.is_active
                                ? "Revoke"
                                : "Authorize"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {(!isNurse || authorized) && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Children under five", filtered.length],
                ["Registered children", registered],
                [
                  "Barangays represented",
                  new Set(filtered.map((c) => c.barangay?.id).filter(Boolean))
                    .size,
                ],
              ].map(([title, value]) => (
                <div
                  key={title}
                  className="rounded-xl border bg-white p-4 shadow-sm"
                >
                  <p className="text-xs text-slate-500">{title}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
              <div className="relative min-w-56 flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <input
                  className={`${baseInput} pl-9`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search child, household or area"
                />
              </div>
              <select
                className={`${baseInput} sm:w-64`}
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
              >
                <option value="all">All barangays</option>
                {barangays.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-4 font-semibold">
                Children in Assigned District
              </div>
              {loading ? (
                <p className="p-10 text-center text-slate-500">
                  Loading district records...
                </p>
              ) : !filtered.length ? (
                <p className="p-10 text-center text-slate-500">
                  No children found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        {[
                          "Child",
                          "Age",
                          "Sex",
                          "Household",
                          "Barangay",
                          "Registration",
                          "Action",
                        ].map((h) => (
                          <th key={h} className="px-4 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold">
                            {nameOf(c)}
                            <div className="text-xs font-normal text-slate-500">
                              DOB: {formatDate(c.birth_date)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {ageMonths(c.birth_date)} months
                          </td>
                          <td className="px-4 py-3">{c.sex || "—"}</td>
                          <td className="px-4 py-3">
                            {c.household?.household_code || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {c.barangay?.name || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {c.health_record ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                                Registered
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                                Not registered
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              disabled={!c.health_record}
                              onClick={() => openChild(c)}
                              className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-40"
                            >
                              <Eye size={15} /> Monitor
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-xl font-bold">{nameOf(selected)}</h2>
                <p className="text-xs text-slate-500">
                  {selected.barangay?.name} · {ageMonths(selected.birth_date)}{" "}
                  months · {selected.sex}
                </p>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg p-2 hover:bg-slate-100"
                onClick={() => {
                  if (!formOpen) setSelected(null);
                }}
              >
                <X size={21} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div className="flex gap-1 overflow-x-auto border-b bg-slate-50 p-2 md:w-60 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
                {Object.entries(SECTIONS).map(([key, cfg]) => {
                  const TabIcon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSection(key)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold md:w-full ${section === key ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-white"}`}
                    >
                      <TabIcon size={16} />
                      <span className="flex-1">{cfg.label}</span>
                      <span className="rounded-full bg-black/10 px-2 py-0.5">
                        {records[key]?.length || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-bold">
                    <Icon size={20} />
                    {sectionCfg.label}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        void loadRecords(selected);
                        if (online)
                          void loadChildSms(selected.health_record.id);
                      }}
                      className="rounded-lg border p-2"
                      title="Refresh records"
                    >
                      <RefreshCw size={17} />
                    </button>
                    <button
                      onClick={() =>
                        startForm(
                          section === "newborn" ? list[0] || null : null,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                    >
                      <Plus size={16} />
                      {section === "newborn" && list.length
                        ? "Edit Newborn"
                        : "Add Record"}
                    </button>
                  </div>
                </div>
                {["monitoring", "immunization"].includes(section) && (
                  <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="flex items-center gap-2 text-teal-900">
                        <MessageSquare size={17} /> Manual SMS Reminder
                      </strong>
                      {smsLoading && (
                        <span className="text-slate-500">
                          Checking SMS history...
                        </span>
                      )}
                    </div>
                    {!smsAppointment ? (
                      <p className="mt-2 text-slate-600">
                        No scheduled next visit in the latest synchronized
                        record.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-slate-700">
                          {smsAppointment.typeLabel} · Next visit:{" "}
                          {formatDate(smsAppointment.nextVisitDate)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                            {!smsAppointment.missed
                              ? "Not overdue"
                              : smsLoading
                                ? "Checking..."
                                : smsStatus === "sent"
                                  ? "SMS sent successfully"
                                  : smsStatus === "pending"
                                    ? "SMS pending"
                                    : smsStatus === "failed"
                                      ? "SMS failed / attempted"
                                      : smsStatus === "not_sent"
                                        ? "Not sent"
                                        : "Status unavailable"}
                          </span>
                          {isMidwife && smsAppointment.missed && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white disabled:opacity-40"
                              disabled={
                                !online ||
                                smsLoading ||
                                smsSending ||
                                loadingRecords ||
                                smsStatus !== "not_sent" ||
                                !smsState?.hasMobile ||
                                pending.some(
                                  (item) =>
                                    String(item.childHealthRecordId) ===
                                    String(smsAppointment.childId),
                                )
                              }
                              onClick={() => {
                                setSmsTarget(smsAppointment);
                                setGuardianConfirmed(false);
                                setSmsError("");
                              }}
                            >
                              <Send size={15} /> Send SMS
                            </button>
                          )}
                        </div>
                        {smsAppointment.missed &&
                          smsStatus === "not_sent" &&
                          !smsState?.hasMobile && (
                            <p className="mt-2 text-amber-700">
                              Household has no valid mobile number.
                            </p>
                          )}
                        {isNurse && (
                          <p className="mt-2 text-slate-500">
                            Nurse access is view-only for SMS reminders.
                          </p>
                        )}
                      </>
                    )}
                    {smsError && (
                      <p role="alert" className="mt-2 text-red-700">
                        {smsError}
                      </p>
                    )}
                    {smsNotice && (
                      <p className="mt-2 text-green-700">{smsNotice}</p>
                    )}
                  </div>
                )}
                {loadingRecords ? (
                  <p className="py-10 text-center text-slate-500">
                    Loading records...
                  </p>
                ) : !list.length ? (
                  <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
                    No {sectionCfg.label.toLowerCase()} records yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {list.map((r) => (
                      <div key={r.id} className="rounded-xl border p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">
                            {formatDate(r[sectionCfg.date])}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startForm(r)}
                              disabled={String(r.id).startsWith("pending-")}
                              title="Edit"
                              className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => remove(r)}
                              title="Delete"
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {Object.keys(sectionCfg.fields)
                            .filter(
                              (k) =>
                                r[k] !== null &&
                                r[k] !== undefined &&
                                r[k] !== "",
                            )
                            .map((k) => (
                              <div key={k} className="min-w-0">
                                <p className="text-xs text-slate-500">
                                  {label(k)}
                                </p>
                                <p className="break-words text-sm font-medium">
                                  {typeof r[k] === "boolean"
                                    ? r[k]
                                      ? "Yes"
                                      : "No"
                                    : sectionCfg.fields[k] === "date"
                                      ? formatDate(r[k])
                                      : String(r[k])}
                                </p>
                                {k === "next_visit_date" && statusOf(r[k]) && (
                                  <span
                                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusOf(r[k]).style}`}
                                  >
                                    {statusOf(r[k]).text}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {smsTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold">Confirm Child SMS Reminder</h3>
            <p className="mt-2 text-sm text-slate-600">
              {smsTarget.childName} · {smsTarget.typeLabel} ·{" "}
              {formatDate(smsTarget.nextVisitDate)}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              The reminder will be sent to the household contact number. The
              message does not disclose the child's name or medical details.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={guardianConfirmed}
                onChange={(e) => setGuardianConfirmed(e.target.checked)}
                disabled={smsSending}
                className="mt-1"
              />
              <span>
                I have verified that the household number belongs to the child's
                parent or authorized guardian and that they may receive
                appointment reminders.
              </span>
            </label>
            {smsError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {smsError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={smsSending}
                onClick={() => {
                  setSmsTarget(null);
                  setGuardianConfirmed(false);
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!guardianConfirmed || smsSending}
                onClick={() => void sendChildSms()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {smsSending ? "Sending..." : "Confirm & Send SMS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                Pending Synchronization ({pending.length})
              </h3>
              <button
                type="button"
                onClick={() => setPendingOpen(false)}
                aria-label="Close pending changes"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Changes are stored on this device until successfully synchronized.
              Clinical values are hidden here.
            </p>
            {pending.length === 0 ? (
              <p className="rounded-lg border p-5 text-center text-sm text-slate-500">
                No queued changes.
              </p>
            ) : (
              <div className="space-y-2">
                {pending.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <strong>
                        {SECTIONS[item.section]?.label || item.table}
                      </strong>
                      <span className="text-amber-700">Awaiting sync</span>
                    </div>
                    <p className="capitalize text-slate-600">
                      {item.method} record
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("en-PH")
                        : "Time unavailable"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void refreshPending()}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={!online || syncing || (isNurse && !authorized)}
                onClick={() => void syncNow()}
                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {editing ? "Edit" : "Add"} {sectionCfg.label}
                </h3>
                <p className="text-xs text-slate-500">{nameOf(selected)}</p>
              </div>
              <button
                onClick={() => void closeForm()}
                aria-label="Close form"
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-xs text-teal-700">{draftMessage}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(sectionCfg.fields).map(([key, type]) => (
                <label
                  key={key}
                  className={type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <span className="mb-1 block text-xs font-semibold text-slate-600">
                    {label(key)}
                  </span>
                  {type === "boolean" ? (
                    <select
                      className={baseInput}
                      value={form[key] ? "true" : "false"}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [key]: e.target.value === "true",
                        }))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : type === "textarea" ? (
                    <textarea
                      rows={3}
                      className={baseInput}
                      value={form[key] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      className={baseInput}
                      type={type}
                      step={type === "number" ? "any" : undefined}
                      value={form[key] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <button
                disabled={saving}
                onClick={save}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
