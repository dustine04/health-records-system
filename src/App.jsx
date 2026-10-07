import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";

import AdminDashboard from "./pages/AdminDashboard";
import NurseDashboard from "./pages/NurseDashboard";
import MidwifeDashboard from "./pages/MidwifeDashboard";
import BnsDashboard from "./pages/BnsDashboard";
import BhwDashboard from "./pages/BhwDashboard";
import MidwifeMonthlyReports from "./pages/midwife/MidwifeMonthlyReports";
import MidwifeMonthlyReportDetails from "./pages/midwife/MidwifeMonthlyReportDetails";
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
import BhwMonthlyReport from "./pages/bhw/BhwMonthlyReport";

import Profile from "./pages/Profile";
import PregnancyMonitoring from "./pages/midwife/PregnancyMonitoring";
import ForgotPassword from "./pages/ForgotPassword";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =====================================================
            LOGIN
        ===================================================== */}

        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* =====================================================
            ADMIN
        ===================================================== */}

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

        {/* Admin Profile */}
        <Route
          path="/dashboard/admin/profile"
          element={
            <ProtectedRoute allowedRoles={["cho_admin"]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            NURSE
        ===================================================== */}

        <Route
          path="/dashboard/nurse"
          element={
            <ProtectedRoute allowedRoles={["nurse"]}>
              <NurseDashboard />
            </ProtectedRoute>
          }
        />

        {/* Nurse Profile */}
        <Route
          path="/dashboard/nurse/profile"
          element={
            <ProtectedRoute allowedRoles={["nurse"]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            MIDWIFE
        ===================================================== */}

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

        <Route
          path="/dashboard/midwife/pregnancy-monitoring"
          element={
            <ProtectedRoute allowedRoles={["midwife"]}>
              <PregnancyMonitoring />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/midwife/monthly-reports"
          element={
            <ProtectedRoute allowedRoles={["midwife"]}>
              <MidwifeMonthlyReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/midwife/monthly-reports/:id"
          element={
            <ProtectedRoute allowedRoles={["midwife"]}>
              <MidwifeMonthlyReportDetails />
            </ProtectedRoute>
          }
        />
        {/* Midwife Profile */}
        <Route
          path="/dashboard/midwife/profile"
          element={
            <ProtectedRoute allowedRoles={["midwife"]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            BNS
        ===================================================== */}

        <Route
          path="/dashboard/bns"
          element={
            <ProtectedRoute allowedRoles={["bns"]}>
              <BnsDashboard />
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

        {/* BNS Profile */}
        <Route
          path="/dashboard/bns/profile"
          element={
            <ProtectedRoute allowedRoles={["bns"]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* =====================================================
            BHW
        ===================================================== */}

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
          path="/dashboard/bhw/monthly-report"
          element={
            <ProtectedRoute allowedRoles={["bhw"]}>
              <BhwMonthlyReport />
            </ProtectedRoute>
          }
        />
        {/* BHW Profile */}
        <Route
          path="/dashboard/bhw/profile"
          element={
            <ProtectedRoute allowedRoles={["bhw"]}>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
