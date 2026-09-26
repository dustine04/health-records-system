import { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, MapPin, Loader2 } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

export default function Barangay() {
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

  // Fetch districts
  const fetchDistricts = async () => {
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching districts:", error);
      alert("Failed to load districts.");
      return;
    }

    setDistricts(data || []);
  };

  // Fetch barangays with district information
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
      alert("Failed to load barangays.");
    } else {
      setBarangays(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDistricts();
    fetchBarangays();
  }, []);

  // Add
  const handleAdd = () => {
    setEditingBarangay(null);
    setName("");
    setDistrictId("");
    setShowModal(true);
  };

  // Edit
  const handleEdit = (barangay) => {
    setEditingBarangay(barangay);
    setName(barangay.name);
    setDistrictId(barangay.district_id?.toString() || "");
    setShowModal(true);
  };

  // Save
  const handleSave = async (e) => {
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

    if (editingBarangay) {
      const { error } = await supabase
        .from("barangays")
        .update({
          name: name.trim(),
          district_id: Number(districtId),
        })
        .eq("id", editingBarangay.id);

      if (error) {
        console.error("Error updating barangay:", error);
        alert("Failed to update barangay.");
      } else {
        setShowModal(false);
        setEditingBarangay(null);
        setName("");
        setDistrictId("");

        await fetchBarangays();
      }
    } else {
      const { error } = await supabase.from("barangays").insert([
        {
          name: name.trim(),
          district_id: Number(districtId),
        },
      ]);

      if (error) {
        console.error("Error adding barangay:", error);
        alert("Failed to add barangay.");
      } else {
        setShowModal(false);
        setName("");
        setDistrictId("");

        await fetchBarangays();
      }
    }

    setSaving(false);
  };

  // Delete confirmation
  const handleDeleteClick = (barangay) => {
    setDeletingBarangay(barangay);
    setShowDeleteModal(true);
  };

  // Delete
  const handleDelete = async () => {
    if (!deletingBarangay) return;

    setSaving(true);

    const { error } = await supabase
      .from("barangays")
      .delete()
      .eq("id", deletingBarangay.id);

    if (error) {
      console.error("Error deleting barangay:", error);

      if (error.code === "23503") {
        alert(
          "This barangay cannot be deleted because it is currently being used by another record.",
        );
      } else {
        alert("Failed to delete barangay.");
      }
    } else {
      setShowDeleteModal(false);
      setDeletingBarangay(null);

      await fetchBarangays();
    }

    setSaving(false);
  };

  // Filter
  const filteredBarangays = barangays.filter((barangay) => {
    const matchesSearch = barangay.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesDistrict =
      !districtFilter || barangay.district_id?.toString() === districtFilter;

    return matchesSearch && matchesDistrict;
  });

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Barangays</h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage barangays and their assigned districts.
            </p>
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            <Plus size={18} />
            Add Barangay
          </button>
        </div>

        {/* Search & Filter */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search barangay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            <option value="">All Districts</option>

            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    #
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Barangay
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    District
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Created
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center">
                      <Loader2
                        size={24}
                        className="mx-auto animate-spin text-green-600"
                      />
                    </td>
                  </tr>
                ) : filteredBarangays.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-10 text-center text-sm text-gray-500"
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {index + 1}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
                            <MapPin size={18} />
                          </div>

                          <span className="font-medium text-gray-800">
                            {barangay.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {barangay.districts?.name || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-500">
                        {barangay.created_at
                          ? new Date(barangay.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(barangay)}
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                            title="Edit"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            onClick={() => handleDeleteClick(barangay)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                            title="Delete"
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

          {/* Mobile */}
          <div className="divide-y divide-gray-100 md:hidden">
            {loading ? (
              <div className="flex justify-center px-6 py-10">
                <Loader2 size={24} className="animate-spin text-green-600" />
              </div>
            ) : filteredBarangays.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                No barangays found.
              </div>
            ) : (
              filteredBarangays.map((barangay) => (
                <div key={barangay.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                        <MapPin size={19} />
                      </div>

                      <div>
                        <p className="font-medium text-gray-800">
                          {barangay.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          {barangay.districts?.name || "No district"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(barangay)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        onClick={() => handleDeleteClick(barangay)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingBarangay ? "Edit Barangay" : "Add Barangay"}
                </h2>

                <p className="text-sm text-gray-500">
                  {editingBarangay
                    ? "Update barangay information."
                    : "Create a new barangay."}
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={19} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6">
              {/* District */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  District
                </label>

                <select
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
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
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Barangay Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Barangay Cogon"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  autoFocus
                />
              </div>

              {/* Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}

                  {editingBarangay ? "Update Barangay" : "Add Barangay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingBarangay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={20} />
              </div>

              <h2 className="text-lg font-semibold text-gray-800">
                Delete Barangay?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-700">
                  {deletingBarangay.name}
                </span>
                ?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingBarangay(null);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
