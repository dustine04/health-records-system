
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

const AGE_GROUPS = [
  ["age_0_11", "0-11 months"],
  ["age_0_12", "0-12 months"],
  ["age_13_23", "13-23 months"],
  ["age_24_59", "24-59 months"],
];

const CHILD_METRICS = [
  ["male", "Male"],
  ["female", "Female"],
  ["deceased_male", "Deceased male"],
  ["deceased_female", "Deceased female"],
  ["trans_out_male", "Transferred-out male"],
  ["trans_out_female", "Transferred-out female"],
];

const MATERNAL_SECTIONS = [
  [
    "pregnancy_tracking",
    "Pregnancy tracking",
    [
      ["new", "New pregnancies"],
      ["total", "Total pregnancies"],
      ["last_month", "Pregnancies from last month"],
      ["mc_book", "With MC book"],
      ["birth_plan", "With birth plan"],
      ["completed_home_visits", "Completed pregnancy home visits"],
    ],
  ],
  [
    "deliveries",
    "Deliveries",
    [
      ["total", "Total deliveries"],
      ["with_pnv4", "With PNV4"],
      ["home_delivery", "Home deliveries"],
      ["at_health_facility", "Health facility deliveries"],
      ["with_completed_4_hv", "Completed four home visits"],
    ],
  ],
  [
    "breastfeeding",
    "Breastfeeding",
    [
      ["initiated_breastfeeding", "Initiated breastfeeding"],
      ["exclusively_breastfed", "Exclusively breastfed"],
    ],
  ],
  [
    "postpartum",
    "Postpartum",
    [
      ["pregnant_next_month", "Pregnant again following month"],
      ["fp_completed_home_visit", "Family planning home visits completed"],
    ],
  ],
  [
    "iec",
    "Information, education and communication",
    [
      ["bench_conference", "Bench conferences"],
      ["care_giver_class", "Caregiver classes"],
      ["household_study_group", "Household study groups"],
      ["individual_health_counseling", "Individual health counseling"],
    ],
  ],
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
  ["age_15_19", "Age 15-19"],
  ["age_20_49", "Age 20-49"],
];

const RECORDS = [
  ["pregnant_women", "Pregnant women"],
  ["deaths", "Deaths"],
  ["delivery_details", "Delivery details"],
  ["women_deworming", "Women deworming"],
  ["pregnant_deworming", "Pregnant women deworming"],
  ["tb_dots_referrals", "TB-DOTS referrals"],
  ["teenage_pregnancy", "Teenage pregnancies"],
  ["agencies_coordinated", "Agencies coordinated"],
  ["nutrition_assessment", "Nutrition assessments"],
  ["postpartum_vitamin_a", "Postpartum vitamin A"],
  ["consultation_referrals", "Consultation referrals"],
];

/* =========================================================
   HELPERS
========================================================= */

const count = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

const safe = (value) =>
  String(value || "District").replace(/[^a-z0-9_-]+/gi, "_");

/* =========================================================
   LOAD HEADER ICON

   Place header_icon.png in:
   public/header_icon.png
========================================================= */

