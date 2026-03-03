# NotesForge

NotesForge is a marker-based notes formatter built with React + FastAPI.
It converts structured marker text into professional documents (`.docx`, `.pdf`, `.md`, `.html`).

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, Axios
- Backend: FastAPI, python-docx, Uvicorn
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

## Prerequisites

- Python 3.9+
- Node.js 18+
- npm

Optional:
- LibreOffice (for PDF conversion path in backend)
- `mammoth` (for HTML export path in backend)

## Environment Variables

Copy `.env.example` to `.env` (or set in shell) and adjust:

- `NF_CORS_ORIGINS` for backend CORS
- `VITE_API_URL` for frontend API base URL

## Quick Start (Windows)

1. Run setup once:

```bat
SETUP.bat
```

2. Start both services:

```bat
START.bat
```

3. Stop services:

```bat
STOP.bat
```

`START.bat` is now relative-path based, so clones can run without editing absolute paths.

## Manual Run

### Backend

```powershell
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend_server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:8000`

## Core API Endpoints

- `GET /health`
- `POST /api/analyze`
- `POST /api/generate`
- `GET /api/download/{filename}`
- `GET /api/config`
- `POST /api/config/update`
- `GET /api/themes`
- `POST /api/themes/apply`
- `POST /api/themes/save`
- `POST /api/themes/delete`
- `GET /api/prompt`
- `POST /api/prompt`

## PDF Export Behavior

If PDF conversion is unavailable (usually missing LibreOffice), backend falls back to DOCX and returns a warning message.
Frontend displays this warning to the user.

## License

MIT License. See [LICENSE](./LICENSE).
