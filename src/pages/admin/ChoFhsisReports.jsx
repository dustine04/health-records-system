import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  MessageSquare,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
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

const STATUS = {
  forwarded_to_cho: {
    label: "Awaiting CHO Review",
    className: "bg-indigo-100 text-indigo-800",
  },
  cho_approved: {
    label: "Final Approved",
    className: "bg-emerald-100 text-emerald-800",
  },
  returned_by_cho: {
    label: "Returned by CHO",
    className: "bg-rose-100 text-rose-800",
  },
};

const BNS_AGE_GROUPS = [
  { key: "age_0_11", label: "0–11 months" },
  { key: "age_0_12", label: "0–12 months" },
  { key: "age_13_23", label: "13–23 months" },
  { key: "age_24_59", label: "24–59 months" },
];

const BHW_INDICATORS = [
  {
    key: "pregnancy_tracking",
    title: "Pregnancy Tracking",
    metrics: [
      ["new", "Newly recorded pregnancies"],
      ["total", "Total pregnancies recorded"],
      ["last_month", "Pregnancies from previous month"],
      ["mc_book", "With MC book"],
      ["birth_plan", "With birth plan"],
      ["completed_home_visits", "Completed pregnancy home visits"],
    ],
  },
  {
    key: "deliveries",
    title: "Delivery Indicators",
    metrics: [
      ["total", "Total deliveries"],
      ["with_pnv4", "With PNV4"],
      ["home_delivery", "Home deliveries"],
      ["at_health_facility", "Deliveries at a health facility"],
      ["with_completed_4_hv", "With four completed home visits"],
    ],
  },
  {
    key: "breastfeeding",
    title: "Breastfeeding Indicators",
    metrics: [
      ["initiated_breastfeeding", "Initiated breastfeeding"],
      ["exclusively_breastfed", "Exclusively breastfed"],
    ],
  },
  {
    key: "postpartum",
    title: "Postpartum Indicators",
    metrics: [
      ["pregnant_next_month", "Pregnant again the following month"],
      ["fp_completed_home_visit", "Completed family planning home visits"],
    ],
  },
  {
    key: "iec",
    title: "Health Education and Counseling",
    metrics: [
      ["bench_conference", "Bench conferences"],
      ["care_giver_class", "Caregiver classes"],
      ["household_study_group", "Household study groups"],
      ["individual_health_counseling", "Individual health counseling"],
    ],
  },
];

const FP_GROUPS = [
  ["current_users", "Current Users"],
  ["new_acceptors", "New Acceptors"],
  ["dropouts", "Dropouts"],
];

const FP_METHODS = [
  ["btl", "BTL"],
  ["coc", "COC"],
  ["iud", "IUD"],
  ["lam", "LAM"],
  ["nsv", "NSV"],
  ["pop", "POP"],
  ["dmpa", "DMPA"],
  ["condom", "Condom"],
  ["implant", "Implant"],
  ["age_15_19", "Age 15–19"],
  ["age_20_49", "Age 20–49"],
];

const BHW_RECORDS = [
  ["pregnant_women", "Pregnant women records"],
  ["deaths", "Death records"],
  ["delivery_details", "Delivery detail records"],
  ["women_deworming", "Women deworming records"],
  ["pregnant_deworming", "Pregnant women deworming records"],
  ["tb_dots_referrals", "TB-DOTS referrals"],
  ["teenage_pregnancy", "Teenage pregnancy records"],
  ["agencies_coordinated", "Agencies coordinated with"],
  ["nutrition_assessment", "Nutrition assessment records"],
  ["postpartum_vitamin_a", "Postpartum vitamin A records"],
  ["consultation_referrals", "Consultation referrals"],
];

