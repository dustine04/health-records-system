import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  HeartPulse,
  Home,
  MapPin,
  RefreshCw,
  Save,
  Send,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EMPTY_REPORT = {
  pregnancy_tracking: {
    last_month: 0,
    new: 0,
    total: 0,
    mc_book: 0,
    birth_plan: 0,
    completed_home_visits: 0,
  },

  pregnant_women: [],

  prenatal_checkup: {
    first_trimester: [],
    second_trimester: [],
    third_trimester: [],
  },

  deliveries: {
    total: 0,
    at_health_facility: 0,
    with_pnv4: 0,
    with_completed_4_hv: 0,
    home_delivery: 0,
  },

  postpartum: {
    fp_completed_home_visit: 0,
    pregnant_next_month: 0,
  },

  pregnant_deworming: 0,

  postpartum_vitamin_a: 0,

  family_planning: {
    new_acceptors: {
      age_15_19: 0,
      age_20_49: 0,
      btl: 0,
      nsv: 0,
      coc: 0,
      pop: 0,
      iud: 0,
      dmpa: 0,
      lam: 0,
      condom: 0,
      implant: 0,
    },

    dropouts: {
      age_15_19: 0,
      age_20_49: 0,
      btl: 0,
      nsv: 0,
      coc: 0,
      pop: 0,
      iud: 0,
      dmpa: 0,
      lam: 0,
      condom: 0,
      implant: 0,
    },

    current_users: {
      age_15_19: 0,
      age_20_49: 0,
      btl: 0,
      nsv: 0,
      coc: 0,
      pop: 0,
      iud: 0,
      dmpa: 0,
      lam: 0,
      condom: 0,
      implant: 0,
    },
  },

  women_deworming: 0,

  consultation_referrals: 0,

  iec: {
    individual_health_counseling: 0,
    bench_conference: 0,
    household_study_group: 0,
    care_giver_class: 0,
  },

  tb_dots_referrals: 0,

  agencies_coordinated: "",

  deaths: [],
};

/* =========================================================
   GENERAL HELPERS
========================================================= */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getMonthRange(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    start,
    end,
  };
}

