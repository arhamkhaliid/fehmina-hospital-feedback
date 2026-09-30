import sys
import os
import unittest
import json
import sqlite3
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.config import DB_PATH, BACKUP_DIR, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
from app import db, auth, models, sheets

class TestFehminaHospitalSystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Initialize DB
        db.init_db()

    def test_01_db_initialization(self):
        """Verify database tables, patient_address column, and admin account were seeded properly"""
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        self.assertIn("submissions", tables)
        self.assertIn("settings", tables)
        self.assertIn("admin_users", tables)
        
        cursor.execute("PRAGMA table_info(submissions)")
        columns = [row[1] for row in cursor.fetchall()]
        self.assertIn("patient_address", columns)
        self.assertIn("patient_name", columns)
        self.assertIn("patient_phone", columns)
        
        # Verify admin user exists
        admin = db.get_admin_user(DEFAULT_ADMIN_USERNAME)
        self.assertIsNotNone(admin)
        self.assertTrue(auth.verify_password(admin['password_hash'], admin['salt'], DEFAULT_ADMIN_PASSWORD))
        conn.close()

    def test_02_valid_patient_submission(self):
        """Test valid patient feedback submission with mandatory details and free-text staff nomination"""
        payload = {
            "patient_name": "Ramesh Kumar",
            "patient_phone": "9876543210",
            "patient_address": "Aliganj, Lucknow, UP",
            "overall_rating": 5,
            "doctor_rating": 5,
            "doctor_communication_rating": 4,
            "nursing_rating": 5,
            "staff_behaviour_rating": 4,
            "cleanliness_rating": 5,
            "room_ward_rating": 4,
            "billing_discharge_rating": 4,
            "waiting_time_rating": 4,
            "written_feedback": "Dr. aur staff bohot cooperative the. Treatment time par mila.",
            "staff_of_month_name_text": "Nurse Sana",
            "staff_appreciation_reason": "Raat ke waqt injection bohot dhyan se lagaya aur compassionate the.",
            "department": "Orthopaedics",
            "ward": "IPD General Ward",
            "source_qr": "hospital_ipad"
        }
        
        validated = models.validate_submission_payload(payload)
        sub_id = db.insert_submission(validated)
        
        self.assertTrue(sub_id.startswith("FH-"))
        record = db.get_submission_by_id(sub_id)
        self.assertIsNotNone(record)
        self.assertEqual(record['overall_rating'], 5)
        self.assertEqual(record['patient_name'], "Ramesh Kumar")
        self.assertEqual(record['patient_phone'], "9876543210")
        self.assertEqual(record['patient_address'], "Aliganj, Lucknow, UP")
        self.assertEqual(record['staff_of_month_name_text'], "Nurse Sana")

    def test_03_mandatory_patient_details_validation(self):
        """Verify missing name, phone, or address fails validation"""
        base_payload = {
            "overall_rating": 4, "doctor_rating": 4, "doctor_communication_rating": 4,
            "nursing_rating": 4, "staff_behaviour_rating": 4, "cleanliness_rating": 4,
            "room_ward_rating": 4, "billing_discharge_rating": 4, "waiting_time_rating": 4
        }
        
        # Missing name
        p1 = dict(base_payload, patient_phone="9876543210", patient_address="Lucknow")
        with self.assertRaises(ValueError):
            models.validate_submission_payload(p1)
            
        # Missing phone
        p2 = dict(base_payload, patient_name="Amit", patient_address="Lucknow")
        with self.assertRaises(ValueError):
            models.validate_submission_payload(p2)
            
        # Invalid phone
        p3 = dict(base_payload, patient_name="Amit", patient_phone="12345", patient_address="Lucknow")
        with self.assertRaises(ValueError):
            models.validate_submission_payload(p3)
            
        # Missing address
        p4 = dict(base_payload, patient_name="Amit", patient_phone="9876543210")
        with self.assertRaises(ValueError):
            models.validate_submission_payload(p4)

    def test_04_xss_and_input_sanitization(self):
        """Verify XSS strings in comments, names, or addresses are properly sanitized"""
        payload = {
            "patient_name": "<b>Dr. Patient</b>",
            "patient_phone": "9876543210",
            "patient_address": "<script>alert('addr')</script> Indira Nagar, Lucknow",
            "overall_rating": 4,
            "doctor_rating": 4,
            "doctor_communication_rating": 4,
            "nursing_rating": 4,
            "staff_behaviour_rating": 4,
            "cleanliness_rating": 4,
            "room_ward_rating": 4,
            "billing_discharge_rating": 4,
            "waiting_time_rating": 4,
            "written_feedback": "<script>alert('xss')</script> Good care",
            "staff_of_month_name_text": "<b>Dr. Ahmed</b>",
            "staff_appreciation_reason": "onclick='bad()'"
        }
        
        validated = models.validate_submission_payload(payload)
        self.assertNotIn("<script>", validated['written_feedback'])
        self.assertIn("&lt;script&gt;", validated['written_feedback'])
        self.assertNotIn("<b>", validated['patient_name'])
        self.assertNotIn("<script>", validated['patient_address'])

    def test_05_invalid_ratings_rejected(self):
        """Verify rating out of 1-5 range fails validation"""
        payload = {
            "patient_name": "Amit",
            "patient_phone": "9876543210",
            "patient_address": "Lucknow",
            "overall_rating": 6,  # Invalid
            "doctor_rating": 5,
            "doctor_communication_rating": 5,
            "nursing_rating": 5,
            "staff_behaviour_rating": 5,
            "cleanliness_rating": 5,
            "room_ward_rating": 5,
            "billing_discharge_rating": 5,
            "waiting_time_rating": 5
        }
        with self.assertRaises(ValueError):
            models.validate_submission_payload(payload)

    def test_06_staff_of_month_aggregation_and_ties(self):
        """Verify free-text nomination aggregation and tie detection"""
        staff_samples = [
            ("Nurse Sana", "Very helpful in ICU"),
            ("nurse sana", "Took care of medicines"),
            ("Dr. Ahmed", "Explained diagnosis clearly"),
            ("Dr. Ahmed", "Great surgeon"),
            ("Ayesha (Reception)", "Quick admission process")
        ]
        
        for name, reason in staff_samples:
            payload = {
                "patient_name": "Test Attendant",
                "patient_phone": "9876543210",
                "patient_address": "Gomti Nagar, Lucknow",
                "overall_rating": 5, "doctor_rating": 5, "doctor_communication_rating": 5,
                "nursing_rating": 5, "staff_behaviour_rating": 5, "cleanliness_rating": 5,
                "room_ward_rating": 5, "billing_discharge_rating": 5, "waiting_time_rating": 5,
                "staff_of_month_name_text": name,
                "staff_appreciation_reason": reason
            }
            v = models.validate_submission_payload(payload)
            db.insert_submission(v)

        nominations = db.get_staff_of_month_nominations()
        self.assertTrue(len(nominations) >= 2)
        top_votes = nominations[0]['count']
        self.assertTrue(top_votes >= 2)

    def test_07_google_click_tracking(self):
        """Verify Google review button click updates submission record"""
        payload = {
            "patient_name": "Sunita Verma",
            "patient_phone": "9876543210",
            "patient_address": "Hazratganj, Lucknow",
            "overall_rating": 5, "doctor_rating": 5, "doctor_communication_rating": 5,
            "nursing_rating": 5, "staff_behaviour_rating": 5, "cleanliness_rating": 5,
            "room_ward_rating": 5, "billing_discharge_rating": 5, "waiting_time_rating": 5,
            "written_feedback": "Fehmina hospital is best in Lucknow"
        }
        v = models.validate_submission_payload(payload)
        sub_id = db.insert_submission(v)
        
        db.track_google_click(sub_id)
        record = db.get_submission_by_id(sub_id)
        self.assertEqual(record['google_review_clicked'], 1)

    def test_08_followup_status_update(self):
        """Verify admin can update grievance ticket status and notes"""
        payload = {
            "patient_name": "Sunita Verma",
            "patient_phone": "9123456780",
            "patient_address": "Charbagh, Lucknow",
            "overall_rating": 1, "doctor_rating": 2, "doctor_communication_rating": 2,
            "nursing_rating": 1, "staff_behaviour_rating": 1, "cleanliness_rating": 2,
            "room_ward_rating": 1, "billing_discharge_rating": 1, "waiting_time_rating": 1
        }
        v = models.validate_submission_payload(payload)
        sub_id = db.insert_submission(v)
        
        success = db.update_followup(sub_id, "contacted", "Spoke to patient Sunita ji, resolved refund issue.")
        self.assertTrue(success)
        
        record = db.get_submission_by_id(sub_id)
        self.assertEqual(record['followup_status'], "contacted")
        self.assertIn("resolved refund issue", record['followup_notes'])

    def test_09_csv_export(self):
        """Verify CSV export contains header, address, and data rows"""
        csv_text = db.export_submissions_csv()
        self.assertIn("id,timestamp,department", csv_text)
        self.assertIn("patient_address", csv_text)
        self.assertIn("FH-", csv_text)

    def test_10_backup_creation(self):
        """Verify automated database backup creates a valid SQLite copy"""
        backup_file = db.create_backup()
        self.assertTrue(os.path.exists(backup_file))
        self.assertTrue(os.path.getsize(backup_file) > 0)
        
        b_conn = sqlite3.connect(backup_file)
        b_cursor = b_conn.cursor()
        b_cursor.execute("SELECT count(*) FROM submissions")
        count = b_cursor.fetchone()[0]
        self.assertTrue(count > 0)
        b_conn.close()

    def test_11_no_food_question_anywhere(self):
        """Verify that NO food questions or columns exist in schema or models"""
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(submissions)")
        columns = [row[1].lower() for row in cursor.fetchall()]
        conn.close()
        
        for col in columns:
            self.assertNotIn("food", col)
            self.assertNotIn("canteen", col)
            self.assertNotIn("meal", col)

    def test_12_google_sheets_22_columns_mapping(self):
        """Verify that Google Sheets formatting outputs exactly 22 columns with Patient Name, Phone, and Address"""
        sample_sub = {
            "id": "FH-20260930-TEST1",
            "timestamp": "2026-09-30 03:00:00",
            "patient_name": "Ramesh Kumar",
            "patient_phone": "9876543210",
            "patient_address": "Aliganj, Lucknow",
            "department": "Emergency",
            "ward": "Trauma Ward 2",
            "overall_rating": 5,
            "doctor_rating": 5,
            "doctor_communication_rating": 4,
            "nursing_rating": 5,
            "staff_behaviour_rating": 5,
            "cleanliness_rating": 4,
            "room_ward_rating": 4,
            "billing_discharge_rating": 5,
            "waiting_time_rating": 4,
            "written_feedback": "Dr. Ahmed and Nurse Sana were extremely helpful.",
            "staff_of_month_name_text": "Nurse Sana",
            "staff_appreciation_reason": "Very compassionate and attentive throughout.",
            "google_review_clicked": 1,
            "followup_status": "not_required",
            "followup_notes": "None"
        }
        
        row = sheets.format_row_from_submission(sample_sub)
        self.assertEqual(len(row), 22)
        self.assertEqual(len(sheets.SHEET_COLUMNS), 22)
        
        # Verify specific mappings
        self.assertEqual(row[0], "FH-20260930-TEST1")
        self.assertEqual(row[2], "Ramesh Kumar")
        self.assertEqual(row[3], "9876543210")
        self.assertEqual(row[4], "Aliganj, Lucknow")
        self.assertEqual(row[7], 5)
        self.assertEqual(row[17], "Nurse Sana")
        self.assertEqual(row[19], "Yes")
        
        # Verify no food in sheet headers
        for h in sheets.SHEET_COLUMNS:
            self.assertNotIn("food", h.lower())
            self.assertNotIn("canteen", h.lower())

if __name__ == "__main__":
    unittest.main()
