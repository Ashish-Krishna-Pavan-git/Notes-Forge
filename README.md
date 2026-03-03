# NotesForge

Transform any text into professional Word/PDF documents - React + FastAPI document formatter with marker-based parsing, live preview, themes, and AI-driven templates.

## Overview

NotesForge uses a strict line-marker syntax to generate consistent documents.
Every content line can be parsed deterministically (H1, H2, PARAGRAPH, BULLET, NUMBERED, CODE, TABLE, etc.).

Stack:
- Frontend: React + TypeScript + Vite + Tailwind + Axios
- Backend: FastAPI + python-docx + exporter/security helpers
- Deployment target: Vercel (frontend) + Render (backend)
- No Streamlit is used in this project

## Project Structure

```text
notesforge/
  backend/
    backend_server.py
    Core.py
    Config.py
    Themes.py
    Config.json
    Themes.json
    prompt.txt
    requirements.txt
    app/
      main.py
      parser.py
      exporter.py
      themes.py
      templates_repo.py
      security.py
      models.py
    tests/
  frontend/
    src/
      App.tsx
      main.tsx
      index.css
    package.json
  .env.example
  START.bat
  STOP.bat
  SETUP.bat
  LICENSE
```

## Quick Start

### Windows helpers

1. Setup once:
```bat
SETUP.bat
```
2. Start both services:
```bat
START.bat
```
3. Stop both services:
```bat
STOP.bat
```

`START.bat` now uses a relative repo root (`cd /d "%~dp0"`), so cloned repositories run without hardcoded paths.

### Manual run

Backend:
```powershell
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 10000
```

Frontend:
```powershell
cd frontend
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env` and adjust:

- `NF_CORS_ORIGINS`
- `FASTAPI_HOST`
- `FASTAPI_PORT`
- `DOCX_TEMP_DIR`
- `STORAGE_BACKEND`
- `VITE_API_URL`

## Deploy

### Render (backend)

- Root directory: `backend`
- Build command:
```bash
pip install -r requirements.txt
```
- Start command:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 10000
```
- Required env:
  - `FASTAPI_HOST=0.0.0.0`
  - `FASTAPI_PORT=10000`
  - `DOCX_TEMP_DIR=/tmp/notesforge`
  - `STORAGE_BACKEND=local`
  - `NF_CORS_ORIGINS=https://notes-forge-ruddy.vercel.app,https://notes-forge.onrender.com`

Recommended: use repo-managed [render.yaml](./render.yaml) so Render settings stay aligned with code.

### Vercel (frontend)

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Required env:
  - `VITE_API_URL=https://notes-forge.onrender.com`

## API Contract (Current)

Primary endpoints:
- `GET /api/health`
- `GET /api/health/parser`
- `POST /api/preview`
- `POST /api/generate`
- `GET /api/download/{fileId_or_filename}`
- `GET /api/templates`
- `POST /api/templates/regenerate`
- `POST /api/themes`

Legacy endpoints retained for compatibility:
- `GET /health`
- `POST /api/analyze`
- `GET /api/config`
- `POST /api/config/update`
- `GET /api/themes`
- `POST /api/themes/apply`
- `POST /api/themes/save`
- `POST /api/themes/delete`
- `GET /api/prompt`
- `POST /api/prompt`

`POST /api/generate` response includes:
- `success`
- `downloadUrl`
- `fileId`
- `filename`
- `requestedFormat`
- `actualFormat`
- `warning`
- `warnings`

## Strict Marker Mode

Frontend now includes a `Strict Mode` toggle in the editor toolbar.
When enabled:
- non-empty lines without a marker are flagged
- unknown markers are flagged
- generate/preview payloads include strict mode so backend can return deterministic warnings

## Production Engineering Plan (v5+)

### 1) Architecture changes
- Keep existing frontend/backend structure.
- Use contract-first APIs: `/api/preview`, `/api/generate`, `/api/templates`, `/api/themes`.
- Keep legacy endpoints for backward compatibility.
- Centralize parsing/export logic in backend `app/*` modules.

### 2) Tech stack upgrades
- Frontend: strict TypeScript + marker autocomplete + resilient fallback previews.
- Backend: FastAPI + python-docx + optional WeasyPrint/docx2pdf/LibreOffice PDF conversion.
- Security: pypdf-based password/metadata handling where available.

### 3) Parser strategy
- Deterministic line parser with explicit marker-first grammar.
- Strict mode warnings for non-marker lines.
- Support for alignment markers (`CENTER`, `RIGHT`, `JUSTIFY`) and `PAGEBREAK`.
- Preserve ASCII/code blocks exactly.

### 4) PDF strategy for Vercel + Render
- Generate PDF on backend (Render), not on frontend serverless runtime.
- Prefer HTML->PDF (WeasyPrint) when available for pagination control.
- Fallback to DOCX->PDF path (docx2pdf/LibreOffice).
- If unavailable, return DOCX with user-visible warning.

### 5) UI/UX strategy
- Keep existing app shell, improve hierarchy and editor ergonomics.
- Add strict mode, health status + retry, template regeneration panel.
- Keep onboarding contextual and dismissible.

### 6) Folder strategy
- Extend existing files/modules only.
- New modules/tests can be added, existing flow remains intact.
- No destructive project restructuring.

### 7) Deployment strategy
- Vercel frontend + Render backend.
- Set `VITE_API_URL` to backend public URL.
- Use env vars for host/port/CORS/temp storage.
- Keep theme/template stores persisted and versioned.

### 8) Suggested libraries
- `weasyprint` for production PDF where environment supports it.
- `pypdf` for PDF encryption/metadata handling.
- `python-docx` for DOCX generation and layout control.

### 9) Implementation snippets
- Strict marker warnings at preview/generate time.
- Marker autocomplete in editor (`Tab` to insert).
- `PAGEBREAK:` marker support in parser + HTML preview + DOCX export.

### 10) Rollout roadmap
1. Stabilize strict parser + template contract.
2. Verify PDF path in Render with environment package checks.
3. Harden theme sync and export parity.
4. Expand onboarding/help and marker examples.
5. Add integration tests for health/preview/templates/generate.

## Templates and AI Regeneration

Template catalog is loaded from backend (`/api/templates`) with built-in fallback templates if backend fails.

AI regeneration flow:
1. Choose template
2. Enter topic
3. Pick provider metadata
4. Click `Regenerate Content`

Backend returns:
- `content` (marker-formatted)
- `prompt` (full prompt used)

## PDF Export Notes

PDF export supports two paths:
- modern exporter path with theme/security payloads
- legacy LibreOffice conversion path

If PDF conversion is unavailable, backend returns a warning and falls back to DOCX (`actualFormat=docx`).

## Deployment Contract Verification

Run this against your deployed backend to catch API/version drift:

```powershell
cd backend
python scripts/verify_live_api.py https://notes-forge.onrender.com
```

It validates:
- `/api/health`
- `/api/config`
- `/api/config/update`
- `/api/templates`
- `/api/generate` PDF contract (including fallback warning behavior)

CI workflow is included at `.github/workflows/stability-checks.yml`:
- backend tests
- frontend production build
- optional live deployment contract check (set `LIVE_API_URL` secret)

## License

MIT License. See [LICENSE](./LICENSE).
