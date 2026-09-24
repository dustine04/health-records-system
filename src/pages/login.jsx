import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, HeartPulse } from "lucide-react";
import { supabase } from "../lib/supabase";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        username,
        first_name,
        middle_name,
        last_name,
        role,
        district_id,
        barangay_id,
        is_active
      `,
      )
      .eq("username", username)
      .eq("password", password)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      setError("Invalid username or password.");
      setLoading(false);
      return;
    }

    localStorage.setItem("user", JSON.stringify(data));

    switch (data.role) {
      case "cho_admin":
        navigate("/dashboard/admin");
        break;

      case "nurse":
        navigate("/dashboard/nurse");
        break;

      case "midwife":
        navigate("/dashboard/midwife");
        break;

      case "bns":
        navigate("/dashboard/bns");
        break;

      case "bhw":
        navigate("/dashboard/bhw");
        break;

      default:
        setError("Invalid user role.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* =====================================================
          LEFT - LARGE IMAGE (70%)
      ===================================================== */}
      <div className="hidden lg:block lg:w-[70%] p-4">
        <div className="relative w-full h-full min-h-[calc(100vh-2rem)] rounded-3xl overflow-hidden">
          {/* Replace this image later */}
          <img
            src="/login.png"
            alt="Health services"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Image Content */}
          <div className="absolute bottom-0 left-0 right-0 p-10 xl:p-16 text-white">
            <div className="max-w-2xl">
              <div className="w-12 h-1 bg-white rounded-full mb-6" />

              <h2 className="text-4xl xl:text-6xl font-bold leading-tight">
                Better Records.
                <br />
                Better Healthcare.
              </h2>

              <p className="mt-5 text-white/80 text-base xl:text-lg leading-relaxed max-w-xl">
                A centralized health records system designed to help healthcare
                workers manage, monitor, and access records efficiently.sss
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          RIGHT - LOGIN (30%)
      ===================================================== */}
      <div className="w-full lg:w-[30%] flex items-center justify-center px-6 sm:px-10 lg:px-8 xl:px-12 py-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <HeartPulse className="text-white" size={25} />
            </div>

            <div>
              <h1 className="font-bold text-lg text-gray-800">
                Health Records
              </h1>

              <p className="text-xs text-gray-500">City Health Office</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>

            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Sign in to access the Health Records Management System.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="
                  w-full
                  px-4 py-3.5
                  rounded-xl
                  border border-gray-300
                  bg-white
                  text-gray-800
                  text-sm
                  outline-none
                  transition
                  focus:border-blue-500
                  focus:ring-4
                  focus:ring-blue-500/10
                "
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="
                    w-full
                    px-4 py-3.5
                    pr-12
                    rounded-xl
                    border border-gray-300
                    bg-white
                    text-gray-800
                    text-sm
                    outline-none
                    transition
                    focus:border-blue-500
                    focus:ring-4
                    focus:ring-blue-500/10
                  "
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    w-9 h-9
                    flex items-center justify-center
                    rounded-lg
                    text-gray-400
                    hover:text-gray-600
                    hover:bg-gray-100
                    transition
                  "
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                py-3.5
                rounded-xl
                bg-blue-600
                text-white
                text-sm
                font-semibold
                shadow-sm
                hover:bg-blue-700
                active:bg-blue-800
                transition
                disabled:opacity-60
                disabled:cursor-not-allowed
              "
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-10">
            © 2026 City Health Office
          </p>
        </div>
      </div>

      {/* =====================================================
          MOBILE LOGIN
          Image hidden automatically
      ===================================================== */}
    </div>
  );
}

export default Login;
