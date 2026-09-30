/**
 * =========================================================================
 * FEHMINA HOSPITAL & TRAUMA CENTRE, LUCKNOW
 * Production Google Apps Script Web App Endpoint (Authoritative 18-Column Schema)
 * Celebrating 25 Years of Healthcare Excellence (2001–2026)
 * =========================================================================
 */

const HEADERS = [
  "Submission ID",
  "Timestamp",
  "Patient Name",
  "Patient Phone",
  "Patient Address",
  "Department",
  "Overall Rating",
  "Doctor & Medical Care Rating",
  "Doctor Communication Rating",
  "Nursing Staff Rating",
  "Staff Behaviour Rating",
  "Cleanliness & Hygiene Rating",
  "Room / Ward Rating",
  "Billing & Discharge Rating",
  "Waiting Time Rating",
  "Written Feedback",
  "Staff of the Month Nomination",
  "Staff Appreciation Reason"
];

/**
 * Handle incoming POST requests from Patient iPad Form & Admin Dashboard
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Empty request payload" });
    }

    const payload = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();

    // Ensure headers exist
    ensureHeaders(sheet);

    // 1. Action: Health Check / Ping
    if (payload.action === "ping") {
      return createJsonResponse({
        success: true,
        message: "Fehmina Hospital Google Sheet Webhook connected successfully",
        total_rows: Math.max(0, sheet.getLastRow() - 1)
      });
    }

    // 2. Action: Read All Submissions for Admin Dashboard
    if (payload.action === "get_data" || payload.action === "get_submissions") {
      const submissions = fetchAllSubmissions(sheet);
      return createJsonResponse({
        success: true,
        count: submissions.length,
        submissions: submissions
      });
    }

    // 3. Action: Append Single Submission (Always strictly normalized through 18-field schema)
    if (payload.action === "append_row" || payload.row || payload.patient_name) {
      const rawInput = payload.row || payload;
      const normalizedRow = normalizeToProduction18(rawInput);

      sheet.appendRow(normalizedRow);

      return createJsonResponse({
        success: true,
        submission_id: String(normalizedRow[0] || payload.submission_id || ""),
        row_number: sheet.getLastRow(),
        columns_written: 18
      });
    }

    // 4. Action: Batch Sync (for restores/exports)
    if (payload.action === "batch_sync" && Array.isArray(payload.rows)) {
      sheet.clearContents();
      sheet.appendRow(HEADERS);
      formatHeaderRow(sheet);

      if (payload.rows.length > 0) {
        const normalizedRows = payload.rows.map(r => normalizeToProduction18(r));
        const range = sheet.getRange(2, 1, normalizedRows.length, 18);
        range.setValues(normalizedRows);
      }

      return createJsonResponse({
        success: true,
        synced_rows: payload.rows.length
      });
    }

    return createJsonResponse({ success: false, error: "Unrecognized action" });

  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle GET requests (Health Check & Direct Read for Admin Dashboard)
 */
