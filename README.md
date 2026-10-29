# Live Result Publishing & Display System

A complete enterprise-grade, real-time Result Publishing and Display solution with:
- **User Client Web Application** (`/` or `/user`): Pixel-perfect recreation of the reference screenshots (Pink retro theme, Captcha verification, 4 Golden 3D result cards with live sync, and 59-slot All Results table).
- **Admin Management Panel** (`/admin`): Secure authentication, Quick 15-Minute Slot Publisher (08:30 AM to 11:00 PM), 59-Slot Daily Schedule Matrix, and System Settings.
- **Dual-Database Engine**: 
  - **PostgreSQL 16**: Enterprise production mode (via `DATABASE_URL` or Docker).
  - **SQLite (WAL mode)**: Zero-config local development mode.
- **Docker & Docker Compose**: 1-click production container deployment.
- **Android App Specification & APIs** (`/android`): Clean REST API endpoints and ready-to-use Kotlin Retrofit models.

---

## 🏷️ Unique Group Prefixes
The 4 prefixes across the system are configured as:
1. **`R$R`** (Group 1)
2. **`C$H`** (Group 2)
3. **`N$V`** (Group 3)
4. **`R$Y`** (Group 4)

*(Note: These can also be customized anytime inside the Admin Panel Settings modal)*

---

## 🚀 Local Quick Start (Without Docker)

### 1. Requirements
- Node.js (v20+ or v24)

### 2. Run Locally
```bash
cd /Users/ashishranjan/.gemini/antigravity/scratch/result-publisher-system
npm install
node server/server.js
```
- **User Web App**: [http://localhost:3000/](http://localhost:3000/)
- **Admin Panel**: [http://localhost:3000/admin/](http://localhost:3000/admin/)

---

## 🐳 Production Deployment with Docker & PostgreSQL (VPS)

### Option A: Using the Automated 1-Click Script
On your Ubuntu/Debian VPS:
```bash
git clone <your-repo-url> result-system
cd result-system
bash deploy.sh
```

### Option B: Using Docker Compose Manually
```bash
# 1. Start PostgreSQL + Application containers in background
docker compose up -d --build

# 2. Check running container status
docker compose ps

# 3. View live logs
docker compose logs -f app
```

The stack automatically boots:
- **`postgres` container**: PostgreSQL 16 Alpine with persistent volume `postgres_data`.
- **`app` container**: Node.js production server connected to PostgreSQL via internal Docker network.

---

## 🔐 Admin Default Credentials
- **Username**: `admin`
- **Password**: `admin123`
*(Can be changed anytime inside Admin Settings)*

---

## 🌐 Production NGINX Reverse Proxy & SSL (Recommended for VPS)

To point your custom domain (e.g. `results.yourdomain.com`) with free HTTPS:

```nginx
server {
    server_name results.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Keep-alive for Server-Sent Events (SSE)
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```

Enable free SSL via Certbot:
```bash
sudo certbot --nginx -d results.yourdomain.com
```

---

## 📱 Android Client App
Complete Android API documentation, Kotlin Retrofit models, and WebView setup are provided in:
👉 [android/README.md](file:///Users/ashishranjan/.gemini/antigravity/scratch/result-publisher-system/android/README.md)

---

## 🧪 Automated Testing
```bash
node tests/api_test.js
```
All 19 test assertions pass with 100% success rate.
