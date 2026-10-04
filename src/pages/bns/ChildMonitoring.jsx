import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Baby,
  Syringe,
  Apple,
  Pill,
  ShieldCheck,
  ClipboardList,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Search,
  Eye,
  Scale,
  CalendarDays,
  FileText,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const emptyForms = {
  newborn: {
    place_of_delivery: "",
    delivery_date: "",
    birth_weight_kg: "",

    home_visit_24hrs_date: "",
    home_visit_1week_date: "",
    home_visit_2_3weeks_date: "",
    home_visit_4_6weeks_date: "",

    family_planning_method: "",

    newborn_screening_done: false,
    newborn_screening_date: "",
    newborn_screening_result: "",

    exclusive_breastfeeding: "",

    remarks: "",
  },
  monitoring: {
    monitoring_date: "",
    weight_kg: "",
    height_cm: "",
    muac_cm: "",
  },

  immunization: {
    vaccination_date: "",
    vaccine_name: "",
    dose: "",
    facility: "",
    remarks: "",
  },

  feeding: {
    record_date: "",
    breastfeeding_status: "",
    complementary_feeding_status: "",
    feeding_notes: "",
  },

  micronutrients: {
    supplementation_date: "",
    supplement_name: "",
    dosage: "",
    status: "",
    remarks: "",
  },

  deworming: {
    deworming_date: "",
    medicine: "",
    dosage: "",
    status: "",
    remarks: "",
  },

  followup: {
    followup_date: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    referral: "",
    remarks: "",
  },
};

const sectionConfig = {
  newborn: {
    title: "Newborn Tracking",
    icon: Baby,
    table: "child_newborn_tracking",
  },

  monitoring: {
    title: "Growth Monitoring",
    icon: Activity,
    table: "child_monitoring",
  },

  immunization: {
    title: "Immunization",
    icon: Syringe,
    table: "child_immunization",
  },

  feeding: {
    title: "Breastfeeding & Complementary Feeding",
    icon: Apple,
    table: "child_feeding",
  },

  micronutrients: {
    title: "Micronutrient Supplementation",
    icon: Pill,
    table: "child_micronutrients",
  },

  deworming: {
    title: "Deworming",
    icon: ShieldCheck,
    table: "child_deworming",
  },

  followup: {
    title: "SOAP / Follow-up",
    icon: ClipboardList,
    table: "child_followups",
  },
};

function calculateAge(birthDate) {
  if (!birthDate) return "-";

  const birth = new Date(birthDate);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years > 0) {
    return `${years} yr${years > 1 ? "s" : ""} ${months} mo`;
  }

  return `${months} mo`;
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFullName(resident) {
  return [resident?.first_name, resident?.middle_name, resident?.last_name]
    .filter(Boolean)
    .join(" ");
}

