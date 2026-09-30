/**
 * FEHMINA HOSPITAL & TRAUMA CENTRE, LUCKNOW
 * Official Google Sheets Integration Script (Google Apps Script)
 * 
 * INSTRUCTIONS:
 * 1. Open your target Google Sheet (e.g. "Fehmina Hospital - Patient Feedback").
 * 2. Click on "Extensions" -> "Apps Script".
 * 3. Delete any code in the editor and PASTE this entire script.
 * 4. Click "Deploy" (top right) -> "New deployment".
 * 5. Select type: "Web app".
 * 6. Set Description: "Fehmina Hospital Feedback Webhook".
 * 7. Set "Execute as": "Me" (your email).
 * 8. Set "Who has access": "Anyone" (allows hospital server to post data securely).
 * 9. Click "Deploy", copy the generated "Web App URL".
 * 10. Paste the Web App URL into the Fehmina Hospital Admin Dashboard -> Settings -> "Google Sheet Webhook URL".
 */

const HEADERS = [
  "Submission ID",
  "Timestamp",
  "Patient Name",
  "Patient Phone",
  "Patient Address",
  "Department",
  "Ward",
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
  "Staff Appreciation Reason",
  "Google Review Clicked",
  "Follow-up Status",
  "Follow-up Notes"
];

function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const payload = JSON.parse(rawData);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Auto-initialize headers on first row if blank
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#60733E");
      headerRange.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
    
    // Action 1: Ping / Health Check
    if (payload.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Fehmina Hospital Google Sheet Webhook connected successfully",
        total_rows: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action 2: Append Single Patient Submission Row
    if (payload.action === "append_row" && payload.row) {
      sheet.appendRow(payload.row);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        submission_id: payload.submission_id,
        row_number: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action 3: Batch Sync / Restore
    if (payload.action === "batch_sync" && payload.rows) {
      // Clear sheet and re-write headers
      sheet.clearContents();
      sheet.appendRow(HEADERS);
      const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#60733E");
      headerRange.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
      
      if (payload.rows.length > 0) {
        const range = sheet.getRange(2, 1, payload.rows.length, payload.rows[0].length);
        range.setValues(payload.rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        synced_rows: payload.rows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Unknown action"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    hospital: "Fehmina Hospital & Trauma Centre, Lucknow",
    status: "Webhook Active"
  })).setMimeType(ContentService.MimeType.JSON);
}
