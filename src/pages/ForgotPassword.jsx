import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =========================================================
  // GENERATE OTP
  // =========================================================

  const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // =========================================================
  // SEND OTP THROUGH BREVO
  // =========================================================

  const handleSendOtp = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      // -----------------------------------------------------
      // CHECK USER EMAIL
      // -----------------------------------------------------

      const { data: user, error: userError } = await supabase
        .from("users")
        .select(
          `
          id,
          first_name,
          middle_name,
          last_name,
          email,
          is_active
        `,
        )
        .eq("email", cleanEmail)
        .eq("is_active", true)
        .maybeSingle();

      if (userError) {
        console.error(userError);
        throw new Error("Unable to check email.");
      }

      if (!user) {
        setError("No active account was found with this email address.");
        setLoading(false);
        return;
      }

      // -----------------------------------------------------
      // GENERATE OTP
      // -----------------------------------------------------

      const newOtp = generateOtp();

      // OTP expires after 10 minutes
      const expiration = Date.now() + 10 * 60 * 1000;

      setGeneratedOtp(newOtp);
      setOtpExpiresAt(expiration);
      setOtpAttempts(0);

      // -----------------------------------------------------
      // SEND EMAIL THROUGH BREVO
      // -----------------------------------------------------

      const brevoApiKey = import.meta.env.VITE_BREVO_API_KEY;
      const senderEmail = import.meta.env.VITE_BREVO_SENDER_EMAIL;
      const senderName =
        import.meta.env.VITE_BREVO_SENDER_NAME || "City Health Office";

      if (!brevoApiKey) {
        throw new Error("Brevo API key is not configured.");
      }

      if (!senderEmail) {
        throw new Error("Brevo sender email is not configured.");
      }

      const fullName = [user.first_name, user.middle_name, user.last_name]
        .filter(Boolean)
        .join(" ");

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",

        headers: {
          accept: "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },

        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail,
          },

          to: [
            {
              email: cleanEmail,
              name: fullName || cleanEmail,
            },
          ],

          subject: "Password Reset Verification Code",

          htmlContent: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>Password Reset</title>
                </head>

                <body
                  style="
                    margin: 0;
                    padding: 0;
                    background-color: #f8fafc;
                    font-family: Arial, sans-serif;
                  "
                >
                  <div
                    style="
                      max-width: 600px;
                      margin: 40px auto;
                      background: #ffffff;
                      border-radius: 16px;
                      overflow: hidden;
                      border: 1px solid #e2e8f0;
                    "
                  >
                    <div
                      style="
                        background: #059669;
                        padding: 30px;
                        text-align: center;
                        color: white;
                      "
                    >
                      <h1 style="margin: 0;">
                        City Health Office
                      </h1>

                      <p style="margin: 8px 0 0;">
                        Health Records Management System
                      </p>
                    </div>

                    <div style="padding: 35px;">
                      <h2 style="color: #1e293b;">
                        Password Reset
                      </h2>

                      <p style="color: #64748b;">
                        Hello ${fullName || "User"},
                      </p>

                      <p style="color: #64748b;">
                        We received a request to reset your password.
                        Use the verification code below:
                      </p>

                      <div
                        style="
                          margin: 30px 0;
                          padding: 20px;
                          background: #ecfdf5;
                          border: 1px solid #a7f3d0;
                          border-radius: 12px;
                          text-align: center;
                        "
                      >
                        <div
                          style="
                            font-size: 36px;
                            font-weight: bold;
                            letter-spacing: 10px;
                            color: #059669;
                          "
                        >
                          ${newOtp}
                        </div>
                      </div>

                      <p style="color: #64748b;">
                        This verification code will expire in
                        <strong>10 minutes</strong>.
                      </p>

                      <p style="color: #94a3b8; font-size: 13px;">
                        If you did not request a password reset,
                        you can safely ignore this email.
                      </p>
                    </div>

                    <div
                      style="
                        padding: 20px;
                        background: #f8fafc;
                        text-align: center;
                        color: #94a3b8;
                        font-size: 12px;
                      "
                    >
                      © 2026 City Health Office
                    </div>
                  </div>
                </body>
              </html>
            `,

          textContent: `
