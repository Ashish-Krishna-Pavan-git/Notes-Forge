# NotesForge

NotesForge is a full-stack notes-to-document formatter with:
- React + TypeScript frontend
- FastAPI backend
- Marker-based parsing
- Theme/config management
- DOCX/PDF/HTML/Markdown export support

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Axios
- Backend: Python, FastAPI, Uvicorn
- Document generation: `python-docx` (with optional PDF/HTML conversion helpers)

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
  frontend/
    src/
      App.tsx
      main.tsx
      index.css
    package.json
  SETUP.bat
  START.bat
  STOP.bat
```

## Requirements

- Python 3.9+
- Node.js 18+
- npm

Optional:
- LibreOffice (for PDF conversion path used by backend)
- `mammoth` Python package (for HTML conversion endpoint path)

## Quick Start (Windows Scripts)

1. Run one-time setup:

```bat
SETUP.bat
```

2. Start frontend + backend:

```bat
START.bat
```

3. Stop services:

```bat
STOP.bat
```

Note: `START.bat` currently contains an absolute local path. If your project path differs, update the `cd /d ...` lines inside `START.bat`.

## Manual Run (Recommended for development)

### Backend

```powershell
cd backend
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn python-docx python-multipart
# Optional for HTML export:
# python -m pip install mammoth
python -m uvicorn backend_server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`  
Backend default URL: `http://localhost:8000`

## Environment Variables

- Frontend:
  - `VITE_API_URL` (optional, defaults to `http://localhost:8000`)
- Backend:
  - `NF_CORS_ORIGINS` comma-separated origins (defaults include localhost ports)

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

## Theme Workflow

1. Open Settings -> Themes in the frontend.
2. Modify fonts/colors/spacing/page settings.
3. Save settings or save as a custom theme.
4. Apply built-in or custom themes from the same panel.

## Attribution and Reuse

This project is licensed under the MIT License.

You can use, modify, and redistribute this project (including commercial use), but you must keep the original copyright
and license notice in copies or substantial portions of the software.

See [LICENSE](./LICENSE).

## Maintainer

- Ashish
- **H1-H6 Headings**: Automatic detection of all heading levels
- **Code Blocks**: Syntax detection with 3+ indicators
- **Tables**: Pipe, space, or tab-separated columns
- **ASCII Diagrams**: Auto-centered with gray background
- **Bullet Points**: Multi-level nesting (3 levels)
- **Commands**: 50+ pre-configured commands
- **File Paths**: Automatic path detection
- **Formulas**: Mathematical expression formatting

### Modern UI
- **Purple/Blue Gradient Header**: Professional appearance
- **Live Statistics**: Real-time analysis as you type
- **Live Preview**: See detected element types
- **Tab Navigation**: Editor, Preview, Settings
- **Dark/Light Ready**: Easy to customize
- **Responsive Design**: Works on all screen sizes

### Document Output
- **DOCX Format**: Microsoft Word compatible
- **PDF Format**: Direct PDF generation
- **7 Themes**: Professional, Academic, Modern, Minimal, Book, Colorful, Frontlines
- **Customizable**: Fonts, colors, spacing, borders

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/analyze` | POST | Analyze text and return classifications |
| `/generate` | POST | Generate DOCX/PDF document |
| `/download/{filename}` | GET | Download generated file |
| `/config` | GET/POST | Get/Update configuration |
| `/themes` | GET | Get all available themes |
| `/commands` | GET/POST | Get/Add commands |
| `/docs` | GET | Auto-generated API documentation |

---

## Troubleshooting

### Backend Not Starting
```batch
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process if needed
taskkill /F /PID <PID>
```

### Frontend Not Starting
```batch
# Delete node_modules and reinstall
cd frontend
rmdir /s node_modules
del package-lock.json
npm install
```

### Module Not Found Errors
Make sure you copied ALL your Python files to the `backend/` folder:
- Core.py
- Config.py
- Themes.py
- Config.json
- themes.json

---

## Manual Setup (If Batch Files Don't Work)

### 1. Install Python Dependencies
```batch
cd backend
pip install fastapi uvicorn python-docx python-multipart
```

### 2. Install Node.js Dependencies
```batch
cd frontend
npm install
```

### 3. Start Backend
```batch
cd backend
python backend_server.py
```

### 4. Start Frontend (New Terminal)
```batch
cd frontend
npm run dev
```

### 5. Open Browser
Navigate to: http://localhost:5173

---

## Project Structure

```
notesforge/
├── SETUP.bat              # One-click setup
├── START.bat              # One-click start
├── STOP.bat               # One-click stop
├── README.md              # This file
│
├── backend/               # Python FastAPI Backend
│   ├── backend_server.py  # API server
│   ├── Core.py           # Your text analysis logic
│   ├── Config.py         # Your config manager
│   ├── Themes.py         # Your theme manager
│   ├── Config.json       # Your settings
│   └── themes.json       # Your themes
│
└── frontend/              # React Frontend
    ├── src/
    │   ├── App.tsx       # Main component
    │   ├── main.tsx      # Entry point
    │   └── index.css     # Styles
    ├── package.json      # Dependencies
    ├── vite.config.ts    # Vite config
    └── tailwind.config.js # Tailwind config
```

---

## Customization

### Adding New Commands
Edit `backend/Config.json`:
```json
{
  "commands": [
    "your-new-command",
    "another-command"
  ]
}
```

### Creating Custom Themes
Edit `backend/themes.json`:
```json
{
  "my_theme": {
    "name": "My Custom Theme",
    "description": "Perfect for...",
    "fonts": {...},
    "colors": {...}
  }
}
```

### Changing Default Settings
Edit `backend/Config.json` or use the Settings tab in the UI.

---

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Axios** - HTTP client

### Backend
- **FastAPI** - Web framework
- **Uvicorn** - ASGI server
- **python-docx** - DOCX generation
- **python-multipart** - File uploads

---

## License

MIT License - Feel free to use and modify!

---

## Credits

**NotesForge Professional** by AKP (Ashish Krishna Pavan)

From chaos to clarity - automated note formatting