async function getHeaderImage() {
  const url = `${
    import.meta.env.BASE_URL || "/"
  }header_icon.png`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Cannot load ${url}. Put header_icon.png in public/header_icon.png.`
    );
  }

  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () =>
      reject(new Error("Could not read header_icon.png"));

    reader.readAsDataURL(blob);
  });
}

/* =========================================================
   MAIN PDF GENERATOR
========================================================= */

export async function downloadMidwifeNurseFhsisPdf({
  month,
  year,
  districtName,
  midwifeName,
  nurseName,
  bnsTotals,
  bhwTotals,
  bnsCount = 0,
  bhwCount = 0,
}) {
  const iconData = await getHeaderImage();

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const left = 12;
  const right = 12;

  const monthName =
    MONTHS[Number(month) - 1] || String(month);

  const tableMargin = {
    left,
    right,
    top: 43,
    bottom: 15,
  };

  let y = 45;

  /* =======================================================
     HEADER
  ======================================================= */

  const drawHeader = () => {
    pdf.setDrawColor(40);
    pdf.setLineWidth(0.3);

    pdf.rect(10, 8, W - 20, 30);

    pdf.line(W - 38, 8, W - 38, 38);

    // Official header icon
    pdf.addImage(iconData, "PNG", 14, 11, 22, 22);

    pdf.setTextColor(15);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);

    pdf.text(
      "FHSIS REPORTING YEAR: " + year,
      40,
      15
    );

    pdf.setFontSize(9);

    pdf.text(
      "FIELD HEALTH SERVICES INFORMATION SYSTEM",
      40,
      21
    );

    pdf.setFontSize(8);

    pdf.text(
      "District Consolidated Maternal and Child Health Indicators",
      40,
      26
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);

    pdf.text(
      `Reporting period: ${monthName} ${year}   |   District: ${
        districtName || "-"
      }`,
      40,
      32
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(25);

    pdf.text("A1", W - 24, 29, {
      align: "center",
    });
  };

  /* =======================================================
     SECTION HEADING
  ======================================================= */

  const heading = (title) => {
    if (y > H - 30) {
      pdf.addPage();
      y = 45;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0);

    pdf.text(title, left, y);

    y += 4;
  };

  /* =======================================================
     TABLE GENERATOR
  ======================================================= */

  const table = (head, body, widths = {}) => {
    autoTable(pdf, {
      startY: y,

      head: [head],

      body,

      theme: "grid",

      margin: tableMargin,

      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: 20,
        lineColor: 90,
        lineWidth: 0.15,
        overflow: "linebreak",
      },

      headStyles: {
        fillColor: [229, 234, 232],
        textColor: 15,
        fontStyle: "bold",
      },

      columnStyles: widths,

      didDrawPage: () => {},
    });

    y = (pdf.lastAutoTable?.finalY || y) + 8;
  };

  /* =======================================================
     REPORT INFORMATION
  ======================================================= */

  heading("REPORT INFORMATION");

  table(
    [
      "District",
      "Prepared by (Midwife)",
      "Submitted to (Nurse)",
      "BNS sources",
      "BHW sources",
    ],
    [
      [
        districtName || "-",
        midwifeName || "-",
        nurseName || "Not selected",
        bnsCount,
        bhwCount,
      ],
    ]
  );

  /* =======================================================
     SECTION I - CHILD HEALTH AND NUTRITION
  ======================================================= */

  heading(
    "SECTION I. CHILD HEALTH AND NUTRITION INDICATORS"
  );

  table(
    [
      "Age group",
      "Male",
      "Female",
      "Deceased male",
      "Deceased female",
      "Transferred-out male",
      "Transferred-out female",
    ],
    AGE_GROUPS.map(([key, label]) => [
      label,
      ...CHILD_METRICS.map(([field]) =>
        count(bnsTotals?.[key]?.[field])
      ),
    ])
  );

  pdf.setFontSize(7);
  pdf.setFont("helvetica", "italic");

  if (y > H - 20) {
    pdf.addPage();
    y = 45;
  }

  pdf.text(
    "Note: The 0-11 and 0-12 month groups overlap; do not sum them as unique children.",
    left,
    y
  );

  y += 9;

  /* =======================================================
     SECTION II - MATERNAL AND COMMUNITY HEALTH
  ======================================================= */

  heading(
    "SECTION II. MATERNAL AND COMMUNITY HEALTH INDICATORS"
  );

  for (const [key, label, fields] of MATERNAL_SECTIONS) {
    heading(label);

    table(
      ["Indicator", "Total"],
      fields.map(([field, name]) => [
        name,
        count(bhwTotals?.[key]?.[field]),
      ]),
      {
        0: {
          cellWidth: 185,
        },
      }
    );
  }

  /* =======================================================
     FAMILY PLANNING
  ======================================================= */

  heading("FAMILY PLANNING INDICATORS");

  table(
    [
      "Method or age group",
      "Current users",
      "New acceptors",
      "Dropouts",
    ],
    FP_METHODS.map(([key, label]) => [
      label,
      ...[
        "current_users",
        "new_acceptors",
        "dropouts",
      ].map((group) =>
        count(
          bhwTotals?.family_planning?.[group]?.[key]
        )
      ),
    ])
  );

  /* =======================================================
     DETAILED RECORD COUNTS
  ======================================================= */

  heading("DETAILED RECORD COUNTS");

  table(
    ["Record category", "Count"],
    [
      ...RECORDS.map(([key, label]) => [
        label,
        count(bhwTotals?.records?.[key]),
      ]),

      ...[
        [
          "first_trimester",
          "First trimester prenatal entries",
        ],
        [
          "second_trimester",
          "Second trimester prenatal entries",
        ],
        [
          "third_trimester",
          "Third trimester prenatal entries",
        ],
      ].map(([key, label]) => [
        label,
        count(bhwTotals?.prenatal_checkup?.[key]),
      ]),
    ],
    {
      0: {
        cellWidth: 185,
      },
    }
  );

  /* =======================================================
     REPORTING NOTES
  ======================================================= */

  heading("REPORTING NOTES");

  const notes = [
    "Totals reflect only the approved BNS and reviewed BHW reports selected by the application.",
    "Counts of individual record entries are not necessarily counts of unique people.",
    "This is a system-generated district consolidation, not a complete official FHSIS A1 form.",
  ];

  for (const note of notes) {
    if (y > H - 20) {
      pdf.addPage();
      y = 45;
    }

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");

    pdf.text(`- ${note}`, left, y);

    y += 5;
  }

  /* =======================================================
     REPEAT HEADER AND FOOTER ON EVERY PAGE
  ======================================================= */

  const pages = pdf.internal.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);

    drawHeader();

    pdf.setDrawColor(130);

    pdf.line(
      left,
      H - 11,
      W - right,
      H - 11
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(80);

    pdf.text(
      `MCHMS | ${monthName} ${year}`,
      left,
      H - 7
    );

    pdf.text(
      `Page ${i} of ${pages}`,
      W - right,
      H - 7,
      {
        align: "right",
      }
    );
  }

  /* =======================================================
     DOWNLOAD PDF
  ======================================================= */

  pdf.save(
    `FHSIS_A1_${safe(districtName)}_${monthName}_${year}.pdf`
  );
}
