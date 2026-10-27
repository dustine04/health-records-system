import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  MapPin,
  LoaderCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const initialForm = {
  role: "bns",
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  contact_number: "",
  username: "",
  district_id: "",
  barangay_id: "",
  password: "",
  confirm_password: "",
};

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [districts, setDistricts] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "district_id" ? { barangay_id: "" } : {}),
    }));
    setError("");
    setSuccess("");
  };

  useEffect(() => {
    let mounted = true;

    async function loadLocations() {
      setLoadingLocations(true);

      try {
        const { data, error: queryError } = await supabase
          .from("districts")
          .select("id, name")
          .order("name");

        if (queryError) throw queryError;

        if (mounted) setDistricts(data || []);
      } catch (err) {
        console.error("Unable to load districts:", err);
        if (mounted) {
          setError(
            "Unable to load districts. Please check your connection and database permissions.",
          );
        }
      } finally {
        if (mounted) setLoadingLocations(false);
      }
    }

    loadLocations();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBarangays() {
      setBarangays([]);

      if (!form.district_id) return;

      try {
        const { data, error: queryError } = await supabase
          .from("barangays")
          .select("id, name")
          .eq("district_id", form.district_id)
          .order("name");

        if (queryError) throw queryError;

        if (mounted) setBarangays(data || []);
      } catch (err) {
        console.error("Unable to load barangays:", err);
        if (mounted) setError("Unable to load barangays. Please try again.");
      }
    }

    loadBarangays();

    return () => {
      mounted = false;
    };
  }, [form.district_id]);

  const handleRegister = async (event) => {
    event.preventDefault();

    if (loading) return;

    const firstName = form.first_name.trim();
    const middleName = form.middle_name.trim();
    const lastName = form.last_name.trim();
    const username = form.username.trim();

    if (!firstName || !lastName || !username) {
      setError("Please complete your first name, last name, and username.");
      return;
    }

    if (!form.district_id || !form.barangay_id) {
      setError("Please select your district and barangay.");
      return;
    }

    if (!["bns", "bhw"].includes(form.role)) {
      setError("Please select a valid registration role.");
      return;
    }

    if (form.password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: registrationError } = await supabase.rpc(
        "register_community_health_worker",
        {
          p_role: form.role,
          p_first_name: firstName,
          p_middle_name: middleName || null,
          p_last_name: lastName,
          p_email: form.email.trim() || null,
          p_contact_number: form.contact_number.trim() || null,
          p_username: username,
          p_password: form.password,
          p_district_id: Number(form.district_id),
          p_barangay_id: Number(form.barangay_id),
        },
      );

      if (registrationError) throw registrationError;

      if (data?.success === false) {
        throw new Error(data.message || "Registration could not be completed.");
      }

      setSuccess(
        "Registration submitted successfully. Your account is pending activation by an authorized health office staff member.",
      );
      setForm(initialForm);
      setBarangays([]);
    } catch (err) {
      console.error("Registration failed:", err);

      const message = String(err?.message || "").toLowerCase();

      if (
        message.includes("username already exists") ||
        message.includes("duplicate key")
      ) {
        setError("That username is already taken. Please choose another.");
      } else if (message.includes("district") || message.includes("barangay")) {
        setError(
          "The selected district or barangay is invalid. Please refresh the page and try again.",
        );
      } else if (
        message.includes("register_community_health_worker") ||
        message.includes("function") ||
        message.includes("permission denied")
      ) {
        setError(
          "The registration service is not configured yet. Please apply the SQL setup below and check your Supabase permissions.",
        );
      } else {
        setError(err?.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100";

  const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to login
        </Link>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 px-6 py-8 text-white sm:px-9">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
              <HeartPulse size={26} />
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
              City Health Office
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              Community Health Worker Registration
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50">
              Register as a Barangay Nutrition Scholar or Barangay Health Worker
              to request access to MCHMS.
            </p>
          </div>

          <div className="p-6 sm:p-9">
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
              >
                <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="font-semibold">Registration received</p>
                  <p>{success}</p>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="mt-3 font-semibold underline"
                  >
                    Return to login
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-7">
              <section>
                <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <UserRound size={19} className="text-blue-600" />
                  Account type
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      value: "bns",
                      title: "BNS",
                      description: "Barangay Nutrition Scholar",
                    },
                    {
                      value: "bhw",
                      title: "BHW",
                      description: "Barangay Health Worker",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateField("role", option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        form.role === option.value
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/15"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {option.title}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            form.role === option.value
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {form.role === option.value && (
                            <CheckCircle2 size={15} />
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <UserRound size={19} className="text-blue-600" />
                  Personal information
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="first_name">
                      First name *
                    </label>
                    <input
                      id="first_name"
                      className={inputClass}
                      value={form.first_name}
                      onChange={(e) =>
                        updateField("first_name", e.target.value)
                      }
                      autoComplete="given-name"
                      required
                      maxLength={100}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="middle_name">
                      Middle name
                    </label>
                    <input
                      id="middle_name"
                      className={inputClass}
                      value={form.middle_name}
                      onChange={(e) =>
                        updateField("middle_name", e.target.value)
                      }
                      autoComplete="additional-name"
                      maxLength={100}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="last_name">
                      Last name *
                    </label>
                    <input
                      id="last_name"
                      className={inputClass}
                      value={form.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
                      autoComplete="family-name"
                      required
                      maxLength={100}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="contact_number">
                      Contact number
                    </label>
                    <input
                      id="contact_number"
                      type="tel"
                      className={inputClass}
                      value={form.contact_number}
                      onChange={(e) =>
                        updateField("contact_number", e.target.value)
                      }
                      autoComplete="tel"
                      maxLength={30}
                      placeholder="e.g. 09XXXXXXXXX"
                      disabled={loading}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="email">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={inputClass}
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      autoComplete="email"
                      maxLength={254}
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <MapPin size={19} className="text-blue-600" />
                  Assigned location
                </h2>

                <p className="mb-4 text-sm leading-6 text-slate-500">
                  Select the district and barangay where you serve. Your
                  location and worker assignment should be verified before
                  access is activated.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="district_id">
                      District *
                    </label>
                    <select
                      id="district_id"
                      className={inputClass}
                      value={form.district_id}
                      onChange={(e) =>
                        updateField("district_id", e.target.value)
                      }
                      required
                      disabled={loading || loadingLocations}
                    >
                      <option value="">
                        {loadingLocations
                          ? "Loading districts..."
                          : "Select district"}
                      </option>
                      {districts.map((district) => (
                        <option key={district.id} value={district.id}>
                          {district.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="barangay_id">
                      Barangay *
                    </label>
                    <select
                      id="barangay_id"
                      className={inputClass}
                      value={form.barangay_id}
                      onChange={(e) =>
                        updateField("barangay_id", e.target.value)
                      }
                      required
                      disabled={loading || !form.district_id}
                    >
                      <option value="">Select barangay</option>
                      {barangays.map((barangay) => (
                        <option key={barangay.id} value={barangay.id}>
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <LockKeyhole size={19} className="text-blue-600" />
                  Login credentials
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass} htmlFor="username">
                      Username *
                    </label>
                    <input
                      id="username"
                      className={inputClass}
                      value={form.username}
                      onChange={(e) =>
                        updateField(
                          "username",
                          e.target.value.replace(/\s/g, ""),
                        )
                      }
                      autoComplete="username"
                      minLength={3}
                      maxLength={50}
                      pattern="[A-Za-z0-9._-]+"
                      title="Use letters, numbers, periods, underscores, or hyphens."
                      placeholder="Create a username"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="password">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className={`${inputClass} pr-12`}
                        value={form.password}
                        onChange={(e) =>
                          updateField("password", e.target.value)
                        }
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        placeholder="At least 8 characters"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        {showPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="confirm_password">
                      Confirm password *
                    </label>
                    <div className="relative">
                      <input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        className={`${inputClass} pr-12`}
                        value={form.confirm_password}
                        onChange={(e) =>
                          updateField("confirm_password", e.target.value)
                        }
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        onClick={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={loading || loadingLocations}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="animate-spin" />
                    Submitting registration...
                  </>
                ) : (
                  "Submit registration"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already registered?{" "}
              <Link
                to="/"
                className="font-semibold text-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 City Health Office · Maternal and Community Health Management
          System
        </p>
      </div>
    </main>
  );
}

export default Register;
