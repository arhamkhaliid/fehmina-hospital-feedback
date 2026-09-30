import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = DATA_DIR / "backups"
STATIC_DIR = BASE_DIR / "static"

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "fehmina.db"

HOST = os.environ.get("FEHMINA_HOST", "0.0.0.0")
PORT = int(os.environ.get("FEHMINA_PORT", "8080"))
SECRET_KEY = os.environ.get("FEHMINA_SECRET_KEY", "fehmina-hospital-lucknow-secure-key-2026")

HOSPITAL_NAME = "Fehmina Hospital & Trauma Centre"
HOSPITAL_LOCATION = "Lucknow, Uttar Pradesh, India"
HOSPITAL_TAGLINE = "Celebrating 25 Years of Caring (2001-2026)"

DEFAULT_SETTINGS = {
    "google_review_url": "https://www.google.com/search?q=Fehmina+Hospital+and+Blood+Bank+Lucknow+reviews",
    "hospital_phone": "+91 522 2740000",
    "departments": "General Medicine,General Surgery,Orthopaedics,Pediatrics,Gynaecology & Obstetrics,Trauma & Emergency,ICU,OPD,Diagnostic & Lab",
    "wards": "OPD Waiting,IPD General Ward,Female Ward,Private Room,Semi-Private,ICU,Emergency/Casualty,Billing Counter",
    "rate_limit_per_minute": "30"
}

DEFAULT_ADMIN_USERNAME = os.environ.get("FEHMINA_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.environ.get("FEHMINA_ADMIN_PASS", "fehmina2026")
