import sqlite3
import json
import uuid
import datetime
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

DB_FILE = 'database.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS registrations (
            id TEXT PRIMARY KEY,
            teamName TEXT,
            playerName TEXT,
            uid TEXT,
            phone TEXT,
            email TEXT,
            screenshotUrl TEXT,
            paymentVerified BOOLEAN,
            createdAt TEXT
        )
    ''')
    conn.commit()
    conn.close()

class RequestHandler(SimpleHTTPRequestHandler):
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/registrations':
            try:
                conn = sqlite3.connect(DB_FILE)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM registrations ORDER BY createdAt DESC')
                rows = cursor.fetchall()
                conn.close()
                
                results = []
                for r in rows:
                    res = dict(r)
                    res['paymentVerified'] = bool(res['paymentVerified'])
                    results.append(res)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                print(f"Error: {e}")
            return
            
        # Serve static files for any other GET requests
        return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        # Helper to read JSON
        def read_json():
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            return json.loads(post_data.decode('utf-8'))
        
        if parsed_path.path == '/api/register':
            try:
                data = read_json()
                
                conn = sqlite3.connect(DB_FILE)
                cursor = conn.cursor()
                
                # Check for duplicate UID
                cursor.execute('SELECT 1 FROM registrations WHERE uid = ?', (data.get('uid'),))
                if cursor.fetchone() is not None:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "This Free Fire UID is already registered!"}).encode('utf-8'))
                    conn.close()
                    return

                doc_id = str(uuid.uuid4())
                created_at = datetime.datetime.utcnow().isoformat() + 'Z'
                
                cursor.execute('''
                    INSERT INTO registrations (id, teamName, playerName, uid, phone, email, screenshotUrl, paymentVerified, createdAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    doc_id,
                    data.get('teamName'),
                    data.get('playerName'),
                    data.get('uid'),
                    data.get('phone'),
                    data.get('email', ''),
                    data.get('screenshotUrl', ''),
                    False,
                    created_at
                ))
                
                conn.commit()
                conn.close()
                
                self.send_response(201)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "id": doc_id}).encode('utf-8'))
                
            except Exception as e:
                print(e)
                self.send_response(500)
                self.end_headers()

        elif parsed_path.path == '/api/verify':
            try:
                data = read_json()
                doc_id = data.get('id')
                
                conn = sqlite3.connect(DB_FILE)
                cursor = conn.cursor()
                cursor.execute('UPDATE registrations SET paymentVerified = ? WHERE id = ?', (True, doc_id))
                conn.commit()
                conn.close()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                print(e)
                self.send_response(500)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8000):
    init_db()
    server_address = ('', port)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"Starting server on http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
