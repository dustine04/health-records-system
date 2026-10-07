import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit,
  Eye,
  FileText,
  HeartPulse,
  MapPin,
  Plus,
  Save,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

const today = () => new Date().toISOString().split("T")[0];

const emptyAncForm = {
  visit_number: "",
  visit_date: today(),

  emergency_signs: "",

  respiratory_rate: "",
  systolic_bp: "",
  diastolic_bp: "",
  pulse_rate: "",
  temperature: "",

  gestational_age_weeks: "",

  birth_plan: "",

  vaginal_bleeding: false,
  severe_headache: false,
  blurred_vision: false,
  severe_abdominal_pain: false,
  fetal_movement: false,

  fundal_height_cm: "",
  weight_kg: "",
  edema: false,

  concerns: "",

  multiple_pregnancy: false,
  presentation: "",
  fetal_heart_rate: "",
  transverse_or_breech: false,
  family_planning_counseled: false,

  preeclampsia_check: false,
  urine_protein: "",

  hemoglobin: "",
  anemia_tiredness: false,
  anemia_shortness_of_breath: false,
  anemia_pallor: false,

  no_fetal_movement: false,
  ruptured_membranes: false,
  fever_or_burning_urination: false,
  vaginal_discharge: false,
  coughing_or_breathing_difficulty: false,
  taking_anti_tb_drugs: false,
  smoking_alcohol_drug_use: false,
  history_of_violence: false,
  signs_of_sti_hiv: false,
  current_medical_condition: "",

  physical_exam_findings: "",
  other_laboratory_findings: "",
  other_problems: "",

  hiv_counseling: false,
  hiv_test_result: "",
  infant_feeding_counseling: false,

  tetanus_toxoid: false,
  iron_folate_given: false,
  oral_care_done: false,

  self_care_advice: "",
  nutrition_advice: "",
  routine_followup_advice: "",
  labor_danger_signs_advice: "",
  breastfeeding_advice: "",
  newborn_screening_advice: "",

  birth_emergency_plan: "",
  overall_assessment: "",
  management_advice: "",

  next_visit_date: "",
};

const numberFields = [
  "visit_number",
  "respiratory_rate",
  "systolic_bp",
  "diastolic_bp",
  "pulse_rate",
  "temperature",
  "gestational_age_weeks",
  "fundal_height_cm",
  "weight_kg",
  "fetal_heart_rate",
  "hemoglobin",
];

const booleanFields = [
  "vaginal_bleeding",
  "severe_headache",
  "blurred_vision",
  "severe_abdominal_pain",
  "fetal_movement",
  "edema",
  "multiple_pregnancy",
  "transverse_or_breech",
  "family_planning_counseled",
  "preeclampsia_check",
  "anemia_tiredness",
  "anemia_shortness_of_breath",
  "anemia_pallor",
  "no_fetal_movement",
  "ruptured_membranes",
  "fever_or_burning_urination",
  "vaginal_discharge",
  "coughing_or_breathing_difficulty",
  "taking_anti_tb_drugs",
  "smoking_alcohol_drug_use",
  "history_of_violence",
  "signs_of_sti_hiv",
  "hiv_counseling",
  "infant_feeding_counseling",
  "tetanus_toxoid",
  "iron_folate_given",
  "oral_care_done",
];

const textAreaFields = [
  ["emergency_signs", "Emergency Signs"],
  ["birth_plan", "Birth Plan"],
  ["concerns", "Concerns"],
  ["current_medical_condition", "Current Medical Condition"],
  ["physical_exam_findings", "Physical Examination Findings"],
  ["other_laboratory_findings", "Other Laboratory Findings"],
  ["other_problems", "Other Problems"],
  ["self_care_advice", "Self-Care Advice"],
  ["nutrition_advice", "Nutrition Advice"],
  ["routine_followup_advice", "Routine Follow-up Advice"],
  ["labor_danger_signs_advice", "Labor Danger Signs Advice"],
  ["breastfeeding_advice", "Breastfeeding Advice"],
  ["newborn_screening_advice", "Newborn Screening Advice"],
  ["birth_emergency_plan", "Birth Emergency Plan"],
  ["overall_assessment", "Overall Assessment"],
  ["management_advice", "Management / Management Advice"],
];

const booleanLabels = {
  vaginal_bleeding: "Vaginal Bleeding",
  severe_headache: "Severe Headache",
  blurred_vision: "Blurred Vision",
  severe_abdominal_pain: "Severe Abdominal Pain",
  fetal_movement: "Fetal Movement Present",
  edema: "Edema",
  multiple_pregnancy: "Multiple Pregnancy",
  transverse_or_breech: "Transverse / Breech",
  family_planning_counseled: "Family Planning Counseled",
  preeclampsia_check: "Preeclampsia Check Positive",
  anemia_tiredness: "Anemia: Tiredness",
  anemia_shortness_of_breath: "Anemia: Shortness of Breath",
  anemia_pallor: "Anemia: Pallor",
  no_fetal_movement: "No Fetal Movement",
  ruptured_membranes: "Ruptured Membranes",
  fever_or_burning_urination: "Fever / Burning Urination",
  vaginal_discharge: "Vaginal Discharge",
  coughing_or_breathing_difficulty: "Coughing / Breathing Difficulty",
  taking_anti_tb_drugs: "Taking Anti-TB Drugs",
  smoking_alcohol_drug_use: "Smoking / Alcohol / Drug Use",
  history_of_violence: "History of Violence",
  signs_of_sti_hiv: "Signs of STI / HIV",
  hiv_counseling: "HIV Counseling",
  infant_feeding_counseling: "Infant Feeding Counseling",
  tetanus_toxoid: "Tetanus Toxoid Given",
  iron_folate_given: "Iron / Folate Given",
  oral_care_done: "Oral Care Done",
};

