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
  UserPlus,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

function BnsHousehold() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [households, setHouseholds] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);

  const [loading, setLoading] = useState(true);

  // Household Add/Edit Modal
  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState(null);

  // Household Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState(null);

  // Residents
  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);

  // Resident Add/Edit Modal
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [residentSaving, setResidentSaving] = useState(false);

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

  // =========================================================
  // LOAD ASSIGNED PUROK/SITIO
  // =========================================================

  useEffect(() => {
    if (user?.id) {
      fetchLocalAreas();
    }
  }, [user?.id]);

  useEffect(() => {
    if (localAreas.length > 0) {
      fetchHouseholds();
    } else if (!loading) {
      setHouseholds([]);
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
      setLoading(false);
    }
  };

  // =========================================================
  // LOAD HOUSEHOLDS
  // =========================================================

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

  // =========================================================
  // HOUSEHOLD FORM
  // =========================================================

  const openAddModal = () => {
    setEditingHousehold(null);

    setForm({
      household_code: `HH-${Date.now()}`,
      household_head: "",
      contact_number: "",
      address: "",
      local_area_id: localAreas.length === 1 ? String(localAreas[0].id) : "",
    });

    setShowHouseholdModal(true);
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

    setShowHouseholdModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleHouseholdSubmit = async (e) => {
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

      setShowHouseholdModal(false);
      await fetchHouseholds();
    } catch (error) {
      console.error("Error saving household:", error);
      alert(error.message || "Failed to save household.");
    }
  };

  // =========================================================
  // DELETE HOUSEHOLD
  // =========================================================

  const handleDeleteHousehold = async (id) => {
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

  // =========================================================
  // VIEW HOUSEHOLD
  // =========================================================

  const viewHousehold = async (household) => {
    setSelectedHousehold(household);
    setResidents([]);
    setShowDetailsModal(true);

    await fetchResidents(household.id);
  };

  // =========================================================
  // FETCH RESIDENTS
  // =========================================================

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

  // =========================================================
  // REFRESH SELECTED HOUSEHOLD
  // =========================================================

  const refreshSelectedHousehold = async (householdId) => {
    try {
      const { data, error } = await supabase
        .from("households")
        .select(
          `
          id,
          household_code,
          household_head,
          contact_number,
          address,
          local_area_id,
          created_at,
          updated_at,
          local_areas (
            id,
            name,
            type,
            barangays (
              id,
              name,
              district_id
            )
          )
        `,
        )
        .eq("id", householdId)
        .single();

      if (error) throw error;

      setSelectedHousehold(data);
    } catch (error) {
      console.error("Error refreshing household:", error);
    }
  };

  // =========================================================
  // RESIDENT FORM
  // =========================================================

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
  };

  const openAddResidentModal = () => {
    setEditingResident(null);
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

  // =========================================================
  // SAVE RESIDENT
  // =========================================================

  const handleResidentSubmit = async (e) => {
    e.preventDefault();

    if (!selectedHousehold) return;

    if (!residentForm.first_name.trim() || !residentForm.last_name.trim()) {
      alert("Please enter the resident's first and last name.");
      return;
    }

    try {
      setResidentSaving(true);

      const householdId = selectedHousehold.id;

      // If this resident is becoming the household head,
      // remove household-head status from other residents first.
      if (residentForm.is_household_head) {
        const { error: headError } = await supabase
          .from("residents")
          .update({
            is_household_head: false,
          })
          .eq("household_id", householdId);

        if (headError) throw headError;
      }

      const residentData = {
        first_name: residentForm.first_name.trim(),
        middle_name: residentForm.middle_name.trim() || null,
        last_name: residentForm.last_name.trim(),
        sex: residentForm.sex,
        birth_date: residentForm.birth_date || null,
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
        const { error } = await supabase.from("residents").insert({
          ...residentData,
          household_id: householdId,
        });

        if (error) throw error;
      }

      const fullName = [
        residentForm.first_name,
        residentForm.middle_name,
        residentForm.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      // Update household head name
      if (residentForm.is_household_head) {
        const { error } = await supabase
          .from("households")
          .update({
            household_head: fullName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", householdId);

        if (error) throw error;
      } else if (editingResident?.is_household_head) {
        // If the previous household head was edited
        // and is no longer the head, clear household_head.
        const { error } = await supabase
          .from("households")
          .update({
            household_head: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", householdId);

        if (error) throw error;
      }

      setShowResidentModal(false);
      resetResidentForm();

      await fetchResidents(householdId);
      await refreshSelectedHousehold(householdId);
      await fetchHouseholds();
    } catch (error) {
      console.error("Error saving resident:", error);
      alert(error.message || "Failed to save resident.");
    } finally {
      setResidentSaving(false);
    }
  };

  // =========================================================
  // DELETE RESIDENT
  // =========================================================

  const handleDeleteResident = async (resident) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${resident.first_name} ${resident.last_name}?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("residents")
        .delete()
        .eq("id", resident.id);

      if (error) throw error;

      // Clear household head if deleted resident was the head
      if (resident.is_household_head && selectedHousehold) {
        const { error: householdError } = await supabase
          .from("households")
          .update({
            household_head: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedHousehold.id);

        if (householdError) throw householdError;
      }

      await fetchResidents(selectedHousehold.id);
      await refreshSelectedHousehold(selectedHousehold.id);
      await fetchHouseholds();
    } catch (error) {
      console.error("Error deleting resident:", error);
      alert(error.message || "Failed to delete resident.");
    }
  };

  // =========================================================
  // FILTER HOUSEHOLDS
  // =========================================================

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
            PAGE HEADER
        ===================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100">
                <Home className="h-6 w-6 text-green-600" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-800">Households</h1>

                <p className="text-sm text-gray-500">
                  Manage households and household members
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            <Plus size={18} />
            Add Household
          </button>
        </div>

        {/* =====================================================
            ASSIGNED AREAS
        ===================================================== */}

        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-green-600" />

            <span className="text-sm font-medium text-gray-700">
              Assigned Purok/Sitio:
            </span>

            <div className="flex flex-wrap gap-2">
              {localAreas.length > 0 ? (
                localAreas.map((area) => (
                  <span
                    key={area.id}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-green-700 shadow-sm"
                  >
                    {area.name}
                    {area.barangays?.name ? ` - ${area.barangays.name}` : ""}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">
                  No assigned Purok/Sitio
                </span>
              )}
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
            placeholder="Search household code, household head, or Purok/Sitio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </div>

        {/* =====================================================
            HOUSEHOLDS TABLE
        ===================================================== */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Household Code
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Household Head
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Purok/Sitio
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                    Barangay
                  </th>

                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase text-gray-500">
                    Members
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-5 py-10 text-center text-sm text-gray-500"
                    >
                      Loading households...
                    </td>
                  </tr>
                ) : filteredHouseholds.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center">
                      <Home className="mx-auto mb-3 h-10 w-10 text-gray-300" />

                      <p className="text-sm font-medium text-gray-600">
                        No households found
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Add a household to get started.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredHouseholds.map((household) => (
                    <tr
                      key={household.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-gray-800">
                        {household.household_code}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {household.household_head || "No household head"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {household.local_areas?.name || "-"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {household.local_areas?.barangays?.name || "-"}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          <Users size={14} />
                          {household.resident_count}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {/* VIEW */}
                          <button
                            onClick={() => viewHousehold(household)}
                            title="View Household"
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                          >
                            <Eye size={18} />
                          </button>

                          {/* EDIT */}
                          <button
                            onClick={() => openEditModal(household)}
                            title="Edit Household"
                            className="rounded-lg p-2 text-green-600 transition hover:bg-green-50"
                          >
                            <Edit size={18} />
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() => handleDeleteHousehold(household.id)}
                            title="Delete Household"
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =====================================================
            ADD / EDIT HOUSEHOLD MODAL
        ===================================================== */}

        {showHouseholdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {editingHousehold ? "Edit Household" : "Add Household"}
                  </h2>

                  <p className="text-sm text-gray-500">
                    Enter household information
                  </p>
                </div>

                <button
                  onClick={() => setShowHouseholdModal(false)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleHouseholdSubmit} className="space-y-4 p-6">
                {/* Household Code */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Household Code
                  </label>

                  <input
                    type="text"
                    name="household_code"
                    value={form.household_code}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* Household Head */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Household Head
                  </label>

                  <input
                    type="text"
                    name="household_head"
                    value={form.household_head}
                    onChange={handleChange}
                    placeholder="Enter household head"
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* Contact */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Contact Number
                  </label>

                  <input
                    type="text"
                    name="contact_number"
                    value={form.contact_number}
                    onChange={handleChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows="3"
                    placeholder="House number, street, etc."
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* Purok/Sitio */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Purok/Sitio
                  </label>

                  <select
                    name="local_area_id"
                    value={form.local_area_id}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Select Purok/Sitio</option>

                    {localAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                        {area.barangays?.name
                          ? ` - ${area.barangays.name}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowHouseholdModal(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
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
          <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-5">
            <div className="mx-auto flex h-full max-h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}
              <div className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                    <Home className="h-6 w-6 text-green-600" />
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
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedHousehold(null);
                    setResidents([]);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {/* CONTENT */}
              <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                {/* HOUSEHOLD INFORMATION */}
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Home size={19} className="text-green-600" />

                    <h3 className="font-semibold text-gray-800">
                      Household Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        Household Code
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {selectedHousehold.household_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        Household Head
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {selectedHousehold.household_head ||
                          "No household head"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        Contact Number
                      </p>

                      <p className="mt-1 text-sm text-gray-700">
                        {selectedHousehold.contact_number || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        Barangay
                      </p>

                      <p className="mt-1 text-sm text-gray-700">
                        {selectedHousehold.local_areas?.barangays?.name || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        Purok/Sitio
                      </p>

                      <p className="mt-1 text-sm text-gray-700">
                        {selectedHousehold.local_areas?.name || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        Address
                      </p>

                      <p className="mt-1 text-sm text-gray-700">
                        {selectedHousehold.address || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RESIDENTS */}
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                        <Users size={18} className="text-green-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800">
                          Household Members
                        </h3>

                        <p className="text-xs text-gray-500">
                          {residents.length} member
                          {residents.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openAddResidentModal}
                      className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      <UserPlus size={17} />
                      Add Member
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                      <thead className="bg-gray-50">
                        <tr className="border-b">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                            Name
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                            Sex
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                            Birth Date
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                            Civil Status
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                            Relationship
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                            Contact
                          </th>

                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {residentsLoading ? (
                          <tr>
                            <td
                              colSpan="7"
                              className="px-5 py-10 text-center text-sm text-gray-500"
                            >
                              Loading household members...
                            </td>
                          </tr>
                        ) : residents.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="px-5 py-10 text-center">
                              <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />

                              <p className="text-sm font-medium text-gray-600">
                                No household members yet
                              </p>

                              <p className="mt-1 text-xs text-gray-400">
                                Click "Add Member" to add a resident.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          residents.map((resident) => (
                            <tr
                              key={resident.id}
                              className="border-b last:border-0 hover:bg-gray-50"
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800">
                                    {resident.first_name}{" "}
                                    {resident.middle_name
                                      ? `${resident.middle_name} `
                                      : ""}
                                    {resident.last_name}
                                  </span>

                                  {resident.is_household_head && (
                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                      HEAD
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.sex || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.birth_date
                                  ? new Date(
                                      resident.birth_date,
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.civil_status || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.relationship_to_head || "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-600">
                                {resident.contact_number || "-"}
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() =>
                                      openEditResidentModal(resident)
                                    }
                                    title="Edit Member"
                                    className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                                  >
                                    <Edit size={17} />
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteResident(resident)
                                    }
                                    title="Delete Member"
                                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex shrink-0 justify-end border-t bg-white px-6 py-4">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedHousehold(null);
                    setResidents([]);
                  }}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            ADD / EDIT RESIDENT MODAL
        ===================================================== */}

        {showResidentModal && selectedHousehold && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {editingResident
                      ? "Edit Household Member"
                      : "Add Household Member"}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {selectedHousehold.household_code}
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!residentSaving) {
                      setShowResidentModal(false);
                      resetResidentForm();
                    }
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleResidentSubmit} className="space-y-5 p-6">
                {/* NAME */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-800">
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        First Name
                      </label>

                      <input
                        type="text"
                        name="first_name"
                        value={residentForm.first_name}
                        onChange={handleResidentChange}
                        required
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Middle Name
                      </label>

                      <input
                        type="text"
                        name="middle_name"
                        value={residentForm.middle_name}
                        onChange={handleResidentChange}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Last Name
                      </label>

                      <input
                        type="text"
                        name="last_name"
                        value={residentForm.last_name}
                        onChange={handleResidentChange}
                        required
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      />
                    </div>
                  </div>
                </div>

                {/* BASIC DETAILS */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Sex
                    </label>

                    <select
                      name="sex"
                      value={residentForm.sex}
                      onChange={handleResidentChange}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Birth Date
                    </label>

                    <input
                      type="date"
                      name="birth_date"
                      value={residentForm.birth_date}
                      onChange={handleResidentChange}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Civil Status
                    </label>

                    <select
                      name="civil_status"
                      value={residentForm.civil_status}
                      onChange={handleResidentChange}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    >
                      <option value="">Select Civil Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Relationship to Household Head
                    </label>

                    <select
                      name="relationship_to_head"
                      value={residentForm.relationship_to_head}
                      onChange={handleResidentChange}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    >
                      <option value="">Select Relationship</option>
                      <option value="Household Head">Household Head</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Grandchild">Grandchild</option>
                      <option value="Relative">Relative</option>
                      <option value="Non-relative">Non-relative</option>
                    </select>
                  </div>
                </div>

                {/* CONTACT */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Contact Number
                  </label>

                  <input
                    type="text"
                    name="contact_number"
                    value={residentForm.contact_number}
                    onChange={handleResidentChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* HOUSEHOLD HEAD */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-green-100 bg-green-50 p-4">
                  <input
                    type="checkbox"
                    name="is_household_head"
                    checked={residentForm.is_household_head}
                    onChange={handleResidentChange}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />

                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      This resident is the household head
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Selecting this will automatically remove the
                      household-head status from other members.
                    </p>
                  </div>
                </label>

                {/* BUTTONS */}
                <div className="flex justify-end gap-3 border-t pt-5">
                  <button
                    type="button"
                    disabled={residentSaving}
                    onClick={() => {
                      setShowResidentModal(false);
                      resetResidentForm();
                    }}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={residentSaving}
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {residentSaving
                      ? "Saving..."
                      : editingResident
                        ? "Save Changes"
                        : "Add Member"}
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

export default BnsHousehold;
