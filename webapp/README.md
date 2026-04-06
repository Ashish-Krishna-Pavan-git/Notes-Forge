# NotesForge Webapp

`webapp/` is the shared NotesForge application root.

It holds the product surfaces and shared logic used by the hosted web app and by both desktop applications:

- `backend/` for FastAPI, marker parsing, secure file access, PDF/DOCX processing, export jobs, and download handling
- `frontend/` for the React/Vite web UI
- `docs/`, `database/`, and runtime/deploy files that belong to the shared app
- local launch scripts for browser-based development and manual runs

## Local Development

Backend:

```powershell
cd webapp/backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 10000
```

Frontend:

```powershell
cd webapp/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Single-Folder Web Run

From the repo root:

```powershell
./webapp/start-webapp.ps1
```

or on Linux/macOS:

```bash
./webapp/start-webapp.sh
```

This builds `webapp/frontend/dist` and serves it from the shared FastAPI backend.

## Deployment Root

Use `notesforge/webapp` as the deploy root for:

- Render
- manual hosting

For local Docker runs, use [`../docker-setup/README.md`](../docker-setup/README.md).

## Key Product Routes

- `/` product home and marketing shell
- `/workspace` sticky-marker editor
- `/processing` PDF/DOCX conversion workspace
- `/guide` workflow guide
- `/desktop/windows` Windows desktop landing route
- `/desktop/linux` Linux desktop landing route

## Notes

- PDF support is capability-aware. If high-fidelity PDF output is not configured for the current runtime, the UI hides PDF actions instead of offering a broken flow.
- The processing context endpoint reports working directory, detected folders, output path, download path, and provider readiness to both web and desktop shells.
- Windows and Linux packages live in `../windows` and `../linux`, but both reuse this shared app during build time.
- Local browser runs and Docker runs disable remote conversion providers by default so they stay offline-first.
