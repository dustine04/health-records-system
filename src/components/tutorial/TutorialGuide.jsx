import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  X,
  ListChecks,
  Info,
  AlertTriangle,
  Flag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

// Role-based, read-only learning material. Never submits forms or changes clinical data.
// Paths should match the routes in Sidebar.jsx.
const lesson = (
  title,
  path,
  purpose,
  instructions,
  fields,
  reminders,
  result,
) => ({
  title,
  path,
  purpose,
  instructions,
  fields,
  reminders,
  result,
});

const GUIDES = {
  bhw: [
    lesson(
      "Your BHW dashboard",
      "/dashboard/bhw",
      "Understand your assigned community-health responsibilities and see the information available to your account.",
      [
        "Review the dashboard summary and identify your assigned local areas.",
        "Check the counts and notices related to households, pregnant women, and follow-up activities.",
        "Use the sidebar to open the relevant work module.",
        "Refresh information when necessary before starting fieldwork.",
      ],
      [
        "Assigned area: the local area where you are authorized to record information.",
        "Summary cards: quick counts; open the relevant module to inspect individual records.",
      ],
      [
        "Figures depend on the records available to your account and may change after synchronization.",
        "Do not assume an empty list means that no residents exist outside your assigned area.",
      ],
      "You can identify your assigned area and navigate to the correct task.",
    ),
    lesson(
      "Manage households",
      "/dashboard/bhw/households",
      "Register households and their members so maternal health records can be linked to the correct residents.",
      [
        "Open Households from the sidebar and select your assigned area.",
        "Check whether the household already exists before adding a new one.",
        "Choose the add-household action and enter the household code, household head, address, and other required information.",
        "Save the household, then add residents using their correct names, sex, and birth dates.",
        "Review the saved household and resident list for accuracy.",
      ],
      [
        "Household code: unique identifier for the household.",
        "Local area: must be one of your assigned areas.",
        "Resident birth date and sex: important for eligibility and reporting.",
      ],
      [
        "Avoid duplicate household codes and duplicate resident profiles.",
        "If offline entry is enabled, check whether drafts or pending records still need synchronization.",
      ],
      "The household and residents appear in the correct assigned area and can be used in later registrations.",
    ),
    lesson(
      "Register pregnant women",
      "/dashboard/bhw/pregnant-women",
      "Create a pregnancy record for an eligible female resident already associated with a household.",
      [
        "Open Pregnant Women and find the eligible resident in your assigned area.",
        "Confirm that the resident does not already have an active pregnancy record for the same pregnancy.",
        "Start registration and enter the required maternal information.",
        "Verify the last menstrual period (LMP), estimated delivery date (EDC), pregnancy history, and contact details as available.",
        "Review the form and save the pregnancy record.",
        "Proceed to Pregnancy Monitoring for ANC and home-visit records.",
      ],
      [
        "LMP: first day of the last menstrual period.",
        "EDC: estimated date of delivery.",
        "Gravida and para: pregnancy and birth history; enter only verified values.",
        "Family record number and facility details: use the identifiers required by your local workflow.",
      ],
      [
        "Confirm information with the resident or authorized health record before saving.",
        "Do not register the same pregnancy twice; avoid guessing unknown medical details.",
      ],
      "The pregnant resident has a linked pregnancy registration available for monitoring.",
    ),
    lesson(
      "Monitor pregnancies",
      "/dashboard/bhw/pregnant-monitoring",
      "Document antenatal check-ups and home visits, and help identify cases requiring clinical follow-up.",
      [
        "Open Pregnancy Monitoring and select the correct pregnant woman.",
        "Review previous visits and the scheduled next-visit date.",
        "Choose the relevant ANC or home-visit action and enter the actual visit date.",
        "Record observations, vital signs, gestational age, and findings only when measured or verified.",
        "Document danger signs, concerns, advice, and follow-up instructions according to your authorized duties.",
        "Save the visit and confirm that it appears in the monitoring history.",
      ],
      [
        "ANC visit: antenatal care encounter.",
        "Gestational age: may be calculated from LMP; verify the date used.",
        "Danger signs: symptoms that require attention under local clinical protocols.",
        "Next visit date: used to identify upcoming and missed follow-ups.",
      ],
      [
        "Do not treat the software as a substitute for clinical judgment.",
        "Escalate urgent danger signs using your established referral procedure; do not wait for the next scheduled visit.",
        "If working offline, confirm the visit has synchronized before assuming it is on the server.",
      ],
      "The visit is documented with a clear date, findings, and follow-up plan.",
    ),
    lesson(
      "Prepare monthly reports",
      "/dashboard/bhw/monthly-report",
      "Summarize community maternal-health activities for Midwife review.",
      [
        "Open Monthly Report and choose the correct reporting month, year, and assigned area.",
        "Generate or load the report using available household, pregnancy, and monitoring records.",
        "Check pregnancy tracking, visits, deliveries, referrals, and other applicable indicators.",
        "Complete any permitted manual entries using verified source information.",
        "Save a draft if more checking is needed, or submit the report when complete.",
        "If the Midwife returns it, read the review notes, correct the data, and resubmit.",
      ],
      [
        "Reporting period: the month and year covered.",
        "Draft: report still being prepared.",
        "Submitted: sent for review.",
        "Returned: requires corrections based on reviewer feedback.",
      ],
      [
        "Review auto-generated totals; automation does not guarantee that underlying records are complete.",
        "Do not count an activity in the wrong reporting month or submit duplicate reports.",
      ],
      "A submitted monthly report is available for the Midwife to review.",
    ),
  ],
  bns: [
    lesson(
      "Your BNS dashboard",
      "/dashboard/bns",
      "Understand your assigned child-health responsibilities and access the records you manage.",
      [
        "Review the dashboard's child-health and assigned-area summaries.",
        "Confirm your local area assignment before creating records.",
        "Use the sidebar to navigate to household, registration, monitoring, or reporting modules.",
        "Check pending work and refresh the displayed information when needed.",
      ],
      [
        "Assigned area: determines which households and children you can manage.",
        "Child-health summary: depends on available records and reporting periods.",
      ],
      [
        "Do not interpret missing records as evidence that a child does not exist.",
        "Check offline synchronization status when applicable.",
      ],
      "You know where to find the child-health tasks relevant to your assignment.",
    ),
    lesson(
      "Manage households",
      "/dashboard/bns/households",
      "Link children to households and residents in your assigned area.",
      [
        "Open Households and choose your assigned area.",
        "Search for an existing household before creating a new one.",
        "Enter a unique household code, household head, address, and required information.",
        "Add residents with accurate names, sex, and birth dates.",
        "Verify that the correct household is associated with each child.",
      ],
      [
        "Household code: unique household identifier.",
        "Local area: the assigned location for the household.",
        "Birth date: determines age-group classification in child reports.",
      ],
      [
        "Avoid duplicate households and resident records.",
        "Check whether any offline changes are still pending synchronization.",
      ],
      "The household and child resident are ready for child-health registration.",
    ),
    lesson(
      "Register children",
      "/dashboard/bns/child-registration",
      "Create a child-health record for a resident, or use the supported new-child registration flow.",
      [
        "Open Child Registration and search for an existing child record.",
        "Choose an existing resident, or use the new-child flow when the child is not yet in the household list.",
        "If needed, create the household and resident first using the required information.",
        "Enter the child's registration details, birth date, sex, measurements, and other available fields.",
        "Review the mother's information, newborn-screening details, and referral information where applicable.",
        "Save and verify the child-health record appears in the list.",
      ],
      [
        "Birth date and sex: used for child age and sex classifications.",
        "Weight, height, MUAC: record the actual measurements with the correct units.",
        "Newborn-screening details: record only confirmed results and dates.",
        "Family or document record number: follow the local identifier format.",
      ],
      [
        "Never invent measurements or screening results.",
        "Check for duplicate child records, especially when creating a new household and resident.",
        "If using offline drafts, synchronize and verify the server record later.",
      ],
      "The child has a registered health record that can be selected for monitoring.",
    ),
    lesson(
      "Child monitoring",
      "/dashboard/bns/child-monitoring",
      "Maintain the child's longitudinal health and nutrition history.",
      [
        "Select the correct child from Child Monitoring.",
        "Choose the record category: newborn tracking, growth, immunization, feeding, micronutrients, or follow-ups.",
        "Enter the correct event date and measured or verified observations.",
        "For immunizations and supplements, record the actual product or vaccine, dose, and relevant details.",
        "For follow-ups, document findings and referrals within your authorized responsibilities.",
        "Save the record and review it in the child's history.",
      ],
      [
        "Growth: monitoring date, weight, height, and MUAC when measured.",
        "Immunization: vaccine, dose, vaccination date, and facility when available.",
        "Feeding: breastfeeding and complementary feeding status.",
        "Follow-up: observations, assessment, plan, and referral details as applicable.",
      ],
      [
        "Use actual service dates, not the date of data entry when they differ.",
        "Avoid duplicate vaccination or monitoring entries.",
        "Follow local clinical protocols for abnormal findings and referrals.",
      ],
      "The child's record shows a dated history of monitoring and services.",
    ),
    lesson(
      "Monthly child report",
      "/dashboard/bns/monthly-report",
      "Prepare the monthly child-health and nutrition summary for Midwife review.",
      [
        "Choose the reporting month, year, and assigned barangay.",
        "Load or generate the report from eligible child and monitoring records.",
        "Review age/sex group counts and the month's newborn, growth, immunization, feeding, and other indicators.",
        "Enter permitted manual figures, such as transfers or deaths, using verified information.",
        "Save a draft for checking or submit the completed report.",
        "If returned, review the notes, correct the source data or report, and resubmit.",
      ],
      [
        "Age groups: based on age at the reporting cutoff.",
        "Reporting month: service records must fall in the correct period.",
        "Status: indicates draft, submitted, returned, or other review stage.",
      ],
      [
        "Some age categories may overlap by design; do not add overlapping categories together as unique children.",
        "Verify unusual totals before submission.",
      ],
      "The child-health monthly report is submitted for Midwife review.",
    ),
  ],
  midwife: [
    lesson(
      "Midwife dashboard",
      "/dashboard/midwife",
      "Monitor district maternal-health activity and prioritize scheduled or missed ANC follow-ups.",
      [
        "Review the pregnancy overview and key dashboard statistics.",
        "Check the missed check-ups notification for overdue appointments.",
        "Review due-today and upcoming visit information.",
        "Open Pregnancy Monitoring to inspect the relevant patient's history and follow-up status.",
        "Refresh the dashboard after significant updates.",
      ],
      [
        "Missed check-up: next scheduled visit date has passed.",
        "Due today: scheduled follow-up is today.",
        "Upcoming: visit is approaching within the dashboard's configured window.",
      ],
      [
        "A missed appointment alert is not itself a clinical diagnosis.",
        "Verify the latest visit and next-visit date before taking follow-up action.",
      ],
      "You can identify which records may need review or follow-up.",
    ),
    lesson(
      "Manage BNS and BHW",
      "/dashboard/midwife/workers",
      "Review community workers within your district and manage their area assignments.",
      [
        "Open BNS / BHW from the sidebar.",
        "Filter or search workers by role, name, or status.",
        "Confirm that the worker belongs to a barangay in your district.",
        "Review the worker's assigned local areas.",
        "Activate an eligible worker or adjust assignments where authorized.",
        "Save changes and verify the updated status or assignment.",
      ],
      [
        "District and barangay: define the worker's coverage.",
        "Local area assignment: controls which community records a worker may manage.",
        "Active status: determines whether the worker is enabled for the intended workflow.",
      ],
      [
        "Do not assign workers to areas outside your permitted district.",
        "Verify assignments before removing or deactivating access.",
      ],
      "The worker's status and authorized local areas reflect the intended assignment.",
    ),
    lesson(
      "Pregnancy monitoring and Nurse access",
      "/dashboard/midwife/pregnancy-monitoring",
      "Review maternal-health monitoring and authorize Nurse access when district coverage requires it.",
      [
        "Open Pregnancy Monitoring and locate the correct pregnancy record.",
        "Review the registration, ANC history, follow-up dates, and documented concerns.",
        "Inspect missed or upcoming check-ups and applicable referral information.",
        "Use the Nurse authorization controls to select an eligible Nurse in your district.",
        "Grant or revoke monitoring access according to your operational policy.",
        "Confirm the authorization state before expecting the Nurse to view or manage the record.",
      ],
      [
        "ANC history: recorded visits and findings.",
        "Next visit date: supports scheduling and missed-check-up alerts.",
        "Nurse authorization: required before the Nurse can use the permitted monitoring functions.",
      ],
      [
        "Authorization must be intentional and limited to the correct district.",
        "Do not grant access solely because a user knows the page URL.",
        "Clinical changes must follow the user's professional responsibilities.",
      ],
      "The record has been reviewed and Nurse access is granted or withheld as intended.",
    ),
    lesson(
      "Review BHW reports",
      "/dashboard/midwife/monthly-reports",
      "Check maternal-health monthly reports submitted by BHWs in your district.",
      [
        "Open BHW Monthly Reports and select the reporting period.",
        "Find a submitted report from a worker in your district.",
        "Review pregnancy tracking, service counts, delivery information, and other included indicators.",
        "Compare figures with available source information where needed.",
        "Approve or mark reviewed when accurate, or return the report with clear correction notes.",
        "Confirm the final review status before consolidation.",
      ],
      [
        "Submitted: awaiting review.",
        "Reviewed: accepted for the next reporting stage.",
        "Returned: sent back for correction.",
      ],
      [
        "Do not consolidate reports that have not passed the required review stage.",
        "Give actionable notes when returning a report.",
      ],
      "The BHW report is reviewed or returned with an explanation.",
    ),
    lesson(
      "Review BNS reports",
      "/dashboard/midwife/bns-reports",
      "Check child-health and nutrition monthly reports submitted by BNS workers.",
      [
        "Open BNS Child Reports and choose the reporting period.",
        "Select a submitted report from a barangay within your district.",
        "Review child age groups, monitoring totals, immunization, feeding, and other recorded indicators.",
        "Investigate inconsistencies and missing information.",
        "Mark the report reviewed when acceptable or return it with specific notes.",
        "Confirm that the reviewed report is eligible for consolidation.",
      ],
      [
        "Age/sex groups: reflect the report's defined age ranges.",
        "Source indicators: derive from registration and monitoring information.",
        "Review status: controls whether the report can be consolidated.",
      ],
      [
        "Avoid double-counting overlapping age ranges.",
        "Do not approve incomplete or unexplained totals.",
      ],
      "The BNS report has an appropriate review status and is ready for the next step if approved.",
    ),
    lesson(
      "Submit consolidated FHSIS",
      "/dashboard/midwife/fhsis-report",
      "Combine reviewed BHW and BNS source reports and submit a district-level FHSIS summary to the Nurse.",
      [
        "Open Submit to Nurse and select the reporting month and year.",
        "Confirm your district and the Nurse assigned to the same district.",
        "Load the eligible reviewed BHW and BNS source reports.",
        "Review the consolidated totals and the source reports included.",
        "Save a draft if necessary, then submit the consolidated report.",
        "If the Nurse returns the report, review the notes, correct the issues, and resubmit.",
      ],
      [
        "Source reports: only reports in the required reviewed status should be included.",
        "District: determines the eligible barangays and receiving Nurse.",
        "Submission status: shows whether the report is awaiting Nurse review or requires correction.",
      ],
      [
        "Do not mix reports from different districts or reporting months.",
        "Confirm that the consolidated totals match the included sources.",
      ],
      "A consolidated district report is submitted to the appropriate Nurse.",
    ),
  ],
  nurse: [
    lesson(
      "Nurse dashboard",
      "/dashboard/nurse",
      "Understand district-level maternal-health activity and pending review work.",
      [
        "Open the dashboard and confirm your assigned district.",
        "Review available pregnancy monitoring indicators and reporting summaries.",
        "Identify reports awaiting review and records requiring attention.",
        "Navigate to Pregnancy Monitoring or Reports for detailed work.",
      ],
      [
        "District: determines the reporting and monitoring scope.",
        "Report status: indicates which reports need action.",
      ],
      [
        "Dashboard totals reflect the latest available records, not necessarily unsynchronized offline work.",
      ],
      "You can identify your current review priorities.",
    ),
    lesson(
      "Authorized pregnancy monitoring",
      "/dashboard/nurse/pregnancy-monitoring",
      "Provide monitoring support only when a Midwife has authorized Nurse access for the relevant district.",
      [
        "Open Pregnancy Monitoring and check whether access has been granted.",
        "If access is not available, request authorization through the appropriate Midwife workflow.",
        "Once authorized, locate the correct pregnancy record.",
        "Review ANC history, concerns, scheduled visits, and referrals.",
        "Document authorized monitoring updates carefully and verify the saved result.",
      ],
      [
        "Authorization: Midwife-granted access required for this module.",
        "ANC and home-visit history: prior monitoring information.",
        "Follow-up schedule: helps identify missed or upcoming visits.",
      ],
      [
        "Do not bypass missing authorization.",
        "Avoid duplicate visits and verify clinical information before saving.",
      ],
      "Authorized monitoring information is reviewed or updated according to the Nurse's permissions.",
    ),
    lesson(
      "Review consolidated FHSIS",
      "/dashboard/nurse/fhsis-reports",
      "Review district reports submitted by Midwives and decide whether to approve, return, or forward them.",
      [
        "Open Reports and select the relevant month, district, or report status.",
        "Open a submitted consolidated FHSIS report.",
        "Review its district, reporting period, summary indicators, and source information.",
        "Return the report with clear review notes if corrections are required.",
        "Approve the report when accurate and complete.",
        "Use the forwarding action to send an eligible approved report to CHO when the workflow permits it.",
      ],
      [
        "Submitted: pending Nurse review.",
        "Returned: requires Midwife correction.",
        "Approved or reviewed: accepted for forwarding, according to the configured status workflow.",
        "Forwarded: sent to CHO for the next stage.",
      ],
      [
        "Do not forward an unreviewed report.",
        "Check the application's configured statuses before interpreting a report as finally approved.",
      ],
      "The report is returned for correction or approved and forwarded through the configured workflow.",
    ),
    lesson(
      "District coverage",
      "/dashboard/nurse/district-coverage",
      "Understand which barangays, workers, and service areas are associated with your district.",
      [
        "Open District Coverage.",
        "Confirm the district shown for your account.",
        "Review available barangay and service coverage information.",
        "Use the information to understand which records and reports fall within your responsibility.",
      ],
      [
        "District: the Nurse's assigned reporting area.",
        "Barangay coverage: constituent barangays within that district.",
      ],
      [
        "Coverage views should not be treated as permission to access unrelated patient records.",
      ],
      "You can identify the area covered by your district responsibilities.",
    ),
  ],
  cho_admin: [
    lesson(
      "Citywide dashboard",
      "/dashboard/admin",
      "Review city-level maternal and child health information across districts and barangays.",
      [
        "Open the CHO dashboard.",
        "Review the district, barangay, worker, household, and health indicator summaries that are available.",
        "Inspect charts and reporting periods before interpreting trends.",
        "Navigate to the appropriate management or reporting page for details.",
      ],
      [
        "District and barangay counts: administrative coverage.",
        "Health indicators: depend on records and reports included in the current view.",
      ],
      [
        "Check the selected reporting period before comparing totals.",
        "Aggregated figures should not be treated as a substitute for validated official reports.",
      ],
      "You can identify citywide trends and areas requiring administrative review.",
    ),
    lesson(
      "Manage users",
      "/dashboard/admin/users",
      "Oversee eligible system accounts and their administrative assignments.",
      [
        "Open Users and search for the relevant account.",
        "Verify the user's identity, role, and assigned district or barangay.",
        "Use the available management actions only when authorized.",
        "Review any activation or deactivation confirmation before applying changes.",
        "Verify the updated account state.",
      ],
      [
        "Role: determines the user's workflow and available pages.",
        "District or barangay: defines relevant scope.",
        "Active status: indicates whether the account is enabled.",
      ],
      [
        "Follow your account approval process.",
        "Never share passwords or grant unnecessarily broad access.",
      ],
      "The account has the intended role, coverage, and status.",
    ),
    lesson(
      "Manage districts",
      "/dashboard/admin/districts",
      "Maintain the district structure used for assignments and reporting.",
      [
        "Open Districts.",
        "Review existing district entries before making changes.",
        "Use the available add or edit controls where authorized.",
        "Check the district name and related assignments.",
        "Save and verify the updated district information.",
      ],
      ["District name: used to group barangays and district-level staff."],
      [
        "Avoid duplicate district entries.",
        "Check downstream assignments before changing existing district records.",
      ],
      "District information is accurate and available to the rest of the system.",
    ),
    lesson(
      "Manage barangays",
      "/dashboard/admin/barangays",
      "Maintain barangay information and its district association.",
      [
        "Open Barangays and locate the relevant entry.",
        "Check whether the barangay already exists.",
        "Review or enter the barangay name and its correct district.",
        "Save changes using the available controls.",
        "Verify the barangay appears under the correct district.",
      ],
      [
        "Barangay: local administrative unit.",
        "District association: determines which district workflows include the barangay.",
      ],
      [
        "Incorrect district assignments can affect worker access and report consolidation.",
      ],
      "Barangay records reflect the correct district coverage.",
    ),
    lesson(
      "Review city reports",
      "/dashboard/admin/fhsis-reports",
      "Review reports forwarded from the Nurse stage for city-level oversight.",
      [
        "Open Reports and select the relevant reporting period.",
        "Locate reports forwarded through the district workflow.",
        "Review district details, consolidated indicators, and available review information.",
        "Use only the final review or administrative actions actually enabled for your account.",
        "Confirm the report's resulting status.",
      ],
      [
        "Reporting period: month and year covered.",
        "Forwarded status: indicates receipt from the Nurse stage.",
      ],
      [
        "Avoid treating a draft or returned report as a final city-level submission.",
      ],
      "The report has been inspected and handled according to the configured CHO workflow.",
    ),
  ],
  it_admin: [
    lesson(
      "IT dashboard",
      "/dashboard/it-admin",
      "Understand system administration, operational activity, and technical oversight information.",
      [
        "Open the IT dashboard.",
        "Review the available user, audit, and operational summaries.",
        "Identify failed operations or access issues requiring investigation.",
        "Use the sidebar to open account management, exports, or audit logs.",
      ],
      [
        "Audit activity: recorded system events.",
        "Account status: enabled or disabled users as represented in the system.",
      ],
      [
        "Dashboard indicators depend on available logging and permissions.",
        "Do not expose clinical information during troubleshooting.",
      ],
      "You can navigate to the appropriate technical administration task.",
    ),
    lesson(
      "User management",
      "/dashboard/it-admin/users",
      "Support account administration within the permissions granted to the IT role.",
      [
        "Open User Management and locate the relevant account.",
        "Confirm the person's identity and intended role before making changes.",
        "Review the current account status and scope.",
        "Apply only the available, authorized account management action.",
        "Verify the result and review audit activity if necessary.",
      ],
      [
        "Role: determines feature access.",
        "Active status: controls whether the account can be used.",
        "District and barangay: define applicable data scope.",
      ],
      [
        "Use least-privilege access.",
        "Never disclose or store plaintext passwords in notes or audit details.",
      ],
      "The account's configuration matches the approved request.",
    ),
    lesson(
      "Data exports",
      "/dashboard/it-admin/exports",
      "Use permitted export features for authorized operational or reporting purposes.",
      [
        "Open Data Exports.",
        "Review the available export types and any filters.",
        "Choose only the dataset and period required for the approved purpose.",
        "Generate or download the export using the available action.",
        "Store and share the resulting file only through approved channels.",
      ],
      [
        "Export scope: selected data and reporting period.",
        "File output: may contain confidential information depending on the export.",
      ],
      [
        "Do not export more personal or clinical information than necessary.",
        "Keep exported files secure and follow organizational retention rules.",
      ],
      "An authorized export is produced and handled appropriately.",
    ),
    lesson(
      "Audit logs",
      "/dashboard/it-admin/audit-logs",
      "Review recorded activity to investigate system operations, access changes, and errors.",
      [
        "Open Audit Logs.",
        "Filter by date, actor, action, or status if those controls are available.",
        "Inspect relevant entries for successful and failed operations.",
        "Correlate related events without exposing sensitive record content.",
        "Document and escalate suspicious patterns according to your security procedure.",
      ],
      [
        "Actor ID: account associated with the recorded event.",
        "Action and entity: type of operation and affected resource.",
        "Status and timestamp: whether the recorded operation succeeded and when it occurred.",
      ],
      [
        "Client-side audit entries may be incomplete or tampered with; do not assume they are definitive evidence.",
        "Do not copy credentials or patient details into incident notes.",
      ],
      "You can identify relevant logged events and investigate issues responsibly.",
    ),
  ],
};

