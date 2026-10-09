import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Map,
  FileText,
  ClipboardList,
  BarChart3,
  LogOut,
  HeartPulse,
  Building2,
  UserRound,
  Menu,
  FileCheck2,
  Baby,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Stethoscope,
  Sparkles,
} from "lucide-react";

const ROLE_NAMES = {
  cho_admin: "CHO Administrator",
  nurse: "Nurse",
  midwife: "Midwife",
  bns: "Barangay Nutrition Scholar",
  bhw: "Barangay Health Worker",
};

const PROFILE_ROUTES = {
  cho_admin: "/dashboard/admin/profile",
  nurse: "/dashboard/nurse/profile",
  midwife: "/dashboard/midwife/profile",
  bns: "/dashboard/bns/profile",
  bhw: "/dashboard/bhw/profile",
};

// Each role gets its own accent color.
const ROLE_THEMES = {
  cho_admin: {
    name: "Indigo",
    accent: "bg-indigo-600",
    accentHover: "hover:bg-indigo-700",
    accentText: "text-indigo-600",
    light: "bg-indigo-50",
    lightHover: "hover:bg-indigo-100",
    border: "border-indigo-200",
    ring: "focus-visible:ring-indigo-500",
    active: "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100",
    logo: "bg-gradient-to-br from-indigo-500 to-indigo-700",
    avatar: "bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700",
  },

  nurse: {
    name: "Cyan",
    accent: "bg-cyan-600",
    accentHover: "hover:bg-cyan-700",
    accentText: "text-cyan-700",
    light: "bg-cyan-50",
    lightHover: "hover:bg-cyan-100",
    border: "border-cyan-200",
    ring: "focus-visible:ring-cyan-500",
    active: "bg-cyan-50 text-cyan-800 shadow-sm ring-1 ring-cyan-100",
    logo: "bg-gradient-to-br from-cyan-500 to-cyan-700",
    avatar: "bg-gradient-to-br from-cyan-100 to-sky-100 text-cyan-800",
    dot: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-800",
  },

  midwife: {
    name: "Teal",
    accent: "bg-teal-600",
    accentHover: "hover:bg-teal-700",
    accentText: "text-teal-700",
    light: "bg-teal-50",
    lightHover: "hover:bg-teal-100",
    border: "border-teal-200",
    ring: "focus-visible:ring-teal-500",
    active: "bg-teal-50 text-teal-800 shadow-sm ring-1 ring-teal-100",
    logo: "bg-gradient-to-br from-teal-500 to-teal-700",
    avatar: "bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-800",
    dot: "bg-teal-500",
    badge: "bg-teal-50 text-teal-800",
  },

  bns: {
    name: "Green",
    accent: "bg-green-600",
    accentHover: "hover:bg-green-700",
    accentText: "text-green-700",
    light: "bg-green-50",
    lightHover: "hover:bg-green-100",
    border: "border-green-200",
    ring: "focus-visible:ring-green-500",
    active: "bg-green-50 text-green-800 shadow-sm ring-1 ring-green-100",
    logo: "bg-gradient-to-br from-green-500 to-emerald-700",
    avatar: "bg-gradient-to-br from-green-100 to-lime-100 text-green-800",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-800",
  },

  bhw: {
    name: "Blue",
    accent: "bg-blue-600",
    accentHover: "hover:bg-blue-700",
    accentText: "text-blue-700",
    light: "bg-blue-50",
    lightHover: "hover:bg-blue-100",
    border: "border-blue-200",
    ring: "focus-visible:ring-blue-500",
    active: "bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-100",
    logo: "bg-gradient-to-br from-blue-500 to-blue-700",
    avatar: "bg-gradient-to-br from-blue-100 to-sky-100 text-blue-800",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-800",
  },
};

