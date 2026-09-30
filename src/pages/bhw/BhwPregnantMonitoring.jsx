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
  const [loadingVisits, setLoadingVisits] = useState(false);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);

  const [editingVisit, setEditingVisit] = useState(null);
  const [saving, setSaving] = useState(false);

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
    } else if (localAreas.length === 0) {
      setPregnantWomen([]);
      setLoading(false);
    }
  }, [localAreas]);

  // =====================================================
  // GET PREGNANT WOMEN IN ASSIGNED AREAS
  // =====================================================

  const fetchPregnantWomen = async () => {
    try {
      setLoading(true);

      const areaIds = localAreas.map((area) => area.id);

      if (areaIds.length === 0) {
        setPregnantWomen([]);
        return;
      }

      // =====================================================
      // GET HOUSEHOLDS
      // =====================================================

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

      // =====================================================
      // GET FEMALE RESIDENTS
      // =====================================================

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

      // =====================================================
      // GET PREGNANCY REGISTRATIONS
      // =====================================================

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

      // =====================================================
      // MAP REGISTRATION BY RESIDENT
      // =====================================================

      const registrationMap = new Map(
        registrations.map((record) => [Number(record.resident_id), record]),
      );

      // =====================================================
      // GET ALL ANC VISITS
      // =====================================================

      const pregnancyIds = registrations.map((record) => record.id);

      const { data: allVisits, error: visitsError } = await supabase
        .from("pregnant_woman_visits")
        .select("id, pregnant_woman_id, visit_number")
        .in("pregnant_woman_id", pregnancyIds);

      if (visitsError) throw visitsError;

      // =====================================================
      // COUNT VISITS PER PREGNANT WOMAN
      // =====================================================

      const visitCountMap = new Map();

      (allVisits || []).forEach((visit) => {
        const pregnancyId = Number(visit.pregnant_woman_id);

        visitCountMap.set(
          pregnancyId,
          (visitCountMap.get(pregnancyId) || 0) + 1,
        );
      });

      // =====================================================
      // BUILD FINAL RESULT
      // =====================================================

      const result = (residents || [])
        .map((resident) => {
          const registration = registrationMap.get(Number(resident.id));

          if (!registration) return null;

          return {
            ...resident,
            pregnancy: registration,
            visit_count: visitCountMap.get(Number(registration.id)) || 0,
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

    await fetchVisits(woman.pregnancy.id);
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
  // VISIT FORM
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

  const openEditVisit = (visit) => {
    setEditingVisit(visit);

    setForm({
      ...emptyForm,

      ...visit,

      // =====================================================
      // BASIC
      // =====================================================

      visit_number: safeText(visit.visit_number),
      visit_date: safeText(visit.visit_date),

      // =====================================================
      // TEXT FIELDS
      // =====================================================

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

      // =====================================================
      // NUMBER FIELDS
      // =====================================================

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

      // =====================================================
      // BOOLEAN FIELDS
      // =====================================================

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // =====================================================
  // SAVE VISIT
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

        fetal_movement: form.fetal_movement === "" ? null : form.fetal_movement,

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
  // DELETE VISIT
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

      alert("ANC visit deleted successfully.");
    } catch (error) {
      console.error("Error deleting ANC visit:", error);
      alert(error.message || "Failed to delete ANC visit.");
    }
  };

  // =====================================================
  // CLOSE MODALS
  // =====================================================

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedWoman(null);
    setVisits([]);
  };

  const closeVisitModal = () => {
    if (saving) return;

    setShowVisitModal(false);
    setEditingVisit(null);
    setForm(emptyForm);
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

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            ANC Monitoring
          </h2>

          <p className="text-gray-500 mt-1">
            Monitor antenatal care visits of pregnant women in your assigned
            areas.
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
                      Barangay
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      ANC Visits
                    </th>

                    <th className="text-right px-6 py-4 font-semibold text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredWomen.map((woman) => {
                    const visitCount = woman.visit_count || 0;

                    return (
                      <tr key={woman.pregnancy.id} className="hover:bg-gray-50">
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
                          {woman.households?.local_areas?.barangays?.name ||
                            "—"}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-medium">
                            <ClipboardList size={14} />
                            {visitCount}/8 visits
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <button
                              onClick={() => openWoman(woman)}
                              title="View ANC Monitoring"
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
            WOMAN DETAILS MODAL
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
                      ANC Monitoring
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
                {/* WOMAN INFORMATION */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">
                      Pregnancy Information
                    </h3>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Name</p>

                      <p className="font-medium text-gray-800">
                        {getFullName(selectedWoman)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Household</p>

                      <p className="font-medium text-gray-800">
                        {selectedWoman.households?.household_code || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Purok/Sitio</p>

                      <p className="font-medium text-gray-800">
                        {selectedWoman.households?.local_areas?.name || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Barangay</p>

                      <p className="font-medium text-gray-800">
                        {selectedWoman.households?.local_areas?.barangays
                          ?.name || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* VISITS */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
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
                          {visits.length} of 8 visits recorded
                        </p>
                      </div>
                    </div>

                    {visits.length < 8 && (
                      <button
                        onClick={openAddVisit}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium"
                      >
                        <Plus size={16} />
                        Add Visit
                      </button>
                    )}
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

                      <button
                        onClick={openAddVisit}
                        className="mt-4 inline-flex items-center gap-2 text-sm text-pink-600 font-medium"
                      >
                        <Plus size={16} />
                        Record First Visit
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
                              Date
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

                            <th className="text-right px-5 py-4 font-semibold text-gray-600">
                              Actions
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

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => openEditVisit(visit)}
                                    title="Edit Visit"
                                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                                  >
                                    <Edit size={17} />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteVisit(visit)}
                                    title="Delete Visit"
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            ANC VISIT FORM
        ===================================================== */}

        {showVisitModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white w-full max-w-5xl mx-auto rounded-2xl shadow-2xl my-5">
              {/* HEADER */}

              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingVisit
                      ? `Edit ANC Visit ${form.visit_number}`
                      : `Record ANC Visit ${form.visit_number}`}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Enter the antenatal care information for this visit.
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
                {/* =================================================
                    VISIT INFORMATION
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CalendarDays size={17} className="text-pink-600" />
                    Visit Information
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Visit Number *
                      </label>

                      <select
                        name="visit_number"
                        value={form.visit_number}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                        required
                      >
                        <option value="">Select Visit</option>
                        <option value="1">1st Visit</option>
                        <option value="2">2nd Visit</option>
                        <option value="3">3rd Visit</option>
                        <option value="4">4th Visit</option>
                        <option value="5">5th Visit</option>
                        <option value="6">6th Visit</option>
                        <option value="7">7th Visit</option>
                        <option value="8">8th Visit</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Visit Date *
                      </label>

                      <input
                        type="date"
                        name="visit_date"
                        value={form.visit_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                        required
                      />
                    </div>
                  </div>
                </section>

                {/* =================================================
                    QUICK CHECK / VITAL SIGNS
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Activity size={17} className="text-pink-600" />
                    Quick Check / Vital Signs
                  </h4>

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
                    placeholder="Record any emergency signs or observations..."
                  />
                </section>

                {/* =================================================
                    ALL VISITS
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    All Visits — Antenatal Assessment
                  </h4>

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

                  <TextAreaField
                    label="Birth Plan / Planned Place of Delivery"
                    name="birth_plan"
                    value={form.birth_plan}
                    onChange={handleChange}
                  />

                  <TextAreaField
                    label="Concerns / Specific Concerns"
                    name="concerns"
                    value={form.concerns}
                    onChange={handleChange}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
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
                </section>

                {/* =================================================
                    THIRD TRIMESTER
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Third Trimester Assessment
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectField
                      label="Presentation"
                      name="presentation"
                      value={form.presentation}
                      onChange={handleChange}
                      options={[
                        "",
                        "Cephalic",
                        "Breech",
                        "Transverse",
                        "Other",
                      ]}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
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

                {/* =================================================
                    ANEMIA
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Anemia Assessment
                  </h4>

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

                {/* =================================================
                    OTHER PROBLEMS
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Observed / Volunteered Problems
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <CheckField
                      label="No Fetal Movement"
                      name="no_fetal_movement"
                      checked={form.no_fetal_movement}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Ruptured Membranes"
                      name="ruptured_membranes"
                      checked={form.ruptured_membranes}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Fever / Burning in Urination"
                      name="fever_or_burning_urination"
                      checked={form.fever_or_burning_urination}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Vaginal Discharge"
                      name="vaginal_discharge"
                      checked={form.vaginal_discharge}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Cough / Difficulty Breathing"
                      name="coughing_or_breathing_difficulty"
                      checked={form.coughing_or_breathing_difficulty}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Taking Anti-TB Drugs"
                      name="taking_anti_tb_drugs"
                      checked={form.taking_anti_tb_drugs}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Smoking / Alcohol / Drug Use"
                      name="smoking_alcohol_drug_use"
                      checked={form.smoking_alcohol_drug_use}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="History of Violence"
                      name="history_of_violence"
                      checked={form.history_of_violence}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Signs of STI / HIV"
                      name="signs_of_sti_hiv"
                      checked={form.signs_of_sti_hiv}
                      onChange={handleChange}
                    />
                  </div>

                  <TextAreaField
                    label="Current Medical Condition"
                    name="current_medical_condition"
                    value={form.current_medical_condition}
                    onChange={handleChange}
                    placeholder="Diabetes, hypertension, TB, asthma, cardiac condition, etc."
                  />
                </section>

                {/* =================================================
                    PHYSICAL / LABORATORY
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Physical Examination & Laboratory Findings
                  </h4>

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

                {/* =================================================
                    HIV / PREVENTIVE
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Counseling & Preventive Measures
                  </h4>

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

                {/* =================================================
                    ADVICE / COUNSELING
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Advice / Counseling
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <CheckField
                      label="Self-Care"
                      name="self_care_advice"
                      checked={form.self_care_advice}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Nutrition"
                      name="nutrition_advice"
                      checked={form.nutrition_advice}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Routine Follow-Up"
                      name="routine_followup_advice"
                      checked={form.routine_followup_advice}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Labor / Danger Signs"
                      name="labor_danger_signs_advice"
                      checked={form.labor_danger_signs_advice}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Breastfeeding"
                      name="breastfeeding_advice"
                      checked={form.breastfeeding_advice}
                      onChange={handleChange}
                    />

                    <CheckField
                      label="Newborn Screening"
                      name="newborn_screening_advice"
                      checked={form.newborn_screening_advice}
                      onChange={handleChange}
                    />
                  </div>
                </section>

                {/* =================================================
                    BIRTH PLAN
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Birth & Emergency Plan
                  </h4>

                  <TextAreaField
                    label="Birth and Emergency Plan"
                    name="birth_emergency_plan"
                    value={form.birth_emergency_plan}
                    onChange={handleChange}
                    placeholder="Facility, transportation, companion, emergency contact, etc."
                  />
                </section>

                {/* =================================================
                    ASSESSMENT
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Stethoscope size={17} className="text-pink-600" />
                    Overall Assessment & Management
                  </h4>

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

                {/* =================================================
                    NEXT VISIT
                ================================================= */}

                <section>
                  <h4 className="text-sm font-bold text-gray-800 mb-4">
                    Follow-Up
                  </h4>

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

                {/* BUTTONS */}

                <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeVisitModal}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium disabled:opacity-50"
                  >
                    <Save size={17} />

                    {saving
                      ? "Saving..."
                      : editingVisit
                        ? "Update Visit"
                        : "Save Visit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/* =========================================================
   REUSABLE FORM COMPONENTS
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

        {options.filter(Boolean).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