function doGet(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    ensureHeaders(sheet);

    const action = e && e.parameter ? e.parameter.action : "";

    if (action === "get_data" || action === "get_submissions") {
      const submissions = fetchAllSubmissions(sheet);
      return createJsonResponse({
        success: true,
        count: submissions.length,
        submissions: submissions
      });
    }

    return createJsonResponse({
      success: true,
      hospital: "Fehmina Hospital & Trauma Centre, Lucknow",
      service: "Patient Feedback Webhook & Data Service",
      columns_count: 18,
      total_submissions: Math.max(0, sheet.getLastRow() - 1),
      status: "Active & Ready"
    });

  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Strict Normalizer: Converts any incoming array or object into an exact 18-element row.
 * - Extracts slots 0..17 only.
 * - Strictly discards any 19th+ elements.
 * - Never invents default values ('General', 'No', 'not_required', etc.).
 * - Preserves empty fields as empty strings.
 * - Formats phone with single-quote prefix.
 */
function normalizeToProduction18(input) {
  const row = new Array(18).fill("");

  if (Array.isArray(input)) {
    // Array format: copy strictly indices 0 to 17
    for (let i = 0; i < 18; i++) {
      const val = input[i];
      row[i] = (val !== undefined && val !== null) ? val : "";
    }
  } else if (typeof input === "object" && input !== null) {
    // Object format: map explicit keys to exact slots
    row[0]  = input.id || input.submission_id || "";
    row[1]  = input.timestamp || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
    row[2]  = input.patient_name || "";
    row[3]  = input.patient_phone || "";
    row[4]  = input.patient_address || "";
    row[5]  = input.department || "";
    row[6]  = (input.overall_rating !== undefined && input.overall_rating !== null) ? input.overall_rating : "";
    row[7]  = (input.doctor_rating !== undefined && input.doctor_rating !== null) ? input.doctor_rating : "";
    row[8]  = (input.doctor_communication_rating !== undefined && input.doctor_communication_rating !== null) ? input.doctor_communication_rating : "";
    row[9]  = (input.nursing_rating !== undefined && input.nursing_rating !== null) ? input.nursing_rating : "";
    row[10] = (input.staff_behaviour_rating !== undefined && input.staff_behaviour_rating !== null) ? input.staff_behaviour_rating : "";
    row[11] = (input.cleanliness_rating !== undefined && input.cleanliness_rating !== null) ? input.cleanliness_rating : "";
    row[12] = (input.room_ward_rating !== undefined && input.room_ward_rating !== null) ? input.room_ward_rating : "";
    row[13] = (input.billing_discharge_rating !== undefined && input.billing_discharge_rating !== null) ? input.billing_discharge_rating : "";
    row[14] = (input.waiting_time_rating !== undefined && input.waiting_time_rating !== null) ? input.waiting_time_rating : "";
    row[15] = input.written_feedback || "";
    row[16] = input.staff_of_month_name_text || "";
    row[17] = input.staff_appreciation_reason || "";
  }

  // Ensure phone formatting (preserve 10 digits as text)
  if (row[3] !== "") {
    row[3] = "'" + String(row[3]).trim().replace(/^'+/, '');
  }

  return row;
}

/**
 * Helper: Ensure Header Row Exists
 */
function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    formatHeaderRow(sheet);
  }
}

/**
 * Helper: Format Header Row Styling
 */
function formatHeaderRow(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#60733E"); // Fehmina Brand Olive
  headerRange.setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);
}

/**
 * Helper: Convert Google Sheet Rows to Structured JSON Objects
 */
function fetchAllSubmissions(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const submissions = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row[2]) continue; // Skip empty rows

    // Clean formatting
    let phoneStr = String(row[3] || '').trim().replace(/^'+/, '');
    let timestampStr = '';
    if (row[1] instanceof Date) {
      timestampStr = Utilities.formatDate(row[1], "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
    } else {
      timestampStr = String(row[1] || '').trim();
    }

    submissions.push({
      id: String(row[0] || '').trim(),
      timestamp: timestampStr,
      patient_name: String(row[2] || '').trim(),
      patient_phone: phoneStr,
      patient_address: String(row[4] || '').trim(),
      department: String(row[5] || '').trim(),
      overall_rating: parseInt(row[6], 10) || 0,
      doctor_rating: parseInt(row[7], 10) || 0,
      doctor_communication_rating: parseInt(row[8], 10) || 0,
      nursing_rating: parseInt(row[9], 10) || 0,
      staff_behaviour_rating: parseInt(row[10], 10) || 0,
      cleanliness_rating: parseInt(row[11], 10) || 0,
      room_ward_rating: parseInt(row[12], 10) || 0,
      billing_discharge_rating: parseInt(row[13], 10) || 0,
      waiting_time_rating: parseInt(row[14], 10) || 0,
      written_feedback: String(row[15] || '').trim(),
      staff_of_month_name_text: String(row[16] || '').trim(),
      staff_appreciation_reason: String(row[17] || '').trim()
    });
  }

  // Sort descending by timestamp / row order
  submissions.reverse();
  return submissions;
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
