from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from .exporter import DocumentExporter, FileStore
from .models import (
    CreateThemeRequest,
    CreateThemeResponse,
    FormattingOptions,
    GenerateRequest,
    GenerateResponse,
    GenerateSecurityPayload,
    ParserHealthResponse,
    PreviewRequest,
    PreviewResponse,
    RegenerateTemplateRequest,
    RegenerateTemplateResponse,
    StructureSummary,
    TemplateDefinition,
)
from .parser import parse_notesforge
from .templates_repo import TemplateRepo

logger = logging.getLogger("notesforge.api")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

APP_VERSION = "5.0"
MAX_BODY_BYTES = 2_000_000
API_MARKER_RE = re.compile(r"^\s*([A-Z][A-Z0-9-]*)\s*:\s*(.*)$")
DEFAULT_CORS_ORIGINS = [
    "https://notes-forge-ruddy.vercel.app",
    "https://notes-forge.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000",
]
MEDIA_TYPES: Dict[str, str] = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
    "html": "text/html; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
}

BUILTIN_THEME_CATALOG: Dict[str, Dict[str, Any]] = {
    "professional": {
        "name": "Professional",
        "description": "Balanced default for business and academic documents.",
        "builtin": True,
        "colors": {
            "h1": "#1F3A5F",
            "h2": "#2C5282",
            "h3": "#2B6CB0",
            "table_header_bg": "#E2E8F0",
        },
        "fonts": {"family": "Calibri"},
        "spacing": {"line_spacing": 1.4},
    },
    "modern": {
        "name": "Modern",
        "description": "Clean modern styling with blue accents.",
        "builtin": True,
        "colors": {
            "h1": "#0F172A",
            "h2": "#1D4ED8",
            "h3": "#0284C7",
            "table_header_bg": "#DBEAFE",
        },
        "fonts": {"family": "Segoe UI"},
        "spacing": {"line_spacing": 1.35},
    },
    "academic": {
        "name": "Academic",
        "description": "Conservative typography optimized for reports.",
        "builtin": True,
        "colors": {
            "h1": "#111827",
            "h2": "#374151",
            "h3": "#4B5563",
            "table_header_bg": "#E5E7EB",
        },
        "fonts": {"family": "Times New Roman"},
        "spacing": {"line_spacing": 1.6},
    },
    "corporate": {
        "name": "Corporate Red",
        "description": "Executive style with strong heading contrast.",
        "builtin": True,
        "colors": {
            "h1": "#B91C1C",
            "h2": "#DC2626",
            "h3": "#EF4444",
            "table_header_bg": "#FEE2E2",
        },
        "fonts": {"family": "Arial"},
        "spacing": {"line_spacing": 1.35},
    },
    "creative": {
        "name": "Creative Vibrant",
        "description": "Colorful theme for creative project documents.",
        "builtin": True,
        "colors": {
            "h1": "#F97316",
            "h2": "#F59E0B",
            "h3": "#EC4899",
            "table_header_bg": "#FEF3C7",
        },
        "fonts": {"family": "Candara"},
        "spacing": {"line_spacing": 1.35},
    },
    "startup": {
        "name": "Startup Pitch",
        "description": "Pitch-deck-like style for startup notes.",
        "builtin": True,
        "colors": {
            "h1": "#0E7490",
            "h2": "#0284C7",
            "h3": "#0369A1",
            "table_header_bg": "#CFFAFE",
        },
        "fonts": {"family": "Calibri"},
        "spacing": {"line_spacing": 1.3},
    },
    "minimal": {
        "name": "Minimal",
        "description": "Neutral monochrome styling for clean exports.",
        "builtin": True,
        "colors": {
            "h1": "#111827",
            "h2": "#374151",
            "h3": "#4B5563",
            "table_header_bg": "#E5E7EB",
        },
        "fonts": {"family": "Calibri"},
        "spacing": {"line_spacing": 1.35},
    },
}


class ConfigUpdateRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=200)
    value: Any


class ThemeApplyRequest(BaseModel):
    theme_name: str = Field(..., min_length=1, max_length=80)


class ThemeSaveRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    config: Dict[str, Any] | None = None


class ThemeDeleteRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=80)


class PromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=50_000)


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500_000)


