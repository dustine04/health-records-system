import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Baby,
  CalendarDays,
  ClipboardList,
  Edit,
  Eye,
  HeartPulse,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
  Save,
  Stethoscope,
  Home,
  FileText,
  MapPin,
  Truck,
  CheckCircle2,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const safeText = (value) => (value == null ? "" : String(value));

function BhwPregnantMonitoring() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [pregnantWomen, setPregnantWomen] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedWoman, setSelectedWoman] = useState(null);

  const [visits, setVisits] = useState([]);
  const [homeVisits, setHomeVisits] = useState([]);

  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingHomeVisits, setLoadingHomeVisits] = useState(false);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showHomeVisitModal, setShowHomeVisitModal] = useState(false);
  const [showPregnancyInfoModal, setShowPregnancyInfoModal] = useState(false);

  const [editingVisit, setEditingVisit] = useState(null);
  const [editingHomeVisit, setEditingHomeVisit] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savingHomeVisit, setSavingHomeVisit] = useState(false);
  const [savingPregnancyInfo, setSavingPregnancyInfo] = useState(false);

  const [selectedAncVisit, setSelectedAncVisit] = useState(null);
  // =====================================================
  // ANC FORM
  // =====================================================

  const emptyForm = {
    visit_number: "",
    visit_date: "",

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
    fetal_movement: true,

    fundal_height_cm: "",
    weight_kg: "",
    edema: false,
    concerns: "",

    multiple_pregnancy: false,
    presentation: "",
    fetal_heart_rate: "",
    transverse_or_breech: false,
    family_planning_counseled: false,

    preeclampsia_check: "",
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

    tetanus_toxoid: "",
    iron_folate_given: false,
    oral_care_done: false,

    self_care_advice: false,
    nutrition_advice: false,
    routine_followup_advice: false,
    labor_danger_signs_advice: false,
    breastfeeding_advice: false,
    newborn_screening_advice: false,

    birth_emergency_plan: "",

    overall_assessment: "",
    management_advice: "",

    next_visit_date: "",
  };

  const [form, setForm] = useState(emptyForm);

  // =====================================================
  // HOME VISIT FORM
  // =====================================================

  const emptyHomeVisitForm = {
    visit_number: "",
    trimester: "",
    visit_date: "",
    findings: "",
    danger_signs: "",
    action_taken: "",
    next_visit_date: "",
  };

  const [homeVisitForm, setHomeVisitForm] = useState(emptyHomeVisitForm);

  // =====================================================
  // PREGNANCY INFORMATION FORM
  // =====================================================

  const emptyPregnancyInfoForm = {
    family_record_no: "",
    date_of_registration: "",

    gravida: "",
    para: "",
    term: "",
    preterm: "",
    abortion: "",
    living: "",

    lmp: "",
    edc: "",

    civil_status: "",
    husband_name: "",
    philhealth_no: "",
    blood_type: "",
    facility_name: "",
  };

  const [pregnancyInfoForm, setPregnancyInfoForm] = useState(
    emptyPregnancyInfoForm,
  );

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchLocalAreas();
    }
  }, []);

  // =====================================================
  // GET ASSIGNED AREAS
  // =====================================================

  const fetchLocalAreas = async () => {
    try {
      const { data, error } = await supabase
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

      if (error) throw error;

      const areas = (data || [])
        .map((item) => item.local_areas)
        .filter(Boolean);

      setLocalAreas(areas);
    } catch (error) {
      console.error(error);
      alert("Failed to load your assigned areas.");
    }
  };

  useEffect(() => {
    if (localAreas.length > 0) {
      fetchPregnantWomen();
    } else {
      setPregnantWomen([]);
      setLoading(false);
    }
  }, [localAreas]);

  // =====================================================
  // GET PREGNANT WOMEN
  // =====================================================

  const fetchPregnantWomen = async () => {
    try {
      setLoading(true);

      const areaIds = localAreas.map((area) => area.id);

      if (areaIds.length === 0) {
        setPregnantWomen([]);
        return;
      }

      const { data: households, error: householdError } = await supabase
        .from("households")
        .select("id, household_code, household_head, local_area_id")
        .in("local_area_id", areaIds);

      if (householdError) throw householdError;

      const householdIds = (households || []).map((h) => h.id);

      if (householdIds.length === 0) {
        setPregnantWomen([]);
        return;
      }

      const { data: residents, error: residentError } = await supabase
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
          civil_status,
          contact_number,
          households (
            id,
            household_code,
            household_head,
            local_area_id,
            local_areas (
              id,
              name,
              type,
              barangays (
                id,
                name
              )
            )
          )
        `,
        )
        .in("household_id", householdIds)
        .eq("sex", "Female");

      if (residentError) throw residentError;

      const residentIds = (residents || []).map((r) => r.id);

      if (residentIds.length === 0) {
        setPregnantWomen([]);
        return;
      }

      const { data: registrations, error: registrationError } = await supabase
        .from("pregnant_women")
        .select("*")
        .in("resident_id", residentIds)
        .order("created_at", { ascending: false });

      if (registrationError) throw registrationError;

      if (!registrations || registrations.length === 0) {
        setPregnantWomen([]);
        return;
      }

      const registrationMap = new Map();

      registrations.forEach((record) => {
        const residentId = Number(record.resident_id);

        if (!registrationMap.has(residentId)) {
          registrationMap.set(residentId, record);
        }
      });

      const pregnancyIds = registrations.map((record) => record.id);

      // Fetch ANC visits only for the ANC visit count.
      const { data: allVisits, error: visitsError } = await supabase
        .from("pregnant_woman_visits")
        .select("id, pregnant_woman_id, visit_number, visit_date")
        .in("pregnant_woman_id", pregnancyIds)
        .order("visit_date", { ascending: false });

      if (visitsError) throw visitsError;

      // Count recorded ANC visits for each pregnancy.
      const visitCountMap = new Map();

      (allVisits || []).forEach((visit) => {
        const pregnancyId = Number(visit.pregnant_woman_id);

        visitCountMap.set(
          pregnancyId,
          (visitCountMap.get(pregnancyId) || 0) + 1,
        );
      });

      // Fetch BHW home visits separately.
      // The next visit date must come from this table, NOT the ANC table.
      const { data: allHomeVisits, error: homeVisitsError } = await supabase
        .from("pregnant_woman_home_visits")
        .select("id, pregnant_woman_id, visit_date, next_visit_date")
        .in("pregnant_woman_id", pregnancyIds);

      if (homeVisitsError) throw homeVisitsError;

      // Get the earliest upcoming BHW home visit for each pregnancy.
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      });

      const nextHomeVisitMap = new Map();

      (allHomeVisits || [])
        .filter(
          (visit) => visit.next_visit_date && visit.next_visit_date >= today,
        )
        .sort((a, b) => a.next_visit_date.localeCompare(b.next_visit_date))
        .forEach((visit) => {
          const pregnancyId = Number(visit.pregnant_woman_id);

          if (!nextHomeVisitMap.has(pregnancyId)) {
            nextHomeVisitMap.set(pregnancyId, visit.next_visit_date);
          }
        });
      const result = (residents || [])
        .map((resident) => {
          const registration = registrationMap.get(Number(resident.id));

          if (!registration) return null;

          return {
            ...resident,
            pregnancy: registration,
            visit_count: visitCountMap.get(Number(registration.id)) || 0,

            // This is the next scheduled BHW home visit,
            // not the next ANC appointment.
            next_visit_date:
              nextHomeVisitMap.get(Number(registration.id)) || null,
          };
        })
        .filter(Boolean);

      setPregnantWomen(result);
    } catch (error) {
      console.error("Error loading pregnant women:", error);
      alert(error.message || "Failed to load pregnant women.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // OPEN WOMAN
  // =====================================================

  const openWoman = async (woman) => {
    setSelectedWoman(woman);
    setShowDetailsModal(true);

    await Promise.all([
      fetchVisits(woman.pregnancy.id),
      fetchHomeVisits(woman.pregnancy.id),
    ]);
  };

  // =====================================================
  // GET ANC VISITS
  // =====================================================

  const fetchVisits = async (pregnantWomanId) => {
    try {
      setLoadingVisits(true);

      const { data, error } = await supabase
        .from("pregnant_woman_visits")
        .select("*")
        .eq("pregnant_woman_id", pregnantWomanId)
        .order("visit_number", { ascending: true });

      if (error) throw error;

      setVisits(data || []);
    } catch (error) {
      console.error("Error loading ANC visits:", error);
      alert(error.message || "Failed to load ANC visits.");
    } finally {
      setLoadingVisits(false);
    }
  };

  // =====================================================
  // GET HOME VISITS
  // =====================================================

  const fetchHomeVisits = async (pregnantWomanId) => {
    try {
      setLoadingHomeVisits(true);

      const { data, error } = await supabase
        .from("pregnant_woman_home_visits")
        .select("*")
        .eq("pregnant_woman_id", pregnantWomanId)
        .order("visit_number", { ascending: true });

      if (error) throw error;

      setHomeVisits(data || []);
    } catch (error) {
      console.error("Error loading home visits:", error);
      alert(error.message || "Failed to load home visits.");
    } finally {
      setLoadingHomeVisits(false);
    }
  };

  // =====================================================
  // PREGNANCY INFORMATION
  // =====================================================

  const openPregnancyInfo = () => {
    if (!selectedWoman) return;

    const pregnancy = selectedWoman.pregnancy || {};

    setPregnancyInfoForm({
      family_record_no: safeText(pregnancy.family_record_no),
      date_of_registration: safeText(pregnancy.date_of_registration),

      gravida: pregnancy.gravida ?? "",
      para: pregnancy.para ?? "",
      term: pregnancy.term ?? "",
      preterm: pregnancy.preterm ?? "",
      abortion: pregnancy.abortion ?? "",
      living: pregnancy.living ?? "",

      lmp: safeText(pregnancy.lmp),
      edc: safeText(pregnancy.edc),

      civil_status: safeText(pregnancy.civil_status),
      husband_name: safeText(pregnancy.husband_name),
      philhealth_no: safeText(pregnancy.philhealth_no),
      blood_type: safeText(pregnancy.blood_type),
      facility_name: safeText(pregnancy.facility_name),
    });

    setShowPregnancyInfoModal(true);
  };

  const handlePregnancyInfoChange = (e) => {
    const { name, value } = e.target;

    setPregnancyInfoForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const savePregnancyInfo = async (e) => {
    e.preventDefault();

    if (!selectedWoman) return;

    try {
      setSavingPregnancyInfo(true);

      const data = {
        family_record_no: pregnancyInfoForm.family_record_no.trim() || null,

        date_of_registration: pregnancyInfoForm.date_of_registration || null,

        gravida: pregnancyInfoForm.gravida
          ? Number(pregnancyInfoForm.gravida)
          : null,

        para: pregnancyInfoForm.para ? Number(pregnancyInfoForm.para) : null,

        term: pregnancyInfoForm.term ? Number(pregnancyInfoForm.term) : null,

        preterm: pregnancyInfoForm.preterm
          ? Number(pregnancyInfoForm.preterm)
          : null,

        abortion: pregnancyInfoForm.abortion
          ? Number(pregnancyInfoForm.abortion)
          : null,

        living: pregnancyInfoForm.living
          ? Number(pregnancyInfoForm.living)
          : null,

        lmp: pregnancyInfoForm.lmp || null,
        edc: pregnancyInfoForm.edc || null,

        civil_status: pregnancyInfoForm.civil_status.trim() || null,

        husband_name: pregnancyInfoForm.husband_name.trim() || null,

        philhealth_no: pregnancyInfoForm.philhealth_no.trim() || null,

        blood_type: pregnancyInfoForm.blood_type.trim() || null,

        facility_name: pregnancyInfoForm.facility_name.trim() || null,
      };

      const { data: updated, error } = await supabase
        .from("pregnant_women")
        .update(data)
        .eq("id", selectedWoman.pregnancy.id)
        .select()
        .single();

      if (error) throw error;

      const updatedWoman = {
        ...selectedWoman,
        pregnancy: updated,
      };

      setSelectedWoman(updatedWoman);

      setPregnantWomen((prev) =>
        prev.map((woman) =>
          woman.pregnancy.id === updated.id
            ? {
                ...woman,
                pregnancy: updated,
              }
            : woman,
        ),
      );

      setShowPregnancyInfoModal(false);

      alert("Pregnancy information updated successfully.");
    } catch (error) {
      console.error("Error updating pregnancy information:", error);
      alert(error.message || "Failed to update pregnancy information.");
    } finally {
      setSavingPregnancyInfo(false);
    }
  };

  // =====================================================
  // DELIVERY / PREGNANCY OUTCOME
  // =====================================================

  const openOutcomeModal = () => {
    if (!selectedWoman) return;

    const pregnancy = selectedWoman.pregnancy || {};

    setOutcomeForm({
      place_of_delivery: safeText(pregnancy.place_of_delivery),
      date_of_delivery: safeText(pregnancy.date_of_delivery),
      pregnancy_outcome: safeText(pregnancy.pregnancy_outcome),
      birth_status: safeText(pregnancy.birth_status),
      attended_by: safeText(pregnancy.attended_by),
    });

    setShowOutcomeModal(true);
  };

  const handleOutcomeChange = (e) => {
    const { name, value } = e.target;

    setOutcomeForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveOutcome = async (e) => {
    e.preventDefault();

    if (!selectedWoman) return;

    try {
      setSavingOutcome(true);

      const data = {
        place_of_delivery: outcomeForm.place_of_delivery.trim() || null,

        date_of_delivery: outcomeForm.date_of_delivery || null,

        pregnancy_outcome: outcomeForm.pregnancy_outcome.trim() || null,

        birth_status: outcomeForm.birth_status.trim() || null,

        attended_by: outcomeForm.attended_by.trim() || null,
      };

      const { data: updated, error } = await supabase
        .from("pregnant_women")
        .update(data)
        .eq("id", selectedWoman.pregnancy.id)
        .select()
        .single();

      if (error) throw error;

      setSelectedWoman((prev) => ({
        ...prev,
        pregnancy: updated,
      }));

      setPregnantWomen((prev) =>
        prev.map((woman) =>
          woman.pregnancy.id === updated.id
            ? {
                ...woman,
                pregnancy: updated,
              }
            : woman,
        ),
      );

      setShowOutcomeModal(false);

      alert("Pregnancy outcome updated successfully.");
    } catch (error) {
      console.error("Error updating pregnancy outcome:", error);
      alert(error.message || "Failed to update pregnancy outcome.");
    } finally {
      setSavingOutcome(false);
    }
  };

  // =====================================================
  // ADD ANC VISIT
  // =====================================================

  const openAddVisit = () => {
    const usedVisits = visits.map((visit) => Number(visit.visit_number));

    let nextVisit = "";

    for (let i = 1; i <= 8; i++) {
      if (!usedVisits.includes(i)) {
        nextVisit = String(i);
        break;
      }
    }

    if (!nextVisit) {
      alert("All 8 ANC visits have already been recorded.");
      return;
    }

    setEditingVisit(null);

    setForm({
      ...emptyForm,
      visit_number: nextVisit,
      visit_date: new Date().toISOString().split("T")[0],
    });

    setShowVisitModal(true);
  };

  // =====================================================
  // EDIT ANC VISIT
  // =====================================================

  const openEditVisit = (visit) => {
    setEditingVisit(visit);

    setForm({
      ...emptyForm,

      ...visit,

      visit_number: safeText(visit.visit_number),
      visit_date: safeText(visit.visit_date),

      emergency_signs: safeText(visit.emergency_signs),
      birth_plan: safeText(visit.birth_plan),
      concerns: safeText(visit.concerns),
      presentation: safeText(visit.presentation),
      preeclampsia_check: safeText(visit.preeclampsia_check),
      urine_protein: safeText(visit.urine_protein),

      current_medical_condition: safeText(visit.current_medical_condition),

      physical_exam_findings: safeText(visit.physical_exam_findings),

      other_laboratory_findings: safeText(visit.other_laboratory_findings),

      other_problems: safeText(visit.other_problems),

      hiv_test_result: safeText(visit.hiv_test_result),
      tetanus_toxoid: safeText(visit.tetanus_toxoid),

      birth_emergency_plan: safeText(visit.birth_emergency_plan),

      overall_assessment: safeText(visit.overall_assessment),

      management_advice: safeText(visit.management_advice),

      next_visit_date: safeText(visit.next_visit_date),

      respiratory_rate: visit.respiratory_rate ?? "",
      systolic_bp: visit.systolic_bp ?? "",
      diastolic_bp: visit.diastolic_bp ?? "",
      pulse_rate: visit.pulse_rate ?? "",
      temperature: visit.temperature ?? "",

      gestational_age_weeks: visit.gestational_age_weeks ?? "",

      fundal_height_cm: visit.fundal_height_cm ?? "",

      weight_kg: visit.weight_kg ?? "",

      fetal_heart_rate: visit.fetal_heart_rate ?? "",

      hemoglobin: visit.hemoglobin ?? "",

      vaginal_bleeding: !!visit.vaginal_bleeding,
      severe_headache: !!visit.severe_headache,
      blurred_vision: !!visit.blurred_vision,
      severe_abdominal_pain: !!visit.severe_abdominal_pain,

      fetal_movement:
        visit.fetal_movement == null ? true : !!visit.fetal_movement,

      edema: !!visit.edema,

      multiple_pregnancy: !!visit.multiple_pregnancy,

      transverse_or_breech: !!visit.transverse_or_breech,

      family_planning_counseled: !!visit.family_planning_counseled,

      anemia_tiredness: !!visit.anemia_tiredness,

      anemia_shortness_of_breath: !!visit.anemia_shortness_of_breath,

      anemia_pallor: !!visit.anemia_pallor,

      no_fetal_movement: !!visit.no_fetal_movement,

      ruptured_membranes: !!visit.ruptured_membranes,

      fever_or_burning_urination: !!visit.fever_or_burning_urination,

      vaginal_discharge: !!visit.vaginal_discharge,

      coughing_or_breathing_difficulty:
        !!visit.coughing_or_breathing_difficulty,

      taking_anti_tb_drugs: !!visit.taking_anti_tb_drugs,

      smoking_alcohol_drug_use: !!visit.smoking_alcohol_drug_use,

      history_of_violence: !!visit.history_of_violence,

      signs_of_sti_hiv: !!visit.signs_of_sti_hiv,

      hiv_counseling: !!visit.hiv_counseling,

      infant_feeding_counseling: !!visit.infant_feeding_counseling,

      iron_folate_given: !!visit.iron_folate_given,

      oral_care_done: !!visit.oral_care_done,

      self_care_advice: !!visit.self_care_advice,

      nutrition_advice: !!visit.nutrition_advice,

      routine_followup_advice: !!visit.routine_followup_advice,

      labor_danger_signs_advice: !!visit.labor_danger_signs_advice,

      breastfeeding_advice: !!visit.breastfeeding_advice,

      newborn_screening_advice: !!visit.newborn_screening_advice,
    });

    setShowVisitModal(true);
  };

  // =====================================================
  // ANC FORM CHANGE
  // =====================================================

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // =====================================================
  // SAVE ANC VISIT
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedWoman) return;

    if (!form.visit_number) {
      alert("Please select an ANC visit number.");
      return;
    }

    if (!form.visit_date) {
      alert("Please enter the visit date.");
      return;
    }

    try {
      setSaving(true);

      const visitData = {
        pregnant_woman_id: Number(selectedWoman.pregnancy.id),

        visit_number: Number(form.visit_number),

        visit_date: form.visit_date,

        emergency_signs: form.emergency_signs.trim() || null,

        respiratory_rate: form.respiratory_rate
          ? Number(form.respiratory_rate)
          : null,

        systolic_bp: form.systolic_bp ? Number(form.systolic_bp) : null,

        diastolic_bp: form.diastolic_bp ? Number(form.diastolic_bp) : null,

        pulse_rate: form.pulse_rate ? Number(form.pulse_rate) : null,

        temperature: form.temperature ? Number(form.temperature) : null,

        gestational_age_weeks: form.gestational_age_weeks
          ? Number(form.gestational_age_weeks)
          : null,

        birth_plan: form.birth_plan.trim() || null,

        vaginal_bleeding: form.vaginal_bleeding,

        severe_headache: form.severe_headache,

        blurred_vision: form.blurred_vision,

        severe_abdominal_pain: form.severe_abdominal_pain,

        fetal_movement: form.fetal_movement,

        fundal_height_cm: form.fundal_height_cm
          ? Number(form.fundal_height_cm)
          : null,

        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,

        edema: form.edema,

        concerns: form.concerns.trim() || null,

        multiple_pregnancy: form.multiple_pregnancy,

        presentation: form.presentation.trim() || null,

        fetal_heart_rate: form.fetal_heart_rate
          ? Number(form.fetal_heart_rate)
          : null,

        transverse_or_breech: form.transverse_or_breech,

        family_planning_counseled: form.family_planning_counseled,

        preeclampsia_check: form.preeclampsia_check.trim() || null,

        urine_protein: form.urine_protein.trim() || null,

        hemoglobin: form.hemoglobin ? Number(form.hemoglobin) : null,

        anemia_tiredness: form.anemia_tiredness,

        anemia_shortness_of_breath: form.anemia_shortness_of_breath,

        anemia_pallor: form.anemia_pallor,

        no_fetal_movement: form.no_fetal_movement,

        ruptured_membranes: form.ruptured_membranes,

        fever_or_burning_urination: form.fever_or_burning_urination,

        vaginal_discharge: form.vaginal_discharge,

        coughing_or_breathing_difficulty: form.coughing_or_breathing_difficulty,

        taking_anti_tb_drugs: form.taking_anti_tb_drugs,

        smoking_alcohol_drug_use: form.smoking_alcohol_drug_use,

        history_of_violence: form.history_of_violence,

        signs_of_sti_hiv: form.signs_of_sti_hiv,

        current_medical_condition:
          form.current_medical_condition.trim() || null,

        physical_exam_findings: form.physical_exam_findings.trim() || null,

        other_laboratory_findings:
          form.other_laboratory_findings.trim() || null,

        other_problems: form.other_problems.trim() || null,

        hiv_counseling: form.hiv_counseling,

        hiv_test_result: form.hiv_test_result.trim() || null,

        infant_feeding_counseling: form.infant_feeding_counseling,

        tetanus_toxoid: form.tetanus_toxoid.trim() || null,

        iron_folate_given: form.iron_folate_given,

        oral_care_done: form.oral_care_done,

        self_care_advice: form.self_care_advice,

        nutrition_advice: form.nutrition_advice,

        routine_followup_advice: form.routine_followup_advice,

        labor_danger_signs_advice: form.labor_danger_signs_advice,

        breastfeeding_advice: form.breastfeeding_advice,

        newborn_screening_advice: form.newborn_screening_advice,

        birth_emergency_plan: form.birth_emergency_plan.trim() || null,

        overall_assessment: form.overall_assessment.trim() || null,

        management_advice: form.management_advice.trim() || null,

        next_visit_date: form.next_visit_date || null,

        assessed_by: user.id,

        updated_at: new Date().toISOString(),
      };

      if (editingVisit) {
        const { error } = await supabase
          .from("pregnant_woman_visits")
          .update(visitData)
          .eq("id", editingVisit.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("pregnant_woman_visits").insert({
          ...visitData,
          created_by: user.id,
        });

        if (error) throw error;
      }

      setShowVisitModal(false);

      await fetchVisits(selectedWoman.pregnancy.id);

      await fetchPregnantWomen();

      alert(
        editingVisit
          ? "ANC visit updated successfully."
          : "ANC visit recorded successfully.",
      );
    } catch (error) {
      console.error("Error saving ANC visit:", error);

      alert(error.message || "Failed to save ANC visit.");
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE ANC VISIT
  // =====================================================

  const handleDeleteVisit = async (visit) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ANC Visit ${visit.visit_number}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("pregnant_woman_visits")
        .delete()
        .eq("id", visit.id);

      if (error) throw error;

      await fetchVisits(selectedWoman.pregnancy.id);

      await fetchPregnantWomen();

      alert("ANC visit deleted successfully.");
    } catch (error) {
      console.error(error);

      alert(error.message || "Failed to delete ANC visit.");
    }
  };

  // =====================================================
  // HOME VISIT
  // =====================================================

  const openAddHomeVisit = () => {
    const usedVisits = homeVisits.map((visit) => Number(visit.visit_number));

    let nextVisit = "";

    for (let i = 1; i <= 4; i++) {
      if (!usedVisits.includes(i)) {
        nextVisit = String(i);
        break;
      }
    }

    if (!nextVisit) {
      alert("All 4 home visits have already been recorded.");
      return;
    }

    setEditingHomeVisit(null);

    setHomeVisitForm({
      ...emptyHomeVisitForm,
      visit_number: nextVisit,
      visit_date: new Date().toISOString().split("T")[0],
    });

    setShowHomeVisitModal(true);
  };

  const openEditHomeVisit = (visit) => {
    setEditingHomeVisit(visit);

    setHomeVisitForm({
      visit_number: safeText(visit.visit_number),
      trimester: safeText(visit.trimester),
      visit_date: safeText(visit.visit_date),
      findings: safeText(visit.findings),
      danger_signs: safeText(visit.danger_signs),
      action_taken: safeText(visit.action_taken),
      next_visit_date: safeText(visit.next_visit_date),
    });

    setShowHomeVisitModal(true);
  };

  const handleHomeVisitChange = (e) => {
    const { name, value } = e.target;

    setHomeVisitForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveHomeVisit = async (e) => {
    e.preventDefault();

    if (!selectedWoman) return;

    if (!homeVisitForm.visit_number) {
      alert("Please select a home visit number.");
      return;
    }

    if (!homeVisitForm.visit_date) {
      alert("Please enter the visit date.");
      return;
    }

    try {
      setSavingHomeVisit(true);

      const data = {
        pregnant_woman_id: Number(selectedWoman.pregnancy.id),

        visit_number: Number(homeVisitForm.visit_number),

        trimester: homeVisitForm.trimester.trim() || null,

        visit_date: homeVisitForm.visit_date,

        findings: homeVisitForm.findings.trim() || null,

        danger_signs: homeVisitForm.danger_signs.trim() || null,

        action_taken: homeVisitForm.action_taken.trim() || null,

        next_visit_date: homeVisitForm.next_visit_date || null,

        recorded_by: user.id,

        updated_at: new Date().toISOString(),
      };

      if (editingHomeVisit) {
        const { error } = await supabase
          .from("pregnant_woman_home_visits")
          .update(data)
          .eq("id", editingHomeVisit.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pregnant_woman_home_visits")
          .insert({
            ...data,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setShowHomeVisitModal(false);

      await fetchHomeVisits(selectedWoman.pregnancy.id);
      await fetchPregnantWomen();

      alert(
        editingHomeVisit
          ? "Home visit updated successfully."
          : "Home visit recorded successfully.",
      );
    } catch (error) {
      console.error("Error saving home visit:", error);

      alert(error.message || "Failed to save home visit.");
    } finally {
      setSavingHomeVisit(false);
    }
  };

  const handleDeleteHomeVisit = async (visit) => {
    const confirmed = window.confirm(
      `Delete Home Visit ${visit.visit_number}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("pregnant_woman_home_visits")
        .delete()
        .eq("id", visit.id);

      if (error) throw error;

      await fetchHomeVisits(selectedWoman.pregnancy.id);
      await fetchPregnantWomen();
      alert("Home visit deleted successfully.");
    } catch (error) {
      console.error(error);

      alert(error.message || "Failed to delete home visit.");
    }
  };

  // =====================================================
  // CLOSE MODALS
  // =====================================================

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedWoman(null);
    setVisits([]);
    setHomeVisits([]);
  };

  const closeVisitModal = () => {
    if (saving) return;

    setShowVisitModal(false);
    setEditingVisit(null);
    setForm(emptyForm);
  };

  const closeHomeVisitModal = () => {
    if (savingHomeVisit) return;

    setShowHomeVisitModal(false);
    setEditingHomeVisit(null);
    setHomeVisitForm(emptyHomeVisitForm);
  };

  // =====================================================
  // FILTER
  // =====================================================

  const filteredWomen = useMemo(() => {
    const text = search.toLowerCase().trim();

    if (!text) return pregnantWomen;

    return pregnantWomen.filter((woman) => {
      const fullName = [woman.first_name, woman.middle_name, woman.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        fullName.includes(text) ||
        woman.households?.household_code?.toLowerCase().includes(text) ||
        woman.households?.local_areas?.name?.toLowerCase().includes(text) ||
        woman.households?.local_areas?.barangays?.name
          ?.toLowerCase()
          .includes(text)
      );
    });
  }, [pregnantWomen, search]);

  const getFullName = (woman) =>
    [woman.first_name, woman.middle_name, woman.last_name]
      .filter(Boolean)
      .join(" ");

  const getVisitLabel = (number) => {
    const labels = {
      1: "1st",
      2: "2nd",
      3: "3rd",
      4: "4th",
      5: "5th",
      6: "6th",
      7: "7th",
      8: "8th",
    };

    return labels[number] || `${number}th`;
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Pregnancy Monitoring
          </h2>

          <p className="text-gray-500 mt-1">
            Monitor pregnancy registration, home visits, antenatal care, and
            pregnancy outcomes.
          </p>
        </div>

        {/* =====================================================
            ASSIGNED AREAS
        ===================================================== */}

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center">
              <HeartPulse size={20} className="text-pink-600" />
            </div>

            <div>
              <p className="text-sm text-gray-500">Assigned Purok/Sitio</p>

              <div className="flex flex-wrap gap-2 mt-1">
                {localAreas.length > 0 ? (
                  localAreas.map((area) => (
                    <span
                      key={area.id}
                      className="text-sm font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md"
                    >
                      {area.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">
                    No assigned areas
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            SEARCH
        ===================================================== */}

        <div className="relative">
          <Search
            size={19}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search pregnant women..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading pregnant women...
            </div>
          ) : filteredWomen.length === 0 ? (
            <div className="p-10 text-center">
              <Baby size={40} className="mx-auto text-gray-300" />

              <p className="text-gray-500 mt-3">No pregnant women found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Pregnant Woman
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Household
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Purok/Sitio
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      LMP
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      EDC
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      ANC
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="text-right px-6 py-4 font-semibold text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredWomen.map((woman) => {
                    const pregnancy = woman.pregnancy || {};

                    return (
                      <tr key={pregnancy.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center">
                              <UserRound size={18} className="text-pink-600" />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {getFullName(woman)}
                              </p>

                              <p className="text-xs text-gray-500">
                                {woman.contact_number || "No contact"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {woman.households?.household_code || "—"}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {woman.households?.local_areas?.name || "—"}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {pregnancy.lmp || "—"}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {pregnancy.edc || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-medium">
                            <ClipboardList size={14} />
                            {woman.visit_count || 0}/8
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={pregnancy.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <button
                              onClick={() => openWoman(woman)}
                              title="View Pregnancy Monitoring"
                              className="p-2 rounded-lg text-pink-600 hover:bg-pink-50"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =====================================================
            MAIN DETAILS MODAL
        ===================================================== */}

        {showDetailsModal && selectedWoman && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5 md:p-8">
            <div className="bg-white w-full h-full max-w-7xl mx-auto rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* HEADER */}

              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-pink-50 flex items-center justify-center">
                    <HeartPulse size={22} className="text-pink-600" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Pregnancy Monitoring
                    </h2>

                    <p className="text-sm text-gray-500">
                      {getFullName(selectedWoman)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeDetailsModal}
                  className="p-2.5 rounded-lg hover:bg-gray-100"
                >
                  <X size={22} />
                </button>
              </div>

              {/* CONTENT */}

              <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
                {/* =================================================
                      BASIC PREGNANCY INFORMATION
                  ================================================= */}

                <section className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center">
                        <FileText size={20} className="text-pink-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Pregnancy Registration
                        </h3>

                        <p className="text-sm text-gray-500">
                          Information from the pregnancy tracking form
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openPregnancyInfo}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-medium"
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <InfoItem label="Name" value={getFullName(selectedWoman)} />

                    <InfoItem
                      label="Household"
                      value={selectedWoman.households?.household_code}
                    />

                    <InfoItem
                      label="Purok/Sitio"
                      value={selectedWoman.households?.local_areas?.name}
                    />

                    <InfoItem
                      label="Barangay"
                      value={
                        selectedWoman.households?.local_areas?.barangays?.name
                      }
                    />

                    <InfoItem
                      label="Family Record No."
                      value={selectedWoman.pregnancy?.family_record_no}
                    />

                    <InfoItem
                      label="LMP"
                      value={selectedWoman.pregnancy?.lmp}
                    />

                    <InfoItem
                      label="EDC"
                      value={selectedWoman.pregnancy?.edc}
                    />

                    <InfoItem
                      label="Civil Status"
                      value={selectedWoman.pregnancy?.civil_status}
                    />

                    <InfoItem
                      label="Gravida"
                      value={selectedWoman.pregnancy?.gravida}
                    />

                    <InfoItem
                      label="Para"
                      value={selectedWoman.pregnancy?.para}
                    />

                    <InfoItem
                      label="Term"
                      value={selectedWoman.pregnancy?.term}
                    />

                    <InfoItem
                      label="Preterm"
                      value={selectedWoman.pregnancy?.preterm}
                    />

                    <InfoItem
                      label="Abortion"
                      value={selectedWoman.pregnancy?.abortion}
                    />

                    <InfoItem
                      label="Living"
                      value={selectedWoman.pregnancy?.living}
                    />

                    <InfoItem
                      label="Husband / Partner"
                      value={selectedWoman.pregnancy?.husband_name}
                    />

                    <InfoItem
                      label="PhilHealth No."
                      value={selectedWoman.pregnancy?.philhealth_no}
                    />

                    <InfoItem
                      label="Blood Type"
                      value={selectedWoman.pregnancy?.blood_type}
                    />

                    <InfoItem
                      label="Health Facility"
                      value={selectedWoman.pregnancy?.facility_name}
                    />
                  </div>
                </section>

                {/* =================================================
                      HOME VISITS
                  ================================================= */}

                <section className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                        <Home size={20} className="text-green-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Home Visits by BHW / CHT
                        </h3>

                        <p className="text-sm text-gray-500">
                          {homeVisits.length} of 4 home visits recorded
                        </p>
                      </div>
                    </div>

                    {homeVisits.length < 4 && (
                      <button
                        onClick={openAddHomeVisit}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                      >
                        <Plus size={16} />
                        Add Home Visit
                      </button>
                    )}
                  </div>

                  {loadingHomeVisits ? (
                    <div className="p-10 text-center text-gray-500">
                      Loading home visits...
                    </div>
                  ) : homeVisits.length === 0 ? (
                    <div className="p-10 text-center">
                      <Home size={42} className="mx-auto text-gray-300" />

                      <p className="text-gray-500 mt-3">
                        No home visits recorded yet.
                      </p>

                      <button
                        onClick={openAddHomeVisit}
                        className="mt-4 inline-flex items-center gap-2 text-sm text-green-600 font-medium"
                      >
                        <Plus size={16} />
                        Record First Home Visit
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-gray-200">
                          <tr>
                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Visit
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Trimester
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Date
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Next Visit Date
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Findings
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Danger Signs
                            </th>

                            <th className="text-right px-5 py-4 font-semibold text-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {homeVisits.map((visit) => (
                            <tr key={visit.id} className="hover:bg-gray-50">
                              <td className="px-5 py-4">
                                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium text-xs">
                                  Home Visit {visit.visit_number}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {visit.trimester || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {visit.visit_date || "—"}
                              </td>
                              <td className="px-5 py-4">
                                {visit.next_visit_date ? (
                                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                    <CalendarDays size={14} />

                                    {new Date(
                                      `${visit.next_visit_date}T00:00:00`,
                                    ).toLocaleDateString("en-PH", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">
                                    Not scheduled
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-gray-600 max-w-xs">
                                <p className="truncate">
                                  {visit.findings || "—"}
                                </p>
                              </td>

                              <td className="px-5 py-4 text-gray-600 max-w-xs">
                                <p className="truncate">
                                  {visit.danger_signs || "None"}
                                </p>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => openEditHomeVisit(visit)}
                                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                                    title="Edit"
                                  >
                                    <Edit size={17} />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteHomeVisit(visit)}
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* =================================================
      ANC VISITS - READ ONLY FOR BHW
  ================================================= */}

                <section className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center">
                        <CalendarDays size={20} className="text-pink-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Antenatal Care Visits
                        </h3>

                        <p className="text-sm text-gray-500">
                          Clinical ANC records entered by the Midwife
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 text-pink-700 rounded-lg text-xs font-medium">
                      <Stethoscope size={15} />
                      Midwife Record
                    </div>
                  </div>

                  {loadingVisits ? (
                    <div className="p-10 text-center text-gray-500">
                      Loading ANC visits...
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="p-10 text-center">
                      <ClipboardList
                        size={42}
                        className="mx-auto text-gray-300"
                      />

                      <p className="text-gray-500 mt-3">
                        No ANC visits recorded yet.
                      </p>

                      <p className="text-sm text-gray-400 mt-1">
                        The Midwife will record the clinical ANC assessment.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-gray-200">
                          <tr>
                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Visit
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Date
                            </th>
                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Next Visit Date
                            </th>
                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Gestational Age
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Weight
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              BP
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              FHR
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Assessment
                            </th>

                            <th className="text-right px-5 py-4 font-semibold text-gray-600">
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {visits.map((visit) => (
                            <tr key={visit.id} className="hover:bg-gray-50">
                              <td className="px-5 py-4">
                                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 font-medium text-xs">
                                  <CalendarDays size={14} />
                                  Visit {visit.visit_number}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {visit.visit_date || "—"}
                              </td>
                              <td className="px-5 py-4">
                                {visit.next_visit_date ? (
                                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                    <CalendarDays size={14} />

                                    {new Date(
                                      `${visit.next_visit_date}T00:00:00`,
                                    ).toLocaleDateString("en-PH", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">
                                    Not scheduled
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-gray-600">
                                {visit.gestational_age_weeks
                                  ? `${visit.gestational_age_weeks} weeks`
                                  : "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {visit.weight_kg
                                  ? `${visit.weight_kg} kg`
                                  : "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {visit.systolic_bp && visit.diastolic_bp
                                  ? `${visit.systolic_bp}/${visit.diastolic_bp}`
                                  : "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {visit.fetal_heart_rate
                                  ? `${visit.fetal_heart_rate} bpm`
                                  : "—"}
                              </td>

                              <td className="px-5 py-4 max-w-xs">
                                <p className="text-gray-600 truncate">
                                  {visit.overall_assessment || "No assessment"}
                                </p>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => setSelectedAncVisit(visit)}
                                    className="p-2 rounded-lg text-pink-600 hover:bg-pink-50"
                                    title="View ANC Visit"
                                  >
                                    <Eye size={17} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                <section className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-blue-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Delivery & Pregnancy Outcome
                        </h3>

                        <p className="text-sm text-gray-500">
                          Final pregnancy outcome recorded by the Midwife.
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                      <Stethoscope size={15} />
                      Midwife Record
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                    <InfoItem
                      label="Date of Delivery"
                      value={selectedWoman.pregnancy?.date_of_delivery}
                    />

                    <InfoItem
                      label="Place of Delivery"
                      value={selectedWoman.pregnancy?.place_of_delivery}
                    />

                    <InfoItem
                      label="Pregnancy Outcome"
                      value={selectedWoman.pregnancy?.pregnancy_outcome}
                    />

                    <InfoItem
                      label="Birth Status"
                      value={selectedWoman.pregnancy?.birth_status}
                    />

                    <InfoItem
                      label="Attended By"
                      value={selectedWoman.pregnancy?.attended_by}
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            PREGNANCY INFORMATION MODAL
        ===================================================== */}

        {showPregnancyInfoModal && selectedWoman && (
          <ModalShell
            title="Pregnancy Registration Information"
            subtitle={getFullName(selectedWoman)}
            onClose={() => setShowPregnancyInfoModal(false)}
          >
            <form onSubmit={savePregnancyInfo} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField
                  label="Family Record No."
                  name="family_record_no"
                  value={pregnancyInfoForm.family_record_no}
                  onChange={handlePregnancyInfoChange}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Registration
                  </label>

                  <input
                    type="date"
                    name="date_of_registration"
                    value={pregnancyInfoForm.date_of_registration}
                    onChange={handlePregnancyInfoChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LMP
                  </label>

                  <input
                    type="date"
                    name="lmp"
                    value={pregnancyInfoForm.lmp}
                    onChange={handlePregnancyInfoChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EDC / EDD
                  </label>

                  <input
                    type="date"
                    name="edc"
                    value={pregnancyInfoForm.edc}
                    onChange={handlePregnancyInfoChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <NumberField
                  label="Gravida"
                  name="gravida"
                  value={pregnancyInfoForm.gravida}
                  onChange={handlePregnancyInfoChange}
                />

                <NumberField
                  label="Para"
                  name="para"
                  value={pregnancyInfoForm.para}
                  onChange={handlePregnancyInfoChange}
                />

                <NumberField
                  label="Term"
                  name="term"
                  value={pregnancyInfoForm.term}
                  onChange={handlePregnancyInfoChange}
                />

                <NumberField
                  label="Preterm"
                  name="preterm"
                  value={pregnancyInfoForm.preterm}
                  onChange={handlePregnancyInfoChange}
                />

                <NumberField
                  label="Abortion"
                  name="abortion"
                  value={pregnancyInfoForm.abortion}
                  onChange={handlePregnancyInfoChange}
                />

                <NumberField
                  label="Living"
                  name="living"
                  value={pregnancyInfoForm.living}
                  onChange={handlePregnancyInfoChange}
                />

                <TextField
                  label="Civil Status"
                  name="civil_status"
                  value={pregnancyInfoForm.civil_status}
                  onChange={handlePregnancyInfoChange}
                />

                <TextField
                  label="Husband / Partner"
                  name="husband_name"
                  value={pregnancyInfoForm.husband_name}
                  onChange={handlePregnancyInfoChange}
                />

                <TextField
                  label="PhilHealth No."
                  name="philhealth_no"
                  value={pregnancyInfoForm.philhealth_no}
                  onChange={handlePregnancyInfoChange}
                />

                <TextField
                  label="Blood Type"
                  name="blood_type"
                  value={pregnancyInfoForm.blood_type}
                  onChange={handlePregnancyInfoChange}
                />

                <TextField
                  label="Health Facility"
                  name="facility_name"
                  value={pregnancyInfoForm.facility_name}
                  onChange={handlePregnancyInfoChange}
                />
              </div>

              <ModalButtons
                saving={savingPregnancyInfo}
                onCancel={() => setShowPregnancyInfoModal(false)}
                saveText="Save Pregnancy Information"
              />
            </form>
          </ModalShell>
        )}
        {/* =====================================================
    ANC VISIT VIEW MODAL - BHW READ ONLY
===================================================== */}

        {selectedAncVisit && (
          <ModalShell
            title={`ANC Visit ${selectedAncVisit.visit_number}`}
            subtitle={`Clinical record for ${selectedWoman ? getFullName(selectedWoman) : ""}`}
            onClose={() => setSelectedAncVisit(null)}
          >
            <div className="p-6 space-y-8">
              {/* Visit Information */}

              <section>
                <SectionTitle
                  icon={<CalendarDays size={17} />}
                  title="Visit Information"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <InfoItem
                    label="Visit Number"
                    value={`Visit ${selectedAncVisit.visit_number}`}
                  />

                  <InfoItem
                    label="Visit Date"
                    value={selectedAncVisit.visit_date}
                  />

                  <InfoItem
                    label="Gestational Age"
                    value={
                      selectedAncVisit.gestational_age_weeks
                        ? `${selectedAncVisit.gestational_age_weeks} weeks`
                        : null
                    }
                  />
                </div>
              </section>

              {/* Vital Signs */}

              <section>
                <SectionTitle
                  icon={<Activity size={17} />}
                  title="Vital Signs"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                  <InfoItem
                    label="Respiratory Rate"
                    value={
                      selectedAncVisit.respiratory_rate
                        ? `${selectedAncVisit.respiratory_rate} /min`
                        : null
                    }
                  />

                  <InfoItem
                    label="Blood Pressure"
                    value={
                      selectedAncVisit.systolic_bp &&
                      selectedAncVisit.diastolic_bp
                        ? `${selectedAncVisit.systolic_bp}/${selectedAncVisit.diastolic_bp} mmHg`
                        : null
                    }
                  />

                  <InfoItem
                    label="Pulse Rate"
                    value={
                      selectedAncVisit.pulse_rate
                        ? `${selectedAncVisit.pulse_rate} /min`
                        : null
                    }
                  />

                  <InfoItem
                    label="Temperature"
                    value={
                      selectedAncVisit.temperature
                        ? `${selectedAncVisit.temperature} °C`
                        : null
                    }
                  />

                  <InfoItem
                    label="Weight"
                    value={
                      selectedAncVisit.weight_kg
                        ? `${selectedAncVisit.weight_kg} kg`
                        : null
                    }
                  />
                </div>

                <ReadOnlyText
                  label="Emergency Signs / Quick Check"
                  value={selectedAncVisit.emergency_signs}
                />
              </section>

              {/* Antenatal Assessment */}

              <section>
                <SectionTitle
                  icon={<HeartPulse size={17} />}
                  title="Antenatal Assessment"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <InfoItem
                    label="Fundal Height"
                    value={
                      selectedAncVisit.fundal_height_cm
                        ? `${selectedAncVisit.fundal_height_cm} cm`
                        : null
                    }
                  />

                  <InfoItem
                    label="Fetal Heart Rate"
                    value={
                      selectedAncVisit.fetal_heart_rate
                        ? `${selectedAncVisit.fetal_heart_rate} bpm`
                        : null
                    }
                  />

                  <InfoItem
                    label="Presentation"
                    value={selectedAncVisit.presentation}
                  />

                  <InfoItem
                    label="Urine Protein"
                    value={selectedAncVisit.urine_protein}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                  <ReadOnlyCheck
                    label="Vaginal Bleeding"
                    value={selectedAncVisit.vaginal_bleeding}
                  />

                  <ReadOnlyCheck
                    label="Severe Headache"
                    value={selectedAncVisit.severe_headache}
                  />

                  <ReadOnlyCheck
                    label="Blurred Vision"
                    value={selectedAncVisit.blurred_vision}
                  />

                  <ReadOnlyCheck
                    label="Severe Abdominal Pain"
                    value={selectedAncVisit.severe_abdominal_pain}
                  />

                  <ReadOnlyCheck
                    label="Fetal Movement Present"
                    value={selectedAncVisit.fetal_movement}
                  />

                  <ReadOnlyCheck label="Edema" value={selectedAncVisit.edema} />

                  <ReadOnlyCheck
                    label="Multiple Pregnancy"
                    value={selectedAncVisit.multiple_pregnancy}
                  />

                  <ReadOnlyCheck
                    label="Transverse / Breech"
                    value={selectedAncVisit.transverse_or_breech}
                  />
                </div>

                <ReadOnlyText
                  label="Birth Plan"
                  value={selectedAncVisit.birth_plan}
                />

                <ReadOnlyText
                  label="Specific Concerns"
                  value={selectedAncVisit.concerns}
                />

                <ReadOnlyText
                  label="Preeclampsia Assessment"
                  value={selectedAncVisit.preeclampsia_check}
                />
              </section>

              {/* Anemia */}

              <section>
                <SectionTitle title="Anemia Assessment" />

                <InfoItem
                  label="Hemoglobin"
                  value={
                    selectedAncVisit.hemoglobin
                      ? `${selectedAncVisit.hemoglobin} g/dL`
                      : null
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <ReadOnlyCheck
                    label="Feels Tired Easily"
                    value={selectedAncVisit.anemia_tiredness}
                  />

                  <ReadOnlyCheck
                    label="Shortness of Breath"
                    value={selectedAncVisit.anemia_shortness_of_breath}
                  />

                  <ReadOnlyCheck
                    label="Pallor Observed"
                    value={selectedAncVisit.anemia_pallor}
                  />
                </div>
              </section>

              {/* Problems */}

              <section>
                <SectionTitle title="Observed / Reported Problems" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ReadOnlyCheck
                    label="No Fetal Movement"
                    value={selectedAncVisit.no_fetal_movement}
                  />

                  <ReadOnlyCheck
                    label="Ruptured Membranes"
                    value={selectedAncVisit.ruptured_membranes}
                  />

                  <ReadOnlyCheck
                    label="Fever / Burning in Urination"
                    value={selectedAncVisit.fever_or_burning_urination}
                  />

                  <ReadOnlyCheck
                    label="Vaginal Discharge"
                    value={selectedAncVisit.vaginal_discharge}
                  />

                  <ReadOnlyCheck
                    label="Cough / Difficulty Breathing"
                    value={selectedAncVisit.coughing_or_breathing_difficulty}
                  />

                  <ReadOnlyCheck
                    label="Smoking / Alcohol / Drug Use"
                    value={selectedAncVisit.smoking_alcohol_drug_use}
                  />

                  <ReadOnlyCheck
                    label="History of Violence"
                    value={selectedAncVisit.history_of_violence}
                  />

                  <ReadOnlyCheck
                    label="Signs of STI / HIV"
                    value={selectedAncVisit.signs_of_sti_hiv}
                  />
                </div>

                <ReadOnlyText
                  label="Current Medical Condition"
                  value={selectedAncVisit.current_medical_condition}
                />
              </section>

              {/* Physical / Laboratory */}

              <section>
                <SectionTitle title="Physical Examination & Laboratory" />

                <ReadOnlyText
                  label="Physical Examination Findings"
                  value={selectedAncVisit.physical_exam_findings}
                />

                <ReadOnlyText
                  label="Laboratory Findings"
                  value={selectedAncVisit.other_laboratory_findings}
                />

                <ReadOnlyText
                  label="Other Problems"
                  value={selectedAncVisit.other_problems}
                />
              </section>

              {/* Counseling */}

              <section>
                <SectionTitle title="Counseling & Preventive Measures" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ReadOnlyCheck
                    label="HIV Counseling"
                    value={selectedAncVisit.hiv_counseling}
                  />

                  <ReadOnlyCheck
                    label="Infant Feeding Counseling"
                    value={selectedAncVisit.infant_feeding_counseling}
                  />

                  <ReadOnlyCheck
                    label="Iron / Folate Given"
                    value={selectedAncVisit.iron_folate_given}
                  />

                  <ReadOnlyCheck
                    label="Oral Care Done"
                    value={selectedAncVisit.oral_care_done}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <InfoItem
                    label="HIV Test Result"
                    value={selectedAncVisit.hiv_test_result}
                  />

                  <InfoItem
                    label="Tetanus Toxoid / Td"
                    value={selectedAncVisit.tetanus_toxoid}
                  />
                </div>
              </section>

              {/* Advice */}

              <section>
                <SectionTitle title="Advice / Counseling" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <ReadOnlyCheck
                    label="Self-Care"
                    value={selectedAncVisit.self_care_advice}
                  />

                  <ReadOnlyCheck
                    label="Nutrition"
                    value={selectedAncVisit.nutrition_advice}
                  />

                  <ReadOnlyCheck
                    label="Routine Follow-Up"
                    value={selectedAncVisit.routine_followup_advice}
                  />

                  <ReadOnlyCheck
                    label="Labor / Danger Signs"
                    value={selectedAncVisit.labor_danger_signs_advice}
                  />

                  <ReadOnlyCheck
                    label="Breastfeeding"
                    value={selectedAncVisit.breastfeeding_advice}
                  />

                  <ReadOnlyCheck
                    label="Newborn Screening"
                    value={selectedAncVisit.newborn_screening_advice}
                  />
                </div>
              </section>

              {/* Assessment */}

              <section>
                <SectionTitle
                  icon={<Stethoscope size={17} />}
                  title="Clinical Assessment & Management"
                />

                <ReadOnlyText
                  label="Overall Assessment"
                  value={selectedAncVisit.overall_assessment}
                />

                <ReadOnlyText
                  label="Management / Treatment / Advice"
                  value={selectedAncVisit.management_advice}
                />

                <ReadOnlyText
                  label="Birth & Emergency Plan"
                  value={selectedAncVisit.birth_emergency_plan}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <InfoItem
                    label="Next Visit"
                    value={selectedAncVisit.next_visit_date}
                  />

                  <InfoItem
                    label="Assessed By"
                    value={
                      selectedAncVisit.assessed_by
                        ? `User ID: ${selectedAncVisit.assessed_by}`
                        : "—"
                    }
                  />
                </div>
              </section>

              {/* Notice */}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                <Stethoscope
                  size={20}
                  className="text-blue-600 shrink-0 mt-0.5"
                />

                <div>
                  <p className="font-medium text-blue-800">
                    Clinical record — read only
                  </p>

                  <p className="text-sm text-blue-700 mt-1">
                    This ANC information was recorded by the Midwife. The BHW
                    can view the record for community follow-up but cannot
                    modify the clinical assessment.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-5 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedAncVisit(null)}
                  className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </ModalShell>
        )}
        {/* =====================================================
            HOME VISIT MODAL
        ===================================================== */}

        {showHomeVisitModal && (
          <ModalShell
            title={
              editingHomeVisit
                ? `Edit Home Visit ${homeVisitForm.visit_number}`
                : `Record Home Visit ${homeVisitForm.visit_number}`
            }
            subtitle="BHW / CHT Home Visit"
            onClose={closeHomeVisitModal}
          >
            <form onSubmit={saveHomeVisit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField
                  label="Home Visit Number"
                  name="visit_number"
                  value={homeVisitForm.visit_number}
                  onChange={handleHomeVisitChange}
                  options={["1", "2", "3", "4"]}
                />

                <SelectField
                  label="Trimester"
                  name="trimester"
                  value={homeVisitForm.trimester}
                  onChange={handleHomeVisitChange}
                  options={[
                    "1st Trimester",
                    "2nd Trimester",
                    "3rd Trimester",
                    "4th / 9 Months",
                  ]}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visit Date *
                  </label>

                  <input
                    type="date"
                    name="visit_date"
                    value={homeVisitForm.visit_date}
                    onChange={handleHomeVisitChange}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <TextAreaField
                label="Findings / Home Visit Notes"
                name="findings"
                value={homeVisitForm.findings}
                onChange={handleHomeVisitChange}
                placeholder="Record observations, condition of mother, follow-up information, etc."
              />

              <TextAreaField
                label="Danger Signs"
                name="danger_signs"
                value={homeVisitForm.danger_signs}
                onChange={handleHomeVisitChange}
                placeholder="Record any danger signs observed or reported."
              />

              <TextAreaField
                label="Action Taken"
                name="action_taken"
                value={homeVisitForm.action_taken}
                onChange={handleHomeVisitChange}
                placeholder="Referral, counseling, coordination with midwife, etc."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Home Visit
                </label>

                <input
                  type="date"
                  name="next_visit_date"
                  value={homeVisitForm.next_visit_date}
                  onChange={handleHomeVisitChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <ModalButtons
                saving={savingHomeVisit}
                onCancel={closeHomeVisitModal}
                saveText={
                  editingHomeVisit ? "Update Home Visit" : "Save Home Visit"
                }
              />
            </form>
          </ModalShell>
        )}

        {/* =====================================================
            ANC VISIT FORM
        ===================================================== */}

        {showVisitModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white w-full max-w-5xl mx-auto rounded-2xl shadow-2xl my-5">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingVisit
                      ? `Edit ANC Visit ${form.visit_number}`
                      : `Record ANC Visit ${form.visit_number}`}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Detailed antenatal care assessment.
                  </p>
                </div>

                <button
                  onClick={closeVisitModal}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-8">
                {/* VISIT */}

                <section>
                  <SectionTitle
                    icon={<CalendarDays size={17} />}
                    title="Visit Information"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectField
                      label="Visit Number"
                      name="visit_number"
                      value={form.visit_number}
                      onChange={handleChange}
                      options={["1", "2", "3", "4", "5", "6", "7", "8"]}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Visit Date *
                      </label>

                      <input
                        type="date"
                        name="visit_date"
                        value={form.visit_date}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    </div>
                  </div>
                </section>

                {/* VITALS */}

                <section>
                  <SectionTitle
                    icon={<Activity size={17} />}
                    title="Vital Signs"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <NumberField
                      label="Respiratory Rate"
                      name="respiratory_rate"
                      value={form.respiratory_rate}
                      onChange={handleChange}
                      placeholder="per minute"
                    />

                    <NumberField
                      label="Systolic BP"
                      name="systolic_bp"
                      value={form.systolic_bp}
                      onChange={handleChange}
                      placeholder="mmHg"
                    />

                    <NumberField
                      label="Diastolic BP"
                      name="diastolic_bp"
                      value={form.diastolic_bp}
                      onChange={handleChange}
                      placeholder="mmHg"
                    />

                    <NumberField
                      label="Pulse Rate"
                      name="pulse_rate"
                      value={form.pulse_rate}
                      onChange={handleChange}
                      placeholder="per minute"
                    />

                    <NumberField
                      label="Temperature"
                      name="temperature"
                      value={form.temperature}
                      onChange={handleChange}
                      placeholder="°C"
                      step="0.1"
                    />
                  </div>

                  <TextAreaField
                    label="Emergency Signs / Quick Check Notes"
                    name="emergency_signs"
                    value={form.emergency_signs}
                    onChange={handleChange}
                  />
                </section>

                {/* ANTENATAL */}

                <section>
                  <SectionTitle title="Antenatal Assessment" />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <NumberField
                      label="Gestational Age (weeks)"
                      name="gestational_age_weeks"
                      value={form.gestational_age_weeks}
                      onChange={handleChange}
                    />

                    <NumberField
                      label="Fundal Height (cm)"
                      name="fundal_height_cm"
                      value={form.fundal_height_cm}
                      onChange={handleChange}
                    />

                    <NumberField
                      label="Weight (kg)"
                      name="weight_kg"
                      value={form.weight_kg}
                      onChange={handleChange}
                      step="0.1"
                    />

                    <NumberField
                      label="Fetal Heart Rate"
                      name="fetal_heart_rate"
                      value={form.fetal_heart_rate}
                      onChange={handleChange}
                      placeholder="bpm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    <CheckField
                      label="Vaginal Bleeding"
                      name="vaginal_bleeding"
                      checked={form.vaginal_bleeding}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Severe Headache"
                      name="severe_headache"
                      checked={form.severe_headache}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Blurred Vision"
                      name="blurred_vision"
                      checked={form.blurred_vision}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Severe Abdominal Pain"
                      name="severe_abdominal_pain"
                      checked={form.severe_abdominal_pain}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Fetal Movement Present"
                      name="fetal_movement"
                      checked={form.fetal_movement}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Edema"
                      name="edema"
                      checked={form.edema}
                      onChange={handleChange}
                    />
                  </div>

                  <TextAreaField
                    label="Birth Plan / Planned Place of Delivery"
                    name="birth_plan"
                    value={form.birth_plan}
                    onChange={handleChange}
                  />

                  <TextAreaField
                    label="Specific Concerns"
                    name="concerns"
                    value={form.concerns}
                    onChange={handleChange}
                  />
                </section>

                {/* THIRD TRIMESTER */}

                <section>
                  <SectionTitle title="Third Trimester Assessment" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectField
                      label="Presentation"
                      name="presentation"
                      value={form.presentation}
                      onChange={handleChange}
                      options={["Cephalic", "Breech", "Transverse", "Other"]}
                    />

                    <TextField
                      label="Preeclampsia Assessment"
                      name="preeclampsia_check"
                      value={form.preeclampsia_check}
                      onChange={handleChange}
                    />

                    <TextField
                      label="Urine Protein"
                      name="urine_protein"
                      value={form.urine_protein}
                      onChange={handleChange}
                      placeholder="Negative / + / ++ / +++"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    <CheckField
                      label="Multiple Pregnancy"
                      name="multiple_pregnancy"
                      checked={form.multiple_pregnancy}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Transverse / Breech"
                      name="transverse_or_breech"
                      checked={form.transverse_or_breech}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Family Planning Counseling"
                      name="family_planning_counseled"
                      checked={form.family_planning_counseled}
                      onChange={handleChange}
                    />
                  </div>
                </section>

                {/* ANEMIA */}

                <section>
                  <SectionTitle title="Anemia Assessment" />

                  <NumberField
                    label="Hemoglobin (g/dL)"
                    name="hemoglobin"
                    value={form.hemoglobin}
                    onChange={handleChange}
                    step="0.1"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <CheckField
                      label="Feels Tired Easily"
                      name="anemia_tiredness"
                      checked={form.anemia_tiredness}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Shortness of Breath"
                      name="anemia_shortness_of_breath"
                      checked={form.anemia_shortness_of_breath}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Pallor Observed"
                      name="anemia_pallor"
                      checked={form.anemia_pallor}
                      onChange={handleChange}
                    />
                  </div>
                </section>

                {/* PROBLEMS */}

                <section>
                  <SectionTitle title="Observed / Volunteered Problems" />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ["No Fetal Movement", "no_fetal_movement"],
                      ["Ruptured Membranes", "ruptured_membranes"],
                      [
                        "Fever / Burning in Urination",
                        "fever_or_burning_urination",
                      ],
                      ["Vaginal Discharge", "vaginal_discharge"],
                      [
                        "Cough / Difficulty Breathing",
                        "coughing_or_breathing_difficulty",
                      ],
                      ["Taking Anti-TB Drugs", "taking_anti_tb_drugs"],
                      [
                        "Smoking / Alcohol / Drug Use",
                        "smoking_alcohol_drug_use",
                      ],
                      ["History of Violence", "history_of_violence"],
                      ["Signs of STI / HIV", "signs_of_sti_hiv"],
                    ].map(([label, name]) => (
                      <CheckField
                        key={name}
                        label={label}
                        name={name}
                        checked={form[name]}
                        onChange={handleChange}
                      />
                    ))}
                  </div>

                  <TextAreaField
                    label="Current Medical Condition"
                    name="current_medical_condition"
                    value={form.current_medical_condition}
                    onChange={handleChange}
                  />
                </section>

                {/* PHYSICAL */}

                <section>
                  <SectionTitle title="Physical Examination & Laboratory" />

                  <TextAreaField
                    label="Physical Examination Findings"
                    name="physical_exam_findings"
                    value={form.physical_exam_findings}
                    onChange={handleChange}
                  />

                  <TextAreaField
                    label="Other Laboratory Findings"
                    name="other_laboratory_findings"
                    value={form.other_laboratory_findings}
                    onChange={handleChange}
                  />

                  <TextAreaField
                    label="Other Problems"
                    name="other_problems"
                    value={form.other_problems}
                    onChange={handleChange}
                  />
                </section>

                {/* COUNSELING */}

                <section>
                  <SectionTitle title="Counseling & Preventive Measures" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <CheckField
                      label="HIV Counseling Provided"
                      name="hiv_counseling"
                      checked={form.hiv_counseling}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Infant Feeding Counseling"
                      name="infant_feeding_counseling"
                      checked={form.infant_feeding_counseling}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Iron / Folate Given"
                      name="iron_folate_given"
                      checked={form.iron_folate_given}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Oral Care Done"
                      name="oral_care_done"
                      checked={form.oral_care_done}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="mt-4">
                    <TextField
                      label="HIV Test Result"
                      name="hiv_test_result"
                      value={form.hiv_test_result}
                      onChange={handleChange}
                    />

                    <TextField
                      label="Tetanus Toxoid / Td"
                      name="tetanus_toxoid"
                      value={form.tetanus_toxoid}
                      onChange={handleChange}
                      placeholder="Specify dose / date"
                    />
                  </div>
                </section>

                {/* ADVICE */}

                <section>
                  <SectionTitle title="Advice / Counseling" />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ["Self-Care", "self_care_advice"],
                      ["Nutrition", "nutrition_advice"],
                      ["Routine Follow-Up", "routine_followup_advice"],
                      ["Labor / Danger Signs", "labor_danger_signs_advice"],
                      ["Breastfeeding", "breastfeeding_advice"],
                      ["Newborn Screening", "newborn_screening_advice"],
                    ].map(([label, name]) => (
                      <CheckField
                        key={name}
                        label={label}
                        name={name}
                        checked={form[name]}
                        onChange={handleChange}
                      />
                    ))}
                  </div>
                </section>

                {/* BIRTH PLAN */}

                <section>
                  <SectionTitle title="Birth & Emergency Plan" />

                  <TextAreaField
                    label="Birth and Emergency Plan"
                    name="birth_emergency_plan"
                    value={form.birth_emergency_plan}
                    onChange={handleChange}
                    placeholder="Facility, transportation, companion, emergency contact, etc."
                  />
                </section>

                {/* ASSESSMENT */}

                <section>
                  <SectionTitle
                    icon={<Stethoscope size={17} />}
                    title="Overall Assessment & Management"
                  />

                  <TextAreaField
                    label="Overall Assessment"
                    name="overall_assessment"
                    value={form.overall_assessment}
                    onChange={handleChange}
                  />

                  <TextAreaField
                    label="Management / Treatment / Advice"
                    name="management_advice"
                    value={form.management_advice}
                    onChange={handleChange}
                  />
                </section>

                {/* FOLLOW UP */}

                <section>
                  <SectionTitle title="Follow-Up" />

                  <div className="max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Next Visit
                    </label>

                    <input
                      type="date"
                      name="next_visit_date"
                      value={form.next_visit_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </section>

                <ModalButtons
                  saving={saving}
                  onCancel={closeVisitModal}
                  saveText={
                    editingVisit ? "Update ANC Visit" : "Save ANC Visit"
                  }
                />
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>

      <p className="font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

/* =========================================================
   SECTION TITLE
========================================================= */

function SectionTitle({ icon, title }) {
  return (
    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
      {icon || <ClipboardList size={17} className="text-pink-600" />}

      {title}
    </h4>
  );
}

/* =========================================================
   MODAL SHELL
========================================================= */

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl mx-auto rounded-2xl shadow-2xl my-5 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>

            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/* =========================================================
   MODAL BUTTONS
========================================================= */

function ModalButtons({ saving, onCancel, saveText }) {
  return (
    <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium disabled:opacity-50"
      >
        <Save size={17} />

        {saving ? "Saving..." : saveText}
      </button>
    </div>
  );
}

/* =========================================================
   TEXT FIELD
========================================================= */

function TextField({ label, name, value, onChange, placeholder = "" }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <input
        type="text"
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
      />
    </div>
  );
}

/* =========================================================
   NUMBER FIELD
========================================================= */

function NumberField({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  step = "1",
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <input
        type="number"
        step={step}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
      />
    </div>
  );
}

/* =========================================================
   TEXT AREA
========================================================= */

function TextAreaField({ label, name, value, onChange, placeholder = "" }) {
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <textarea
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-pink-500"
      />
    </div>
  );
}

/* =========================================================
   SELECT FIELD
========================================================= */

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
      >
        <option value="">Select</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/* =========================================================
   CHECK FIELD
========================================================= */
function ReadOnlyText({ label, value }) {
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>

      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}
function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-50 text-green-700",
    for_review: "bg-yellow-50 text-yellow-700",
    high_risk: "bg-red-50 text-red-700",
    referred: "bg-orange-50 text-orange-700",
    delivered: "bg-blue-50 text-blue-700",
    miscarriage: "bg-gray-100 text-gray-700",
    stillbirth: "bg-gray-100 text-gray-700",
    inactive: "bg-gray-100 text-gray-500",
  };

  const labels = {
    active: "Active",
    for_review: "For Review",
    high_risk: "High Risk",
    referred: "Referred",
    delivered: "Delivered",
    miscarriage: "Miscarriage",
    stillbirth: "Stillbirth",
    inactive: "Inactive",
  };

  const currentStatus = status || "active";

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
        styles[currentStatus] || "bg-gray-100 text-gray-600"
      }`}
    >
      {labels[currentStatus] || currentStatus}
    </span>
  );
}
function ReadOnlyCheck({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="text-sm text-gray-700">{label}</span>

      {value ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
          <CheckCircle2 size={14} />
          Yes
        </span>
      ) : (
        <span className="text-xs text-gray-400">No</span>
      )}
    </div>
  );
}
function CheckField({ label, name, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100">
      <input
        type="checkbox"
        name={name}
        checked={!!checked}
        onChange={onChange}
        className="w-4 h-4 text-pink-600 rounded"
      />

      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default BhwPregnantMonitoring;
