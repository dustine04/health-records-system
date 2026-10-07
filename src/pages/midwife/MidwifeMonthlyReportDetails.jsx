import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  HeartPulse,
  Home,
  Loader2,
  MapPin,
  MessageSquare,
  RotateCcw,
  Save,
  Stethoscope,
  UserRound,
  Users,
  X,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

/* ============================================================
   HELPERS
============================================================ */

function getFullName(user) {
  if (!user) return "Unknown BHW";

  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ");
}

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMonthYear(month, year) {
  if (!month || !year) return "—";

  const monthNumber = Number(month);

  if (Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return `${month} ${year}`;
  }

  const date = new Date(year, monthNumber - 1, 1);

  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function formatBoolean(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function getStatusConfig(status) {
  switch (status) {
    case "reviewed":
      return {
        label: "Reviewed",
        className: "bg-green-50 text-green-700 border-green-200",
        icon: CheckCircle2,
      };

    case "returned":
      return {
        label: "Returned",
        className: "bg-orange-50 text-orange-700 border-orange-200",
        icon: RotateCcw,
      };

    case "submitted":
    default:
      return {
        label: "Submitted",
        className: "bg-blue-50 text-blue-700 border-blue-200",
        icon: Clock3,
      };
  }
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {Icon && <Icon className="h-4 w-4" />}

        <span>{label}</span>
      </div>

      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value ?? "—"}
      </p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
        )}

        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>

      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}

/* ============================================================
   PREGNANT WOMAN CARD
============================================================ */

