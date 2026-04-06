# Deployment Guide (Local, Docker, Render)

## Localhost

### Backend
```powershell
cd webapp/backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 10000
```

### Frontend
```powershell
cd webapp/frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:10000` if needed.

## Docker
```powershell
docker compose -f docker-setup/docker-compose.yml up --build
```

## Render (hosted web)
- Root directory: `webapp`
- Start command:
  - Docker deploy from `webapp/render.yaml`
- Recommended env:
  - `NF_CORS_ORIGINS`
  - `DOCX_TEMP_DIR`
  - `NF_ENABLE_SERVER_FILE_DISCOVERY`
  - `NF_PROCESSING_MAX_UPLOAD_BYTES`
  - `QDF_RATE_LIMIT_REQUESTS_PER_WINDOW`
  - `QDF_RATE_LIMIT_WINDOW_SECONDS`
  - `NF_ALLOW_PRIVATE_MEDIA_URLS` (default false)
  - `NF_ILOVEPDF_PUBLIC_KEY` (optional iLovePDF API fallback)
  - `NF_ILOVEPDF_AUTOMATION_URL` (optional automation bridge fallback)
  - `NF_SMALLPDF_WORD_TO_PDF_URL` / `NF_SMALLPDF_PDF_TO_WORD_URL` (optional secure proxy endpoints)
  - `NF_ILOVEPDF_WORD_TO_PDF_URL` / `NF_ILOVEPDF_PDF_TO_WORD_URL` (optional secure proxy endpoints)

## PDF reliability contract
- NotesForge hides PDF actions in the UI when high-fidelity PDF support is not available for the current runtime.
- When PDF is visible and selected, backend returns PDF content and `actualFormat=pdf`.

## Health checks
- `GET /api/health`
- `GET /api/health/parser`

## File processing route
- Product home: `/`
- Editor route: `/workspace`
- Frontend route: `/processing`
- Backend endpoints:
  - `GET /api/file-processing/context`
  - `POST /api/file-processing/convert`