def _allowed_origins() -> List[str]:
    env = os.environ.get("NF_CORS_ORIGINS", "").strip()
    allow_all = os.environ.get("NF_CORS_ALLOW_ALL", "0") == "1"
    if allow_all:
        return ["*"]
    if env:
        extra = [x.strip() for x in env.split(",") if x.strip()]
        merged = list(dict.fromkeys([*DEFAULT_CORS_ORIGINS, *extra]))
        return merged
    return DEFAULT_CORS_ORIGINS


def _default_config() -> Dict[str, Any]:
    return {
        "app": {"name": "NotesForge", "version": APP_VERSION, "theme": "professional"},
        "fonts": {
            "family": "Calibri",
            "family_code": "Fira Code",
            "available_fonts": [
                "Arial",
                "Arial Black",
                "Bahnschrift",
                "Book Antiqua",
                "Calibri",
                "Cambria",
                "Candara",
                "Century Gothic",
                "Comic Sans MS",
                "Consolas",
                "Constantia",
                "Corbel",
                "Courier New",
                "Franklin Gothic Medium",
                "Garamond",
                "Georgia",
                "Helvetica",
                "Lucida Console",
                "Lucida Sans Unicode",
                "Monaco",
                "Palatino Linotype",
                "Segoe UI",
                "Tahoma",
                "Times New Roman",
                "Trebuchet MS",
                "Verdana",
                "Fira Code",
                "Source Code Pro",
                "Roboto",
                "Open Sans",
            ],
            "available_code_fonts": [
                "Consolas",
                "Courier New",
                "Fira Code",
                "JetBrains Mono",
                "Source Code Pro",
                "Cascadia Code",
                "Menlo",
                "Monaco",
                "Lucida Console",
                "Inconsolata",
            ],
            "sizes": {"h1": 24, "h2": 20, "h3": 16, "body": 11, "code": 10},
        },
        "header": {
            "enabled": True,
            "text": "",
            "alignment": "center",
            "page_format": "page_x",
        },
        "footer": {
            "enabled": True,
            "text": "",
            "alignment": "center",
            "show_page_numbers": True,
            "page_format": "page_x",
        },
        "page": {"margins": {"top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0}},
        "colors": {"h1": "#1F3A5F", "h2": "#1F3A5F"},
        "spacing": {"line_spacing": 1.4},
        "watermark": {"enabled": False},
    }


def _apply_theme_to_config(config_data: Dict[str, Any], theme_payload: Dict[str, Any]) -> None:
    colors = theme_payload.get("colors")
    if isinstance(colors, dict):
        target = config_data.setdefault("colors", {})
        if isinstance(target, dict):
            target.update({k: v for k, v in colors.items() if isinstance(v, (str, int, float))})

    fonts = theme_payload.get("fonts")
    if isinstance(fonts, dict):
        target = config_data.setdefault("fonts", {})
        if isinstance(target, dict):
            target.update({k: v for k, v in fonts.items() if isinstance(v, (str, int, float))})

    spacing = theme_payload.get("spacing")
    if isinstance(spacing, dict):
        target = config_data.setdefault("spacing", {})
        if isinstance(target, dict):
            target.update({k: v for k, v in spacing.items() if isinstance(v, (str, int, float))})

    for section in ("header", "footer", "page", "watermark"):
        section_data = theme_payload.get(section)
        if isinstance(section_data, dict):
            target = config_data.setdefault(section, {})
            if isinstance(target, dict):
                target.update(section_data)

    if isinstance(config_data.get("header"), dict) and isinstance(config_data.get("colors"), dict):
        config_data["header"]["color"] = config_data["colors"].get("h1", config_data["header"].get("color"))
    if isinstance(config_data.get("footer"), dict) and isinstance(config_data.get("colors"), dict):
        config_data["footer"]["color"] = config_data["colors"].get("h2", config_data["footer"].get("color"))


class AppState:
    def __init__(self) -> None:
        backend_root = Path(__file__).resolve().parent.parent
        temp_dir = os.environ.get("DOCX_TEMP_DIR", str(backend_root / ".notesforge_tmp"))
        self.store = FileStore(temp_dir)
        self.exporter = DocumentExporter(self.store)
        self.templates = TemplateRepo.build_default()

        self.config_path = backend_root / "Config.json"
        self.prompt_path = backend_root / "prompt.txt"
        self.theme_store_path = backend_root / "theme_store.json"

        self.theme_store: Dict[str, dict] = self._load_json(self.theme_store_path, {})
        self.config_data: Dict[str, Any] = self._load_json(self.config_path, _default_config())
        if not isinstance(self.config_data, dict):
            self.config_data = _default_config()
        self.current_theme = (
            self.config_data.get("app", {}).get("theme", "professional") or "professional"
        )
        self.prompt = self._load_prompt()

    @staticmethod
    def _load_json(path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("Failed to parse %s; using defaults", path)
            return default

    def _save_json(self, path: Path, payload: Any) -> None:
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def save_config(self) -> None:
        self._save_json(self.config_path, self.config_data)

    def save_theme_store(self) -> None:
        self._save_json(self.theme_store_path, self.theme_store)

    def _load_prompt(self) -> str:
        if not self.prompt_path.exists():
            return ""
        try:
            return self.prompt_path.read_text(encoding="utf-8")
        except Exception:
            return ""

    def save_prompt(self) -> None:
        self.prompt_path.write_text(self.prompt, encoding="utf-8")

    def update_config_path(self, path: str, value: Any) -> None:
        keys = [k for k in path.split(".") if k]
        if not keys:
            return
        cur: Dict[str, Any] = self.config_data
        for key in keys[:-1]:
            if not isinstance(cur.get(key), dict):
                cur[key] = {}
            cur = cur[key]
        cur[keys[-1]] = value
        if keys[0] == "app" and isinstance(self.config_data.get("app"), dict):
            self.current_theme = self.config_data["app"].get("theme", self.current_theme)
        self.save_config()


def _classify_line(line: str) -> Dict[str, Any]:
    stripped = line.rstrip("\n")
    trimmed = stripped.strip()
    if not trimmed:
        return {"type": "empty", "content": "", "indent_level": 0}
    match = API_MARKER_RE.match(stripped)
    if not match:
        return {"type": "text", "content": trimmed, "indent_level": 0}
    marker = match.group(1).upper()
    content = match.group(2).strip()
    mapped = {
        "HEADING": "h1",
        "H1": "h1",
        "SUBHEADING": "h2",
        "H2": "h2",
        "SUB-SUBHEADING": "h3",
        "H3": "h3",
        "H4": "h4",
        "H5": "h5",
        "H6": "h6",
        "PARAGRAPH": "paragraph",
        "PARA": "paragraph",
        "BULLET": "bullet",
        "NUMBERED": "numbered",
        "CODE": "code",
        "TABLE": "table",
        "ASCII": "ascii",
        "CENTER": "paragraph",
        "RIGHT": "paragraph",
        "JUSTIFY": "paragraph",
        "PAGEBREAK": "pagebreak",
    }
    node_type = mapped.get(marker, marker.lower())
    indent = 0
    if marker == "BULLET" and content:
        indent = max(0, (len(content) - len(content.lstrip())) // 2)
    return {"type": node_type, "content": content, "indent_level": indent}


def create_app() -> FastAPI:
    app = FastAPI(title="NotesForge API", version=APP_VERSION)
    state = AppState()

    origins = _allowed_origins()
    allow_all = "*" in origins
    cors_origins = [o for o in origins if o != "*"] or DEFAULT_CORS_ORIGINS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r".*" if allow_all else r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_pipeline(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid4().hex[:12]
        started = time.perf_counter()
        content_len = request.headers.get("content-length")
        if content_len and int(content_len) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled request failure [%s] %s", request_id, request.url.path)
            raise
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["x-request-id"] = request_id
        logger.info("%s %s -> %s (%.1fms)", request.method, request.url.path, response.status_code, elapsed_ms)
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server error on %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    @app.options("/{full_path:path}")
    async def preflight(full_path: str):
        return Response(status_code=204)

    @app.get("/api/health")
    async def api_health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/health")
    async def health_legacy() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/version")
    async def api_version() -> Dict[str, str]:
        return {"name": "NotesForge API", "version": APP_VERSION}

    @app.get("/api/health/parser", response_model=ParserHealthResponse)
    async def parser_health() -> ParserHealthResponse:
        return ParserHealthResponse(parser="ok", version=APP_VERSION)

    @app.post("/api/preview", response_model=PreviewResponse)
    async def preview(req: PreviewRequest) -> PreviewResponse:
        parsed = parse_notesforge(req.content)
        sec = GenerateSecurityPayload(
            removeMetadata=req.security.removeMetadata,
            watermark=req.security.watermark,
            pageNumberMode=req.security.pageNumberMode,
            headerText=req.security.headerText,
            footerText=req.security.footerText,
        )
        preview_html = state.exporter.create_preview_html(
            nodes=parsed.nodes,
            theme=req.theme,
            formatting=req.formattingOptions,
            security=sec,
        )
        return PreviewResponse(
            previewHtml=preview_html,
            warnings=parsed.warnings,
            structure=StructureSummary(
                wordCount=parsed.summary.word_count,
                headingCount=parsed.summary.heading_count,
                readingTimeMinutes=parsed.summary.reading_time_minutes,
            ),
        )

    @app.post("/api/generate", response_model=GenerateResponse)
    async def generate(req: GenerateRequest) -> GenerateResponse:
        parsed = parse_notesforge(req.content)
        formatting = FormattingOptions(
            margins=req.theme.margins,
            lineSpacing=req.theme.bodyStyle.lineHeight or 1.4,
        )
        try:
            file_id, output_path, warnings = state.exporter.create_export_file(
                target_format=req.format,
                nodes=parsed.nodes,
                theme=req.theme,
                formatting=formatting,
                security=req.security,
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=503,
                detail=str(exc),
            )
        all_warnings = [*parsed.warnings, *warnings]

        actual_format = output_path.suffix.lower().lstrip(".") or req.format

        if all_warnings:
            logger.warning(
                "generate warnings (%s): %s",
                file_id,
                " | ".join(all_warnings),
            )
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate output file")
        safe_base = req.filename.strip() if req.filename else "notesforge_output"
        safe_base = safe_base[:120] or "notesforge_output"
        filename = f"{safe_base}.{actual_format}"
        warning = " | ".join(all_warnings) if all_warnings else None
        return GenerateResponse(
            success=True,
            downloadUrl=f"/api/download/{file_id}",
            fileId=file_id,
            filename=filename,
            requestedFormat=req.format,
            actualFormat=actual_format,
            warning=warning,
            warnings=all_warnings,
        )

    @app.get("/api/download/{token}")
    async def download(token: str):
        if re.fullmatch(r"[0-9a-fA-F]{32}", token):
            path = state.store.resolve_path(token.lower())
            if not path:
                raise HTTPException(status_code=404, detail="File not found")
            ext = path.suffix.lower().lstrip(".")
            return FileResponse(path, media_type=MEDIA_TYPES.get(ext, "application/octet-stream"), filename=f"notesforge_output.{ext}")
        candidate = Path(os.path.realpath(os.path.join(tempfile.gettempdir(), token)))
        if candidate.exists():
            ext = candidate.suffix.lower().lstrip(".")
            return FileResponse(candidate, media_type=MEDIA_TYPES.get(ext, "application/octet-stream"), filename=candidate.name)
        raise HTTPException(status_code=404, detail="File not found")

    @app.get("/api/templates", response_model=List[TemplateDefinition])
    async def list_templates() -> List[TemplateDefinition]:
        return state.templates.list_templates()

    @app.post("/api/templates/regenerate", response_model=RegenerateTemplateResponse)
    async def regenerate_template(req: RegenerateTemplateRequest) -> RegenerateTemplateResponse:
        try:
            regenerated = state.templates.regenerate(req)
        except KeyError:
            raise HTTPException(status_code=404, detail="Template not found")
        return RegenerateTemplateResponse(content=regenerated["content"], prompt=regenerated["prompt"])

    # v5 themes endpoint
    @app.post("/api/themes", response_model=CreateThemeResponse, status_code=status.HTTP_201_CREATED)
    async def create_theme(req: CreateThemeRequest) -> CreateThemeResponse:
        theme_id = req.name.strip().lower().replace(" ", "_")
        state.theme_store[theme_id] = req.model_dump()
        state.save_theme_store()
        return CreateThemeResponse(themeId=theme_id)

    # compatibility themes endpoints used by existing frontend
    @app.get("/api/themes")
    async def list_themes_compat() -> Dict[str, Any]:
        builtin = BUILTIN_THEME_CATALOG

        custom: Dict[str, Dict[str, Any]] = {}
        for key, value in state.theme_store.items():
            colors: Dict[str, str] = {}
            if isinstance(value.get("colors"), dict):
                colors = {
                    k: str(v)
                    for k, v in value["colors"].items()
                    if isinstance(v, (str, int, float))
                }
            primary = value.get("primaryColor") or value.get("primary_color")
            if primary and not colors.get("h1"):
                colors["h1"] = str(primary)
                colors["h2"] = str(primary)
            fonts = value.get("fonts") if isinstance(value.get("fonts"), dict) else {}
            if not fonts and value.get("fontFamily"):
                fonts = {"family": str(value.get("fontFamily"))}
            spacing = value.get("spacing") if isinstance(value.get("spacing"), dict) else {}
            custom[key] = {
                "name": value.get("name", key),
                "description": value.get("description", "Custom theme"),
                "user_created": True,
                "colors": colors,
                "fonts": fonts,
                "spacing": spacing,
            }
        return {"success": True, "themes": {**builtin, **custom}, "current_theme": state.current_theme}

    @app.post("/api/themes/apply")
    async def apply_theme_compat(req: ThemeApplyRequest) -> Dict[str, Any]:
        state.current_theme = req.theme_name.strip().lower()
        app_cfg = state.config_data.setdefault("app", {})
        app_cfg["theme"] = state.current_theme
        selected = state.theme_store.get(state.current_theme) or BUILTIN_THEME_CATALOG.get(
            state.current_theme
        )
        if isinstance(selected, dict):
            _apply_theme_to_config(state.config_data, selected)
        state.save_config()
        return {"success": True, "current_theme": state.current_theme, "config": state.config_data}

    @app.post("/api/themes/save")
    async def save_theme_compat(req: ThemeSaveRequest) -> Dict[str, Any]:
        key = re.sub(r"[^a-z0-9_]", "", req.key.strip().lower().replace(" ", "_"))
        if not key:
            raise HTTPException(status_code=400, detail="Invalid theme key")
        payload = req.config if isinstance(req.config, dict) else state.config_data
        state.theme_store[key] = {"name": req.name, "description": req.description or "Custom theme", **payload}
        state.save_theme_store()
        return {"success": True, "key": key}

    @app.post("/api/themes/delete")
    async def delete_theme_compat(req: ThemeDeleteRequest) -> Dict[str, Any]:
        key = req.key.strip().lower()
        if key in state.theme_store:
            del state.theme_store[key]
            state.save_theme_store()
            if state.current_theme == key:
                state.current_theme = "professional"
            return {"success": True}
        raise HTTPException(status_code=404, detail="Theme not found")

    @app.get("/api/config")
    async def get_config_compat() -> Dict[str, Any]:
        return {"success": True, "config": state.config_data}

    @app.post("/api/config/update")
    async def update_config_compat(req: ConfigUpdateRequest) -> Dict[str, Any]:
        state.update_config_path(req.path, req.value)
        return {"success": True}

    @app.get("/api/prompt")
    async def get_prompt_compat() -> Dict[str, Any]:
        return {"success": True, "prompt": state.prompt}

    @app.post("/api/prompt")
    async def save_prompt_compat(req: PromptRequest) -> Dict[str, Any]:
        state.prompt = req.prompt
        state.save_prompt()
        return {"success": True}

    @app.post("/api/analyze")
    async def analyze_compat(req: AnalyzeRequest) -> Dict[str, Any]:
        lines = req.text.split("\n")
        statistics: Dict[str, int] = {}
        classifications: List[Dict[str, Any]] = []
        for idx, line in enumerate(lines, start=1):
            row = _classify_line(line)
            statistics[row["type"]] = statistics.get(row["type"], 0) + 1
            classifications.append(
                {
                    "line_number": idx,
                    "original": line,
                    "type": row["type"],
                    "content": row["content"],
                    "indent_level": row.get("indent_level", 0),
                }
            )
        return {
            "success": True,
            "total_lines": len(lines),
            "statistics": statistics,
            "classifications": classifications,
            "preview": classifications[:20],
        }

    return app


app = create_app()
