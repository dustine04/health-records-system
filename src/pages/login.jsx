import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UserPlus,
} from "lucide-react";

import { supabase } from "../lib/supabase";

// Best-effort client audit trail. For tamper-resistant security logging,
// write authentication events from a server-side RPC/Edge Function instead.
export async function logAuthEvent({
  actorId = null,
  action,
  status = "success",
  details = {},
}) {
  try {
    const { error } = await supabase.from("it_audit_logs").insert({
      actor_id: actorId ?? null,
      action,
      entity_type: "authentication",
      entity_id: actorId == null ? null : String(actorId),
      status,
      details: { module: "Authentication", ...details },
    });
    if (error) {
      console.warn(
        "Authentication audit log could not be saved:",
        error.message,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Authentication audit log could not be saved:", error);
    return false;
  }
}

const SAVED_USERNAME_KEY = "mchms_saved_username";

const ROLE_ROUTES = {
  cho_admin: "/dashboard/admin",
  it_admin: "/dashboard/it-admin",
  nurse: "/dashboard/nurse",
  midwife: "/dashboard/midwife",
  bns: "/dashboard/bns",
  bhw: "/dashboard/bhw",
};

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    try {
      const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY);

      if (savedUsername) {
        setUsername(savedUsername);
        setRememberUsername(true);
      }
    } catch {
      // Login remains usable if browser storage is unavailable.
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("Please enter both your username and password.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Server-side verification supports legacy plaintext and hashed passwords and avoids
      // querying the users table with a password from the browser.
      const { data, error: loginError } = await supabase.rpc("mchms_login", {
        p_username: cleanUsername,
        p_password: password,
      });

      if (loginError) {
        console.error("Login query failed:", loginError);
        await logAuthEvent({
          action: "user_login_error",
          status: "failed",
          details: { reason: "authentication_service_error" },
        });
        setError("Unable to sign in right now. Please try again.");
        return;
      }

      if (!data) {
        await logAuthEvent({
          action: "user_login_failed",
          status: "failed",
          details: { reason: "invalid_credentials_or_inactive_account" },
        });
        setError("Invalid username or password, or your account is inactive.");
        return;
      }

      // Normalize RPC results: a JSON object is expected, but some
      // database functions return an array or wrap the user in a field.
      const account = Array.isArray(data)
        ? data[0]
        : (data?.user ?? data?.account ?? data);

      const normalizedRole = String(account?.role ?? "")
        .trim()
        .toLowerCase();

      const destination = ROLE_ROUTES[normalizedRole];

      if (!destination) {
        console.error("Unrecognized login role returned by Supabase:", {
          role: account?.role,
          responseShape: Array.isArray(data) ? "array" : typeof data,
        });
        await logAuthEvent({
          actorId: account?.id ?? null,
          action: "user_login_failed",
          status: "failed",
          details: { reason: "unrecognized_role" },
        });
        setError(
          "Your account has an unrecognized role. Please contact your administrator.",
        );
        return;
      }

      const authenticatedUser = {
        ...account,
        role: normalizedRole,
      };

      // Remember the username only, never the password.
      try {
        if (rememberUsername) {
          localStorage.setItem(SAVED_USERNAME_KEY, cleanUsername);
        } else {
          localStorage.removeItem(SAVED_USERNAME_KEY);
        }

        localStorage.setItem("user", JSON.stringify(authenticatedUser));
      } catch {
        await logAuthEvent({
          actorId: authenticatedUser.id,
          action: "user_login_failed",
          status: "failed",
          details: {
            reason: "session_storage_unavailable",
            role: normalizedRole,
          },
        });
        setError(
          "Your browser could not save the login session. Please enable site storage and try again.",
        );
        return;
      }

      await logAuthEvent({
        actorId: authenticatedUser.id,
        action: "user_login",
        details: { role: normalizedRole, destination },
      });
      setSuccess("Login successful. Opening your dashboard...");
      navigate(destination, { replace: true });
    } catch (err) {
      console.error("Unexpected login error:", err);
      await logAuthEvent({
        action: "user_login_error",
        status: "failed",
        details: { reason: "unexpected_authentication_error" },
      });
      setError(
        "Something went wrong. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.35fr_1fr]">
      {/* LEFT PANEL — HEALTHCARE BRANDING */}
      <section className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-8 xl:p-10">
        <img
          src="/login.png"
          alt="Healthcare professionals providing community health services"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/50 to-blue-950/70" />

        <div className="absolute -right-32 top-20 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-20 top-32 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        {/* Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-md">
            <HeartPulse size={27} className="text-cyan-300" />
          </div>

          <div>
            <p className="text-lg font-bold tracking-wide text-white">MCHMS</p>
            <p className="text-xs text-slate-300">City Health Office</p>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 max-w-2xl pb-8 pt-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-cyan-100 backdrop-blur-md">
            <Activity size={16} className="text-cyan-300" />
            <span>Connected care. Better communities.</span>
          </div>

          <h1 className="text-5xl font-bold leading-[1.12] tracking-tight text-white xl:text-6xl">
            Better Records.
            <br />
            <span className="text-cyan-300">Better Healthcare.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 xl:text-lg">
            A centralized health records management system designed to help
            healthcare workers manage patient information, monitor health
            services, and coordinate community care more efficiently.
          </p>

          {/* Feature cards */}
          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md transition duration-300 hover:bg-white/15">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                <Stethoscope size={21} />
              </div>
              <h3 className="font-semibold text-white">Coordinated Care</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Support collaboration between health workers.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md transition duration-300 hover:bg-white/15">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                <ShieldCheck size={21} />
              </div>
              <h3 className="font-semibold text-white">Organized Records</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Keep health information accessible to authorized users.
              </p>
            </div>
          </div>
        </div>

        {/* Left footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-xs text-slate-300">
          <span>© 2026 City Health Office</span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Healthcare information system
          </span>
        </div>
      </section>

      {/* RIGHT PANEL — LOGIN FORM */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <HeartPulse size={27} />
            </div>

            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">
                MCHMS
              </p>
              <p className="text-xs text-slate-500">City Health Office</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm">
              <LockKeyhole size={26} />
            </div>

            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              Secure sign in
            </p>

            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              Sign in to access your healthcare workspace and manage your
              assigned records.
            </p>
          </div>

          {/* Error feedback */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <Activity size={18} className="mt-0.5 shrink-0" />
              <p className="leading-6">{error}</p>
            </div>
          )}

          {/* Success feedback */}
          {success && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Username
              </label>

              <div className="group relative">
                <UserRound
                  size={19}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600"
                />

                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs font-semibold text-blue-600 transition hover:text-blue-800 hover:underline sm:text-sm"
                >
                  Forgot password?
                </button>
              </div>

              <div className="group relative">
                <LockKeyhole
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600"
                />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-sm text-slate-900 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {/* Remember username */}
            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberUsername}
                  onChange={(e) => setRememberUsername(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 focus:ring-blue-500"
                />
                Remember my username
              </label>

              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck size={15} />
                Secure access
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing you in...
                </>
              ) : (
                <>
                  Sign in to your account
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          {/* BNS / BHW / Nurse / Midwife Registration Link */}
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <UserPlus size={20} />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  New health personnel?
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Barangay Nutrition Scholars (BNS), Barangay Health Workers
                  (BHW), Nurses, and Midwives can register for an MCHMS account.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  All new accounts require approval before signing in. BNS and
                  BHW accounts are activated by their assigned Midwife, while
                  Nurse and Midwife accounts require City Health Office (CHO)
                  approval.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-900 hover:underline"
                >
                  Register as BNS, BHW, Nurse, or Midwife
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Security note */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck size={20} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">
                Your access matters
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Use your authorized account and keep your login credentials
                private. Access only records permitted for your role.
              </p>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              © 2026 City Health Office. All rights reserved.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Maternal and Community Health Management System
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default Login;
