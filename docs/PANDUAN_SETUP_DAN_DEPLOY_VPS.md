# 📘 Panduan Lengkap: Setup, Deployment VPS via Docker Compose & Troubleshooting

Dokumen ini adalah panduan komprehensif langkah demi langkah untuk membangun, mengoperasikan, dan mendeploy **VPS Storage & Release Gateway** (alternatif GitHub Releases & Universal Object Storage) ke server VPS.

---

## 📑 Daftar Isi
1. [Konsep & Arsitektur Sistem](#1-konsep--arsitektur-sistem)
2. [Struktur File & Direktori Proyek](#2-struktur-file--direktori-proyek)
3. [Setup & Pengujian di Lokal (Development)](#3-setup--pengujian-di-lokal-development)
4. [Langkah Demi Langkah Deploy ke VPS via Docker Compose](#4-langkah-demi-langkah-deploy-ke-vps-via-docker-compose)
5. [Konfigurasi Nginx Reverse Proxy & SSL (HTTPS)](#5-konfigurasi-nginx-reverse-proxy--ssl-https)
6. [Panduan Troubleshooting Nyata (Known Issues & Solusi)](#6-panduan-troubleshooting-nyata-known-issues--solusi)
7. [Panduan Penggunaan Web Dashboard](#7-panduan-penggunaan-web-dashboard)
8. [Integrasi ke Aplikasi Klien (Flutter / Android / cURL)](#8-integrasi-ke-aplikasi-klien-flutter--android--curl)
9. [SOP Pemeliharaan & Backup Data](#9-sop-pemeliharaan--backup-data)

---

## 1. Konsep & Arsitektur Sistem

Sistem ini menggabungkan dua fungsi utama dalam satu server ringan:
1. **GitHub Releases Clone (Auto-Update Engine)**:
   - Manajemen versi aplikasi (tag semantic `v1.2.0`, build number, target platform, changelog).
   - Distribusi paket biner (`.apk`, `.exe`, `.msix`, `.zip`).
   - Perhitungan hash otomatis (**SHA-256** dan **MD5**) via *stream* tanpa membebani RAM VPS.
   - Endpoint pengecekan update otomatis untuk aplikasi Flutter (`GET /api/v1/releases/latest`).
   - Pelacakan jumlah unduhan (*download count*) per file.
2. **Universal Object Storage**:
   - Penyimpanan file arbitrary (firmware, gambar, 3D CAD model, PDF/dokumen).
   - Pengorganisasian berbasis *bucket* (`firmware`, `models`, `images`, `docs`, `general`).
   - URL publik langsung (*direct public link*): `https://domainkamu.com/files/firmware/sensor.bin`.
3. **Web Dashboard & Swagger UI**:
   - Tampilan visual modern (*dark-mode glassmorphism*) untuk upload dan monitoring.
   - Dokumentasi OpenAPI interaktif di `/docs`.

```
                    +-------------------------------------------------+
                    |                   Klien / User                  |
                    |   (Browser / Flutter App Toho EGS / cURL / CI)  |
                    +-------------------------------------------------+
                                             |
                                             v  Port 80 / 443 (HTTPS)
                    +-------------------------------------------------+
                    |           Nginx Reverse Proxy & Certbot         |
                    +-------------------------------------------------+
                                             |  proxy_pass (Port 3005)
                                             v
+-----------------------------------------------------------------------------------------+
| VPS Docker Container (vps_storage_hub)                                                  |
|                                                                                         |
|   +-----------------------+     +------------------------+     +--------------------+   |
|   | Fastify Server        | <-> | Database SQLite (WAL)  | <-> | Local File Storage |   |
|   | (Auth, API, WebApp)   |     | (/app/data/storage.db) |     | (/app/uploads)     |   |
|   +-----------------------+     +------------------------+     +--------------------+   |
+-----------------------------------------------------------------------------------------+
                                             ^                            ^
                                             | Volume Mount               | Volume Mount
                              +----------------------------+  +---------------------------+
                              | Host Disk: ./data          |  | Host Disk: ./uploads      |
                              +----------------------------+  +---------------------------+
```

---

## 2. Struktur File & Direktori Proyek

```
c:\apps\vps_storage_API/
├── Dockerfile                  # Multi-stage lightweight Docker image (Node Alpine)
├── docker-compose.yml          # Konfigurasi container, port mapping, dan persistent volumes
├── nginx.conf.example          # Template konfigurasi reverse proxy Nginx
├── package.json                # Dependencies Fastify, Swagger, Multipart, SQLite
├── tsconfig.json               # Konfigurasi TypeScript modern (NodeNext)
├── .env.example                # Template konfigurasi variabel lingkungan
├── .env                        # Variabel lingkungan lokal
├── .gitignore                  # Mengabaikan node_modules, data DB, uploads, dan .env
├── README.md                   # Dokumentasi ringkas proyek
├── docs/
│   └── PANDUAN_SETUP_DAN_DEPLOY_VPS.md # Dokumen panduan ini
├── src/
│   ├── server.ts               # Entry point Fastify, registrasi Swagger, CORS & Static
│   ├── config.ts               # Loader konfigurasi lingkungan
│   ├── db/
│   │   └── index.ts            # SQLite manager (node:sqlite) + migrasi otomatis
│   ├── modules/
│   │   ├── auth/auth.ts        # Verifikasi API Key / Master Key
│   │   ├── releases/           # Kontroller, servis & rute rilis aplikasi
│   │   ├── storage/            # Kontroller, servis & rute penyimpanan file/bucket
│   │   ├── keys/               # Manajemen token API
│   │   └── stats/              # Statistik sistem dan penggunaan disk
│   └── utils/
│       └── hash.ts             # Perhitungan SHA-256 & MD5 via stream crypto
├── public/                     # WebApp Dashboard Single Page Application
│   ├── index.html              # Struktur UI antarmuka web
│   ├── css/style.css           # Styling glassmorphism dark-mode
│   └── js/
│       ├── api.js              # HTTP client komunikasi API & uploader progress
│       └── app.js              # Router SPA, state store, event listeners
├── uploads/                    # Folder fisik penyimpanan file (di-mount ke Docker)
│   ├── releases/               # File APK & biner rilis
│   └── files/                  # File universal object storage
└── data/                       # Folder fisik database SQLite (storage.db)
```

---

## 3. Setup & Pengujian di Lokal (Development)

Sebelum deploy ke VPS, Anda dapat menjalankan dan menguji proyek ini di komputer lokal:

### 1. Install Dependencies
```bash
npm install
```

### 2. Konfigurasi Variabel Lingkungan
Buat file `.env` dari `.env.example`:
```env
PORT=3000
HOST=0.0.0.0
BASE_URL=http://localhost:3000
MASTER_KEY=vps_secret_admin_key_2026
STORAGE_DIR=./uploads
DB_PATH=./data/storage.db
MAX_FILE_SIZE_MB=500
```

### 3. Jalankan Server
- Mode pengembangan (*auto-reload*):
  ```bash
  npm run dev
  ```
- Mode build & produksi lokal:
  ```bash
  npm run build
  npm run start
  ```

Buka di browser:
- **Web Dashboard**: `http://localhost:3000/`
- **Swagger Docs**: `http://localhost:3000/docs`

---

## 4. Langkah Demi Langkah Deploy ke VPS via Docker Compose

### Langkah 4.1: Install Docker & Docker Compose di VPS
Masuk ke terminal VPS via SSH:
```bash
ssh root@IP_VPS_KAMU
```

Jalankan perintah resmi instalasi Docker (Ubuntu/Debian):
```bash
# Update repository
sudo apt update && sudo apt upgrade -y

# Install Docker via script otomatis resmi
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verifikasi instalasi
docker --version
docker compose version
```

---

### Langkah 4.2: Transfer Source Code ke VPS
Di komputer lokal Anda, buka terminal PowerShell dan salin folder proyek ke VPS:
```powershell
# 1. Buat direktori di VPS
ssh root@IP_VPS_KAMU "mkdir -p /opt/toho_releases"

# 2. Salin seluruh file proyek (kecuali node_modules)
scp -r * root@IP_VPS_KAMU:/opt/toho_releases/
```
*(Atau jika menggunakan Git: `git clone https://github.com/akun/vps_storage_API.git /opt/toho_releases`)*.

---

### Langkah 4.3: Menyesuaikan `docker-compose.yml` di VPS
Masuk ke direktori proyek di VPS:
```bash
cd /opt/toho_releases
nano docker-compose.yml
```

> [!IMPORTANT]
> **Pahami Aturan Port Mapping Docker:**  
> Format port adalah `"PORT_HOST_VPS:PORT_CONTAINER"`.  
> Jika Anda ingin mengakses aplikasi dari port **3005** di VPS, dan di dalam container aplikasi Fastify mendengarkan di port **3000**, maka konfigurasinya adalah:

```yaml
services:
  storage-api:
    build: .
    container_name: vps_storage_hub
    restart: unless-stopped
    ports:
      - "3005:3000"   # Port 3005 di VPS diteruskan ke Port 3000 di dalam container
    environment:
      - PORT=3000     # Port aplikasi di dalam container
      - HOST=0.0.0.0
      - BASE_URL=https://storage.domainkamu.com # Domain Anda (atau http://IP_VPS:3005)
      - MASTER_KEY=kunci_rahasia_admin_vps_2026 # GANTI DENGAN KUNCI AMAN
      - STORAGE_DIR=/app/uploads
      - DB_PATH=/app/data/storage.db
      - MAX_FILE_SIZE_MB=500
    volumes:
      - ./uploads:/app/uploads
      - ./data:/app/data
```
Tekan `CTRL + O`, `Enter` untuk menyimpan, lalu `CTRL + X` untuk keluar.

---

### Langkah 4.4: Jalankan Container
Jalankan perintah berikut:
```bash
docker compose up -d --build
```

Periksa status container:
```bash
docker compose ps
```
Hasil yang benar akan menunjukkan:
```text
NAME              IMAGE                       STATUS         PORTS
vps_storage_hub   toho_releases-storage-api   Up x minutes   0.0.0.0:3005->3000/tcp
```

Uji respons aplikasi langsung di terminal VPS:
```bash
curl -I http://127.0.0.1:3005
```
Output wajib berupa: `HTTP/1.1 200 OK`.

---

## 5. Konfigurasi Nginx Reverse Proxy & SSL (HTTPS)

> [!WARNING]
> **Kenapa HTTPS Wajib untuk Aplikasi Android?**  
> Sejak Android 9 (API 28 ke atas), sistem Android memblokir lalu lintas *cleartext HTTP* biasa secara default demi keamanan. Jika Anda mendistribusikan APK untuk diunduh oleh aplikasi Flutter di tablet/ponsel Android, domain **WAJIB menggunakan HTTPS** agar proses download tidak diblokir oleh OS Android.

### Langkah 5.1: Arahkan DNS Subdomain
Di panel DNS domain Anda (Cloudflare / Niagahoster / dll):
- **Type**: `A`
- **Name**: `storage` (menghasilkan `storage.domainkamu.com`)
- **IPv4 Address**: `IP_VPS_KAMU`

---

### Langkah 5.2: Install Nginx di VPS
```bash
sudo apt install nginx -y
```

---

### Langkah 5.3: Buat File Konfigurasi Nginx
Buat file virtual host dengan nama domain Anda:
```bash
sudo nano /etc/nginx/sites-available/storage.domainkamu.com
```

Isi dengan konfigurasi berikut:
```nginx
server {
    listen 80;
    server_name storage.domainkamu.com;

    # Wajib 500M agar upload file APK / ZIP besar tidak terkena error 413 Request Entity Too Large
    client_max_body_size 500M;

    location / {
        # Arahkan ke port host Docker yang Anda pakai (contoh: 3005)
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Matikan proxy buffering agar streaming download file APK berjalan maksimal
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```
Simpan file (`CTRL + O`, `Enter`, `CTRL + X`).

---

### Langkah 5.4: Aktifkan Konfigurasi & Tes Nginx
```bash
# 1. Buat symlink dari sites-available ke sites-enabled
sudo ln -s /etc/nginx/sites-available/storage.domainkamu.com /etc/nginx/sites-enabled/

# 2. Tes sintaks konfigurasi Nginx
sudo nginx -t
```
Jika muncul pesan:
```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

---

### Langkah 5.5: Pasang SSL Gratis (Let's Encrypt Certbot)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d storage.domainkamu.com
```
Ikuti instruksi di layar (masukkan email dan setujui Terms of Service). Certbot akan otomatis mengaktifkan HTTPS dan mengatur auto-renewal SSL setiap 90 hari!

---

## 6. Panduan Troubleshooting Nyata (Known Issues & Solusi)

Berikut adalah ringkasan masalah nyata yang sering terjadi di VPS beserta cara memperbaikinya:

### 🔴 Masalah 1: Domain Dibuka Masih Menampilkan Halaman "Welcome to nginx!"
- **Penyebab**: File default bawaan Nginx (`/etc/nginx/sites-enabled/default`) masih aktif dan menangkap semua request HTTP.
- **Solusi**:
  ```bash
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
  ```
  Lalu buka kembali domain di browser menggunakan **Incognito / Private Window** (agar tidak terkena cache).

---

### 🔴 Masalah 2: Error `open() failed (2: No such file or directory) in /etc/nginx/nginx.conf` saat `nginx -t`
- **Penyebab**: Terdapat *broken symlink* di folder `/etc/nginx/sites-enabled/` yang mengarah ke file yang tidak ada (misalnya salah mengetik nama file atau menggunakan teks contoh `namadomain.com`).
- **Solusi**:
  ```bash
  # 1. Hapus symlink yang rusak
  sudo rm -f /etc/nginx/sites-enabled/namadomain.com

  # 2. Cek nama file asli yang ada di sites-available
  ls -la /etc/nginx/sites-available/

  # 3. Buat ulang symlink menggunakan nama file asli
  sudo ln -s /etc/nginx/sites-available/NAMA_FILE_ASLI /etc/nginx/sites-enabled/

  # 4. Tes ulang
  sudo nginx -t && sudo systemctl reload nginx
  ```

---

### 🔴 Masalah 3: Muncul Halaman "502 Bad Gateway"
- **Penyebab**: Nginx menerima request domain, tetapi **gagal tersambung** ke container aplikasi karena ketidakcocokan port (*port mismatch*).
- **Pemeriksaan**:
  Jalankan di VPS:
  ```bash
  curl -I http://127.0.0.1:3005
  ```
  Jika muncul `Connection refused`, berarti port di `docker-compose.yml` salah mapping.
- **Solusi**:
  1. Pastikan di `docker-compose.yml`:
     ```yaml
     ports:
       - "3005:3000"   # Host 3005 -> Container 3000
     ```
  2. Pastikan di Nginx:
     ```nginx
     proxy_pass http://127.0.0.1:3005;
     ```
  3. Restart container:
     ```bash
     docker compose up -d
     ```

---

### 🔴 Masalah 4: Container Status "Restarting (1)" atau Crash
- **Penyebab**: Ada error saat runtime atau port sudah digunakan oleh aplikasi lain.
- **Pemeriksaan**:
  ```bash
  docker compose logs --tail=50
  ```
- **Solusi**: Periksa log tersebut. Jika port bentrok, ganti port host di `docker-compose.yml` (misal dari 3005 ke 3010).

---

## 7. Panduan Penggunaan Web Dashboard

Setelah mengakses URL `https://storage.domainkamu.com/`:

### A. Otentikasi Admin
1. Klik badge **Admin Key** di pojok kanan atas navbar.
2. Masukkan `MASTER_KEY` yang Anda set di `docker-compose.yml`.
3. Kunci tersimpan otomatis di browser (`localStorage`), memberi Anda wewenang penuh untuk membuat rilis dan upload file.

### B. Menerbitkan Rilis Baru
1. Masuk ke tab **Releases & Updates**.
2. Klik tombol **New Application** jika ingin mendaftarkan ID app baru (misal: `toho_egs`).
3. Klik **Publish New Release**:
   - **Tag**: `v1.2.0`
   - **Title**: `Release 1.2.0 - Dual Antenna RTK Upgrade`
   - **Build Number**: `45`
   - **Target Platform**: `android`
   - **Minimum Supported Version**: `v1.0.0` (jika versi klien lebih rendah dari ini, update dipaksa wajib).
   - **Mandatory Update**: Centang jika merupakan update krusial.
   - **Release Notes**: Masukkan changelog format Markdown.
4. Klik **Create Release**.
5. Pada kartu rilis yang muncul, klik **Attach File** atau langsung **Drag & Drop** file APK ke area dropzone. File akan diupload, dihitung SHA-256 secara otomatis, dan link download langsung aktif!

### C. Universal File Storage
1. Masuk ke tab **File Storage**.
2. Pilih atau buat kategori *bucket* (`firmware`, `models`, `images`, `docs`, `general`).
3. Drag & drop file apa saja ke dropzone.
4. Setiap file memiliki:
   - Tombol **Link**: Menyalin URL publik langsung untuk dipakai di aplikasi lain.
   - Tombol **Hash**: Melihat dan menyalin checksum SHA-256 dan MD5.
   - Tombol **Download** & **Delete**.

---

## 8. Integrasi ke Aplikasi Klien (Flutter / Android / cURL)

### Format Endpoint Auto-Update
Aplikasi klien mengecek versi terbaru dengan memanggil:
```http
GET https://storage.domainkamu.com/api/v1/releases/latest?app=toho_egs&platform=android&current_version=v1.0.0
```

### Contoh JSON Response yang Diterima Klien:
```json
{
  "success": true,
  "data": {
    "has_update": true,
    "is_mandatory": true,
    "app_id": "toho_egs",
    "app_name": "Toho EGS Guidance System",
    "latest_version": "v1.2.0",
    "build_number": 45,
    "release_title": "Toho Guidance v1.2.0 - Dual Antenna RTK Update",
    "release_notes": "- Added dual-antenna calibration\n- Fixed sensor freeze bug\n- Upgraded map engine",
    "published_at": 1792130909,
    "target_platform": "android",
    "primary_asset": {
      "file_name": "toho_egs_v1.2.0.apk",
      "download_url": "https://storage.domainkamu.com/api/v1/releases/download/ast_8jwl4d98/toho_egs_v1.2.0.apk",
      "file_size": 45120300,
      "sha256": "105005417cb2b0e2943240bc460c6bb3a6621016c89882625d9ebf426f001001",
      "md5": "ad45ace34a3917f9fff00d2cc3d0ed90"
    }
  }
}
```

### Implementasi Lengkap di Flutter (Dart)
Simpan file ini di proyek Flutter Anda (misal `lib/core/services/update_service.dart`):

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class UpdateService {
  static const String serverBaseUrl = 'https://storage.domainkamu.com';
  static const String currentAppId = 'toho_egs';

  /// Memeriksa apakah ada update baru di VPS
  static Future<Map<String, dynamic>?> checkUpdate({required String currentVersion}) async {
    final uri = Uri.parse(
      '$serverBaseUrl/api/v1/releases/latest?app=$currentAppId&platform=android&current_version=$currentVersion',
    );

    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body);
        final data = body['data'];

        if (data != null && data['has_update'] == true) {
          return {
            'hasUpdate': true,
            'isMandatory': data['is_mandatory'] ?? false,
            'latestVersion': data['latest_version'] ?? '',
            'buildNumber': data['build_number'] ?? 0,
            'title': data['release_title'] ?? '',
            'notes': data['release_notes'] ?? '',
            'downloadUrl': data['primary_asset']?['download_url'] ?? '',
            'sha256': data['primary_asset']?['sha256'] ?? '',
            'fileSize': data['primary_asset']?['file_size'] ?? 0,
          };
        }
      }
    } catch (e) {
      // Tangani timeout atau koneksi offline tanpa mengganggu alur utama aplikasi
      print('Update check failed: $e');
    }
    return null;
  }
}
```

---

## 9. SOP Pemeliharaan & Backup Data

### Cara Backup Database & File
Karena seluruh data disimpan di host pada volume `./data` dan `./uploads`, proses backup sangat mudah:
```bash
cd /opt/toho_releases
tar -czvf backup_storage_$(date +%F).tar.gz data uploads
```
File `backup_storage_YYYY-MM-DD.tar.gz` berisi seluruh riwayat rilis, API keys, dan seluruh file fisik yang pernah diunggah.

### Cara Update Aplikasi di Masa Depan
Jika ada perbaikan kode atau penambahan fitur di repositori:
```bash
cd /opt/toho_releases
git pull
docker compose up -d --build
```
*Tidak ada data yang hilang dan downtime hanya beberapa detik saat container baru dijalankan.*

### Perintah Penting Docker
| Kebutuhan | Perintah |
| :--- | :--- |
| **Cek status container** | `docker compose ps` |
| **Cek log real-time** | `docker compose logs -f` |
| **Restart container** | `docker compose restart` |
| **Matikan container** | `docker compose down` |
| **Cek konsumsi RAM/CPU** | `docker stats` |
