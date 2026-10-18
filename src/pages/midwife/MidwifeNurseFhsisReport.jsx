import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Baby,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
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

const BNS_AGE_FIELDS = [
  { key: "age_0_11", label: "Children aged 0–11 months" },
  { key: "age_0_12", label: "Children aged 0–12 months" },
  { key: "age_13_23", label: "Children aged 13–23 months" },
  { key: "age_24_59", label: "Children aged 24–59 months" },
];

const BNS_METRICS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "deceased_male", label: "Deceased male" },
  { key: "deceased_female", label: "Deceased female" },
  { key: "trans_out_male", label: "Male transferred out" },
  { key: "trans_out_female", label: "Female transferred out" },
];

const BHW_OBJECT_FIELDS = [
  {
    key: "pregnancy_tracking",
    label: "Pregnancy tracking",
    fields: [
      { key: "new", label: "Newly recorded pregnancies" },
      { key: "total", label: "Total pregnancies recorded" },
      { key: "last_month", label: "Pregnancies from last month" },
      { key: "mc_book", label: "With MC book" },
      { key: "birth_plan", label: "With birth plan" },
      {
        key: "completed_home_visits",
        label: "Completed pregnancy home visits",
      },
    ],
  },
  {
    key: "deliveries",
    label: "Delivery indicators",
    fields: [
      { key: "total", label: "Total deliveries" },
      { key: "with_pnv4", label: "With PNV4" },
      { key: "home_delivery", label: "Home deliveries" },
      { key: "at_health_facility", label: "Deliveries at a health facility" },
      { key: "with_completed_4_hv", label: "With completed 4 home visits" },
    ],
  },
  {
    key: "breastfeeding",
    label: "Breastfeeding",
    fields: [
      { key: "initiated_breastfeeding", label: "Initiated breastfeeding" },
      { key: "exclusively_breastfed", label: "Exclusively breastfed" },
    ],
  },
  {
    key: "postpartum",
    label: "Postpartum indicators",
    fields: [
      {
        key: "pregnant_next_month",
        label: "Pregnant again the following month",
      },
      {
        key: "fp_completed_home_visit",
        label: "Family planning home visits completed",
      },
    ],
  },
  {
    key: "iec",
    label: "Information, education and communication",
    fields: [
      { key: "bench_conference", label: "Bench conferences" },
      { key: "care_giver_class", label: "Caregiver classes" },
      { key: "household_study_group", label: "Household study groups" },
      {
        key: "individual_health_counseling",
        label: "Individual health counseling",
      },
    ],
  },
];

const FAMILY_PLANNING_GROUPS = [
  { key: "current_users", label: "Current users" },
  { key: "new_acceptors", label: "New acceptors" },
  { key: "dropouts", label: "Dropouts" },
];

// These are contraceptive methods, not age groups.
const FAMILY_PLANNING_METHODS = [
  { key: "btl", label: "BTL" },
  { key: "coc", label: "COC" },
  { key: "iud", label: "IUD" },
  { key: "lam", label: "LAM" },
  { key: "nsv", label: "NSV" },
  { key: "pop", label: "POP" },
  { key: "dmpa", label: "DMPA" },
  { key: "condom", label: "Condom" },
  { key: "implant", label: "Implant" },
];

const FAMILY_PLANNING_AGE_GROUPS = [
  { key: "age_15_19", label: "Age 15–19" },
  { key: "age_20_49", label: "Age 20–49" },
];

const BHW_ARRAY_FIELDS = [
  { key: "pregnant_women", label: "Pregnant women records" },
  { key: "deaths", label: "Death records" },
  { key: "delivery_details", label: "Delivery detail records" },
  { key: "women_deworming", label: "Women deworming records" },
  { key: "pregnant_deworming", label: "Pregnant women deworming records" },
  { key: "tb_dots_referrals", label: "TB-DOTS referrals" },
  { key: "teenage_pregnancy", label: "Teenage pregnancy records" },
  { key: "agencies_coordinated", label: "Agencies coordinated with" },
  { key: "nutrition_assessment", label: "Nutrition assessment records" },
  { key: "postpartum_vitamin_a", label: "Postpartum vitamin A records" },
  { key: "consultation_referrals", label: "Consultation referrals" },
];

const PRENATAL_TRIMESTERS = [
  { key: "first_trimester", label: "First trimester" },
  { key: "second_trimester", label: "Second trimester" },
  { key: "third_trimester", label: "Third trimester" },
];

const asNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const asArray = (value) => (Array.isArray(value) ? value : []);

const emptyBnsTotals = () =>
  Object.fromEntries(
    BNS_AGE_FIELDS.map(({ key }) => [
      key,
      Object.fromEntries(BNS_METRICS.map(({ key: metric }) => [metric, 0])),
    ]),
  );

const emptyBhwTotals = () => {
  const totals = {};

  BHW_OBJECT_FIELDS.forEach(({ key, fields }) => {
    totals[key] = Object.fromEntries(
      fields.map(({ key: field }) => [field, 0]),
    );
  });

  totals.family_planning = Object.fromEntries(
    FAMILY_PLANNING_GROUPS.map(({ key }) => [
      key,
      Object.fromEntries(
        [...FAMILY_PLANNING_METHODS, ...FAMILY_PLANNING_AGE_GROUPS].map(
          ({ key: field }) => [field, 0],
        ),
      ),
    ]),
  );

  totals.records = Object.fromEntries(
    BHW_ARRAY_FIELDS.map(({ key }) => [key, 0]),
  );

  totals.prenatal_checkup = Object.fromEntries(
    PRENATAL_TRIMESTERS.map(({ key }) => [key, 0]),
  );

  return totals;
};

const addBnsReport = (totals, reportData) => {
  const data = asObject(reportData);

  BNS_AGE_FIELDS.forEach(({ key }) => {
    const ageData = asObject(data[key]);

    BNS_METRICS.forEach(({ key: metric }) => {
      totals[key][metric] += asNumber(ageData[metric]);
    });
  });
};

const addBhwReport = (totals, reportData) => {
  const data = asObject(reportData);

  BHW_OBJECT_FIELDS.forEach(({ key, fields }) => {
    const section = asObject(data[key]);

    fields.forEach(({ key: field }) => {
      totals[key][field] += asNumber(section[field]);
    });
  });

  FAMILY_PLANNING_GROUPS.forEach(({ key: group }) => {
    const groupData = asObject(asObject(data.family_planning)[group]);

    [...FAMILY_PLANNING_METHODS, ...FAMILY_PLANNING_AGE_GROUPS].forEach(
      ({ key: field }) => {
        totals.family_planning[group][field] += asNumber(groupData[field]);
      },
    );
  });

  BHW_ARRAY_FIELDS.forEach(({ key }) => {
    totals.records[key] += asArray(data[key]).length;
  });

  PRENATAL_TRIMESTERS.forEach(({ key }) => {
    totals.prenatal_checkup[key] += asArray(
      asObject(data.prenatal_checkup)[key],
    ).length;
  });
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const displayName = (user) =>
  [user?.first_name, user?.middle_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() ||
  user?.username ||
  `User #${user?.id ?? ""}`;

const formatNumber = (value) =>
  asNumber(value).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });

function MetricTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-semibold">Indicator</th>
            <th className="px-4 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="px-4 py-3 text-slate-700">{row.label}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                {formatNumber(row.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function SourceReportList({
  title,
  reports,
  emptyText,
  statusLabel = "Reviewed",
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-slate-800">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {reports.length} {statusLabel.toLowerCase()} source report
            {reports.length === 1 ? "" : "s"}
          </p>
        </div>

        {expanded ? (
          <ChevronDown size={18} className="text-slate-500" />
        ) : (
          <ChevronRight size={18} className="text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {reports.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">{emptyText}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((report) => (
                <div key={report.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {report.sourceName || `Source report #${report.id}`}
                    </p>

                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {statusLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Report ID: {report.id}
                    {report.barangayName ? ` · ${report.barangayName}` : ""}
                    {report.submitted_at
                      ? ` · Submitted ${new Date(
                          report.submitted_at,
                        ).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MidwifeNurseFhsisReport() {
  const currentUser = useMemo(() => getUser(), []);
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [nurseId, setNurseId] = useState("");

  const [district, setDistrict] = useState(null);
  const [nurses, setNurses] = useState([]);
  const [bnsReports, setBnsReports] = useState([]);
  const [bhwReports, setBhwReports] = useState([]);
  const [existingReports, setExistingReports] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const districtId = currentUser?.district_id;

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (!currentUser?.id) {
        throw new Error(
          "Your login session could not be found. Please log in again.",
        );
      }

      if (currentUser.role !== "midwife") {
        throw new Error("This page is available to Midwife accounts only.");
      }

      if (!districtId) {
        throw new Error(
          "Your account has no assigned district. Please ask the CHO Admin to assign your district.",
        );
      }

      const [
        districtResult,
        nursesResult,
        barangaysResult,
        bnsResult,
        bhwResult,
        priorReportsResult,
      ] = await Promise.all([
        supabase
          .from("districts")
          .select("id, name")
          .eq("id", districtId)
          .maybeSingle(),

        supabase
          .from("users")
          .select(
            "id, username, first_name, middle_name, last_name, role, district_id, is_active",
          )
          .eq("role", "nurse")
          .eq("district_id", districtId)
          .eq("is_active", true)
          .order("last_name", { ascending: true }),

        supabase
          .from("barangays")
          .select("id, name, district_id")
          .eq("district_id", districtId),

        supabase
          .from("bns_child_monthly_reports")
          .select(
            "id, bns_id, barangay_id, report_month, report_year, status, report_data, submitted_at, reviewed_at, created_at",
          )
          .eq("report_month", month)
          .eq("report_year", year)
          .eq("status", "approved"),

        supabase
          .from("bhw_monthly_reports")
          .select(
            "id, bhw_id, month, year, status, report_data, submitted_at, reviewed_at, created_at",
          )
          .eq("month", month)
          .eq("year", year)
          .eq("status", "reviewed"),

        supabase
          .from("midwife_nurse_fhsis_reports")
          .select(
            "id, reporting_month, reporting_year, district_id, midwife_id, nurse_id, report_title, status, submitted_at, reviewed_at, review_notes, reviewed_by, created_at",
          )
          .eq("reporting_month", month)
          .eq("reporting_year", year)
          .eq("district_id", districtId)
          .eq("midwife_id", currentUser.id)
          .order("created_at", { ascending: false }),
      ]);

      for (const result of [
        districtResult,
        nursesResult,
        barangaysResult,
        bnsResult,
        bhwResult,
        priorReportsResult,
      ]) {
        if (result.error) throw result.error;
      }

      if (!districtResult.data) {
        throw new Error("The district assigned to your account was not found.");
      }

      const districtBarangays = barangaysResult.data || [];
      const barangayIds = new Set(
        districtBarangays.map((item) => String(item.id)),
      );
      const barangayNames = new Map(
        districtBarangays.map((item) => [String(item.id), item.name]),
      );

      setDistrict(districtResult.data);
      setNurses(nursesResult.data || []);
      setExistingReports(priorReportsResult.data || []);

      // BNS: include only reports whose barangays belong to this district.
      const uniqueBns = Array.from(
        new Map(
          (bnsResult.data || [])
            .filter(
              (report) =>
                report.barangay_id != null &&
                barangayIds.has(String(report.barangay_id)),
            )
            .map((report) => [String(report.id), report]),
        ).values(),
      );

      const bnsIds = [
        ...new Set(uniqueBns.map((report) => String(report.bns_id))),
      ];

      let bnsUsersById = new Map();

      if (bnsIds.length) {
        const { data, error: queryError } = await supabase
          .from("users")
          .select("id, username, first_name, middle_name, last_name, role")
          .in("id", bnsIds);

        if (queryError) throw queryError;

        bnsUsersById = new Map(
          (data || [])
            .filter((user) => user.role === "bns")
            .map((user) => [String(user.id), user]),
        );
      }

      const verifiedBns = uniqueBns
        .filter((report) => bnsUsersById.has(String(report.bns_id)))
        .map((report) => ({
          ...report,
          sourceName: displayName(bnsUsersById.get(String(report.bns_id))),
          barangayName: barangayNames.get(String(report.barangay_id)) || "",
        }));

      // BHW: derive district coverage through active worker assignments.
      const uniqueCandidateBhw = Array.from(
        new Map(
          (bhwResult.data || []).map((report) => [String(report.id), report]),
        ).values(),
      );

      const bhwIds = [
        ...new Set(uniqueCandidateBhw.map((report) => String(report.bhw_id))),
      ];

      let verifiedBhw = [];

      if (bhwIds.length) {
        const { data: bhwUsers, error: usersError } = await supabase
          .from("users")
          .select("id, username, first_name, middle_name, last_name, role")
          .in("id", bhwIds);

        if (usersError) throw usersError;

        const bhwUsersById = new Map(
          (bhwUsers || [])
            .filter((user) => user.role === "bhw")
            .map((user) => [String(user.id), user]),
        );

        const validBhwIds = [...bhwUsersById.values()].map((user) => user.id);

        if (validBhwIds.length) {
          const { data: assignments, error: assignmentsError } = await supabase
            .from("worker_area_assignments")
            .select("id, worker_id, local_area_id, is_active")
            .in("worker_id", validBhwIds)
            .eq("is_active", true);

          if (assignmentsError) throw assignmentsError;

          const assignmentRows = assignments || [];
          const localAreaIds = [
            ...new Set(assignmentRows.map((item) => item.local_area_id)),
          ];

          let areas = [];

          if (localAreaIds.length) {
            const { data, error: areasError } = await supabase
              .from("local_areas")
              .select("id, name, type, barangay_id")
              .in("id", localAreaIds);

            if (areasError) throw areasError;
            areas = data || [];
          }

          const areaById = new Map(
            areas.map((area) => [String(area.id), area]),
          );

          const activeAreasByWorker = new Map();

          assignmentRows.forEach((assignment) => {
            const area = areaById.get(String(assignment.local_area_id));
            if (!area) return;

            const key = String(assignment.worker_id);

            if (!activeAreasByWorker.has(key)) {
              activeAreasByWorker.set(key, []);
            }

            activeAreasByWorker.get(key).push(area);
          });

          verifiedBhw = uniqueCandidateBhw
            .filter((report) => bhwUsersById.has(String(report.bhw_id)))
            .map((report) => {
              const reportData = asObject(report.report_data);
              const workerAreas =
                activeAreasByWorker.get(String(report.bhw_id)) || [];

              // Respect the saved area_ids when present. Legacy reports
              // without area_ids use the worker's active assignments.
              const hasAreaIds = Array.isArray(reportData.area_ids);

              const coveredAreas = workerAreas.filter((area) => {
                if (!barangayIds.has(String(area.barangay_id))) return false;

                if (!hasAreaIds) return true;

                return reportData.area_ids.some(
                  (id) => String(id) === String(area.id),
                );
              });

              if (!coveredAreas.length) return null;

              const coveredBarangayNames = [
                ...new Set(
                  coveredAreas
                    .map((area) => barangayNames.get(String(area.barangay_id)))
                    .filter(Boolean),
                ),
              ];

              return {
                ...report,
                sourceName: displayName(
                  bhwUsersById.get(String(report.bhw_id)),
                ),
                barangayName: coveredBarangayNames.join(", "),
                coveredAreaIds: coveredAreas.map((area) => area.id),
              };
            })
            .filter(Boolean);
        }
      }

      setBnsReports(verifiedBns);
      setBhwReports(
        Array.from(
          new Map(
            verifiedBhw.map((report) => [String(report.id), report]),
          ).values(),
        ),
      );

      setNurseId((current) =>
        current &&
        (nursesResult.data || []).some(
          (nurse) => String(nurse.id) === String(current),
        )
          ? current
          : "",
      );
    } catch (err) {
      console.error("Failed to load Midwife FHSIS data:", err);
      setError(err?.message || "Unable to load district source reports.");
      setBnsReports([]);
      setBhwReports([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, districtId, month, year]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData, refreshKey]);

  const bnsTotals = useMemo(() => {
    const totals = emptyBnsTotals();
    bnsReports.forEach((report) => addBnsReport(totals, report.report_data));
    return totals;
  }, [bnsReports]);

  const bhwTotals = useMemo(() => {
    const totals = emptyBhwTotals();
    bhwReports.forEach((report) => addBhwReport(totals, report.report_data));
    return totals;
  }, [bhwReports]);

  const selectedNurse = nurses.find(
    (nurse) => String(nurse.id) === String(nurseId),
  );

  const alreadySubmitted = existingReports.find(
    (report) =>
      String(report.nurse_id || "") === String(nurseId) &&
      ["submitted", "reviewed"].includes(report.status),
  );

  const existingDraft = existingReports.find(
    (report) =>
      String(report.nurse_id || "") === String(nurseId) &&
      report.status === "draft",
  );

  const existingReturned = existingReports.find(
    (report) =>
      String(report.nurse_id || "") === String(nurseId) &&
      report.status === "returned",
  );

  const hasSourceReports = bnsReports.length > 0 || bhwReports.length > 0;

  const buildReportData = () => ({
    report_type: "midwife_nurse_fhsis",
    reporting_period: {
      month,
      month_name: MONTHS[month - 1],
      year,
    },
    district: {
      id: districtId,
      name: district?.name || "",
    },
    prepared_by: {
      midwife_id: currentUser.id,
      name: displayName(currentUser),
    },
    submitted_to: selectedNurse
      ? {
          nurse_id: selectedNurse.id,
          name: displayName(selectedNurse),
          district_id: selectedNurse.district_id,
        }
      : null,
    source_counts: {
      bns_child_monthly_reports: bnsReports.length,
      bhw_monthly_reports: bhwReports.length,
      total_unique_source_reports: bnsReports.length + bhwReports.length,
    },
    bns_child_indicators: bnsTotals,
    bhw_maternal_community_indicators: bhwTotals,
    indicator_limitations: [
      "This consolidation contains indicators available in the submitted BNS and BHW report_data JSON.",
      "Family-planning age groups are separated from contraceptive methods.",
      "Array record counts represent source snapshot records and are not added to numeric indicators.",
      "Prenatal trimester counts represent visit entries, not necessarily unique pregnant women.",
      "The complete official FHSIS A1 form requires additional indicators and source data not present in the current schemas.",
      "Summed source indicators may include duplicate people when source reports overlap.",
      "The age_0_11 and age_0_12 BNS indicators are separate and must not be added together as a unique-child total.",
    ],
  });

  const buildSourceSnapshot = () => ({
    snapshot_created_at: new Date().toISOString(),
    reporting_period: { month, year },
    district_id: districtId,
    midwife_id: currentUser.id,
    nurse_id: selectedNurse?.id || null,
    source_rules: {
      bns_status: "approved",
      bhw_status: "reviewed",
      bns_district_filter: "barangays.district_id = midwife.district_id",
      bhw_district_filter:
        "active worker_area_assignments -> local_areas -> barangays.district_id",
      bhw_area_ids_checked_against_active_assignments: true,
      deduplicated_by_source_report_id: true,
    },
    bns_child_monthly_reports: bnsReports.map((report) => ({
      source_type: "bns_child_monthly_reports",
      source_report_id: report.id,
      bns_id: report.bns_id,
      barangay_id: report.barangay_id,
      barangay_name: report.barangayName,
      source_name: report.sourceName,
      status: report.status,
      report_month: report.report_month,
      report_year: report.report_year,
      submitted_at: report.submitted_at,
      reviewed_at: report.reviewed_at,
      report_data: report.report_data,
    })),
    bhw_monthly_reports: bhwReports.map((report) => ({
      source_type: "bhw_monthly_reports",
      source_report_id: report.id,
      bhw_id: report.bhw_id,
      barangay_name: report.barangayName,
      covered_area_ids: report.coveredAreaIds,
      status: report.status,
      month: report.month,
      year: report.year,
      submitted_at: report.submitted_at,
      reviewed_at: report.reviewed_at,
      report_data: report.report_data,
    })),
  });

  const handleSubmit = async () => {
    setError("");
    setNotice("");

    if (!selectedNurse) {
      setError("Please select an active nurse from your district.");
      return;
    }

    if (String(selectedNurse.district_id) !== String(districtId)) {
      setError(
        "Submission blocked: the nurse is not assigned to your district.",
      );
      return;
    }

    if (!hasSourceReports) {
      setError(
        "There are no reviewed BNS or BHW reports for this period in your district.",
      );
      return;
    }

    if (alreadySubmitted) {
      setError(
        `This report has already been ${alreadySubmitted.status} for the selected nurse.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Submit the ${MONTHS[month - 1]} ${year} district FHSIS report to ${displayName(selectedNurse)}?`,
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      // Verify the current midwife and district against the database.
      const { data: midwifeCheck, error: midwifeError } = await supabase
        .from("users")
        .select("id, role, district_id, is_active")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (midwifeError) throw midwifeError;

      if (
        !midwifeCheck ||
        midwifeCheck.role !== "midwife" ||
        midwifeCheck.is_active === false ||
        String(midwifeCheck.district_id) !== String(districtId)
      ) {
        throw new Error(
          "Your account or district assignment changed. Please refresh.",
        );
      }

      const { data: nurseCheck, error: nurseError } = await supabase
        .from("users")
        .select("id, role, district_id, is_active")
        .eq("id", selectedNurse.id)
        .maybeSingle();

      if (nurseError) throw nurseError;

      if (
        !nurseCheck ||
        nurseCheck.role !== "nurse" ||
        nurseCheck.is_active !== true ||
        String(nurseCheck.district_id) !== String(districtId)
      ) {
        throw new Error(
          "The selected nurse is no longer active or assigned to your district.",
        );
      }

      // Prevent accidental duplicate submissions.
      const { data: duplicateRows, error: duplicateError } = await supabase
        .from("midwife_nurse_fhsis_reports")
        .select("id, status")
        .eq("reporting_month", month)
        .eq("reporting_year", year)
        .eq("district_id", districtId)
        .eq("midwife_id", currentUser.id)
        .eq("nurse_id", selectedNurse.id)
        .in("status", ["submitted", "reviewed"])
        .limit(1);

      if (duplicateError) throw duplicateError;

      if ((duplicateRows || []).length) {
        throw new Error(
          "This report has already been submitted to the selected nurse.",
        );
      }

      // Revalidate the BNS reports.
      const bnsIds = bnsReports.map((report) => report.id);

      if (bnsIds.length) {
        const { data, error: checkError } = await supabase
          .from("bns_child_monthly_reports")
          .select("id, bns_id, status, report_month, report_year, barangay_id")
          .in("id", bnsIds);

        if (checkError) throw checkError;

        const expected = new Map(
          bnsReports.map((report) => [String(report.id), report]),
        );

        const valid = new Map(
          (data || [])
            .filter(
              (row) =>
                row.status === "approved" &&
                Number(row.report_month) === Number(month) &&
                Number(row.report_year) === Number(year),
            )
            .map((row) => [String(row.id), row]),
        );

        if (valid.size !== bnsIds.length) {
          throw new Error(
            "A BNS report changed status or reporting period. Refresh before submitting.",
          );
        }

        for (const row of valid.values()) {
          const original = expected.get(String(row.id));

          if (
            !original ||
            String(original.bns_id) !== String(row.bns_id) ||
            String(original.barangay_id) !== String(row.barangay_id)
          ) {
            throw new Error(
              "A BNS report assignment changed. Refresh before submitting.",
            );
          }
        }
      }

      // Revalidate BHW report status, period and saved area coverage.
      const bhwIds = bhwReports.map((report) => report.id);

      if (bhwIds.length) {
        const { data, error: checkError } = await supabase
          .from("bhw_monthly_reports")
          .select("id, bhw_id, status, month, year, report_data")
          .in("id", bhwIds);

        if (checkError) throw checkError;

        const expected = new Map(
          bhwReports.map((report) => [String(report.id), report]),
        );

        const valid = new Map(
          (data || [])
            .filter(
              (row) =>
                row.status === "reviewed" &&
                Number(row.month) === Number(month) &&
                Number(row.year) === Number(year),
            )
            .map((row) => [String(row.id), row]),
        );

        if (valid.size !== bhwIds.length) {
          throw new Error(
            "A BHW report changed status or reporting period. Refresh before submitting.",
          );
        }

        for (const row of valid.values()) {
          const original = expected.get(String(row.id));

          if (!original || String(original.bhw_id) !== String(row.bhw_id)) {
            throw new Error(
              "A BHW report's worker assignment changed. Refresh before submitting.",
            );
          }

          const savedAreaIds = asObject(row.report_data).area_ids;

          if (
            Array.isArray(savedAreaIds) &&
            !savedAreaIds.some((id) =>
              (original.coveredAreaIds || []).some(
                (coveredId) => String(coveredId) === String(id),
              ),
            )
          ) {
            throw new Error(
              "A BHW report's area coverage changed. Refresh before submitting.",
            );
          }
        }
      }

      const payload = {
        reporting_month: month,
        reporting_year: year,
        district_id: districtId,
        midwife_id: currentUser.id,
        nurse_id: selectedNurse.id,
        report_title: `District FHSIS Report - ${MONTHS[month - 1]} ${year}`,
        report_data: buildReportData(),
        source_snapshot: buildSourceSnapshot(),
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingDraft) {
        const { data, error: updateError } = await supabase
          .from("midwife_nurse_fhsis_reports")
          .update(payload)
          .eq("id", existingDraft.id)
          .eq("midwife_id", currentUser.id)
          .eq("status", "draft")
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;

        if (!data) {
          throw new Error(
            "The draft could not be updated. It may have changed; refresh and try again.",
          );
        }
      } else if (existingReturned) {
        // Resubmission updates the returned report rather than creating
        // another report for the same period and nurse.
        const { data, error: updateError } = await supabase
          .from("midwife_nurse_fhsis_reports")
          .update(payload)
          .eq("id", existingReturned.id)
          .eq("midwife_id", currentUser.id)
          .eq("status", "returned")
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;

        if (!data) {
          throw new Error(
            "The returned report could not be updated. Refresh and try again.",
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from("midwife_nurse_fhsis_reports")
          .insert(payload);

        if (insertError) throw insertError;
      }

      setNotice(
        `The ${MONTHS[month - 1]} ${year} report was submitted to ${displayName(selectedNurse)}.`,
      );

      setRefreshKey((value) => value + 1);
    } catch (err) {
      console.error("FHSIS submission failed:", err);
      setError(err?.message || "The report could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderBnsSection = () => (
    <SectionCard
      title="BNS Child Indicators"
      description="Consolidated from approved BNS child monthly reports in this district."
      icon={Baby}
    >
      <div className="bg-slate-50 px-5 py-3 text-sm text-slate-600">
        <strong>{bnsReports.length}</strong> reviewed BNS reports included
      </div>

      {BNS_AGE_FIELDS.map(({ key, label }) => (
        <div key={key} className="border-t border-slate-100">
          <div className="px-5 pt-4">
            <h3 className="font-semibold text-slate-800">{label}</h3>
            {key === "age_0_11" && (
              <p className="mt-1 text-xs text-amber-700">
                The 0–11 and 0–12 month indicators overlap. They are displayed
                separately and must not be added together as unique children.
              </p>
            )}
          </div>
          <MetricTable
            rows={BNS_METRICS.map((metric) => ({
              key: metric.key,
              label: metric.label,
              value: bnsTotals[key][metric.key],
            }))}
          />
        </div>
      ))}

      <div className="p-4">
        <SourceReportList
          title="BNS source reports"
          reports={bnsReports}
          statusLabel="Approved"
          emptyText="No approved BNS reports match this reporting period and district."
        />
      </div>
    </SectionCard>
  );

  const renderBhwSection = () => (
    <SectionCard
      title="BHW Maternal and Community Indicators"
      description="Consolidated from reviewed BHW reports covering eligible assigned areas."
      icon={HeartPulse}
    >
      <div className="bg-slate-50 px-5 py-3 text-sm text-slate-600">
        <strong>{bhwReports.length}</strong> reviewed BHW reports included
      </div>

      {BHW_OBJECT_FIELDS.map(({ key, label, fields }) => (
        <div key={key} className="border-t border-slate-100">
          <div className="px-5 pt-4">
            <h3 className="font-semibold text-slate-800">{label}</h3>
          </div>
          <MetricTable
            rows={fields.map((field) => ({
              key: field.key,
              label: field.label,
              value: bhwTotals[key][field.key],
            }))}
          />
        </div>
      ))}

      <div className="border-t border-slate-100">
        <div className="px-5 pt-4">
          <h3 className="font-semibold text-slate-800">
            Family planning indicators
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Age groups are separate from contraceptive methods. These totals
            reflect the values actually present in the saved BHW reports.
          </p>
        </div>

        {FAMILY_PLANNING_GROUPS.map(({ key, label }) => (
          <div key={key}>
            <h4 className="px-5 pt-4 text-sm font-medium text-slate-600">
              {label}
            </h4>
            <MetricTable
              rows={[
                ...FAMILY_PLANNING_METHODS,
                ...FAMILY_PLANNING_AGE_GROUPS,
              ].map((item) => ({
                key: item.key,
                label: item.label,
                value: bhwTotals.family_planning[key][item.key],
              }))}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100">
        <div className="px-5 pt-4">
          <h3 className="font-semibold text-slate-800">
            Detailed record counts
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            These count entries in the saved source snapshots. They are not
            added to the numeric summary indicators.
          </p>
        </div>
        <MetricTable
          rows={[
            ...BHW_ARRAY_FIELDS.map(({ key, label }) => ({
              key,
              label,
              value: bhwTotals.records[key],
            })),
            ...PRENATAL_TRIMESTERS.map(({ key, label }) => ({
              key,
              label: `Prenatal checkup entries — ${label.toLowerCase()}`,
              value: bhwTotals.prenatal_checkup[key],
            })),
          ]}
        />
      </div>

      <div className="p-4">
        <SourceReportList
          title="BHW source reports"
          reports={bhwReports}
          emptyText="No reviewed BHW reports cover eligible assigned areas for this period."
        />
      </div>
    </SectionCard>
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <ShieldCheck size={17} />
              Midwife to Nurse Reporting
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              District FHSIS Report
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Consolidate reviewed BNS and BHW reports for your district,
              inspect the source breakdown, and submit to an active nurse in the
              same district.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh reports
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList size={19} className="text-emerald-700" />
            <h2 className="font-semibold text-slate-900">
              Reporting information
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Reporting month
              </label>
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                disabled={loading || submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Reporting year
              </label>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                disabled={loading || submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {Array.from(
                  { length: 7 },
                  (_, index) => now.getFullYear() - 5 + index,
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                District
              </label>
              <div className="flex min-h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                {district?.name || (loading ? "Loading…" : "Not assigned")}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Receiving nurse
              </label>
              <select
                value={nurseId}
                onChange={(event) => setNurseId(event.target.value)}
                disabled={loading || submitting || nurses.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Select nurse</option>
                {nurses.map((nurse) => (
                  <option key={nurse.id} value={nurse.id}>
                    {displayName(nurse)}
                  </option>
                ))}
              </select>
              {!loading && nurses.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No active nurse is assigned to this district.
                </p>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Only reviewed source reports for the selected month and year are
            included.
          </p>
        </section>

        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
            <LoaderCircle size={30} className="animate-spin text-emerald-700" />
            <p className="text-sm text-slate-500">
              Loading reviewed district reports…
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "BNS reports",
                  value: bnsReports.length,
                  description: "Reviewed child reports",
                  icon: Baby,
                  color: "text-emerald-700",
                },
                {
                  label: "BHW reports",
                  value: bhwReports.length,
                  description: "Reviewed maternal and community reports",
                  icon: HeartPulse,
                  color: "text-rose-600",
                },
                {
                  label: "Total sources",
                  value: bnsReports.length + bhwReports.length,
                  description: "Unique source reports",
                  icon: FileText,
                  color: "text-blue-600",
                },
                {
                  label: "Receiving nurses",
                  value: nurses.length,
                  description: "Active nurses in your district",
                  icon: Users,
                  color: "text-violet-600",
                },
              ].map(({ label, value, description, icon: Icon, color }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{label}</p>
                    <Icon size={19} className={color} />
                  </div>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
              {renderBnsSection()}
              {renderBhwSection()}
            </div>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={20} className="text-emerald-700" />
                    <h2 className="font-semibold text-slate-900">
                      Submit consolidated report
                    </h2>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    The system saves consolidated indicators and a snapshot of
                    every included source report. The selected nurse must belong
                    to your district.
                  </p>

                  {alreadySubmitted && (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      This report has already been {alreadySubmitted.status} to
                      this nurse.
                    </p>
                  )}

                  {existingReturned && !alreadySubmitted && (
                    <p className="mt-2 text-sm text-amber-800">
                      A returned report exists. Submitting will update that
                      report.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    loading ||
                    !selectedNurse ||
                    !hasSourceReports ||
                    Boolean(alreadySubmitted)
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  {submitting ? "Submitting…" : "Submit to Nurse"}
                </button>
              </div>

              {!hasSourceReports && (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No eligible reviewed source reports are available for this
                  period. An empty report cannot be submitted.
                </p>
              )}
            </section>

            {existingReports.length > 0 && (
              <SectionCard
                title="Previously saved reports"
                description={`Your district reports for ${MONTHS[month - 1]} ${year}.`}
                icon={FileText}
              >
                <div className="divide-y divide-slate-100">
                  {existingReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {report.report_title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Report ID: {report.id}
                          {report.submitted_at
                            ? ` · Submitted ${new Date(report.submitted_at).toLocaleString()}`
                            : ""}
                        </p>
                        {report.reviewed_by && (
                          <p className="mt-1 text-xs text-slate-500">
                            Reviewed by nurse ID: {report.reviewed_by}
                          </p>
                        )}
                        {report.review_notes && (
                          <p className="mt-2 text-sm text-slate-600">
                            Nurse notes: {report.review_notes}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          report.status === "reviewed"
                            ? "bg-emerald-100 text-emerald-800"
                            : report.status === "submitted"
                              ? "bg-blue-100 text-blue-800"
                              : report.status === "returned"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
