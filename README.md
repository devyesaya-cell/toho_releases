# 🚀 VPS Storage & Release Hub

Self-hosted **GitHub Releases Alternative** and **Universal Object Storage API** with a built-in modern dark-mode Web Dashboard. Built with **Node.js**, **TypeScript**, **Fastify**, and **SQLite**.

Designed specifically for distributing mobile/tablet apps (such as Flutter Toho EGS), desktop software, firmware binaries, 3D CAD models, and general assets directly from your own VPS.

---

## ✨ Features

- **GitHub Release Equivalent**:
  - Semantic tagging (`v1.2.0`, `v1.2.1`), release titles, and Markdown changelogs.
  - Multi-platform targeting (`android`, `windows`, `linux`, `ios`, `all`).
  - Attach APK, EXE, MSIX, ZIP, or binary packages.
  - Automatic stream-based **SHA-256** and **MD5** checksum hashing for file integrity verification.
  - Download count tracking for every release asset.
  - Mandatory update threshold enforcement (`is_mandatory` and `min_supported_version`).

- **Universal File Storage**:
  - Object storage categorized into buckets (`general`, `firmware`, `models`, `images`, `docs`).
  - Direct public links (`https://your-vps/files/firmware/sensor_v2.bin`) for zero-friction access by other apps.
  - Drag-and-drop file uploader with real-time progress indicators.

- **Client Auto-Update Endpoint**:
  - `GET /api/v1/releases/latest?app=toho_egs&platform=android&current_version=v1.0.0`
  - Instantly informs your Flutter app whether an update is available, if it's mandatory, and provides direct download links and checksums.

- **Web App Dashboard**:
  - Sleek, modern dark-mode glassmorphism interface.
  - Complete control over apps, releases, file storage, and API keys without touching the terminal.
  - Interactive live auto-update tester and copy-paste code snippets for Flutter, cURL, and Node.js.

- **Interactive API Documentation**:
  - Built-in Swagger OpenAPI UI accessible at `http://your-vps:3000/docs`.

- **Zero Heavy Dependencies**:
  - Utilizes Node.js native `node:sqlite` database (`DatabaseSync`) in WAL mode. No external database server (PostgreSQL/MySQL) or C++ compile tools (`node-gyp`) required.

---

## 🛠️ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
PORT=3000
HOST=0.0.0.0
BASE_URL=http://localhost:3000
MASTER_KEY=vps_secret_admin_key_2026
STORAGE_DIR=./uploads
DB_PATH=./data/storage.db
MAX_FILE_SIZE_MB=500
```

### 3. Run in Development Mode
```bash
npm run dev
```

### 4. Build and Run Production
```bash
npm run build
npm run start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🌐 Deploying to VPS

### Option A: Docker Compose (Recommended)

1. Clone or copy this repository to your VPS (e.g. `/var/www/vps_storage_hub`).
2. Update `BASE_URL` and `MASTER_KEY` in `docker-compose.yml`.
3. Start the container:
```bash
docker compose up -d --build
```
Your service will be running on port `3000` with data stored persistently in `./uploads` and `./data`.

---

### Option B: PM2 (Node.js Process Manager)

1. Install Node.js (v22 or v24 LTS) and PM2 on your VPS:
```bash
sudo npm install -g pm2
```
2. In the project folder, build and start:
```bash
npm install
npm run build
pm2 start dist/server.js --name "vps-storage-api"
pm2 save
pm2 startup
```

---

### Option C: Nginx Reverse Proxy with Free SSL (Certbot)

Copy `nginx.conf.example` to `/etc/nginx/sites-available/storage.yourdomain.com`:
```nginx
server {
    listen 80;
    server_name storage.yourdomain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```
Enable the site and obtain SSL:
```bash
sudo ln -s /etc/nginx/sites-available/storage.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d storage.yourdomain.com
```

---

## 📱 Flutter Client Integration Example

Add this service to your Flutter project (e.g. `lib/core/services/update_service.dart`):

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class UpdateService {
  static const String baseUrl = 'https://storage.yourdomain.com';
  static const String appId = 'toho_egs';

  /// Check whether an update is available on the VPS
  static Future<Map<String, dynamic>?> checkUpdate(String currentVersion) async {
    final uri = Uri.parse(
      '$baseUrl/api/v1/releases/latest?app=$appId&platform=android&current_version=$currentVersion',
    );

    try {
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final data = body['data'];

        if (data['has_update'] == true) {
          return {
            'hasUpdate': true,
            'isMandatory': data['is_mandatory'] ?? false,
            'latestVersion': data['latest_version'],
            'releaseTitle': data['release_title'],
            'releaseNotes': data['release_notes'],
            'downloadUrl': data['primary_asset']?['download_url'],
            'sha256': data['primary_asset']?['sha256'],
          };
        }
      }
    } catch (e) {
      print('Failed to check update: $e');
    }
    return null;
  }
}
```

---

## 📡 REST API Summary

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/releases/latest` | **Check latest release / auto-update** | Public |
| `GET` | `/api/v1/releases` | List releases for an application | Public |
| `POST` | `/api/v1/releases` | Publish a new release | Admin |
| `POST` | `/api/v1/releases/:id/assets` | Upload and attach APK/binary asset | Admin |
| `GET` | `/api/v1/releases/download/:id` | Download release asset | Public |
| `GET` | `/api/v1/storage/files` | List stored files (filter by bucket) | Public / Read |
| `POST` | `/api/v1/storage/upload` | Upload file to bucket storage | Admin |
| `GET` | `/files/:bucket/:fileName` | **Direct static public link to file** | Public |
| `GET` | `/api/v1/keys` | List API keys | Admin |
| `POST` | `/api/v1/keys` | Generate new API key | Admin |
| `GET` | `/api/v1/stats` | System & storage usage metrics | Public |
| `GET` | `/docs` | Interactive Swagger OpenAPI docs | Public |
