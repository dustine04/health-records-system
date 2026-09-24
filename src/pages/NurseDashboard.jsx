import DashboardLayout from "../components/DashboardLayout";

function NurseDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

        <p className="text-gray-500 mt-1">
          Welcome back, {user.first_name} {user.last_name}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Barangays</p>

          <p className="text-3xl font-bold mt-2">0</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Submitted Records</p>

          <p className="text-3xl font-bold mt-2">0</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500">Pending Reviews</p>

          <p className="text-3xl font-bold mt-2">0</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold">District Health Records</h3>

        <p className="text-gray-500 mt-2">
          View and monitor submitted health records from assigned barangays.
        </p>
      </div>
    </DashboardLayout>
  );
}

export default NurseDashboard;
