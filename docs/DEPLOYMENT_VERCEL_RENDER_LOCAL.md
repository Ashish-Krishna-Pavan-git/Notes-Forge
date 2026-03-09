# Deployment Guide (Localhost, Vercel, Render)

## Localhost
- Backend: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
- Frontend: `npm run dev` in `frontend`

## Vercel (Frontend)
- Root: `frontend`
- Build: `npm run build`
- Output: `dist`
- Set `VITE_API_URL` to backend URL
- `frontend/vercel.json` rewrites all routes to `index.html` so `/guide` works on direct visit.

## Render (Backend)
- Root: `backend`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`
- Keep `FASTAPI_HOST`, `FASTAPI_PORT`, `DOCX_TEMP_DIR`, `STORAGE_BACKEND`, `NF_CORS_ORIGINS` configured.

## Compatibility
No route/path removals were introduced in v7.
