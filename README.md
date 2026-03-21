# Quick Doc Formatter v8

Quick Doc Formatter is a marker-driven document formatting app with a split architecture:
- `document theme` controls preview/export styling
- `app UI theme + mode` controls workspace look and music behavior

It preserves legacy marker syntax, adds v8 markers, and keeps backward compatibility for existing files.

## v8 Highlights
- Full rebrand from NotesForge to **Quick Doc Formatter**.
- Theme display rename: **Frontlines Edu Tech** -> **Daily Notes Maker** (`frontlines_edutech_theme` key unchanged).
- Canonical marker catalog API: `GET /api/markers`.
- New markers: `TIP`, `WARNING`, `INFO`, `SUCCESS`, `CALLOUT`, `SUMMARY`, `CHECKLIST` (`TASK`/`TODO` aliases), `EQUATION`, `SEPARATOR` (`HR`, `HORIZONTAL_RULE` aliases).
- Whitespace/tab-safe parsing with configurable `tab_width`.
- PDF contract: PDF requests always return `actualFormat=pdf`.
- PDF fallback chain: internal converters -> iLovePDF API fallback -> iLovePDF automation bridge -> low-fidelity internal fallbacks.
- Async large-export APIs with job progress tracking.
- Mode music upgrades: local files + direct media URLs; auto-next on track end; YouTube page links are blocked.
- Security hardening: request size limits, fixed-window rate limiting, secure response headers, SSRF-safe remote media validation, expiring download tokens.

## Architecture
- Backend: FastAPI (`backend/app/main.py`)
- Export engine: DOCX/PDF/HTML/MD/TXT (`backend/app/exporter.py`)
- Parser + marker catalog (`backend/app/parser.py`, `backend/app/markers.py`)
- Frontend: React + Vite (`frontend/src/pages/EditorWorkspacePage.tsx`)

## Installation

### 1) Local (manual)
#### Backend
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 10000
```

#### Frontend
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 2) One-click helpers (Windows)
1. `SETUP.bat`
2. `START.bat`
3. `STOP.bat`

### 3) Docker
```powershell
docker compose up --build
```

Default ports:
- frontend: `5173`
- backend: `10000`

### 4) Vercel + Render
- Frontend (Vercel): project root `frontend`, build `npm run build`, output `dist`.
- Backend (Render): root `backend`, start command:
  - `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`
- Set `VITE_API_URL` in frontend deployment.

## Core APIs
- `GET /api/health`
- `GET /api/health/parser`
- `GET /api/version`
- `GET /api/markers`
- `POST /api/analyze`
- `POST /api/preview`
- `POST /api/generate`
- `POST /api/generate/async`
- `GET /api/generate/jobs/{jobId}`
- `GET /api/generate/jobs/{jobId}/download`
- `GET /api/download/{token}`
- `GET /api/templates`
- `POST /api/templates/regenerate`
- `GET /api/themes`
- `POST /api/themes/apply`
- `POST /api/themes/save`
- `POST /api/themes/delete`
- `GET /api/config`
- `POST /api/config/update`
- `GET /api/prompt`
- `POST /api/prompt`

## PDF Behavior
- Requested format `pdf` always returns:
  - response: `actualFormat = "pdf"`
  - download content type: `application/pdf`
- `conversionEngine` and `externalFallbackUsed` identify the path used.

## Music Manifest Contract
File: `frontend/public/music/manifest.json`

```json
{
  "smooth": [
    { "title": "Local Track", "file": "my-track.mp3" },
    { "title": "CDN Track", "url": "https://cdn.example.com/track.mp3" }
  ],
  "focus": [
    "focus-loop.mp3"
  ]
}
```

Rules:
- `file`, `url`, or `link` source is accepted.
- Direct media URLs are supported.
- YouTube page links are rejected (`youtube.com/watch`, `youtu.be/...`).
- Playback is manual (no autoplay).
- Track auto-next is enabled.

## Security Notes
- Request body limit (`MAX_BODY_BYTES`).
- Fixed-window rate limit on write APIs.
- Secure headers on API responses.
- Remote media URL validation blocks private/loopback hosts by default.
- Download links use expiring, multi-use tokens.

## Documentation
- `docs/WORKING_GUIDE.md`
- `docs/DEPLOYMENT_VERCEL_RENDER_LOCAL.md`
- `docs/MARKER_REFERENCE_V7.md` (contains v8-compatible details)
- `docs/THEMES_TEMPLATES_V7.md`
- `docs/MIGRATION_V6_TO_V7.md`
