"""
NotesForge Professional - Backend Server v6.2 (Clean)
"""

import json
import logging
import os
import platform
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from Core import AppConfig, DocumentBuilder, TextParser
from Themes import ThemeManager


BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "Config.json"
THEMES_PATH = BASE_DIR / "Themes.json"
PROMPT_PATH = BASE_DIR / "prompt.txt"

ALLOWED_ORIGINS = os.environ.get(
    "NF_CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:5174",
).split(",")

MAX_TEXT_LENGTH = 500_000
MAX_FILENAME_LENGTH = 100

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("NotesForge")


def _safe_name(name: str) -> str:
    cleaned = re.sub(r"[^\w\s\-]", "", name).strip().replace(" ", "_")
    return cleaned or "NotesForge_Document"


class AnalyzeRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_LENGTH)


class GenerateRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_LENGTH)
    format: str = "docx"
    filename: Optional[str] = Field(None, max_length=MAX_FILENAME_LENGTH)

    @validator("format")
    def validate_format(cls, v: str) -> str:
        if v not in ("docx", "pdf", "md", "html"):
            raise ValueError("format must be docx, pdf, md, or html")
        return v

    @validator("filename")
    def sanitize_filename(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = re.sub(r"[^\w\s\-]", "", v).strip().replace(" ", "_")
        if not cleaned:
            return None
        return cleaned[:MAX_FILENAME_LENGTH]


class ConfigUpdateRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=200)
    value: Any


class ThemeApplyRequest(BaseModel):
    theme_name: str = Field(..., min_length=1, max_length=50)


class ThemeSaveRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=200)
    config: Optional[Dict[str, Any]] = None


class ThemeDeleteRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=50)


class PromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=50000)

    @validator("prompt")
    def validate_prompt(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Prompt cannot be empty")
        return v.strip()


class WatermarkUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    type: Optional[str] = None
    text: Optional[str] = None
    image_path: Optional[str] = None
    font: Optional[str] = None
    size: Optional[int] = None
    color: Optional[str] = None
    opacity: Optional[float] = None
    rotation: Optional[int] = None
    position: Optional[str] = None
    scale: Optional[int] = None


class HeaderFooterUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    text: Optional[str] = None
    size: Optional[int] = None
    color: Optional[str] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    alignment: Optional[str] = None
    title_enabled: Optional[bool] = None
    title_position: Optional[str] = None
    title_alignment: Optional[str] = None
    show_page_numbers: Optional[bool] = None
    page_number_position: Optional[str] = None
    page_number_alignment: Optional[str] = None
    page_format: Optional[str] = None
    separator: Optional[bool] = None
    separator_color: Optional[str] = None


class PageBorderUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    width: Optional[int] = None
    color: Optional[str] = None
    style: Optional[str] = None
    offset: Optional[int] = None


class FontUpdateRequest(BaseModel):
    family: Optional[str] = None
    family_code: Optional[str] = None
    h1_family: Optional[str] = None
    h2_family: Optional[str] = None
    h3_family: Optional[str] = None
    h4_family: Optional[str] = None
    h5_family: Optional[str] = None
    h6_family: Optional[str] = None


class AppState:
    def __init__(self) -> None:
        self.config_path = CONFIG_PATH
        self.theme_manager = ThemeManager(THEMES_PATH)
        self.prompt = ""
        self.current_theme = "professional"
        self.app_config = AppConfig.from_dict({})
        self.config_data: Dict[str, Any] = {}
        self.load_config()
        self.load_prompt()

    def _as_config_dict(self) -> Dict[str, Any]:
        cfg = self.app_config
        return {
            "app": {
                "name": cfg.name,
                "version": cfg.version,
                "theme": self.current_theme,
            },
            "fonts": {
                "family": cfg.fonts.family,
                "family_code": cfg.fonts.family_code,
                "h1_family": cfg.fonts.h1_family,
                "h2_family": cfg.fonts.h2_family,
                "h3_family": cfg.fonts.h3_family,
                "h4_family": cfg.fonts.h4_family,
                "h5_family": cfg.fonts.h5_family,
                "h6_family": cfg.fonts.h6_family,
                "sizes": cfg.fonts.sizes,
            },
            "colors": cfg.colors,
            "spacing": cfg.spacing,
            "page": {
                "size": cfg.page.size,
                "orientation": cfg.page.orientation,
                "margins": cfg.page.margins,
                "border": {
                    "enabled": cfg.page.border_enabled,
                    "width": cfg.page.border_width,
                    "color": cfg.page.border_color,
                    "style": cfg.page.border_style,
                    "offset": cfg.page.border_offset,
                },
            },
            "watermark": {
                "enabled": cfg.watermark.enabled,
                "type": cfg.watermark.type,
                "text": cfg.watermark.text,
                "image_path": cfg.watermark.image_path,
                "font": cfg.watermark.font,
                "size": cfg.watermark.size,
                "color": cfg.watermark.color,
                "opacity": cfg.watermark.opacity,
                "rotation": cfg.watermark.rotation,
                "position": cfg.watermark.position,
                "scale": cfg.watermark.scale,
            },
            "header": {
                "enabled": cfg.header.enabled,
                "text": cfg.header.text,
                "size": cfg.header.size,
                "color": cfg.header.color,
                "bold": cfg.header.bold,
                "italic": cfg.header.italic,
                "alignment": cfg.header.alignment,
                "font_family": cfg.header.font_family,
                "show_page_numbers": cfg.header.show_page_numbers,
                "page_number_position": cfg.header.page_number_position,
                "page_number_alignment": cfg.header.page_number_alignment,
                "page_format": cfg.header.page_format,
                "page_number_style": cfg.header.page_number_style,
                "separator": cfg.header.separator,
                "separator_color": cfg.header.separator_color,
            },
            "footer": {
                "enabled": cfg.footer.enabled,
                "text": cfg.footer.text,
                "size": cfg.footer.size,
                "color": cfg.footer.color,
                "bold": cfg.footer.bold,
                "italic": cfg.footer.italic,
                "alignment": cfg.footer.alignment,
                "font_family": cfg.footer.font_family,
                "show_page_numbers": cfg.footer.show_page_numbers,
                "page_number_position": cfg.footer.page_number_position,
                "page_number_alignment": cfg.footer.page_number_alignment,
                "page_format": cfg.footer.page_format,
                "page_number_style": cfg.footer.page_number_style,
                "separator": cfg.footer.separator,
                "separator_color": cfg.footer.separator_color,
            },
        }

    def load_config(self) -> None:
        try:
            if self.config_path.exists():
                raw = json.loads(self.config_path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    app_data = raw.get("app", {})
                    if isinstance(app_data, dict):
                        theme_name = app_data.get("theme")
                        if isinstance(theme_name, str) and theme_name.strip():
                            self.current_theme = theme_name.strip()
                self.app_config = AppConfig.from_dict(raw if isinstance(raw, dict) else {})
            else:
                self.app_config = AppConfig.from_dict({})
                self.save_config()
            self.config_data = self._as_config_dict()
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            self.app_config = AppConfig.from_dict({})
            self.config_data = self._as_config_dict()

    def save_config(self) -> None:
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            self.config_path.write_text(
                json.dumps(self._as_config_dict(), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as e:
            logger.error(f"Failed to save config: {e}")

    def update_config_data(self) -> None:
        self.config_data = self._as_config_dict()

    def load_prompt(self) -> None:
        try:
            if PROMPT_PATH.exists():
                self.prompt = PROMPT_PATH.read_text(encoding="utf-8")
            else:
                self.prompt = ""
        except Exception as e:
            logger.error(f"Error loading prompt: {e}")
            self.prompt = ""

    def save_prompt(self) -> None:
        try:
            PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
            PROMPT_PATH.write_text(self.prompt, encoding="utf-8")
        except Exception as e:
            logger.error(f"Error saving prompt: {e}")

    def config_as_dict(self) -> Dict[str, Any]:
        return {"success": True, "config": self._as_config_dict()}


_app_state: Optional[AppState] = None


def get_state() -> AppState:
    global _app_state
    if _app_state is None:
        _app_state = AppState()
    return _app_state


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "version": "6.2"}


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    parser = TextParser()
    lines = req.text.split("\n")
    results = []
    stats: Dict[str, int] = {}
    for i, line in enumerate(lines):
        c = parser.classify_line(line)
        t = c.get("type", "text")
        stats[t] = stats.get(t, 0) + 1
        results.append(
            {
                "line_number": i + 1,
                "original": line[:200],
                "type": t,
                "content": c.get("content", "")[:100],
                "indent_level": c.get("indent_level"),
            }
        )
    return {
        "success": True,
        "total_lines": len(lines),
        "statistics": stats,
        "classifications": results,
        "preview": results[:20],
    }


@app.post("/api/generate")
async def generate(req: GenerateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = _safe_name(req.filename) if req.filename else f"NotesForge_{ts}"
        tmp = Path(tempfile.gettempdir())
        docx_path = tmp / f"{base}.docx"

        builder = DocumentBuilder(st.app_config)
        builder.build(req.text, output_path=str(docx_path))

        if req.format == "pdf":
            pdf_path = tmp / f"{base}.pdf"
            system = platform.system()
            cmd = (
                ["soffice", "--headless", "--convert-to", "pdf", str(docx_path), "--outdir", str(tmp)]
                if system == "Windows"
                else ["libreoffice", "--headless", "--convert-to", "pdf", str(docx_path), "--outdir", str(tmp)]
            )
            try:
                subprocess.run(cmd, check=True, timeout=40)
                if pdf_path.exists():
                    return {
                        "success": True,
                        "filename": f"{base}.pdf",
                        "download_url": f"/api/download/{base}.pdf",
                    }
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                pass
            return {
                "success": True,
                "filename": f"{base}.docx",
                "download_url": f"/api/download/{base}.docx",
                "warning": "PDF conversion unavailable, returned DOCX instead",
            }

        if req.format == "html":
            try:
                import mammoth

                with open(docx_path, "rb") as docx_file:
                    result = mammoth.convert_to_html(docx_file)
                html_path = tmp / f"{base}.html"
                html_path.write_text(result.value, encoding="utf-8")
                return {
                    "success": True,
                    "filename": f"{base}.html",
                    "download_url": f"/api/download/{base}.html",
                }
            except ImportError:
                return {"success": False, "error": "mammoth not installed"}

        if req.format == "md":
            md_path = tmp / f"{base}.md"
            md_path.write_text(_convert_to_markdown(req.text), encoding="utf-8")
            return {
                "success": True,
                "filename": f"{base}.md",
                "download_url": f"/api/download/{base}.md",
            }

        return {
            "success": True,
            "filename": f"{base}.docx",
            "download_url": f"/api/download/{base}.docx",
        }
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(500, str(e))


@app.get("/api/download/{filename}")
async def download(filename: str):
    tmp_dir = os.path.realpath(tempfile.gettempdir())
    requested = os.path.realpath(os.path.join(tmp_dir, filename))
    if not requested.startswith(tmp_dir):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(requested):
        raise HTTPException(404, "File not found")
    ext = filename.split(".")[-1]
    media_types = {
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pdf": "application/pdf",
        "html": "text/html",
        "md": "text/markdown",
    }
    return FileResponse(requested, filename=filename, media_type=media_types.get(ext, "application/octet-stream"))


@app.get("/api/config")
async def get_config(st: AppState = Depends(get_state)) -> Dict[str, Any]:
    return st.config_as_dict()


@app.post("/api/config/update")
async def update_config(req: ConfigUpdateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    try:
        keys = req.path.split(".")
        cur = st.config_data
        for k in keys[:-1]:
            cur = cur.setdefault(k, {})
        cur[keys[-1]] = req.value
        st.app_config = AppConfig.from_dict(st.config_data)
        st.update_config_data()
        st.save_config()
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/config/watermark")
async def update_watermark(req: WatermarkUpdateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    wm = st.app_config.watermark
    for field_name, value in req.dict(exclude_unset=True).items():
        if hasattr(wm, field_name):
            setattr(wm, field_name, value)
    st.update_config_data()
    st.save_config()
    return {"success": True}


@app.post("/api/config/header")
async def update_header(req: HeaderFooterUpdateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    for field_name, value in req.dict(exclude_unset=True).items():
        if hasattr(st.app_config.header, field_name):
            setattr(st.app_config.header, field_name, value)
    st.update_config_data()
    st.save_config()
    return {"success": True}


@app.post("/api/config/footer")
async def update_footer(req: HeaderFooterUpdateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    for field_name, value in req.dict(exclude_unset=True).items():
        if hasattr(st.app_config.footer, field_name):
            setattr(st.app_config.footer, field_name, value)
    st.update_config_data()
    st.save_config()
    return {"success": True}


@app.post("/api/config/page-border")
async def update_page_border(req: PageBorderUpdateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    page = st.app_config.page
    if req.enabled is not None:
        page.border_enabled = req.enabled
    if req.width is not None:
        page.border_width = req.width
    if req.color is not None:
        page.border_color = req.color
    if req.style is not None:
        page.border_style = req.style
    if req.offset is not None:
        page.border_offset = req.offset
    st.update_config_data()
    st.save_config()
    return {"success": True}


@app.post("/api/config/fonts")
async def update_fonts(req: FontUpdateRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    fonts = st.app_config.fonts
    for field_name, value in req.dict(exclude_unset=True).items():
        if hasattr(fonts, field_name):
            setattr(fonts, field_name, value)
    st.update_config_data()
    st.save_config()
    return {"success": True}


@app.get("/api/themes")
async def get_themes(st: AppState = Depends(get_state)) -> Dict[str, Any]:
    return {
        "success": True,
        "themes": st.theme_manager.list_themes(),
        "current_theme": st.current_theme,
    }


@app.post("/api/themes/apply")
async def apply_theme(req: ThemeApplyRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    theme = st.theme_manager.get_theme(req.theme_name)
    if not theme:
        raise HTTPException(400, f"Theme '{req.theme_name}' not found")
    st.app_config = AppConfig.from_dict(theme)
    st.current_theme = req.theme_name
    st.update_config_data()
    st.save_config()
    return {
        "success": True,
        "message": f"Theme '{req.theme_name}' applied",
        "config": st.config_data,
        "current_theme": st.current_theme,
    }


@app.post("/api/themes/save")
async def save_theme(req: ThemeSaveRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    key = req.key.lower().replace(" ", "_")
    if not key:
        raise HTTPException(400, "Invalid theme key")
    builtin = {"professional", "modern", "minimal", "academic", "corporate", "creative", "startup"}
    if key in builtin:
        raise HTTPException(400, f"Cannot overwrite built-in theme '{key}'")
    payload_config = req.config if isinstance(req.config, dict) else st.config_data
    payload = {
        "name": req.name,
        "description": req.description or "Custom theme",
        **payload_config,
    }
    st.theme_manager.set_theme(key, payload)
    return {
        "success": True,
        "message": f"Theme '{req.name}' saved successfully",
        "key": key,
    }


@app.post("/api/themes/delete")
async def delete_theme(req: ThemeDeleteRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    key = req.key.lower()
    builtin = {"professional", "modern", "minimal", "academic", "corporate", "creative", "startup"}
    if key in builtin:
        raise HTTPException(400, "Cannot delete built-in themes")
    if not st.theme_manager.delete_theme(key):
        raise HTTPException(404, f"Theme '{key}' not found")
    return {"success": True, "message": "Theme deleted successfully"}


@app.get("/api/prompt")
async def get_prompt(st: AppState = Depends(get_state)) -> Dict[str, Any]:
    return {"success": True, "prompt": st.prompt}


@app.post("/api/prompt")
async def update_prompt(req: PromptRequest, st: AppState = Depends(get_state)) -> Dict[str, Any]:
    st.prompt = req.prompt
    st.save_prompt()
    return {"success": True, "message": "Prompt saved"}


def _convert_to_markdown(text: str) -> str:
    lines = text.split("\n")
    md_lines = []
    for line in lines:
        stripped = line.rstrip("\n").strip()
        if not stripped:
            md_lines.append("")
            continue
        match = re.match(r"^([A-Z][A-Z0-9\-]*):\s*(.*)$", stripped)
        if not match:
            md_lines.append(stripped)
            continue
        marker, content = match.groups()
        content = content.strip().strip('"')
        if marker in ("HEADING", "H1"):
            md_lines.append(f"# {content}")
        elif marker in ("SUBHEADING", "H2"):
            md_lines.append(f"## {content}")
        elif marker in ("SUB-SUBHEADING", "H3"):
            md_lines.append(f"### {content}")
        elif marker == "H4":
            md_lines.append(f"#### {content}")
        elif marker == "H5":
            md_lines.append(f"##### {content}")
        elif marker == "H6":
            md_lines.append(f"###### {content}")
        elif marker in ("PARAGRAPH", "PARA"):
            md_lines.append(content)
        elif marker == "BULLET":
            indent = len(line) - len(line.lstrip())
            md_lines.append(f"{'  ' * (indent // 2)}- {content}")
        elif marker == "NUMBERED":
            md_lines.append(f"1. {content}")
        elif marker == "CODE":
            md_lines.append(f"```\n{content}\n```")
        elif marker == "TABLE":
            md_lines.append(" | ".join(p.strip() for p in content.split("|")))
        elif marker == "QUOTE":
            md_lines.append(f"> {content}")
        elif marker in ("NOTE", "IMPORTANT"):
            md_lines.append(f"> **Note:** {content}")
        elif marker == "LINK":
            parts = content.split("|")
            md_lines.append(f"[{parts[0].strip()}]({parts[1].strip() if len(parts) > 1 else ''})")
        elif marker == "IMAGE":
            parts = content.split("|")
            md_lines.append(f"![{parts[1].strip() if len(parts) > 1 else ''}]({parts[0].strip()})")
        elif marker == "HIGHLIGHT":
            md_lines.append(f"**{content.split('|')[0].strip()}**")
        elif marker == "TOC":
            md_lines.append("\n## Table of Contents\n")
        else:
            md_lines.append(content)
    return "\n".join(md_lines)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