const ROLE_LABELS = {
  bhw: "Barangay Health Worker",
  bns: "Barangay Nutrition Scholar",
  midwife: "Midwife",
  nurse: "Nurse",
  cho_admin: "CHO Administrator",
  it_admin: "IT Administrator",
};

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

const Section = ({ icon: Icon, title, children, tone = "slate" }) => (
  <section
    className={`rounded-xl border p-3.5 ${tone === "amber" ? "border-amber-200 bg-amber-50/60" : tone === "teal" ? "border-teal-200 bg-teal-50/60" : "border-slate-200 bg-slate-50/70"}`}
  >
    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
      <Icon size={16} />
      {title}
    </h4>
    {children}
  </section>
);

export default function TutorialGuide() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const role = user?.role;
  const steps = useMemo(() => GUIDES[role] || [], [role]);
  // v2 prompts existing users to see the expanded lessons once.
  const progressKey = user?.id ? `mchms_tutorial_v2_${user.id}_${role}` : null;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showAllLessons, setShowAllLessons] = useState(false);

  useEffect(() => {
    if (!progressKey || !steps.length) return;
    let done = false;
    try {
      done = localStorage.getItem(progressKey) === "completed";
    } catch {
      /* Storage may be disabled. */
    }
    setCompleted(done);
    setStep(0);
    setOpen(!done);
  }, [progressKey, steps.length]);

  useEffect(() => {
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("mchms:open-tutorial", show);
    return () => window.removeEventListener("mchms:open-tutorial", show);
  }, []);

  useEffect(() => {
    if (!open || !steps[step]) return;
    const path = steps[step].path;
    const target = Array.from(
      document.querySelectorAll("[data-tutorial-path]"),
    ).find((el) => el.getAttribute("data-tutorial-path") === path);
    if (!target) return;
    target.classList.add("ring-2", "ring-amber-400", "ring-offset-2");
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () =>
      target.classList.remove("ring-2", "ring-amber-400", "ring-offset-2");
  }, [open, step, steps, location.pathname]);

  if (!user || !steps.length || !open) return null;
  const current = steps[step];
  const finish = () => {
    if (progressKey) {
      try {
        localStorage.setItem(progressKey, "completed");
      } catch {
        /* Storage may be disabled. */
      }
    }
    setCompleted(true);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-2 sm:items-center sm:justify-end sm:p-6"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mchms-tutorial-title"
        className="flex max-h-[95dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90dvh]"
      >
        <div className="flex shrink-0 items-start justify-between bg-gradient-to-r from-teal-700 to-cyan-700 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2">
              <BookOpen size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-100">
                MCHMS · Detailed user tutorial
              </p>
              <h2 id="mchms-tutorial-title" className="text-lg font-bold">
                {ROLE_LABELS[role]}
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close tutorial"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              Lesson {step + 1} of {steps.length}
            </span>
            <span>
              {completed ? "Previously completed" : "Getting started"}
            </span>
          </div>
          <div
            className="flex gap-1.5"
            aria-label={`Lesson ${step + 1} of ${steps.length}`}
          >
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-teal-600" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowAllLessons((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Browse lessons{" "}
            {showAllLessons ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
          {showAllLessons && (
            <div className="grid grid-cols-1 gap-1.5 rounded-lg bg-slate-50 p-2 sm:grid-cols-2">
              {steps.map((item, i) => (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => {
                    setStep(i);
                    setShowAllLessons(false);
                  }}
                  className={`rounded-lg px-3 py-2 text-left text-xs ${i === step ? "bg-teal-100 font-bold text-teal-900" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                >
                  {i + 1}. {item.title}
                </button>
              ))}
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {current.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {current.purpose}
            </p>
          </div>
          <Section icon={ListChecks} title="Step-by-step procedure">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {current.instructions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </Section>
          <Section icon={Info} title="Important fields and concepts">
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
              {current.fields.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Section>
          <Section
            icon={AlertTriangle}
            title="Reminders and common mistakes"
            tone="amber"
          >
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
              {current.reminders.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Section>
          <Section icon={Flag} title="Expected result" tone="teal">
            <p className="text-sm leading-6 text-slate-700">{current.result}</p>
          </Section>

          <button
            type="button"
            onClick={() => navigate(current.path)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            <ExternalLink size={16} />
            {location.pathname === current.path
              ? "You are on this page"
              : "Open this page"}
          </button>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <RotateCcw size={14} /> Restart
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((n) => n - 1)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <ArrowLeft size={15} /> Back
                </button>
              )}
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((n) => n + 1)}
                  className="flex items-center gap-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Next <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="flex items-center gap-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  <CheckCircle2 size={16} /> Finish
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-center text-xs font-medium text-slate-500 underline hover:text-slate-800"
          >
            Skip for now
          </button>
        </div>
      </section>
    </div>
  );
}