export default function ChildMonitoring() {
  const [user, setUser] = useState(null);

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedChild, setSelectedChild] = useState(null);
  const [showChildModal, setShowChildModal] = useState(false);

  const [activeSection, setActiveSection] = useState("monitoring");

  const [records, setRecords] = useState({
    newborn: [],
    monitoring: [],
    immunization: [],
    feeding: [],
    micronutrients: [],
    deworming: [],
    followup: [],
  });

  const [loadingRecords, setLoadingRecords] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [form, setForm] = useState(emptyForms.monitoring);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchChildren();
    }
  }, [user]);

  async function fetchChildren() {
    try {
      setLoading(true);

      // ---------------------------------------------------------
      // 1. Get BNS assigned local areas
      // ---------------------------------------------------------
      const { data: assignments, error: assignmentError } = await supabase
        .from("worker_area_assignments")
        .select(
          `
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
          `,
        )
        .eq("worker_id", user.id)
        .eq("is_active", true);

      if (assignmentError) throw assignmentError;

      const areaIds = (assignments || [])
        .map((item) => item.local_area_id)
        .filter(Boolean);

      if (areaIds.length === 0) {
        setChildren([]);
        return;
      }

      // ---------------------------------------------------------
      // 2. Get households in assigned areas
      // ---------------------------------------------------------
      const { data: households, error: householdError } = await supabase
        .from("households")
        .select(
          `
            id,
            household_code,
            household_head,
            local_area_id
          `,
        )
        .in("local_area_id", areaIds);

      if (householdError) throw householdError;

      const householdIds = (households || []).map((h) => h.id);

      if (householdIds.length === 0) {
        setChildren([]);
        return;
      }

      // ---------------------------------------------------------
      // 3. Get residents from those households
      // ---------------------------------------------------------
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
        .in("household_id", householdIds);

      if (residentError) throw residentError;

      // ---------------------------------------------------------
      // 4. Only children below 5 years old
      // ---------------------------------------------------------
      const childResidents = (residents || []).filter((resident) => {
        if (!resident.birth_date) return false;

        const birth = new Date(resident.birth_date);
        const today = new Date();

        let age = today.getFullYear() - birth.getFullYear();

        const monthDifference = today.getMonth() - birth.getMonth();

        if (
          monthDifference < 0 ||
          (monthDifference === 0 && today.getDate() < birth.getDate())
        ) {
          age--;
        }

        return age < 5;
      });

      if (childResidents.length === 0) {
        setChildren([]);
        return;
      }

      const residentIds = childResidents.map((child) => child.id);

      // ---------------------------------------------------------
      // 5. Get child registration records
      // ---------------------------------------------------------
      const { data: registrations, error: registrationError } = await supabase
        .from("child_health_records")
        .select("*")
        .in("resident_id", residentIds);

      if (registrationError) throw registrationError;

      const registrationMap = {};

      (registrations || []).forEach((record) => {
        registrationMap[record.resident_id] = record;
      });

      // ---------------------------------------------------------
      // 6. Merge child + registration
      // ---------------------------------------------------------
      const mergedChildren = childResidents.map((child) => ({
        ...child,
        health_record: registrationMap[child.id] || null,
      }));

      // Monitoring only works for registered children.
      // We still show all children so BNS can see registration status.
      setChildren(mergedChildren);
    } catch (error) {
      console.error("Error fetching children:", error);
      alert(error.message || "Failed to load children.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchChildRecords(child) {
    if (!child?.health_record?.id) {
      return;
    }

    try {
      setLoadingRecords(true);

      const childHealthRecordId = child.health_record.id;
      // ---------------------------------------------------------
      // Newborn Tracking
      // ---------------------------------------------------------
      const newbornPromise = supabase
        .from("child_newborn_tracking")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .maybeSingle();
      // ---------------------------------------------------------
      // Growth Monitoring
      // child_monitoring.child_health_record_id references
      // child_health_records.id
      // ---------------------------------------------------------
      const monitoringPromise = supabase
        .from("child_monitoring")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .order("monitoring_date", {
          ascending: false,
        });

      // ---------------------------------------------------------
      // Immunization
      // ---------------------------------------------------------
      const immunizationPromise = supabase
        .from("child_immunization")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .order("vaccination_date", {
          ascending: false,
        });

      // ---------------------------------------------------------
      // Feeding
      // ---------------------------------------------------------
      const feedingPromise = supabase
        .from("child_feeding")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .order("record_date", {
          ascending: false,
        });

      // ---------------------------------------------------------
      // Micronutrients
      // ---------------------------------------------------------
      const micronutrientPromise = supabase
        .from("child_micronutrients")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .order("supplementation_date", {
          ascending: false,
        });

      // ---------------------------------------------------------
      // Deworming
      // ---------------------------------------------------------
      const dewormingPromise = supabase
        .from("child_deworming")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .order("deworming_date", {
          ascending: false,
        });

      // ---------------------------------------------------------
      // SOAP / Follow-up
      // ---------------------------------------------------------
      const followupPromise = supabase
        .from("child_followups")
        .select("*")
        .eq("child_health_record_id", childHealthRecordId)
        .order("followup_date", {
          ascending: false,
        });

      const [
        newbornResult,
        monitoringResult,
        immunizationResult,
        feedingResult,
        micronutrientResult,
        dewormingResult,
        followupResult,
      ] = await Promise.all([
        newbornPromise,
        monitoringPromise,
        immunizationPromise,
        feedingPromise,
        micronutrientPromise,
        dewormingPromise,
        followupPromise,
      ]);
      if (newbornResult.error) throw newbornResult.error;
      if (monitoringResult.error) throw monitoringResult.error;
      if (immunizationResult.error) throw immunizationResult.error;
      if (feedingResult.error) throw feedingResult.error;
      if (micronutrientResult.error) throw micronutrientResult.error;
      if (dewormingResult.error) throw dewormingResult.error;
      if (followupResult.error) throw followupResult.error;

      setRecords({
        newborn: newbornResult.data ? [newbornResult.data] : [],
        monitoring: monitoringResult.data || [],
        immunization: immunizationResult.data || [],
        feeding: feedingResult.data || [],
        micronutrients: micronutrientResult.data || [],
        deworming: dewormingResult.data || [],
        followup: followupResult.data || [],
      });
    } catch (error) {
      console.error("Error loading child records:", error);
      alert(error.message || "Failed to load child records.");
    } finally {
      setLoadingRecords(false);
    }
  }

  function openChild(child) {
    if (!child.health_record) {
      alert(
        "This child has not been registered yet. Please register the child first.",
      );
      return;
    }

    setSelectedChild(child);
    setActiveSection("monitoring");
    setShowChildModal(true);

    fetchChildRecords(child);
  }

  function closeChildModal() {
    setShowChildModal(false);
    setSelectedChild(null);
    setShowForm(false);
    setEditingRecord(null);
  }

  function openAddForm(section) {
    setActiveSection(section);
    setEditingRecord(null);
    setForm({
      ...emptyForms[section],
    });
    setShowForm(true);
  }

  function openEditForm(section, record) {
    setActiveSection(section);
    setEditingRecord(record);

    const newForm = {
      ...emptyForms[section],
    };

    Object.keys(newForm).forEach((field) => {
      newForm[field] =
        record[field] !== null && record[field] !== undefined
          ? record[field]
          : "";
    });

    setForm(newForm);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingRecord(null);
    setForm({
      ...emptyForms[activeSection],
    });
  }

  function handleInputChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSave() {
    if (!selectedChild?.health_record?.id) {
      alert("Child registration record not found.");
      return;
    }

    try {
      setSaving(true);

      const childHealthRecordId = selectedChild.health_record.id;

      let table = sectionConfig[activeSection].table;
      let data = {};
      // =========================================================
      // NEWBORN TRACKING
      // =========================================================
      if (activeSection === "newborn") {
        data = {
          child_health_record_id: childHealthRecordId,

          place_of_delivery: form.place_of_delivery.trim() || null,

          delivery_date: form.delivery_date || null,

          birth_weight_kg: form.birth_weight_kg
            ? Number(form.birth_weight_kg)
            : null,

          home_visit_24hrs_date: form.home_visit_24hrs_date || null,

          home_visit_1week_date: form.home_visit_1week_date || null,

          home_visit_2_3weeks_date: form.home_visit_2_3weeks_date || null,

          home_visit_4_6weeks_date: form.home_visit_4_6weeks_date || null,

          family_planning_method: form.family_planning_method.trim() || null,

          newborn_screening_done: Boolean(form.newborn_screening_done),

          newborn_screening_date: form.newborn_screening_date || null,

          newborn_screening_result:
            form.newborn_screening_result.trim() || null,

          exclusive_breastfeeding:
            form.exclusive_breastfeeding === ""
              ? null
              : form.exclusive_breastfeeding === "Yes",

          remarks: form.remarks.trim() || null,

          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }
      // =========================================================
      // GROWTH MONITORING
      // =========================================================
      if (activeSection === "monitoring") {
        if (!form.monitoring_date) {
          alert("Please enter the monitoring date.");
          return;
        }

        data = {
          child_health_record_id: childHealthRecordId,
          monitoring_date: form.monitoring_date,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          height_cm: form.height_cm ? Number(form.height_cm) : null,
          muac_cm: form.muac_cm ? Number(form.muac_cm) : null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }

      // =========================================================
      // IMMUNIZATION
      // =========================================================
      if (activeSection === "immunization") {
        if (!form.vaccination_date) {
          alert("Please enter the vaccination date.");
          return;
        }

        data = {
          child_health_record_id: childHealthRecordId,
          vaccination_date: form.vaccination_date,
          vaccine_name: form.vaccine_name.trim() || null,
          dose: form.dose.trim() || null,
          facility: form.facility.trim() || null,
          remarks: form.remarks.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }

      // =========================================================
      // FEEDING
      // =========================================================
      if (activeSection === "feeding") {
        if (!form.record_date) {
          alert("Please enter the record date.");
          return;
        }

        data = {
          child_health_record_id: childHealthRecordId,
          record_date: form.record_date,
          breastfeeding_status: form.breastfeeding_status.trim() || null,
          complementary_feeding_status:
            form.complementary_feeding_status.trim() || null,
          feeding_notes: form.feeding_notes.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }

      // =========================================================
      // MICRONUTRIENTS
      // =========================================================
      if (activeSection === "micronutrients") {
        if (!form.supplementation_date) {
          alert("Please enter the supplementation date.");
          return;
        }

        data = {
          child_health_record_id: childHealthRecordId,
          supplementation_date: form.supplementation_date,
          supplement_name: form.supplement_name.trim() || null,
          dosage: form.dosage.trim() || null,
          status: form.status.trim() || null,
          remarks: form.remarks.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }

      // =========================================================
      // DEWORMING
      // =========================================================
      if (activeSection === "deworming") {
        if (!form.deworming_date) {
          alert("Please enter the deworming date.");
          return;
        }

        data = {
          child_health_record_id: childHealthRecordId,
          deworming_date: form.deworming_date,
          medicine: form.medicine.trim() || null,
          dosage: form.dosage.trim() || null,
          status: form.status.trim() || null,
          remarks: form.remarks.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }

      // =========================================================
      // SOAP / FOLLOW-UP
      // =========================================================
      if (activeSection === "followup") {
        if (!form.followup_date) {
          alert("Please enter the follow-up date.");
          return;
        }

        data = {
          child_health_record_id: childHealthRecordId,
          followup_date: form.followup_date,
          subjective: form.subjective.trim() || null,
          objective: form.objective.trim() || null,
          assessment: form.assessment.trim() || null,
          plan: form.plan.trim() || null,
          referral: form.referral.trim() || null,
          remarks: form.remarks.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }

      let result;

      if (activeSection === "newborn") {
        if (editingRecord) {
          result = await supabase
            .from(table)
            .update(data)
            .eq("id", editingRecord.id);
        } else {
          result = await supabase.from(table).upsert(data, {
            onConflict: "child_health_record_id",
          });
        }
      } else {
        if (editingRecord) {
          result = await supabase
            .from(table)
            .update(data)
            .eq("id", editingRecord.id);
        } else {
          result = await supabase.from(table).insert(data);
        }
      }

      if (result.error) {
        throw result.error;
      }

      alert(
        editingRecord
          ? "Record updated successfully."
          : "Record added successfully.",
      );

      closeForm();

      await fetchChildRecords(selectedChild);
    } catch (error) {
      console.error("Error saving record:", error);
      alert(error.message || "Failed to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(section, record) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this record?",
    );

    if (!confirmed) return;

    try {
      const table = sectionConfig[section].table;

      const { error } = await supabase.from(table).delete().eq("id", record.id);

      if (error) throw error;

      alert("Record deleted successfully.");

      await fetchChildRecords(selectedChild);
    } catch (error) {
      console.error("Error deleting record:", error);
      alert(error.message || "Failed to delete record.");
    }
  }

  const filteredChildren = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return children;

    return children.filter((child) => {
      const name = getFullName(child).toLowerCase();

      const household = child.households?.household_code?.toLowerCase() || "";

      const barangay =
        child.households?.local_areas?.barangays?.name?.toLowerCase() || "";

      const area = child.households?.local_areas?.name?.toLowerCase() || "";

      return (
        name.includes(keyword) ||
        household.includes(keyword) ||
        barangay.includes(keyword) ||
        area.includes(keyword)
      );
    });
  }, [children, search]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        {/* =====================================================
            PAGE HEADER
        ====================================================== */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                  <Baby size={24} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    Child Monitoring
                  </h1>

                  <p className="text-sm text-gray-500">
                    Monitor registered children and their health records.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative w-full md:w-80">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search child, household..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {/* =====================================================
            CHILDREN TABLE
        ====================================================== */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-800">Registered Children</h2>

            <p className="mt-1 text-xs text-gray-500">
              Children below 5 years old within your assigned areas.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
          ) : filteredChildren.length === 0 ? (
            <div className="py-16 text-center">
              <Baby size={42} className="mx-auto mb-3 text-gray-300" />

              <p className="font-medium text-gray-500">No children found.</p>

              <p className="mt-1 text-sm text-gray-400">
                Children from your assigned areas will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">Child</th>
                    <th className="px-5 py-3">Age</th>
                    <th className="px-5 py-3">Sex</th>
                    <th className="px-5 py-3">Household</th>
                    <th className="px-5 py-3">Barangay</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredChildren.map((child) => {
                    const household = child.households;
                    const area = household?.local_areas;
                    const barangay = area?.barangays;

                    return (
                      <tr key={child.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                              <Baby size={18} />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {getFullName(child)}
                              </p>

                              <p className="text-xs text-gray-400">
                                DOB: {formatDate(child.birth_date)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {calculateAge(child.birth_date)}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {child.sex || "-"}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {household?.household_code || "-"}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {barangay?.name || "-"}
                        </td>

                        <td className="px-5 py-4">
                          {child.health_record ? (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              Registered
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                              Not Registered
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => openChild(child)}
                            disabled={!child.health_record}
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                              child.health_record
                                ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                : "cursor-not-allowed bg-gray-100 text-gray-400"
                            }`}
                          >
                            <Eye size={16} />
                            Monitor
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =======================================================
          CHILD MONITORING MODAL
      ======================================================== */}
      {showChildModal && selectedChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                  <Baby size={28} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {getFullName(selectedChild)}
                  </h2>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span>DOB: {formatDate(selectedChild.birth_date)}</span>

                    <span>Age: {calculateAge(selectedChild.birth_date)}</span>

                    <span>Sex: {selectedChild.sex || "-"}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={closeChildModal}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Sidebar */}
              <div className="w-full shrink-0 overflow-x-auto border-b border-gray-200 bg-gray-50 p-3 md:w-64 md:overflow-y-auto md:border-b-0 md:border-r">
                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Monitoring Sections
                </p>

                <div className="space-y-1">
                  {Object.entries(sectionConfig).map(([key, config]) => {
                    const Icon = config.icon;

                    const count = records[key]?.length || 0;

                    return (
                      <button
                        key={key}
                        onClick={() => setActiveSection(key)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                          activeSection === key
                            ? "bg-blue-600 font-medium text-white shadow-sm"
                            : "text-gray-600 hover:bg-white"
                        }`}
                      >
                        <Icon size={18} />

                        <span className="flex-1">{config.title}</span>

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            activeSection === key
                              ? "bg-white/20 text-white"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {loadingRecords ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                  </div>
                ) : (
                  <SectionContent
                    section={activeSection}
                    records={records[activeSection] || []}
                    onAdd={() => openAddForm(activeSection)}
                    onEdit={(record) => openEditForm(activeSection, record)}
                    onDelete={(record) => handleDelete(activeSection, record)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          ADD / EDIT RECORD MODAL
      ======================================================== */}
      {showForm && selectedChild && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {editingRecord ? "Edit" : "Add"}{" "}
                  {sectionConfig[activeSection].title}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {getFullName(selectedChild)}
                </p>
              </div>

              <button
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <RecordForm
                section={activeSection}
                form={form}
                onChange={handleInputChange}
              />

              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      Save Record
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* =============================================================
   SECTION CONTENT
============================================================= */

function SectionContent({ section, records, onAdd, onEdit, onDelete }) {
  const config = sectionConfig[section];
  const Icon = config.icon;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Icon size={22} />
          </div>

          <div>
            <h3 className="font-bold text-gray-800">{config.title}</h3>

            <p className="text-xs text-gray-500">
              {records.length} record
              {records.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={17} />
          Add Record
        </button>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <Icon size={38} className="mx-auto mb-3 text-gray-300" />

          <p className="font-medium text-gray-500">No records yet</p>

          <p className="mt-1 text-sm text-gray-400">
            Add a record using the button above.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          {section === "newborn" && (
            <NewbornTrackingTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {section === "monitoring" && (
            <MonitoringTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {section === "immunization" && (
            <ImmunizationTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {section === "feeding" && (
            <FeedingTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {section === "micronutrients" && (
            <MicronutrientTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {section === "deworming" && (
            <DewormingTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {section === "followup" && (
            <FollowupTable
              records={records}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* =============================================================
   TABLE ACTIONS
============================================================= */

function TableActions({ record, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        onClick={() => onEdit(record)}
        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
        title="Edit"
      >
        <Edit size={16} />
      </button>

      <button
        onClick={() => onDelete(record)}
        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
        title="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
function NewbornTrackingTable({ records, onEdit, onDelete }) {
  const record = records[0];

  if (!record) {
    return null;
  }

  const visits = [
    {
      label: ">24 hrs",
      date: record.home_visit_24hrs_date,
    },
    {
      label: "1st week",
      date: record.home_visit_1week_date,
    },
    {
      label: "2–3 weeks",
      date: record.home_visit_2_3weeks_date,
    },
    {
      label: "4–6 weeks",
      date: record.home_visit_4_6weeks_date,
    },
  ];

  return (
    <div className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visits.map((visit) => (
          <div
            key={visit.label}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
          >
            <p className="text-xs font-semibold uppercase text-gray-400">
              {visit.label}
            </p>

            <p className="mt-2 font-medium text-gray-800">
              {visit.date ? formatDate(visit.date) : "Not recorded"}
            </p>

            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                visit.date
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {visit.date ? "Completed" : "Pending"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Birth Weight</p>

          <p className="mt-1 font-semibold text-gray-800">
            {record.birth_weight_kg != null
              ? `${record.birth_weight_kg} kg`
              : "-"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Newborn Screening</p>

          <p className="mt-1 font-semibold text-gray-800">
            {record.newborn_screening_done ? "Completed" : "Not completed"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Exclusive Breastfeeding</p>

          <p className="mt-1 font-semibold text-gray-800">
            {record.exclusive_breastfeeding === true
              ? "Yes"
              : record.exclusive_breastfeeding === false
                ? "No"
                : "-"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Family Planning</p>

          <p className="mt-1 font-semibold text-gray-800">
            {record.family_planning_method || "-"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <TableActions record={record} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}
/* =============================================================
   GROWTH MONITORING TABLE
============================================================= */

function MonitoringTable({ records, onEdit, onDelete }) {
  return (
    <table className="w-full min-w-[650px]">
      <thead className="bg-gray-50">
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Weight</th>
          <th className="px-4 py-3">Height</th>
          <th className="px-4 py-3">MUAC</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 text-sm">
              {formatDate(record.monitoring_date)}
            </td>

            <td className="px-4 py-3 text-sm">
              {record.weight_kg != null ? `${record.weight_kg} kg` : "-"}
            </td>

            <td className="px-4 py-3 text-sm">
              {record.height_cm != null ? `${record.height_cm} cm` : "-"}
            </td>

            <td className="px-4 py-3 text-sm">
              {record.muac_cm != null ? `${record.muac_cm} cm` : "-"}
            </td>

            <td className="px-4 py-3">
              <TableActions
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =============================================================
   IMMUNIZATION TABLE
============================================================= */

function ImmunizationTable({ records, onEdit, onDelete }) {
  return (
    <table className="w-full min-w-[750px]">
      <thead className="bg-gray-50">
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Vaccine</th>
          <th className="px-4 py-3">Dose</th>
          <th className="px-4 py-3">Facility</th>
          <th className="px-4 py-3">Remarks</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 text-sm">
              {formatDate(record.vaccination_date)}
            </td>

            <td className="px-4 py-3 text-sm font-medium">
              {record.vaccine_name || "-"}
            </td>

            <td className="px-4 py-3 text-sm">{record.dose || "-"}</td>

            <td className="px-4 py-3 text-sm">{record.facility || "-"}</td>

            <td className="px-4 py-3 text-sm text-gray-500">
              {record.remarks || "-"}
            </td>

            <td className="px-4 py-3">
              <TableActions
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =============================================================
   FEEDING TABLE
============================================================= */

function FeedingTable({ records, onEdit, onDelete }) {
  return (
    <table className="w-full min-w-[800px]">
      <thead className="bg-gray-50">
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Breastfeeding</th>
          <th className="px-4 py-3">Complementary Feeding</th>
          <th className="px-4 py-3">Notes</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 text-sm">
              {formatDate(record.record_date)}
            </td>

            <td className="px-4 py-3 text-sm">
              {record.breastfeeding_status || "-"}
            </td>

            <td className="px-4 py-3 text-sm">
              {record.complementary_feeding_status || "-"}
            </td>

            <td className="px-4 py-3 text-sm text-gray-500">
              {record.feeding_notes || "-"}
            </td>

            <td className="px-4 py-3">
              <TableActions
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =============================================================
   MICRONUTRIENT TABLE
============================================================= */

function MicronutrientTable({ records, onEdit, onDelete }) {
  return (
    <table className="w-full min-w-[750px]">
      <thead className="bg-gray-50">
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Supplement</th>
          <th className="px-4 py-3">Dosage</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Remarks</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 text-sm">
              {formatDate(record.supplementation_date)}
            </td>

            <td className="px-4 py-3 text-sm font-medium">
              {record.supplement_name || "-"}
            </td>

            <td className="px-4 py-3 text-sm">{record.dosage || "-"}</td>

            <td className="px-4 py-3 text-sm">{record.status || "-"}</td>

            <td className="px-4 py-3 text-sm text-gray-500">
              {record.remarks || "-"}
            </td>

            <td className="px-4 py-3">
              <TableActions
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =============================================================
   DEWORMING TABLE
============================================================= */

function DewormingTable({ records, onEdit, onDelete }) {
  return (
    <table className="w-full min-w-[750px]">
      <thead className="bg-gray-50">
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Medicine</th>
          <th className="px-4 py-3">Dosage</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Remarks</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 text-sm">
              {formatDate(record.deworming_date)}
            </td>

            <td className="px-4 py-3 text-sm font-medium">
              {record.medicine || "-"}
            </td>

            <td className="px-4 py-3 text-sm">{record.dosage || "-"}</td>

            <td className="px-4 py-3 text-sm">{record.status || "-"}</td>

            <td className="px-4 py-3 text-sm text-gray-500">
              {record.remarks || "-"}
            </td>

            <td className="px-4 py-3">
              <TableActions
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =============================================================
   SOAP / FOLLOW-UP TABLE
============================================================= */

function FollowupTable({ records, onEdit, onDelete }) {
  return (
    <table className="w-full min-w-[1000px]">
      <thead className="bg-gray-50">
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Subjective</th>
          <th className="px-4 py-3">Objective</th>
          <th className="px-4 py-3">Assessment</th>
          <th className="px-4 py-3">Plan</th>
          <th className="px-4 py-3">Referral</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 text-sm">
              {formatDate(record.followup_date)}
            </td>

            <td className="max-w-[180px] px-4 py-3 text-sm">
              {record.subjective || "-"}
            </td>

            <td className="max-w-[180px] px-4 py-3 text-sm">
              {record.objective || "-"}
            </td>

            <td className="max-w-[180px] px-4 py-3 text-sm">
              {record.assessment || "-"}
            </td>

            <td className="max-w-[180px] px-4 py-3 text-sm">
              {record.plan || "-"}
            </td>

            <td className="max-w-[180px] px-4 py-3 text-sm">
              {record.referral || "-"}
            </td>

            <td className="px-4 py-3">
              <TableActions
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =============================================================
   RECORD FORM
============================================================= */

function RecordForm({ section, form, onChange }) {
  if (section === "newborn") {
    return (
      <div className="space-y-6">
        {/* =========================================
          DELIVERY INFORMATION
      ========================================== */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-800">
            Delivery Information
          </h3>

          <div className="grid gap-5 sm:grid-cols-2">
            <InputField
              label="Place of Delivery"
              name="place_of_delivery"
              value={form.place_of_delivery}
              onChange={onChange}
              placeholder="e.g. Ormoc District Hospital"
            />

            <InputField
              label="Date of Delivery"
              name="delivery_date"
              type="date"
              value={form.delivery_date}
              onChange={onChange}
            />

            <InputField
              label="Birth Weight (kg)"
              name="birth_weight_kg"
              type="number"
              step="0.01"
              value={form.birth_weight_kg}
              onChange={onChange}
              placeholder="e.g. 2.90"
            />
          </div>
        </div>

        {/* =========================================
          HOME VISITS
      ========================================== */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-800">
            Postpartum & Newborn Home Visits
          </h3>

          <div className="grid gap-5 sm:grid-cols-2">
            <InputField
              label=">24 Hours"
              name="home_visit_24hrs_date"
              type="date"
              value={form.home_visit_24hrs_date}
              onChange={onChange}
            />

            <InputField
              label="1st Week"
              name="home_visit_1week_date"
              type="date"
              value={form.home_visit_1week_date}
              onChange={onChange}
            />

            <InputField
              label="2–3 Weeks"
              name="home_visit_2_3weeks_date"
              type="date"
              value={form.home_visit_2_3weeks_date}
              onChange={onChange}
            />

            <InputField
              label="4–6 Weeks"
              name="home_visit_4_6weeks_date"
              type="date"
              value={form.home_visit_4_6weeks_date}
              onChange={onChange}
            />
          </div>
        </div>

        {/* =========================================
          NEWBORN SCREENING
      ========================================== */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-800">
            Newborn Screening
          </h3>

          <div className="space-y-5">
            <SelectField
              label="Newborn Screening"
              name="newborn_screening_done"
              value={form.newborn_screening_done ? "Yes" : "No"}
              onChange={(e) => {
                const value = e.target.value;

                onChange({
                  target: {
                    name: "newborn_screening_done",
                    value: value === "Yes",
                  },
                });
              }}
              options={["Yes", "No"]}
            />

            <InputField
              label="Screening Date"
              name="newborn_screening_date"
              type="date"
              value={form.newborn_screening_date}
              onChange={onChange}
            />

            <TextAreaField
              label="Screening Result / Remarks"
              name="newborn_screening_result"
              value={form.newborn_screening_result}
              onChange={onChange}
              placeholder="Enter screening result or relevant notes..."
            />
          </div>
        </div>

        {/* =========================================
          BREASTFEEDING
      ========================================== */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-800">
            Exclusive Breastfeeding
          </h3>

          <SelectField
            label="EBF"
            name="exclusive_breastfeeding"
            value={form.exclusive_breastfeeding}
            onChange={onChange}
            options={["Yes", "No"]}
          />
        </div>

        {/* =========================================
          FAMILY PLANNING
      ========================================== */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-800">
            Family Planning
          </h3>

          <InputField
            label="Family Planning Method"
            name="family_planning_method"
            value={form.family_planning_method}
            onChange={onChange}
            placeholder="e.g. None, Condom, Pills, Implant..."
          />
        </div>

        {/* =========================================
          REMARKS
      ========================================== */}
        <TextAreaField
          label="Remarks"
          name="remarks"
          value={form.remarks}
          onChange={onChange}
          placeholder="Additional notes..."
        />
      </div>
    );
  }
  if (section === "monitoring") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Monitoring Date"
          name="monitoring_date"
          type="date"
          value={form.monitoring_date}
          onChange={onChange}
          required
        />

        <InputField
          label="Weight (kg)"
          name="weight_kg"
          type="number"
          step="0.01"
          value={form.weight_kg}
          onChange={onChange}
          placeholder="e.g. 12.50"
        />

        <InputField
          label="Height (cm)"
          name="height_cm"
          type="number"
          step="0.01"
          value={form.height_cm}
          onChange={onChange}
          placeholder="e.g. 85.50"
        />

        <InputField
          label="MUAC (cm)"
          name="muac_cm"
          type="number"
          step="0.01"
          value={form.muac_cm}
          onChange={onChange}
          placeholder="e.g. 14.50"
        />
      </div>
    );
  }

  if (section === "immunization") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Vaccination Date"
          name="vaccination_date"
          type="date"
          value={form.vaccination_date}
          onChange={onChange}
          required
        />

        <InputField
          label="Vaccine Name"
          name="vaccine_name"
          value={form.vaccine_name}
          onChange={onChange}
          placeholder="e.g. BCG"
        />

        <InputField
          label="Dose"
          name="dose"
          value={form.dose}
          onChange={onChange}
          placeholder="e.g. 1st Dose"
        />

        <InputField
          label="Facility"
          name="facility"
          value={form.facility}
          onChange={onChange}
          placeholder="e.g. Barangay Health Station"
        />

        <div className="sm:col-span-2">
          <TextAreaField
            label="Remarks"
            name="remarks"
            value={form.remarks}
            onChange={onChange}
            placeholder="Additional notes..."
          />
        </div>
      </div>
    );
  }

  if (section === "feeding") {
    return (
      <div className="space-y-5">
        <InputField
          label="Record Date"
          name="record_date"
          type="date"
          value={form.record_date}
          onChange={onChange}
          required
        />

        <SelectField
          label="Breastfeeding Status"
          name="breastfeeding_status"
          value={form.breastfeeding_status}
          onChange={onChange}
          options={[
            "Exclusive breastfeeding",
            "Mixed breastfeeding and formula",
            "Breastfeeding continued",
            "Breastfeeding stopped",
            "Not breastfeeding",
            "Not applicable",
          ]}
        />

        <SelectField
          label="Complementary Feeding Status"
          name="complementary_feeding_status"
          value={form.complementary_feeding_status}
          onChange={onChange}
          options={[
            "Not yet started",
            "Started",
            "Age-appropriate",
            "Needs improvement",
            "Not applicable",
          ]}
        />

        <TextAreaField
          label="Feeding Notes"
          name="feeding_notes"
          value={form.feeding_notes}
          onChange={onChange}
          placeholder="Describe feeding practices, concerns, or observations..."
        />
      </div>
    );
  }

  if (section === "micronutrients") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Supplementation Date"
          name="supplementation_date"
          type="date"
          value={form.supplementation_date}
          onChange={onChange}
          required
        />

        <InputField
          label="Supplement Name"
          name="supplement_name"
          value={form.supplement_name}
          onChange={onChange}
          placeholder="e.g. Vitamin A"
        />

        <InputField
          label="Dosage"
          name="dosage"
          value={form.dosage}
          onChange={onChange}
          placeholder="e.g. 100,000 IU"
        />

        <SelectField
          label="Status"
          name="status"
          value={form.status}
          onChange={onChange}
          options={["Given", "Completed", "Missed", "Deferred", "Referred"]}
        />

        <div className="sm:col-span-2">
          <TextAreaField
            label="Remarks"
            name="remarks"
            value={form.remarks}
            onChange={onChange}
            placeholder="Additional notes..."
          />
        </div>
      </div>
    );
  }

  if (section === "deworming") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Deworming Date"
          name="deworming_date"
          type="date"
          value={form.deworming_date}
          onChange={onChange}
          required
        />

        <InputField
          label="Medicine"
          name="medicine"
          value={form.medicine}
          onChange={onChange}
          placeholder="e.g. Albendazole"
        />

        <InputField
          label="Dosage"
          name="dosage"
          value={form.dosage}
          onChange={onChange}
          placeholder="e.g. 400 mg"
        />

        <SelectField
          label="Status"
          name="status"
          value={form.status}
          onChange={onChange}
          options={["Given", "Completed", "Missed", "Deferred", "Referred"]}
        />

        <div className="sm:col-span-2">
          <TextAreaField
            label="Remarks"
            name="remarks"
            value={form.remarks}
            onChange={onChange}
            placeholder="Additional notes..."
          />
        </div>
      </div>
    );
  }

  if (section === "followup") {
    return (
      <div className="space-y-5">
        <InputField
          label="Follow-up Date"
          name="followup_date"
          type="date"
          value={form.followup_date}
          onChange={onChange}
          required
        />

        <TextAreaField
          label="Subjective"
          name="subjective"
          value={form.subjective}
          onChange={onChange}
          placeholder="What the child or caregiver reports..."
        />

        <TextAreaField
          label="Objective"
          name="objective"
          value={form.objective}
          onChange={onChange}
          placeholder="Observed findings, measurements, etc..."
        />

        <TextAreaField
          label="Assessment"
          name="assessment"
          value={form.assessment}
          onChange={onChange}
          placeholder="Assessment or impression..."
        />

        <TextAreaField
          label="Plan"
          name="plan"
          value={form.plan}
          onChange={onChange}
          placeholder="Recommended actions or follow-up plan..."
        />

        <TextAreaField
          label="Referral"
          name="referral"
          value={form.referral}
          onChange={onChange}
          placeholder="Referral information, if applicable..."
        />

        <TextAreaField
          label="Remarks"
          name="remarks"
          value={form.remarks}
          onChange={onChange}
          placeholder="Additional notes..."
        />
      </div>
    );
  }

  return null;
}

/* =============================================================
   INPUT COMPONENTS
============================================================= */

function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  step,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        step={step}
        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function TextAreaField({ label, name, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select...</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
