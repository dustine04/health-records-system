import { useState } from "react";
import Sidebar from "./Sidebar";

function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileOpen && (
        <div
          className="
            fixed
            inset-0
            z-40
            bg-black/30
            lg:hidden
          "
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
          Sidebar is fixed, so add matching left margin
          on desktop.
      ===================================================== */}

      <div
        className={`
          min-h-screen
          transition-all
          duration-300
          ease-in-out

          ${collapsed ? "lg:ml-20" : "lg:ml-64"}
        `}
      >
        <main
          className="
            min-w-0
            min-h-screen
          "
        >
          {/* =================================================
              TOP BAR
          ================================================= */}

          <header
            className="
              h-20
              bg-white
              border-b border-gray-200

              flex
              items-center

              px-4
              sm:px-6
              lg:px-8

              sticky
              top-0
              z-30
            "
          >
            {/* ================= MOBILE HAMBURGER ================= */}

            <button
              onClick={() => setMobileOpen(true)}
              className="
                lg:hidden
                mr-4

                w-10
                h-10

                flex
                items-center
                justify-center

                rounded-lg

                text-gray-600

                hover:bg-gray-100
                hover:text-blue-600

                transition
              "
              aria-label="Open menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>

            {/* ================= TITLE ================= */}

            <div>
              <p className="text-xs sm:text-sm text-gray-500">
                City Health Office
              </p>

              <h1 className="text-base sm:text-lg font-semibold text-gray-800">
                MCHMS
              </h1>
            </div>
          </header>

          {/* =================================================
              PAGE CONTENT
          ================================================= */}

          <div
            className="
              p-4
              sm:p-6
              lg:p-8
            "
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
