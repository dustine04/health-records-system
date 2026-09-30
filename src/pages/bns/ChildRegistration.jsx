import { useEffect, useMemo, useState } from "react";
import {
  Baby,
  UserRound,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  X,
  Save,
  Activity,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function ChildRegistration() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  const [selectedChild, setSelectedChild] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [form, setForm] = useState({
    resident_id: "",

    date_of_registration: "",
    document_record_no: "",
    family_serial_no: "",

    child_name: "",
    date_of_birth: "",
    sex: "",

    mother_name: "",
    mother_tt_status: "",

    weight_kg: "",
    height_cm: "",
    muac_cm: "",

    date_nbs_done: "",
    nbs_result: "",

    tt_date_given: "",
    tt_date_assessed: "",

    complete_address: "",
    referred_health_facility: "",
    referral_result: "",
  });

  // =====================================================
  // GET CHILDREN
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchChildren();
    }
  }, []);

  const fetchChildren = async () => {
    try {
      setLoading(true);

      // Get areas assigned to this BNS
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

      // Get households in assigned areas
      const { data: households, error: householdError } = await supabase
        .from("households")
        .select("id, household_code, household_head, local_area_id")
        .in("local_area_id", areaIds);

      if (householdError) throw householdError;

      const householdIds = (households || []).map((h) => h.id);

      if (householdIds.length === 0) {
        setChildren([]);
        return;
      }

      // Get residents
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

      // Only show children below 5 years old
      const today = new Date();

      const childResidents = (residents || []).filter((resident) => {
        if (!resident.birth_date) return false;

        const birthDate = new Date(resident.birth_date);

        let age = today.getFullYear() - birthDate.getFullYear();

        const monthDifference = today.getMonth() - birthDate.getMonth();

        if (
          monthDifference < 0 ||
          (monthDifference === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }

        return age < 5;
      });

      // Get existing child health records
      const residentIds = childResidents.map((child) => child.id);

      let healthRecords = [];

      if (residentIds.length > 0) {
        const { data, error } = await supabase
          .from("child_health_records")
          .select("*")
          .in("resident_id", residentIds);

        if (error) throw error;

        healthRecords = data || [];
      }

      const merged = childResidents.map((child) => {
        const record = healthRecords.find(
          (item) => item.resident_id === child.id,
        );

        return {
          ...child,
          health_record: record || null,
        };
      });

      setChildren(merged);
    } catch (error) {
      console.error("Error loading children:", error);
      alert(error.message || "Failed to load children.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FORM
  // =====================================================

  const resetForm = () => {
    setForm({
      resident_id: "",

      date_of_registration: "",
      document_record_no: "",
      family_serial_no: "",

      child_name: "",
      date_of_birth: "",
      sex: "",

      mother_name: "",
      mother_tt_status: "",

      weight_kg: "",
      height_cm: "",
      muac_cm: "",

      date_nbs_done: "",
      nbs_result: "",

      tt_date_given: "",
      tt_date_assessed: "",

      complete_address: "",
      referred_health_facility: "",
      referral_result: "",
    });

    setEditingRecord(null);
  };

  const openAddModal = (child) => {
    const fullName = [child.first_name, child.middle_name, child.last_name]
      .filter(Boolean)
      .join(" ");

    setEditingRecord(null);

    setForm({
      resident_id: child.id,

      date_of_registration: new Date().toISOString().split("T")[0],

      document_record_no: "",
      family_serial_no: "",

      child_name: fullName,
      date_of_birth: child.birth_date || "",
      sex: child.sex || "",

      mother_name: "",
      mother_tt_status: "",

      weight_kg: "",
      height_cm: "",
      muac_cm: "",

      date_nbs_done: "",
      nbs_result: "",

      tt_date_given: "",
      tt_date_assessed: "",

      complete_address: "",

      referred_health_facility: "",
      referral_result: "",
    });

    setShowModal(true);
  };

  const openEditModal = (child) => {
    const record = child.health_record;

    if (!record) {
      openAddModal(child);
      return;
    }

    setEditingRecord(record);

    setForm({
      resident_id: record.resident_id,

      date_of_registration: record.date_of_registration || "",

      document_record_no: record.document_record_no || "",

      family_serial_no: record.family_serial_no || "",

      child_name: record.child_name || "",

      date_of_birth: record.date_of_birth || "",

      sex: record.sex || "",

      mother_name: record.mother_name || "",

      mother_tt_status: record.mother_tt_status || "",

      weight_kg: record.weight_kg ?? "",

      height_cm: record.height_cm ?? "",

      muac_cm: record.muac_cm ?? "",

      date_nbs_done: record.date_nbs_done || "",

      nbs_result: record.nbs_result || "",

      tt_date_given: record.tt_date_given || "",

      tt_date_assessed: record.tt_date_assessed || "",

      complete_address: record.complete_address || "",

      referred_health_facility: record.referred_health_facility || "",

      referral_result: record.referral_result || "",
    });

    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // SAVE
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.resident_id) {
      alert("Please select a child.");
      return;
    }

    try {
      setSaving(true);

      const childData = {
        resident_id: Number(form.resident_id),

        date_of_registration: form.date_of_registration || null,

        document_record_no: form.document_record_no.trim() || null,

        family_serial_no: form.family_serial_no.trim() || null,

        child_name: form.child_name.trim() || null,

        date_of_birth: form.date_of_birth || null,

        sex: form.sex || null,

        mother_name: form.mother_name.trim() || null,

        mother_tt_status: form.mother_tt_status.trim() || null,

        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,

        height_cm: form.height_cm ? Number(form.height_cm) : null,

        muac_cm: form.muac_cm ? Number(form.muac_cm) : null,

        date_nbs_done: form.date_nbs_done || null,

        nbs_result: form.nbs_result.trim() || null,

        tt_date_given: form.tt_date_given || null,

        tt_date_assessed: form.tt_date_assessed || null,

        complete_address: form.complete_address.trim() || null,

        referred_health_facility: form.referred_health_facility.trim() || null,

        referral_result: form.referral_result.trim() || null,

        recorded_by: user.id,

        updated_at: new Date().toISOString(),
      };

      if (editingRecord) {
        const { error } = await supabase
          .from("child_health_records")
          .update(childData)
          .eq("id", editingRecord.id);

        if (error) throw error;

        alert("Child health record updated successfully.");
      } else {
        const { error } = await supabase
          .from("child_health_records")
          .insert(childData);

        if (error) throw error;

        alert("Child health record created successfully.");
      }

      setShowModal(false);
      resetForm();

      await fetchChildren();
    } catch (error) {
      console.error("Error saving child record:", error);
      alert(error.message || "Failed to save child health record.");
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (child) => {
    if (!child.health_record) return;

    const confirmed = window.confirm(
      `Delete the child health record of ${
        child.child_name || `${child.first_name} ${child.last_name}`
      }?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("child_health_records")
        .delete()
        .eq("id", child.health_record.id);

      if (error) throw error;

      await fetchChildren();

      alert("Child health record deleted.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete child health record.");
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const openViewModal = (child) => {
    setSelectedChild(child);
    setShowViewModal(true);
  };

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredChildren = useMemo(() => {
    const searchText = search.toLowerCase();

    return children.filter((child) => {
      const fullName = [child.first_name, child.middle_name, child.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const household = child.households?.household_code?.toLowerCase() || "";

      const barangay =
        child.households?.local_areas?.barangays?.name?.toLowerCase() || "";

      return (
        fullName.includes(searchText) ||
        household.includes(searchText) ||
        barangay.includes(searchText)
      );
    });
  }, [children, search]);

  // =====================================================
  // AGE
  // =====================================================

  const calculateAge = (birthDate) => {
    if (!birthDate) return "-";

    const birth = new Date(birthDate);
    const today = new Date();

    let years = today.getFullYear() - birth.getFullYear();

    let months = today.getMonth() - birth.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (today.getDate() < birth.getDate()) {
      months--;
      if (months < 0) {
        years--;
        months = 11;
      }
    }

    if (years > 0) {
      return `${years}y ${months}m`;
    }

    return `${Math.max(months, 0)}m`;
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Child Registration
          </h2>

          <p className="text-gray-500 mt-1">
            Register and Manage child health records in your assigned areas.
          </p>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search
            size={19}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search child, household, or barangay..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full
              pl-10 pr-4 py-3
              bg-white
              border border-gray-200
              rounded-xl
              outline-none
              focus:ring-2
              focus:ring-teal-500
            "
          />
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading children...
            </div>
          ) : filteredChildren.length === 0 ? (
            <div className="p-10 text-center">
              <Baby size={45} className="mx-auto text-gray-300" />

              <p className="text-gray-500 mt-3">No children found.</p>

              <p className="text-sm text-gray-400 mt-1">
                Children under 5 years old from your assigned households will
                appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Child
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Age
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Sex
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Household
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Barangay
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Record
                    </th>

                    <th className="text-right px-6 py-4 font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredChildren.map((child) => {
                    const fullName = [
                      child.first_name,
                      child.middle_name,
                      child.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const recordExists = !!child.health_record;

                    return (
                      <tr key={child.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                              <Baby size={19} className="text-teal-600" />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {fullName}
                              </p>

                              <p className="text-xs text-gray-400">
                                {child.birth_date || "-"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {calculateAge(child.birth_date)}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {child.sex || "-"}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {child.households?.household_code || "-"}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {child.households?.local_areas?.barangays?.name ||
                            "-"}
                        </td>

                        <td className="px-6 py-4">
                          {recordExists ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              Registered
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                              Not Registered
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openViewModal(child)}
                              title="View"
                              className="p-2 rounded-lg text-teal-600 hover:bg-teal-50"
                            >
                              <Eye size={17} />
                            </button>

                            {recordExists ? (
                              <>
                                <button
                                  onClick={() => openEditModal(child)}
                                  title="Edit"
                                  className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit size={17} />
                                </button>

                                <button
                                  onClick={() => handleDelete(child)}
                                  title="Delete"
                                  className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => openAddModal(child)}
                                title="Register Child"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium"
                              >
                                <Plus size={15} />
                                Register
                              </button>
                            )}
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
            ADD / EDIT CHILD HEALTH RECORD
        ===================================================== */}

        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5 overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl bg-white rounded-2xl shadow-2xl my-4">
              {/* HEADER */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
                    <Baby size={22} className="text-teal-600" />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {editingRecord
                        ? "Edit Child Health Record"
                        : "Child Registration"}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Based on the local Child Health Record form.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col">
                {/* =========================================================
      FORM CONTENT
  ========================================================= */}

                <div className="p-5 sm:p-7 space-y-6 bg-gray-50/70">
                  {/* =========================================================
        CHILD PROFILE
    ========================================================= */}

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Section Header */}
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                          <Baby size={20} className="text-teal-600" />
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-800">
                            Child Registration
                          </h4>

                          <p className="text-xs text-gray-500 mt-0.5">
                            Basic information and initial child assessment
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Registration Details */}

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          Registration Details
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Date */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Date of Registration
                            </label>

                            <input
                              type="date"
                              name="date_of_registration"
                              value={form.date_of_registration}
                              onChange={handleChange}
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                            />
                          </div>

                          {/* Document */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Document Record No.
                            </label>

                            <input
                              type="text"
                              name="document_record_no"
                              value={form.document_record_no}
                              onChange={handleChange}
                              placeholder="CHDSPHC-OD-ITR..."
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                            />
                          </div>

                          {/* Family Serial */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Family Serial No.
                            </label>

                            <input
                              type="text"
                              name="family_serial_no"
                              value={form.family_serial_no}
                              onChange={handleChange}
                              placeholder="Enter family serial number"
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Child Profile */}

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          Child Information
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Child Name */}
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Name of Child
                            </label>

                            <div className="relative">
                              <Baby
                                size={17}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-500"
                              />

                              <input
                                type="text"
                                value={form.child_name}
                                readOnly
                                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-teal-100 bg-teal-50/50 text-sm font-medium text-gray-800 outline-none"
                              />
                            </div>

                            <p className="text-[11px] text-gray-400 mt-1.5">
                              Automatically retrieved from the household
                              resident record.
                            </p>
                          </div>

                          {/* Sex */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Sex
                            </label>

                            <input
                              type="text"
                              value={form.sex}
                              readOnly
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Initial Assessment */}

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          Initial Assessment
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* DOB */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Date of Birth
                            </label>

                            <input
                              type="date"
                              value={form.date_of_birth}
                              readOnly
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none"
                            />
                          </div>

                          {/* Weight */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Weight
                              <span className="text-gray-400 font-normal ml-1">
                                (kg)
                              </span>
                            </label>

                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="weight_kg"
                                value={form.weight_kg}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full h-11 px-3.5 pr-14 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                              />

                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                                kg
                              </span>
                            </div>
                          </div>

                          {/* Height */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Height / Length
                              <span className="text-gray-400 font-normal ml-1">
                                (cm)
                              </span>
                            </label>

                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="height_cm"
                                value={form.height_cm}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full h-11 px-3.5 pr-14 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                              />

                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                                cm
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* MUAC / NBS */}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          {/* MUAC */}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              MUAC
                              <span className="text-gray-400 font-normal ml-1">
                                (cm)
                              </span>
                            </label>

                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="muac_cm"
                                value={form.muac_cm}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full h-11 px-3.5 pr-14 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                              />

                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                                cm
                              </span>
                            </div>
                          </div>

                          {/* NBS Date */}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Date NBS Done
                            </label>

                            <input
                              type="date"
                              name="date_nbs_done"
                              value={form.date_nbs_done}
                              onChange={handleChange}
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                            />
                          </div>

                          {/* Result */}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              NBS Result
                            </label>

                            <input
                              type="text"
                              name="nbs_result"
                              value={form.nbs_result}
                              onChange={handleChange}
                              placeholder="Enter screening result"
                              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* =========================================================
        MOTHER / FAMILY
    ========================================================= */}

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                          <UserRound size={20} className="text-pink-600" />
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-800">
                            Mother / Family Information
                          </h4>

                          <p className="text-xs text-gray-500 mt-0.5">
                            Maternal information and assessment details
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Mother */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Name of Mother
                          </label>

                          <input
                            type="text"
                            name="mother_name"
                            value={form.mother_name}
                            onChange={handleChange}
                            placeholder="Enter mother's full name"
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10"
                          />
                        </div>

                        {/* TT */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            TT Status of Mother
                          </label>

                          <input
                            type="text"
                            name="mother_tt_status"
                            value={form.mother_tt_status}
                            onChange={handleChange}
                            placeholder="Enter TT status"
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            TT Date Given
                          </label>

                          <input
                            type="date"
                            name="tt_date_given"
                            value={form.tt_date_given}
                            onChange={handleChange}
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Date Assessed
                          </label>

                          <input
                            type="date"
                            name="tt_date_assessed"
                            value={form.tt_date_assessed}
                            onChange={handleChange}
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Complete Address
                        </label>

                        <textarea
                          name="complete_address"
                          value={form.complete_address}
                          onChange={handleChange}
                          rows={3}
                          placeholder="Enter complete address"
                          className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-sm resize-none outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10"
                        />
                      </div>
                    </div>
                  </section>

                  {/* =========================================================
        REFERRAL
    ========================================================= */}

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                          <Activity size={20} className="text-orange-600" />
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-800">
                            Referral Information
                          </h4>

                          <p className="text-xs text-gray-500 mt-0.5">
                            Record referrals made to other health facilities
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Referred / Done at Other Health Facility
                          </label>

                          <input
                            type="text"
                            name="referred_health_facility"
                            value={form.referred_health_facility}
                            onChange={handleChange}
                            placeholder="Enter health facility"
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Result
                          </label>

                          <input
                            type="text"
                            name="referral_result"
                            value={form.referral_result}
                            onChange={handleChange}
                            placeholder="Enter referral result"
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* =========================================================
        NEXT STEPS
    ========================================================= */}

                  <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <Activity size={19} className="text-teal-600" />
                      </div>

                      <div>
                        <p className="font-semibold text-gray-800">
                          Child Health Record
                        </p>

                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          After registration, you can manage the child's
                          immunization, breastfeeding, complementary feeding,
                          micronutrient supplementation, deworming, and SOAP
                          follow-up records.
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-2.5 py-1 rounded-full bg-white text-xs text-gray-600 border border-teal-100">
                            Immunization
                          </span>

                          <span className="px-2.5 py-1 rounded-full bg-white text-xs text-gray-600 border border-teal-100">
                            Breastfeeding
                          </span>

                          <span className="px-2.5 py-1 rounded-full bg-white text-xs text-gray-600 border border-teal-100">
                            Complementary Feeding
                          </span>

                          <span className="px-2.5 py-1 rounded-full bg-white text-xs text-gray-600 border border-teal-100">
                            Micronutrients
                          </span>

                          <span className="px-2.5 py-1 rounded-full bg-white text-xs text-gray-600 border border-teal-100">
                            Deworming
                          </span>

                          <span className="px-2.5 py-1 rounded-full bg-white text-xs text-gray-600 border border-teal-100">
                            SOAP
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================================================
      STICKY FOOTER
  ========================================================= */}

                <div className="sticky bottom-0 z-10 px-5 sm:px-7 py-4 bg-white/95 backdrop-blur border-t border-gray-200">
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-gray-400">
                      Fields marked as required should be completed before
                      saving.
                    </p>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          resetForm();
                        }}
                        className="
            px-5 py-2.5
            rounded-xl
            border border-gray-200
            bg-white
            text-sm font-medium text-gray-700
            hover:bg-gray-50
            transition
          "
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={saving}
                        className="
            inline-flex items-center justify-center gap-2
            px-5 py-2.5
            rounded-xl
            bg-teal-600
            hover:bg-teal-700
            text-white
            text-sm font-semibold
            shadow-sm
            hover:shadow
            transition
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
                      >
                        <Save size={17} />

                        {saving
                          ? "Saving..."
                          : editingRecord
                            ? "Update Record"
                            : "Register Child"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =====================================================
            VIEW CHILD RECORD
        ===================================================== */}

        {showViewModal && selectedChild && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5 md:p-8">
            <div className="bg-white w-full h-full max-w-6xl mx-auto rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* HEADER */}

              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Child Health Record
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    {[
                      selectedChild.first_name,
                      selectedChild.middle_name,
                      selectedChild.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>

                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2.5 rounded-lg hover:bg-gray-100"
                >
                  <X size={22} />
                </button>
              </div>

              {/* CONTENT */}

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!selectedChild.health_record ? (
                  <div className="text-center py-20">
                    <Baby size={50} className="mx-auto text-gray-300" />

                    <p className="text-gray-500 mt-4">
                      This child has not been registered yet.
                    </p>

                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        openAddModal(selectedChild);
                      }}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg"
                    >
                      <Plus size={17} />
                      Register Child
                    </button>
                  </div>
                ) : (
                  <>
                    {/* CHILD */}

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">
                          Child Information
                        </h3>
                      </div>

                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        <Info
                          label="Child"
                          value={selectedChild.health_record.child_name}
                        />

                        <Info
                          label="Date of Birth"
                          value={selectedChild.health_record.date_of_birth}
                        />

                        <Info
                          label="Sex"
                          value={selectedChild.health_record.sex}
                        />

                        <Info
                          label="Age"
                          value={calculateAge(
                            selectedChild.health_record.date_of_birth,
                          )}
                        />

                        <Info
                          label="Weight"
                          value={
                            selectedChild.health_record.weight_kg
                              ? `${selectedChild.health_record.weight_kg} kg`
                              : "—"
                          }
                        />

                        <Info
                          label="Height / Length"
                          value={
                            selectedChild.health_record.height_cm
                              ? `${selectedChild.health_record.height_cm} cm`
                              : "—"
                          }
                        />

                        <Info
                          label="MUAC"
                          value={
                            selectedChild.health_record.muac_cm
                              ? `${selectedChild.health_record.muac_cm} cm`
                              : "—"
                          }
                        />

                        <Info
                          label="NBS Result"
                          value={selectedChild.health_record.nbs_result || "—"}
                        />
                      </div>
                    </div>

                    {/* MOTHER */}

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">
                          Mother / Family Information
                        </h3>
                      </div>

                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Info
                          label="Mother"
                          value={selectedChild.health_record.mother_name}
                        />

                        <Info
                          label="Mother TT Status"
                          value={selectedChild.health_record.mother_tt_status}
                        />

                        <Info
                          label="TT Date Given"
                          value={selectedChild.health_record.tt_date_given}
                        />

                        <Info
                          label="Date Assessed"
                          value={selectedChild.health_record.tt_date_assessed}
                        />

                        <Info
                          label="Address"
                          value={selectedChild.health_record.complete_address}
                        />
                      </div>
                    </div>

                    {/* REFERRAL */}

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">
                          Referral Information
                        </h3>
                      </div>

                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Info
                          label="Health Facility"
                          value={
                            selectedChild.health_record.referred_health_facility
                          }
                        />

                        <Info
                          label="Result"
                          value={selectedChild.health_record.referral_result}
                        />
                      </div>
                    </div>

                    {/* FORM SECTIONS */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <RecordSection
                        title="Immunization"
                        value={selectedChild.health_record.immunization}
                      />

                      <RecordSection
                        title="Breastfeeding"
                        value={selectedChild.health_record.breastfeeding}
                      />

                      <RecordSection
                        title="Complementary Feeding"
                        value={
                          selectedChild.health_record.complementary_feeding
                        }
                      />

                      <RecordSection
                        title="Micronutrient Supplementation"
                        value={
                          selectedChild.health_record
                            .micronutrient_supplementation
                        }
                      />

                      <RecordSection
                        title="Deworming"
                        value={selectedChild.health_record.deworming}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// SMALL COMPONENTS
// =====================================================

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>

      <p className="font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function RecordSection({ title, value }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>

      <div className="p-5">
        {value && Object.keys(value).length > 0 ? (
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-400">No records yet.</p>
        )}
      </div>
    </div>
  );
}

export default ChildRegistration;
