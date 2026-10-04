import { useEffect, useState } from "react";
import {
  Users,
  Home,
  MapPin,
  ClipboardList,
  Send,
  Plus,
  ArrowRight,
  Baby,
  Activity,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

function BnsDashboard() {
  const navigate = useNavigate();

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [loading, setLoading] = useState(true);

  const [assignedAreas, setAssignedAreas] = useState([]);

  const [stats, setStats] = useState({
    households: 0,
    residents: 0,
    healthRecords: 0,
    submitted: 0,
  });

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id]);

  // =========================================================
  // FETCH DASHBOARD DATA
  // =========================================================

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // -----------------------------------------------------
      // 1. GET BNS ASSIGNED PUROK/SITIO
      // -----------------------------------------------------

      const { data: assignments, error: assignmentError } = await supabase
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

      if (assignmentError) throw assignmentError;

      const areas = (assignments || [])
        .map((item) => item.local_areas)
        .filter(Boolean);

      setAssignedAreas(areas);

      // -----------------------------------------------------
      // 2. GET HOUSEHOLDS IN ASSIGNED AREAS
      // -----------------------------------------------------

      let householdCount = 0;
      let residentCount = 0;
      let householdIds = [];

      const areaIds = areas.map((area) => area.id);

      if (areaIds.length > 0) {
        const { data: households, error: householdError } = await supabase
          .from("households")
          .select("id")
          .in("local_area_id", areaIds);

        if (householdError) throw householdError;

        householdIds = (households || []).map((household) => household.id);

        householdCount = householdIds.length;
      }

      // -----------------------------------------------------
      // 3. GET RESIDENT COUNT
      // -----------------------------------------------------

      if (householdIds.length > 0) {
        const { data: residents, error: residentError } = await supabase
          .from("residents")
          .select("id")
          .in("household_id", householdIds);

        if (residentError) throw residentError;

        residentCount = (residents || []).length;
      }

      // -----------------------------------------------------
      // 4. GET HEALTH RECORD COUNT
      // -----------------------------------------------------

      let healthRecordCount = 0;

      const { count: recordCount, error: recordsError } = await supabase
        .from("health_records")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("recorded_by", user.id);

      if (recordsError) {
        console.error("Error loading BNS health records:", recordsError);
      } else {
        healthRecordCount = recordCount || 0;
      }

      // -----------------------------------------------------
      // 5. GET SUBMITTED COUNT
      // -----------------------------------------------------

      let submittedCount = 0;

      const { count: submissionCount, error: submissionsError } = await supabase
        .from("submissions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("submitted_by", user.id);

      if (submissionsError) {
        console.error("Error loading BNS submissions:", submissionsError);
      } else {
        submittedCount = submissionCount || 0;
      }

      // -----------------------------------------------------
      // 6. UPDATE STATS
      // -----------------------------------------------------

      setStats({
        households: householdCount,
        residents: residentCount,
        healthRecords: healthRecordCount,
        submitted: submittedCount,
      });
    } catch (error) {
      console.error("Error loading BNS dashboard:", error);

      alert(error.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* =====================================================
            WELCOME
        ===================================================== */}

        <div>
          <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
            Welcome, {user.first_name}! 👋
          </h2>

          <p className="mt-1 text-gray-500">
            Barangay Nutrition Scholar — Child Health Monitoring
          </p>
        </div>

        {/* =====================================================
            ASSIGNED AREA
        ===================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50">
              <MapPin size={24} className="text-orange-600" />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">
                My Assigned Area
              </p>

              {loading ? (
                <div className="mt-2 h-6 w-56 animate-pulse rounded bg-gray-100" />
              ) : assignedAreas.length === 0 ? (
                <>
                  <h3 className="mt-1 text-lg font-semibold text-gray-800 sm:text-xl">
                    No Assigned Area
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    You currently don't have an assigned Purok/Sitio.
                  </p>
                </>
              ) : (
                <div className="mt-3 space-y-3">
                  {assignedAreas.map((area) => (
                    <div
                      key={area.id}
                      className="rounded-lg border border-orange-100 bg-orange-50/50 px-4 py-3"
                    >
                      <h3 className="text-base font-semibold text-gray-800 sm:text-lg">
                        {area.barangays?.name || "Unknown Barangay"}
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        {area.type === "purok" ? "Purok" : "Sitio"} {area.name}
                      </p>
                    </div>
                  ))}

                  <p className="text-xs text-gray-400">
                    {assignedAreas.length} assigned area
                    {assignedAreas.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =====================================================
            STATISTICS
        ===================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* HOUSEHOLDS */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Households</p>

                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {loading ? "..." : stats.households}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  In your assigned area
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <Home size={24} className="text-blue-600" />
              </div>
            </div>
          </div>

          {/* RESIDENTS */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Residents</p>

                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {loading ? "..." : stats.residents}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Registered residents
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                <Users size={24} className="text-purple-600" />
              </div>
            </div>
          </div>

          {/* HEALTH RECORDS */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Health Records
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {loading ? "..." : stats.healthRecords}
                </p>

                <p className="mt-1 text-xs text-gray-400">Records encoded</p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <Activity size={24} className="text-orange-600" />
              </div>
            </div>
          </div>

          {/* SUBMITTED */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Submitted</p>

                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {loading ? "..." : stats.submitted}
                </p>

                <p className="mt-1 text-xs text-gray-400">Sent to Midwife</p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                <Send size={24} className="text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            QUICK ACTIONS
        ===================================================== */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* HOUSEHOLDS */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <Home size={22} className="text-blue-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Households
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  View households and residents within your assigned
                  Purok/Sitio.
                </p>

                <button
                  onClick={() => navigate("/dashboard/bns/households")}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition hover:text-blue-700"
                >
                  View Households
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* CHILD MONITORING */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-50">
                <Baby size={22} className="text-green-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Child Monitoring
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Monitor children under five, including newborn tracking,
                  growth, immunization, feeding, micronutrients, deworming, and
                  follow-up.
                </p>

                <button
                  onClick={() => navigate("/dashboard/bns/child-monitoring")}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  <Baby size={17} />
                  Child Monitoring
                </button>
              </div>
            </div>
          </div>

          {/* ADD HEALTH RECORD */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50">
                <Plus size={22} className="text-orange-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Record Health Information
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Record health information collected from households and
                  community visits.
                </p>

                <button
                  onClick={() => navigate("/dashboard/bns/add-record")}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-700"
                >
                  <Plus size={17} />
                  Add Health Record
                </button>
              </div>
            </div>
          </div>

          {/* SUBMIT TO MIDWIFE */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-50">
                <Send size={22} className="text-green-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Submit to Midwife
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Review your encoded records and submit them to the assigned
                  Midwife for review.
                </p>

                <button
                  onClick={() => navigate("/dashboard/bns/submissions")}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-600 transition hover:text-green-700"
                >
                  View Submissions
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            RECENT HEALTH RECORDS
        ===================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <ClipboardList size={20} className="text-gray-500" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Recent Health Records
                </h3>

                <p className="mt-0.5 text-sm text-gray-500">
                  Recently encoded health information from your assigned area.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <ClipboardList size={22} className="text-gray-400" />
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {stats.healthRecords > 0
                ? `${stats.healthRecords} health record${
                    stats.healthRecords !== 1 ? "s" : ""
                  } encoded.`
                : "No health records yet."}
            </p>

            <button
              onClick={() => navigate("/dashboard/bns/records")}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-orange-600 transition hover:text-orange-700"
            >
              View Health Records
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default BnsDashboard;
