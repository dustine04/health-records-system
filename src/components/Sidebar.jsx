import {
  LayoutDashboard,
  Users,
  Map,
  FileText,
  ClipboardList,
  BarChart3,
  UserPlus,
  LogOut,
  HeartPulse,
  Building2,
  UserRound,
  Menu,
} from "lucide-react";

import { useNavigate, useLocation } from "react-router-dom";

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  if (!user) {
    return null;
  }

  const role = user.role;

  const roleNames = {
    cho_admin: "CHO Administrator",
    nurse: "Nurse",
    midwife: "Midwife",
    bns: "Barangay Nutrition Scholar",
    bhw: "Barangay Health Worker",
  };

  const menus = {
    cho_admin: [
      {
        name: "Dashboard",
        path: "/dashboard/admin",
        icon: LayoutDashboard,
      },
      {
        name: "Users",
        path: "/dashboard/admin/users",
        icon: Users,
      },
      {
        name: "Districts",
        path: "/dashboard/admin/districts",
        icon: Building2,
      },
      {
        name: "Barangays",
        path: "/dashboard/admin/barangays",
        icon: Map,
      },
      {
        name: "Health Records",
        path: "/dashboard/admin/records",
        icon: FileText,
      },
      {
        name: "Reports",
        path: "/dashboard/admin/reports",
        icon: BarChart3,
      },
    ],

    nurse: [
      {
        name: "Dashboard",
        path: "/dashboard/nurse",
        icon: LayoutDashboard,
      },
      {
        name: "Health Records",
        path: "/dashboard/nurse/records",
        icon: FileText,
      },
      {
        name: "Monitoring",
        path: "/dashboard/nurse/monitoring",
        icon: ClipboardList,
      },
      {
        name: "Reports",
        path: "/dashboard/nurse/reports",
        icon: BarChart3,
      },
    ],

    midwife: [
      {
        name: "Dashboard",
        path: "/dashboard/midwife",
        icon: LayoutDashboard,
      },
      {
        name: "Health Records",
        path: "/dashboard/midwife/records",
        icon: FileText,
      },
      {
        name: "BNS / BHW",
        path: "/dashboard/midwife/workers",
        icon: Users,
      },
      {
        name: "Submit to Nurse",
        path: "/dashboard/midwife/submissions",
        icon: ClipboardList,
      },
    ],

    bns: [
      {
        name: "Dashboard",
        path: "/dashboard/bns",
        icon: LayoutDashboard,
      },
      {
        name: "Residents",
        path: "/dashboard/bns/residents",
        icon: UserRound,
      },
      {
        name: "Health Records",
        path: "/dashboard/bns/records",
        icon: FileText,
      },
      {
        name: "Add Record",
        path: "/dashboard/bns/add-record",
        icon: UserPlus,
      },
      {
        name: "My Submissions",
        path: "/dashboard/bns/submissions",
        icon: ClipboardList,
      },
    ],

    bhw: [
      {
        name: "Dashboard",
        path: "/dashboard/bhw",
        icon: LayoutDashboard,
      },
      {
        name: "Residents",
        path: "/dashboard/bhw/residents",
        icon: UserRound,
      },
      {
        name: "Health Records",
        path: "/dashboard/bhw/records",
        icon: FileText,
      },
      {
        name: "Add Record",
        path: "/dashboard/bhw/add-record",
        icon: UserPlus,
      },
      {
        name: "My Submissions",
        path: "/dashboard/bhw/submissions",
        icon: ClipboardList,
      },
    ],
  };

  const menuItems = menus[role] || [];

  const handleLogout = () => {
    localStorage.removeItem("user");
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <aside
      className={`
    z-50
    bg-white
    border-r border-gray-200
    flex flex-col
    flex-shrink-0

    transition-all
    duration-300
    ease-in-out

    min-h-screen

    lg:relative

    ${collapsed ? "lg:w-20" : "lg:w-64"}

    fixed
    left-0
    top-0
    h-screen

    ${mobileOpen ? "translate-x-0" : "-translate-x-full"}

    lg:translate-x-0
    lg:h-auto
  `}
    >
      {/* Logo / Header */}
      <div
        className="
    h-20
    border-b border-gray-200
    flex items-center
    relative
    flex-shrink-0
    transition-all duration-300
  "
      >
        {/* ================= DESKTOP ================= */}
        <div className="hidden lg:block w-full h-full">
          {!collapsed ? (
            <>
              {/* Logo */}
              <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <div
                  className="
              w-11 h-11
              min-w-11
              rounded-xl
              bg-blue-600
              flex items-center justify-center
              shadow-sm
            "
                >
                  <HeartPulse className="text-white" size={25} />
                </div>

                {/* Logo Text */}
                <div className="w-40 overflow-hidden whitespace-nowrap">
                  <h1 className="font-bold text-gray-800 leading-tight">
                    Health Records
                  </h1>

                  <p className="text-xs text-gray-500">City Health Office</p>
                </div>
              </div>

              {/* Hamburger */}
              <button
                onClick={() => setCollapsed(true)}
                className="
            absolute
            right-4
            top-1/2
            -translate-y-1/2

            w-9 h-9
            flex items-center justify-center

            rounded-lg
            text-gray-500

            hover:bg-gray-100
            hover:text-blue-600

            transition-all duration-200
          "
                title="Collapse sidebar"
              >
                <Menu size={22} />
              </button>
            </>
          ) : (
            /* Collapsed Hamburger */
            <button
              onClick={() => setCollapsed(false)}
              className="
          absolute
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-1/2

          w-10 h-10
          flex items-center justify-center

          rounded-lg
          text-gray-500

          hover:bg-gray-100
          hover:text-blue-600

          transition-all duration-200
        "
              title="Expand sidebar"
            >
              <Menu size={24} />
            </button>
          )}
        </div>

        {/* ================= MOBILE ================= */}
        <div className="lg:hidden w-full h-full flex items-center px-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="
          w-11 h-11
          min-w-11
          rounded-xl
          bg-blue-600
          flex items-center justify-center
          shadow-sm
        "
            >
              <HeartPulse className="text-white" size={25} />
            </div>

            <div>
              <h1 className="font-bold text-gray-800 leading-tight">
                Health Records
              </h1>

              <p className="text-xs text-gray-500">City Health Office</p>
            </div>
          </div>

          {/* Mobile Close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="
        absolute
        right-4

        w-9 h-9
        flex items-center justify-center

        rounded-lg
        text-gray-500

        hover:bg-gray-100
        hover:text-blue-600

        transition
      "
            title="Close menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>
      {/* User */}
      <div
        className={`
          border-b border-gray-200
          transition-all duration-300
          ${collapsed ? "px-2 py-4" : "px-5 py-5"}
        `}
      >
        <div
          className={`
            flex items-center
            ${collapsed ? "justify-center" : "gap-3"}
          `}
        >
          <div className="w-10 h-10 min-w-10 rounded-full bg-blue-100 flex items-center justify-center">
            <UserRound className="text-blue-600" size={20} />
          </div>

          <div
            className={`
              min-w-0 overflow-hidden whitespace-nowrap
              transition-all duration-300
              ${collapsed ? "w-0 opacity-0" : "w-40 opacity-100"}
            `}
          >
            <p className="font-semibold text-gray-800 truncate">
              {user.first_name} {user.last_name}
            </p>

            <p className="text-xs text-gray-500 truncate">{roleNames[role]}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5">
        {!collapsed && (
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">
            Menu
          </p>
        )}

        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;

            const isActive = location.pathname === item.path;

            return (
              <div key={item.path} className="relative group">
                <button
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                  className={`
                    w-full
                    flex items-center
                    ${collapsed ? "justify-center px-3" : "gap-3 px-3"}
                    py-3
                    rounded-lg
                    text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }
                  `}
                >
                  <Icon size={19} className="min-w-[19px]" />

                  <span
                    className={`
                      whitespace-nowrap overflow-hidden
                      transition-all duration-300
                      ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
                    `}
                  >
                    {item.name}
                  </span>
                </button>

                {/* Tooltip */}
                {collapsed && (
                  <div
                    className="
                      absolute left-full top-1/2
                      -translate-y-1/2
                      ml-3
                      px-3 py-2
                      bg-gray-900
                      text-white
                      text-xs
                      rounded-lg
                      whitespace-nowrap
                      opacity-0
                      pointer-events-none
                      group-hover:opacity-100
                      transition-opacity
                      duration-200
                      z-50
                    "
                  >
                    {item.name}

                    <div
                      className="
                        absolute right-full top-1/2
                        -translate-y-1/2
                        border-4
                        border-transparent
                        border-r-gray-900
                      "
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-200">
        <div className="relative group">
          <button
            onClick={handleLogout}
            className={`
              w-full
              flex items-center
              ${collapsed ? "justify-center px-3" : "gap-3 px-3"}
              py-3
              rounded-lg
              text-sm font-medium
              text-red-600
              hover:bg-red-50
              transition
            `}
          >
            <LogOut size={19} className="min-w-[19px]" />

            <span
              className={`
                whitespace-nowrap overflow-hidden
                transition-all duration-300
                ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
              `}
            >
              Logout
            </span>
          </button>

          {/* Logout tooltip */}
          {collapsed && (
            <div
              className="
                absolute left-full top-1/2
                -translate-y-1/2
                ml-3
                px-3 py-2
                bg-gray-900
                text-white
                text-xs
                rounded-lg
                whitespace-nowrap
                opacity-0
                pointer-events-none
                group-hover:opacity-100
                transition-opacity
                duration-200
                z-50
              "
            >
              Logout
              <div
                className="
                  absolute right-full top-1/2
                  -translate-y-1/2
                  border-4
                  border-transparent
                  border-r-gray-900
                "
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
