import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Loader2,
  Map,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

import {
  getBarangayCache,
  saveBarangayCache,
  getAreasCache,
  saveAreasCache,
  pendingBarangayActions,
  queueBarangayEdit,
  syncBarangayActions,
} from "../../lib/adminBarangayOffline";

const userNow = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");

const inputStyle =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500";

const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50";

const normalize = (v) => String(v ?? "");

export default function Barangay() {
  const user = userNow();
  const valid = !!user?.id && user.role === "cho_admin";

  const [barangays, setBarangays] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState([]);
  const [notice, setNotice] = useState("");
  const [cachedAt, setCachedAt] = useState(null);

  const [editingBarangay, setEditingBarangay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingBarangay, setDeletingBarangay] = useState(null);
  const [name, setName] = useState("");
  const [districtId, setDistrictId] = useState("");

  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [localAreas, setLocalAreas] = useState([]);
  const [areaLoading, setAreaLoading] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaType, setAreaType] = useState("purok");
  const [deletingArea, setDeletingArea] = useState(null);

  const refreshPending = useCallback(async () => {
    const u = userNow();

    if (u?.role === "cho_admin") {
      setPending(await pendingBarangayActions(u));
    }
  }, []);

  const refreshDirectory = useCallback(async () => {
    const u = userNow();

    if (u?.role !== "cho_admin" || !u?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let cached = null;

    try {
      cached = await getBarangayCache(u);

      if (cached) {
        setBarangays(cached.barangays || []);
        setDistricts(cached.districts || []);
        setCachedAt(cached.cachedAt);
      }

      if (!navigator.onLine) {
        setNotice(
          cached
            ? "Showing cached barangays and districts."
            : "No offline cache. Load this page online first.",
        );
        return;
      }

      const [b, d] = await Promise.all([
        supabase.from("barangays").select("*,districts(id,name)").order("id"),
        supabase.from("districts").select("id,name").order("name"),
      ]);

      if (b.error) throw b.error;
      if (d.error) throw d.error;

      setBarangays(b.data || []);
      setDistricts(d.data || []);

      await saveBarangayCache(u, b.data || [], d.data || []);

      setCachedAt(Date.now());
      setNotice("");
    } catch (e) {
      setNotice(
        `Directory refresh failed: ${e.message}. ${
          cached ? "Showing cache." : ""
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAreas = useCallback(async (barangayId) => {
    const u = userNow();
    setAreaLoading(true);

    let cached = null;

    try {
      cached = await getAreasCache(u, barangayId);

      if (cached) {
        setLocalAreas(cached.areas || []);
      }

      if (!navigator.onLine) {
        if (!cached) {
          setNotice(
            "No offline area cache for this barangay. Open it online first.",
          );
        }
        return;
      }

      const { data, error } = await supabase
        .from("local_areas")
        .select("*")
        .eq("barangay_id", barangayId)
        .order("type")
        .order("name");

      if (error) throw error;

      setLocalAreas(data || []);

      await saveAreasCache(u, barangayId, data || []);
    } catch (e) {
      setNotice(
        `Area refresh failed: ${e.message}. ${cached ? "Showing cache." : ""}`,
      );
    } finally {
      setAreaLoading(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const u = userNow();

    if (u?.role !== "cho_admin" || !navigator.onLine) {
      return;
    }

    setSyncing(true);

    try {
      const count = await syncBarangayActions(u);

      await refreshPending();
      await refreshDirectory();

      if (selectedBarangay) {
        await refreshAreas(selectedBarangay.id);
      }

      setNotice(`${count} pending edit(s) synchronized successfully.`);
    } catch (e) {
      await refreshPending();

      setNotice(`Sync stopped: ${e.message}. Pending changes remain saved.`);
    } finally {
      setSyncing(false);
    }
  }, [refreshPending, refreshDirectory, refreshAreas, selectedBarangay]);

  useEffect(() => {
    refreshDirectory();
    refreshPending();
  }, [refreshDirectory, refreshPending]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      syncNow();
    };

    const off = () => {
      setOnline(false);
      setNotice("Offline: cached data available; edits can be queued.");
    };

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [syncNow]);

  const pendingKey = (table, id) =>
    pending.some(
      (p) => p.table === table && normalize(p.recordId) === normalize(id),
    );

  const filtered = useMemo(
    () =>
      barangays.filter(
        (b) =>
          b.name?.toLowerCase().includes(search.trim().toLowerCase()) &&
          (!districtFilter || normalize(b.district_id) === districtFilter),
      ),
    [barangays, search, districtFilter],
  );

  const districtName = (id) =>
    districts.find((d) => normalize(d.id) === normalize(id))?.name || "—";

  const busy = saving || syncing;

  const onlineRequired = (label) => {
    setNotice(`${label} requires an internet connection.`);
  };

  const openAddBarangay = () => {
    if (!online) {
      return onlineRequired("Adding a barangay");
    }

    setEditingBarangay(null);
    setName("");
    setDistrictId("");
    setShowModal(true);
  };

  const openEditBarangay = (b) => {
    if (pendingKey("barangays", b.id)) {
      return setNotice("Sync this barangay's pending edit first.");
    }

    setEditingBarangay(b);
    setName(b.name);
    setDistrictId(normalize(b.district_id));
    setShowModal(true);
  };

  const saveBarangay = async (e) => {
    e.preventDefault();

    if (busy) return;

    if (!name.trim() || !districtId) {
      return setNotice("Enter a barangay name and district.");
    }

    if (!districts.some((d) => normalize(d.id) === districtId)) {
      return setNotice("Select a valid district.");
    }

    if (!editingBarangay && !navigator.onLine) {
      return onlineRequired("Adding a barangay");
    }

    if (
      editingBarangay &&
      normalize(editingBarangay.district_id) !== districtId &&
      !navigator.onLine
    ) {
      return onlineRequired("Changing a barangay's district");
    }

    setSaving(true);

    try {
      if (
        editingBarangay &&
        normalize(editingBarangay.district_id) === districtId
      ) {
        if (editingBarangay.name !== name.trim()) {
          await queueBarangayEdit(userNow(), "barangays", editingBarangay, {
            name: name.trim(),
          });

          await refreshPending();
          setNotice("Barangay rename queued.");
        }
      } else if (editingBarangay) {
        const { data, error } = await supabase
          .from("barangays")
          .update({
            name: name.trim(),
            district_id: Number(districtId),
          })
          .eq("id", editingBarangay.id)
          .eq("district_id", editingBarangay.district_id)
          .select("id")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error("Server did not confirm barangay update.");
        }

        await refreshDirectory();
      } else {
        const { data, error } = await supabase
          .from("barangays")
          .insert({
            name: name.trim(),
            district_id: Number(districtId),
          })
          .select("id")
          .single();

        if (error) throw error;

        if (!data) {
          throw new Error("Server did not confirm creation.");
        }

        await refreshDirectory();
      }

      setShowModal(false);
      setEditingBarangay(null);

      if (navigator.onLine) {
        await syncNow();
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteBarangay = async () => {
    if (!deletingBarangay || busy) return;

    if (!navigator.onLine) {
      return onlineRequired("Deleting a barangay");
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("barangays")
        .delete()
        .eq("id", deletingBarangay.id)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error("Server did not confirm deletion.");
      }

      setDeletingBarangay(null);
      await refreshDirectory();
      setNotice("Barangay deleted.");
    } catch (e) {
      setNotice(
        e.code === "23503"
          ? "Cannot delete: related records reference this barangay."
          : e.message,
      );
    } finally {
      setSaving(false);
    }
  };

  const manageAreas = async (b) => {
    setSelectedBarangay(b);
    setLocalAreas([]);
    setShowAreaForm(false);
    setEditingArea(null);

    await refreshAreas(b.id);
  };

  const openAreaForm = (area) => {
    if (area && pendingKey("local_areas", area.id)) {
      return setNotice("Sync this area's pending edit first.");
    }

    if (!area && !online) {
      return onlineRequired("Adding an area");
    }

    setEditingArea(area || null);
    setAreaName(area?.name || "");
    setAreaType(area?.type || "purok");
    setShowAreaForm(true);
  };

  const saveArea = async (e) => {
    e.preventDefault();

    if (!selectedBarangay || busy) return;

    if (!areaName.trim() || !["purok", "sitio"].includes(areaType)) {
      return setNotice("Enter a valid area name and type.");
    }

    if (!editingArea && !navigator.onLine) {
      return onlineRequired("Adding an area");
    }

    setSaving(true);

    try {
      if (editingArea) {
        const changes = {};

        if (editingArea.name !== areaName.trim()) {
          changes.name = areaName.trim();
        }

        if (editingArea.type !== areaType) {
          changes.type = areaType;
        }

        if (Object.keys(changes).length) {
          await queueBarangayEdit(
            userNow(),
            "local_areas",
            editingArea,
            changes,
          );

          await refreshPending();
          setNotice("Area edit queued.");
        }
      } else {
        const { data, error } = await supabase
          .from("local_areas")
          .insert({
            barangay_id: selectedBarangay.id,
            name: areaName.trim(),
            type: areaType,
          })
          .select("id")
          .single();

        if (error) throw error;

        if (!data) {
          throw new Error("Server did not confirm area creation.");
        }

        await refreshAreas(selectedBarangay.id);
      }

      setShowAreaForm(false);
      setEditingArea(null);

      if (navigator.onLine) {
        await syncNow();
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteArea = async () => {
    if (!deletingArea || !selectedBarangay || busy) {
      return;
    }

    if (!navigator.onLine) {
      return onlineRequired("Deleting an area");
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("local_areas")
        .delete()
        .eq("id", deletingArea.id)
        .eq("barangay_id", selectedBarangay.id)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error("Server did not confirm area deletion.");
      }

      setDeletingArea(null);
      await refreshAreas(selectedBarangay.id);
      setNotice("Area deleted.");
    } catch (e) {
      setNotice(
        e.code === "23503"
          ? "Cannot delete: this area is referenced by other records."
          : e.message,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!valid) {
    return (
      <DashboardLayout>
        <div className="p-8 text-red-600">CHO Admin account required.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Barangays</h1>

            <p className="text-sm text-gray-500">
              Manage barangays and their Purok/Sitio areas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${
                online
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}

              {online ? "Online" : "Offline"}
            </span>

            <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pending.length} pending
            </span>

            <button
              type="button"
              className={`${buttonStyle} bg-blue-600 text-white`}
              disabled={!online || busy}
              onClick={syncNow}
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              Sync Now
            </button>

            <button
              type="button"
              className={`${buttonStyle} border bg-white`}
              disabled={busy || loading}
              onClick={refreshDirectory}
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              className={`${buttonStyle} bg-blue-600 text-white`}
              disabled={!online || busy}
              onClick={openAddBarangay}
            >
              <Plus size={16} />
              Add Barangay
            </button>
          </div>
        </div>

        {/* NOTICE */}
        {notice && (
          <div className="flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <span>{notice}</span>

            <button type="button" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {cachedAt && (
          <p className="text-xs text-gray-500">
            Last cached: {new Date(cachedAt).toLocaleString()}
          </p>
        )}

        {/* FILTERS */}
        <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
          <div className="relative">
            <Search size={17} className="absolute left-3 top-3 text-gray-400" />

            <input
              className={`${inputStyle} pl-10`}
              placeholder="Search barangay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={inputStyle}
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
          >
            <option value="">All Districts</option>

            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* BARANGAY TABLE */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                {[
                  "#",
                  "Barangay",
                  "District",
                  "Created",
                  "Sync",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading && !barangays.length ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <Loader2 className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500">
                    No barangays found.
                  </td>
                </tr>
              ) : (
                filtered.map((b, i) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">{i + 1}</td>

                    <td className="px-4 py-3 font-semibold">
                      <MapPin className="mr-2 inline text-blue-600" size={16} />
                      {b.name}
                    </td>

                    <td className="px-4 py-3">{districtName(b.district_id)}</td>

                    <td className="px-4 py-3">{formatDate(b.created_at)}</td>

                    <td className="px-4 py-3 text-xs">
                      {pendingKey("barangays", b.id) ? (
                        <span className="text-amber-700">Pending edit</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={`${buttonStyle} bg-blue-50 text-blue-700`}
                          onClick={() => manageAreas(b)}
                        >
                          <Map size={16} />
                          Areas
                        </button>

                        <button
                          type="button"
                          title="Edit"
                          disabled={busy || pendingKey("barangays", b.id)}
                          className="p-2 text-blue-600 disabled:opacity-40"
                          onClick={() => openEditBarangay(b)}
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          title="Delete"
                          disabled={
                            busy || !online || pendingKey("barangays", b.id)
                          }
                          className="p-2 text-red-600 disabled:opacity-40"
                          onClick={() => setDeletingBarangay(b)}
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

      {/* ADD / EDIT BARANGAY MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex justify-between">
              <h2 className="text-lg font-bold">
                {editingBarangay ? "Edit Barangay" : "Add Barangay"}
              </h2>

              <button
                type="button"
                onClick={() => !saving && setShowModal(false)}
              >
                <X />
              </button>
            </div>

            <form className="space-y-4" onSubmit={saveBarangay}>
              <label className="block text-sm font-medium">District</label>

              <select
                required
                className={inputStyle}
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
              >
                <option value="">Select District</option>

                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium">Barangay Name</label>

              <input
                required
                className={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              {!online && editingBarangay && (
                <p className="text-xs text-amber-700">
                  Only name edits can be queued offline. District changes
                  require internet.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={`${buttonStyle} border`}
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`${buttonStyle} bg-blue-600 text-white`}
                  disabled={busy}
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}

                  {editingBarangay ? "Save Barangay" : "Add Barangay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE BARANGAY */}
      {deletingBarangay && (
        <Confirm
          title="Delete Barangay?"
          detail={`Delete ${deletingBarangay.name}? Related records may prevent deletion.`}
          busy={busy}
          onCancel={() => setDeletingBarangay(null)}
          onConfirm={deleteBarangay}
        />
      )}

      {/* MANAGE AREAS MODAL */}
      {selectedBarangay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">Manage Purok / Sitio</h2>

                <p className="text-sm text-gray-500">
                  {selectedBarangay.name} ·{" "}
                  {districtName(selectedBarangay.district_id)}
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSelectedBarangay(null);
                  setShowAreaForm(false);
                }}
              >
                <X />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              {!showAreaForm && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className={`${buttonStyle} bg-blue-600 text-white`}
                    disabled={!online || busy}
                    onClick={() => openAreaForm(null)}
                  >
                    <Plus size={16} />
                    Add Area
                  </button>
                </div>
              )}

              {showAreaForm && (
                <form
                  onSubmit={saveArea}
                  className="space-y-3 rounded-xl border bg-blue-50 p-4"
                >
                  <div className="flex justify-between">
                    <h3 className="font-semibold">
                      {editingArea ? "Edit Area" : "Add Area"}
                    </h3>

                    <button
                      type="button"
                      onClick={() => setShowAreaForm(false)}
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm">Type</label>

                      <select
                        className={inputStyle}
                        value={areaType}
                        onChange={(e) => setAreaType(e.target.value)}
                      >
                        <option value="purok">Purok</option>
                        <option value="sitio">Sitio</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm">Name</label>

                      <input
                        required
                        className={inputStyle}
                        value={areaName}
                        onChange={(e) => setAreaName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={`${buttonStyle} border bg-white`}
                      onClick={() => setShowAreaForm(false)}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={busy}
                      className={`${buttonStyle} bg-blue-600 text-white`}
                    >
                      {editingArea ? "Save Area" : "Add Area"}
                    </button>
                  </div>
                </form>
              )}

              {/* AREAS LIST */}
              {areaLoading && !localAreas.length ? (
                <div className="p-8 text-center">
                  <Loader2 className="mx-auto animate-spin" />
                </div>
              ) : !localAreas.length ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
                  No Purok/Sitio areas cached or available.
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {localAreas.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{a.name}</p>

                        <p className="text-xs capitalize text-gray-500">
                          {a.type}{" "}
                          {pendingKey("local_areas", a.id) && "· Pending edit"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy || pendingKey("local_areas", a.id)}
                          className="p-2 text-blue-600 disabled:opacity-40"
                          onClick={() => openAreaForm(a)}
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          disabled={
                            !online || busy || pendingKey("local_areas", a.id)
                          }
                          className="p-2 text-red-600 disabled:opacity-40"
                          onClick={() => setDeletingArea(a)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t p-4">
              <button
                type="button"
                className={`${buttonStyle} border`}
                disabled={saving}
                onClick={() => setSelectedBarangay(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE AREA */}
      {deletingArea && (
        <Confirm
          title="Delete Area?"
          detail={`Delete ${deletingArea.name}? Areas used by households or assignments may not be deletable.`}
          busy={busy}
          onCancel={() => setDeletingArea(null)}
          onConfirm={deleteArea}
        />
      )}
    </DashboardLayout>
  );
}

function Confirm({ title, detail, busy, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <Trash2 className="mb-3 text-red-600" />

        <h2 className="text-lg font-bold">{title}</h2>

        <p className="mt-2 text-sm text-gray-600">{detail}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className={`${buttonStyle} border`}
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`${buttonStyle} bg-red-600 text-white`}
            disabled={busy}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
