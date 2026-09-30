import sqlite3
import shutil
import csv
import io
import datetime
from app.config import DB_PATH, BACKUP_DIR, DEFAULT_SETTINGS, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
from app.auth import hash_password

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Submissions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        department TEXT,
        ward TEXT,
        overall_rating INTEGER CHECK(overall_rating BETWEEN 1 AND 5),
        doctor_rating INTEGER CHECK(doctor_rating BETWEEN 1 AND 5),
        doctor_communication_rating INTEGER CHECK(doctor_communication_rating BETWEEN 1 AND 5),
        nursing_rating INTEGER CHECK(nursing_rating BETWEEN 1 AND 5),
        staff_behaviour_rating INTEGER CHECK(staff_behaviour_rating BETWEEN 1 AND 5),
        cleanliness_rating INTEGER CHECK(cleanliness_rating BETWEEN 1 AND 5),
        room_ward_rating INTEGER CHECK(room_ward_rating BETWEEN 1 AND 5),
        billing_discharge_rating INTEGER CHECK(billing_discharge_rating BETWEEN 1 AND 5),
        waiting_time_rating INTEGER CHECK(waiting_time_rating BETWEEN 1 AND 5),
        written_feedback TEXT,
        staff_of_month_name_text TEXT,
        staff_appreciation_reason TEXT,
        management_contact_requested INTEGER DEFAULT 0,
        patient_name TEXT,
        patient_phone TEXT,
        patient_address TEXT,
        google_review_clicked INTEGER DEFAULT 0,
        source_qr TEXT,
        followup_status TEXT DEFAULT 'pending',
        followup_notes TEXT
    );
    """)
    
    # Auto-migrate schema if patient_address is missing
    cursor.execute("PRAGMA table_info(submissions)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    if 'patient_address' not in existing_cols:
        cursor.execute("ALTER TABLE submissions ADD COLUMN patient_address TEXT DEFAULT '';")
    
    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    
    # Admin users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Indices for fast queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_overall ON submissions(overall_rating);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_followup ON submissions(management_contact_requested, followup_status);")
    
    # Seed default settings if missing
    for k, v in DEFAULT_SETTINGS.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))
        
    # Seed default admin user if not exists
    cursor.execute("SELECT username FROM admin_users WHERE username = ?", (DEFAULT_ADMIN_USERNAME,))
    if not cursor.fetchone():
        p_hash, salt = hash_password(DEFAULT_ADMIN_PASSWORD)
        cursor.execute("INSERT INTO admin_users (username, password_hash, salt) VALUES (?, ?, ?)", 
                       (DEFAULT_ADMIN_USERNAME, p_hash, salt))
        
    conn.commit()
    conn.close()

def insert_submission(data: dict) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    
    # Ensure patient_address exists in data
    if 'patient_address' not in data:
        data['patient_address'] = ''
        
    cursor.execute("""
    INSERT INTO submissions (
        id, timestamp, department, ward,
        overall_rating, doctor_rating, doctor_communication_rating,
        nursing_rating, staff_behaviour_rating, cleanliness_rating,
        room_ward_rating, billing_discharge_rating, waiting_time_rating,
        written_feedback, staff_of_month_name_text, staff_appreciation_reason,
        management_contact_requested, patient_name, patient_phone, patient_address,
        google_review_clicked, source_qr, followup_status, followup_notes
    ) VALUES (
        :id, :timestamp, :department, :ward,
        :overall_rating, :doctor_rating, :doctor_communication_rating,
        :nursing_rating, :staff_behaviour_rating, :cleanliness_rating,
        :room_ward_rating, :billing_discharge_rating, :waiting_time_rating,
        :written_feedback, :staff_of_month_name_text, :staff_appreciation_reason,
        :management_contact_requested, :patient_name, :patient_phone, :patient_address,
        :google_review_clicked, :source_qr, :followup_status, :followup_notes
    )
    """, data)
    
    conn.commit()
    conn.close()
    return data['id']

def track_google_click(submission_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE submissions SET google_review_clicked = 1 WHERE id = ?", (submission_id,))
    conn.commit()
    conn.close()

def get_submissions(filters: dict = None) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM submissions WHERE 1=1"
    params = []
    
    if filters:
        if filters.get('month'):
            query += " AND strftime('%Y-%m', timestamp) = ?"
            params.append(filters['month'])
        if filters.get('department'):
            query += " AND department = ?"
            params.append(filters['department'])
        if filters.get('ward'):
            query += " AND ward = ?"
            params.append(filters['ward'])
        if filters.get('rating'):
            query += " AND overall_rating = ?"
            params.append(int(filters['rating']))
        if filters.get('followup_only'):
            query += " AND management_contact_requested = 1"
        if filters.get('followup_status'):
            query += " AND followup_status = ?"
            params.append(filters['followup_status'])
        if filters.get('search'):
            search_term = f"%{filters['search']}%"
            query += " AND (written_feedback LIKE ? OR staff_of_month_name_text LIKE ? OR patient_name LIKE ? OR patient_phone LIKE ? OR patient_address LIKE ? OR id LIKE ?)"
            params.extend([search_term, search_term, search_term, search_term, search_term, search_term])
            
    query += " ORDER BY timestamp DESC"
    
    if filters and filters.get('limit'):
        query += f" LIMIT {int(filters['limit'])}"
        
    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_submission_by_id(submission_id: str) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_followup(submission_id: str, status: str, notes: str = None) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    if notes is not None:
        cursor.execute("UPDATE submissions SET followup_status = ?, followup_notes = ? WHERE id = ?",
                       (status, notes, submission_id))
    else:
        cursor.execute("UPDATE submissions SET followup_status = ? WHERE id = ?",
                       (status, submission_id))
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated

def get_dashboard_stats(filters: dict = None) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    
    where_clause = "WHERE 1=1"
    params = []
    
    if filters and filters.get('month'):
        where_clause += " AND strftime('%Y-%m', timestamp) = ?"
        params.append(filters['month'])
    if filters and filters.get('department'):
        where_clause += " AND department = ?"
        params.append(filters['department'])
    if filters and filters.get('ward'):
        where_clause += " AND ward = ?"
        params.append(filters['ward'])
        
    # Core aggregations
    cursor.execute(f"""
    SELECT 
        COUNT(*) as total_responses,
        AVG(overall_rating) as avg_overall,
        AVG(doctor_rating) as avg_doctor,
        AVG(doctor_communication_rating) as avg_doctor_communication,
        AVG(nursing_rating) as avg_nursing,
        AVG(staff_behaviour_rating) as avg_staff_behaviour,
        AVG(cleanliness_rating) as avg_cleanliness,
        AVG(room_ward_rating) as avg_room_ward,
        AVG(billing_discharge_rating) as avg_billing_discharge,
        AVG(waiting_time_rating) as avg_waiting_time,
        SUM(CASE WHEN staff_of_month_name_text IS NOT NULL AND TRIM(staff_of_month_name_text) != '' THEN 1 ELSE 0 END) as total_staff_nominations,
        SUM(CASE WHEN overall_rating >= 4 THEN 1 ELSE 0 END) as total_satisfied
    FROM submissions {where_clause}
    """, params)
    
    kpis = dict(cursor.fetchone() or {})
    
    # Rating breakdown (1 to 5 stars)
    cursor.execute(f"""
    SELECT overall_rating, COUNT(*) as count 
    FROM submissions {where_clause}
    GROUP BY overall_rating
    ORDER BY overall_rating ASC
    """, params)
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for row in cursor.fetchall():
        if row['overall_rating'] in distribution:
            distribution[row['overall_rating']] = row['count']
            
    # Monthly trend (last 12 months)
    cursor.execute("""
    SELECT 
        strftime('%Y-%m', timestamp) as month,
        COUNT(*) as count,
        AVG(overall_rating) as avg_rating
    FROM submissions
    GROUP BY strftime('%Y-%m', timestamp)
    ORDER BY month DESC
    LIMIT 12
    """)
    monthly_trend = [dict(row) for row in cursor.fetchall()]
    monthly_trend.reverse()
    
    conn.close()
    
    return {
        "kpis": kpis,
        "distribution": distribution,
        "monthly_trend": monthly_trend
    }

def get_staff_of_month_nominations(month_str: str = None) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    
    where_clause = "WHERE staff_of_month_name_text IS NOT NULL AND TRIM(staff_of_month_name_text) != ''"
    params = []
    
    if month_str:
        where_clause += " AND strftime('%Y-%m', timestamp) = ?"
        params.append(month_str)
        
    cursor.execute(f"""
    SELECT 
        id as submission_id,
        timestamp,
        department,
        ward,
        staff_of_month_name_text,
        staff_appreciation_reason
    FROM submissions
    {where_clause}
    ORDER BY timestamp DESC
    """, params)
    
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    # Process and group nominations while preserving original text
    # Group by cleaned lowercase key for ranking
    groups = {}
    for r in rows:
        raw_name = r['staff_of_month_name_text'].strip()
        # Normalization key: lowercase, strip common prefixes for loose grouping
        clean_key = raw_name.lower()
        
        if clean_key not in groups:
            groups[clean_key] = {
                'display_name': raw_name,
                'count': 0,
                'variants': set(),
                'appreciations': []
            }
        groups[clean_key]['count'] += 1
        groups[clean_key]['variants'].add(raw_name)
        if r['staff_appreciation_reason'] and r['staff_appreciation_reason'].strip():
            groups[clean_key]['appreciations'].append({
                'submission_id': r['submission_id'],
                'timestamp': r['timestamp'],
                'raw_name': raw_name,
                'reason': r['staff_appreciation_reason'].strip(),
                'department': r['department'] or 'General'
            })
            
    # Sort descending by nomination count
    sorted_staff = []
    for k, v in sorted(groups.items(), key=lambda item: item[1]['count'], reverse=True):
        sorted_staff.append({
            'name': v['display_name'],
            'count': v['count'],
            'variants': list(v['variants']),
            'appreciations': v['appreciations']
        })
        
    return sorted_staff

def get_settings() -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}
    conn.close()
    return settings

def update_setting(key: str, value: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

def get_admin_user(username: str) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM admin_users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_admin_password(username: str, new_password: str):
    p_hash, salt = hash_password(new_password)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE admin_users SET password_hash = ?, salt = ? WHERE username = ?",
                   (p_hash, salt, username))
    conn.commit()
    conn.close()

def export_submissions_csv() -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submissions ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    
    output = io.StringIO()
    if rows:
        headers = rows[0].keys()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        for r in rows:
            writer.writerow(dict(r))
    else:
        writer = csv.writer(output)
        writer.writerow(["No submissions found"])
        
    conn.close()
    return output.getvalue()

def create_backup() -> str:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"fehmina_backup_{timestamp}.db"
    backup_filepath = BACKUP_DIR / backup_filename
    shutil.copy2(DB_PATH, backup_filepath)
    return str(backup_filepath)
