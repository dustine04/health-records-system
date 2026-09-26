import { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, Map, Loader2 } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

export default function District() {
  const [districts, setDistricts] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingDistrict, setEditingDistrict] = useState(null);
  const [deletingDistrict, setDeletingDistrict] = useState(null);

  const [name, setName] = useState("");

  // Fetch districts
  const fetchDistricts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching districts:", error);
      alert("Failed to load districts.");
    } else {
      setDistricts(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  // Open Add Modal
  const handleAdd = () => {
    setEditingDistrict(null);
    setName("");
    setShowModal(true);
  };

  // Open Edit Modal
  const handleEdit = (district) => {
    setEditingDistrict(district);
    setName(district.name);
    setShowModal(true);
  };

  // Save District
  const handleSave = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a district name.");
      return;
    }

    setSaving(true);

    if (editingDistrict) {
      // Update
      const { error } = await supabase
        .from("districts")
        .update({
          name: name.trim(),
        })
        .eq("id", editingDistrict.id);

      if (error) {
        console.error("Error updating district:", error);
        alert("Failed to update district.");
      } else {
        setShowModal(false);
        setName("");
        setEditingDistrict(null);
        await fetchDistricts();
      }
    } else {
      // Insert
      const { error } = await supabase.from("districts").insert([
        {
          name: name.trim(),
        },
      ]);

      if (error) {
        console.error("Error adding district:", error);
        alert("Failed to add district.");
      } else {
        setShowModal(false);
        setName("");
        await fetchDistricts();
      }
    }

    setSaving(false);
  };

  // Open Delete Confirmation
  const handleDeleteClick = (district) => {
    setDeletingDistrict(district);
    setShowDeleteModal(true);
  };

  // Delete District
  const handleDelete = async () => {
    if (!deletingDistrict) return;

    setSaving(true);

    const { error } = await supabase
      .from("districts")
      .delete()
      .eq("id", deletingDistrict.id);

    if (error) {
      console.error("Error deleting district:", error);

      if (error.code === "23503") {
        alert(
          "This district cannot be deleted because it is currently being used by another record.",
        );
      } else {
        alert("Failed to delete district.");
      }
    } else {
      setShowDeleteModal(false);
      setDeletingDistrict(null);
      await fetchDistricts();
    }

    setSaving(false);
  };

  // Search
  const filteredDistricts = districts.filter((district) =>
    district.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Districts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage health center districts.
            </p>
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            <Plus size={18} />
            Add District
          </button>
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        {/* District Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    #
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
                    <td colSpan="4" className="px-6 py-10 text-center">
                      <Loader2
                        size={24}
                        className="mx-auto animate-spin text-green-600"
                      />
                    </td>
                  </tr>
                ) : filteredDistricts.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-10 text-center text-sm text-gray-500"
                    >
                      No districts found.
                    </td>
                  </tr>
                ) : (
                  filteredDistricts.map((district, index) => (
                    <tr
                      key={district.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {index + 1}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
                            <Map size={18} />
                          </div>

                          <span className="font-medium text-gray-800">
                            {district.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-500">
                        {district.created_at
                          ? new Date(district.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(district)}
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                            title="Edit"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            onClick={() => handleDeleteClick(district)}
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

          {/* Mobile Cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {loading ? (
              <div className="flex justify-center px-6 py-10">
                <Loader2 size={24} className="animate-spin text-green-600" />
              </div>
            ) : filteredDistricts.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                No districts found.
              </div>
            ) : (
              filteredDistricts.map((district) => (
                <div key={district.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                        <Map size={19} />
                      </div>

                      <div>
                        <p className="font-medium text-gray-800">
                          {district.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          {district.created_at
                            ? new Date(district.created_at).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(district)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        onClick={() => handleDeleteClick(district)}
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
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingDistrict ? "Edit District" : "Add District"}
                </h2>

                <p className="text-sm text-gray-500">
                  {editingDistrict
                    ? "Update district information."
                    : "Create a new district."}
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
              <label className="mb-2 block text-sm font-medium text-gray-700">
                District Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. District 1"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                autoFocus
              />

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

                  {editingDistrict ? "Update District" : "Add District"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingDistrict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={20} />
              </div>

              <h2 className="text-lg font-semibold text-gray-800">
                Delete District?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-700">
                  {deletingDistrict.name}
                </span>
                ?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingDistrict(null);
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
