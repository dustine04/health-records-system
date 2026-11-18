import { useState } from "react";
import { BookOpen, Menu, HeartPulse } from "lucide-react";

import Sidebar from "./Sidebar";
import TutorialGuide from "./tutorial/TutorialGuide";

/* =========================================================
   ROLE-BASED HEADER THEMES
   Matches the color themes in Sidebar.jsx
========================================================= */

const HEADER_THEMES = {
  it_admin: {
    background: "bg-gradient-to-r from-slate-700 to-slate-900",
    border: "border-slate-600",
    button: "border-white/25 bg-white/15 hover:bg-white/25",
    iconBackground: "bg-white/15",
    roleName: "IT Administrator",
  },

  cho_admin: {
    background: "bg-gradient-to-r from-indigo-600 to-indigo-700",
    border: "border-indigo-500",
    button: "border-white/25 bg-white/15 hover:bg-white/25",
    iconBackground: "bg-white/15",
    roleName: "CHO Administrator",
  },

  nurse: {
    background: "bg-gradient-to-r from-cyan-600 to-cyan-700",
    border: "border-cyan-500",
    button: "border-white/25 bg-white/15 hover:bg-white/25",
    iconBackground: "bg-white/15",
    roleName: "Nurse",
  },

  midwife: {
    background: "bg-gradient-to-r from-teal-600 to-teal-700",
    border: "border-teal-500",
    button: "border-white/25 bg-white/15 hover:bg-white/25",
    iconBackground: "bg-white/15",
    roleName: "Midwife",
  },

  bns: {
    background: "bg-gradient-to-r from-green-600 to-emerald-700",
    border: "border-green-500",
    button: "border-white/25 bg-white/15 hover:bg-white/25",
    iconBackground: "bg-white/15",
    roleName: "Barangay Nutrition Scholar",
  },

  bhw: {
    background: "bg-gradient-to-r from-blue-600 to-blue-700",
    border: "border-blue-500",
    button: "border-white/25 bg-white/15 hover:bg-white/25",
    iconBackground: "bg-white/15",
    roleName: "Barangay Health Worker",
  },
};

/* =========================================================
   GET CURRENT LOGGED-IN USER
========================================================= */

function getCurrentUser() {
  try {
    const storedUser = localStorage.getItem("user");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.warn("Unable to read user session:", error);
    return null;
  }
}

/* =========================================================
   MAIN DASHBOARD LAYOUT
========================================================= */

function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Read the role from your existing localStorage session.
  const user = getCurrentUser();

  const role = String(user?.role || "")
    .trim()
    .toLowerCase();

  // Default to Slate when the role is unknown.
  const theme = HEADER_THEMES[role] || HEADER_THEMES.it_admin;

  const openTutorial = () => {
    window.dispatchEvent(new Event("mchms:open-tutorial"));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div
        className={`
          min-h-screen
          transition-all
          duration-300
          ease-in-out
          ${collapsed ? "lg:ml-[84px]" : "lg:ml-[272px]"}
        `}
      >
        <main className="min-h-screen min-w-0">
          {/* =================================================
              ROLE-BASED TOP HEADER
          ================================================= */}

          <header
            className={`
              sticky top-0 z-30
              flex h-20 items-center justify-between
              border-b
              px-4 sm:px-6 lg:px-8
              text-white
              shadow-sm
              transition-colors duration-300
              ${theme.background}
              ${theme.border}
            `}
          >
            {/* =============================================
                LEFT SECTION
            ============================================= */}

            <div className="flex min-w-0 items-center gap-3">
              {/* MOBILE MENU BUTTON */}

              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="
                  flex h-10 w-10 shrink-0
                  items-center justify-center
                  rounded-xl
                  text-white
                  transition
                  hover:bg-white/20
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white/70
                  lg:hidden
                "
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>

              {/* HEADER ICON */}

              <div
                className={`
                  hidden h-11 w-11 shrink-0
                  items-center justify-center
                  rounded-xl
                  text-white
                  shadow-sm
                  sm:flex
                  ${theme.iconBackground}
                `}
              >
                <HeartPulse size={24} strokeWidth={2.2} />
              </div>

              {/* SYSTEM TITLE */}

              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                  MCHMS
                </h1>

                <p className="mt-0.5 truncate text-[11px] font-medium text-white/80 sm:text-xs">
                  {theme.roleName} Dashboard
                </p>
              </div>
            </div>

            {/* =============================================
                RIGHT SECTION
            ============================================= */}

            <div className="flex shrink-0 items-center gap-3">
              {/* HELP & TUTORIALS */}

              <button
                type="button"
                onClick={openTutorial}
                className={`
                  inline-flex items-center
                  justify-center gap-2
                  rounded-xl
                  border
                  px-3 py-2.5
                  text-sm font-semibold
                  text-white
                  shadow-sm
                  transition-all duration-200
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white/70
                  ${theme.button}
                `}
                title="Open Help & Tutorials"
              >
                <BookOpen size={18} />

                <span className="hidden sm:inline">Help & Tutorials</span>

                <span className="sm:hidden">Help</span>
              </button>
            </div>
          </header>

          {/* =================================================
              PAGE CONTENT
          ================================================= */}

          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {/* =====================================================
          BUILT-IN TUTORIAL
      ===================================================== */}

      <TutorialGuide />
    </div>
  );
}

export default DashboardLayout;