function PregnantWomanCard({ woman, index, report }) {
  const [expanded, setExpanded] = useState(index === 0);

  const ancCount = Number(woman?.anc || 0);
  const homeVisitCount = Number(woman?.home_visits || 0);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-gray-50"
      >
        {/* Number */}

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">
          {index + 1}
        </div>

        {/* Name */}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <h4 className="text-base font-bold text-gray-900">
              {woman?.name || "Unnamed pregnant woman"}
            </h4>

            {woman?.pregnant_woman_id && (
              <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Pregnancy ID: {woman.pregnant_woman_id}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {woman?.household_code && (
              <span>
                Household:{" "}
                <strong className="text-gray-700">
                  {woman.household_code}
                </strong>
              </span>
            )}

            {woman?.local_area_name && (
              <span>
                Area:{" "}
                <strong className="text-gray-700">
                  {woman.local_area_name}
                </strong>
              </span>
            )}

            {woman?.barangay_name && (
              <span>
                Barangay:{" "}
                <strong className="text-gray-700">{woman.barangay_name}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Visit counts */}

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
            <p className="text-xs text-blue-600">ANC</p>

            <p className="font-bold text-blue-800">{ancCount}</p>
          </div>

          <div className="rounded-lg bg-purple-50 px-3 py-2 text-center">
            <p className="text-xs text-purple-600">Home</p>

            <p className="font-bold text-purple-800">{homeVisitCount}</p>
          </div>
        </div>

        {/* Expand */}

        <div className="mt-2 shrink-0">
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}

      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50/60 p-5">
          <div className="space-y-6">
            {/* =================================================
                IDENTIFICATION
            ================================================= */}

            <section>
              <SectionTitle
                icon={UserRound}
                title="Pregnancy Identification"
                description="Basic information identifying this pregnancy record."
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  icon={UserRound}
                  label="Pregnant Woman"
                  value={woman?.name}
                />

                <InfoItem
                  icon={FileCheck2}
                  label="Pregnancy ID"
                  value={woman?.pregnant_woman_id}
                />

                <InfoItem
                  icon={ClipboardCheck}
                  label="Family Record No."
                  value={woman?.family_record_no}
                />

                <InfoItem
                  icon={Home}
                  label="Household Code"
                  value={woman?.household_code}
                />

                <InfoItem
                  icon={MapPin}
                  label="Barangay"
                  value={woman?.barangay_name}
                />

                <InfoItem
                  icon={MapPin}
                  label="Purok / Sitio"
                  value={woman?.local_area_name}
                />
              </div>
            </section>

            {/* =================================================
                PREGNANCY DATES
            ================================================= */}

            <section>
              <SectionTitle icon={CalendarDays} title="Pregnancy Dates" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem
                  icon={CalendarDays}
                  label="Registration Date"
                  value={formatDate(woman?.date_of_registration)}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="LMP"
                  value={formatDate(woman?.lmp)}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="EDC / EDD"
                  value={formatDate(woman?.edc)}
                />

                <InfoItem
                  icon={ClipboardCheck}
                  label="MC Book No."
                  value={woman?.mc_book}
                />
              </div>
            </section>

            {/* =================================================
                ANC / HOME VISITS
            ================================================= */}

            <section>
              <SectionTitle
                icon={HeartPulse}
                title="Pregnancy Monitoring"
                description="Monitoring information included in the BHW monthly report."
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-600">
                    ANC Visits
                  </p>

                  <p className="mt-1 text-2xl font-bold text-blue-800">
                    {ancCount}
                  </p>
                </div>

                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <p className="text-xs font-medium text-purple-600">
                    Home Visits
                  </p>

                  <p className="mt-1 text-2xl font-bold text-purple-800">
                    {homeVisitCount}
                  </p>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-medium text-green-600">
                    Birth Plan
                  </p>

                  <p className="mt-1 text-sm font-bold text-green-800">
                    {woman?.birth_plan || "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-medium text-orange-600">
                    Status / Outcome
                  </p>

                  <p className="mt-1 text-sm font-bold text-orange-800">
                    {woman?.outcome || "Ongoing"}
                  </p>
                </div>
              </div>
            </section>

            {/* =================================================
                DELIVERY
            ================================================= */}

            {(woman?.place_of_delivery ||
              woman?.date_of_delivery ||
              woman?.attended_by) && (
              <section>
                <SectionTitle icon={Baby} title="Delivery Information" />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem
                    icon={Home}
                    label="Place of Delivery"
                    value={woman?.place_of_delivery}
                  />

                  <InfoItem
                    icon={CalendarDays}
                    label="Date of Delivery"
                    value={formatDate(woman?.date_of_delivery)}
                  />

                  <InfoItem
                    icon={Stethoscope}
                    label="Attended By"
                    value={woman?.attended_by}
                  />
                </div>
              </section>
            )}

            {/* =================================================
                ANC DETAILS IF INCLUDED IN SNAPSHOT
            ================================================= */}

            {Array.isArray(woman?.anc_visits) &&
              woman.anc_visits.length > 0 && (
                <section>
                  <SectionTitle
                    icon={Stethoscope}
                    title="ANC Visit Details"
                    description="ANC visits included in the submitted report snapshot."
                  />

                  <div className="space-y-3">
                    {woman.anc_visits.map((visit, visitIndex) => (
                      <div
                        key={
                          visit.id ||
                          `${woman.pregnant_woman_id}-anc-${visitIndex}`
                        }
                        className="rounded-lg border border-gray-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              ANC Visit #{visit.visit_number || visitIndex + 1}
                            </p>

                            <p className="text-sm text-gray-500">
                              {formatDate(visit.visit_date)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {visit.gestational_age_weeks !== undefined &&
                              visit.gestational_age_weeks !== null && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                  GA: {visit.gestational_age_weeks} weeks
                                </span>
                              )}

                            {visit.fetal_heart_rate !== undefined &&
                              visit.fetal_heart_rate !== null && (
                                <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700">
                                  FHR: {visit.fetal_heart_rate} bpm
                                </span>
                              )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <InfoItem
                            label="BP"
                            value={
                              visit.systolic_bp && visit.diastolic_bp
                                ? `${visit.systolic_bp}/${visit.diastolic_bp}`
                                : "—"
                            }
                          />

                          <InfoItem
                            label="Weight"
                            value={
                              visit.weight_kg ? `${visit.weight_kg} kg` : "—"
                            }
                          />

                          <InfoItem
                            label="Fundal Height"
                            value={
                              visit.fundal_height_cm
                                ? `${visit.fundal_height_cm} cm`
                                : "—"
                            }
                          />

                          <InfoItem
                            label="Temperature"
                            value={
                              visit.temperature
                                ? `${visit.temperature} °C`
                                : "—"
                            }
                          />
                        </div>

                        {(visit.overall_assessment ||
                          visit.management_advice ||
                          visit.concerns) && (
                          <div className="mt-3 space-y-2">
                            {visit.overall_assessment && (
                              <div className="rounded-lg bg-gray-50 p-3">
                                <p className="text-xs font-semibold text-gray-500">
                                  Assessment
                                </p>

                                <p className="mt-1 text-sm text-gray-700">
                                  {visit.overall_assessment}
                                </p>
                              </div>
                            )}

                            {visit.management_advice && (
                              <div className="rounded-lg bg-gray-50 p-3">
                                <p className="text-xs font-semibold text-gray-500">
                                  Management / Advice
                                </p>

                                <p className="mt-1 text-sm text-gray-700">
                                  {visit.management_advice}
                                </p>
                              </div>
                            )}

                            {visit.concerns && (
                              <div className="rounded-lg bg-gray-50 p-3">
                                <p className="text-xs font-semibold text-gray-500">
                                  Concerns
                                </p>

                                <p className="mt-1 text-sm text-gray-700">
                                  {visit.concerns}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

            {/* =================================================
                MOBILE COUNTS
            ================================================= */}

            <div className="grid grid-cols-2 gap-3 sm:hidden">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-600">ANC Visits</p>

                <p className="mt-1 text-xl font-bold text-blue-800">
                  {ancCount}
                </p>
              </div>

              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xs text-purple-600">Home Visits</p>

                <p className="mt-1 text-xl font-bold text-purple-800">
                  {homeVisitCount}
                </p>
              </div>
            </div>

            {/* Snapshot note */}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                <div>
                  <p className="font-semibold text-blue-900">
                    Submitted report snapshot
                  </p>

                  <p className="mt-1 text-sm leading-6 text-blue-800">
                    The information shown here comes from the report snapshot
                    submitted by the BHW. This allows the Midwife to review
                    exactly what was submitted for this reporting period.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */

export default function MidwifeMonthlyReportDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [bhw, setBhw] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [showReturnModal, setShowReturnModal] = useState(false);

  const [reviewNotes, setReviewNotes] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  /* ==========================================================
     CURRENT USER
  ========================================================== */

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error("Unable to read current user:", err);
    }
  }, []);

  /* ==========================================================
     LOAD REPORT
  ========================================================== */

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  async function fetchReport() {
    try {
      setLoading(true);
      setError("");

      /* ------------------------------------------------------
         Get report
      ------------------------------------------------------ */

      const { data: reportData, error: reportError } = await supabase
        .from("bhw_monthly_reports")
        .select(
          `
          id,
          bhw_id,
          month,
          year,
          status,
          report_data,
          submitted_at,
          updated_at
        `,
        )
        .eq("id", id)
        .single();

      if (reportError) {
        throw reportError;
      }

      if (!reportData) {
        throw new Error("Monthly report could not be found.");
      }

      setReport(reportData);

      /* ------------------------------------------------------
         Get BHW
      ------------------------------------------------------ */

      if (reportData.bhw_id) {
        const { data: bhwData, error: bhwError } = await supabase
          .from("users")
          .select(
            `
            id,
            first_name,
            middle_name,
            last_name,
            username,
            role,
            barangay_id,
            district_id
          `,
          )
          .eq("id", reportData.bhw_id)
          .single();

        if (bhwError) {
          console.error("Unable to load BHW:", bhwError);
        } else {
          setBhw(bhwData);
        }
      }
    } catch (err) {
      console.error("Error loading monthly report:", err);

      setError(err?.message || "Unable to load the monthly pregnancy report.");
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     REPORT DATA
  ========================================================== */

  const reportData = report?.report_data || {};

  const pregnantWomen = Array.isArray(reportData.pregnant_women)
    ? reportData.pregnant_women
    : [];

  const pregnancyTracking = reportData.pregnancy_tracking || {};

  const totalPregnantWomen =
    Number(pregnancyTracking.total) || pregnantWomen.length || 0;

  const newPregnancies = Number(pregnancyTracking.new) || 0;

  const previousPregnancies = Number(pregnancyTracking.last_month) || 0;

  const homeVisitsCompleted =
    Number(pregnancyTracking.completed_home_visits) || 0;

  /* ==========================================================
     SORT WOMEN
  ========================================================== */

  const sortedPregnantWomen = useMemo(() => {
    return [...pregnantWomen].sort((a, b) => {
      const nameA = String(a?.name || "").toLowerCase();
      const nameB = String(b?.name || "").toLowerCase();

      return nameA.localeCompare(nameB);
    });
  }, [pregnantWomen]);

  /* ==========================================================
     ACCEPT REPORT
  ========================================================== */

  async function handleAcceptReport() {
    if (!report) return;

    const confirmed = window.confirm(
      "Are you sure you want to mark this monthly pregnancy report as reviewed?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const reviewerId = currentUser?.id || null;

      /*
       * IMPORTANT:
       * This assumes the following columns exist:
       *
       * reviewed_by
       * reviewed_at
       * review_notes
       */

      const updateData = {
        status: "reviewed",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from("bhw_monthly_reports")
        .update(updateData)
        .eq("id", report.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setReport(data);

      alert("Monthly pregnancy report has been marked as reviewed.");

      navigate("/dashboard/midwife/monthly-reports");
    } catch (err) {
      console.error("Error accepting report:", err);

      setError(err?.message || "Unable to mark the report as reviewed.");
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     RETURN REPORT
  ========================================================== */

  async function handleReturnReport() {
    if (!report) return;

    if (!reviewNotes.trim()) {
      setError(
        "Please provide a reason or review note before returning the report.",
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const reviewerId = currentUser?.id || null;

      const updateData = {
        status: "returned",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes.trim(),
        returned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from("bhw_monthly_reports")
        .update(updateData)
        .eq("id", report.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setReport(data);
      setShowReturnModal(false);

      alert("Monthly pregnancy report has been returned to the BHW.");

      navigate("/dashboard/midwife/monthly-reports");
    } catch (err) {
      console.error("Error returning report:", err);

      setError(err?.message || "Unable to return the report.");
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

            <p className="text-sm text-gray-500">
              Loading monthly pregnancy report...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ==========================================================
     ERROR / NOT FOUND
  ========================================================== */

  if (!report) {
    return (
      <DashboardLayout>
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard/midwife/monthly-reports")}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Monthly Reports
          </button>

          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="flex gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-red-600" />

              <div>
                <h2 className="font-semibold text-red-900">Report not found</h2>

                <p className="mt-1 text-sm text-red-700">
                  {error || "The requested monthly report could not be found."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statusConfig = getStatusConfig(report.status);

  const StatusIcon = statusConfig.icon;

  const isSubmitted = report.status === "submitted";

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ====================================================
            BACK
        ===================================================== */}

        <button
          type="button"
          onClick={() => navigate("/dashboard/midwife/monthly-reports")}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Monthly Reports
        </button>

        {/* ====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="flex-1">
              <p className="font-semibold">Unable to complete action</p>

              <p className="mt-1 text-sm">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ====================================================
            HEADER
        ===================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <FileCheck2 className="h-6 w-6 text-blue-600" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                      Monthly Pregnancy Report
                    </h1>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusConfig.className}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />

                      {statusConfig.label}
                    </span>
                  </div>

                  <p className="mt-1 text-gray-500">
                    {formatMonthYear(report.month, report.year)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Report ID: {report.id}
                  </p>
                </div>
              </div>

              {/* BHW */}

              <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <UserRound className="h-5 w-5 text-orange-600" />
                </div>

                <div>
                  <p className="text-xs text-gray-500">Submitted by</p>

                  <p className="font-semibold text-gray-900">
                    {getFullName(bhw)}
                  </p>

                  <p className="text-xs text-gray-500">
                    {bhw?.username || "Barangay Health Worker"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================
              REPORT METADATA
          =================================================== */}

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              icon={CalendarDays}
              label="Reporting Period"
              value={formatMonthYear(report.month, report.year)}
            />

            <InfoItem
              icon={Clock3}
              label="Submitted"
              value={formatDate(report.submitted_at)}
            />

            <InfoItem
              icon={Users}
              label="Pregnant Women"
              value={totalPregnantWomen}
            />

            <InfoItem
              icon={HeartPulse}
              label="New Pregnancies"
              value={newPregnancies}
            />
          </div>
        </div>

        {/* ====================================================
            SUMMARY
        ===================================================== */}

        <div>
          <SectionTitle
            icon={ClipboardCheck}
            title="Pregnancy Summary"
            description="Summary of pregnancy activities reported by the BHW for this month."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm text-blue-700">
                Registered Previous / Last Month
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-900">
                {previousPregnancies}
              </p>
            </div>

            <div className="rounded-xl border border-pink-200 bg-pink-50 p-5">
              <p className="text-sm text-pink-700">New This Month</p>

              <p className="mt-2 text-3xl font-bold text-pink-900">
                {newPregnancies}
              </p>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
              <p className="text-sm text-purple-700">Total Pregnant Women</p>

              <p className="mt-2 text-3xl font-bold text-purple-900">
                {totalPregnantWomen}
              </p>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm text-green-700">Completed Home Visits</p>

              <p className="mt-2 text-3xl font-bold text-green-900">
                {homeVisitsCompleted}
              </p>
            </div>
          </div>
        </div>

        {/* ====================================================
            PREGNANT WOMEN
        ===================================================== */}

        <div>
          <SectionTitle
            icon={Users}
            title="Pregnant Women Included in Report"
            description="Each pregnancy is displayed separately so the Midwife can distinguish and review every woman."
          />

          {sortedPregnantWomen.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Users className="h-7 w-7 text-gray-400" />
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">
                No individual pregnancy records
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                The submitted report does not contain individual pregnant woman
                records.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPregnantWomen.map((woman, index) => (
                <PregnantWomanCard
                  key={woman.pregnant_woman_id || `${report.id}-${index}`}
                  woman={woman}
                  index={index}
                  report={report}
                />
              ))}
            </div>
          )}
        </div>

        {/* ====================================================
            REVIEW AREA
        ===================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">Midwife Review</h2>

                <p className="text-sm text-gray-500">
                  Review the submitted report before accepting or returning it.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label
                htmlFor="reviewNotes"
                className="flex items-center gap-2 text-sm font-semibold text-gray-700"
              >
                <MessageSquare className="h-4 w-4" />
                Review Notes
              </label>

              <textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                placeholder="Add notes, observations, or corrections..."
                disabled={!isSubmitted || saving}
                className="mt-3 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
              />

              {!isSubmitted && (
                <p className="mt-2 text-xs text-gray-500">
                  This report has already been processed and cannot be reviewed
                  again from this page.
                </p>
              )}
            </div>

            {/* Buttons */}

            {isSubmitted ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Return to BHW
                </button>

                <button
                  type="button"
                  onClick={handleAcceptReport}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}

                  {saving ? "Saving..." : "Accept Report"}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <StatusIcon className="h-5 w-5 text-gray-500" />

                  <div>
                    <p className="font-medium text-gray-900">
                      Report Status: {statusConfig.label}
                    </p>

                    <p className="text-sm text-gray-500">
                      This report is no longer waiting for Midwife review.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ====================================================
            BOTTOM NOTE
        ===================================================== */}

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <p className="font-semibold text-blue-900">Next workflow</p>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Once the Midwife accepts the report, it is marked as{" "}
                <strong>Reviewed</strong>. The next stage of your system can
                then use the reviewed monthly reports for the Midwife-to-Nurse
                submission workflow.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          RETURN MODAL
      ======================================================= */}

      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}

            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-orange-600" />

                  <h2 className="text-lg font-bold text-gray-900">
                    Return Report
                  </h2>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Send this report back to the BHW for correction.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={saving}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}

            <div className="p-5">
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm leading-6 text-orange-800">
                  Please provide a clear reason so the BHW knows what needs to
                  be corrected before resubmitting the report.
                </p>
              </div>

              <label
                htmlFor="returnReason"
                className="mt-4 block text-sm font-semibold text-gray-700"
              >
                Reason for Return
                <span className="ml-1 text-red-500">*</span>
              </label>

              <textarea
                id="returnReason"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={5}
                placeholder="Example: Please verify the ANC count for Maria Santos and update the home visit information."
                disabled={saving}
                className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-gray-100"
              />
            </div>

            {/* Footer */}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 bg-gray-50 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReturnReport}
                disabled={saving || !reviewNotes.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}

                {saving ? "Returning..." : "Return Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
