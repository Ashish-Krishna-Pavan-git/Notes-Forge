# NotesForge Core Engine v7.0.0

NotesForge is a compatibility-first document generation system for:
- academic notes
- study materials
- technical documentation
- project reports
- research papers
- assignments
- professional documentation

It preserves legacy marker syntax and extends the engine with v7 academic workflows.

## What Is New In v7.0.0
- Backward-compatible marker engine expansion (front matter, chapters, references, appendix, figure/table captions)
- Chapter-aware figure/table numbering (`1.1`, `1.2`, ...)
- First-class image parsing for `IMAGE:` / `FIGURE:` with URL and data URI sources
- Extended DOCX rendering for academic sections and caption nodes
- 10 required built-in themes + 5 required professional templates (additive, existing themes/templates preserved)
- Dedicated `/guide` page plus existing in-app Guide tab
- Prompt and docs refreshed to v7.0.0

## Compatibility Promise
- Existing markers remain supported (`H1-H6`, `PARAGRAPH`, `BULLET`, `NUMBERED`, `TABLE`, `IMAGE`, `CODE`, `TOC`, `PAGEBREAK`, etc.)
- Existing APIs and routes remain intact
- Existing export formats remain intact (`docx`, `pdf`, `html`, `md`, `txt`)
- Existing deployment shape remains intact (localhost, Vercel frontend, Render backend)

## v7 Marker Additions
Additive markers (optional):
- `COVER_PAGE:`
- `CERTIFICATE_PAGE:`
- `DECLARATION_PAGE:`
- `ACKNOWLEDGEMENT_PAGE:`
- `ABSTRACT_PAGE:`
- `LIST_OF_TABLES:`
- `LIST_OF_FIGURES:`
- `CHAPTER:`
- `REFERENCES:`
- `REFERENCE:`
- `APPENDIX:`
- `FIGURE:`
- `FIGURE_CAPTION:`
- `TABLE_CAPTION:`

## Project Layout
```text
backend/
  app/                      # canonical runtime modules
  core/                     # v7 modular compatibility wrappers (additive)
    parser/
    formatter/
    document_engine/
    renderer/
    export/
    themes/
    templates/
    guide/
  services/                 # compatibility wrappers
  routes/
  server.py
  backend_server.py
frontend/
  src/
    pages/
      EditorWorkspacePage.tsx
      GuidePage.tsx
  vercel.json               # SPA rewrite to support /guide direct route
```

## Quick Start
### Windows helpers
1. `SETUP.bat`
2. `START.bat`
3. `STOP.bat`

### Manual backend
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 10000
```

### Manual frontend
```powershell
cd frontend
npm install
npm run dev
```

## Guide Access
- In-app tab: `New User`
- Dedicated page: `/guide`

## API Contract (unchanged routes)
- `GET /api/health`
- `GET /api/health/parser`
- `GET /api/version`
- `POST /api/analyze`
- `POST /api/preview`
- `POST /api/generate`
- `GET /api/download/{file_id}`
- `GET /api/templates`
- `POST /api/templates/regenerate`
- `GET /api/themes`
- `POST /api/themes`
- `POST /api/themes/apply`
- `POST /api/themes/save`
- `POST /api/themes/delete`
- `GET /api/config`
- `POST /api/config/update`
- `GET /api/prompt`
- `POST /api/prompt`

## Required v7 Built-in Themes
- Academic Classic
- University Blue
- Engineering Report
- Clean Research
- Modern Minimal
- Corporate White
- Dark Technical
- Elegant Thesis
- Lecture Notes
- Professional Docs

## Required v7 Professional Templates
- Project Report Template
- Research Paper Template
- Study Notes Template
- Technical Documentation Template
- Assignment Template

## Extended Documentation
- [Working Guide](./docs/WORKING_GUIDE.md)
- [Marker Reference v7](./docs/MARKER_REFERENCE_V7.md)
- [Themes and Templates v7](./docs/THEMES_TEMPLATES_V7.md)
- [Deployment Guide](./docs/DEPLOYMENT_VERCEL_RENDER_LOCAL.md)
- [Migration v6 to v7](./docs/MIGRATION_V6_TO_V7.md)