const PRENATAL_TRIMESTERS = [
  ["first_trimester", "First trimester"],
  ["second_trimester", "Second trimester"],
  ["third_trimester", "Third trimester"],
];

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const fmt = (value) => {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") {
    return value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  }

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => fmt(item)).join(", ") : "None";
  }

  if (isObject(value)) {
    // Special handling for reporting_period: { year, month, month_name }
    if (
      value.year !== undefined &&
      (value.month_name !== undefined || value.month !== undefined)
    ) {
      const monthName =
        value.month_name ||
        MONTHS[Number(value.month) - 1] ||
        String(value.month);

      return `${monthName} ${value.year}`;
    }

    // Do not render objects directly as React children.
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const label = (value) =>
  String(value || "Details")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayName = (user) =>
  [user?.first_name, user?.middle_name, user?.last_name]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .trim() ||
  user?.username ||
  `User #${user?.id ?? ""}`;

const dateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const period = (report) =>
  `${MONTHS[Number(report.reporting_month) - 1] || "Unknown"} ${
    report.reporting_year ?? ""
  }`.trim();

const asNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/*
 * Safely converts database values into printable strings.
 * This prevents React's "Objects are not valid as a React child" error.
 */
const formatReportingPeriod = (value, report) => {
  if (isObject(value)) {
    const monthName =
      value.month_name ||
      MONTHS[Number(value.month) - 1] ||
      MONTHS[Number(report.reporting_month) - 1] ||
      "Unknown";

    const year = value.year ?? report.reporting_year;

    return year ? `${monthName} ${year}` : monthName;
  }

  if (typeof value === "string" && value.trim()) return value;

  return `${MONTHS[Number(report.reporting_month) - 1] || "Unknown"} ${
    report.reporting_year ?? ""
  }`.trim();
};

const formatLabel = (value) =>
  String(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

function StatusBadge({ status }) {
  const item = STATUS[status] || {
    label: label(status),
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function ReportSection({ number, title, description, children }) {
  return (
    <section className="fhsis-section overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
          {number}. {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        )}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function DataTable({ headers, rows, emptyText = "No data available." }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className={`border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 ${
                  index === 0 ? "text-left" : "text-right"
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="border border-slate-300 px-3 py-5 text-center text-sm text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={row.key ?? rowIndex}
                className={rowIndex % 2 ? "bg-slate-50" : "bg-white"}
              >
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${row.key ?? rowIndex}-${cellIndex}`}
                    className={`whitespace-pre-wrap break-words border border-slate-300 px-3 py-2 ${
                      cellIndex === 0
                        ? "text-left text-slate-800"
                        : "text-right font-medium tabular-nums text-slate-900"
                    }`}
                  >
                    {fmt(cell)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCards({ items }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xl font-bold text-slate-900">
            {fmt(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ObjectIndicators({ data, sections }) {
  const source = isObject(data) ? data : {};

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const values = isObject(source[section.key]) ? source[section.key] : {};

        return (
          <div key={section.key}>
            <h4 className="mb-2 text-sm font-bold text-slate-800">
              {section.title}
            </h4>

            <DataTable
              headers={["Indicator", "Reported Total"]}
              rows={section.metrics.map(([key, label]) => ({
                key,
                cells: [label, values[key] ?? 0],
              }))}
            />
          </div>
        );
      })}
    </div>
  );
}

function BnsChildIndicators({ data }) {
  const source = isObject(data) ? data : {};

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-slate-500">
        These figures are consolidated from reviewed BNS child monthly reports.
        The age groups follow the categories stored in the system. Categories
        may overlap, so they should not be added together as a unique-child
        total.
      </p>

      <DataTable
        headers={[
          "Age Group",
          "Male",
          "Female",
          "Deceased Male",
          "Deceased Female",
          "Male Transferred Out",
          "Female Transferred Out",
        ]}
        rows={BNS_AGE_GROUPS.map(({ key, label }) => {
          const values = isObject(source[key]) ? source[key] : {};

          return {
            key,
            cells: [
              label,
              values.male ?? 0,
              values.female ?? 0,
              values.deceased_male ?? 0,
              values.deceased_female ?? 0,
              values.trans_out_male ?? 0,
              values.trans_out_female ?? 0,
            ],
          };
        })}
      />
    </div>
  );
}

function FamilyPlanningTable({ data }) {
  const familyPlanning = isObject(data?.family_planning)
    ? data.family_planning
    : {};

  return (
    <DataTable
      headers={["Method / Category", ...FP_GROUPS.map(([, label]) => label)]}
      rows={FP_METHODS.map(([method, label]) => ({
        key: method,
        cells: [
          label,
          ...FP_GROUPS.map(([group]) => familyPlanning[group]?.[method] ?? 0),
        ],
      }))}
    />
  );
}

function PrenatalTable({ data }) {
  const prenatal = isObject(data?.prenatal_checkup)
    ? data.prenatal_checkup
    : {};

  return (
    <DataTable
      headers={["Prenatal Period", "Recorded Checkups"]}
      rows={PRENATAL_TRIMESTERS.map(([key, label]) => {
        const value = prenatal[key];
        const count = Array.isArray(value) ? value.length : asNumber(value);

        return { key, cells: [label, count] };
      })}
    />
  );
}

function BhwRecordTable({ data }) {
  const source = isObject(data) ? data : {};

  return (
    <DataTable
      headers={["Record Category", "Number of Records"]}
      rows={BHW_RECORDS.map(([key, label]) => {
        const value = source[key];
        const count = Array.isArray(value) ? value.length : asNumber(value);

        return { key, cells: [label, count] };
      })}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                           PRINTABLE FHSIS REPORT                           */
/* -------------------------------------------------------------------------- */

function ReportDocument({ report, midwife, nurse, districtName }) {
  const data = isObject(report.report_data) ? report.report_data : {};

  const sourceSnapshot = isObject(report.source_snapshot)
    ? report.source_snapshot
    : {};

  const bnsData = isObject(data.bns_child_indicators)
    ? data.bns_child_indicators
    : {};

  const bhwData = isObject(data.bhw_maternal_community_indicators)
    ? data.bhw_maternal_community_indicators
    : {};

  const sourceCounts = isObject(data.source_counts) ? data.source_counts : {};

  const preparedBy =
    typeof data.prepared_by === "string" && data.prepared_by.trim()
      ? data.prepared_by
      : midwife
        ? displayName(midwife)
        : `Midwife #${report.midwife_id}`;

  const reportingPeriod = formatReportingPeriod(data.reporting_period, report);

  // submitted_to may be a string or an object saved in JSON.
  const submittedToData = data.submitted_to;

  const submittedTo =
    typeof submittedToData === "string" && submittedToData.trim()
      ? submittedToData.trim()
      : isObject(submittedToData)
        ? submittedToData.name ||
          (nurse && String(submittedToData.nurse_id) === String(nurse.id)
            ? displayName(nurse)
            : "")
        : "";

  // Prefer the authenticated Nurse's name when this Nurse
  // is the recorded reviewer.
  const reviewerName =
    report.reviewed_by != null &&
    nurse &&
    String(report.reviewed_by) === String(nurse.id)
      ? displayName(nurse)
      : report.reviewed_by != null
        ? `User #${report.reviewed_by}`
        : "";

  // Match the exact keys saved by the Midwife submission component.
  // Older report rows are supported as a fallback.
  const bnsReportCount =
    sourceCounts.bns_child_monthly_reports ??
    sourceCounts.bns ??
    (Array.isArray(sourceSnapshot.bns_child_monthly_reports)
      ? sourceSnapshot.bns_child_monthly_reports.length
      : Array.isArray(sourceSnapshot.bns_reports)
        ? sourceSnapshot.bns_reports.length
        : 0);

  const bhwReportCount =
    sourceCounts.bhw_monthly_reports ??
    sourceCounts.bhw ??
    (Array.isArray(sourceSnapshot.bhw_monthly_reports)
      ? sourceSnapshot.bhw_monthly_reports.length
      : Array.isArray(sourceSnapshot.bhw_reports)
        ? sourceSnapshot.bhw_reports.length
        : 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h3 className="font-bold text-slate-900">FHSIS Report Preview</h3>
          <p className="text-sm text-slate-500">
            Print this formatted report or save it as a PDF.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          <Printer size={17} />
          Print / Save as PDF
        </button>
      </div>

      <div id="cho-fhsis-print-area" className="fhsis-document space-y-5">
        <header className="border-2 border-slate-800 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest">
            Republic of the Philippines
          </p>
          <h2 className="mt-1 text-lg font-extrabold uppercase">
            City Health Office
          </h2>
          <p className="text-sm font-semibold">Ormoc City</p>
          <div className="my-3 border-t border-slate-400" />
          <h1 className="text-xl font-extrabold uppercase tracking-wide">
            Consolidated FHSIS Report
          </h1>
          <p className="mt-1 text-sm font-semibold">
            Family Health and Community Health Indicators
          </p>
          <p className="mt-2 text-sm">
            Reporting Period: <strong>{reportingPeriod}</strong>
          </p>
        </header>

        <section className="grid grid-cols-1 gap-3 border border-slate-300 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              District
            </p>
            <p className="font-bold">{districtName || fmt(data.district)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Prepared by / Submitting Midwife
            </p>
            <p className="font-bold">{preparedBy}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Submitted to
            </p>
            <p className="font-semibold">{submittedTo || "District Nurse"}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Report Reference
            </p>
            <p className="font-semibold">FHSIS-{report.id}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Forwarded to CHO
            </p>
            <p className="font-semibold">{formatDate(report.forwarded_at)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              CHO Final Decision
            </p>
            <p className="font-semibold">
              {report.status === "cho_approved"
                ? "Final Approved"
                : report.status === "returned_by_cho"
                  ? "Returned for Correction"
                  : "Awaiting CHO Review"}
            </p>
          </div>
        </section>

        <ReportSection
          number="I"
          title="Submission Summary"
          description="Overview of the source reports used in consolidation."
        >
          <SummaryCards
            items={[
              {
                label: "BNS Reports Included",
                value: bnsReportCount,
              },
              {
                label: "BHW Reports Included",
                value: bhwReportCount,
              },
              {
                label: "Reporting Period",
                value: reportingPeriod,
              },
            ]}
          />
        </ReportSection>

        <ReportSection
          number="II"
          title="Child Health and Nutrition Indicators"
          description="Consolidated data submitted by BNS workers."
        >
          <BnsChildIndicators data={bnsData} />
        </ReportSection>

        <ReportSection
          number="III"
          title="Maternal and Community Health Indicators"
          description="Consolidated maternal and community indicators submitted by BHW workers."
        >
          <ObjectIndicators data={bhwData} sections={BHW_INDICATORS} />
        </ReportSection>

        <ReportSection
          number="IV"
          title="Family Planning"
          description="Current users, new acceptors, and dropouts by stored method/category."
        >
          <FamilyPlanningTable data={bhwData} />
        </ReportSection>

        <ReportSection
          number="V"
          title="Prenatal Checkups"
          description="Recorded prenatal checkup entries by trimester."
        >
          <PrenatalTable data={bhwData} />
        </ReportSection>

        <ReportSection
          number="VI"
          title="Other Community Health Records"
          description="Counts of the record categories included in the consolidated BHW report."
        >
          <BhwRecordTable
            data={isObject(bhwData.records) ? bhwData.records : bhwData}
          />
        </ReportSection>

        {report.review_notes && (
          <ReportSection
            number="VII"
            title="Nurse Review Notes"
            description="Review comments recorded by the District Nurse."
          >
            <p className="whitespace-pre-wrap text-sm">{report.review_notes}</p>
          </ReportSection>
        )}

        {report.cho_review_notes && (
          <ReportSection
            number="VIII"
            title="CHO Final Review Notes"
            description="Final decision notes recorded by CHO/Admin."
          >
            <p className="whitespace-pre-wrap text-sm">
              {report.cho_review_notes}
            </p>
          </ReportSection>
        )}

        <section className="grid grid-cols-1 gap-8 border border-slate-300 p-5 sm:grid-cols-2">
          <div>
            <div className="mb-8 border-b border-slate-500" />
            <p className="text-center text-sm font-bold">{preparedBy}</p>
            <p className="text-center text-xs text-slate-500">
              Prepared / Submitted by Midwife
            </p>
          </div>

          <div>
            <div className="mb-8 border-b border-slate-500" />

            <p className="text-center text-sm font-bold">
              {reviewerName || "__________________"}
            </p>

            <p className="text-center text-xs text-slate-500">
              Reviewed by / District Nurse
            </p>
          </div>
        </section>

        <p className="text-xs leading-5 text-slate-500">
          System-generated consolidated report. Please verify the figures and
          required official form fields before official submission.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            REPORT DETAILS MODAL                            */
/* -------------------------------------------------------------------------- */

function ReportModal({
  report,
  midwife,
  nurse,
  districtName,
  onClose,
  onApprove,
  onReturn,
  actionLoading,
}) {
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [notes, setNotes] = useState("");
  const canReview = report.status === "forwarded_to_cho";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-2 sm:p-5">
      <div className="mx-auto my-4 w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b bg-white p-4 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">
              CHO / Admin Review
            </p>
            <h2 className="mt-1 text-lg font-bold">
              {report.report_title || "Consolidated FHSIS Report"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {period(report)} · Report #{report.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close report"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-3 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
            {[
              [
                "Submitted by",
                midwife
                  ? displayName(midwife)
                  : `Midwife #${report.midwife_id}`,
              ],
              [
                "Reviewed by Nurse",
                nurse ? displayName(nurse) : `Nurse #${report.nurse_id}`,
              ],
              ["Forwarded on", dateTime(report.forwarded_at)],
              ["District", districtName || "—"],
            ].map(([title, value]) => (
              <div key={title} className="rounded-lg border p-3">
                <p className="text-xs uppercase text-slate-500">{title}</p>
                <p className="mt-1 break-words text-sm font-semibold">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="print:hidden">
            <StatusBadge status={report.status} />
          </div>

          <ReportDocument
            report={report}
            midwife={midwife}
            nurse={nurse}
            districtName={districtName}
          />

          {canReview ? (
            <div className="space-y-4 border-t border-slate-200 pt-5 print:hidden">
              {showReturnForm && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <label className="mb-2 block text-sm font-semibold text-rose-900">
                    Reason for returning this report
                  </label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Explain the corrections or verification needed..."
                    className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReturnForm(false)}
                      disabled={actionLoading}
                      className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onReturn(notes)}
                      disabled={actionLoading || !notes.trim()}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Return Report
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowReturnForm(true)}
                  disabled={actionLoading || showReturnForm}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <ArrowLeft size={17} />
                  Return for Correction
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold"
                >
                  <Printer size={17} />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={actionLoading || showReturnForm}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  Final Approve
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm print:hidden">
              <p className="font-semibold text-slate-800">
                {report.status === "cho_approved"
                  ? "This report has received final CHO approval."
                  : "This report was returned by CHO for correction."}
              </p>
              {report.cho_reviewed_by && (
                <p className="mt-1 text-slate-600">
                  CHO reviewer user ID: {report.cho_reviewed_by}
                </p>
              )}
              {report.cho_reviewed_at && (
                <p className="mt-1 text-slate-600">
                  Decision recorded: {dateTime(report.cho_reviewed_at)}
                </p>
              )}
              {report.cho_review_notes && (
                <p className="mt-2 whitespace-pre-wrap text-slate-700">
                  {report.cho_review_notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChoFhsisReports() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const userById = useMemo(
    () => new Map(users.map((item) => [String(item.id), item])),
    [users],
  );

  const districtById = useMemo(
    () => new Map(districts.map((item) => [String(item.id), item.name])),
    [districts],
  );

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: rows, error: reportError } = await supabase
        .from("midwife_nurse_fhsis_reports")
        .select(
          `
          id, reporting_month, reporting_year, district_id,
          midwife_id, nurse_id, report_title, report_data, source_snapshot,
          status, submitted_at, reviewed_by, reviewed_at, review_notes,
          forwarded_by, forwarded_at, cho_reviewed_by, cho_reviewed_at,
          cho_review_notes, created_at, updated_at
        `,
        )
        .in("status", ["forwarded_to_cho", "cho_approved", "returned_by_cho"])
        .order("forwarded_at", { ascending: false, nullsFirst: false });

      if (reportError) throw reportError;

      const reportRows = rows || [];
      setReports(reportRows);

      const userIds = [
        ...new Set(
          reportRows
            .flatMap((report) => [
              report.midwife_id,
              report.nurse_id,
              report.forwarded_by,
              report.reviewed_by,
              report.cho_reviewed_by,
            ])
            .filter((id) => id !== null && id !== undefined),
        ),
      ];

      if (userIds.length) {
        const { data: userRows, error: usersError } = await supabase
          .from("users")
          .select(
            "id, username, first_name, middle_name, last_name, role, district_id",
          )
          .in("id", userIds);

        if (usersError) throw usersError;
        setUsers(userRows || []);
      } else {
        setUsers([]);
      }

      const { data: districtRows, error: districtsError } = await supabase
        .from("districts")
        .select("id, name")
        .order("name");

      if (districtsError) throw districtsError;
      setDistricts(districtRows || []);
    } catch (err) {
      console.error("Failed to load CHO FHSIS reports:", err);
      setError(err.message || "Unable to load reports forwarded to CHO.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentUser = readUser();
    if (!currentUser) {
      setError("Your session was not found. Please sign in again.");
      setLoading(false);
      return;
    }

    if (currentUser.role !== "cho_admin") {
      setError("This page is available only to CHO/Admin accounts.");
      setLoading(false);
      return;
    }

    setUser(currentUser);
    loadReports();
  }, [loadReports]);

  const processReport = async (nextStatus, notes = "") => {
    if (!selectedReport || !user) return;

    if (selectedReport.status !== "forwarded_to_cho") {
      setError(
        "Only reports forwarded to CHO and awaiting review can be processed.",
      );
      return;
    }

    if (!["cho_approved", "returned_by_cho"].includes(nextStatus)) {
      setError("Invalid CHO action.");
      return;
    }

    if (nextStatus === "returned_by_cho" && !notes.trim()) {
      setError("Please provide a reason before returning this report.");
      return;
    }

    const actionText =
      nextStatus === "cho_approved"
        ? "give this report final approval"
        : "return this report for correction";

    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;

    setActionLoading(true);
    setError("");
    setNotice("");

    try {
      const now = new Date().toISOString();
      const payload = {
        status: nextStatus,
        cho_reviewed_by: user.id,
        cho_reviewed_at: now,
        cho_review_notes: notes.trim() || null,
        updated_at: now,
      };

      const { data: updatedRows, error: updateError } = await supabase
        .from("midwife_nurse_fhsis_reports")
        .update(payload)
        .eq("id", selectedReport.id)
        .eq("status", "forwarded_to_cho")
        .select("id, status");

      if (updateError) throw updateError;

      if (!updatedRows?.length) {
        throw new Error(
          "The report was not updated. It may have already been processed. Refresh the page and try again.",
        );
      }

      setNotice(
        nextStatus === "cho_approved"
          ? `FHSIS report #${selectedReport.id} has received final CHO approval.`
          : `FHSIS report #${selectedReport.id} was returned with your correction notes.`,
      );
      setSelectedReport(null);
      await loadReports();
    } catch (err) {
      console.error("Failed to process CHO report:", err);
      setError(err.message || "Unable to process the report.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "all" || report.status === statusFilter;

      const matchesDistrict =
        districtFilter === "all" ||
        String(report.district_id) === String(districtFilter);

      const midwife = userById.get(String(report.midwife_id));
      const nurse = userById.get(String(report.nurse_id));

      const haystack = [
        report.report_title,
        report.id,
        period(report),
        districtById.get(String(report.district_id)),
        midwife ? displayName(midwife) : "",
        nurse ? displayName(nurse) : "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus && matchesDistrict && (!query || haystack.includes(query))
      );
    });
  }, [
    reports,
    searchTerm,
    statusFilter,
    districtFilter,
    userById,
    districtById,
  ]);

  const pendingCount = reports.filter(
    (item) => item.status === "forwarded_to_cho",
  ).length;
  const approvedCount = reports.filter(
    (item) => item.status === "cho_approved",
  ).length;
  const returnedCount = reports.filter(
    (item) => item.status === "returned_by_cho",
  ).length;

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }

          /* Hide the application UI completely to prevent blank print pages. */
          body * { display: none !important; }

          /* Keep only the ancestor chain needed to reach the printable report. */
          body *:has(#cho-fhsis-print-area) {
            display: block !important;
            position: static !important;
            inset: auto !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            transform: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }

          #cho-fhsis-print-area,
          #cho-fhsis-print-area * {
            display: revert !important;
            visibility: visible !important;
            color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          #cho-fhsis-print-area {
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
            font-size: 9pt !important;
          }

          .print\:hidden { display: none !important; }

          #cho-fhsis-print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
          }

          #cho-fhsis-print-area th,
          #cho-fhsis-print-area td {
            border: 1px solid #999 !important;
            padding: 3px 5px !important;
            vertical-align: top !important;
          }

          #cho-fhsis-print-area section,
          #cho-fhsis-print-area tr { break-inside: avoid; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
                <ShieldCheck size={18} />
                City Health Office / FHSIS
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Received Nurse Reports
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Review consolidated district reports forwarded by Nurses and
                record the final CHO decision.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReports}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div className="flex-1 break-words">{error}</div>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              <div className="flex-1">{notice}</div>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notice"
              >
                <X size={17} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Awaiting CHO Review"
              value={pendingCount}
              icon={FileText}
              color="bg-indigo-50 text-indigo-700"
            />
            <StatCard
              title="Final Approved"
              value={approvedCount}
              icon={CheckCircle2}
              color="bg-emerald-50 text-emerald-700"
            />
            <StatCard
              title="Returned by CHO"
              value={returnedCount}
              icon={ArrowLeft}
              color="bg-rose-50 text-rose-700"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search report, district, Midwife, Nurse, month, or year..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <select
                value={districtFilter}
                onChange={(event) => setDistrictFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">All districts</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="forwarded_to_cho">Awaiting CHO Review</option>
                <option value="cho_approved">Final Approved</option>
                <option value="returned_by_cho">Returned by CHO</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Nurse Submissions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredReports.length} report
                  {filteredReports.length === 1 ? "" : "s"} found
                </p>
              </div>
              <ClipboardCheck size={22} className="text-slate-400" />
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-3 p-12 text-slate-500">
                <LoaderCircle
                  size={30}
                  className="animate-spin text-indigo-600"
                />
                <p className="text-sm">Loading reports forwarded to CHO...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center p-12 text-center">
                <FileText size={32} className="text-slate-400" />
                <h3 className="mt-4 font-semibold text-slate-900">
                  No reports found
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Reports forwarded by Nurses will appear here. Try changing
                  your filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Report</th>
                      <th className="px-5 py-3">District</th>
                      <th className="px-5 py-3">Submitted by Midwife</th>
                      <th className="px-5 py-3">Forwarded by Nurse</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3">Forwarded At</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReports.map((report) => {
                      const midwife = userById.get(String(report.midwife_id));
                      const nurse = userById.get(String(report.nurse_id));
                      const forwardedBy = userById.get(
                        String(report.forwarded_by),
                      );

                      return (
                        <tr key={report.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {report.report_title ||
                                "Consolidated FHSIS Report"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              FHSIS-{report.id}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {districtById.get(String(report.district_id)) ||
                              `District ${report.district_id}`}
                          </td>
                          <td className="px-5 py-4">
                            {midwife
                              ? displayName(midwife)
                              : `Midwife #${report.midwife_id}`}
                          </td>
                          <td className="px-5 py-4">
                            {forwardedBy
                              ? displayName(forwardedBy)
                              : nurse
                                ? displayName(nurse)
                                : `Nurse #${report.nurse_id}`}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            {period(report)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            {dateTime(report.forwarded_at)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={report.status} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReport(report)}
                              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              {report.status === "forwarded_to_cho"
                                ? "Review Report"
                                : "View Report"}
                              <ChevronRight size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <Activity size={20} className="mt-0.5 shrink-0 text-indigo-700" />
            <div className="text-sm text-indigo-900">
              <p className="font-semibold">CHO final review workflow</p>
              <p className="mt-1 leading-6">
                Only reports forwarded by a Nurse are eligible for a final
                decision. Approve reports that are complete and verified, or
                return reports with a clear reason for correction. Final
                decisions are saved with the CHO reviewer and timestamp.
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedReport && (
        <ReportModal
          report={selectedReport}
          midwife={userById.get(String(selectedReport.midwife_id))}
          nurse={userById.get(String(selectedReport.nurse_id))}
          districtName={districtById.get(String(selectedReport.district_id))}
          onClose={() => {
            if (!actionLoading) setSelectedReport(null);
          }}
          onApprove={() => processReport("cho_approved")}
          onReturn={(notes) => processReport("returned_by_cho", notes)}
          actionLoading={actionLoading}
        />
      )}
    </DashboardLayout>
  );
}
