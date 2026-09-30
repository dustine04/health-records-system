import { useEffect, useMemo, useState } from "react";
import {
  Baby,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Save,
  Eye,
  UserRound,
  MapPin,
  CalendarDays,
  HeartPulse,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function BhwPregnantWomen() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [pregnantWomen, setPregnantWomen] = useState([]);
  const [eligibleResidents, setEligibleResidents] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Registration modal
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const emptyForm = {
    resident_id: "",
    family_record_no: "",
    date_of_registration: new Date().toISOString().split("T")[0],

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

  const [form, setForm] = useState(emptyForm);

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchLocalAreas();
    }
  }, []);

  useEffect(() => {
    if (localAreas.length > 0) {
      fetchPregnantWomen();
    } else if (user) {
      setPregnantWomen([]);
      setEligibleResidents([]);
      setLoading(false);
    }
  }, [localAreas]);

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
      console.error("Error loading assigned areas:", error);
      alert("Failed to load your assigned areas.");
    }
  };

  // =====================================================
  // GET RESIDENTS + PREGNANCY RECORDS
  // =====================================================

  const fetchPregnantWomen = async () => {
    try {
      setLoading(true);

      const areaIds = localAreas.map((area) => area.id);

      if (areaIds.length === 0) {
        setPregnantWomen([]);
        setEligibleResidents([]);
        return;
      }

      // -------------------------------------------------
      // HOUSEHOLDS IN ASSIGNED AREAS
      // -------------------------------------------------

      const { data: households, error: householdError } = await supabase
        .from("households")
        .select("id")
        .in("local_area_id", areaIds);

      if (householdError) throw householdError;

      const householdIds = (households || []).map((item) => item.id);

      if (householdIds.length === 0) {
        setPregnantWomen([]);
        setEligibleResidents([]);
        return;
      }

      // -------------------------------------------------
      // FEMALE RESIDENTS
      // -------------------------------------------------

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
            address,
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
        .eq("sex", "Female")
        .order("last_name", {
          ascending: true,
        });

      if (residentError) throw residentError;

      const femaleResidents = residents || [];

      setEligibleResidents(femaleResidents);

      // -------------------------------------------------
      // GET PREGNANCY RECORDS
      // -------------------------------------------------

      const residentIds = femaleResidents.map((resident) => resident.id);

      if (residentIds.length === 0) {
        setPregnantWomen([]);
        return;
      }

      const { data: pregnancyRecords, error: pregnancyError } = await supabase
        .from("pregnant_women")
        .select("*")
        .in("resident_id", residentIds)
        .order("created_at", {
          ascending: false,
        });

      if (pregnancyError) throw pregnancyError;

      // -------------------------------------------------
      // MERGE RESIDENT + PREGNANCY RECORD
      // -------------------------------------------------

      const records = (pregnancyRecords || []).map((record) => {
        const resident = femaleResidents.find(
          (item) => item.id === record.resident_id,
        );

        return {
          ...record,
          resident,
        };
      });

      setPregnantWomen(records);
    } catch (error) {
      console.error("Error loading pregnant women:", error);
      alert(error.message || "Failed to load pregnant women.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FORM
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // OPEN ADD
  // =====================================================

  const openAddModal = () => {
    setEditingRecord(null);

    setForm({
      ...emptyForm,
      date_of_registration: new Date().toISOString().split("T")[0],
    });

    setShowModal(true);
  };

  // =====================================================
  // OPEN EDIT
  // =====================================================

  const openEditModal = (record) => {
    setEditingRecord(record);

    setForm({
      resident_id: record.resident_id ? String(record.resident_id) : "",

      family_record_no: record.family_record_no || "",

      date_of_registration: record.date_of_registration || "",

      gravida:
        record.gravida !== null && record.gravida !== undefined
          ? String(record.gravida)
          : "",

      para:
        record.para !== null && record.para !== undefined
          ? String(record.para)
          : "",

      term:
        record.term !== null && record.term !== undefined
          ? String(record.term)
          : "",

      preterm:
        record.preterm !== null && record.preterm !== undefined
          ? String(record.preterm)
          : "",

      abortion:
        record.abortion !== null && record.abortion !== undefined
          ? String(record.abortion)
          : "",

      living:
        record.living !== null && record.living !== undefined
          ? String(record.living)
          : "",

      lmp: record.lmp || "",
      edc: record.edc || "",

      civil_status: record.civil_status || "",
      husband_name: record.husband_name || "",
      philhealth_no: record.philhealth_no || "",
      blood_type: record.blood_type || "",
      facility_name: record.facility_name || "",
    });

    setShowModal(true);
  };

  // =====================================================
  // SAVE
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.resident_id) {
      alert("Please select a woman.");
      return;
    }

    if (!form.date_of_registration) {
      alert("Please enter the registration date.");
      return;
    }

    try {
      setSaving(true);

      const pregnancyData = {
        resident_id: Number(form.resident_id),

        family_record_no: form.family_record_no.trim() || null,

        date_of_registration: form.date_of_registration || null,

        gravida: form.gravida !== "" ? Number(form.gravida) : null,

        para: form.para !== "" ? Number(form.para) : null,

        term: form.term !== "" ? Number(form.term) : null,

        preterm: form.preterm !== "" ? Number(form.preterm) : null,

        abortion: form.abortion !== "" ? Number(form.abortion) : null,

        living: form.living !== "" ? Number(form.living) : null,

        lmp: form.lmp || null,
        edc: form.edc || null,

        civil_status: form.civil_status || null,

        husband_name: form.husband_name.trim() || null,

        philhealth_no: form.philhealth_no.trim() || null,

        blood_type: form.blood_type || null,

        facility_name: form.facility_name.trim() || null,

        created_by: user.id,

        updated_at: new Date().toISOString(),
      };

      if (editingRecord) {
        const { error } = await supabase
          .from("pregnant_women")
          .update(pregnancyData)
          .eq("id", editingRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pregnant_women")
          .insert(pregnancyData);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingRecord(null);

      await fetchPregnantWomen();

      alert(
        editingRecord
          ? "Pregnancy record updated successfully."
          : "Pregnancy registered successfully.",
      );
    } catch (error) {
      console.error("Error saving pregnancy:", error);
      alert(error.message || "Failed to save pregnancy record.");
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (record) => {
    const name = getFullName(record.resident);

    const confirmed = window.confirm(
      `Are you sure you want to delete the pregnancy record of ${name}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("pregnant_women")
        .delete()
        .eq("id", record.id);

      if (error) throw error;

      await fetchPregnantWomen();

      alert("Pregnancy record deleted successfully.");
    } catch (error) {
      console.error("Error deleting pregnancy:", error);
      alert(error.message || "Failed to delete pregnancy record.");
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const openViewModal = (record) => {
    setSelectedRecord(record);
    setShowViewModal(true);
  };

  // =====================================================
  // HELPERS
  // =====================================================

  const getFullName = (resident) => {
    if (!resident) return "Unknown";

    return [resident.first_name, resident.middle_name, resident.last_name]
      .filter(Boolean)
      .join(" ");
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "—";

    const birth = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();

    const monthDifference = today.getMonth() - birth.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // =====================================================
  // FILTER
  // =====================================================

  const filteredRecords = useMemo(() => {
    const searchText = search.toLowerCase();

    return pregnantWomen.filter((record) => {
      const resident = record.resident;

      const name = getFullName(resident).toLowerCase();

      return (
        name.includes(searchText) ||
        record.family_record_no?.toLowerCase().includes(searchText) ||
        resident?.households?.household_code
          ?.toLowerCase()
          .includes(searchText) ||
        resident?.households?.local_areas?.name
          ?.toLowerCase()
          .includes(searchText)
      );
    });
  }, [pregnantWomen, search]);

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Pregnant Women
            </h2>

            <p className="text-gray-500 mt-1">
              Register and manage pregnant women in your assigned areas.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="
              inline-flex items-center justify-center gap-2
              bg-teal-600
              hover:bg-teal-700
              text-white
              px-4 py-2.5
              rounded-lg
              text-sm font-medium
              transition
            "
          >
            <Plus size={18} />
            Register Pregnancy
          </button>
        </div>

        {/* =====================================================
            ASSIGNED AREAS
        ===================================================== */}

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <MapPin size={20} className="text-teal-600" />
            </div>

            <div>
              <p className="text-sm text-gray-500">Assigned Purok/Sitio</p>

              <div className="flex flex-wrap gap-2 mt-1">
                {localAreas.length > 0 ? (
                  localAreas.map((area) => (
                    <span
                      key={area.id}
                      className="
                        text-sm font-medium
                        text-gray-700
                        bg-gray-100
                        px-2.5 py-1
                        rounded-md
                      "
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
            className="
              absolute left-3 top-1/2
              -translate-y-1/2
              text-gray-400
            "
          />

          <input
            type="text"
            placeholder="Search pregnant women..."
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

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading pregnant women...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-10 text-center">
              <Baby size={42} className="mx-auto text-gray-300" />

              <p className="text-gray-500 mt-3">No pregnancy records found.</p>

              <button
                onClick={openAddModal}
                className="
                  mt-4
                  inline-flex items-center gap-2
                  text-sm font-medium
                  text-teal-600
                  hover:text-teal-700
                "
              >
                <Plus size={16} />
                Register a pregnant woman
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Name
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Age
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Household
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Purok/Sitio
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      EDC
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Record No.
                    </th>

                    <th className="text-right px-6 py-4 font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((record) => {
                    const resident = record.resident;

                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        {/* NAME */}

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-pink-50 flex items-center justify-center">
                              <UserRound size={17} className="text-pink-600" />
                            </div>

                            <div>
                              <p className="font-medium text-gray-800">
                                {getFullName(resident)}
                              </p>

                              <p className="text-xs text-gray-500">
                                {resident?.contact_number || "No contact"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* AGE */}

                        <td className="px-6 py-4 text-gray-600">
                          {calculateAge(resident?.birth_date)}
                        </td>

                        {/* HOUSEHOLD */}

                        <td className="px-6 py-4 text-gray-600">
                          {resident?.households?.household_code || "—"}
                        </td>

                        {/* AREA */}

                        <td className="px-6 py-4 text-gray-600">
                          {resident?.households?.local_areas?.name || "—"}
                        </td>

                        {/* EDC */}

                        <td className="px-6 py-4 text-gray-600">
                          {formatDate(record.edc)}
                        </td>

                        {/* RECORD NO */}

                        <td className="px-6 py-4 text-gray-600">
                          {record.family_record_no || "—"}
                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openViewModal(record)}
                              title="View"
                              className="
                                p-2 rounded-lg
                                text-teal-600
                                hover:bg-teal-50
                              "
                            >
                              <Eye size={17} />
                            </button>

                            <button
                              onClick={() => openEditModal(record)}
                              title="Edit"
                              className="
                                p-2 rounded-lg
                                text-blue-600
                                hover:bg-blue-50
                              "
                            >
                              <Edit size={17} />
                            </button>

                            <button
                              onClick={() => handleDelete(record)}
                              title="Delete"
                              className="
                                p-2 rounded-lg
                                text-red-600
                                hover:bg-red-50
                              "
                            >
                              <Trash2 size={17} />
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
            ADD / EDIT MODAL
        ===================================================== */}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
              {/* HEADER */}

              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingRecord
                      ? "Edit Pregnancy Registration"
                      : "Pregnant Woman Registration"}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Enter the information from the antenatal care record.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* =================================================
                    WOMAN
                ================================================= */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      Woman Information
                    </h4>

                    <p className="text-xs text-gray-500 mt-1">
                      Select the female resident from your assigned area.
                    </p>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Woman *
                      </label>

                      <select
                        name="resident_id"
                        value={form.resident_id}
                        onChange={handleChange}
                        disabled={!!editingRecord}
                        required
                        className="
                          w-full px-3 py-2.5
                          border border-gray-200
                          rounded-lg
                          outline-none
                          focus:ring-2
                          focus:ring-teal-500
                          disabled:bg-gray-100
                        "
                      >
                        <option value="">Select woman</option>

                        {eligibleResidents.map((resident) => (
                          <option key={resident.id} value={resident.id}>
                            {getFullName(resident)}
                            {" — "}
                            {resident.birth_date || "No birth date"}
                            {" — "}
                            {resident.households?.household_code || ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {form.resident_id &&
                      (() => {
                        const selectedResident = eligibleResidents.find(
                          (item) => item.id === Number(form.resident_id),
                        );

                        if (!selectedResident) return null;

                        return (
                          <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500">
                                  Date of Birth
                                </p>
                                <p className="font-medium text-gray-800">
                                  {selectedResident.birth_date || "—"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">Age</p>
                                <p className="font-medium text-gray-800">
                                  {calculateAge(selectedResident.birth_date)}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">
                                  Household
                                </p>
                                <p className="font-medium text-gray-800">
                                  {selectedResident.households
                                    ?.household_code || "—"}
                                </p>
                              </div>

                              <div className="sm:col-span-2">
                                <p className="text-xs text-gray-500">Address</p>
                                <p className="font-medium text-gray-800">
                                  {selectedResident.households?.address || "—"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">
                                  Purok / Sitio
                                </p>
                                <p className="font-medium text-gray-800">
                                  {selectedResident.households?.local_areas
                                    ?.name || "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                </div>

                {/* =================================================
                    REGISTRATION
                ================================================= */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      Registration Information
                    </h4>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Family Record No.
                      </label>

                      <input
                        type="text"
                        name="family_record_no"
                        value={form.family_record_no}
                        onChange={handleChange}
                        placeholder="Family record number"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Registration *
                      </label>

                      <input
                        type="date"
                        name="date_of_registration"
                        value={form.date_of_registration}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Civil Status
                      </label>

                      <select
                        name="civil_status"
                        value={form.civil_status}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Select status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name of Husband
                      </label>

                      <input
                        type="text"
                        name="husband_name"
                        value={form.husband_name}
                        onChange={handleChange}
                        placeholder="Name of husband"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PhilHealth No.
                      </label>

                      <input
                        type="text"
                        name="philhealth_no"
                        value={form.philhealth_no}
                        onChange={handleChange}
                        placeholder="PhilHealth number"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Blood Type
                      </label>

                      <select
                        name="blood_type"
                        value={form.blood_type}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Select blood type</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="Unknown">Unknown</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name of Facility
                      </label>

                      <input
                        type="text"
                        name="facility_name"
                        value={form.facility_name}
                        onChange={handleChange}
                        placeholder="Health facility"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* =================================================
                    OB HISTORY
                ================================================= */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      Obstetric History
                    </h4>

                    <p className="text-xs text-gray-500 mt-1">
                      Based on the G / P (F / P / A / L) section of the
                      antenatal form.
                    </p>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      {[
                        ["gravida", "Gravida (G)"],
                        ["para", "Para (P)"],
                        ["term", "Full Term (F)"],
                        ["preterm", "Preterm (P)"],
                        ["abortion", "Abortion (A)"],
                        ["living", "Living (L)"],
                      ].map(([name, label]) => (
                        <div key={name}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label}
                          </label>

                          <input
                            type="number"
                            min="0"
                            name={name}
                            value={form[name]}
                            onChange={handleChange}
                            className="
                              w-full px-3 py-2.5
                              border border-gray-200
                              rounded-lg
                              outline-none
                              focus:ring-2
                              focus:ring-teal-500
                            "
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* =================================================
                    PREGNANCY DATES
                ================================================= */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      Pregnancy Information
                    </h4>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        LMP
                      </label>

                      <input
                        type="date"
                        name="lmp"
                        value={form.lmp}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />

                      <p className="text-xs text-gray-500 mt-1">
                        Last Menstrual Period
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        EDC
                      </label>

                      <input
                        type="date"
                        name="edc"
                        value={form.edc}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                      />

                      <p className="text-xs text-gray-500 mt-1">
                        Expected Date of Confinement
                      </p>
                    </div>
                  </div>
                </div>

                {/* =================================================
                    BUTTONS
                ================================================= */}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="
                      px-4 py-2.5
                      rounded-lg
                      border border-gray-200
                      text-gray-700
                      hover:bg-gray-50
                    "
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="
                      inline-flex items-center gap-2
                      px-4 py-2.5
                      rounded-lg
                      bg-teal-600
                      hover:bg-teal-700
                      text-white
                      font-medium
                      disabled:opacity-50
                    "
                  >
                    <Save size={17} />

                    {saving
                      ? "Saving..."
                      : editingRecord
                        ? "Update Registration"
                        : "Register Pregnancy"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =====================================================
            VIEW MODAL
        ===================================================== */}

        {showViewModal && selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
              {/* HEADER */}

              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-pink-50 flex items-center justify-center">
                    <Baby size={22} className="text-pink-600" />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Pregnancy Record
                    </h3>

                    <p className="text-sm text-gray-500">
                      {getFullName(selectedRecord.resident)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRecord(null);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* WOMAN */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      Woman Information
                    </h4>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Name</p>

                      <p className="font-medium text-gray-800">
                        {getFullName(selectedRecord.resident)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Date of Birth
                      </p>

                      <p className="font-medium text-gray-800">
                        {formatDate(selectedRecord.resident?.birth_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Age</p>

                      <p className="font-medium text-gray-800">
                        {calculateAge(selectedRecord.resident?.birth_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Civil Status</p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.civil_status || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Husband</p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.husband_name || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact</p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.resident?.contact_number || "—"}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Address</p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.resident?.households?.address || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Purok / Sitio
                      </p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.resident?.households?.local_areas
                          ?.name || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PREGNANCY */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      Pregnancy Information
                    </h4>
                  </div>

                  <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                    <div>
                      <p className="text-xs text-gray-500">Gravida</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {selectedRecord.gravida ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Para</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {selectedRecord.para ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Full Term</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {selectedRecord.term ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Preterm</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {selectedRecord.preterm ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Abortion</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {selectedRecord.abortion ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Living</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {selectedRecord.living ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">LMP</p>

                      <p className="font-medium text-gray-800">
                        {formatDate(selectedRecord.lmp)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">EDC</p>

                      <p className="font-medium text-gray-800">
                        {formatDate(selectedRecord.edc)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Blood Type</p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.blood_type || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        PhilHealth No.
                      </p>

                      <p className="font-medium text-gray-800">
                        {selectedRecord.philhealth_no || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* FACILITY */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">Facility</h4>
                  </div>

                  <div className="p-5">
                    <p className="text-xs text-gray-500 mb-1">
                      Name of Facility
                    </p>

                    <p className="font-medium text-gray-800">
                      {selectedRecord.facility_name || "—"}
                    </p>
                  </div>
                </div>

                {/* REGISTRATION */}

                <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <CalendarDays size={20} className="text-teal-600" />

                    <div>
                      <p className="text-xs text-gray-500">
                        Date of Registration
                      </p>

                      <p className="font-medium text-gray-800">
                        {formatDate(selectedRecord.date_of_registration)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRecord(null);
                  }}
                  className="
                    px-4 py-2.5
                    rounded-lg
                    bg-gray-100
                    hover:bg-gray-200
                    text-gray-700
                    font-medium
                  "
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default BhwPregnantWomen;