const statusOptions = [
  ["active", "Active"],
  ["for_review", "For Review"],
  ["high_risk", "High Risk"],
  ["referred", "Referred"],
  ["delivered", "Delivered"],
  ["miscarriage", "Miscarriage"],
  ["stillbirth", "Stillbirth"],
  ["inactive", "Inactive"],
];

const statusStyles = {
  active: "bg-green-100 text-green-700",
  for_review: "bg-yellow-100 text-yellow-700",
  high_risk: "bg-red-100 text-red-700",
  referred: "bg-purple-100 text-purple-700",
  delivered: "bg-blue-100 text-blue-700",
  miscarriage: "bg-orange-100 text-orange-700",
  stillbirth: "bg-gray-200 text-gray-700",
  inactive: "bg-gray-100 text-gray-500",
};

const statusLabel = (status) =>
  statusOptions.find(([value]) => value === status)?.[1] || status || "Active";

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
const getCheckupStatus = (nextVisitDate, pregnancyStatus = "active") => {
  if (!nextVisitDate) {
    return {
      key: "none",
      label: "No Schedule",
      className: "bg-gray-100 text-gray-600",
    };
  }

  const inactiveStatuses = [
    "delivered",
    "miscarriage",
    "stillbirth",
    "inactive",
  ];

  if (inactiveStatuses.includes(pregnancyStatus)) {
    return {
      key: "inactive",
      label: "Not Applicable",
      className: "bg-gray-100 text-gray-500",
    };
  }

  const todayDate = new Date(`${today()}T00:00:00`);
  const visitDate = new Date(`${nextVisitDate}T00:00:00`);

  const diffTime = visitDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
const fullName = (person) => {
  if (!person) return "Unknown";

  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ");
};

const userName = (user) => {
  if (!user) return "Unknown";

  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ");
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function PregnancyMonitoring() {
  const [user, setUser] = useState(null);

  const [pregnancies, setPregnancies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedPregnancy, setSelectedPregnancy] = useState(null);

  const [homeVisits, setHomeVisits] = useState([]);
  const [ancVisits, setAncVisits] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [loadingDetails, setLoadingDetails] = useState(false);

  const [ancModal, setAncModal] = useState(false);
  const [editingAnc, setEditingAnc] = useState(null);
  const [ancForm, setAncForm] = useState(emptyAncForm);

  const [referralModal, setReferralModal] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [referralStatus, setReferralStatus] = useState("pending");
  const [referralNotes, setReferralNotes] = useState("");

  const [outcomeModal, setOutcomeModal] = useState(false);

  const [outcomeForm, setOutcomeForm] = useState({
    status: "active",
    pregnancy_outcome: "",
    birth_status: "",
    date_of_delivery: "",
    place_of_delivery: "",
    facility_name: "",
    attended_by: "",
  });

  const [saving, setSaving] = useState(false);

  /* =========================================================
     GET USER
  ========================================================= */

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Invalid user session:", error);
      }
    }
  }, []);

  /* =========================================================
     LOAD PREGNANCIES
  ========================================================= */

  useEffect(() => {
    if (user) {
      loadPregnancies();
    }
  }, [user]);

  const loadPregnancies = async () => {
    try {
      setLoading(true);

      const { data: pregnancyData, error: pregnancyError } = await supabase
        .from("pregnant_women")
        .select("*")
        .order("created_at", { ascending: false });

      if (pregnancyError) throw pregnancyError;

      if (!pregnancyData?.length) {
        setPregnancies([]);
        return;
      }

      const residentIds = [
        ...new Set(
          pregnancyData.map((item) => item.resident_id).filter(Boolean),
        ),
      ];

      if (!residentIds.length) {
        setPregnancies([]);
        return;
      }

      const { data: residentData, error: residentError } = await supabase
        .from("residents")
        .select(
          `
            id,
            first_name,
            middle_name,
            last_name,
            sex,
            birth_date,
            contact_number,
            household_id,
            households (
              id,
              household_code,
              household_head,
              address,
              local_area_id,
              local_areas (
                id,
                name,
                type,
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

      const residentMap = {};

      (residentData || []).forEach((resident) => {
        residentMap[resident.id] = resident;
      });

      let combined = pregnancyData.map((pregnancy) => ({
        ...pregnancy,
        resident: residentMap[pregnancy.resident_id] || null,
      }));

      /* -----------------------------------------------
   GET LATEST ANC VISIT / NEXT CHECK-UP
----------------------------------------------- */

      const pregnancyIds = combined.map((item) => item.id).filter(Boolean);

      let latestAncMap = {};

      if (pregnancyIds.length) {
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
          .order("visit_number", { ascending: false });

        if (ancError) throw ancError;

        (ancData || []).forEach((visit) => {
          if (!latestAncMap[visit.pregnant_woman_id]) {
            latestAncMap[visit.pregnant_woman_id] = visit;
          }
        });
      }

      combined = combined.map((pregnancy) => ({
        ...pregnancy,
        latest_anc_visit: latestAncMap[pregnancy.id] || null,
        next_visit_date: latestAncMap[pregnancy.id]?.next_visit_date || null,
      }));

      /* -----------------------------------------------
         MIDWIFE AREA SCOPE
      ----------------------------------------------- */

      if (user?.barangay_id) {
        combined = combined.filter((item) => {
          const barangayId =
            item.resident?.households?.local_areas?.barangays?.id;

          return Number(barangayId) === Number(user.barangay_id);
        });
      } else if (user?.district_id) {
        combined = combined.filter((item) => {
          const districtId =
            item.resident?.households?.local_areas?.barangays?.district_id;

          return Number(districtId) === Number(user.district_id);
        });
      }

      setPregnancies(combined);
    } catch (error) {
      console.error("Error loading pregnancies:", error);
      alert(error.message || "Failed to load pregnancy records.");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredPregnancies = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return pregnancies;

    return pregnancies.filter((item) => {
      const resident = item.resident;
      const household = resident?.households;
      const localArea = household?.local_areas;
      const barangay = localArea?.barangays;

      const values = [
        fullName(resident),
        household?.household_code,
        localArea?.name,
        barangay?.name,
        item.family_record_no,
        item.pregnancy_outcome,
        statusLabel(item.status),
      ];

      return values.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [pregnancies, search]);

  /* =========================================================
     STATISTICS
  ========================================================= */

  const statistics = useMemo(() => {
    const active = pregnancies.filter((item) =>
      ["active", "for_review", "high_risk", "referred"].includes(
        item.status || "active",
      ),
    );

    const forReview = pregnancies.filter(
      (item) => item.status === "for_review",
    );

    const highRisk = pregnancies.filter((item) => item.status === "high_risk");

    const dueSoon = pregnancies.filter((item) => {
      if (!item.edc) return false;

      const edc = new Date(`${item.edc}T00:00:00`);
      const now = new Date();

      const future = new Date(now);
      future.setDate(future.getDate() + 30);

      return (
        edc >= new Date(now.toDateString()) &&
        edc <= future &&
        ["active", "for_review", "high_risk", "referred"].includes(
          item.status || "active",
        )
      );
    });

    const missedCheckups = pregnancies.filter((item) => {
      const status = getCheckupStatus(item.next_visit_date, item.status);

      return status.key === "missed";
    });

    const dueToday = pregnancies.filter((item) => {
      const status = getCheckupStatus(item.next_visit_date, item.status);

      return status.key === "today";
    });

    return {
      active: active.length,
      forReview: forReview.length,
      highRisk: highRisk.length,
      dueSoon: dueSoon.length,
      missedCheckups: missedCheckups.length,
      dueToday: dueToday.length,
    };
  }, [pregnancies]);

  /* =========================================================
     LOAD DETAILS
  ========================================================= */

  const openPregnancy = async (pregnancy) => {
    try {
      setSelectedPregnancy(pregnancy);
      setLoadingDetails(true);

      const [homeVisitResult, ancResult, referralResult] = await Promise.all([
        supabase
          .from("pregnant_woman_home_visits")
          .select("*")
          .eq("pregnant_woman_id", pregnancy.id)
          .order("visit_number", { ascending: true }),

        supabase
          .from("pregnant_woman_visits")
          .select("*")
          .eq("pregnant_woman_id", pregnancy.id)
          .order("visit_number", { ascending: true }),

        supabase
          .from("pregnancy_referrals")
          .select("*")
          .eq("pregnant_woman_id", pregnancy.id)
          .order("created_at", { ascending: false }),
      ]);

      if (homeVisitResult.error) throw homeVisitResult.error;
      if (ancResult.error) throw ancResult.error;

      if (referralResult.error && referralResult.error.code !== "42P01") {
        throw referralResult.error;
      }

      setHomeVisits(homeVisitResult.data || []);
      setAncVisits(ancResult.data || []);
      setReferrals(referralResult.data || []);

      setOutcomeForm({
        status: pregnancy.status || "active",
        pregnancy_outcome: pregnancy.pregnancy_outcome || "",
        birth_status: pregnancy.birth_status || "",
        date_of_delivery: pregnancy.date_of_delivery || "",
        place_of_delivery: pregnancy.place_of_delivery || "",
        facility_name: pregnancy.facility_name || "",
        attended_by: pregnancy.attended_by || "",
      });
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to load pregnancy details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  /* =========================================================
     ANC FORM
  ========================================================= */

  const getNextVisitNumber = () => {
    const usedNumbers = ancVisits
      .map((visit) => Number(visit.visit_number))
      .filter(Boolean);

    for (let i = 1; i <= 8; i++) {
      if (!usedNumbers.includes(i)) {
        return i;
      }
    }

    return ancVisits.length + 1;
  };

  const openAddAnc = () => {
    setEditingAnc(null);

    setAncForm({
      ...emptyAncForm,
      visit_number: getNextVisitNumber(),
      visit_date: today(),
    });

    setAncModal(true);
  };

  const openEditAnc = (visit) => {
    setEditingAnc(visit);

    const form = { ...emptyAncForm };

    Object.keys(form).forEach((key) => {
      if (visit[key] !== undefined && visit[key] !== null) {
        form[key] = visit[key];
      }
    });

    setAncForm(form);
    setAncModal(true);
  };

  const handleAncChange = (field, value) => {
    setAncForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* =========================================================
     SAVE ANC
  ========================================================= */

  const saveAnc = async (event) => {
    event.preventDefault();

    if (!selectedPregnancy) return;

    try {
      setSaving(true);

      const payload = {
        pregnant_woman_id: selectedPregnancy.id,
      };

      Object.keys(ancForm).forEach((field) => {
        let value = ancForm[field];

        if (numberFields.includes(field)) {
          value = value === "" || value === null ? null : Number(value);
        }

        if (typeof value === "string" && value.trim() === "") {
          value = null;
        }

        payload[field] = value;
      });

      if (!editingAnc) {
        payload.created_by = user.id;
        payload.assessed_by = user.id;
      } else {
        payload.assessed_by = user.id;
        payload.updated_at = new Date().toISOString();
      }

      let result;

      if (editingAnc) {
        result = await supabase
          .from("pregnant_woman_visits")
          .update(payload)
          .eq("id", editingAnc.id);
      } else {
        result = await supabase.from("pregnant_woman_visits").insert(payload);
      }

      if (result.error) throw result.error;

      setAncModal(false);
      setEditingAnc(null);

      await openPregnancy(selectedPregnancy);
      await loadPregnancies();

      alert(
        editingAnc
          ? "ANC visit updated successfully."
          : "ANC visit added successfully.",
      );
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save ANC visit.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DELETE ANC
  ========================================================= */

  const deleteAnc = async (visit) => {
    const confirmed = window.confirm(
      `Delete ANC Visit #${visit.visit_number}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("pregnant_woman_visits")
        .delete()
        .eq("id", visit.id);

      if (error) throw error;

      await openPregnancy(selectedPregnancy);
      await loadPregnancies();

      alert("ANC visit deleted.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete ANC visit.");
    }
  };

  /* =========================================================
     REFERRAL
  ========================================================= */

  const openReferral = (referral) => {
    setSelectedReferral(referral);
    setReferralStatus(referral.status || "pending");
    setReferralNotes(referral.midwife_notes || "");
    setReferralModal(true);
  };

  const saveReferralReview = async (event) => {
    event.preventDefault();

    if (!selectedReferral) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("pregnancy_referrals")
        .update({
          status: referralStatus,
          midwife_notes: referralNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReferral.id);

      if (error) throw error;

      setReferralModal(false);

      await openPregnancy(selectedPregnancy);

      alert("Referral updated successfully.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update referral.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     SAVE OUTCOME
  ========================================================= */

  const saveOutcome = async (event) => {
    event.preventDefault();

    if (!selectedPregnancy) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("pregnant_women")
        .update({
          status: outcomeForm.status,
          pregnancy_outcome: outcomeForm.pregnancy_outcome || null,
          birth_status: outcomeForm.birth_status || null,
          date_of_delivery: outcomeForm.date_of_delivery || null,
          place_of_delivery: outcomeForm.place_of_delivery || null,
          facility_name: outcomeForm.facility_name || null,
          attended_by: outcomeForm.attended_by || null,
        })
        .eq("id", selectedPregnancy.id);

      if (error) throw error;

      setOutcomeModal(false);

      await loadPregnancies();

      const updatedPregnancy = {
        ...selectedPregnancy,
        ...outcomeForm,
      };

      setSelectedPregnancy(updatedPregnancy);

      alert("Pregnancy outcome updated successfully.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update pregnancy outcome.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     STATUS QUICK UPDATE
  ========================================================= */

  const updateStatus = async (status) => {
    if (!selectedPregnancy) return;

    try {
      const { error } = await supabase
        .from("pregnant_women")
        .update({ status })
        .eq("id", selectedPregnancy.id);

      if (error) throw error;

      const updated = {
        ...selectedPregnancy,
        status,
      };

      setSelectedPregnancy(updated);

      await loadPregnancies();

      setOutcomeForm((prev) => ({
        ...prev,
        status,
      }));
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update status.");
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Pregnancy Monitoring
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review pregnancy records, ANC visits, referrals, and pregnancy
            outcomes.
          </p>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Active Pregnancies"
            value={statistics.active}
            icon={Baby}
            iconClass="bg-green-100 text-green-600"
          />

          <StatCard
            title="For Review"
            value={statistics.forReview}
            icon={Clock3}
            iconClass="bg-yellow-100 text-yellow-600"
          />

          <StatCard
            title="High Risk"
            value={statistics.highRisk}
            icon={AlertTriangle}
            iconClass="bg-red-100 text-red-600"
          />

          <StatCard
            title="Due Within 30 Days"
            value={statistics.dueSoon}
            icon={CalendarDays}
            iconClass="bg-blue-100 text-blue-600"
          />
          <StatCard
            title="Missed Check-ups"
            value={statistics.missedCheckups}
            icon={AlertTriangle}
            iconClass="bg-red-100 text-red-600"
          />

          <StatCard
            title="Due Today"
            value={statistics.dueToday}
            icon={Clock3}
            iconClass="bg-orange-100 text-orange-600"
          />
        </div>

        {/* SEARCH */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="relative max-w-xl">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pregnant woman, household, barangay..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-4">Pregnant Woman</th>

                  <th className="px-5 py-4">Area</th>

                  <th className="px-5 py-4">EDC</th>

                  <th className="px-5 py-4">ANC</th>
                  <th className="px-5 py-4">Next Check-up</th>
                  <th className="px-5 py-4">Status</th>

                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      Loading pregnancy records...
                    </td>
                  </tr>
                ) : filteredPregnancies.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      No pregnancy records found.
                    </td>
                  </tr>
                ) : (
                  filteredPregnancies.map((pregnancy) => {
                    const resident = pregnancy.resident;
                    const household = resident?.households;

                    const localArea = household?.local_areas;

                    const barangay = localArea?.barangays;
                    const checkupStatus = getCheckupStatus(
                      pregnancy.next_visit_date,
                      pregnancy.status,
                    );
                    return (
                      <tr key={pregnancy.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                              <UserRound size={18} />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-800">
                                {fullName(resident)}
                              </p>

                              <p className="text-xs text-gray-500">
                                Family Record No:{" "}
                                {pregnancy.family_record_no || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-start gap-2">
                            <MapPin
                              size={15}
                              className="mt-0.5 text-gray-400"
                            />

                            <div>
                              <p className="font-medium text-gray-700">
                                {localArea?.name || "—"}
                              </p>

                              <p className="text-xs text-gray-500">
                                {barangay?.name || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-700">
                            {formatDate(pregnancy.edc)}
                          </p>

                          {pregnancy.lmp && (
                            <p className="text-xs text-gray-500">
                              LMP: {formatDate(pregnancy.lmp)}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Activity size={16} className="text-blue-500" />

                            <span className="font-medium">
                              {pregnancy.latest_anc_visit
                                ? `${pregnancy.latest_anc_visit.visit_number || 0} visit${
                                    Number(
                                      pregnancy.latest_anc_visit.visit_number,
                                    ) === 1
                                      ? ""
                                      : "s"
                                  }`
                                : "No ANC"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {pregnancy.next_visit_date ? (
                            <div className="space-y-1">
                              <p className="font-medium text-gray-700">
                                {formatDate(pregnancy.next_visit_date)}
                              </p>

                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${checkupStatus.className}`}
                              >
                                {checkupStatus.label}
                              </span>

                              {checkupStatus.key === "missed" && (
                                <p className="text-xs font-medium text-red-600">
                                  {checkupStatus.daysOverdue} day
                                  {checkupStatus.daysOverdue === 1
                                    ? ""
                                    : "s"}{" "}
                                  overdue
                                </p>
                              )}

                              {checkupStatus.key === "upcoming" && (
                                <p className="text-xs text-yellow-700">
                                  In {checkupStatus.daysUntil} day
                                  {checkupStatus.daysUntil === 1 ? "" : "s"}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">No schedule</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              statusStyles[pregnancy.status || "active"] ||
                              statusStyles.active
                            }`}
                          >
                            {statusLabel(pregnancy.status || "active")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => openPregnancy(pregnancy)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Eye size={15} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {selectedPregnancy && (
        <Modal
          title="Pregnancy Monitoring"
          onClose={() => setSelectedPregnancy(null)}
          large
        >
          {loadingDetails ? (
            <div className="py-12 text-center text-gray-500">
              Loading pregnancy details...
            </div>
          ) : (
            <div className="space-y-6">
              {/* WOMAN INFORMATION */}
              <section className="rounded-xl border bg-gray-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound size={19} className="text-pink-600" />

                  <h3 className="font-semibold text-gray-800">
                    Pregnancy Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InfoItem
                    label="Pregnant Woman"
                    value={fullName(selectedPregnancy.resident)}
                  />

                  <InfoItem
                    label="Family Record No."
                    value={selectedPregnancy.family_record_no || "—"}
                  />

                  <InfoItem
                    label="Registration Date"
                    value={formatDate(selectedPregnancy.date_of_registration)}
                  />

                  <InfoItem
                    label="Gravida"
                    value={selectedPregnancy.gravida ?? "—"}
                  />

                  <InfoItem
                    label="Para"
                    value={selectedPregnancy.para ?? "—"}
                  />

                  <InfoItem
                    label="LMP"
                    value={formatDate(selectedPregnancy.lmp)}
                  />

                  <InfoItem
                    label="EDC"
                    value={formatDate(selectedPregnancy.edc)}
                  />

                  <InfoItem
                    label="Blood Type"
                    value={selectedPregnancy.blood_type || "—"}
                  />

                  <InfoItem
                    label="PhilHealth No."
                    value={selectedPregnancy.philhealth_no || "—"}
                  />

                  <InfoItem
                    label="Household"
                    value={
                      selectedPregnancy.resident?.households?.household_code ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Barangay"
                    value={
                      selectedPregnancy.resident?.households?.local_areas
                        ?.barangays?.name || "—"
                    }
                  />

                  <InfoItem
                    label="Local Area"
                    value={
                      selectedPregnancy.resident?.households?.local_areas
                        ?.name || "—"
                    }
                  />
                </div>
              </section>
              {(() => {
                const checkupStatus = getCheckupStatus(
                  selectedPregnancy.next_visit_date,
                  selectedPregnancy.status,
                );

                if (checkupStatus.key !== "missed") {
                  return null;
                }

                return (
                  <section className="rounded-xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <AlertTriangle size={20} />
                      </div>

                      <div>
                        <h3 className="font-semibold text-red-800">
                          Missed ANC Check-up
                        </h3>

                        <p className="mt-1 text-sm text-red-700">
                          This pregnant woman missed her scheduled ANC
                          follow-up.
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <InfoItem
                            label="Scheduled Date"
                            value={formatDate(
                              selectedPregnancy.next_visit_date,
                            )}
                          />

                          <InfoItem
                            label="Days Overdue"
                            value={`${checkupStatus.daysOverdue} day${
                              checkupStatus.daysOverdue === 1 ? "" : "s"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })()}
              {/* STATUS */}
              <section className="rounded-xl border bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={19} className="text-blue-600" />

                    <h3 className="font-semibold text-gray-800">
                      Pregnancy Status
                    </h3>
                  </div>

                  <button
                    onClick={() => setOutcomeModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Edit size={14} />
                    Update Outcome
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => updateStatus(value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        selectedPregnancy.status === value
                          ? statusStyles[value]
                          : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* HOME VISITS */}
              <section className="rounded-xl border bg-white">
                <div className="flex items-center justify-between border-b p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin size={19} className="text-green-600" />

                      <h3 className="font-semibold text-gray-800">
                        BHW Home Visits
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      Community monitoring recorded by the BHW.
                    </p>
                  </div>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {homeVisits.length} visits
                  </span>
                </div>

                <div className="overflow-x-auto">
                  {homeVisits.length === 0 ? (
                    <p className="p-5 text-sm text-gray-500">
                      No home visits recorded yet.
                    </p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-5 py-3">Visit</th>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Trimester</th>
                          <th className="px-5 py-3">Findings</th>
                          <th className="px-5 py-3">Danger Signs</th>
                          <th className="px-5 py-3">Action Taken</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {homeVisits.map((visit) => (
                          <tr key={visit.id}>
                            <td className="px-5 py-3 font-semibold">
                              #{visit.visit_number}
                            </td>

                            <td className="px-5 py-3">
                              {formatDate(visit.visit_date)}
                            </td>

                            <td className="px-5 py-3">
                              {visit.trimester || "—"}
                            </td>

                            <td className="max-w-xs px-5 py-3">
                              {visit.findings || "—"}
                            </td>

                            <td className="max-w-xs px-5 py-3">
                              {visit.danger_signs || "None"}
                            </td>

                            <td className="max-w-xs px-5 py-3">
                              {visit.action_taken || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* ANC */}
              <section className="rounded-xl border bg-white">
                <div className="flex items-center justify-between border-b p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stethoscope size={19} className="text-blue-600" />

                      <h3 className="font-semibold text-gray-800">
                        Antenatal Care Visits
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      Clinical ANC assessment recorded by the Midwife.
                    </p>
                    {selectedPregnancy.next_visit_date && (
                      <div className="mt-3">
                        {(() => {
                          const checkupStatus = getCheckupStatus(
                            selectedPregnancy.next_visit_date,
                            selectedPregnancy.status,
                          );

                          return (
                            <div
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${checkupStatus.className}`}
                            >
                              <CalendarDays size={14} />
                              Next scheduled check-up:{" "}
                              {formatDate(selectedPregnancy.next_visit_date)}
                              {checkupStatus.key === "missed" &&
                                ` — ${checkupStatus.daysOverdue} day${
                                  checkupStatus.daysOverdue === 1 ? "" : "s"
                                } overdue`}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={openAddAnc}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={15} />
                    Add ANC Visit
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {ancVisits.length === 0 ? (
                    <p className="p-5 text-sm text-gray-500">
                      No ANC visits recorded yet.
                    </p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-5 py-3">Visit</th>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Gestational Age</th>
                          <th className="px-5 py-3">BP</th>
                          <th className="px-5 py-3">Weight</th>
                          <th className="px-5 py-3">Assessment</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {ancVisits.map((visit) => (
                          <tr key={visit.id}>
                            <td className="px-5 py-3 font-semibold">
                              ANC #{visit.visit_number}
                            </td>

                            <td className="px-5 py-3">
                              {formatDate(visit.visit_date)}
                            </td>

                            <td className="px-5 py-3">
                              {visit.gestational_age_weeks
                                ? `${visit.gestational_age_weeks} weeks`
                                : "—"}
                            </td>

                            <td className="px-5 py-3">
                              {visit.systolic_bp || visit.diastolic_bp
                                ? `${visit.systolic_bp || "—"}/${visit.diastolic_bp || "—"}`
                                : "—"}
                            </td>

                            <td className="px-5 py-3">
                              {visit.weight_kg ? `${visit.weight_kg} kg` : "—"}
                            </td>

                            <td className="max-w-xs px-5 py-3">
                              {visit.overall_assessment || "—"}
                            </td>

                            <td className="px-5 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openEditAnc(visit)}
                                  className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                                  title="Edit"
                                >
                                  <Edit size={15} />
                                </button>

                                <button
                                  onClick={() => deleteAnc(visit)}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* REFERRALS */}
              <section className="rounded-xl border bg-white">
                <div className="flex items-center justify-between border-b p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={19} className="text-red-600" />

                      <h3 className="font-semibold text-gray-800">
                        Pregnancy Referrals
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      Referrals and notifications submitted for this pregnancy.
                    </p>
                  </div>

                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    {referrals.length} referrals
                  </span>
                </div>

                <div className="divide-y">
                  {referrals.length === 0 ? (
                    <p className="p-5 text-sm text-gray-500">
                      No referrals recorded.
                    </p>
                  ) : (
                    referrals.map((referral) => (
                      <div
                        key={referral.id}
                        className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-800">
                              {referral.reason}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                referral.urgency === "emergency"
                                  ? "bg-red-100 text-red-700"
                                  : referral.urgency === "urgent"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {referral.urgency}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                              {referral.status}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-gray-500">
                            Referred: {formatDate(referral.referral_date)}
                          </p>

                          {referral.notes && (
                            <p className="mt-2 text-sm text-gray-600">
                              {referral.notes}
                            </p>
                          )}

                          {referral.midwife_notes && (
                            <p className="mt-2 text-sm text-blue-700">
                              <strong>Midwife Notes:</strong>{" "}
                              {referral.midwife_notes}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => openReferral(referral)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <ClipboardList size={15} />
                          Review
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </Modal>
      )}

      {/* =====================================================
          ANC MODAL
      ===================================================== */}

      {ancModal && (
        <Modal
          title={
            editingAnc
              ? `Edit ANC Visit #${editingAnc.visit_number}`
              : "Add ANC Visit"
          }
          onClose={() => setAncModal(false)}
          large
        >
          <form onSubmit={saveAnc} className="space-y-6">
            {/* BASIC VISIT */}
            <FormSection title="ANC Visit Information" icon={CalendarDays}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormInput
                  label="Visit Number"
                  type="number"
                  value={ancForm.visit_number}
                  onChange={(value) => handleAncChange("visit_number", value)}
                  required
                />

                <FormInput
                  label="Visit Date"
                  type="date"
                  value={ancForm.visit_date}
                  onChange={(value) => handleAncChange("visit_date", value)}
                  required
                />

                <FormInput
                  label="Gestational Age (weeks)"
                  type="number"
                  value={ancForm.gestational_age_weeks}
                  onChange={(value) =>
                    handleAncChange("gestational_age_weeks", value)
                  }
                />
              </div>
            </FormSection>

            {/* VITAL SIGNS */}
            <FormSection title="Vital Signs" icon={Activity}>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <FormInput
                  label="Respiratory Rate"
                  type="number"
                  value={ancForm.respiratory_rate}
                  onChange={(value) =>
                    handleAncChange("respiratory_rate", value)
                  }
                />

                <FormInput
                  label="Systolic BP"
                  type="number"
                  value={ancForm.systolic_bp}
                  onChange={(value) => handleAncChange("systolic_bp", value)}
                />

                <FormInput
                  label="Diastolic BP"
                  type="number"
                  value={ancForm.diastolic_bp}
                  onChange={(value) => handleAncChange("diastolic_bp", value)}
                />

                <FormInput
                  label="Pulse Rate"
                  type="number"
                  value={ancForm.pulse_rate}
                  onChange={(value) => handleAncChange("pulse_rate", value)}
                />

                <FormInput
                  label="Temperature"
                  type="number"
                  step="0.1"
                  value={ancForm.temperature}
                  onChange={(value) => handleAncChange("temperature", value)}
                />

                <FormInput
                  label="Fundal Height (cm)"
                  type="number"
                  step="0.1"
                  value={ancForm.fundal_height_cm}
                  onChange={(value) =>
                    handleAncChange("fundal_height_cm", value)
                  }
                />

                <FormInput
                  label="Weight (kg)"
                  type="number"
                  step="0.1"
                  value={ancForm.weight_kg}
                  onChange={(value) => handleAncChange("weight_kg", value)}
                />

                <FormInput
                  label="Fetal Heart Rate"
                  type="number"
                  value={ancForm.fetal_heart_rate}
                  onChange={(value) =>
                    handleAncChange("fetal_heart_rate", value)
                  }
                />

                <FormInput
                  label="Hemoglobin"
                  type="number"
                  step="0.1"
                  value={ancForm.hemoglobin}
                  onChange={(value) => handleAncChange("hemoglobin", value)}
                />

                <FormInput
                  label="Urine Protein"
                  value={ancForm.urine_protein}
                  onChange={(value) => handleAncChange("urine_protein", value)}
                />
              </div>

              <div className="mt-4">
                <CheckboxField
                  label="Edema"
                  checked={ancForm.edema}
                  onChange={(value) => handleAncChange("edema", value)}
                />
              </div>
            </FormSection>

            {/* DANGER SIGNS */}
            <FormSection
              title="Danger Signs / Clinical Findings"
              icon={AlertTriangle}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  "vaginal_bleeding",
                  "severe_headache",
                  "blurred_vision",
                  "severe_abdominal_pain",
                  "fetal_movement",
                  "no_fetal_movement",
                  "ruptured_membranes",
                  "fever_or_burning_urination",
                  "vaginal_discharge",
                  "coughing_or_breathing_difficulty",
                  "preeclampsia_check",
                ].map((field) => (
                  <CheckboxField
                    key={field}
                    label={booleanLabels[field]}
                    checked={ancForm[field]}
                    onChange={(value) => handleAncChange(field, value)}
                  />
                ))}
              </div>
            </FormSection>

            {/* PREGNANCY ASSESSMENT */}
            <FormSection title="Pregnancy Assessment" icon={Baby}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormInput
                  label="Presentation"
                  value={ancForm.presentation}
                  onChange={(value) => handleAncChange("presentation", value)}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  "multiple_pregnancy",
                  "transverse_or_breech",
                  "family_planning_counseled",
                ].map((field) => (
                  <CheckboxField
                    key={field}
                    label={booleanLabels[field]}
                    checked={ancForm[field]}
                    onChange={(value) => handleAncChange(field, value)}
                  />
                ))}
              </div>
            </FormSection>

            {/* ANEMIA / SOCIAL / INFECTION */}
            <FormSection
              title="Anemia, Infection and Social Assessment"
              icon={HeartPulse}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  "anemia_tiredness",
                  "anemia_shortness_of_breath",
                  "anemia_pallor",
                  "taking_anti_tb_drugs",
                  "smoking_alcohol_drug_use",
                  "history_of_violence",
                  "signs_of_sti_hiv",
                ].map((field) => (
                  <CheckboxField
                    key={field}
                    label={booleanLabels[field]}
                    checked={ancForm[field]}
                    onChange={(value) => handleAncChange(field, value)}
                  />
                ))}
              </div>
            </FormSection>

            {/* COUNSELING */}
            <FormSection title="Counseling and Services" icon={ClipboardList}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  "hiv_counseling",
                  "infant_feeding_counseling",
                  "tetanus_toxoid",
                  "iron_folate_given",
                  "oral_care_done",
                ].map((field) => (
                  <CheckboxField
                    key={field}
                    label={booleanLabels[field]}
                    checked={ancForm[field]}
                    onChange={(value) => handleAncChange(field, value)}
                  />
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormInput
                  label="HIV Test Result"
                  value={ancForm.hiv_test_result}
                  onChange={(value) =>
                    handleAncChange("hiv_test_result", value)
                  }
                />

                <FormInput
                  label="Birth Plan"
                  value={ancForm.birth_plan}
                  onChange={(value) => handleAncChange("birth_plan", value)}
                />
              </div>
            </FormSection>

            {/* NOTES */}
            <FormSection
              title="Assessment, Advice and Management"
              icon={FileText}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {textAreaFields.map(([field, label]) => (
                  <FormTextArea
                    key={field}
                    label={label}
                    value={ancForm[field]}
                    onChange={(value) => handleAncChange(field, value)}
                  />
                ))}
              </div>

              <div className="mt-4">
                <FormInput
                  label="Next Visit Date"
                  type="date"
                  value={ancForm.next_visit_date}
                  onChange={(value) =>
                    handleAncChange("next_visit_date", value)
                  }
                />
              </div>
            </FormSection>

            {/* BUTTONS */}
            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={() => setAncModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving
                  ? "Saving..."
                  : editingAnc
                    ? "Update ANC Visit"
                    : "Save ANC Visit"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          REFERRAL MODAL
      ===================================================== */}

      {referralModal && selectedReferral && (
        <Modal
          title="Review Pregnancy Referral"
          onClose={() => setReferralModal(false)}
        >
          <form onSubmit={saveReferralReview} className="space-y-5">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Referral Reason</p>

              <p className="mt-1 font-semibold text-gray-800">
                {selectedReferral.reason}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-4">
                <InfoItem label="Urgency" value={selectedReferral.urgency} />

                <InfoItem
                  label="Referral Date"
                  value={formatDate(selectedReferral.referral_date)}
                />
              </div>

              {selectedReferral.notes && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500">BHW Notes</p>

                  <p className="mt-1 text-sm text-gray-700">
                    {selectedReferral.notes}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Referral Status
              </label>

              <select
                value={referralStatus}
                onChange={(e) => setReferralStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="action_taken">Action Taken</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Midwife Notes
              </label>

              <textarea
                rows={5}
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                placeholder="Enter assessment, action taken, or follow-up notes..."
              />
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setReferralModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Review"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          OUTCOME MODAL
      ===================================================== */}

      {outcomeModal && (
        <Modal title="Pregnancy Outcome" onClose={() => setOutcomeModal(false)}>
          <form onSubmit={saveOutcome} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Pregnancy Status
              </label>

              <select
                value={outcomeForm.status}
                onChange={(e) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Pregnancy Outcome"
                value={outcomeForm.pregnancy_outcome}
                onChange={(value) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    pregnancy_outcome: value,
                  }))
                }
                placeholder="e.g. Live Birth, Miscarriage..."
              />

              <FormInput
                label="Birth Status"
                value={outcomeForm.birth_status}
                onChange={(value) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    birth_status: value,
                  }))
                }
              />

              <FormInput
                label="Date of Delivery"
                type="date"
                value={outcomeForm.date_of_delivery}
                onChange={(value) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    date_of_delivery: value,
                  }))
                }
              />

              <FormInput
                label="Place of Delivery"
                value={outcomeForm.place_of_delivery}
                onChange={(value) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    place_of_delivery: value,
                  }))
                }
              />

              <FormInput
                label="Facility Name"
                value={outcomeForm.facility_name}
                onChange={(value) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    facility_name: value,
                  }))
                }
              />

              <FormInput
                label="Attended By"
                value={outcomeForm.attended_by}
                onChange={(value) =>
                  setOutcomeForm((prev) => ({
                    ...prev,
                    attended_by: value,
                  }))
                }
              />
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setOutcomeModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Outcome"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function StatCard({ title, value, icon: Icon, iconClass }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>

          <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>

      <p className="mt-1 text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function FormSection({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border bg-gray-50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-blue-600" />

        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>

      {children}
    </section>
  );
}

function FormInput({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  step,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={step}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function FormTextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <textarea
        rows={4}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />

      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function Modal({ title, children, onClose, large = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`flex max-h-[95vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          large ? "max-w-7xl" : "max-w-2xl"
        }`}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={19} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
