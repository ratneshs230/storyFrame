from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import urllib.request
import urllib.error
import os
import re
import uuid
from datetime import datetime

WEBHOOK_URL = 'https://baklol23.app.n8n.cloud/webhook/ac028f2c-741e-4bc8-9257-e3d8c5e5ee5a'
IMAGES_DIR = os.path.join(os.path.dirname(__file__), 'images')

# Create images directory if it doesn't exist
os.makedirs(IMAGES_DIR, exist_ok=True)

def sanitize_folder_name(text):
    """Create a safe folder name from text"""
    # Take first 30 chars, remove special chars, replace spaces with underscores
    text = text[:30].strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'\s+', '_', text)
    return text.lower() or 'project'

def extract_file_id(url):
    """Extract Google Drive file ID from various URL formats"""
    if '/d/' in url:
        match = re.search(r'/d/([^/]+)', url)
        if match:
            return match.group(1)
    if 'id=' in url:
        match = re.search(r'id=([^&]+)', url)
        if match:
            return match.group(1)
    return None

def download_image(url, project_dir):
    """Download image from URL and save to project directory, return local path"""
    try:
        file_id = extract_file_id(url)
        if file_id:
            # Use Google Drive direct download URL
            download_url = f'https://drive.google.com/uc?id={file_id}&export=download'
        else:
            download_url = url

        # Generate unique filename
        filename = f'{uuid.uuid4().hex}.png'
        filepath = os.path.join(project_dir, filename)

        # Download the image
        req = urllib.request.Request(download_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=30) as response:
            with open(filepath, 'wb') as f:
                f.write(response.read())

        # Return relative path from images directory
        project_name = os.path.basename(project_dir)
        return f'/images/{project_name}/{filename}'
    except Exception as e:
        print(f'Error downloading image {url}: {e}')
        return None

class CORSHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/webhook'):
            try:
                url = WEBHOOK_URL
                if '?' in self.path:
                    url += '?' + self.path.split('?', 1)[1]
                req = urllib.request.Request(url, method='GET')
                with urllib.request.urlopen(req, timeout=120) as response:
                    result = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(result)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/webhook':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                # Parse request to get project name from videoScript
                request_data = json.loads(post_data)
                video_script = request_data.get('videoScript', 'project')

                # Create project folder with timestamp and sanitized name
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                folder_name = f'{timestamp}_{sanitize_folder_name(video_script)}'
                project_dir = os.path.join(IMAGES_DIR, folder_name)
                os.makedirs(project_dir, exist_ok=True)
                print(f'Created project folder: {project_dir}')

                req = urllib.request.Request(
                    WEBHOOK_URL,
                    data=post_data,
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=120) as response:
                    result = response.read()

                    # Parse response and download images
                    try:
                        data = json.loads(result)
                        results = []

                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, dict) and 'links' in item:
                                    img_url = item['links']
                                    title = item.get('Image Title', f'Frame {len(results) + 1}')
                                    local_path = download_image(img_url, project_dir)
                                    if local_path:
                                        results.append({'url': local_path, 'title': title})
                                        print(f'Downloaded: {img_url} -> {local_path}')
                                elif isinstance(item, str):
                                    local_path = download_image(item, project_dir)
                                    if local_path:
                                        results.append({'url': local_path, 'title': f'Frame {len(results) + 1}'})

                        # Return images with titles and project info
                        result = json.dumps({
                            'images': results,
                            'projectId': folder_name,
                            'projectPath': f'/images/{folder_name}'
                        }).encode()
                    except json.JSONDecodeError:
                        pass  # Return original response if not JSON

                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(result)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    server = HTTPServer(('0.0.0.0', port), CORSHandler)
    print(f'Server running on port {port}')
    print(f'Images will be saved to: {IMAGES_DIR}')
    server.serve_forever()