function isDateInRange(dateValue, start, end) {
  if (!dateValue) return false;

  const date = new Date(`${dateValue}T00:00:00`);

  return date >= start && date < end;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calculateAge(birthDate, referenceDate = new Date()) {
  if (!birthDate) return "-";

  const birth = new Date(`${birthDate}T00:00:00`);

  let age = referenceDate.getFullYear() - birth.getFullYear();

  const monthDifference = referenceDate.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && referenceDate.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
}

function getFullName(resident) {
  if (!resident) return "Unknown";

  return [resident.first_name, resident.middle_name, resident.last_name]
    .filter(Boolean)
    .join(" ");
}

function getTrimester(gestationalAge) {
  const weeks = Number(gestationalAge);

  if (!Number.isFinite(weeks)) {
    return "Unknown";
  }

  if (weeks <= 13) return "First Trimester";
  if (weeks <= 27) return "Second Trimester";

  return "Third Trimester";
}

function getTrimesterKey(gestationalAge) {
  const weeks = Number(gestationalAge);

  if (!Number.isFinite(weeks)) {
    return null;
  }

  if (weeks <= 13) return "first_trimester";
  if (weeks <= 27) return "second_trimester";

  return "third_trimester";
}

/* =========================================================
   REPORT STATUS HELPERS
========================================================= */

function isReportLocked(status) {
  return status === "submitted" || status === "reviewed";
}

function canEditReport(status) {
  return status === "draft" || status === "returned";
}

function canSubmitReport(status) {
  return status === "draft" || status === "returned";
}

function getStatusLabel(status) {
  switch (status) {
    case "draft":
      return "Draft";

    case "submitted":
      return "Submitted - Under Review";

    case "reviewed":
      return "Reviewed / Accepted";

    case "returned":
      return "Returned for Correction";

    default:
      return status || "Draft";
  }
}

/* =========================================================
   MERGE SAVED + AUTOMATIC REPORT
========================================================= */

function mergeReport(existing, generated) {
  const existingReport = existing || {};

  return {
    ...clone(EMPTY_REPORT),
    ...existingReport,

    pregnancy_tracking: {
      ...EMPTY_REPORT.pregnancy_tracking,
      ...(existingReport.pregnancy_tracking || {}),
      ...generated.pregnancy_tracking,
    },

    pregnant_women: generated.pregnant_women,

    prenatal_checkup: generated.prenatal_checkup,

    deliveries: {
      ...EMPTY_REPORT.deliveries,
      ...(existingReport.deliveries || {}),
    },

    postpartum: {
      ...EMPTY_REPORT.postpartum,
      ...(existingReport.postpartum || {}),
    },

    family_planning: {
      ...clone(EMPTY_REPORT.family_planning),
      ...(existingReport.family_planning || {}),
    },

    iec: {
      ...EMPTY_REPORT.iec,
      ...(existingReport.iec || {}),
    },

    deaths: existingReport.deaths || [],
  };
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function SectionCard({ title, icon: Icon, children, description }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Icon size={19} />
            </div>
          )}

          <div>
            <h2 className="font-semibold text-gray-800">{title}</h2>

            {description && (
              <p className="mt-0.5 text-xs text-gray-500">{description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function NumberInput({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        value={value ?? 0}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-gray-800">{value || "-"}</p>
    </div>
  );
}

function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

/* =========================================================
   PREGNANT WOMAN CARD
========================================================= */

function PregnantWomanCard({ woman, index, expanded, onToggle }) {
  const pregnancy = woman.pregnancy || {};

  const monthlyAnc = woman.monthly_anc || [];
  const monthlyHomeVisits = woman.monthly_home_visits || [];
  const monthlyReferrals = woman.monthly_referrals || [];

  const totalAnc = woman.all_anc_visits?.length || 0;
  const totalHomeVisits = woman.all_home_visits?.length || 0;
  const totalReferrals = woman.all_referrals?.length || 0;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="border-b border-gray-200 bg-gray-50 p-5 transition hover:bg-gray-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                <UserRound size={21} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-600">
                    Pregnant Woman #{index + 1}
                  </span>

                  {pregnancy.family_record_no && (
                    <Badge className="bg-purple-50 text-purple-700">
                      Family Record: {pregnancy.family_record_no}
                    </Badge>
                  )}

                  <Badge className="bg-blue-50 text-blue-700">
                    Pregnancy ID: {pregnancy.id}
                  </Badge>
                </div>

                <h3 className="mt-1 text-lg font-bold text-gray-800">
                  {woman.name}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {woman.address || "Address not available"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700">
                ANC: {monthlyAnc.length}
              </Badge>

              <Badge className="bg-green-50 text-green-700">
                Home: {monthlyHomeVisits.length}
              </Badge>

              <Badge className="bg-orange-50 text-orange-700">
                Referrals: {monthlyReferrals.length}
              </Badge>

              {expanded ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-6 p-5">
          {/* PREGNANCY INFORMATION */}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <HeartPulse size={18} className="text-pink-600" />

              <h4 className="font-semibold text-gray-800">
                Pregnancy Information
              </h4>
            </div>

            <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Name" value={woman.name} />

              <InfoItem
                label="Age"
                value={woman.age !== "-" ? `${woman.age} years old` : "-"}
              />

              <InfoItem
                label="Family Record No."
                value={pregnancy.family_record_no}
              />

              <InfoItem label="MC Book No." value={pregnancy.mc_book_number} />

              <InfoItem
                label="Registration Date"
                value={formatDate(pregnancy.date_of_registration)}
              />

              <InfoItem label="LMP" value={formatDate(pregnancy.lmp)} />

              <InfoItem label="EDC / EDD" value={formatDate(pregnancy.edc)} />

              <InfoItem label="Gravida" value={pregnancy.gravida} />

              <InfoItem label="Para" value={pregnancy.para} />

              <InfoItem label="Civil Status" value={pregnancy.civil_status} />

              <InfoItem
                label="Husband / Partner"
                value={pregnancy.husband_name}
              />

              <InfoItem label="Blood Type" value={pregnancy.blood_type} />

              <InfoItem
                label="PhilHealth No."
                value={pregnancy.philhealth_no}
              />

              <InfoItem label="Facility" value={pregnancy.facility_name} />

              <InfoItem
                label="Birth Plan"
                value={woman.birth_plan ? "Accomplished" : "Not recorded"}
              />

              <InfoItem label="Pregnancy Status" value={pregnancy.status} />
            </div>
          </div>

          {/* LOCATION */}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-red-500" />

              <h4 className="font-semibold text-gray-800">
                Household / Location
              </h4>
            </div>

            <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Household Code" value={woman.household_code} />

              <InfoItem label="Household Head" value={woman.household_head} />

              <InfoItem label="Purok / Sitio" value={woman.local_area_name} />

              <InfoItem label="Barangay" value={woman.barangay_name} />
            </div>
          </div>

          {/* ANC VISITS */}

          <div>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-blue-600" />

                <h4 className="font-semibold text-gray-800">
                  ANC Visits This Month
                </h4>
              </div>

              <span className="text-xs text-gray-500">
                Total ANC records: {totalAnc}
              </span>
            </div>

            {monthlyAnc.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                No ANC visit recorded for this month.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Visit
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Date
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Trimester
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        GA
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        BP
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Pulse
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Temperature
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Assessment
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {monthlyAnc.map((visit) => (
                      <tr key={visit.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          #{visit.visit_number}
                        </td>

                        <td className="px-4 py-3">
                          {formatDate(visit.visit_date)}
                        </td>

                        <td className="px-4 py-3">
                          {getTrimester(visit.gestational_age_weeks)}
                        </td>

                        <td className="px-4 py-3">
                          {visit.gestational_age_weeks
                            ? `${visit.gestational_age_weeks} weeks`
                            : "-"}
                        </td>

                        <td className="px-4 py-3">
                          {visit.systolic_bp || visit.diastolic_bp
                            ? `${visit.systolic_bp || "-"}/${
                                visit.diastolic_bp || "-"
                              }`
                            : "-"}
                        </td>

                        <td className="px-4 py-3">{visit.pulse_rate || "-"}</td>

                        <td className="px-4 py-3">
                          {visit.temperature || "-"}
                        </td>

                        <td className="max-w-xs px-4 py-3">
                          {visit.overall_assessment ||
                            visit.concerns ||
                            visit.other_problems ||
                            "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* HOME VISITS */}

          <div>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Home size={18} className="text-green-600" />

                <h4 className="font-semibold text-gray-800">
                  Home Visits This Month
                </h4>
              </div>

              <span className="text-xs text-gray-500">
                Total home visits: {totalHomeVisits}
              </span>
            </div>

            {monthlyHomeVisits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                No home visit recorded for this month.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Visit
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Date
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Trimester
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Findings
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Danger Signs
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Action Taken
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Next Visit
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {monthlyHomeVisits.map((visit) => (
                      <tr key={visit.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-green-600">
                          #{visit.visit_number}
                        </td>

                        <td className="px-4 py-3">
                          {formatDate(visit.visit_date)}
                        </td>

                        <td className="px-4 py-3">{visit.trimester || "-"}</td>

                        <td className="max-w-xs px-4 py-3">
                          {visit.findings || "-"}
                        </td>

                        <td className="max-w-xs px-4 py-3">
                          {visit.danger_signs || "-"}
                        </td>

                        <td className="max-w-xs px-4 py-3">
                          {visit.action_taken || "-"}
                        </td>

                        <td className="px-4 py-3">
                          {formatDate(visit.next_visit_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* REFERRALS */}

          <div>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-orange-600" />

                <h4 className="font-semibold text-gray-800">
                  Pregnancy Referrals This Month
                </h4>
              </div>

              <span className="text-xs text-gray-500">
                Total referrals: {totalReferrals}
              </span>
            </div>

            {monthlyReferrals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                No pregnancy referral recorded for this month.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Referral Date
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Referred To
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Reason
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Urgency
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Status
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Notes
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Midwife Notes
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {monthlyReferrals.map((referral) => (
                      <tr key={referral.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {formatDate(referral.referral_date)}
                        </td>

                        <td className="px-4 py-3">
                          {referral.referred_to || "-"}
                        </td>

                        <td className="max-w-xs px-4 py-3">
                          {referral.reason || "-"}
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            className={
                              referral.urgency?.toLowerCase() === "urgent" ||
                              referral.urgency?.toLowerCase() === "high"
                                ? "bg-red-50 text-red-700"
                                : "bg-yellow-50 text-yellow-700"
                            }
                          >
                            {referral.urgency || "-"}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <Badge className="bg-blue-50 text-blue-700">
                            {referral.status || "-"}
                          </Badge>
                        </td>

                        <td className="max-w-xs px-4 py-3">
                          {referral.notes || "-"}
                        </td>

                        <td className="max-w-xs px-4 py-3">
                          {referral.midwife_notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function BhwMonthlyReport() {
  const storedUser = localStorage.getItem("user");

  const user = useMemo(() => {
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  }, [storedUser]);

  const currentDate = new Date();

  const [month, setMonth] = useState(currentDate.getMonth() + 1);

  const [year, setYear] = useState(currentDate.getFullYear());

  const [report, setReport] = useState(clone(EMPTY_REPORT));

  const [assignedAreas, setAssignedAreas] = useState([]);

  const [reportId, setReportId] = useState(null);

  const [status, setStatus] = useState("draft");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [expandedWomen, setExpandedWomen] = useState({});

  /* =======================================================
     LOAD REPORT
  ======================================================= */

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError("BHW user session was not found.");
      return;
    }

    setExpandedWomen({});
    loadReport();
  }, [user?.id, month, year]);

  /* =======================================================
     LOAD REPORT
  ======================================================= */

  async function loadReport() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data: savedReport, error: savedReportError } = await supabase
        .from("bhw_monthly_reports")
        .select("*")
        .eq("bhw_id", user.id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (savedReportError) {
        throw savedReportError;
      }

      const generatedReport = await generateAutomaticReport();

      if (savedReport) {
        setReportId(savedReport.id);

        setStatus(savedReport.status || "draft");

        setReport(mergeReport(savedReport.report_data || {}, generatedReport));
      } else {
        setReportId(null);
        setStatus("draft");

        setReport(mergeReport({}, generatedReport));
      }
    } catch (err) {
      console.error("Error loading monthly report:", err);

      setError(err.message || "Unable to load the monthly pregnancy report.");
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     AUTOMATICALLY GENERATE PREGNANCY DATA
     
     NO CHILD TABLES ARE QUERIED.
  ======================================================= */

  async function generateAutomaticReport() {
    const { start, end } = getMonthRange(month, year);

    /* -------------------------------------------------------
       1. GET BHW ASSIGNED AREAS
    ------------------------------------------------------- */

    const { data: assignments, error: assignmentError } = await supabase
      .from("worker_area_assignments")
      .select(
        `
        id,
        local_area_id,
        local_areas (
          id,
          name,
          type,
          barangays (
            id,
            name
          )
        )
      `,
      )
      .eq("worker_id", user.id)
      .eq("is_active", true);

    if (assignmentError) {
      throw assignmentError;
    }

    const activeAssignments = assignments || [];

    setAssignedAreas(activeAssignments);

    const areaIds = activeAssignments
      .map((item) => item.local_area_id)
      .filter(Boolean);

    if (areaIds.length === 0) {
      return {
        pregnancy_tracking: {
          last_month: 0,
          new: 0,
          total: 0,
          mc_book: 0,
          birth_plan: 0,
          completed_home_visits: 0,
        },

        pregnant_women: [],

        prenatal_checkup: {
          first_trimester: [],
          second_trimester: [],
          third_trimester: [],
        },
      };
    }

    /* -------------------------------------------------------
       2. GET HOUSEHOLDS
    ------------------------------------------------------- */

    const { data: households, error: householdError } = await supabase
      .from("households")
      .select(
        `
        id,
        household_code,
        household_head,
        local_area_id
      `,
      )
      .in("local_area_id", areaIds);

    if (householdError) {
      throw householdError;
    }

    const householdIds = (households || [])
      .map((household) => household.id)
      .filter(Boolean);

    if (householdIds.length === 0) {
      return {
        pregnancy_tracking: {
          last_month: 0,
          new: 0,
          total: 0,
          mc_book: 0,
          birth_plan: 0,
          completed_home_visits: 0,
        },

        pregnant_women: [],

        prenatal_checkup: {
          first_trimester: [],
          second_trimester: [],
          third_trimester: [],
        },
      };
    }

    /* -------------------------------------------------------
       3. GET FEMALE RESIDENTS
    ------------------------------------------------------- */

    const { data: residents, error: residentError } = await supabase
      .from("residents")
      .select(
        `
        id,
        household_id,
        first_name,
        middle_name,
        last_name,
        sex,
        birth_date,
        civil_status,
        contact_number,
        households (
          id,
          household_code,
          household_head,
          local_area_id,
          local_areas (
            id,
            name,
            type,
            barangays (
              id,
              name
            )
          )
        )
      `,
      )
      .in("household_id", householdIds)
      .eq("sex", "Female");

    if (residentError) {
      throw residentError;
    }

    const residentIds = (residents || [])
      .map((resident) => resident.id)
      .filter(Boolean);

    if (residentIds.length === 0) {
      return {
        pregnancy_tracking: {
          last_month: 0,
          new: 0,
          total: 0,
          mc_book: 0,
          birth_plan: 0,
          completed_home_visits: 0,
        },

        pregnant_women: [],

        prenatal_checkup: {
          first_trimester: [],
          second_trimester: [],
          third_trimester: [],
        },
      };
    }

    /* -------------------------------------------------------
       4. GET PREGNANCY REGISTRATIONS
    ------------------------------------------------------- */

    const { data: registrations, error: registrationError } = await supabase
      .from("pregnant_women")
      .select("*")
      .in("resident_id", residentIds)
      .order("date_of_registration", {
        ascending: true,
      });

    if (registrationError) {
      throw registrationError;
    }

    const registeredByEndOfMonth = (registrations || []).filter(
      (registration) => {
        if (!registration.date_of_registration) {
          return false;
        }

        const registrationDate = new Date(
          `${registration.date_of_registration}T00:00:00`,
        );

        return registrationDate < end;
      },
    );

    if (registeredByEndOfMonth.length === 0) {
      return {
        pregnancy_tracking: {
          last_month: 0,
          new: 0,
          total: 0,
          mc_book: 0,
          birth_plan: 0,
          completed_home_visits: 0,
        },

        pregnant_women: [],

        prenatal_checkup: {
          first_trimester: [],
          second_trimester: [],
          third_trimester: [],
        },
      };
    }

    const pregnancyIds = registeredByEndOfMonth
      .map((pregnancy) => pregnancy.id)
      .filter(Boolean);

    /* -------------------------------------------------------
       5. GET ANC VISITS
    ------------------------------------------------------- */

    const { data: allAncVisits, error: ancError } = await supabase
      .from("pregnant_woman_visits")
      .select("*")
      .in("pregnant_woman_id", pregnancyIds)
      .order("visit_date", {
        ascending: true,
      });

    if (ancError) {
      throw ancError;
    }

    /* -------------------------------------------------------
       6. GET HOME VISITS
    ------------------------------------------------------- */

    const { data: allHomeVisits, error: homeVisitError } = await supabase
      .from("pregnant_woman_home_visits")
      .select("*")
      .in("pregnant_woman_id", pregnancyIds)
      .order("visit_date", {
        ascending: true,
      });

    if (homeVisitError) {
      throw homeVisitError;
    }

    /* -------------------------------------------------------
       7. GET PREGNANCY REFERRALS
    ------------------------------------------------------- */

    const { data: allReferrals, error: referralError } = await supabase
      .from("pregnancy_referrals")
      .select("*")
      .in("pregnant_woman_id", pregnancyIds)
      .order("referral_date", {
        ascending: true,
      });

    if (referralError) {
      throw referralError;
    }

    /* -------------------------------------------------------
       8. LOOKUP MAPS
    ------------------------------------------------------- */

    const residentMap = new Map();

    (residents || []).forEach((resident) => {
      residentMap.set(Number(resident.id), resident);
    });

    const ancByPregnancy = new Map();

    (allAncVisits || []).forEach((visit) => {
      const pregnancyId = Number(visit.pregnant_woman_id);

      if (!ancByPregnancy.has(pregnancyId)) {
        ancByPregnancy.set(pregnancyId, []);
      }

      ancByPregnancy.get(pregnancyId).push(visit);
    });

    const homeVisitsByPregnancy = new Map();

    (allHomeVisits || []).forEach((visit) => {
      const pregnancyId = Number(visit.pregnant_woman_id);

      if (!homeVisitsByPregnancy.has(pregnancyId)) {
        homeVisitsByPregnancy.set(pregnancyId, []);
      }

      homeVisitsByPregnancy.get(pregnancyId).push(visit);
    });

    const referralsByPregnancy = new Map();

    (allReferrals || []).forEach((referral) => {
      const pregnancyId = Number(referral.pregnant_woman_id);

      if (!referralsByPregnancy.has(pregnancyId)) {
        referralsByPregnancy.set(pregnancyId, []);
      }

      referralsByPregnancy.get(pregnancyId).push(referral);
    });

    /* -------------------------------------------------------
       9. BUILD PREGNANT WOMEN
    ------------------------------------------------------- */

    const pregnantWomen = registeredByEndOfMonth
      .map((pregnancy) => {
        const resident = residentMap.get(Number(pregnancy.resident_id));

        if (!resident) {
          return null;
        }

        const household = resident.households || {};

        const localArea = household.local_areas || {};

        const ancVisits = ancByPregnancy.get(Number(pregnancy.id)) || [];

        const homeVisits =
          homeVisitsByPregnancy.get(Number(pregnancy.id)) || [];

        const referrals = referralsByPregnancy.get(Number(pregnancy.id)) || [];

        const monthlyAnc = ancVisits.filter((visit) =>
          isDateInRange(visit.visit_date, start, end),
        );

        const monthlyHomeVisits = homeVisits.filter((visit) =>
          isDateInRange(visit.visit_date, start, end),
        );

        const monthlyReferrals = referrals.filter((referral) =>
          isDateInRange(referral.referral_date, start, end),
        );

        const referenceDate = new Date(year, month, 0);

        return {
          pregnant_woman_id: pregnancy.id,

          resident_id: resident.id,

          name: getFullName(resident),

          age: calculateAge(resident.birth_date, referenceDate),

          address:
            [localArea.name, localArea.barangays?.name]
              .filter(Boolean)
              .join(", ") ||
            household.household_head ||
            "",

          household_code: household.household_code || "",

          household_head: household.household_head || "",

          local_area_name: localArea.name || "",

          barangay_name: localArea.barangays?.name || "",

          pregnancy,

          birth_plan: Boolean(
            pregnancy.birth_plan ||
            monthlyAnc.some((visit) => visit.birth_plan),
          ),

          mc_book: Boolean(pregnancy.mc_book_number),

          monthly_anc: monthlyAnc,

          monthly_home_visits: monthlyHomeVisits,

          monthly_referrals: monthlyReferrals,

          all_anc_visits: ancVisits,

          all_home_visits: homeVisits,

          all_referrals: referrals,
        };
      })
      .filter(Boolean);

    /* -------------------------------------------------------
       10. PREGNANCY TRACKING
    ------------------------------------------------------- */

    const registeredBeforeMonth = registeredByEndOfMonth.filter((pregnancy) => {
      const registrationDate = new Date(
        `${pregnancy.date_of_registration}T00:00:00`,
      );

      return registrationDate < start;
    });

    const registeredDuringMonth = registeredByEndOfMonth.filter((pregnancy) =>
      isDateInRange(pregnancy.date_of_registration, start, end),
    );

    const womenWithHomeVisits = pregnantWomen.filter(
      (woman) => woman.monthly_home_visits.length > 0,
    );

    const womenWithMCBook = pregnantWomen.filter((woman) => woman.mc_book);

    const womenWithBirthPlan = pregnantWomen.filter(
      (woman) => woman.birth_plan,
    );

    /* -------------------------------------------------------
       11. ANC GROUPS
    ------------------------------------------------------- */

    const prenatalCheckup = {
      first_trimester: [],
      second_trimester: [],
      third_trimester: [],
    };

    pregnantWomen.forEach((woman) => {
      woman.monthly_anc.forEach((visit) => {
        const key = getTrimesterKey(visit.gestational_age_weeks);

        if (!key) return;

        prenatalCheckup[key].push({
          ...visit,

          pregnant_woman_id: woman.pregnant_woman_id,

          resident_id: woman.resident_id,

          name: woman.name,

          age: woman.age,

          address: woman.address,

          household_code: woman.household_code,

          local_area_name: woman.local_area_name,

          barangay_name: woman.barangay_name,
        });
      });
    });

    return {
      pregnancy_tracking: {
        last_month: registeredBeforeMonth.length,

        new: registeredDuringMonth.length,

        total: registeredByEndOfMonth.length,

        mc_book: womenWithMCBook.length,

        birth_plan: womenWithBirthPlan.length,

        completed_home_visits: womenWithHomeVisits.length,
      },

      pregnant_women: pregnantWomen,

      prenatal_checkup: prenatalCheckup,
    };
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function refreshReport() {
    if (!user?.id) return;

    if (isReportLocked(status)) {
      setError(
        "This report is locked because it has already been submitted or reviewed.",
      );
      return;
    }

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      const generatedReport = await generateAutomaticReport();

      setReport((previous) => mergeReport(previous, generatedReport));

      setMessage("Pregnancy data refreshed successfully from Supabase.");
    } catch (err) {
      console.error(err);

      setError(err.message || "Unable to refresh pregnancy data.");
    } finally {
      setRefreshing(false);
    }
  }

  /* =======================================================
     REPORT UPDATE HELPERS
  ======================================================= */

  function updateSection(section, field, value) {
    if (!canEditReport(status)) {
      return;
    }

    setReport((previous) => ({
      ...previous,

      [section]: {
        ...previous[section],
        [field]: value,
      },
    }));
  }

  function updateNestedSection(section, subsection, field, value) {
    if (!canEditReport(status)) {
      return;
    }

    setReport((previous) => ({
      ...previous,

      [section]: {
        ...previous[section],

        [subsection]: {
          ...previous[section][subsection],

          [field]: value,
        },
      },
    }));
  }

  /* =======================================================
     SAVE / SUBMIT REPORT
  ======================================================= */

  async function saveReport(submit = false) {
    if (!user?.id) {
      setError("User session not found.");
      return;
    }

    /* REVIEWED = FINAL */

    if (status === "reviewed") {
      setError(
        "This report has already been reviewed and accepted by the Midwife. It cannot be edited or submitted again.",
      );
      return;
    }

    /* SUBMITTED = WAITING FOR REVIEW */

    if (status === "submitted") {
      setError(
        "This report has already been submitted and is currently under Midwife review.",
      );
      return;
    }

    /* ONLY DRAFT / RETURNED CAN BE EDITED */

    if (!canEditReport(status)) {
      setError("This report cannot be edited in its current status.");
      return;
    }

    if (submit && !canSubmitReport(status)) {
      setError("This report cannot be submitted in its current status.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const now = new Date().toISOString();

      const reportData = {
        ...report,

        generated_for_month: month,

        generated_for_year: year,

        area_ids: assignedAreas
          .map((item) => item.local_area_id)
          .filter(Boolean),

        saved_at: now,
      };

      const payload = {
        bhw_id: user.id,

        month,

        year,

        status: submit ? "submitted" : status,

        report_data: reportData,

        updated_at: now,
      };

      /* =====================================================
         UPDATE EXISTING REPORT
      ===================================================== */

      if (reportId) {
        const updatePayload = {
          ...payload,
        };

        /*
          Only change submitted_at when actually submitting.
          This preserves the original submission timestamp
          while the report is being edited after return.
        */

        if (submit) {
          updatePayload.submitted_at = now;
        }

        const { data, error: updateError } = await supabase
          .from("bhw_monthly_reports")
          .update(updatePayload)
          .eq("id", reportId)
          .in("status", ["draft", "returned"])
          .select()
          .maybeSingle();

        if (updateError) {
          throw updateError;
        }

        /*
          If no row was returned, the database row
          was probably already submitted/reviewed.
        */

        if (!data) {
          throw new Error(
            "The report could not be updated. It may already have been submitted or reviewed.",
          );
        }

        setReportId(data.id);

        setStatus(data.status);

        setMessage(
          submit
            ? "Monthly pregnancy report has been submitted to the Midwife for review."
            : data.status === "returned"
              ? "Corrections saved. The report is still marked as returned until you resubmit it."
              : "Monthly pregnancy report saved as draft.",
        );

        return;
      }

      /* =====================================================
         CREATE NEW REPORT
      ===================================================== */

      const { data, error: insertError } = await supabase
        .from("bhw_monthly_reports")
        .insert({
          ...payload,

          status: submit ? "submitted" : "draft",

          submitted_at: submit ? now : null,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setReportId(data.id);

      setStatus(data.status);

      setMessage(
        submit
          ? "Monthly pregnancy report has been submitted to the Midwife for review."
          : "Monthly pregnancy report saved as draft.",
      );
    } catch (err) {
      console.error("Error saving monthly report:", err);

      setError(err.message || "Unable to save monthly report.");
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     EXPAND / COLLAPSE WOMEN
  ======================================================= */

  function toggleWoman(pregnantWomanId) {
    setExpandedWomen((previous) => ({
      ...previous,

      [pregnantWomanId]: !previous[pregnantWomanId],
    }));
  }

  function expandAllWomen() {
    const expanded = {};

    report.pregnant_women.forEach((woman) => {
      expanded[woman.pregnant_woman_id] = true;
    });

    setExpandedWomen(expanded);
  }

  function collapseAllWomen() {
    setExpandedWomen({});
  }

  /* =======================================================
     CALCULATED VALUES
  ======================================================= */

  const totalANC =
    report.prenatal_checkup.first_trimester.length +
    report.prenatal_checkup.second_trimester.length +
    report.prenatal_checkup.third_trimester.length;

  const totalHomeVisits = report.pregnant_women.reduce(
    (sum, woman) => sum + woman.monthly_home_visits.length,
    0,
  );

  const totalReferrals = report.pregnant_women.reduce(
    (sum, woman) => sum + woman.monthly_referrals.length,
    0,
  );

  const reportTitle = useMemo(
    () => `BHW Monthly Pregnancy Report - ${MONTHS[month - 1]} ${year}`,
    [month, year],
  );

  const assignedAreaLabel = useMemo(
    () =>
      assignedAreas
        .map((item) => {
          const localArea = item.local_areas;

          const barangay = localArea?.barangays?.name;

          if (!localArea?.name) {
            return barangay || "";
          }

          return barangay ? `${localArea.name} - ${barangay}` : localArea.name;
        })
        .filter(Boolean)
        .join(", "),
    [assignedAreas],
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <RefreshCw
              size={28}
              className="mx-auto mb-3 animate-spin text-blue-600"
            />

            <p className="font-medium text-gray-700">
              Loading pregnancy report...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Automatically gathering pregnancy records, ANC visits, home visits
              and referrals.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 size={28} className="text-blue-600" />

              <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">
                BHW Monthly Pregnancy Report
              </h1>
            </div>

            <p className="mt-1 text-sm text-gray-500">{reportTitle}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>

              <Badge
                className={
                  status === "draft"
                    ? "bg-gray-100 text-gray-700"
                    : status === "submitted"
                      ? "bg-blue-50 text-blue-700"
                      : status === "reviewed"
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                }
              >
                {getStatusLabel(status)}
              </Badge>
            </div>

            <p className="mt-1 text-xs text-gray-400">
              Pregnancy information is automatically populated from your
              assigned areas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* REFRESH */}

            <button
              type="button"
              onClick={refreshReport}
              disabled={refreshing || isReportLocked(status)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh Data
            </button>

            {/* SAVE */}

            <button
              type="button"
              disabled={saving || !canEditReport(status)}
              onClick={() => saveReport(false)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} />
              Save Draft
            </button>

            {/* SUBMIT / RESUBMIT */}

            <button
              type="button"
              disabled={saving || !canSubmitReport(status)}
              onClick={() => {
                const confirmationMessage =
                  status === "returned"
                    ? "Submit the corrected monthly pregnancy report to the Midwife again?"
                    : "Submit this monthly pregnancy report to the Midwife?";

                if (window.confirm(confirmationMessage)) {
                  saveReport(true);
                }
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={17} />

              {status === "returned"
                ? "Resubmit to Midwife"
                : "Submit to Midwife"}
            </button>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />

            <div>
              <p className="font-semibold">Unable to load/save report</p>

              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* =================================================
            SUCCESS MESSAGE
        ================================================= */}

        {message && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <FileCheck2 size={19} className="mt-0.5 shrink-0" />

            <p>{message}</p>
          </div>
        )}

        {/* =================================================
            SUBMITTED BANNER
        ================================================= */}

        {status === "submitted" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <Send size={20} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-semibold">Report Submitted</p>

                <p className="mt-1">
                  This monthly pregnancy report has been submitted to the
                  Midwife and is currently under review. You cannot edit or
                  resubmit it while it is under review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            REVIEWED BANNER
        ================================================= */}

        {status === "reviewed" && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <div className="flex items-start gap-3">
              <FileCheck2 size={20} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-semibold">Report Reviewed and Accepted</p>

                <p className="mt-1">
                  The Midwife has reviewed and accepted this monthly pregnancy
                  report. This report is now finalized and cannot be edited or
                  submitted again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            RETURNED BANNER
        ================================================= */}

        {status === "returned" && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-semibold">Returned for Correction</p>

                <p className="mt-1">
                  The Midwife returned this report for correction. You may edit
                  the report, save your corrections, and resubmit it to the
                  Midwife.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            REPORT INFORMATION
        ================================================= */}

        <SectionCard title="Report Information" icon={CalendarDays}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                BHW
              </label>

              <input
                disabled
                value={
                  user
                    ? [user.first_name, user.middle_name, user.last_name]
                        .filter(Boolean)
                        .join(" ")
                    : ""
                }
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Month
              </label>

              <select
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm disabled:bg-gray-100"
              >
                {MONTHS.map((monthName, index) => (
                  <option key={monthName} value={index + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Year
              </label>

              <input
                type="number"
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Assigned Purok / Sitio
            </label>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {assignedAreaLabel || "No assigned local areas found."}
            </div>
          </div>
        </SectionCard>

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Users size={19} />

              <span className="text-xs font-semibold uppercase">
                Pregnant Women
              </span>
            </div>

            <p className="mt-2 text-3xl font-bold text-blue-800">
              {report.pregnancy_tracking.total}
            </p>

            <p className="mt-1 text-xs text-blue-600">
              Registered by end of month
            </p>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-2 text-purple-600">
              <UserRound size={19} />

              <span className="text-xs font-semibold uppercase">New</span>
            </div>

            <p className="mt-2 text-3xl font-bold text-purple-800">
              {report.pregnancy_tracking.new}
            </p>

            <p className="mt-1 text-xs text-purple-600">
              Registered this month
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Stethoscope size={19} />

              <span className="text-xs font-semibold uppercase">
                ANC Visits
              </span>
            </div>

            <p className="mt-2 text-3xl font-bold text-blue-800">{totalANC}</p>

            <p className="mt-1 text-xs text-blue-600">Recorded this month</p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <Home size={19} />

              <span className="text-xs font-semibold uppercase">
                Home Visits
              </span>
            </div>

            <p className="mt-2 text-3xl font-bold text-green-800">
              {totalHomeVisits}
            </p>

            <p className="mt-1 text-xs text-green-600">Recorded this month</p>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle size={19} />

              <span className="text-xs font-semibold uppercase">Referrals</span>
            </div>

            <p className="mt-2 text-3xl font-bold text-orange-800">
              {totalReferrals}
            </p>

            <p className="mt-1 text-xs text-orange-600">Recorded this month</p>
          </div>
        </div>

        {/* =================================================
            PREGNANCY TRACKING
        ================================================= */}

        <SectionCard
          title="Pregnancy Tracking Summary"
          icon={HeartPulse}
          description="Automatically calculated from pregnancy registrations and monthly home visits."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberInput
              label="Pregnancy Last Month"
              value={report.pregnancy_tracking.last_month}
              disabled
              onChange={() => {}}
            />

            <NumberInput
              label="New Pregnancies"
              value={report.pregnancy_tracking.new}
              disabled
              onChange={() => {}}
            />

            <NumberInput
              label="Total Pregnant Women"
              value={report.pregnancy_tracking.total}
              disabled
              onChange={() => {}}
            />

            <NumberInput
              label="With MC Book"
              value={report.pregnancy_tracking.mc_book}
              disabled
              onChange={() => {}}
            />

            <NumberInput
              label="With Birth Plan"
              value={report.pregnancy_tracking.birth_plan}
              disabled
              onChange={() => {}}
            />

            <NumberInput
              label="Completed Home Visits"
              value={report.pregnancy_tracking.completed_home_visits}
              disabled
              onChange={() => {}}
            />
          </div>
        </SectionCard>

        {/* =================================================
            PREGNANT WOMEN
        ================================================= */}

        <SectionCard
          title="Pregnant Women — Individual Records"
          icon={Users}
          description="Each woman's ANC visits, home visits and referrals are grouped under her own pregnancy record."
        >
          {report.pregnant_women.length > 0 && (
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={expandAllWomen}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Expand All
              </button>

              <button
                type="button"
                onClick={collapseAllWomen}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Collapse All
              </button>
            </div>
          )}

          <div className="space-y-4">
            {report.pregnant_women.map((woman, index) => (
              <PregnantWomanCard
                key={woman.pregnant_woman_id}
                woman={woman}
                index={index}
                expanded={expandedWomen[woman.pregnant_woman_id] === true}
                onToggle={() => toggleWoman(woman.pregnant_woman_id)}
              />
            ))}

            {report.pregnant_women.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <Users size={34} className="mx-auto mb-3 text-gray-300" />

                <p className="font-medium text-gray-600">
                  No pregnant women found.
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  No pregnancy registration was found in the BHW's assigned
                  Purok/Sitio for this report period.
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* =================================================
            ANC SUMMARY
        ================================================= */}

        <SectionCard
          title="ANC Summary by Trimester"
          icon={Stethoscope}
          description="This summary is automatically generated from pregnant_woman_visits."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs font-semibold uppercase text-blue-600">
                First Trimester
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-800">
                {report.prenatal_checkup.first_trimester.length}
              </p>

              <p className="mt-1 text-xs text-blue-600">0–13 weeks</p>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-5">
              <p className="text-xs font-semibold uppercase text-purple-600">
                Second Trimester
              </p>

              <p className="mt-2 text-3xl font-bold text-purple-800">
                {report.prenatal_checkup.second_trimester.length}
              </p>

              <p className="mt-1 text-xs text-purple-600">14–27 weeks</p>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-5">
              <p className="text-xs font-semibold uppercase text-orange-600">
                Third Trimester
              </p>

              <p className="mt-2 text-3xl font-bold text-orange-800">
                {report.prenatal_checkup.third_trimester.length}
              </p>

              <p className="mt-1 text-xs text-orange-600">28+ weeks</p>
            </div>
          </div>
        </SectionCard>

        {/* =================================================
            DELIVERIES
        ================================================= */}

        <SectionCard
          title="Deliveries This Month"
          icon={HeartPulse}
          description="These fields are currently manual because delivery-related values require additional business rules for monthly reporting."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberInput
              label="Number of Deliveries"
              value={report.deliveries.total}
              disabled={!canEditReport(status)}
              onChange={(value) => updateSection("deliveries", "total", value)}
            />

            <NumberInput
              label="Delivered at Health Facility"
              value={report.deliveries.at_health_facility}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("deliveries", "at_health_facility", value)
              }
            />

            <NumberInput
              label="Delivered with PNV4"
              value={report.deliveries.with_pnv4}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("deliveries", "with_pnv4", value)
              }
            />

            <NumberInput
              label="Completed 4 Home Visits"
              value={report.deliveries.with_completed_4_hv}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("deliveries", "with_completed_4_hv", value)
              }
            />

            <NumberInput
              label="Home Deliveries"
              value={report.deliveries.home_delivery}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("deliveries", "home_delivery", value)
              }
            />
          </div>
        </SectionCard>

        {/* =================================================
            POSTPARTUM
        ================================================= */}

        <SectionCard title="Postpartum" icon={HeartPulse}>
          <div className="grid gap-4 md:grid-cols-2">
            <NumberInput
              label="FP with Completed Home Visit"
              value={report.postpartum.fp_completed_home_visit}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("postpartum", "fp_completed_home_visit", value)
              }
            />

            <NumberInput
              label="Pregnant Women to Track Next Month"
              value={report.postpartum.pregnant_next_month}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("postpartum", "pregnant_next_month", value)
              }
            />
          </div>
        </SectionCard>

        {/* =================================================
            MATERNAL ACTIVITIES
        ================================================= */}

        <SectionCard title="Maternal Health Activities" icon={HeartPulse}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberInput
              label="Pregnant Women Given Deworming"
              value={report.pregnant_deworming}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                setReport((previous) => ({
                  ...previous,
                  pregnant_deworming: value,
                }))
              }
            />

            <NumberInput
              label="Postpartum Women Given Vitamin A"
              value={report.postpartum_vitamin_a}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                setReport((previous) => ({
                  ...previous,
                  postpartum_vitamin_a: value,
                }))
              }
            />

            <NumberInput
              label="Women of Reproductive Age Given Deworming"
              value={report.women_deworming}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                setReport((previous) => ({
                  ...previous,
                  women_deworming: value,
                }))
              }
            />
          </div>
        </SectionCard>

        {/* =================================================
            FAMILY PLANNING
        ================================================= */}

        <SectionCard title="Family Planning" icon={Users}>
          {[
            ["new_acceptors", "New Acceptors"],
            ["dropouts", "Drop-outs"],
            ["current_users", "Current Users"],
          ].map(([section, title]) => (
            <div
              key={section}
              className="mb-6 rounded-lg border border-gray-200 p-4 last:mb-0"
            >
              <h3 className="mb-4 font-semibold text-gray-800">{title}</h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <NumberInput
                  label="Age 15–19"
                  value={report.family_planning[section].age_15_19}
                  disabled={!canEditReport(status)}
                  onChange={(value) =>
                    updateNestedSection(
                      "family_planning",
                      section,
                      "age_15_19",
                      value,
                    )
                  }
                />

                <NumberInput
                  label="Age 20–49"
                  value={report.family_planning[section].age_20_49}
                  disabled={!canEditReport(status)}
                  onChange={(value) =>
                    updateNestedSection(
                      "family_planning",
                      section,
                      "age_20_49",
                      value,
                    )
                  }
                />

                {[
                  ["btl", "BTL"],
                  ["nsv", "NSV"],
                  ["coc", "COC"],
                  ["pop", "POP"],
                  ["iud", "IUD"],
                  ["dmpa", "DMPA"],
                  ["lam", "LAM"],
                  ["condom", "Condom"],
                  ["implant", "Implant"],
                ].map(([field, label]) => (
                  <NumberInput
                    key={field}
                    label={label}
                    value={report.family_planning[section][field]}
                    disabled={!canEditReport(status)}
                    onChange={(value) =>
                      updateNestedSection(
                        "family_planning",
                        section,
                        field,
                        value,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </SectionCard>

        {/* =================================================
            IEC / REFERRALS
        ================================================= */}

        <SectionCard title="IEC and Other Referrals" icon={ClipboardList}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberInput
              label="Consultation Referrals"
              value={report.consultation_referrals}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                setReport((previous) => ({
                  ...previous,
                  consultation_referrals: value,
                }))
              }
            />

            <NumberInput
              label="TB-DOTS Referrals"
              value={report.tb_dots_referrals}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                setReport((previous) => ({
                  ...previous,
                  tb_dots_referrals: value,
                }))
              }
            />

            <NumberInput
              label="Individual Health Counseling"
              value={report.iec.individual_health_counseling}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("iec", "individual_health_counseling", value)
              }
            />

            <NumberInput
              label="Bench Conference"
              value={report.iec.bench_conference}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("iec", "bench_conference", value)
              }
            />

            <NumberInput
              label="Household Study Group"
              value={report.iec.household_study_group}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("iec", "household_study_group", value)
              }
            />

            <NumberInput
              label="Care Giver Class"
              value={report.iec.care_giver_class}
              disabled={!canEditReport(status)}
              onChange={(value) =>
                updateSection("iec", "care_giver_class", value)
              }
            />
          </div>

          <div className="mt-5">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Agencies Coordinated This Month
            </label>

            <textarea
              rows={3}
              value={report.agencies_coordinated}
              disabled={!canEditReport(status)}
              onChange={(e) =>
                setReport((previous) => ({
                  ...previous,
                  agencies_coordinated: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Enter agencies coordinated this month..."
            />
          </div>
        </SectionCard>

        {/* =================================================
            DEATHS
        ================================================= */}

        <SectionCard title="Maternal / Related Deaths" icon={AlertCircle}>
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            Death records are kept separate from individual pregnancy monitoring
            because your current database does not have a dedicated maternal
            deaths table.
          </div>

          <div className="space-y-3">
            {report.deaths.map((death, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-5"
              >
                <input
                  placeholder="Name"
                  value={death.name || ""}
                  disabled={!canEditReport(status)}
                  onChange={(e) => {
                    setReport((previous) => {
                      const deaths = [...previous.deaths];

                      deaths[index] = {
                        ...deaths[index],
                        name: e.target.value,
                      };

                      return {
                        ...previous,
                        deaths,
                      };
                    });
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />

                <input
                  placeholder="Age"
                  type="number"
                  value={death.age || ""}
                  disabled={!canEditReport(status)}
                  onChange={(e) => {
                    setReport((previous) => {
                      const deaths = [...previous.deaths];

                      deaths[index] = {
                        ...deaths[index],
                        age: e.target.value,
                      };

                      return {
                        ...previous,
                        deaths,
                      };
                    });
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />

                <input
                  type="date"
                  value={death.date_of_death || ""}
                  disabled={!canEditReport(status)}
                  onChange={(e) => {
                    setReport((previous) => {
                      const deaths = [...previous.deaths];

                      deaths[index] = {
                        ...deaths[index],
                        date_of_death: e.target.value,
                      };

                      return {
                        ...previous,
                        deaths,
                      };
                    });
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />

                <input
                  placeholder="Cause of Death"
                  value={death.cause || ""}
                  disabled={!canEditReport(status)}
                  onChange={(e) => {
                    setReport((previous) => {
                      const deaths = [...previous.deaths];

                      deaths[index] = {
                        ...deaths[index],
                        cause: e.target.value,
                      };

                      return {
                        ...previous,
                        deaths,
                      };
                    });
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />

                <button
                  type="button"
                  disabled={!canEditReport(status)}
                  onClick={() => {
                    setReport((previous) => ({
                      ...previous,

                      deaths: previous.deaths.filter(
                        (_, rowIndex) => rowIndex !== index,
                      ),
                    }));
                  }}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              disabled={!canEditReport(status)}
              onClick={() =>
                setReport((previous) => ({
                  ...previous,

                  deaths: [
                    ...previous.deaths,

                    {
                      name: "",
                      age: "",
                      sex: "",
                      date_of_death: "",
                      cause: "",
                    },
                  ],
                }))
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              + Add Death Record
            </button>

            {report.deaths.length === 0 && (
              <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                No death records added.
              </p>
            )}
          </div>
        </SectionCard>

        {/* =================================================
            FOOTER ACTIONS
        ================================================= */}

        <div className="flex flex-col justify-end gap-3 border-t pt-5 sm:flex-row">
          <button
            type="button"
            disabled={saving || !canEditReport(status)}
            onClick={() => saveReport(false)}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} />
            Save Draft
          </button>

          <button
            type="button"
            disabled={saving || !canSubmitReport(status)}
            onClick={() => {
              const confirmationMessage =
                status === "returned"
                  ? "Are you sure you want to resubmit the corrected monthly pregnancy report to the Midwife?"
                  : "Are you sure you want to submit this monthly pregnancy report to the Midwife?";

              if (window.confirm(confirmationMessage)) {
                saveReport(true);
              }
            }}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={18} />

            {status === "returned"
              ? "Resubmit to Midwife"
              : "Submit to Midwife"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
