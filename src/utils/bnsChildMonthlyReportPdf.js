
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";

/* =========================================================
   CONSTANTS
========================================================= */

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

const MONITORING_SECTIONS = [
  {
    key: "newborn",
    title: "Newborn Tracking",
    columns: [
      ["child_name", "Child"],
      ["delivery_date", "Delivery Date"],
      ["place_of_delivery", "Place of Delivery"],
      ["birth_weight_kg", "Birth Weight (kg)"],
      ["newborn_screening_done", "Screening Done"],
      ["newborn_screening_date", "Screening Date"],
      ["newborn_screening_result", "Screening Result"],
      ["exclusive_breastfeeding", "Exclusive Breastfeeding"],
      ["remarks", "Remarks"],
    ],
  },
  {
    key: "growth",
    title: "Growth Monitoring",
    columns: [
      ["child_name", "Child"],
      ["monitoring_date", "Date"],
      ["weight_kg", "Weight (kg)"],
      ["height_cm", "Height (cm)"],
      ["muac_cm", "MUAC (cm)"],
    ],
  },
  {
    key: "immunization",
    title: "Immunization",
    columns: [
      ["child_name", "Child"],
      ["vaccination_date", "Date"],
      ["vaccine_name", "Vaccine"],
      ["dose", "Dose"],
      ["facility", "Facility"],
      ["remarks", "Remarks"],
    ],
  },
  {
    key: "feeding",
    title: "Breastfeeding and Complementary Feeding",
    columns: [
      ["child_name", "Child"],
      ["record_date", "Date"],
      ["breastfeeding_status", "Breastfeeding"],
      ["complementary_feeding_status", "Complementary Feeding"],
      ["feeding_notes", "Notes"],
    ],
  },
  {
    key: "micronutrients",
    title: "Micronutrient Supplementation",
    columns: [
      ["child_name", "Child"],
      ["supplementation_date", "Date"],
      ["supplement_name", "Supplement"],
      ["dosage", "Dosage"],
      ["status", "Status"],
      ["remarks", "Remarks"],
    ],
  },
  {
    key: "deworming",
    title: "Deworming",
    columns: [
      ["child_name", "Child"],
      ["deworming_date", "Date"],
      ["medicine", "Medicine"],
      ["dosage", "Dosage"],
      ["status", "Status"],
      ["remarks", "Remarks"],
    ],
  },
  {
    key: "followups",
    title: "SOAP / Follow-up",
    columns: [
      ["child_name", "Child"],
      ["followup_date", "Date"],
      ["subjective", "Subjective"],
      ["objective", "Objective"],
      ["assessment", "Assessment"],
      ["plan", "Plan"],
      ["referral", "Referral"],
      ["remarks", "Remarks"],
    ],
  },
];

const POPULATION_CATEGORIES = [
  ["age_0_11", "0-11 months old"],
  ["age_0_12", "0-12 months old"],
  ["age_13_23", "13-23 months old"],
  ["age_24_59", "24-59 months old"],
];

/* =========================================================
   HELPERS
========================================================= */

