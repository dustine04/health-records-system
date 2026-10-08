import { useEffect, useMemo, useState } from "react";
import {
  Baby,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function getFullName(user) {
  return [user?.first_name, user?.middle_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
}

/*
  Calculate completed age in months on the LAST DAY
  of the selected reporting month.
*/
function getAgeInMonthsAtReportEnd(birthDate, year, month) {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birth.getTime())) return null;

  // Last day of selected month
  const reportEnd = new Date(year, month, 0, 23, 59, 59);

  let months =
    (reportEnd.getFullYear() - birth.getFullYear()) * 12 +
    (reportEnd.getMonth() - birth.getMonth());

  if (reportEnd.getDate() < birth.getDate()) {
    months -= 1;
  }

  return Math.max(months, 0);
}

function createEmptyCategory() {
  return {
    male: 0,
    female: 0,
    trans_out_male: 0,
    trans_out_female: 0,
    deceased_male: 0,
    deceased_female: 0,
  };
}

function createEmptyReportData() {
  return {
    age_0_11: createEmptyCategory(),
    age_0_12: createEmptyCategory(),
    age_13_23: createEmptyCategory(),
    age_24_59: createEmptyCategory(),
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function BnsChildMonthlyReport() {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [children, setChildren] = useState([]);

  const [barangays, setBarangays] = useState([]);
  const [localAreas, setLocalAreas] = useState([]);

  const [selectedBarangayId, setSelectedBarangayId] = useState("");

  const [reportMonth, setReportMonth] = useState(getCurrentMonth());
  const [reportYear, setReportYear] = useState(getCurrentYear());

  const [reportId, setReportId] = useState(null);

  const [status, setStatus] = useState("draft");

  const [reviewNotes, setReviewNotes] = useState("");

  const [reportData, setReportData] = useState(createEmptyReportData());

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  /* =======================================================
     LOAD USER
  ======================================================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      setUser(parsedUser);
    } catch (error) {
      console.error("Unable to parse logged-in user:", error);

      setLoading(false);
    }
  }, []);

  /* =======================================================
     LOAD BNS ASSIGNED AREAS
  ======================================================= */

  useEffect(() => {
    if (!user?.id) return;

    loadAssignedAreas();
  }, [user]);

  /* =======================================================
     LOAD REPORT WHEN FILTER CHANGES
  ======================================================= */

  useEffect(() => {
    if (!user?.id || !selectedBarangayId) {
      return;
    }

    loadExistingReport();
  }, [user, selectedBarangayId, reportMonth, reportYear]);

  /* =======================================================
     FETCH ASSIGNED AREAS
  ======================================================= */

  async function loadAssignedAreas() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("worker_area_assignments")
        .select(
          `
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

      if (error) {
        throw error;
      }

      const uniqueBarangays = new Map();
      const uniqueLocalAreas = new Map();

      (data || []).forEach((assignment) => {
        const localArea = assignment.local_areas;
        const barangay = localArea?.barangays;

        /* -----------------------------------------------
           LOCAL AREA
        ------------------------------------------------ */

        if (localArea?.id) {
          uniqueLocalAreas.set(String(localArea.id), {
            id: localArea.id,
            name: localArea.name,
            type: localArea.type,
            barangay_id: barangay?.id,
            barangay_name: barangay?.name,
          });
        }

        /* -----------------------------------------------
           BARANGAY
        ------------------------------------------------ */

        if (barangay?.id) {
          uniqueBarangays.set(String(barangay.id), barangay);
        }
      });

      const barangayList = Array.from(uniqueBarangays.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );

      const localAreaList = Array.from(uniqueLocalAreas.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );

      setBarangays(barangayList);
      setLocalAreas(localAreaList);

      if (barangayList.length > 0) {
        setSelectedBarangayId(String(barangayList[0].id));
      } else {
        setSelectedBarangayId("");
        setChildren([]);
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message || "Unable to load your assigned barangays.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     FETCH CHILDREN FOR SELECTED BARANGAY
  ======================================================= */

  async function loadChildren() {
    if (!user?.id || !selectedBarangayId) {
      setChildren([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      /* ---------------------------------------------------
         1. Get BNS assigned local areas
      --------------------------------------------------- */

      const { data: assignments, error: assignmentError } = await supabase
        .from("worker_area_assignments")
        .select(
          `
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

      const assignedAreaIds = (assignments || [])
        .filter(
          (item) =>
            String(item.local_areas?.barangays?.id) ===
            String(selectedBarangayId),
        )
        .map((item) => item.local_area_id)
        .filter(Boolean);

      if (assignedAreaIds.length === 0) {
        setChildren([]);
        return;
      }

      /* ---------------------------------------------------
         2. Get households
      --------------------------------------------------- */

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
        .in("local_area_id", assignedAreaIds);

      if (householdError) {
        throw householdError;
      }

      const householdIds = (households || [])
        .map((household) => household.id)
        .filter(Boolean);

      if (householdIds.length === 0) {
        setChildren([]);
        return;
      }

      /* ---------------------------------------------------
         3. Get residents
      --------------------------------------------------- */

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
        .in("household_id", householdIds);

      if (residentError) {
        throw residentError;
      }

      /* ---------------------------------------------------
         4. Keep children below 5 years old
      --------------------------------------------------- */

      const reportChildren = (residents || []).filter((resident) => {
        if (!resident.birth_date) return false;

        const ageMonths = getAgeInMonthsAtReportEnd(
          resident.birth_date,
          reportYear,
          reportMonth,
        );

        return ageMonths !== null && ageMonths >= 0 && ageMonths <= 59;
      });

      setChildren(reportChildren);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message || "Unable to load children for this report.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     LOAD CHILDREN WHEN BARANGAY/MONTH/YEAR CHANGES
  ======================================================= */

  useEffect(() => {
    if (!user?.id || !selectedBarangayId) {
      return;
    }

    loadChildren();
  }, [user, selectedBarangayId, reportMonth, reportYear]);

  /* =======================================================
     CALCULATE AUTOMATIC POPULATION
  ======================================================= */

  const calculatedData = useMemo(() => {
    const data = createEmptyReportData();

    children.forEach((child) => {
      const ageMonths = getAgeInMonthsAtReportEnd(
        child.birth_date,
        reportYear,
        reportMonth,
      );

      if (ageMonths === null || ageMonths < 0 || ageMonths > 59) {
        return;
      }

      const sex = String(child.sex || "").toLowerCase();

      const isMale = sex === "male" || sex === "m";

      const isFemale = sex === "female" || sex === "f";

      /*
        The paper form has overlapping
        0–11 and 0–12 categories.

        Therefore:
        0–11 -> included in both
        12   -> only 0–12
        13–23
        24–59
      */

      if (ageMonths <= 11) {
        if (isMale) {
          data.age_0_11.male += 1;
        }

        if (isFemale) {
          data.age_0_11.female += 1;
        }
      }

      if (ageMonths <= 12) {
        if (isMale) {
          data.age_0_12.male += 1;
        }

        if (isFemale) {
          data.age_0_12.female += 1;
        }
      }

      if (ageMonths >= 13 && ageMonths <= 23) {
        if (isMale) {
          data.age_13_23.male += 1;
        }

        if (isFemale) {
          data.age_13_23.female += 1;
        }
      }

      if (ageMonths >= 24 && ageMonths <= 59) {
        if (isMale) {
          data.age_24_59.male += 1;
        }

        if (isFemale) {
          data.age_24_59.female += 1;
        }
      }
    });

    return data;
  }, [children, reportMonth, reportYear]);

  /* =======================================================
     LOAD EXISTING REPORT
  ======================================================= */

  async function loadExistingReport() {
    if (!user?.id || !selectedBarangayId) {
      return;
    }

    try {
      setMessage("");
      setErrorMessage("");

      /*
        IMPORTANT:

        Every combination of:

        BNS
        + Barangay
        + Month
        + Year

        represents ONE monthly report.

        If that combination doesn't exist,
        we reset the page to a fresh draft.
      */

      const { data, error } = await supabase
        .from("bns_child_monthly_reports")
        .select("*")
        .eq("bns_id", user.id)
        .eq("barangay_id", selectedBarangayId)
        .eq("report_month", reportMonth)
        .eq("report_year", reportYear)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        /* -----------------------------------------------
           EXISTING REPORT
        ------------------------------------------------ */

        setReportId(data.id);

        setStatus(data.status || "draft");

        setReportData({
          ...createEmptyReportData(),
          ...(data.report_data || {}),
        });

        setReviewNotes(data.review_notes || "");
      } else {
        /* -----------------------------------------------
           NEW MONTH / NEW REPORT
        ------------------------------------------------ */

        setReportId(null);

        setStatus("draft");

        setReviewNotes("");

        setReportData(createEmptyReportData());
      }
    } catch (error) {
      console.error(error);

      /*
        PGRST116 means no row was found.
      */

      if (error?.code === "PGRST116") {
        setReportId(null);

        setStatus("draft");

        setReviewNotes("");

        setReportData(createEmptyReportData());

        return;
      }

      setErrorMessage(error.message || "Unable to load the existing report.");
    }
  }

  /* =======================================================
     DISPLAY DATA
  ======================================================= */

  const displayData = useMemo(() => {
    const result = createEmptyReportData();

    Object.keys(result).forEach((category) => {
      result[category] = {
        ...result[category],

        /*
            Automatic values
          */

        male: calculatedData[category]?.male || 0,

        female: calculatedData[category]?.female || 0,

        /*
            Manual values
          */

        trans_out_male: Number(reportData[category]?.trans_out_male || 0),

        trans_out_female: Number(reportData[category]?.trans_out_female || 0),

        deceased_male: Number(reportData[category]?.deceased_male || 0),

        deceased_female: Number(reportData[category]?.deceased_female || 0),
      };
    });

    return result;
  }, [calculatedData, reportData]);

  /* =======================================================
     UPDATE MANUAL FIELD
  ======================================================= */

  function updateManualField(category, field, value) {
    const numericValue = value === "" ? 0 : Math.max(0, Number(value) || 0);

    setReportData((previous) => ({
      ...previous,

      [category]: {
        ...previous[category],

        [field]: numericValue,
      },
    }));
  }

  /* =======================================================
     SAVE / UPSERT REPORT
  ======================================================= */

  async function saveReport(nextStatus = "draft") {
    if (!user?.id) {
      alert("Unable to identify the logged-in BNS.");

      return;
    }

    if (!selectedBarangayId) {
      alert("Please select a barangay.");

      return;
    }

    /*
      Approved reports cannot be edited.

      IMPORTANT:
      This only blocks SAVE/SUBMIT.

      It does NOT block the Month/Year/Barangay
      selectors anymore.
    */

    if (status === "approved") {
      alert("This report has already been approved and cannot be edited.");

      return;
    }

    /*
      Submitted reports are also locked.
    */

    if (status === "submitted" && nextStatus !== "draft") {
      alert(
        "This report has already been submitted and is waiting for Midwife review.",
      );

      return;
    }

    try {
      setSaving(true);

      setMessage("");

      setErrorMessage("");

      /*
        Combine automatic population with
        manually entered values.
      */

      const snapshot = {
        ...displayData,
      };

      const payload = {
        bns_id: user.id,

        barangay_id: Number.isNaN(Number(selectedBarangayId))
          ? selectedBarangayId
          : Number(selectedBarangayId),

        report_month: Number(reportMonth),

        report_year: Number(reportYear),

        status: nextStatus,

        report_data: snapshot,

        submitted_at:
          nextStatus === "submitted" ? new Date().toISOString() : null,

        updated_at: new Date().toISOString(),
      };

      let result;

      /* ---------------------------------------------------
         UPDATE EXISTING REPORT
      --------------------------------------------------- */

      if (reportId) {
        result = await supabase
          .from("bns_child_monthly_reports")
          .update(payload)
          .eq("id", reportId)
          .select()
          .single();
      } else {

      /* ---------------------------------------------------
         INSERT NEW REPORT
      --------------------------------------------------- */
        result = await supabase
          .from("bns_child_monthly_reports")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      setReportId(result.data.id);

      setStatus(result.data.status);

      setReportData(result.data.report_data || snapshot);

      if (nextStatus === "submitted") {
        setMessage(
          "Monthly child report successfully submitted to the Midwife.",
        );
      } else {
        setMessage("Monthly child report saved as draft.");
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(error.message || "Unable to save the monthly report.");
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     HANDLE SAVE DRAFT
  ======================================================= */

  async function handleSaveDraft() {
    await saveReport("draft");
  }

  /* =======================================================
     HANDLE SUBMIT
  ======================================================= */

  async function handleSubmit() {
    const confirmed = window.confirm(
      "Are you sure you want to submit this monthly child report to the Midwife? You will not be able to edit this report while it is under review.",
    );

    if (!confirmed) {
      return;
    }

    await saveReport("submitted");
  }

  /* =======================================================
     RETURNED REPORT → RESUBMIT
  ======================================================= */

  async function handleResubmit() {
    const confirmed = window.confirm(
      "This report was returned by the Midwife. Do you want to save your corrections and resubmit it?",
    );

    if (!confirmed) {
      return;
    }

    await saveReport("submitted");
  }

  /* =======================================================
     MONTH NAME
  ======================================================= */

  const monthName = new Date(reportYear, reportMonth - 1, 1).toLocaleString(
    "en-US",
    {
      month: "long",
    },
  );

  /* =======================================================
     SELECTED BARANGAY
  ======================================================= */

  const selectedBarangay = barangays.find(
    (barangay) => String(barangay.id) === String(selectedBarangayId),
  );

  /* =======================================================
     SELECTED LOCAL AREAS
  ======================================================= */

  const selectedLocalAreas = localAreas.filter(
    (area) => String(area.barangay_id) === String(selectedBarangayId),
  );

  /* =======================================================
     LOCAL AREA DISPLAY
  ======================================================= */

  const localAreaDisplay =
    selectedLocalAreas.length > 0
      ? selectedLocalAreas
          .map((area) => {
            const type = area.type ? `${area.type}: ` : "";

            return `${type}${area.name}`;
          })
          .join(", ")
      : "No assigned Purok/Sitio";

  /* =======================================================
     IMPORTANT:

     Month/Year/Barangay filters are ALWAYS ENABLED.

     The report itself becomes locked when submitted
     or approved.

     This allows the BNS to move from:

     October → November
     November → December
     etc.

     even when October is already approved.
  ======================================================= */

  const reportLocked = status === "submitted" || status === "approved";

  /* =======================================================
     STATUS BADGE
  ======================================================= */

  function StatusBadge() {
    const styles = {
      draft: "bg-gray-100 text-gray-700",

      submitted: "bg-blue-100 text-blue-700",

      returned: "bg-orange-100 text-orange-700",

      approved: "bg-green-100 text-green-700",
    };

    const labels = {
      draft: "Draft",

      submitted: "Submitted to Midwife",

      returned: "Returned for Correction",

      approved: "Approved",
    };

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
          styles[status] || styles.draft
        }`}
      >
        {status === "approved" ? (
          <CheckCircle2 size={14} />
        ) : status === "returned" ? (
          <RotateCcw size={14} />
        ) : (
          <FileCheck2 size={14} />
        )}

        {labels[status] || "Draft"}
      </span>
    );
  }

  /* =======================================================
     REPORT ROW
  ======================================================= */

  function ReportRow({ category, label }) {
    /*
      Lock only the actual report fields.

      The Month / Year / Barangay
      selectors remain available.
    */

    const disabled = reportLocked;

    const row = displayData[category];

    return (
      <tr className="border-t border-gray-200">
        <td className="px-4 py-4 font-semibold text-gray-800">{label}</td>

        {/* AUTOMATIC MALE */}

        <td className="px-3 py-4 text-center">
          <span className="inline-flex min-w-[60px] justify-center rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-700">
            {row.male}
          </span>
        </td>

        {/* AUTOMATIC FEMALE */}

        <td className="px-3 py-4 text-center">
          <span className="inline-flex min-w-[60px] justify-center rounded-lg bg-pink-50 px-3 py-2 font-semibold text-pink-700">
            {row.female}
          </span>
        </td>

        {/* TRANS OUT MALE */}

        <td className="px-3 py-4">
          <input
            type="number"
            min="0"
            value={row.trans_out_male}
            disabled={disabled}
            onChange={(e) =>
              updateManualField(category, "trans_out_male", e.target.value)
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </td>

        {/* TRANS OUT FEMALE */}

        <td className="px-3 py-4">
          <input
            type="number"
            min="0"
            value={row.trans_out_female}
            disabled={disabled}
            onChange={(e) =>
              updateManualField(category, "trans_out_female", e.target.value)
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </td>

        {/* DECEASED MALE */}

        <td className="px-3 py-4">
          <input
            type="number"
            min="0"
            value={row.deceased_male}
            disabled={disabled}
            onChange={(e) =>
              updateManualField(category, "deceased_male", e.target.value)
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </td>

        {/* DECEASED FEMALE */}

        <td className="px-3 py-4">
          <input
            type="number"
            min="0"
            value={row.deceased_female}
            disabled={disabled}
            onChange={(e) =>
              updateManualField(category, "deceased_female", e.target.value)
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </td>
      </tr>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ===================================================
            HEADER
        ================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <Baby size={28} />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Monthly Child Monitoring Report
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Prepare and submit the monthly child population report to the
                  Midwife.
                </p>
              </div>
            </div>

            <StatusBadge />
          </div>
        </div>

        {/* ===================================================
            ALERTS
        ================================================== */}

        {message && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />

            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />

            <div>
              <p className="font-semibold">Unable to load report</p>

              <p className="mt-1 text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ===================================================
            FILTERS
        ================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <CalendarDays size={20} className="text-blue-600" />

            <h2 className="font-semibold text-gray-800">Reporting Period</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* MONTH */}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Month
              </label>

              <select
                value={reportMonth}
                /*
                  IMPORTANT:
                  NEVER disable this selector
                  because of report status.
                */

                disabled={loading || saving}
                onChange={(e) => {
                  setMessage("");
                  setErrorMessage("");

                  setReportMonth(Number(e.target.value));
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                {[
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
                ].map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            {/* YEAR */}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Year
              </label>

              <select
                value={reportYear}
                /*
                  IMPORTANT:
                  Year remains selectable.
                */

                disabled={loading || saving}
                onChange={(e) => {
                  setMessage("");
                  setErrorMessage("");

                  setReportYear(Number(e.target.value));
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                {Array.from(
                  {
                    length: 5,
                  },
                  (_, index) => getCurrentYear() - 2 + index,
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* BARANGAY */}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Barangay
              </label>

              <select
                value={selectedBarangayId}
                /*
                  IMPORTANT:
                  Barangay remains selectable.
                */

                disabled={loading || saving}
                onChange={(e) => {
                  setMessage("");
                  setErrorMessage("");

                  setSelectedBarangayId(e.target.value);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                {barangays.length === 0 ? (
                  <option value="">No assigned barangay</option>
                ) : (
                  barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* LOCK INFORMATION */}

          {reportLocked && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <FileCheck2
                  size={18}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    This report is locked
                  </p>

                  <p className="mt-1 text-xs text-blue-700">
                    This {monthName} {reportYear} report is{" "}
                    {status === "approved"
                      ? "approved"
                      : "currently under Midwife review"}
                    . You can select another month or barangay to prepare
                    another monthly report.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================
            REPORT INFORMATION
        ================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            {/* BNS */}

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                BNS
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {getFullName(user) ||
                  user?.name ||
                  user?.username ||
                  "Current BNS"}
              </p>
            </div>

            {/* BARANGAY */}

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Barangay
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {selectedBarangay?.name}
              </p>
            </div>

            {/* PUROK / SITIO */}

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Purok / Sitio
              </p>

              {selectedLocalAreas.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedLocalAreas.map((area) => (
                    <span
                      key={area.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                    >
                      {area.type ? `${area.type}: ` : ""}

                      {area.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 font-semibold text-gray-400">
                  No assigned Purok/Sitio
                </p>
              )}
            </div>

            {/* REPORTING MONTH */}

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Reporting Month
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {monthName} {reportYear}
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================
            REPORT TABLE
        ================================================== */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList size={20} className="text-blue-600" />

                  <h2 className="font-semibold text-gray-800">
                    Actual Population {reportYear}
                  </h2>
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  Male and female population are automatically calculated from
                  registered residents in your assigned area.
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {children.length} children identified below 5 years old
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

              <span className="ml-3 text-sm text-gray-500">
                Loading report data...
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th rowSpan="2" className="px-4 py-3 text-left">
                      Age Group
                    </th>

                    <th
                      colSpan="2"
                      className="border-l border-gray-200 px-4 py-3 text-center"
                    >
                      Actual Population
                    </th>

                    <th
                      colSpan="2"
                      className="border-l border-gray-200 px-4 py-3 text-center"
                    >
                      Trans-out
                    </th>

                    <th
                      colSpan="2"
                      className="border-l border-gray-200 px-4 py-3 text-center"
                    >
                      Deceased
                    </th>
                  </tr>

                  <tr className="border-t border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="border-l border-gray-200 px-4 py-3 text-center">
                      Male
                    </th>

                    <th className="px-4 py-3 text-center">Female</th>

                    <th className="border-l border-gray-200 px-4 py-3 text-center">
                      Male
                    </th>

                    <th className="px-4 py-3 text-center">Female</th>

                    <th className="border-l border-gray-200 px-4 py-3 text-center">
                      Male
                    </th>

                    <th className="px-4 py-3 text-center">Female</th>
                  </tr>
                </thead>

                <tbody>
                  <ReportRow category="age_0_11" label="0–11 mos old" />

                  <ReportRow category="age_0_12" label="0–12 mos old" />

                  <ReportRow category="age_13_23" label="13–23 mos old" />

                  <ReportRow category="age_24_59" label="24–59 mos old" />
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===================================================
            IMPORTANT NOTE
        ================================================== */}

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-blue-600" />

            <div className="text-sm text-blue-800">
              <p className="font-semibold">Automatic population</p>

              <p className="mt-1">
                Male and female population counts are generated from the
                registered residents assigned to this BNS. Trans-out and
                deceased values are entered manually based on the BNS records.
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================
            RETURN NOTES
        ================================================== */}

        {status === "returned" && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <div className="flex items-start gap-3">
              <RotateCcw
                size={22}
                className="mt-0.5 shrink-0 text-orange-600"
              />

              <div>
                <h3 className="font-semibold text-orange-800">
                  Report Returned by Midwife
                </h3>

                <p className="mt-1 text-sm text-orange-700">
                  Please review the Midwife's comments, make the necessary
                  corrections, and resubmit.
                </p>

                {reviewNotes && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                      Midwife's Notes
                    </p>

                    <p className="mt-1 text-sm text-gray-700">{reviewNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            ACTIONS
        ================================================== */}

        {status !== "approved" && (
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            {/* SAVE */}

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || status === "submitted"}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={18} />

              {saving ? "Saving..." : "Save Draft"}
            </button>

            {/* SUBMIT */}

            {status === "returned" ? (
              <button
                type="button"
                onClick={handleResubmit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={18} />

                {saving ? "Submitting..." : "Resubmit to Midwife"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || status === "submitted"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={18} />

                {saving ? "Submitting..." : "Submit to Midwife"}
              </button>
            )}
          </div>
        )}

        {/* ===================================================
            SUBMITTED MESSAGE
        ================================================== */}

        {status === "submitted" && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <FileCheck2 size={22} className="mt-0.5 shrink-0 text-blue-600" />

              <div>
                <h3 className="font-semibold text-blue-800">
                  Report Submitted
                </h3>

                <p className="mt-1 text-sm text-blue-700">
                  This monthly child monitoring report has been submitted to the
                  Midwife and is currently waiting for review.
                </p>

                <p className="mt-2 text-xs font-medium text-blue-600">
                  You can select another month above to prepare the next monthly
                  report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            APPROVED MESSAGE
        ================================================== */}

        {status === "approved" && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={22}
                className="mt-0.5 shrink-0 text-green-600"
              />

              <div>
                <h3 className="font-semibold text-green-800">
                  Report Approved
                </h3>

                <p className="mt-1 text-sm text-green-700">
                  The Midwife has approved this monthly child monitoring report.
                </p>

                <p className="mt-2 text-xs font-medium text-green-600">
                  You can select another month above to prepare the next monthly
                  report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            LAST UPDATED
        ================================================== */}

        <p className="text-center text-xs text-gray-400">
          Report generated on {getToday()}
        </p>
      </div>
    </DashboardLayout>
  );
}
