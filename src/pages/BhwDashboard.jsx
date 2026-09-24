import {
  FileText,
  Send,
  UserRound,
  ClipboardList,
  ArrowRight,
  Plus,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";

function BhwDashboard() {
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
            Barangay Health Worker — Health Records
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
          {/* My Health Records */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  My Health Records
                </p>

                <p className="text-3xl font-bold text-gray-800 mt-2">0</p>

                <p className="text-xs text-gray-400 mt-1">
                  Records you've encoded
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                <FileText size={24} className="text-teal-600" />
              </div>
            </div>
          </div>

          {/* Submitted Records */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Submitted Records
                </p>

                <p className="text-3xl font-bold text-gray-800 mt-2">0</p>

                <p className="text-xs text-gray-400 mt-1">
                  Records submitted for review
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Send size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add Record */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                <Plus size={22} className="text-teal-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Add Health Record
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  Encode health information collected from residents.
                </p>

                <button
                  onClick={() => navigate("/dashboard/bhw/add-record")}
                  className="
                    mt-4
                    inline-flex items-center gap-2
                    bg-teal-600
                    hover:bg-teal-700
                    text-white
                    text-sm font-medium
                    px-4 py-2.5
                    rounded-lg
                    transition
                  "
                >
                  <Plus size={17} />
                  Add Record
                </button>
              </div>
            </div>
          </div>

          {/* Residents */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <UserRound size={22} className="text-blue-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">
                  Residents
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  View residents and manage their health information.
                </p>

                <button
                  onClick={() => navigate("/dashboard/bhw/residents")}
                  className="
                    mt-4
                    inline-flex items-center gap-2
                    text-sm font-medium
                    text-blue-600
                    hover:text-blue-700
                    transition
                  "
                >
                  View Residents
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <ClipboardList size={20} className="text-gray-500" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Recent Submissions
                </h3>

                <p className="text-sm text-gray-500 mt-0.5">
                  Your recently submitted health records.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
              <ClipboardList size={22} className="text-gray-400" />
            </div>

            <p className="text-gray-500 text-sm mt-3">No submissions yet.</p>

            <button
              onClick={() => navigate("/dashboard/bhw/submissions")}
              className="
                mt-3
                inline-flex items-center gap-2
                text-sm font-medium
                text-teal-600
                hover:text-teal-700
                transition
              "
            >
              View My Submissions
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default BhwDashboard;
