import json
import logging
import threading
import urllib.request
import urllib.error
from app import db

logger = logging.getLogger("fehmina.sheets")

# Structured Columns expected in Google Sheet (18 Columns)
SHEET_COLUMNS = [
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
]

def format_row_from_submission(data: dict) -> list:
    """Format a submission dict into ordered Google Sheet row cells (18 columns)"""
    return [
        str(data.get("id", "")),
        str(data.get("timestamp", "")),
        str(data.get("patient_name", "")),
        str(data.get("patient_phone", "")),
        str(data.get("patient_address", "")),
        str(data.get("department", "")),
        data.get("overall_rating", ""),
        data.get("doctor_rating", ""),
        data.get("doctor_communication_rating", ""),
        data.get("nursing_rating", ""),
        data.get("staff_behaviour_rating", ""),
        data.get("cleanliness_rating", ""),
        data.get("room_ward_rating", ""),
        data.get("billing_discharge_rating", ""),
        data.get("waiting_time_rating", ""),
        str(data.get("written_feedback", "")),
        str(data.get("staff_of_month_name_text", "")),
        str(data.get("staff_appreciation_reason", ""))
    ]

def send_to_webhook(webhook_url: str, payload: dict) -> dict:
    """Send payload to Google Apps Script Webhook endpoint"""
    if not webhook_url or not webhook_url.strip():
        return {"success": False, "error": "No Google Sheet Webhook URL configured"}

    url = webhook_url.strip()
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8", errors="ignore")
            try:
                res_json = json.loads(body)
                return {"success": True, "response": res_json}
            except Exception:
                return {"success": True, "raw_response": body}
    except urllib.error.HTTPError as he:
        return {"success": False, "error": f"HTTP {he.code}: {he.reason}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def sync_submission_async(submission_data: dict):
    """Background worker to synchronize submission to Google Sheet"""
    def _worker():
        try:
            settings = db.get_settings()
            webhook_url = settings.get("google_sheet_webhook_url", "").strip()
            if not webhook_url:
                return

            row = format_row_from_submission(submission_data)
            payload = {
                "action": "append_row",
                "submission_id": submission_data.get("id"),
                "row": row,
                "data": submission_data
            }
            res = send_to_webhook(webhook_url, payload)
            if res.get("success"):
                logger.info(f"Successfully synced submission {submission_data.get('id')} to Google Sheet")
            else:
                logger.warning(f"Google Sheet sync warning for {submission_data.get('id')}: {res.get('error')}")
        except Exception as e:
            logger.error(f"Error syncing to Google Sheet: {e}")

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

def sync_batch_to_sheets() -> dict:
    """Batch synchronize all submissions from local store to Google Sheet"""
    settings = db.get_settings()
    webhook_url = settings.get("google_sheet_webhook_url", "").strip()
    if not webhook_url:
        return {"success": False, "error": "Please configure a Google Sheet Webhook URL in Settings first."}

    submissions = db.get_submissions()
    if not submissions:
        return {"success": True, "synced_count": 0, "message": "No submissions found to sync."}

    rows = [format_row_from_submission(s) for s in reversed(submissions)] # Oldest to newest
    payload = {
        "action": "batch_sync",
        "headers": SHEET_COLUMNS,
        "rows": rows,
        "total_count": len(rows)
    }

    res = send_to_webhook(webhook_url, payload)
    if res.get("success"):
        return {"success": True, "synced_count": len(rows), "message": f"Successfully synced {len(rows)} submissions to Google Sheet."}
    else:
        return {"success": False, "error": res.get("error", "Google Sheet sync failed")}

def test_sheets_connection() -> dict:
    """Ping Google Sheet webhook to verify connectivity"""
    settings = db.get_settings()
    webhook_url = settings.get("google_sheet_webhook_url", "").strip()
    if not webhook_url:
        return {"success": False, "error": "No Google Sheet Webhook URL entered."}

    payload = {
        "action": "ping",
        "hospital": "Fehmina Hospital & Trauma Centre",
        "timestamp": "test_ping"
    }
    return send_to_webhook(webhook_url, payload)
