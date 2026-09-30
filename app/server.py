import json
import mimetypes
import os
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

from app.config import HOST, PORT, STATIC_DIR, DB_PATH
from app import db, auth, models, sheets

class FehminaRequestHandler(BaseHTTPRequestHandler):
    
    def _set_security_headers(self, content_type="application/json; charset=utf-8"):
        self.send_header("Content-Type", content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._set_security_headers("application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, message: str, status: int = 400):
        self._send_json({"success": False, "error": message}, status)

    def _get_client_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0]

    def _get_auth_token(self) -> str:
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:].strip()
        cookie_header = self.headers.get("Cookie", "")
        for c in cookie_header.split(";"):
            parts = c.strip().split("=")
            if len(parts) == 2 and parts[0] == "fehmina_admin_token":
                return parts[1].strip()
        return ""

    def _require_admin(self) -> bool:
        token = self._get_auth_token()
        if not auth.validate_session(token):
            self._send_error("Unauthorized. Please log in as admin.", 401)
            return False
        return True

    def _read_json_body(self) -> dict:
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            return {}
        if content_length > 1024 * 1024:
            raise ValueError("Request body too large")
        raw_body = self.rfile.read(content_length).decode('utf-8')
        return json.loads(raw_body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_security_headers()
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API routes
        if path == "/api/config":
            settings = db.get_settings()
            public_config = {
                "hospital_name": "Fehmina Hospital & Trauma Centre",
                "google_review_url": settings.get("google_review_url", ""),
                "departments": [d.strip() for d in settings.get("departments", "").split(",") if d.strip()],
                "wards": [w.strip() for w in settings.get("wards", "").split(",") if w.strip()]
            }
            self._send_json({"success": True, "config": public_config})
            return

        elif path == "/api/admin/check-auth":
            token = self._get_auth_token()
            is_valid = auth.validate_session(token)
            self._send_json({"success": True, "authenticated": is_valid})
            return

        elif path == "/api/admin/stats":
            if not self._require_admin(): return
            filters = {k: v[0] for k, v in query.items()}
            stats = db.get_dashboard_stats(filters)
            self._send_json({"success": True, **stats})
            return

        elif path == "/api/admin/submissions":
            if not self._require_admin(): return
            filters = {k: v[0] for k, v in query.items()}
            submissions = db.get_submissions(filters)
            self._send_json({"success": True, "submissions": submissions, "count": len(submissions)})
            return

        elif path == "/api/admin/staff-of-month":
            if not self._require_admin(): return
            month = query.get("month", [None])[0]
            nominations = db.get_staff_of_month_nominations(month)
            self._send_json({"success": True, "nominations": nominations})
            return

        elif path == "/api/admin/export-csv":
            # Allow auth via query param for direct browser download links if token given
            token_param = query.get("auth", [None])[0]
            if token_param and auth.validate_session(token_param):
                pass
            elif not self._require_admin():
                return

            csv_data = db.export_submissions_csv()
            body = csv_data.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", "attachment; filename=fehmina_feedback_export.csv")
            self.send_header("Content-Length", str(len(body)))
            self._set_security_headers("text/csv; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)
            return

        elif path == "/api/admin/settings":
            if not self._require_admin(): return
            settings = db.get_settings()
            self._send_json({"success": True, "settings": settings})
            return

        # 2. Static File Serving
        self._serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        client_ip = self._get_client_ip()

        try:
            if not models.check_rate_limit(client_ip):
                self._send_error("Bohot saare requests aa rahe hain. Kripya thoda wait karein.", 429)
                return

            body = self._read_json_body()

            # 1. Public Submission
            if path == "/api/submit":
                validated_data = models.validate_submission_payload(body)
                sub_id = db.insert_submission(validated_data)
                # Dispatch real-time async sync to Google Sheets
                sheets.sync_submission_async(validated_data)
                settings = db.get_settings()
                self._send_json({
                    "success": True,
                    "submission_id": sub_id,
                    "message": "Thank you! Aapka feedback successfully submit ho gaya.",
                    "google_review_url": settings.get("google_review_url", "")
                })
                return

            # 2. Track Google Review Click
            elif path == "/api/track-google":
                sub_id = body.get("submission_id")
                if sub_id:
                    db.track_google_click(sub_id)
                self._send_json({"success": True})
                return

            # 3. Admin Login
            elif path == "/api/admin/login":
                username = str(body.get("username", "")).strip()
                password = str(body.get("password", "")).strip()
                
                user = db.get_admin_user(username)
                if not user or not auth.verify_password(user['password_hash'], user['salt'], password):
                    self._send_error("Invalid username or password", 401)
                    return
                
                token = auth.create_session(username)
                self.send_response(200)
                self._set_security_headers()
                self.send_header("Set-Cookie", f"fehmina_admin_token={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200")
                body_resp = json.dumps({"success": True, "token": token, "username": username}).encode("utf-8")
                self.send_header("Content-Length", str(len(body_resp)))
                self.end_headers()
                self.wfile.write(body_resp)
                return

            # 4. Admin Logout
            elif path == "/api/admin/logout":
                token = self._get_auth_token()
                auth.destroy_session(token)
                self.send_response(200)
                self._set_security_headers()
                self.send_header("Set-Cookie", "fehmina_admin_token=; Path=/; HttpOnly; Max-Age=0")
                body_resp = json.dumps({"success": True}).encode("utf-8")
                self.send_header("Content-Length", str(len(body_resp)))
                self.end_headers()
                self.wfile.write(body_resp)
                return

            # 5. Protected Admin Operations
            elif path == "/api/admin/followup":
                if not self._require_admin(): return
                sub_id = body.get("submission_id")
                status = body.get("status", "pending")
                notes = body.get("notes")
                if not sub_id:
                    self._send_error("Missing submission_id")
                    return
                updated = db.update_followup(sub_id, status, notes)
                self._send_json({"success": updated})
                return

            elif path == "/api/admin/backup":
                if not self._require_admin(): return
                backup_path = db.create_backup()
                self._send_json({"success": True, "backup_file": os.path.basename(backup_path)})
                return

            elif path == "/api/admin/test-sheets":
                if not self._require_admin(): return
                res = sheets.test_sheets_connection()
                self._send_json(res)
                return

            elif path == "/api/admin/sync-sheets":
                if not self._require_admin(): return
                res = sheets.sync_batch_to_sheets()
                self._send_json(res)
                return

            elif path == "/api/admin/settings":
                if not self._require_admin(): return
                for k, v in body.items():
                    if k in ["google_review_url", "google_sheet_webhook_url", "departments", "wards", "hospital_phone"]:
                        db.update_setting(k, str(v).strip())
                self._send_json({"success": True, "message": "Settings updated successfully"})
                return

            elif path == "/api/admin/change-password":
                if not self._require_admin(): return
                new_password = str(body.get("new_password", "")).strip()
                if len(new_password) < 6:
                    self._send_error("Password must be at least 6 characters")
                    return
                token = self._get_auth_token()
                session_data = auth.ACTIVE_SESSIONS.get(token, {})
                username = session_data.get("username", "admin")
                db.update_admin_password(username, new_password)
                self._send_json({"success": True, "message": "Password changed successfully"})
                return

            else:
                self._send_error("Endpoint not found", 404)

        except ValueError as ve:
            self._send_error(str(ve), 400)
        except Exception as e:
            self._send_error("Internal server error. Please try again.", 500)

    def _serve_static(self, path: str):
        if path == "/" or path == "" or path == "/patient":
            target = STATIC_DIR / "index.html"
        elif path == "/admin":
            target = STATIC_DIR / "admin.html"
        elif path == "/poster":
            target = STATIC_DIR / "poster.html"
        else:
            rel_path = path.lstrip("/")
            target = (STATIC_DIR / rel_path).resolve()
            if not str(target).startswith(str(STATIC_DIR.resolve())):
                self._send_error("Access denied", 403)
                return

        if not target.exists() or target.is_dir():
            self._send_error("File not found", 404)
            return

        mime_type, _ = mimetypes.guess_type(str(target))
        if not mime_type:
            mime_type = "application/octet-stream"

        with open(target, "rb") as f:
            content = f.read()

        self.send_response(200)
        self._set_security_headers(f"{mime_type}; charset=utf-8" if "text" in mime_type or "json" in mime_type or "javascript" in mime_type else mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

def run_server(port=PORT):
    db.init_db()
    ThreadingHTTPServer.allow_reuse_address = True
    server_address = ('0.0.0.0', port)
    httpd = ThreadingHTTPServer(server_address, FehminaRequestHandler)
    print(f"Fehmina Hospital Feedback System running on port {port} at http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("Server stopping...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
