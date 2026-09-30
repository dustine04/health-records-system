import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";

import AdminDashboard from "./pages/AdminDashboard";
import NurseDashboard from "./pages/NurseDashboard";
import MidwifeDashboard from "./pages/MidwifeDashboard";
import BnsDashboard from "./pages/BnsDashboard";
import BhwDashboard from "./pages/BhwDashboard";
import Users from "./pages/admin/Users";
import Workers from "./pages/midwife/Workers";
import District from "./pages/admin/District";
import Barangay from "./pages/admin/Barangay";
import ProtectedRoute from "./components/ProtectedRoute";
import BhwHousehold from "./pages/bhw/BhwHousehold";
import BnsHousehold from "./pages/bns/BnsHousehold";
import ChildMonitoring from "./pages/bns/ChildMonitoring";
import ChildRegistration from "./pages/bns/ChildRegistration";
import BhwPregnantWomen from "./pages/bhw/BhwPregnantWomen";
import BhwPregnantMonitoring from "./pages/bhw/BhwPregnantMonitoring";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />

        {/* Admin */}
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={["cho_admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/users"
          element={
            <ProtectedRoute allowedRoles={["cho_admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/districts"
          element={
            <ProtectedRoute allowedRoles={["cho_admin"]}>
              <District />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/barangays"
          element={
            <ProtectedRoute allowedRoles={["cho_admin"]}>
              <Barangay />
            </ProtectedRoute>
          }
        />

        {/* Nurse */}
        <Route
          path="/dashboard/nurse"
          element={
            <ProtectedRoute allowedRoles={["nurse"]}>
              <NurseDashboard />
            </ProtectedRoute>
          }
        />

        {/* Midwife */}
        <Route
          path="/dashboard/midwife"
          element={
            <ProtectedRoute allowedRoles={["midwife"]}>
              <MidwifeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/midwife/workers"
          element={
            <ProtectedRoute allowedRoles={["midwife"]}>
              <Workers />
            </ProtectedRoute>
          }
        />

        {/* BNS */}
        <Route
          path="/dashboard/bns"
          element={
            <ProtectedRoute allowedRoles={["bns"]}>
              <BnsDashboard />
            </ProtectedRoute>
          }
        />

        {/* BHW */}
        <Route
          path="/dashboard/bhw"
          element={
            <ProtectedRoute allowedRoles={["bhw"]}>
              <BhwDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/bhw/households"
          element={
            <ProtectedRoute allowedRoles={["bhw"]}>
              <BhwHousehold />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/bhw/pregnant-women"
          element={
            <ProtectedRoute allowedRoles={["bhw"]}>
              <BhwPregnantWomen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/bhw/pregnant-monitoring"
          element={
            <ProtectedRoute allowedRoles={["bhw"]}>
              <BhwPregnantMonitoring />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/bns/households"
          element={
            <ProtectedRoute allowedRoles={["bns"]}>
              <BnsHousehold />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/bns/child-registration"
          element={
            <ProtectedRoute allowedRoles={["bns"]}>
              <ChildRegistration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/bns/child-monitoring"
          element={
            <ProtectedRoute allowedRoles={["bns"]}>
              <ChildMonitoring />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
