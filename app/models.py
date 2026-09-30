import html
import re
import secrets
import time
from datetime import datetime

# Rate limiting storage: ip -> list of request timestamps
RATE_LIMIT_DATA = {}
RATE_LIMIT_WINDOW = 60  # seconds
MAX_REQUESTS_PER_WINDOW = 30

def check_rate_limit(ip: str) -> bool:
    now = time.time()
    if ip not in RATE_LIMIT_DATA:
        RATE_LIMIT_DATA[ip] = []
    
    # Remove timestamps older than window
    RATE_LIMIT_DATA[ip] = [t for t in RATE_LIMIT_DATA[ip] if now - t < RATE_LIMIT_WINDOW]
    
    if len(RATE_LIMIT_DATA[ip]) >= MAX_REQUESTS_PER_WINDOW:
        return False
        
    RATE_LIMIT_DATA[ip].append(now)
    return True

def sanitize_text(text: str, max_len: int = 1000) -> str:
    if not text:
        return ""
    text = str(text).strip()
    if len(text) > max_len:
        text = text[:max_len]
    # Escape HTML characters to prevent XSS
    return html.escape(text)

def validate_rating(val) -> int:
    try:
        val = int(val)
        if 1 <= val <= 5:
            return val
    except (ValueError, TypeError):
        pass
    raise ValueError("Rating must be an integer between 1 and 5")

def validate_indian_phone(phone: str) -> str:
    if not phone:
        return ""
    clean = re.sub(r'[^0-9+]', '', str(phone).strip())
    # Match standard 10 digit or +91 format
    match = re.search(r'(\+91)?[6-9]\d{9}$', clean)
    if not match:
        raise ValueError("Kripya ek valid 10-digit mobile number enter karein")
    return clean

def generate_submission_id() -> str:
    date_part = datetime.now().strftime("%Y%m%d")
    random_part = secrets.token_hex(3).upper()
    return f"FH-{date_part}-{random_part}"

def validate_submission_payload(data: dict) -> dict:
    if not isinstance(data, dict):
        raise ValueError("Invalid request format")
        
    # Required 9 ratings
    overall_rating = validate_rating(data.get('overall_rating'))
    doctor_rating = validate_rating(data.get('doctor_rating'))
    doctor_communication_rating = validate_rating(data.get('doctor_communication_rating'))
    nursing_rating = validate_rating(data.get('nursing_rating'))
    staff_behaviour_rating = validate_rating(data.get('staff_behaviour_rating'))
    cleanliness_rating = validate_rating(data.get('cleanliness_rating'))
    room_ward_rating = validate_rating(data.get('room_ward_rating'))
    billing_discharge_rating = validate_rating(data.get('billing_discharge_rating'))
    waiting_time_rating = validate_rating(data.get('waiting_time_rating'))
    
    # Optional fields
    written_feedback = sanitize_text(data.get('written_feedback', ''), 2000)
    staff_of_month_name_text = sanitize_text(data.get('staff_of_month_name_text', ''), 150)
    staff_appreciation_reason = sanitize_text(data.get('staff_appreciation_reason', ''), 500)
    
    # Mandatory Patient Details
    patient_name = sanitize_text(data.get('patient_name', ''), 100)
    if not patient_name:
        raise ValueError("Kripya patient ka naam enter karein")
        
    raw_phone = data.get('patient_phone', '')
    if not raw_phone or not str(raw_phone).strip():
        raise ValueError("Kripya patient ka mobile number enter karein")
    patient_phone = validate_indian_phone(raw_phone)
    
    patient_address = sanitize_text(data.get('patient_address', ''), 300)
    if not patient_address:
        raise ValueError("Kripya patient ka address enter karein")
    
    # Department & Tracking
    department = sanitize_text(data.get('department', ''), 100)
    source_qr = sanitize_text(data.get('source_qr', 'direct'), 50)
    
    return {
        'id': generate_submission_id(),
        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'department': department,
        'ward': '',
        'overall_rating': overall_rating,
        'doctor_rating': doctor_rating,
        'doctor_communication_rating': doctor_communication_rating,
        'nursing_rating': nursing_rating,
        'staff_behaviour_rating': staff_behaviour_rating,
        'cleanliness_rating': cleanliness_rating,
        'room_ward_rating': room_ward_rating,
        'billing_discharge_rating': billing_discharge_rating,
        'waiting_time_rating': waiting_time_rating,
        'written_feedback': written_feedback,
        'staff_of_month_name_text': staff_of_month_name_text,
        'staff_appreciation_reason': staff_appreciation_reason,
        'management_contact_requested': 0,
        'patient_name': patient_name,
        'patient_phone': patient_phone,
        'patient_address': patient_address,
        'google_review_clicked': 0,
        'source_qr': source_qr,
        'followup_status': 'not_required',
        'followup_notes': ''
    }
