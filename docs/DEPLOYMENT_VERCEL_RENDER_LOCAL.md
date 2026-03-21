# Deployment Guide (Local, Docker, Vercel + Render)

## Localhost
### Backend
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 10000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:10000` if needed.

## Docker
```powershell
docker compose up --build
```

## Vercel (frontend)
- Project root: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Env: `VITE_API_URL=https://<your-render-backend>`
- Keep SPA rewrite in `frontend/vercel.json` so `/guide` and deep links resolve.

## Render (backend)
- Root directory: `backend`
- Start command:
  - `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`
- Recommended env:
  - `NF_CORS_ORIGINS`
  - `DOCX_TEMP_DIR`
  - `QDF_RATE_LIMIT_REQUESTS_PER_WINDOW`
  - `QDF_RATE_LIMIT_WINDOW_SECONDS`
  - `NF_ALLOW_PRIVATE_MEDIA_URLS` (default false)
  - `NF_ILOVEPDF_PUBLIC_KEY` (optional iLovePDF API fallback)
  - `NF_ILOVEPDF_AUTOMATION_URL` (optional automation bridge fallback)

## PDF reliability contract
For `format=pdf`, backend always returns PDF content and `actualFormat=pdf`, even when fallback engines are used.

## Health checks
- `GET /api/health`
- `GET /api/health/parser`