City Health Office
Health Records Management System

Password Reset

Your verification code is: ${newOtp}

This code will expire in 10 minutes.

If you did not request a password reset, you can safely ignore this email.
            `,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Brevo error:", result);

        throw new Error(result?.message || "Brevo failed to send the email.");
      }

      console.log("Brevo response:", result);

      setEmail(cleanEmail);

      setMessage("A verification code has been sent to your registered email.");

      setStep(2);
    } catch (err) {
      console.error("Send OTP error:", err);

      setError(
        err.message || "Unable to send verification code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // VERIFY OTP
  // =========================================================

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!otp.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    if (otp.length !== 6) {
      setError("The verification code must contain 6 digits.");
      return;
    }

    // Check attempts
    if (otpAttempts >= 5) {
      setError(
        "Too many incorrect attempts. Please request a new verification code.",
      );
      return;
    }

    // Check expiration
    if (!otpExpiresAt || Date.now() > otpExpiresAt) {
      setError("The verification code has expired. Please request a new code.");
      return;
    }

    setLoading(true);

    try {
      if (otp !== generatedOtp) {
        setOtpAttempts((prev) => prev + 1);

        const remaining = 4 - otpAttempts;

        if (remaining > 0) {
          setError(
            `Invalid verification code. ${remaining} attempt${
              remaining === 1 ? "" : "s"
            } remaining.`,
          );
        } else {
          setError(
            "Too many incorrect attempts. Please request a new verification code.",
          );
        }

        return;
      }

      setMessage("Verification successful. You can now create a new password.");

      setStep(3);
    } catch (err) {
      console.error(err);
      setError("Unable to verify the code.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!newPassword || !confirmPassword) {
      setError("Please complete both password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Make sure OTP was verified
    if (otp !== generatedOtp) {
      setError("Please verify your OTP first.");
      setStep(2);
      return;
    }

    // Make sure OTP hasn't expired
    if (!otpExpiresAt || Date.now() > otpExpiresAt) {
      setError("Your verification code has expired.");
      setStep(2);
      return;
    }

    setLoading(true);

    try {
      // -----------------------------------------------------
      // FIND USER
      // -----------------------------------------------------

      const { data: user, error: findError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .eq("is_active", true)
        .maybeSingle();

      if (findError) {
        console.error(findError);
        throw new Error("Unable to find your account.");
      }

      if (!user) {
        throw new Error("Account not found.");
      }

      // -----------------------------------------------------
      // UPDATE PASSWORD
      // -----------------------------------------------------

      const { error: updateError } = await supabase
        .from("users")
        .update({
          password: newPassword,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error(updateError);

        throw new Error(
          "Unable to update your password. Please check your database permissions.",
        );
      }

      // Clear OTP information
      setGeneratedOtp("");
      setOtp("");
      setOtpExpiresAt(null);
      setOtpAttempts(0);

      setStep(4);
    } catch (err) {
      console.error("Reset password error:", err);

      setError(
        err.message || "Unable to update your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // BACK BUTTON
  // =========================================================

  const goBack = () => {
    if (step === 1) {
      navigate("/");
    } else if (step === 2) {
      setStep(1);
      setOtp("");
      setError("");
      setMessage("");
    } else if (step === 3) {
      setStep(2);
      setError("");
      setMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* =====================================================
          LEFT SIDE
      ===================================================== */}

      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-700">
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <HeartPulse size={28} />
            </div>

            <div>
              <h1 className="text-xl font-bold">City Health Office</h1>

              <p className="text-sm text-white/70">
                Health Records Management System
              </p>
            </div>
          </div>

          <h2 className="text-4xl font-bold leading-tight max-w-lg">
            Securely recover your account.
          </h2>

          <p className="mt-5 text-white/80 max-w-md leading-relaxed">
            We will verify your registered email address before allowing you to
            create a new password.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                <Mail size={18} />
              </div>

              <span className="text-sm text-white/90">
                Verification through your registered email
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>

              <span className="text-sm text-white/90">
                Secure one-time verification code
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                <Lock size={18} />
              </div>

              <span className="text-sm text-white/90">
                Create a new password
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          RIGHT SIDE
      ===================================================== */}

      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}

          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <HeartPulse size={24} />
            </div>

            <div>
              <h1 className="font-bold text-slate-800">City Health Office</h1>

              <p className="text-xs text-slate-500">
                Health Records Management System
              </p>
            </div>
          </div>

          {/* Back */}

          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition mb-8"
          >
            <ArrowLeft size={17} />

            {step === 1 ? "Back to Login" : "Back"}
          </button>

          {/* Header */}

          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
              {step === 1 && <Mail size={27} />}
              {step === 2 && <ShieldCheck size={27} />}
              {step === 3 && <KeyRound size={27} />}
              {step === 4 && <CheckCircle2 size={27} />}
            </div>

            {step === 1 && (
              <>
                <h2 className="text-3xl font-bold text-slate-800">
                  Forgot Password?
                </h2>

                <p className="mt-2 text-slate-500">
                  Enter your registered email address and we'll send you a
                  verification code.
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-3xl font-bold text-slate-800">
                  Verify OTP
                </h2>

                <p className="mt-2 text-slate-500">
                  Enter the 6-digit verification code sent to:
                </p>

                <p className="mt-1 font-semibold text-emerald-600 break-all">
                  {email}
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-3xl font-bold text-slate-800">
                  Create New Password
                </h2>

                <p className="mt-2 text-slate-500">
                  Choose a new password for your account.
                </p>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="text-3xl font-bold text-slate-800">
                  Password Updated
                </h2>

                <p className="mt-2 text-slate-500">
                  Your password has been successfully changed.
                </p>
              </>
            )}
          </div>

          {/* ERROR */}

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* SUCCESS */}

          {message && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {/* =================================================
              STEP 1
          ================================================= */}

          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Registered Email
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3.5 transition"
              >
                {loading ? (
                  "Sending..."
                ) : (
                  <>
                    Send Verification Code
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* =================================================
              STEP 2
          ================================================= */}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Verification Code
                </label>

                <div className="relative">
                  <ShieldCheck
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit OTP"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-center tracking-[0.4em] font-semibold text-lg outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3.5 transition"
              >
                {loading ? (
                  "Verifying..."
                ) : (
                  <>
                    Verify Code
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setMessage("");
                  setError("");
                }}
                className="w-full text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Use a different email
              </button>
            </form>
          )}

          {/* =================================================
              STEP 3
          ================================================= */}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New Password */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Password
                </label>

                <div className="relative">
                  <Lock
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 py-3.5 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm New Password
                </label>

                <div className="relative">
                  <Lock
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 py-3.5 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Requirements */}

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500">
                <p className="font-medium text-slate-700 mb-1">
                  Password requirements
                </p>

                <p>• At least 6 characters</p>
                <p>• Both passwords must match</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3.5 transition"
              >
                {loading ? (
                  "Updating..."
                ) : (
                  <>
                    Update Password
                    <CheckCircle2 size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* =================================================
              STEP 4
          ================================================= */}

          {step === 4 && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <CheckCircle2
                  size={55}
                  className="mx-auto text-emerald-600 mb-4"
                />

                <h3 className="text-lg font-bold text-slate-800">
                  Password successfully updated
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  You can now use your new password to sign in to the Health
                  Records Management System.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 transition"
              >
                Back to Login
              </button>
            </div>
          )}

          {/* FOOTER */}

          <p className="text-center text-xs text-slate-400 mt-10">
            City Health Office • Health Records Management System
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
