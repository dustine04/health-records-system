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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
