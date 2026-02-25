from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

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


logger = logging.getLogger("notesforge.v5")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

APP_VERSION = "5.0"
MAX_BODY_BYTES = 2_000_000
MEDIA_TYPES: Dict[str, str] = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
    "html": "text/html; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
}


def _allowed_origins() -> List[str]:
    env_origins = os.environ.get("NF_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    return [origin.strip() for origin in env_origins.split(",") if origin.strip()]


class AppState:
    def __init__(self) -> None:
        storage_backend = os.environ.get("STORAGE_BACKEND", "local")
        if storage_backend != "local":
            logger.warning("Only local storage backend is implemented. Falling back to local.")

        temp_dir = os.environ.get("DOCX_TEMP_DIR", str(Path.cwd() / ".notesforge_tmp"))
        self.store = FileStore(temp_dir)
        self.exporter = DocumentExporter(self.store)
        self.templates = TemplateRepo.build_default()
        self.theme_store_path = Path(__file__).resolve().parent.parent / "theme_store.json"
        self.theme_store: Dict[str, dict] = self._load_theme_store()

    def _load_theme_store(self) -> Dict[str, dict]:
        if self.theme_store_path.exists():
            try:
                raw = json.loads(self.theme_store_path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    return raw
            except json.JSONDecodeError:
                logger.warning("theme_store.json invalid; resetting")
        return {}

    def save_theme_store(self) -> None:
        self.theme_store_path.write_text(
            json.dumps(self.theme_store, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


def create_app() -> FastAPI:
    app = FastAPI(title="NotesForge API", version=APP_VERSION)
    state = AppState()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def content_length_guard(request: Request, call_next):
        content_len = request.headers.get("content-length")
        if content_len and int(content_len) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request too large"},
            )
        return await call_next(request)

    @app.get("/api/health")
    async def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/health/parser", response_model=ParserHealthResponse)
    async def parser_health() -> ParserHealthResponse:
        return ParserHealthResponse(parser="ok", version=APP_VERSION)

    @app.post("/api/preview", response_model=PreviewResponse)
    async def preview(req: PreviewRequest) -> PreviewResponse:
        parsed = parse_notesforge(req.content)
        sec = GenerateSecurityPayload(
            removeMetadata=req.security.removeMetadata,
            watermark=req.security.watermark,
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

        file_id, output_path, warnings = state.exporter.create_export_file(
            target_format=req.format,
            nodes=parsed.nodes,
            theme=req.theme,
            formatting=formatting,
            security=req.security,
        )
        if warnings:
            logger.warning("generate warnings (%s): %s", file_id, " | ".join(warnings))

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate output file")

        return GenerateResponse(downloadUrl=f"/api/download/{file_id}", fileId=file_id)

    @app.get("/api/download/{file_id}")
    async def download(file_id: str):
        path = state.store.resolve_path(file_id)
        if not path:
            raise HTTPException(status_code=404, detail="File not found")

        ext = path.suffix.lower().lstrip(".")
        media_type = MEDIA_TYPES.get(ext, "application/octet-stream")
        filename = f"notesforge_output.{ext}"
        return FileResponse(path, media_type=media_type, filename=filename)

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

    @app.post("/api/themes", response_model=CreateThemeResponse, status_code=status.HTTP_201_CREATED)
    async def create_theme(req: CreateThemeRequest) -> CreateThemeResponse:
        theme_id = req.name.strip().lower().replace(" ", "_")
        state.theme_store[theme_id] = req.model_dump()
        state.save_theme_store()
        return CreateThemeResponse(themeId=theme_id)

    return app


app = create_app()
