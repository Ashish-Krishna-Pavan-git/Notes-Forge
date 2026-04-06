# NotesForge

NotesForge is organized into four product areas so web, desktop, and local Docker flows stay easier to understand and maintain.

## Folder Map

- [`webapp/`](./webapp) is the shared NotesForge product: React frontend, FastAPI backend, marker engine, PDF/DOCX processing, docs, deploy files, and the web runtime used by Render and local browser launches.
- [`windows/`](./windows) is the Windows desktop application area: packaging, launch/build files, music/assets, and Windows-specific runtime notes.
- [`linux/`](./linux) is the Linux desktop application area: packaging, launch/build files, music/assets, and distro-focused runtime notes.
- [`docker-setup/`](./docker-setup) is the local container environment for running the same shared app stack in Docker.

## Start Here

- Shared web product and API: [`webapp/README.md`](./webapp/README.md)
- Windows app: [`windows/README.md`](./windows/README.md)
- Linux app: [`linux/README.md`](./linux/README.md)
- Docker runbook: [`docker-setup/README.md`](./docker-setup/README.md)

## Repo Rules

- Use `notesforge/webapp` as the deploy root for Render and manual web hosting.
- Keep shared backend/frontend/document logic in `webapp/`.
- Keep `windows/` and `linux/` platform-focused.
- Treat PDF support as capability-based: if high-fidelity PDF export is unavailable, the UI hides PDF instead of promising a broken workflow.
