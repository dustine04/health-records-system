
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const AGE = [
  ["age_0_11", "0–11 months"],
  ["age_0_12", "0–12 months"],
  ["age_13_23", "13–23 months"],
  ["age_24_59", "24–59 months"],
];

const CHILD_FIELDS = [
  "male",
  "female",
  "deceased_male",
  "deceased_female",
  "trans_out_male",
  "trans_out_female",
];

const MATERNAL = [
  [
    "pregnancy_tracking",
    "Pregnancy Tracking",
    [
      "new",
      "total",
      "last_month",
      "mc_book",
      "birth_plan",
      "completed_home_visits",
    ],
  ],
  [
    "deliveries",
    "Deliveries",
    [
      "total",
      "with_pnv4",
      "home_delivery",
      "at_health_facility",
      "with_completed_4_hv",
    ],
  ],
  [
    "breastfeeding",
    "Breastfeeding",
    [
      "initiated_breastfeeding",
      "exclusively_breastfed",
    ],
  ],
  [
    "postpartum",
    "Postpartum",
    [
      "pregnant_next_month",
      "fp_completed_home_visit",
    ],
  ],
  [
    "iec",
    "Health Education and Counseling",
    [
      "bench_conference",
      "care_giver_class",
      "household_study_group",
      "individual_health_counseling",
    ],
  ],
];

const FP_METHODS = [
  "btl",
  "coc",
  "iud",
  "lam",
  "nsv",
  "pop",
  "dmpa",
  "condom",
  "implant",
  "age_15_19",
  "age_20_49",
];

const FP_GROUPS = [
  "current_users",
  "new_acceptors",
  "dropouts",
];

const PRENATAL = [
  "first_trimester",
  "second_trimester",
  "third_trimester",
];

const RECORDS = [
  "pregnant_women",
  "deaths",
  "delivery_details",
  "women_deworming",
  "pregnant_deworming",
  "tb_dots_referrals",
  "teenage_pregnancy",
  "agencies_coordinated",
  "nutrition_assessment",
  "postpartum_vitamin_a",
  "consultation_referrals",
];

const readable = (value) =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const number = (value) => Number(value) || 0;

export async function downloadChoMonthlyFhsisPdf({
  month,
  year,
  cityTotals,
  districtRows,
  districtCount,
}) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const monthName = MONTHS[month - 1] || String(month);

  let y = 36;

  // =====================================================
  // TABLE HELPER
  // =====================================================

  const table = (head, body) => {
    autoTable(pdf, {
      startY: y,
      head: [head],
      body,
      theme: "grid",

      margin: {
        left: 14,
        right: 14,
        top: 37,
        bottom: 17,
      },

      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        overflow: "linebreak",
      },

      headStyles: {
        fillColor: [225, 232, 240],
        textColor: [25, 35, 55],
      },
    });

    y = pdf.lastAutoTable.finalY + 8;
  };

  // =====================================================
  // SECTION HEADING HELPER
  // =====================================================

  const heading = (value) => {
    if (y > pageHeight - 28) {
      pdf.addPage();
      y = 38;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(25, 35, 55);

    pdf.text(value, 14, y);

    y += 5;
  };

  // =====================================================
  // I. APPROVED DISTRICT CONTRIBUTIONS
  // =====================================================

  heading("I. Approved District Contributions");

  table(
    [
      "District",
      "Report ID",
      "BNS Sources",
      "BHW Sources",
      "Pregnancies",
      "Deliveries",
    ],
    districtRows.map(({ report, districtName, totals }) => [
      districtName,
      `FHSIS-${report.id}`,
      totals.bnsSources,
      totals.bhwSources,
      number(totals.bhw.pregnancy_tracking?.total),
      number(totals.bhw.deliveries?.total),
    ])
  );

  // =====================================================
  // II. CHILD HEALTH AND NUTRITION
  // =====================================================

  heading("II. Child Health and Nutrition");

  table(
    [
      "Age Group",
      ...CHILD_FIELDS.map(readable),
    ],
    AGE.map(([key, label]) => [
      label,
      ...CHILD_FIELDS.map((field) =>
        number(cityTotals.bns[key]?.[field])
      ),
    ])
  );

  // =====================================================
  // III. MATERNAL AND COMMUNITY HEALTH
  // =====================================================

  heading("III. Maternal and Community Health");

  for (const [key, title, fields] of MATERNAL) {
    heading(title);

    table(
      ["Indicator", "Citywide Total"],
      fields.map((field) => [
        readable(field),
        number(cityTotals.bhw[key]?.[field]),
      ])
    );
  }

  // =====================================================
  // IV. FAMILY PLANNING
  // =====================================================

  heading("IV. Family Planning");

  table(
    [
      "Method / Category",
      ...FP_GROUPS.map(readable),
    ],
    FP_METHODS.map((method) => [
      readable(method),
      ...FP_GROUPS.map((group) =>
        number(
          cityTotals.bhw.family_planning?.[group]?.[method]
        )
      ),
    ])
  );

  // =====================================================
  // V. PRENATAL CHECKUPS
  // =====================================================

  heading("V. Prenatal Checkups");

  table(
    ["Trimester", "Entries"],
    PRENATAL.map((field) => [
      readable(field),
      number(cityTotals.bhw.prenatal_checkup?.[field]),
    ])
  );

  // =====================================================
  // VI. OTHER COMMUNITY HEALTH RECORD COUNTS
  // =====================================================

  heading("VI. Other Community Health Record Counts");

  table(
    ["Category", "Entries"],
    RECORDS.map((field) => [
      readable(field),
      number(cityTotals.bhw.records?.[field]),
    ])
  );

  // =====================================================
  // REPORTING NOTES
  // =====================================================

  heading("Reporting Notes");

  const notes = [
    `Final-approved districts: ${districtRows.length} of ${districtCount} registered districts.`,

    `Source reports included: ${cityTotals.bnsSources} BNS and ${cityTotals.bhwSources} BHW.`,

    "Only final CHO-approved reports for the selected month and year are included.",

    "0-11 and 0-12 month categories overlap. Do not sum age bands as unique children.",

    "Record counts are not necessarily unique individuals; confirm figures before official use.",

    "This system-generated summary is not a replacement for a prescribed official FHSIS form.",
  ];

  for (const note of notes) {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = 38;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    pdf.text(`- ${note}`, 14, y);

    y += 5;
  }

  // =====================================================
  // PAGE HEADERS AND FOOTERS
  // =====================================================

  const pages = pdf.internal.getNumberOfPages();

  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);

    pdf.setFillColor(240, 244, 249);

    pdf.rect(0, 0, pageWidth, 30, "F");

    pdf.setTextColor(20, 40, 70);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);

    pdf.text(
      "CITY HEALTH OFFICE - ORMOC CITY",
      14,
      12
    );

    pdf.setFontSize(10);

    pdf.text(
      `CITYWIDE CONSOLIDATED FHSIS | ${monthName} ${year}`,
      14,
      19
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    pdf.text(
      "Maternal, Child Health and Community Health Indicators",
      14,
      25
    );

    pdf.setDrawColor(190);

    pdf.line(
      14,
      pageHeight - 13,
      pageWidth - 14,
      pageHeight - 13
    );

    pdf.text(
      `MCHMS | ${monthName} ${year}`,
      14,
      pageHeight - 8
    );

    pdf.text(
      `Page ${page} of ${pages}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: "right" }
    );
  }

  // =====================================================
  // DOWNLOAD PDF
  // =====================================================

  pdf.save(
    `CHO_Citywide_FHSIS_${monthName}_${year}.pdf`
  );
}
