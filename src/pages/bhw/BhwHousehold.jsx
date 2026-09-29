import { useEffect, useState } from "react";
import {
  Home,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Users,
  Eye,
  Save,
  UserRound,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function BhwHousehold() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [households, setHouseholds] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);

  const [loading, setLoading] = useState(true);

  // Household Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState(null);

  // Household details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);

  // Resident Add/Edit modal
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [savingResident, setSavingResident] = useState(false);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    household_code: "",
    household_head: "",
    contact_number: "",
    address: "",
    local_area_id: "",
  });

  const [residentForm, setResidentForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    sex: "Male",
    birth_date: "",
    civil_status: "",
    relationship_to_head: "",
    contact_number: "",
    is_household_head: false,
  });

  // =====================================================
  // GET ASSIGNED AREAS
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchLocalAreas();
    }
  }, []);

  useEffect(() => {
    if (localAreas.length > 0) {
      fetchHouseholds();
    } else {
      setHouseholds([]);
      setLoading(false);
    }
  }, [localAreas]);

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
  // GET HOUSEHOLDS
  // =====================================================

  const fetchHouseholds = async () => {
    try {
      setLoading(true);

      const areaIds = localAreas.map((area) => area.id);

      if (areaIds.length === 0) {
        setHouseholds([]);
        return;
      }

      const { data, error } = await supabase
        .from("households")
        .select(
          `
          *,
          local_areas (
            id,
            name,
            type,
            barangays (
              id,
              name
            )
          ),
          residents (
            id
          )
        `,
        )
        .in("local_area_id", areaIds)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      const householdsWithCount = (data || []).map((household) => ({
        ...household,
        resident_count: household.residents?.length || 0,
      }));

      setHouseholds(householdsWithCount);
    } catch (error) {
      console.error("Error loading households:", error);
      alert("Failed to load households.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // HOUSEHOLD ADD / EDIT
  // =====================================================

  const openAddModal = () => {
    setEditingHousehold(null);

    setForm({
      household_code: `HH-${Date.now()}`,
      household_head: "",
      contact_number: "",
      address: "",
      local_area_id: localAreas.length === 1 ? String(localAreas[0].id) : "",
    });

    setShowModal(true);
  };

  const openEditModal = (household) => {
    setEditingHousehold(household);

    setForm({
      household_code: household.household_code || "",
      household_head: household.household_head || "",
      contact_number: household.contact_number || "",
      address: household.address || "",
      local_area_id: household.local_area_id
        ? String(household.local_area_id)
        : "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.household_head.trim()) {
      alert("Please enter the household head.");
      return;
    }

    if (!form.local_area_id) {
      alert("Please select a Purok/Sitio.");
      return;
    }

    try {
      const householdData = {
        household_code: form.household_code.trim(),
        household_head: form.household_head.trim(),
        contact_number: form.contact_number.trim() || null,
        address: form.address.trim() || null,
        local_area_id: Number(form.local_area_id),
      };

      if (editingHousehold) {
        const { error } = await supabase
          .from("households")
          .update({
            ...householdData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingHousehold.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("households").insert({
          ...householdData,
          created_by: user.id,
        });

        if (error) throw error;
      }

      setShowModal(false);
      await fetchHouseholds();
    } catch (error) {
      console.error("Error saving household:", error);
      alert(error.message || "Failed to save household.");
    }
  };

  // =====================================================
  // DELETE HOUSEHOLD
  // =====================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this household?",
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from("households").delete().eq("id", id);

      if (error) throw error;

      await fetchHouseholds();
    } catch (error) {
      console.error("Error deleting household:", error);
      alert(error.message || "Failed to delete household.");
    }
  };

  // =====================================================
  // VIEW HOUSEHOLD
  // =====================================================

  const viewHousehold = async (household) => {
    setSelectedHousehold(household);
    setShowDetailsModal(true);

    await fetchResidents(household.id);
  };

  const fetchResidents = async (householdId) => {
    try {
      setResidentsLoading(true);

      const { data, error } = await supabase
        .from("residents")
        .select("*")
        .eq("household_id", householdId)
        .order("is_household_head", {
          ascending: false,
        })
        .order("last_name", {
          ascending: true,
        });

      if (error) throw error;

      setResidents(data || []);
    } catch (error) {
      console.error("Error loading residents:", error);
      alert("Failed to load household members.");
    } finally {
      setResidentsLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedHousehold(null);
    setResidents([]);
  };

  // =====================================================
  // RESIDENT FORM
  // =====================================================

  const resetResidentForm = () => {
    setResidentForm({
      first_name: "",
      middle_name: "",
      last_name: "",
      sex: "Male",
      birth_date: "",
      civil_status: "",
      relationship_to_head: "",
      contact_number: "",
      is_household_head: false,
    });

    setEditingResident(null);
  };

  const openAddResidentModal = () => {
    resetResidentForm();
    setShowResidentModal(true);
  };

  const openEditResidentModal = (resident) => {
    setEditingResident(resident);

    setResidentForm({
      first_name: resident.first_name || "",
      middle_name: resident.middle_name || "",
      last_name: resident.last_name || "",
      sex: resident.sex || "Male",
      birth_date: resident.birth_date || "",
      civil_status: resident.civil_status || "",
      relationship_to_head: resident.relationship_to_head || "",
      contact_number: resident.contact_number || "",
      is_household_head: resident.is_household_head || false,
    });

    setShowResidentModal(true);
  };

  const handleResidentChange = (e) => {
    const { name, value, type, checked } = e.target;

    setResidentForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const closeResidentModal = () => {
    if (savingResident) return;

    setShowResidentModal(false);
    resetResidentForm();
  };

  // =====================================================
  // SAVE RESIDENT
  // =====================================================

  const handleResidentSubmit = async (e) => {
    e.preventDefault();

    if (!selectedHousehold) return;

    if (!residentForm.first_name.trim()) {
      alert("Please enter the first name.");
      return;
    }

    if (!residentForm.last_name.trim()) {
      alert("Please enter the last name.");
      return;
    }

    if (!residentForm.birth_date) {
      alert("Please enter the birth date.");
      return;
    }

    try {
      setSavingResident(true);

      // Remove household head from other residents first
      if (residentForm.is_household_head) {
        const { error } = await supabase
          .from("residents")
          .update({
            is_household_head: false,
          })
          .eq("household_id", selectedHousehold.id);

        if (error) throw error;
      }

      const residentData = {
        household_id: Number(selectedHousehold.id),
        first_name: residentForm.first_name.trim(),
        middle_name: residentForm.middle_name.trim() || null,
        last_name: residentForm.last_name.trim(),
        sex: residentForm.sex,
        birth_date: residentForm.birth_date,
        civil_status: residentForm.civil_status || null,
        relationship_to_head: residentForm.relationship_to_head.trim() || null,
        contact_number: residentForm.contact_number.trim() || null,
        is_household_head: residentForm.is_household_head,
      };

      if (editingResident) {
        const { error } = await supabase
          .from("residents")
          .update(residentData)
          .eq("id", editingResident.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("residents").insert(residentData);

        if (error) throw error;
      }

      // Update household head name
      if (residentForm.is_household_head) {
        const fullName = [
          residentForm.first_name.trim(),
          residentForm.middle_name.trim(),
          residentForm.last_name.trim(),
        ]
          .filter(Boolean)
          .join(" ");

        const { error } = await supabase
          .from("households")
          .update({
            household_head: fullName,
          })
          .eq("id", selectedHousehold.id);

        if (error) console.error(error);
      }

      await fetchResidents(selectedHousehold.id);
      await fetchHouseholds();

      // Update selected household information
      const updatedHousehold = households.find(
        (h) => h.id === selectedHousehold.id,
      );

      if (updatedHousehold) {
        setSelectedHousehold({
          ...updatedHousehold,
          household_head: residentForm.is_household_head
            ? [
                residentForm.first_name.trim(),
                residentForm.middle_name.trim(),
                residentForm.last_name.trim(),
              ]
                .filter(Boolean)
                .join(" ")
            : updatedHousehold.household_head,
        });
      }

      closeResidentModal();

      alert(
        editingResident
          ? "Resident updated successfully."
          : "Resident added successfully.",
      );
    } catch (error) {
      console.error("Error saving resident:", error);
      alert(error.message || "Failed to save resident.");
    } finally {
      setSavingResident(false);
    }
  };

  // =====================================================
  // DELETE RESIDENT
  // =====================================================

  const handleDeleteResident = async (resident) => {
    const fullName = `${resident.first_name} ${resident.last_name}`;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${fullName}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("residents")
        .delete()
        .eq("id", resident.id);

      if (error) throw error;

      // Clear household head if necessary
      if (resident.is_household_head) {
        await supabase
          .from("households")
          .update({
            household_head: "",
          })
          .eq("id", selectedHousehold.id);

        setSelectedHousehold((prev) => ({
          ...prev,
          household_head: "",
        }));
      }

      await fetchResidents(selectedHousehold.id);
      await fetchHouseholds();

      alert("Resident deleted successfully.");
    } catch (error) {
      console.error("Error deleting resident:", error);
      alert(error.message || "Failed to delete resident.");
    }
  };

  // =====================================================
  // FILTER
  // =====================================================

  const filteredHouseholds = households.filter((household) => {
    const searchText = search.toLowerCase();

    return (
      household.household_code?.toLowerCase().includes(searchText) ||
      household.household_head?.toLowerCase().includes(searchText) ||
      household.local_areas?.name?.toLowerCase().includes(searchText)
    );
  });

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
              Households
            </h2>

            <p className="text-gray-500 mt-1">
              Manage households in your assigned area.
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
            Add Household
          </button>
        </div>

        {/* =====================================================
            ASSIGNED AREAS
        ===================================================== */}

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Home size={20} className="text-teal-600" />
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
            placeholder="Search households..."
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
            HOUSEHOLD TABLE
        ===================================================== */}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading households...
            </div>
          ) : filteredHouseholds.length === 0 ? (
            <div className="p-10 text-center">
              <Home size={40} className="mx-auto text-gray-300" />

              <p className="text-gray-500 mt-3">No households found.</p>

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
                Add your first household
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Household
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Household Head
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Purok/Sitio
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Members
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Contact
                    </th>

                    <th className="text-right px-6 py-4 font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredHouseholds.map((household) => (
                    <tr key={household.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {household.household_code}
                      </td>

                      <td className="px-6 py-4 text-gray-700">
                        {household.household_head}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {household.local_areas?.name || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users size={16} />
                          <span>{household.resident_count}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {household.contact_number || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {/* VIEW */}
                          <button
                            onClick={() => viewHousehold(household)}
                            title="View Household"
                            className="
                              p-2 rounded-lg
                              text-teal-600
                              hover:bg-teal-50
                            "
                          >
                            <Eye size={17} />
                          </button>

                          {/* EDIT */}
                          <button
                            onClick={() => openEditModal(household)}
                            title="Edit Household"
                            className="
                              p-2 rounded-lg
                              text-blue-600
                              hover:bg-blue-50
                            "
                          >
                            <Edit size={17} />
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() => handleDelete(household.id)}
                            title="Delete Household"
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =====================================================
            ADD / EDIT HOUSEHOLD MODAL
        ===================================================== */}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingHousehold ? "Edit Household" : "Add Household"}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Enter household information.
                  </p>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Household Code
                  </label>

                  <input
                    type="text"
                    value={form.household_code}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 outline-none"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Household Head *
                  </label>

                  <input
                    type="text"
                    name="household_head"
                    value={form.household_head}
                    onChange={handleChange}
                    placeholder="Enter household head"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number
                  </label>

                  <input
                    type="text"
                    name="contact_number"
                    value={form.contact_number}
                    onChange={handleChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="House number / street / additional address"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purok / Sitio *
                  </label>

                  <select
                    name="local_area_id"
                    value={form.local_area_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Select Purok/Sitio</option>

                    {localAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name} ({area.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium"
                  >
                    {editingHousehold ? "Save Changes" : "Add Household"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =====================================================
            HUGE HOUSEHOLD DETAILS MODAL
        ===================================================== */}

        {showDetailsModal && selectedHousehold && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5 md:p-8">
            <div className="bg-white w-full h-full max-w-7xl mx-auto rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* HEADER */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
                    <Home size={22} className="text-teal-600" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Household Details
                    </h2>

                    <p className="text-sm text-gray-500">
                      {selectedHousehold.household_code}
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeDetailsModal}
                  className="p-2.5 rounded-lg hover:bg-gray-100 transition"
                  title="Close"
                >
                  <X size={22} />
                </button>
              </div>

              {/* CONTENT */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
                {/* HOUSEHOLD INFORMATION */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">
                      Household Information
                    </h3>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Household Code
                      </p>

                      <p className="font-medium text-gray-800">
                        {selectedHousehold.household_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Household Head
                      </p>

                      <p className="font-medium text-gray-800">
                        {selectedHousehold.household_head || "Not assigned"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Purok / Sitio
                      </p>

                      <p className="font-medium text-gray-800">
                        {selectedHousehold.local_areas?.name || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Barangay</p>

                      <p className="font-medium text-gray-800">
                        {selectedHousehold.local_areas?.barangays?.name || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Contact Number
                      </p>

                      <p className="font-medium text-gray-800">
                        {selectedHousehold.contact_number || "—"}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Address</p>

                      <p className="font-medium text-gray-800">
                        {selectedHousehold.address || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RESIDENTS */}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                        <Users size={20} className="text-green-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Household Members
                        </h3>

                        <p className="text-sm text-gray-500">
                          {residents.length}{" "}
                          {residents.length === 1 ? "resident" : "residents"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openAddResidentModal}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
                    >
                      <Plus size={16} />
                      Add Resident
                    </button>
                  </div>

                  {residentsLoading ? (
                    <div className="p-10 text-center text-gray-500">
                      Loading residents...
                    </div>
                  ) : residents.length === 0 ? (
                    <div className="p-10 text-center">
                      <Users size={40} className="mx-auto text-gray-300" />

                      <p className="text-gray-500 mt-3">No residents yet.</p>

                      <button
                        onClick={openAddResidentModal}
                        className="mt-4 inline-flex items-center gap-2 text-sm text-teal-600 font-medium"
                      >
                        <Plus size={16} />
                        Add First Resident
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-white border-b border-gray-200">
                          <tr>
                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Name
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Sex
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Birth Date
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Civil Status
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Relationship
                            </th>

                            <th className="text-left px-5 py-4 font-semibold text-gray-600">
                              Contact
                            </th>

                            <th className="text-right px-5 py-4 font-semibold text-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {residents.map((resident) => (
                            <tr key={resident.id} className="hover:bg-gray-50">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center">
                                    <UserRound
                                      size={17}
                                      className="text-teal-600"
                                    />
                                  </div>

                                  <div>
                                    <p className="font-medium text-gray-800">
                                      {resident.first_name}{" "}
                                      {resident.middle_name
                                        ? `${resident.middle_name} `
                                        : ""}
                                      {resident.last_name}
                                    </p>

                                    {resident.is_household_head && (
                                      <span className="inline-flex mt-1 px-2 py-0.5 text-[11px] font-medium bg-green-100 text-green-700 rounded-full">
                                        Household Head
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.sex}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.birth_date || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.civil_status || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.relationship_to_head || "—"}
                              </td>

                              <td className="px-5 py-4 text-gray-600">
                                {resident.contact_number || "—"}
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() =>
                                      openEditResidentModal(resident)
                                    }
                                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                                    title="Edit Resident"
                                  >
                                    <Edit size={17} />
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteResident(resident)
                                    }
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                                    title="Delete Resident"
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
            ADD / EDIT RESIDENT MODAL
        ===================================================== */}

        {showResidentModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingResident ? "Edit Resident" : "Add Resident"}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Enter the resident's information.
                  </p>
                </div>

                <button
                  onClick={closeResidentModal}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleResidentSubmit} className="p-6 space-y-5">
                {/* NAME */}

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Personal Information
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>

                      <input
                        type="text"
                        name="first_name"
                        value={residentForm.first_name}
                        onChange={handleResidentChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Middle Name
                      </label>

                      <input
                        type="text"
                        name="middle_name"
                        value={residentForm.middle_name}
                        onChange={handleResidentChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>

                      <input
                        type="text"
                        name="last_name"
                        value={residentForm.last_name}
                        onChange={handleResidentChange}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SEX / BIRTH DATE */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sex *
                    </label>

                    <select
                      name="sex"
                      value={residentForm.sex}
                      onChange={handleResidentChange}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Birth Date *
                    </label>

                    <input
                      type="date"
                      name="birth_date"
                      value={residentForm.birth_date}
                      onChange={handleResidentChange}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* CIVIL / RELATIONSHIP */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Civil Status
                    </label>

                    <select
                      name="civil_status"
                      value={residentForm.civil_status}
                      onChange={handleResidentChange}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
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
                      Relationship to Household Head
                    </label>

                    <select
                      name="relationship_to_head"
                      value={residentForm.relationship_to_head}
                      onChange={handleResidentChange}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="">Select relationship</option>
                      <option value="Household Head">Household Head</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Grandchild">Grandchild</option>
                      <option value="Other Relative">Other Relative</option>
                      <option value="Non-relative">Non-relative</option>
                    </select>
                  </div>
                </div>

                {/* CONTACT */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number
                  </label>

                  <input
                    type="text"
                    name="contact_number"
                    value={residentForm.contact_number}
                    onChange={handleResidentChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* HEAD */}

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_household_head"
                      checked={residentForm.is_household_head}
                      onChange={handleResidentChange}
                      className="mt-1 w-4 h-4 text-teal-600 rounded"
                    />

                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Household Head
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        Selecting this will make this resident the household
                        head.
                      </p>
                    </div>
                  </label>
                </div>

                {/* BUTTONS */}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeResidentModal}
                    disabled={savingResident}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingResident}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50"
                  >
                    <Save size={17} />

                    {savingResident
                      ? "Saving..."
                      : editingResident
                        ? "Update Resident"
                        : "Add Resident"}
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

export default BhwHousehold;
