import {
  FileText,
  Clock,
  Users,
  ClipboardList,
  ArrowRight,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";

function MidwifeDashboard() {
  const navigate = useNavigate();

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Welcome, {user.first_name}! 👋
          </h2>

          <p className="text-gray-500 mt-1">
            Manage and review barangay health records submitted by BNS and BHW.
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Health Records */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Health Records
                </p>

                <p className="text-3xl font-bold text-gray-800 mt-2">0</p>

                <p className="text-xs text-gray-400 mt-1">Total records</p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText size={24} className="text-blue-600" />
              </div>
            </div>
          </div>

          {/* Pending Records */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Pending Records
                </p>

                <p className="text-3xl font-bold text-gray-800 mt-2">0</p>

                <p className="text-xs text-gray-400 mt-1">Waiting for review</p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
                <Clock size={24} className="text-yellow-600" />
              </div>
            </div>
          </div>

          {/* BNS / BHW */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">BNS / BHW</p>

                <p className="text-3xl font-bold text-gray-800 mt-2">0</p>

                <p className="text-xs text-gray-400 mt-1">Assigned workers</p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <Users size={24} className="text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Review Records */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={22} className="text-blue-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Review Health Records
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  Review and manage health records submitted by BNS and BHW.
                </p>

                <button
                  onClick={() => navigate("/dashboard/midwife/records")}
                  className="
                    mt-4
                    inline-flex items-center gap-2
                    text-sm font-medium
                    text-blue-600
                    hover:text-blue-700
                    transition
                  "
                >
                  View Health Records
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Manage Workers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Users size={22} className="text-purple-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  BNS / BHW Management
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  View and manage the BNS and BHW workers assigned to your
                  barangay.
                </p>

                <button
                  onClick={() => navigate("/dashboard/midwife/workers")}
                  className="
                    mt-4
                    inline-flex items-center gap-2
                    text-sm font-medium
                    text-purple-600
                    hover:text-purple-700
                    transition
                  "
                >
                  View Workers
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Recent Activity
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Recent health record submissions and updates.
            </p>
          </div>

          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
              <ClipboardList size={22} className="text-gray-400" />
            </div>

            <p className="text-gray-500 text-sm mt-3">No recent activity.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default MidwifeDashboard;
