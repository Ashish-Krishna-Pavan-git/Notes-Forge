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
  database/
    migrations/
    seeders/
  docker/
    Dockerfile
  docker-compose.yml
  backend/
    app/                       # canonical FastAPI package
      main.py
      parser.py
      exporter.py
      themes.py
      templates_repo.py
      security.py
      models.py
    config/                    # env/path config helpers
    controllers/               # controller-facing app exports
    middleware/                # middleware helpers
    models/                    # model/schema wrappers
    routes/                    # route contract map
    services/                  # service wrappers
    utils/                     # shared helpers
    backend_server.py          # compatibility shim (legacy entrypoint)
    server.py                  # explicit backend entrypoint
    config.json                # canonical runtime config
    themes.json                # canonical theme catalog (builtins + custom)
    Config.json                # legacy backup (read-only migration source)
    Themes.json                # legacy backup (read-only migration source)
    prompt.txt
    requirements.txt
    tests/
  frontend/
    public/
    src/
      assets/
        images/
        icons/
      components/
      pages/
        EditorWorkspacePage.tsx
      services/
        api.ts
      config/
        env.ts
      context/
      hooks/
      utils/
      styles/
        globals.css
      main.tsx
      App.tsx
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

Local edit/update behavior:
- Frontend updates live via Vite HMR (`npm run dev`)
- Backend updates live via FastAPI reload (`--reload`)

## Environment

Copy `.env.example` to `.env` and adjust:

- `NF_CORS_ORIGINS`
- `FASTAPI_HOST`
- `FASTAPI_PORT`
- `DOCX_TEMP_DIR`
- `STORAGE_BACKEND`
- `NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK` (`0` recommended for DOCX-matching PDF)
- `VITE_API_URL`

## Deploy

### Render (backend)

- Recommended: use repo `render.yaml` (`env: docker`, `rootDir: backend`).
- If you already use `render.yaml`, you do **not** need to change build/start commands.
- After changing the Dockerfile, redeploy Render so the new image is rebuilt.
- The Docker build now verifies `soffice` during build, so deployment should fail early if LibreOffice is missing.
- If configuring manually (non-docker):
  - Root directory: `backend`
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`
- Required env:
  - `FASTAPI_HOST=0.0.0.0`
  - `FASTAPI_PORT=10000`
  - `DOCX_TEMP_DIR=/tmp/notesforge`
  - `STORAGE_BACKEND=local`
  - `NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK=0`
  - `NF_CORS_ORIGINS=https://notes-forge-ruddy.vercel.app,https://notes-forge.onrender.com`

Recommended: use repo-managed [render.yaml](./render.yaml) so Render settings stay aligned with code.

### Vercel (frontend)

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Required env:
  - `VITE_API_URL=https://notes-forge.onrender.com`
- If you already have this setup, no build-command change is required.
- For localhost, if `VITE_API_URL` is not set, frontend now auto-targets `http://localhost:10000`.

## Docker Setup

