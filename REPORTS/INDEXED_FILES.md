## Indexed Files

- **README.md**: Top-level project overview, stack, deployment, and API contract.
- **render.yaml**: Render deployment configuration for backend service.
- **.cursorignore**: Editor-specific ignore rules for tooling and indexing.
- **.env.example**: Example environment variables for backend and frontend.
- **LICENSE**: MIT license for NotesForge.
- **START.bat**: Windows helper to install backend deps and start frontend/backend.
- **STOP.bat**: Windows helper to stop frontend/backend processes.
- **SETUP.bat**: Windows one-time setup script for Python and Node dependencies.

### Backend (root)

- **backend/Config.json**: JSON configuration for fonts, colors, spacing, page, header, footer, watermark.
- **backend/Config.py**: AppConfig helper for reading/writing configuration JSON with sane defaults.
- **backend/Core.py**: Standalone marker-based DOCX builder with rich styling (fonts, headers/footers, borders, watermark).
- **backend/Themes.py**: ThemeManager for loading, saving, and managing themes from `Themes.json`.
- **backend/Themes.json**: Theme catalog with detailed fonts, colors, spacing, page, header/footer, watermark definitions.
- **backend/backend_server.py**: Compatibility entrypoint that exposes `app.main:app` for FastAPI.
- **backend/requirements.txt**: Backend Python dependencies (FastAPI, python-docx, weasyprint, reportlab, etc.).
- **backend/pytest.ini**: Pytest configuration pointing tests to the `tests` package.
- **backend/prompt.txt**: System prompt for AI-based template regeneration using strict marker syntax.
- **backend/scripts/verify_live_api.py**: CLI script to verify deployed backend contract and PDF behavior.
- **backend/.notesforge_tmp/**: Temporary directory for generated DOCX/HTML/Markdown artifacts.
- **backend/.pytest_cache/**: Pytest cache directory for last run metadata.

### Backend `app/`

- **backend/app/__init__.py**: Package marker for backend application modules.
- **backend/app/main.py**: FastAPI application; defines API endpoints, CORS, theme/config management, and uses exporter/parser.
- **backend/app/models.py**: Pydantic models for API payloads: themes, formatting options, security payloads, preview/generate contracts, templates.
- **backend/app/parser.py**: Structural parser converting marker-based content into an AST (`Node`) plus summary and warnings; also render helpers.
- **backend/app/exporter.py**: Core exporter: builds DOCX from AST, derives styles from `ThemePayload`, converts to PDF/HTML/MD/TXT.
- **backend/app/themes.py**: Theme utilities: default professional theme, HTML/CSS generation, watermark HTML, and theme serialization.
- **backend/app/templates_repo.py**: In-memory template catalog and deterministic content generator for AI regeneration flows.
- **backend/app/security.py**: Helpers to strip DOCX metadata, set DOCX as read-only, and apply PDF security via `pypdf`.

### Backend `tests/`

- **backend/tests/test_api.py**: Integration tests covering health, templates, preview, generate (DOCX/PDF/text), themes/config endpoints.
- **backend/tests/test_backend_server_contract.py**: Contract tests hitting `backend_server.app` for health, templates, and strict-mode preview warnings.
- **backend/tests/test_parser.py**: Unit tests for parser structure extraction, markdown conversion, alignment/ascii/pagebreak handling, and table merging.

### Frontend root

- **frontend/package.json**: Frontend package manifest, scripts, and dev/runtime dependencies.
- **frontend/package-lock.json**: Locked dependency tree for reproducible Node installs.
- **frontend/vite.config.ts**: Vite configuration with React plugin and dev server proxy to backend.
- **frontend/tailwind.config.js**: TailwindCSS configuration, theme extensions, and content paths.
- **frontend/postcss.config.js**: PostCSS plugin configuration (Tailwind + Autoprefixer).
- **frontend/tsconfig.json**: TypeScript compiler configuration for frontend source.
- **frontend/tsconfig.node.json**: TypeScript configuration for Vite/node tooling.
- **frontend/.gitignore**: Frontend-specific ignore rules (`node_modules`, `dist`, `.env`).
- **frontend/index.html**: HTML entrypoint that mounts the React app, loads fonts, and sets base metadata.

### Frontend `src/`

- **frontend/src/main.tsx**: React entrypoint mounting `App` into `#root` and importing global styles.
- **frontend/src/index.css**: Global Tailwind base/components/utilities plus custom scrollbar, glass, and UI utility classes.
- **frontend/src/lib/config.ts**: Frontend API configuration: base URL, timeouts, and feature flags derived from Vite env.
- **frontend/src/lib/api.ts**: Axios client with timing/interceptors, generic `apiGet`/`apiPost`, retry helper, and error normalization.
- **frontend/src/App.tsx**: Main SPA: editor, strict marker tooling, theme & config UI, preview panel, templates, prompts, and export flows.

### Miscellaneous

- **.git/**: Git metadata, refs, logs, and object store (version control only; no runtime behavior).
- **backend/.notesforge_tmp/* (sample files)**: Auto-generated sample exports used during development/testing; not part of runtime logic.
- **backend/.pytest_cache/* (sample files)**: Pytest internal cache files to speed up future test runs.

