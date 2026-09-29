import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Loader2,
  Map,
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

export default function Barangay() {
  // =========================
  // Barangay States
  // =========================
  const [barangays, setBarangays] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingBarangay, setEditingBarangay] = useState(null);
  const [deletingBarangay, setDeletingBarangay] = useState(null);

  const [name, setName] = useState("");
  const [districtId, setDistrictId] = useState("");

  // =========================
  // Local Area States
  // =========================
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [showAreaDeleteModal, setShowAreaDeleteModal] = useState(false);

  const [selectedBarangay, setSelectedBarangay] = useState(null);

  const [localAreas, setLocalAreas] = useState([]);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaSaving, setAreaSaving] = useState(false);

  const [editingArea, setEditingArea] = useState(null);
  const [deletingArea, setDeletingArea] = useState(null);

  const [areaName, setAreaName] = useState("");
  const [areaType, setAreaType] = useState("purok");

  // =========================
  // Fetch Districts
  // =========================
  const fetchDistricts = async () => {
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching districts:", error);
      return;
    }

    setDistricts(data || []);
  };

  // =========================
  // Fetch Barangays
  // =========================
  const fetchBarangays = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("barangays")
      .select(
        `
        *,
        districts (
          id,
          name
        )
      `,
      )
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching barangays:", error);
      setLoading(false);
      return;
    }

    setBarangays(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDistricts();
    fetchBarangays();
  }, []);

  // =========================
  // Barangay Modal
  // =========================
  const openAddModal = () => {
    setEditingBarangay(null);
    setName("");
    setDistrictId("");
    setShowModal(true);
  };

  const openEditModal = (barangay) => {
    setEditingBarangay(barangay);
    setName(barangay.name);
    setDistrictId(barangay.district_id?.toString() || "");
    setShowModal(true);
  };

  const closeBarangayModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingBarangay(null);
    setName("");
    setDistrictId("");
  };

  // =========================
  // Save Barangay
  // =========================
  const handleSaveBarangay = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a barangay name.");
      return;
    }

    if (!districtId) {
      alert("Please select a district.");
      return;
    }

    setSaving(true);

    try {
      if (editingBarangay) {
        const { error } = await supabase
          .from("barangays")
          .update({
            name: name.trim(),
            district_id: Number(districtId),
          })
          .eq("id", editingBarangay.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("barangays").insert([
          {
            name: name.trim(),
            district_id: Number(districtId),
          },
        ]);

        if (error) throw error;
      }

      await fetchBarangays();
      closeBarangayModal();
    } catch (error) {
      console.error("Error saving barangay:", error);
      alert(error.message || "Failed to save barangay.");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Delete Barangay
  // =========================
  const openDeleteModal = (barangay) => {
    setDeletingBarangay(barangay);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (saving) return;

    setShowDeleteModal(false);
    setDeletingBarangay(null);
  };

  const handleDeleteBarangay = async () => {
    if (!deletingBarangay) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("barangays")
        .delete()
        .eq("id", deletingBarangay.id);

      if (error) throw error;

      await fetchBarangays();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting barangay:", error);
      alert(error.message || "Failed to delete barangay.");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Local Areas
  // =========================
  const fetchLocalAreas = async (barangayId) => {
    setAreaLoading(true);

    const { data, error } = await supabase
      .from("local_areas")
      .select("*")
      .eq("barangay_id", barangayId)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching local areas:", error);
      setLocalAreas([]);
      setAreaLoading(false);
      return;
    }

    setLocalAreas(data || []);
    setAreaLoading(false);
  };

  // =========================
  // Open Manage Areas
  // =========================
  const handleManageAreas = async (barangay) => {
    setSelectedBarangay(barangay);

    setEditingArea(null);
    setAreaName("");
    setAreaType("purok");
    setShowAreaForm(false);

    setShowAreaModal(true);

    await fetchLocalAreas(barangay.id);
  };

  const closeAreaModal = () => {
    if (areaSaving) return;

    setShowAreaModal(false);
    setShowAreaForm(false);
    setSelectedBarangay(null);
    setLocalAreas([]);
    setEditingArea(null);
    setAreaName("");
    setAreaType("purok");
  };

  // =========================
  // Add Area
  // =========================
  const openAddAreaForm = () => {
    setEditingArea(null);
    setAreaName("");
    setAreaType("purok");
    setShowAreaForm(true);
  };

  // =========================
  // Edit Area
  // =========================
  const openEditAreaForm = (area) => {
    setEditingArea(area);
    setAreaName(area.name);
    setAreaType(area.type);
    setShowAreaForm(true);
  };

  // =========================
  // Save Area
  // =========================
  const handleSaveArea = async (e) => {
    e.preventDefault();

    if (!selectedBarangay) return;

    if (!areaName.trim()) {
      alert("Please enter a Purok/Sitio name.");
      return;
    }

    setAreaSaving(true);

    try {
      if (editingArea) {
        const { error } = await supabase
          .from("local_areas")
          .update({
            name: areaName.trim(),
            type: areaType,
          })
          .eq("id", editingArea.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("local_areas").insert([
          {
            barangay_id: selectedBarangay.id,
            name: areaName.trim(),
            type: areaType,
          },
        ]);

        if (error) throw error;
      }

      await fetchLocalAreas(selectedBarangay.id);

      setEditingArea(null);
      setAreaName("");
      setAreaType("purok");
      setShowAreaForm(false);
    } catch (error) {
      console.error("Error saving local area:", error);
      alert(error.message || "Failed to save local area.");
    } finally {
      setAreaSaving(false);
    }
  };

  // =========================
  // Delete Area
  // =========================
  const openDeleteAreaModal = (area) => {
    setDeletingArea(area);
    setShowAreaDeleteModal(true);
  };

  const closeAreaDeleteModal = () => {
    if (areaSaving) return;

    setShowAreaDeleteModal(false);
    setDeletingArea(null);
  };

  const handleDeleteArea = async () => {
    if (!deletingArea || !selectedBarangay) return;

    setAreaSaving(true);

    try {
      const { error } = await supabase
        .from("local_areas")
        .delete()
        .eq("id", deletingArea.id);

      if (error) throw error;

      await fetchLocalAreas(selectedBarangay.id);

      closeAreaDeleteModal();
    } catch (error) {
      console.error("Error deleting local area:", error);
      alert(error.message || "Failed to delete local area.");
    } finally {
      setAreaSaving(false);
    }
  };

  // =========================
  // Filtering
  // =========================
  const filteredBarangays = barangays.filter((barangay) => {
    const matchesSearch = barangay.name
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchesDistrict =
      !districtFilter || barangay.district_id?.toString() === districtFilter;

    return matchesSearch && matchesDistrict;
  });

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* =========================
            Page Header
        ========================= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Barangays</h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage barangays and their Purok/Sitio areas.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Barangay
          </button>
        </div>

        {/* =========================
            Filters
        ========================= */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Search */}
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search barangay..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Districts</option>

              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* =========================
            Desktop Table
        ========================= */}
        <div className="mt-6 hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    #
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Barangay
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    District
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Created
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Loading barangays...
                      </div>
                    </td>
                  </tr>
                ) : filteredBarangays.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      No barangays found.
                    </td>
                  </tr>
                ) : (
                  filteredBarangays.map((barangay, index) => (
                    <tr
                      key={barangay.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <MapPin size={18} />
                          </div>

                          <span className="text-sm font-medium text-gray-900">
                            {barangay.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {barangay.districts?.name || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {barangay.created_at
                          ? new Date(barangay.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {/* Manage Areas */}
                          <button
                            onClick={() => handleManageAreas(barangay)}
                            title="Manage Purok/Sitio"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                          >
                            <Map size={16} />
                            Areas
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(barangay)}
                            title="Edit Barangay"
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
                          >
                            <Pencil size={17} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => openDeleteModal(barangay)}
                            title="Delete Barangay"
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
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

        {/* =========================
            Mobile Cards
        ========================= */}
        <div className="mt-6 space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Loading barangays...
              </div>
            </div>
          ) : filteredBarangays.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              No barangays found.
            </div>
          ) : (
            filteredBarangays.map((barangay) => (
              <div
                key={barangay.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <MapPin size={19} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {barangay.name}
                      </h3>

                      <p className="text-sm text-gray-500">
                        {barangay.districts?.name || "No district"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleManageAreas(barangay)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                  >
                    <Map size={16} />
                    Areas
                  </button>

                  <button
                    onClick={() => openEditModal(barangay)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-blue-600"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    onClick={() => openDeleteModal(barangay)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* =====================================================
          ADD / EDIT BARANGAY MODAL
      ===================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingBarangay ? "Edit Barangay" : "Add Barangay"}
                </h2>

                <p className="mt-0.5 text-sm text-gray-500">
                  {editingBarangay
                    ? "Update barangay information."
                    : "Add a new barangay."}
                </p>
              </div>

              <button
                onClick={closeBarangayModal}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveBarangay} className="space-y-4 p-6">
              {/* District */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  District
                </label>

                <select
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select District</option>

                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Barangay Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Barangay Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter barangay name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBarangayModal}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}

                  {editingBarangay ? "Update Barangay" : "Add Barangay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          DELETE BARANGAY MODAL
      ===================================================== */}
      {showDeleteModal && deletingBarangay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 size={22} />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Delete Barangay?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-700">
                {deletingBarangay.name}
              </span>
              ? Any Purok/Sitio areas belonging to this barangay may also be
              deleted because of the database relationship.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteBarangay}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MANAGE PUROK / SITIO MODAL
      ===================================================== */}
      {showAreaModal && selectedBarangay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Manage Purok / Sitio
                </h2>

                <p className="mt-0.5 text-sm text-gray-500">
                  {selectedBarangay.name}
                  {selectedBarangay.districts?.name
                    ? ` • ${selectedBarangay.districts.name}`
                    : ""}
                </p>
              </div>

              <button
                onClick={closeAreaModal}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6">
              {/* Add Area Button */}
              {!showAreaForm && (
                <div className="mb-5 flex justify-end">
                  <button
                    onClick={openAddAreaForm}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    <Plus size={17} />
                    Add Area
                  </button>
                </div>
              )}

              {/* Area Form */}
              {showAreaForm && (
                <form
                  onSubmit={handleSaveArea}
                  className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {editingArea ? "Edit Area" : "Add Area"}
                    </h3>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAreaForm(false);
                        setEditingArea(null);
                        setAreaName("");
                        setAreaType("purok");
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Type */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Area Type
                      </label>

                      <select
                        value={areaType}
                        onChange={(e) => setAreaType(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="purok">Purok</option>

                        <option value="sitio">Sitio</option>
                      </select>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Name
                      </label>

                      <input
                        type="text"
                        value={areaName}
                        onChange={(e) => setAreaName(e.target.value)}
                        placeholder="e.g. Purok 1"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAreaForm(false);
                        setEditingArea(null);
                        setAreaName("");
                        setAreaType("purok");
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={areaSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {areaSaving && (
                        <Loader2 size={16} className="animate-spin" />
                      )}

                      {editingArea ? "Update Area" : "Add Area"}
                    </button>
                  </div>
                </form>
              )}

              {/* Areas List */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Areas</h3>

                  <span className="text-xs text-gray-500">
                    {localAreas.length}{" "}
                    {localAreas.length === 1 ? "area" : "areas"}
                  </span>
                </div>

                {areaLoading ? (
                  <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Loading areas...
                    </div>
                  </div>
                ) : localAreas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                    <Map size={28} className="mx-auto text-gray-400" />

                    <p className="mt-2 text-sm font-medium text-gray-700">
                      No Purok or Sitio yet
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Add the local areas covered by this barangay.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="divide-y divide-gray-100">
                      {localAreas.map((area, index) => (
                        <div
                          key={area.id}
                          className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                              <MapPin size={17} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {area.name}
                              </p>

                              <span className="mt-0.5 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                                {area.type}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => openEditAreaForm(area)}
                              title="Edit area"
                              className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() => openDeleteAreaModal(area)}
                              title="Delete area"
                              className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex justify-end">
                <button
                  onClick={closeAreaModal}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          DELETE AREA MODAL
      ===================================================== */}
      {showAreaDeleteModal && deletingArea && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 size={22} />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Delete Area?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-700">
                {deletingArea.name}
              </span>
              ?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeAreaDeleteModal}
                disabled={areaSaving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteArea}
                disabled={areaSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {areaSaving && <Loader2 size={16} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
