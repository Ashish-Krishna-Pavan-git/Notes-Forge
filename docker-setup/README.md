# Docker Setup

`docker-setup/` runs the shared NotesForge product locally in containers so the browser experience stays close to the hosted web app.

## Included Files

- `docker-compose.yml` for local multi-service startup
- `Dockerfile` for the FastAPI backend image
- `LICENSE`

## Start

From the repo root:

```powershell
docker compose -f docker-setup/docker-compose.yml up --build
```

Or from inside `docker-setup/`:

```powershell
docker compose up --build
```

## Services

- Backend: `http://localhost:10000`
- Frontend: `http://localhost:5173`

## Notes

- The Docker stack uses the shared application in `webapp/`.
- Browser routing still uses the same NotesForge routes as the hosted product.
- Docker runs disable remote conversion providers by default so the local stack works offline-first.
- PDF availability remains capability-based. If the Docker runtime cannot provide high-fidelity PDF support, the UI hides PDF actions rather than leaving them clickable.

## Related Docs

- Shared product: [`../webapp/README.md`](../webapp/README.md)
- Root overview: [`../README.md`](../README.md)