const MENUS = {
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
      name: "BNS / BHW",
      path: "/dashboard/midwife/workers",
      icon: Users,
    },
    {
      name: "Pregnancy Monitoring",
      path: "/dashboard/midwife/pregnancy-monitoring",
      icon: HeartPulse,
    },
    {
      name: "BHW Monthly Reports",
      path: "/dashboard/midwife/monthly-reports",
      icon: FileCheck2,
    },
    {
      name: "BNS Child Reports",
      path: "/dashboard/midwife/bns-reports",
      icon: Baby,
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
      name: "Households",
      path: "/dashboard/bns/households",
      icon: UserRound,
    },
    {
      name: "Child Registration",
      path: "/dashboard/bns/child-registration",
      icon: Baby,
    },
    {
      name: "Child Monitoring",
      path: "/dashboard/bns/child-monitoring",
      icon: Activity,
    },
    {
      name: "Monthly Child Report",
      path: "/dashboard/bns/monthly-report",
      icon: FileText,
    },
  ],

  bhw: [
    {
      name: "Dashboard",
      path: "/dashboard/bhw",
      icon: LayoutDashboard,
    },
    {
      name: "Household",
      path: "/dashboard/bhw/households",
      icon: UserRound,
    },
    {
      name: "Pregnant Women",
      path: "/dashboard/bhw/pregnant-women",
      icon: Baby,
    },
    {
      name: "Pregnant Monitoring",
      path: "/dashboard/bhw/pregnant-monitoring",
      icon: HeartPulse,
    },
    {
      name: "Monthly Report",
      path: "/dashboard/bhw/monthly-report",
      icon: FileCheck2,
    },
  ],
};

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Safely read the current account.
  let user = null;

  try {
    const storedUser = localStorage.getItem("user");
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  if (!user || !user.role) {
    return null;
  }

  const role = user.role;
  const theme = ROLE_THEMES[role] || ROLE_THEMES.bhw;
  const roleName = ROLE_NAMES[role] || "Healthcare Worker";
  const menuItems = MENUS[role] || [];

  const firstName = user.first_name || "";
  const lastName = user.last_name || "";

  const fullName = `${firstName} ${lastName}`.trim() || user.username || "User";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";

  const navigateTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleProfileClick = () => {
    const path = PROFILE_ROUTES[role];

    if (path) {
      navigateTo(path);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(false);
    setMobileOpen(false);

    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  // Dashboard remains active for its nested routes only when
  // there is no more specific menu entry matching the URL.
  const activeMenuPath = [...menuItems]
    .filter(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  const isProfileActive = location.pathname === PROFILE_ROUTES[role];

  return (
    <>
      {/* MOBILE BACKDROP */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed left-0 top-0 z-50
          flex h-dvh flex-col
          border-r border-slate-200/80
          bg-white
          shadow-xl shadow-slate-900/5
          transition-[width,transform] duration-300 ease-in-out
          lg:shadow-none
          ${collapsed ? "lg:w-[84px]" : "lg:w-[272px]"}
          w-[272px]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* BRAND HEADER */}
        <div
          className={`
            relative flex h-[76px] shrink-0 items-center
            border-b border-slate-100
            ${collapsed ? "lg:justify-center lg:px-2" : "justify-between px-5"}
            px-5
          `}
        >
          <button
            type="button"
            onClick={() => navigateTo(MENUS[role]?.[0]?.path || "/")}
            className={`
              group flex min-w-0 items-center gap-3 rounded-xl
              text-left outline-none
              focus-visible:ring-2 ${theme.ring}
              ${collapsed ? "lg:justify-center" : ""}
            `}
            title="Go to dashboard"
          >
            <div
              className={`
                relative flex h-11 w-11 shrink-0 items-center
                justify-center rounded-2xl text-white
                shadow-lg transition duration-300
                group-hover:scale-105 group-hover:shadow-xl
                ${theme.logo}
              `}
            >
              <HeartPulse size={25} strokeWidth={2.2} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>

            <div
              className={`
                min-w-0 overflow-hidden whitespace-nowrap
                transition-all duration-200
                ${collapsed ? "lg:hidden" : ""}
              `}
            >
              <h1 className="text-[15px] font-extrabold tracking-tight text-slate-900">
                MCHMS
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                City Health Office
              </p>
            </div>
          </button>

          {/* DESKTOP COLLAPSE */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`
              hidden h-8 w-8 shrink-0 items-center justify-center
              rounded-lg text-slate-400
              transition hover:bg-slate-100 hover:text-slate-700
              focus-visible:outline-none focus-visible:ring-2 ${theme.ring}
              lg:flex
              ${collapsed ? "lg:absolute lg:-right-3 lg:top-6 lg:z-10 lg:bg-white lg:shadow-sm lg:ring-1 lg:ring-slate-200" : ""}
            `}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>

          {/* MOBILE CLOSE */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* USER PROFILE CARD */}
        <div
          className={`
            shrink-0 px-3 py-4
            ${collapsed ? "lg:px-2" : "lg:px-4"}
          `}
        >
          <button
            type="button"
            onClick={handleProfileClick}
            title={collapsed ? `${fullName} — My Profile` : "View my profile"}
            className={`
              group flex w-full items-center gap-3 rounded-2xl
              border border-slate-100 bg-slate-50/80 p-3
              text-left transition duration-200
              hover:border-slate-200 hover:bg-white hover:shadow-sm
              focus-visible:outline-none focus-visible:ring-2 ${theme.ring}
              ${collapsed ? "lg:justify-center lg:border-transparent lg:bg-transparent lg:p-1 lg:hover:bg-slate-100 lg:hover:shadow-none" : ""}
              ${isProfileActive ? `${theme.light} ${theme.border}` : ""}
            `}
          >
            <div
              className={`
                relative flex h-10 w-10 shrink-0 items-center
                justify-center rounded-xl text-sm font-bold
                ${theme.avatar}
              `}
            >
              {initials}
              <span
                className={`
                  absolute -bottom-0.5 -right-0.5
                  h-3 w-3 rounded-full border-2 border-white
                  ${theme.dot}
                `}
              />
            </div>

            <div
              className={`
                min-w-0 flex-1 overflow-hidden
                ${collapsed ? "lg:hidden" : ""}
              `}
            >
              <p className="truncate text-sm font-bold text-slate-800">
                {fullName}
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`
                    h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}
                  `}
                />
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {roleName}
                </p>
              </div>

              <p
                className={`mt-2 text-[11px] font-semibold ${theme.accentText}`}
              >
                View profile
              </p>
            </div>

            {!collapsed && (
              <ChevronRight
                size={16}
                className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
              />
            )}
          </button>
        </div>

        {/* NAVIGATION */}
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4"
        >
          <div
            className={`
              mb-3 flex items-center
              ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}
            `}
          >
            {!collapsed ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Workspace
              </p>
            ) : (
              <div className="hidden h-px w-8 bg-slate-200 lg:block" />
            )}
          </div>

          <div className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenuPath === item.path;

              return (
                <div key={item.path} className="group relative">
                  <button
                    type="button"
                    onClick={() => navigateTo(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? item.name : undefined}
                    className={`
                      relative flex w-full items-center gap-3
                      overflow-hidden rounded-xl
                      px-3 py-3 text-[13px] font-medium
                      outline-none transition-all duration-200
                      focus-visible:ring-2 ${theme.ring}
                      ${collapsed ? "lg:justify-center lg:px-0" : ""}
                      ${
                        isActive
                          ? theme.active
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span
                        className={`
                          absolute bottom-2 left-0 top-2 w-[3px]
                          rounded-r-full ${theme.accent}
                          ${collapsed ? "lg:hidden" : ""}
                        `}
                      />
                    )}

                    <span
                      className={`
                        flex h-9 w-9 shrink-0 items-center justify-center
                        rounded-xl transition-all duration-200
                        ${
                          isActive
                            ? `${theme.light} ${theme.accentText}`
                            : "text-slate-400 group-hover:bg-white group-hover:text-slate-700"
                        }
                        ${collapsed ? "lg:h-10 lg:w-10" : ""}
                      `}
                    >
                      <Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} />
                    </span>

                    <span
                      className={`
                        min-w-0 flex-1 truncate text-left
                        ${collapsed ? "lg:hidden" : ""}
                      `}
                    >
                      {item.name}
                    </span>

                    {isActive && !collapsed && (
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}`}
                      />
                    )}
                  </button>

                  {/* Collapsed navigation tooltip */}
                  {collapsed && (
                    <div
                      className="
                        pointer-events-none absolute left-full top-1/2 z-[70]
                        ml-3 -translate-y-1/2 translate-x-1
                        whitespace-nowrap rounded-lg bg-slate-900
                        px-3 py-2 text-xs font-medium text-white
                        opacity-0 shadow-xl transition-all duration-150
                        group-hover:translate-x-0 group-hover:opacity-100
                        hidden lg:block
                      "
                    >
                      {item.name}
                      <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-900" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* BOTTOM AREA — FIXED */}
        <div className="shrink-0 border-t border-slate-100 bg-white p-3">
          {!collapsed && (
            <div className={`mb-3 rounded-xl p-3 ${theme.light}`}>
              <div className="flex items-center gap-2">
                <div
                  className={`
                    flex h-8 w-8 shrink-0 items-center justify-center
                    rounded-lg bg-white ${theme.accentText}
                  `}
                >
                  <ShieldCheck size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-700">
                    Authorized access
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {roleName}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="group relative">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              title={collapsed ? "Logout" : undefined}
              className={`
                flex w-full items-center gap-3 rounded-xl
                border border-transparent px-3 py-3
                text-[13px] font-semibold text-slate-500
                transition-all duration-200
                hover:border-red-100 hover:bg-red-50 hover:text-red-600
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
              `}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:bg-white">
                <LogOut size={19} />
              </span>

              <span className={collapsed ? "lg:hidden" : ""}>Sign out</span>
            </button>

            {collapsed && (
              <div
                className="
                  pointer-events-none absolute bottom-2 left-full z-[70]
                  ml-3 translate-x-1 whitespace-nowrap rounded-lg
                  bg-slate-900 px-3 py-2 text-xs text-white
                  opacity-0 shadow-xl transition-all duration-150
                  group-hover:translate-x-0 group-hover:opacity-100
                  hidden lg:block
                "
              >
                Sign out
              </div>
            )}
          </div>

          {!collapsed && (
            <p className="mt-3 text-center text-[10px] text-slate-400">
              MCHMS · City Health Office · 2026
            </p>
          )}
        </div>
      </aside>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`
                    flex h-9 w-9 items-center justify-center
                    rounded-xl ${theme.light} ${theme.accentText}
                  `}
                >
                  <HeartPulse size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">MCHMS</p>
                  <p className="text-[10px] text-slate-500">Secure session</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                aria-label="Close logout confirmation"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pb-6 pt-7 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-8 ring-red-50/50">
                <LogOut size={29} />
              </div>

              <h2
                id="logout-title"
                className="mt-5 text-xl font-bold tracking-tight text-slate-900"
              >
                Sign out of your account?
              </h2>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                You are signed in as{" "}
                <span className="font-semibold text-slate-700">{fullName}</span>
                . Are you sure you want to end your session?
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/15 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
              <ShieldCheck size={14} className="text-slate-400" />
              <p className="text-[10px] text-slate-400">
                Remember to protect confidential health records.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
