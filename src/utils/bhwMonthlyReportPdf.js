
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";

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

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const number = (value) => Number(value) || 0;

const dateText = (value) => {
  if (!value) return "";

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  );

  return Number.isNaN(date.getTime())
    ? text(value)
    : date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const uniqueNames = (records = []) =>
  [
    ...new Set(
      records
        .map((item) => item.name)
        .filter(Boolean)
    ),
  ];

export async function downloadBhwMonthlyReportPdf({
  report,
  user,
  month,
  year,
  assignedAreas = [],
}) {
  if (!user?.id) {
    throw new Error("BHW user session was not found.");
  }

  // =====================================================
  // INITIALIZE PDF
  // =====================================================

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const left = 13;
  const right = 13;
  const width = pageWidth - left - right;

  // =====================================================
  // 1. GET ACTIVE ASSIGNED AREAS AND DISTRICT
  // =====================================================

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
      .eq("worker_id", user.id)
      .eq("is_active", true);

  if (assignmentError) {
    throw new Error(
      `Unable to load BHW assigned areas: ${assignmentError.message}`
    );
  }

  const activeAssignments = assignments || [];

  const areaIds = [
    ...new Set(
      activeAssignments
        .map((item) => item.local_area_id)
        .filter(
          (id) => id !== null && id !== undefined
        )
    ),
  ];

  const areas = [
    ...new Set(
      activeAssignments
        .map((item) => item.local_areas?.name)
        .filter(Boolean)
    ),
  ];

  const barangays = [
    ...new Set(
      activeAssignments
        .map(
          (item) =>
            item.local_areas?.barangays?.name
        )
        .filter(Boolean)
    ),
  ];

  const districts = [
    ...new Set(
      activeAssignments
        .map(
          (item) =>
            item.local_areas?.barangays?.districts?.name
        )
        .filter(Boolean)
    ),
  ];

  const districtName =
    districts.join(", ") || "Not assigned";

  const barangayName =
    barangays.join(", ") || "Not assigned";

  const catchmentArea =
    areas.join(", ") || "Not assigned";

  // =====================================================
  // 2. GET ACTUAL NUMBER OF HOUSEHOLDS
  // =====================================================

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
        `Unable to count households: ${householdError.message}`
      );
    }

    householdCount = count ?? 0;
  }

  // =====================================================
  // 3. PREPARE REPORT DATA
  // =====================================================

  const fullName = [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const fp = report.family_planning || {};

  const women = report.pregnant_women || [];

  const prenatal = report.prenatal_checkup || {};

  const deliveries = report.deliveries || {};

  const iec = report.iec || {};

  let y = 12;

  // =====================================================
  // 4. PDF HELPER FUNCTIONS
  // =====================================================

  const ensureSpace = (height = 10) => {
    if (y + height > pageHeight - 15) {
      doc.addPage();
      y = 15;
    }
  };

  const section = (numberValue, title) => {
    ensureSpace(12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);

    const lines = doc.splitTextToSize(
      `${numberValue}. ${title}`,
      width
    );

    doc.text(lines, left, y);

    y += lines.length * 4 + 1;
  };

  const line = (label, value = "") => {
    ensureSpace(7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const labelWidth = doc.getTextWidth(label);

    doc.text(label, left + 2, y);

    doc.text(
      text(value),
      left + 4 + labelWidth,
      y
    );

    y += 6;
  };

  const table = (head, body, options = {}) => {
    ensureSpace(15);

    autoTable(doc, {
      startY: y,

      margin: {
        left,
        right,
        top: 15,
        bottom: 15,
      },

      head: [head],

      body: body.length
        ? body
        : [head.map(() => "")],

      theme: "grid",

      styles: {
        font: "helvetica",
        fontSize: options.fontSize || 7,
        cellPadding: 1.5,
        lineColor: [45, 45, 45],
        lineWidth: 0.15,
        textColor: [0, 0, 0],
        valign: "middle",
        overflow: "linebreak",
      },

      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },

      columnStyles: options.columnStyles || {},

      rowPageBreak: "avoid",
    });

    y = doc.lastAutoTable.finalY + 5;
  };

  const blankRows = (rows, columns) =>
    Array.from(
      { length: rows },
      () => Array(columns).fill("")
    );

  // =====================================================
  // 5. OFFICIAL REPORT HEADER
  // =====================================================

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

  // DISTRICT

  doc.setFont("times", "bold");
  doc.setFontSize(9);

  const districtLines = doc.splitTextToSize(
    districtName,
    width
  );

  doc.text(
    districtLines,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += districtLines.length * 4 + 2;

  // REPORT TITLE

  doc.setFont("times", "bold");
  doc.setFontSize(10);

  doc.text(
    "MONTHLY BHW REPORT",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 6;

  // CATCHMENT AREA

  doc.setFont("times", "normal");
  doc.setFontSize(8);

  const catchmentLines = doc.splitTextToSize(
    `Catchment Area: ${catchmentArea}`,
    width
  );

  doc.text(
    catchmentLines,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += catchmentLines.length * 4 + 6;

  // BHW INFORMATION

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(
    `Name: ${fullName}`,
    left,
    y,
    { maxWidth: 96 }
  );

  doc.text(
    `Month: ${MONTHS[month - 1]} ${year}`,
    115,
    y
  );

  y += 6;

  doc.text(
    `Barangay: ${barangayName}`,
    left,
    y,
    { maxWidth: 96 }
  );

  doc.text(
    `Number of Households: ${householdCount}`,
    115,
    y
  );

  y += 9;

  // =====================================================
  // 6. PRENATAL CHECKUPS
  // =====================================================

  section(
    1,
    "Name of pregnant women for prenatal check-up:"
  );

  const first = uniqueNames(
    prenatal.first_trimester
  );

  const second = uniqueNames(
    prenatal.second_trimester
  );

  const third = uniqueNames(
    prenatal.third_trimester
  );

  const maxTrimesterRows = Math.max(
    4,
    first.length,
    second.length,
    third.length
  );

  table(
    [
      "First Trimester",
      "Second Trimester",
      "Third Trimester",
    ],

    Array.from(
      { length: maxTrimesterRows },
      (_, i) => [
        first[i] || "",
        second[i] || "",
        third[i] || "",
      ]
    ),

    { fontSize: 7.5 }
  );

  // =====================================================
  // 7. NUTRITIONAL ASSESSMENT
  // =====================================================

  section(
    2,
    "Name of 1st trimester pregnant women screened for Nutritional Assessment:"
  );

  const nutrition = report.nutrition_assessment;

  const nutritionRows = Array.isArray(nutrition)
    ? nutrition.map((item) => [
        text(item.name),
        text(item.bmi ?? item.bmi_value),
        text(item.low),
        text(item.normal),
        text(item.high),
      ])
    : [];

  table(
    [
      "Name",
      "BMI (value)",
      "Low (<18.5)",
      "Normal (18.5-22.9)",
      "High (>=23.0)",
    ],

    nutritionRows.length
      ? nutritionRows
      : blankRows(3, 5),

    { fontSize: 6.5 }
  );

  // =====================================================
  // 8. TEENAGE PREGNANCY
  // =====================================================

  section(
    3,
    "Name of Teenage Pregnant Women tracked for the month:"
  );

  const teenage = women.filter((woman) => {
    const age = Number(woman.age);

    return (
      Number.isFinite(age) &&
      age >= 10 &&
      age <= 19
    );
  });

  table(
    ["Name", "Age"],

    teenage.length
      ? teenage.map((woman) => [
          woman.name,
          text(woman.age),
        ])
      : blankRows(2, 2)
  );

  // =====================================================
  // 9. PREGNANT DEWORMING
  // =====================================================

  section(
    4,
    "Number of pregnant women given deworming tablet:"
  );

  line(
    "Total: ",
    number(report.pregnant_deworming)
  );

  // =====================================================
  // 10. POSTPARTUM VITAMIN A
  // =====================================================

  section(
    5,
    "Name of postpartum women 1 month given Vitamin A:"
  );

  line(
    "Total: ",
    number(report.postpartum_vitamin_a)
  );

  // =====================================================
  // 11. DELIVERIES
  // =====================================================

  section(
    6,
    "Number of Deliveries this month:"
  );

  const deliveredWomen = women.filter((woman) => {
    const deliveryDate =
      woman.pregnancy_outcome?.date_of_delivery;

    if (!deliveryDate) return false;

    const date = new Date(
      `${String(deliveryDate).slice(0, 10)}T00:00:00`
    );

    return (
      date.getFullYear() === Number(year) &&
      date.getMonth() + 1 === Number(month)
    );
  });

  table(
    [
      "Name",
      "Age",
      "Sex",
      "Weight",
      "Date of Delivery",
      "Type of Delivery",
      "Place",
      "Attendant",
      "TT Status",
    ],

    deliveredWomen.length
      ? deliveredWomen.map((woman) => {
          const outcome =
            woman.pregnancy_outcome || {};

          return [
            woman.name,
            text(woman.age),
            text(outcome.baby_sex),
            text(outcome.birth_weight_kg),
            dateText(outcome.date_of_delivery),
            text(outcome.type_of_delivery),
            text(outcome.place_of_delivery),
            text(outcome.attended_by),
            text(outcome.tt_status),
          ];
        })
      : blankRows(3, 9),

    { fontSize: 5.5 }
  );

  line(
    "Total Deliveries: ",
    number(deliveries.total)
  );

  // =====================================================
  // 12. BREASTFEEDING
  // =====================================================

  const breastfeeding =
    report.breastfeeding || {};

  section(
    7,
    "Number of women initiated breastfeeding:"
  );

  line(
    "Total: ",
    text(
      breastfeeding.initiated_breastfeeding ?? ""
    )
  );

  section(
    8,
    "Number of infants exclusively breastfed:"
  );

  line(
    "Total: ",
    text(
      breastfeeding.exclusively_breastfed ?? ""
    )
  );

  // =====================================================
  // 13. IMMUNIZATION
  // =====================================================

  section(
    9,
    "Number of children given immunization for the month:"
  );

  const immunization =
    report.immunization || {};

  const vaccines = [
    ["BCG", "bcg"],
    ["HEPA B", "hep_b"],
    ["PENTA 1", "penta_1"],
    ["PENTA 2", "penta_2"],
    ["PENTA 3", "penta_3"],
    ["OPV 1", "opv_1"],
    ["OPV 2", "opv_2"],
    ["OPV 3", "opv_3"],
    ["IPV", "ipv"],
    ["PCV 1", "pcv_1"],
    ["PCV 2", "pcv_2"],
    ["PCV 3", "pcv_3"],
    ["MR 1", "mcv_1"],
    ["MR 2", "mcv_2"],
  ];

  table(
    vaccines.map(([label]) => label),

    [
      vaccines.map(([, key]) =>
        immunization[key] === undefined
          ? ""
          : text(immunization[key])
      ),
    ],

    { fontSize: 5 }
  );

  // =====================================================
  // 14. FAMILY PLANNING
  // =====================================================

  section(
    10,
    "FAMILY PLANNING (New Acceptors, Drop-outs and Current Users)"
  );

  const fpMethods = [
    ["BTL", "btl"],
    ["NSV", "nsv"],
    ["Pills COC", "coc"],
    ["Pills POP", "pop"],
    ["IUD", "iud"],
    ["DMPA", "dmpa"],
    ["LAM", "lam"],
    ["Condom", "condom"],
    ["Implant", "implant"],
  ];

  const fpRows = [
    ["New Acceptors", "new_acceptors"],
    ["Drop-out", "dropouts"],
    ["Current Users", "current_users"],
  ].flatMap(([label, key]) =>
    [
      ["15-19 y.o.", "age_15_19"],
      ["20-49 y.o.", "age_20_49"],
    ].map(([ageLabel, ageKey], index) => [
      index === 0 ? label : "",
      ageLabel,
      text(fp[key]?.[ageKey] ?? ""),
      ...fpMethods.map(([, method]) =>
        text(fp[key]?.[method] ?? "")
      ),
    ])
  );

  table(
    [
      "Category",
      "Age",
      "Total",
      ...fpMethods.map(([label]) => label),
    ],

    fpRows,

    { fontSize: 5.5 }
  );

  // =====================================================
  // 15. WRA DEWORMING
  // =====================================================

  section(
    11,
    "Number of WRA given deworming tablet:"
  );

  line(
    "Total: ",
    number(report.women_deworming)
  );

  // =====================================================
  // 16. CONSULTATION REFERRALS
  // =====================================================

  section(
    12,
    "Number of patients referred for consultation:"
  );

  line(
    "Total: ",
    number(report.consultation_referrals)
  );

  // =====================================================
  // 17. IEC
  // =====================================================

  section(13, "IEC:");

  table(
    [
      "Individual Health Counseling",
      "Bench Conference",
      "Household Study Group",
      "Care Givers Class",
    ],

    [
      [
        number(iec.individual_health_counseling),
        number(iec.bench_conference),
        number(iec.household_study_group),
        number(iec.care_giver_class),
      ],
    ]
  );

  // =====================================================
  // 18. TB-DOTS REFERRALS
  // =====================================================

  section(
    14,
    "Number of patients referred for TB-DOTS:"
  );

  line(
    "Total: ",
    number(report.tb_dots_referrals)
  );

  // =====================================================
  // 19. AGENCIES COORDINATED
  // =====================================================

  section(
    15,
    "Agencies coordinated this month:"
  );

  const agencies = doc.splitTextToSize(
    text(report.agencies_coordinated) ||
      "________________________",
    width - 5
  );

  ensureSpace(agencies.length * 4 + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(
    agencies,
    left + 2,
    y
  );

  y += agencies.length * 4 + 5;

  // =====================================================
  // 20. DEATHS
  // =====================================================

  section(16, "Deaths:");

  table(
    [
      "Name",
      "Age",
      "Sex",
      "Date of Death",
      "Causes",
    ],

    (report.deaths || []).length
      ? report.deaths.map((death) => [
          text(death.name),
          text(death.age),
          text(death.sex),
          dateText(death.date_of_death),
          text(death.cause ?? death.causes),
        ])
      : blankRows(2, 5)
  );

  // =====================================================
  // 21. PREPARED BY
  // =====================================================

  ensureSpace(28);

  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(
    "Prepared by:",
    left,
    y
  );

  y += 10;

  doc.setFont("helvetica", "bold");

  doc.text(
    fullName || "________________________",
    left,
    y
  );

  y += 4;

  doc.setFont("helvetica", "normal");

  doc.text(
    "Barangay Health Worker (BHW)",
    left,
    y
  );

  // =====================================================
  // 22. PAGE NUMBERS
  // =====================================================

  const pages =
    doc.internal.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    doc.text(
      `Page ${i} of ${pages}`,
      pageWidth - right,
      pageHeight - 8,
      { align: "right" }
    );
  }

  // =====================================================
  // 23. DOWNLOAD PDF
  // =====================================================

  const filename =
    `BHW_Monthly_Report_${MONTHS[month - 1]}_${year}.pdf`;

  doc.save(filename);
}