Run both frontend + backend:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:10000`

Stop:

```bash
docker compose down
```

## Beginner User Guide

### What this app does

NotesForge turns simple marker-based text into polished documents.
You write content using markers like `H1:`, `PARAGRAPH:`, `BULLET:`, `ASCII:`, and `CODE:`.
Then you export that content as `DOCX`, `PDF`, `HTML`, `Markdown`, or `TXT`.

### First-time steps

1. Open the app.
2. The guided tour starts automatically on first launch.
3. Go to `Templates` if you want a ready-made example.
4. Go to `Editor` and type or paste your content.
5. Use `Settings` to change fonts, colors, spacing, borders, header, and footer.
6. Choose `DOCX` or `PDF` in the export area.
7. Click `Generate Document`.

### Main parts of the interface

- `Editor`: Main writing area. Use it when you want to create or edit content.
- `Templates`: Load starter content or import template JSON files.
- `New User`: Simple help page with examples and a guided-tour restart button.
- `Settings`: Change how the document looks.
- `AI Prompt`: Manage your reusable AI prompt and import prompt files.
- `Shortcuts`: Quick reference for markers and keyboard shortcuts.

### Main buttons and when to use them

- `Generate Document`: Use when your content is ready and you want the final file.
- `Try Example`: Loads a sample document so you can see how the app works.
- `Strict ON/OFF`: Use this when you want the app to warn you about invalid lines.
- `Import Theme JSON`: Use when you want to load a full document style.
- `Import Templates`: Use when you want to add reusable document structures.
- `Import Prompt`: Use when you want to reuse a saved AI prompt.
- `Save Settings`: Use after changing fonts, colors, spacing, borders, header, footer, or watermark.

### Common tasks

Create a basic report:
1. Open `Templates`.
2. Load a report template.
3. Replace example text with your own content.
4. Open `Settings` if you want a different look.
5. Generate `DOCX` or `PDF`.

Use ASCII and CODE blocks:
1. Open `Editor`.
2. Add lines like `ASCII: +---+` and `CODE: print('hello')`.
3. Preview the result.
4. Export the document.

Import a theme:
1. Open `Settings`.
2. Click `Import Theme JSON`.
3. Choose your theme file.
4. Apply or edit the imported theme.

## Frontend Onboarding Flow

The app now includes a built-in guided tour.

On first launch it:
- starts automatically
- highlights important UI elements
- shows a tooltip for each step
- moves through the app with `Next`, `Back`, and `Skip`
- explains the editor, templates, settings, prompt tools, and export area

Tour steps:
1. Editor tab
2. Editor toolbar
3. Writing area
4. Export/generate area
5. Templates tab
6. Template import button
7. Settings tab
8. Theme import button
9. AI Prompt tab
10. Prompt import button

You can restart the tour from the `New User` tab or the onboarding card.

## API Contract (Current)

Primary endpoints:
- `GET /health`
- `GET /api/health`
- `GET /api/health/parser`
- `POST /api/preview`
- `POST /api/generate`
- `GET /api/download/{token}`
- `GET /api/templates`
- `POST /api/templates/regenerate`
- `GET /api/themes`
- `POST /api/themes`
- `POST /api/themes/apply`
- `POST /api/themes/save`
- `POST /api/themes/delete`
- `GET /api/config`
- `POST /api/config/update`
- `POST /api/analyze`
- `GET /api/prompt`
- `POST /api/prompt`
- `GET /api/version`

Legacy endpoints retained for compatibility:
- `GET /health/parser`

`POST /api/generate` response includes:
- `success`
- `downloadUrl`
- `fileId`
- `filename`
- `requestedFormat`
- `actualFormat`
- `warning`
- `warnings`

PDF contract:
- DOCX is always generated first.
- PDF is produced only through high-fidelity DOCX->PDF converters (`docx2pdf`, then LibreOffice).
- If no converter is available and `format=pdf`, response is still `200` with:
  - `requestedFormat: "pdf"`
  - `actualFormat: "docx"`
  - `warning` explaining fallback.

## Strict Marker Mode

Frontend now includes a `Strict Mode` toggle in the editor toolbar.
When enabled:
- non-empty lines without a marker are flagged
- unknown markers are flagged
- generate/preview payloads include strict mode so backend can return deterministic warnings

## Import Features (3)

Website now supports three import flows:
1. `Theme JSON import` (Settings -> Themes)
2. `Template JSON import` (Templates tab)
3. `Prompt import` (`.txt` or `.json`) (AI Prompt tab)

All three tabs also include a **Sample** download button.

Persistence behavior:
- Theme import: saved locally and also synced to backend theme API when available.
- Template import: stored in browser local storage (client-side catalog extension).
- Prompt import: applied locally and posted to backend prompt API when available.

### Theme JSON sample

```json
{
  "key": "oceanic_pro_import",
  "name": "Oceanic Pro Import",
  "description": "Full theme import with fonts, spacing, colors, page, header/footer",
  "config": {
    "fonts": { "family": "Segoe UI", "family_code": "Consolas" },
    "colors": { "h1": "#0F766E", "h2": "#0D9488", "table_header_bg": "#CCFBF1" },
    "spacing": { "line_spacing": 1.4 },
    "page": { "size": "A4", "orientation": "portrait" },
    "header": { "enabled": true, "text": "CONFIDENTIAL" },
    "footer": { "enabled": true, "show_page_numbers": true, "page_format": "Page X of Y" }
  }
}
```

### Template JSON sample (`ASCII:` + `CODE:`)

```json
{
  "templates": [
    {
      "id": "incident_ascii_code",
      "name": "Incident + ASCII + CODE",
      "category": "Technical",
      "icon": "🛡️",
      "content": "H1: Incident Investigation Report\nH2: Topology Diagram\nASCII: +---+ -> +---+\nH2: Commands Used\nCODE: python -m pytest -q"
    }
  ]
}
```

### Prompt JSON sample

```json
{
  "prompt": "Output strict NotesForge markers only. Use H1-H6, PARAGRAPH, BULLET, NUMBERED, TABLE, CODE, ASCII, PAGEBREAK."
}
```

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
- Use DOCX->PDF path for fidelity (docx2pdf first, LibreOffice second).
- If unavailable, return DOCX with user-visible warning and explicit `actualFormat=docx`.
- Goal is LibreOffice-style conversion quality similar to common DOCX->PDF services.

### 5) UI/UX strategy
- Keep existing app shell, improve hierarchy and editor ergonomics.
- Add strict mode, health status + retry, template regeneration panel.
- Keep onboarding contextual and dismissible.

### 6) Folder strategy
- Keep a layered shape similar to standard fullstack projects.
- Preserve compatibility entrypoints (`backend_server.py`, `app.main`) during migration.
- Expand incrementally: wrappers first, deeper module moves when stable.

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

For DOCX/PDF parity, backend prioritizes high-fidelity DOCX->PDF conversion:
- `docx2pdf`
- `LibreOffice`

Default behavior (`NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK=0`):
- If high-fidelity converter is unavailable, request returns `200` with DOCX fallback:
  - `requestedFormat: "pdf"`
  - `actualFormat: "docx"`
  - warning message included

Optional behavior (`NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK=1`):
- Enables lower-fidelity fallback renderers (`weasyprint` / `reportlab`) before DOCX fallback.

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
