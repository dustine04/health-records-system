import DashboardLayout from "../components/DashboardLayout";

function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

        <p className="text-gray-500 mt-1">
          Welcome back, {user.first_name} {user.last_name}.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Districts</p>

          <p className="text-3xl font-bold text-gray-800 mt-2">6</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Nurses</p>

          <p className="text-3xl font-bold text-gray-800 mt-2">0</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Midwives</p>

          <p className="text-3xl font-bold text-gray-800 mt-2">0</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Health Records</p>

          <p className="text-3xl font-bold text-gray-800 mt-2">0</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <button className="border border-gray-200 rounded-lg p-5 text-left hover:bg-gray-50">
            <p className="font-semibold text-gray-800">Manage Users</p>

            <p className="text-sm text-gray-500 mt-1">
              Create and manage system accounts.
            </p>
          </button>

          <button className="border border-gray-200 rounded-lg p-5 text-left hover:bg-gray-50">
            <p className="font-semibold text-gray-800">Health Records</p>

            <p className="text-sm text-gray-500 mt-1">
              View city-wide health records.
            </p>
          </button>

          <button className="border border-gray-200 rounded-lg p-5 text-left hover:bg-gray-50">
            <p className="font-semibold text-gray-800">Reports</p>

            <p className="text-sm text-gray-500 mt-1">
              View health monitoring reports.
            </p>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboard;