function asObject(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDate(value) {
  if (!value) return "";

  const raw = String(value);

  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return formatValue(value);
  }

  const [year, month, day] = raw.slice(0, 10).split("-").map(Number);

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFullName(user) {
  return [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(" ") || user?.name || user?.username || "Not specified";
}

function getUnique(values) {
  return [
    ...new Set(
      values
        .filter((value) => value !== null && value !== undefined)
        .map(String)
    ),
  ];
}

function safeFilename(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCategoryValue(reportData, category, field) {
  return Number(reportData?.[category]?.[field] || 0);
}

/* =========================================================
   FETCH BNS AREA, DISTRICT, AND HOUSEHOLD COUNT

   Only counts households belonging to the selected
   barangay AND the logged-in BNS's active assigned areas.
========================================================= */

async function getBnsReportLocation({
  userId,
  barangayId,
}) {
  const { data: assignments, error: assignmentError } =
    await supabase
      .from("worker_area_assignments")
      .select(`
        local_area_id,
        local_areas (
          id,
          name,
          type,
          barangays (
            id,
            name,
            district_id,
            districts (
              id,
              name
            )
          )
        )
      `)
      .eq("worker_id", userId)
      .eq("is_active", true);

  if (assignmentError) {
    throw new Error(
      `Unable to retrieve assigned areas: ${assignmentError.message}`
    );
  }

  const selectedAssignments = asArray(assignments).filter((assignment) => {
    const localArea = asObject(assignment.local_areas);
    const barangay = asObject(localArea?.barangays);

    return String(barangay?.id) === String(barangayId);
  });

  const areaIds = getUnique(
    selectedAssignments.map((assignment) => assignment.local_area_id)
  );

  const areaNames = getUnique(
    selectedAssignments.map((assignment) => {
      const area = asObject(assignment.local_areas);

      if (!area?.name) return null;

      return area.type
        ? `${area.type}: ${area.name}`
        : area.name;
    })
  );

  const barangayNames = getUnique(
    selectedAssignments.map((assignment) => {
      const area = asObject(assignment.local_areas);
      const barangay = asObject(area?.barangays);

      return barangay?.name;
    })
  );

  const districtNames = getUnique(
    selectedAssignments.map((assignment) => {
      const area = asObject(assignment.local_areas);
      const barangay = asObject(area?.barangays);
      const district = asObject(barangay?.districts);

      return district?.name;
    })
  );

  let householdCount = 0;

  if (areaIds.length > 0) {
    const { count, error: householdError } =
      await supabase
        .from("households")
        .select("id", {
          count: "exact",
          head: true,
        })
        .in("local_area_id", areaIds);

    if (householdError) {
      throw new Error(
        `Unable to retrieve household count: ${householdError.message}`
      );
    }

    householdCount = count ?? 0;
  }

  return {
    districtName: districtNames.join(", ") || "Not assigned",
    barangayName: barangayNames.join(", ") || "Not assigned",
    catchmentArea: areaNames.join(", ") || "Not assigned",
    householdCount,
  };
}

/* =========================================================
   MAIN PDF GENERATOR
========================================================= */

export async function downloadBnsChildMonthlyReportPdf({
  user,
  reportData,
  displayData,
  monitoringData,
  reportMonth,
  reportYear,
  selectedBarangayId,
  status = "draft",
}) {
  if (!user?.id) {
    throw new Error("Unable to identify the logged-in BNS.");
  }

if (
  selectedBarangayId === null ||
  selectedBarangayId === undefined ||
  String(selectedBarangayId).trim() === ""
) {
  throw new Error(
    "Barangay ID was not provided to the PDF generator."
  );
}

  const month = Number(reportMonth);
  const year = Number(reportYear);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid reporting month.");
  }

  if (!Number.isInteger(year)) {
    throw new Error("Invalid reporting year.");
  }

  // -------------------------------------------------------
  // GET LOCATION INFORMATION
  // -------------------------------------------------------

  const location = await getBnsReportLocation({
    userId: user.id,
    barangayId: selectedBarangayId,
  });

  // Prefer the currently displayed population values.
  // This includes automatic male/female calculations
  // and manually entered trans-out/deceased values.

  const population = displayData || reportData || {};

  // Monitoring data can be supplied directly from the page.
  // Saved report_data.child_monitoring is the fallback.

  const monitoring =
    monitoringData ||
    reportData?.child_monitoring ||
    {};

  // -------------------------------------------------------
  // INITIALIZE PDF
  // -------------------------------------------------------

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 12;
  const marginRight = 12;
  const marginBottom = 17;

  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = 12;

  // -------------------------------------------------------
  // PDF HELPERS
  // -------------------------------------------------------

  function ensureSpace(requiredHeight = 12) {
    if (y + requiredHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = 15;
    }
  }

  function drawSectionTitle(title) {
    ensureSpace(12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const lines = doc.splitTextToSize(title, contentWidth);

    doc.text(lines, marginLeft, y);

    y += lines.length * 4.5 + 3;
  }

  function drawTable(headers, rows, options = {}) {
    ensureSpace(16);

    autoTable(doc, {
      startY: y,

      head: [headers],

      body: rows.length
        ? rows
        : [headers.map(() => "")],

      theme: "grid",

      margin: {
        left: marginLeft,
        right: marginRight,
        top: 15,
        bottom: marginBottom,
      },

      styles: {
        font: "helvetica",
        fontSize: options.fontSize || 6.7,
        textColor: [0, 0, 0],
        cellPadding: 1.7,
        lineColor: [65, 65, 65],
        lineWidth: 0.12,
        valign: "middle",
        overflow: "linebreak",
      },

      headStyles: {
        fillColor: [243, 243, 243],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },

      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },

      rowPageBreak: "avoid",

      ...options,
    });

    y = (doc.lastAutoTable?.finalY || y) + 7;
  }

  function drawHeaderField(label, value, x, maxWidth) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const lines = doc.splitTextToSize(
      `${label}: ${formatValue(value)}`,
      maxWidth
    );

    doc.text(lines, x, y);

    return lines.length * 4.2;
  }

  // =======================================================
  // OFFICIAL HEADER - SAME STYLE AS BHW MONTHLY REPORT
  // =======================================================

  doc.setFont("times", "normal");
  doc.setFontSize(10);

  doc.text(
    "Republic of the Philippines",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 5;

  doc.setFont("times", "bold");

  doc.text(
    "CITY HEALTH DEPARTMENT",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 5;

  doc.setFont("times", "normal");

  doc.text(
    "Ormoc City",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 8;

  doc.setFont("times", "bold");
  doc.setFontSize(9);

  const districtLines = doc.splitTextToSize(
    location.districtName,
    contentWidth
  );

  doc.text(
    districtLines,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += districtLines.length * 4 + 2;

  doc.setFont("times", "bold");
  doc.setFontSize(10);

  doc.text(
    "MONTHLY BNS CHILD MONITORING REPORT",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 6;

  doc.setFont("times", "normal");
  doc.setFontSize(8);

  const catchmentLines = doc.splitTextToSize(
    `Catchment Area: ${location.catchmentArea}`,
    contentWidth
  );

  doc.text(
    catchmentLines,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += catchmentLines.length * 4 + 6;

  // -------------------------------------------------------
  // BNS INFORMATION
  // -------------------------------------------------------

  const leftColumnWidth = 95;
  const rightColumnX = 114;
  const rightColumnWidth = pageWidth - marginRight - rightColumnX;

  let leftHeight = drawHeaderField(
    "Name",
    getFullName(user),
    marginLeft,
    leftColumnWidth
  );

  let rightHeight = drawHeaderField(
    "Month",
    `${MONTHS[month - 1]} ${year}`,
    rightColumnX,
    rightColumnWidth
  );

  y += Math.max(leftHeight, rightHeight) + 2;

  leftHeight = drawHeaderField(
    "Barangay",
    location.barangayName,
    marginLeft,
    leftColumnWidth
  );

  rightHeight = drawHeaderField(
    "Number of Households",
    location.householdCount,
    rightColumnX,
    rightColumnWidth
  );

  y += Math.max(leftHeight, rightHeight) + 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  doc.text(
    `Report Status: ${String(status).toUpperCase()}`,
    marginLeft,
    y
  );

  y += 5;

  doc.setDrawColor(90, 90, 90);
  doc.setLineWidth(0.25);

  doc.line(
    marginLeft,
    y,
    pageWidth - marginRight,
    y
  );

  y += 8;

  // =======================================================
  // SECTION I - ACTUAL CHILD POPULATION
  // =======================================================

  drawSectionTitle(
    "I. ACTUAL CHILD POPULATION"
  );

  const populationRows = POPULATION_CATEGORIES.map(
    ([category, label]) => [
      label,
      getCategoryValue(population, category, "male"),
      getCategoryValue(population, category, "female"),
      getCategoryValue(population, category, "trans_out_male"),
      getCategoryValue(population, category, "trans_out_female"),
      getCategoryValue(population, category, "deceased_male"),
      getCategoryValue(population, category, "deceased_female"),
    ]
  );

  drawTable(
    [
      "Age Group",
      "Actual Male",
      "Actual Female",
      "Trans-out Male",
      "Trans-out Female",
      "Deceased Male",
      "Deceased Female",
    ],
    populationRows,
    {
      fontSize: 6.5,
      columnStyles: {
        0: { cellWidth: 33 },
      },
    }
  );

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);

  ensureSpace(9);

  doc.text(
    "Note: The 0-11 and 0-12 month age groups overlap and should not be added together.",
    marginLeft,
    y,
    { maxWidth: contentWidth }
  );

  y += 9;

  // =======================================================
  // SECTION II - CHILD MONITORING ACTIVITIES
  // =======================================================

  drawSectionTitle(
    "II. CHILD MONITORING ACTIVITIES"
  );

  MONITORING_SECTIONS.forEach((section, index) => {
    const records = asArray(monitoring?.[section.key]);

    drawSectionTitle(
      `${index + 1}. ${section.title} (${records.length} ${
        records.length === 1 ? "record" : "records"
      })`
    );

    if (records.length === 0) {
      ensureSpace(9);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);

      doc.text(
        "No records for the selected reporting month.",
        marginLeft + 2,
        y
      );

      y += 9;
      return;
    }

    const headers = section.columns.map(([, label]) => label);

    const rows = records.map((record) =>
      section.columns.map(([field]) => {
        const value = record?.[field];

        return field.endsWith("_date")
          ? formatDate(value)
          : formatValue(value);
      })
    );

    drawTable(headers, rows, {
      fontSize:
        section.columns.length >= 8
          ? 5.3
          : section.columns.length >= 6
            ? 5.8
            : 6.5,
    });
  });

  // =======================================================
  // PREPARED BY
  // =======================================================

  ensureSpace(28);

  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(
    "Prepared by:",
    marginLeft,
    y
  );

  y += 11;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  doc.text(
    getFullName(user),
    marginLeft,
    y
  );

  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(
    "Barangay Nutrition Scholar (BNS)",
    marginLeft,
    y
  );

  // =======================================================
  // PAGE NUMBERS
  // =======================================================

  const totalPages = doc.internal.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    doc.setTextColor(100, 100, 100);

    doc.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - marginRight,
      pageHeight - 8,
      { align: "right" }
    );
  }

  // =======================================================
  // DOWNLOAD PDF
  // =======================================================

  const filename = [
    "BNS_Child_Monthly_Report",
    safeFilename(location.barangayName),
    MONTHS[month - 1],
    year,
  ].join("_") + ".pdf";

  doc.save(filename);
}
