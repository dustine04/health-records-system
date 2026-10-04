import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  ShieldCheck,
  MapPin,
  Building2,
  CalendarDays,
  Pencil,
  Save,
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";

const roleNames = {
  cho_admin: "CHO Administrator",
  nurse: "Nurse",
  midwife: "Midwife",
  bns: "Barangay Nutrition Scholar",
  bhw: "Barangay Health Worker",
};

const roleColors = {
  cho_admin: "blue",
  nurse: "purple",
  midwife: "pink",
  bns: "green",
  bhw: "orange",
};

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [district, setDistrict] = useState(null);
  const [barangay, setBarangay] = useState(null);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password states
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    username: "",
    email: "",
    contact_number: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        setLoading(false);
        return;
      }

      const loggedUser = JSON.parse(storedUser);
      setUser(loggedUser);

      // Get latest user information
      const { data, error } = await supabase
        .from("users")
        .select(
          `
          id,
          username,
          email,
          contact_number,
          first_name,
          middle_name,
          last_name,
          role,
          district_id,
          barangay_id,
          is_active,
          created_at
        `,
        )
        .eq("id", loggedUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);

        setForm({
          first_name: data.first_name || "",
          middle_name: data.middle_name || "",
          last_name: data.last_name || "",
          username: data.username || "",
          email: data.email || "",
          contact_number: data.contact_number || "",
        });

        // Get district
        if (data.district_id) {
          const { data: districtData } = await supabase
            .from("districts")
            .select("id, name")
            .eq("id", data.district_id)
            .maybeSingle();

          setDistrict(districtData || null);
        } else {
          setDistrict(null);
        }

        // Get barangay
        if (data.barangay_id) {
          const { data: barangayData } = await supabase
            .from("barangays")
            .select("id, name")
            .eq("id", data.barangay_id)
            .maybeSingle();

          setBarangay(barangayData || null);
        } else {
          setBarangay(null);
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!form.first_name.trim()) {
      alert("First name is required.");
      return;
    }

    if (!form.last_name.trim()) {
      alert("Last name is required.");
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from("users")
        .update({
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          contact_number: form.contact_number.trim() || null,
        })
        .eq("id", profile.id)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);

        // Update localStorage user session
        const updatedUser = {
          ...user,
          ...data,
        };

        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      setEditing(false);

      alert("Profile updated successfully.");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert(error.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!profile) return;

    setForm({
      first_name: profile.first_name || "",
      middle_name: profile.middle_name || "",
      last_name: profile.last_name || "",
      username: profile.username || "",
      email: profile.email || "",
      contact_number: profile.contact_number || "",
    });

    setEditing(false);
  };

  const handleCancelPassword = () => {
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    setChangingPassword(false);
  };

  const handleSavePassword = async () => {
    if (!profile) return;

    if (!passwordForm.current_password) {
      alert("Please enter your current password.");
      return;
    }

    if (!passwordForm.new_password) {
      alert("Please enter your new password.");
      return;
    }

    if (passwordForm.new_password.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert("New password and confirmation password do not match.");
      return;
    }

    if (passwordForm.current_password === passwordForm.new_password) {
      alert("Your new password must be different from your current password.");
      return;
    }

    try {
      setSavingPassword(true);

      // Verify current password
      const { data: currentUser, error: verifyError } = await supabase
        .from("users")
        .select("id")
        .eq("id", profile.id)
        .eq("password", passwordForm.current_password)
        .maybeSingle();

      if (verifyError) throw verifyError;

      if (!currentUser) {
        alert("Current password is incorrect.");
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password: passwordForm.new_password,
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      alert("Password changed successfully.");

      handleCancelPassword();
    } catch (error) {
      console.error("Error changing password:", error);
      alert(error.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const PasswordInput = ({ name, value, placeholder, show, setShow }) => {
    return (
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={handlePasswordChange}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-sm text-gray-500">Loading profile...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <UserRound className="mx-auto mb-3 h-12 w-12 text-gray-300" />

            <p className="font-medium text-gray-700">Profile not found</p>

            <p className="mt-1 text-sm text-gray-500">Please log in again.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const fullName =
    [profile.first_name, profile.middle_name, profile.last_name]
      .filter(Boolean)
      .join(" ") || "User";

  const role = profile.role;
  const roleLabel = roleNames[role] || role;
  const color = roleColors[role] || "blue";

  const initials =
    `${profile.first_name?.charAt(0) || ""}${profile.last_name?.charAt(0) || ""}`.toUpperCase() ||
    "U";

  const colorClasses = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-600",
      badge: "bg-blue-100 text-blue-700",
      border: "border-blue-200",
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-600",
      badge: "bg-purple-100 text-purple-700",
      border: "border-purple-200",
    },
    pink: {
      bg: "bg-pink-100",
      text: "text-pink-600",
      badge: "bg-pink-100 text-pink-700",
      border: "border-pink-200",
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-600",
      badge: "bg-green-100 text-green-700",
      border: "border-green-200",
    },
    orange: {
      bg: "bg-orange-100",
      text: "text-orange-600",
      badge: "bg-orange-100 text-orange-700",
      border: "border-orange-200",
    },
  };

  const theme = colorClasses[color];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

          <p className="mt-1 text-sm text-gray-500">
            View and manage your account information.
          </p>
        </div>

        {/* Profile Header Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="h-32 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500" />

          <div className="px-6 pb-6">
            <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                {/* Avatar */}
                <div
                  className={`flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-white ${theme.bg} ${theme.text} shadow-md`}
                >
                  <span className="text-3xl font-bold">{initials}</span>
                </div>

                <div className="pb-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {fullName}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {profile.username}
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>

              {/* Edit Buttons */}
              <div className="flex gap-2">
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Personal Information
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Your basic account information.
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-3">
            {/* First Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                First Name
              </label>

              {editing ? (
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                  {profile.first_name || "—"}
                </div>
              )}
            </div>

            {/* Middle Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Middle Name
              </label>

              {editing ? (
                <input
                  type="text"
                  name="middle_name"
                  value={form.middle_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                  {profile.middle_name || "—"}
                </div>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Last Name
              </label>

              {editing ? (
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                  {profile.last_name || "—"}
                </div>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Username
              </label>

              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                <UserRound className="h-4 w-4 text-gray-400" />
                {profile.username}
              </div>

              {editing && (
                <p className="mt-1 text-xs text-gray-400">
                  Username cannot be changed here.
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email Address
              </label>

              {editing ? (
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                  <Mail className="h-4 w-4 text-gray-400" />
                  {profile.email || "Not provided"}
                </div>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Contact Number
              </label>

              {editing ? (
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <input
                    type="tel"
                    name="contact_number"
                    value={form.contact_number}
                    onChange={handleChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {profile.contact_number || "Not provided"}
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Role
              </label>

              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
                {roleLabel}
              </div>
            </div>

            {/* Account Status */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Account Status
              </label>

              <div className="px-3 py-2.5">
                {profile.is_active ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Assignment / Location */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Assignment & Location
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Your assigned administrative area.
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            {/* District */}
            <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  District
                </p>

                <p className="mt-1 font-semibold text-gray-800">
                  {district?.name || "Not assigned"}
                </p>
              </div>
            </div>

            {/* Barangay */}
            <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <MapPin className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Barangay
                </p>

                <p className="mt-1 font-semibold text-gray-800">
                  {barangay?.name || "Not assigned"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security / Change Password */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Lock className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">Security</h2>

                <p className="mt-1 text-xs text-gray-500">
                  Manage your account password.
                </p>
              </div>
            </div>
          </div>

          {!changingPassword ? (
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Password</p>

                <p className="mt-1 text-xs text-gray-500">
                  Change your password to keep your account secure.
                </p>
              </div>

              <button
                onClick={() => setChangingPassword(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <Lock className="h-4 w-4" />
                Change Password
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="max-w-xl space-y-5">
                {/* Current Password */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Current Password
                  </label>

                  <PasswordInput
                    name="current_password"
                    value={passwordForm.current_password}
                    placeholder="Enter current password"
                    show={showCurrentPassword}
                    setShow={setShowCurrentPassword}
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    New Password
                  </label>

                  <PasswordInput
                    name="new_password"
                    value={passwordForm.new_password}
                    placeholder="Enter new password"
                    show={showNewPassword}
                    setShow={setShowNewPassword}
                  />

                  <p className="mt-1.5 text-xs text-gray-400">
                    Password must be at least 6 characters.
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>

                  <PasswordInput
                    name="confirm_password"
                    value={passwordForm.confirm_password}
                    placeholder="Confirm new password"
                    show={showConfirmPassword}
                    setShow={setShowConfirmPassword}
                  />
                </div>

                {/* Password Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleCancelPassword}
                    disabled={savingPassword}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    onClick={handleSavePassword}
                    disabled={savingPassword}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingPassword ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Account Information</h2>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            {/* Account Created */}
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-gray-400">Account Created</p>

                <p className="text-sm font-medium text-gray-800">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>

            {/* Access Level */}
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-gray-400">Access Level</p>

                <p className="text-sm font-medium text-gray-800">{roleLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
