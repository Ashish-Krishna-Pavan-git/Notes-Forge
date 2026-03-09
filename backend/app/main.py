from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Mapping, MutableMapping

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .exporter import DocumentExporter, ExportResult, FileStore
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
    ThemePayload,
    WatermarkPayload,
)
from .parser import MARKER_RE, parse_notesforge
from .templates_repo import TemplateRepo


logger = logging.getLogger("notesforge.v7")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

APP_VERSION = "7.0.0"
MAX_BODY_BYTES = 2_000_000
MAX_PROMPT_BYTES = 200_000
DEFAULT_PROMPT = (
    "Using strict NotesForge marker syntax (H1-H6, PARAGRAPH, CENTER, RIGHT, JUSTIFY, BULLET, NUMBERED, "
    "TABLE, TABLE_CAPTION, IMAGE, FIGURE, FIGURE_CAPTION, CODE, ASCII, PAGEBREAK, COVER_PAGE, "
    "CERTIFICATE_PAGE, DECLARATION_PAGE, ACKNOWLEDGEMENT_PAGE, ABSTRACT_PAGE, TOC, LIST_OF_TABLES, "
    "LIST_OF_FIGURES, CHAPTER, REFERENCES, REFERENCE, APPENDIX), generate a professional academic document. "
    "Output only marker lines."
)

MEDIA_TYPES: Dict[str, str] = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
    "html": "text/html; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
}

PRODUCTION_CORS_ORIGINS = [
    "https://notes-forge-ruddy.vercel.app",
    "https://notes-forge.onrender.com",
]

LOCAL_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

BACKEND_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_CONFIG_PATH = BACKEND_ROOT / "config.json"
CANONICAL_THEMES_PATH = BACKEND_ROOT / "themes.json"
PROMPT_PATH = BACKEND_ROOT / "prompt.txt"
LEGACY_CONFIG_PATHS = [BACKEND_ROOT / "Config.json"]
LEGACY_THEME_PATHS = [BACKEND_ROOT / "Themes.json", BACKEND_ROOT / "theme_store.json"]
SUPPORTED_EXPORT_FORMATS = {"docx", "pdf", "html", "md", "txt"}
DEFAULT_THEME_MODEL = ThemePayload()


class ConfigUpdateRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=240)
    value: Any


class ThemeApplyRequest(BaseModel):
    theme_name: str = Field(..., min_length=1, max_length=80)


class ThemeSaveRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="")
    config: Dict[str, Any] = Field(default_factory=dict)


class ThemeDeleteRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=120)


class PromptUpdateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_BYTES)


class AnalyzeRequest(BaseModel):
    text: str = Field(default="", max_length=500_000)
    content: str = Field(default="", max_length=500_000)


def _allowed_origins() -> List[str]:
    extras_raw = os.environ.get("NF_CORS_ORIGINS", "").strip()
    extras = [item.strip() for item in extras_raw.split(",") if item.strip()] if extras_raw else []
    ordered: List[str] = []
    for origin in [*LOCAL_CORS_ORIGINS, *PRODUCTION_CORS_ORIGINS, *extras]:
        if origin not in ordered:
            ordered.append(origin)
    return ordered


def _read_json_dict(path: Path) -> Dict[str, Any] | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    return raw if isinstance(raw, dict) else None


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _slugify_key(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_]+", "_", value.strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "theme"


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_line_spacing(value: Any, default: float = 1.5) -> float:
    try:
        candidate = float(value)
    except (TypeError, ValueError):
        candidate = default
    allowed = [1.0, 1.15, 1.5, 2.0]
    return min(allowed, key=lambda item: abs(item - candidate))


def _margin_to_mm(value: Any, fallback: float) -> float:
    n = _as_float(value, fallback)
    return n * 25.4 if n <= 5.0 else n


def _deep_merge(base: Mapping[str, Any], incoming: Mapping[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = dict(base)
    for key, value in incoming.items():
        if isinstance(value, Mapping) and isinstance(merged.get(key), Mapping):
            merged[key] = _deep_merge(_as_dict(merged.get(key)), value)
        else:
            merged[key] = value
    return merged


def _default_config() -> Dict[str, Any]:
    return {
        "app": {"name": "NotesForge Professional", "version": APP_VERSION, "theme": "professional"},
        "fonts": {
            "family": "Times New Roman",
            "family_code": "JetBrains Mono",
            "h1_family": "Times New Roman",
            "h2_family": "Times New Roman",
            "h3_family": "Times New Roman",
            "h4_family": "Times New Roman",
            "h5_family": "Times New Roman",
            "h6_family": "Times New Roman",
            "bullet_family": "Times New Roman",
            "sizes": {
                "h1": 18,
                "h2": 16,
                "h3": 14,
                "h4": 14,
                "h5": 12,
                "h6": 12,
                "body": 12,
                "code": 12,
                "header": 10,
                "footer": 11,
                "title": 20,
                "footnote": 11,
            },
        },
        "colors": {
            "h1": "#1F3A5F",
            "h2": "#2B6CB0",
            "h3": "#2B6CB0",
            "h4": "#334155",
            "h5": "#475569",
            "h6": "#64748B",
            "body": "#17202a",
            "code_background": "#0f172a",
            "code_text": "#e2e8f0",
            "table_header_bg": "#f3f4f6",
            "table_header_text": "#111827",
            "table_odd_row": "#ffffff",
            "table_even_row": "#f8fafc",
            "table_border": "#d1d5db",
            "link": "#2563eb",
        },
        "spacing": {
            "line_spacing": 1.5,
            "paragraph_spacing_before": 0,
            "paragraph_spacing_after": 6,
            "heading_spacing_before": 10,
            "heading_spacing_after": 6,
            "paragraph_first_line_indent": 0,
            "bullet_base_indent": 0.25,
            "bullet_indent_per_level": 0.45,
            "code_indent": 0,
            "quote_indent": 0.5,
            "paragraph_alignment": "left",
        },
        "page": {
            "size": "A4",
            "orientation": "portrait",
            "margins": {"top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0},
            "border": {"enabled": False, "width": 1, "color": "#000000", "style": "single", "offset": 24},
        },
        "watermark": {
            "enabled": False,
            "type": "text",
            "text": "",
            "image_path": "",
            "font": "Times New Roman",
            "size": 48,
            "color": "#1F3A5F",
            "opacity": 0.1,
            "rotation": 315,
            "position": "center",
            "scale": 100,
        },
        "header": {
            "enabled": True,
            "text": "",
            "alignment": "center",
            "font_family": "Times New Roman",
            "size": 10,
            "color": "#1F3A5F",
            "bold": False,
            "italic": False,
            "separator": False,
            "separator_color": "#CCCCCC",
            "show_page_numbers": False,
            "page_number_position": "header",
            "page_number_alignment": "center",
            "page_number_style": "arabic",
            "page_format": "Page X",
        },
        "footer": {
            "enabled": True,
            "text": "",
            "alignment": "center",
            "font_family": "Times New Roman",
            "size": 11,
            "color": "#1F3A5F",
            "bold": False,
            "italic": False,
            "separator": False,
            "separator_color": "#CCCCCC",
            "show_page_numbers": True,
            "page_number_position": "footer",
            "page_number_alignment": "center",
            "page_number_style": "arabic",
            "page_format": "Page X",
        },
    }


def _default_theme_record(theme_key: str, name: str, config: Mapping[str, Any], *, builtin: bool) -> Dict[str, Any]:
    cfg = _deep_merge(_default_config(), _as_dict(config))
    fonts = _as_dict(cfg.get("fonts"))
    colors = _as_dict(cfg.get("colors"))
    spacing = _as_dict(cfg.get("spacing"))
    page = _as_dict(cfg.get("page"))
    header = _as_dict(cfg.get("header"))
    footer = _as_dict(cfg.get("footer"))
    watermark = _as_dict(cfg.get("watermark"))
    sizes = _as_dict(fonts.get("sizes"))
    border = _as_dict(page.get("border"))
    table = {
        "border_color": colors.get("table_border", "#d1d5db"),
        "border_width": 1,
        "border_style": "single",
        "header_fill": colors.get("table_header_bg", "#f3f4f6"),
        "header_text": colors.get("table_header_text", "#111827"),
        "odd_row": colors.get("table_odd_row", "#ffffff"),
        "even_row": colors.get("table_even_row", "#f8fafc"),
        "text_alignment": "left",
    }
    code = {
        "font_family": fonts.get("family_code", "JetBrains Mono"),
        "font_size": sizes.get("code", 10),
        "background": colors.get("code_background", "#0f172a"),
        "text": colors.get("code_text", "#e2e8f0"),
    }
    heading = {
        f"h{level}": {
            "size": sizes.get(f"h{level}", max(12, 26 - (level * 2))),
            "weight": "700" if level == 1 else "600",
            "color": colors.get(f"h{level}", colors.get("h1", "#1F3A5F")),
        }
        for level in range(1, 7)
    }
    return {
        "name": name,
        "description": f"{name} theme",
        "builtin": builtin,
        "user_created": not builtin,
        "fonts": fonts,
        "colors": colors,
        "spacing": spacing,
        "page": page,
        "header": header,
        "footer": footer,
        "watermark": watermark,
        "heading": heading,
        "table": table,
        "code": code,
        "borders": {
            "enabled": border.get("enabled", False),
            "width": border.get("width", 1),
            "color": border.get("color", "#000000"),
            "style": border.get("style", "single"),
            "offset": border.get("offset", 24),
        },
        "styles": {},
    }


def _default_themes(config: Mapping[str, Any]) -> Dict[str, Any]:
    professional = _default_theme_record("professional", "Professional", config, builtin=True)
    corporate = _deep_merge(
        professional,
        {
            "name": "Corporate",
            "description": "Corporate red accent",
            "colors": {
                "h1": "#B91C1C",
                "h2": "#DC2626",
                "h3": "#EF4444",
                "table_header_bg": "#B91C1C",
                "table_border": "#DC2626",
                "table_odd_row": "#FEE2E2",
            },
            "fonts": {"family": "Arial", "family_code": "Consolas", "sizes": {"h1": 26, "h2": 20, "body": 11}},
            "header": {"text": "CORPORATE DOCUMENT", "color": "#B91C1C", "bold": True},
            "footer": {"color": "#DC2626", "show_page_numbers": True},
        },
    )
    corporate["builtin"] = True
    corporate["user_created"] = False

    modern = _deep_merge(
        professional,
        {
            "name": "Modern",
            "description": "Clean modern styling with blue accents",
            "colors": {
                "h1": "#0F172A",
                "h2": "#1D4ED8",
                "h3": "#0284C7",
                "table_header_bg": "#DBEAFE",
                "table_border": "#93C5FD",
            },
            "fonts": {"family": "Segoe UI", "family_code": "Consolas"},
        },
    )
    modern["builtin"] = True
    modern["user_created"] = False

    academic = _deep_merge(
        professional,
        {
            "name": "Academic",
            "description": "Conservative typography for reports and papers",
            "colors": {
                "h1": "#111827",
                "h2": "#374151",
                "h3": "#4B5563",
                "table_header_bg": "#E5E7EB",
                "table_border": "#D1D5DB",
            },
            "fonts": {"family": "Times New Roman", "family_code": "Consolas"},
            "spacing": {"line_spacing": 1.6},
        },
    )
    academic["builtin"] = True
    academic["user_created"] = False

    executive = _deep_merge(
        professional,
        {
            "name": "Executive Slate",
            "description": "High-contrast executive style",
            "colors": {
                "h1": "#0F172A",
                "h2": "#1E293B",
                "h3": "#334155",
                "table_header_bg": "#E2E8F0",
                "table_border": "#94A3B8",
            },
            "fonts": {"family": "Georgia", "family_code": "Consolas"},
            "spacing": {"line_spacing": 1.5},
        },
    )
    executive["builtin"] = True
    executive["user_created"] = False

    oceanic = _deep_merge(
        professional,
        {
            "name": "Oceanic Teal",
            "description": "Teal palette for technical and product docs",
            "colors": {
                "h1": "#0F766E",
                "h2": "#0D9488",
                "h3": "#14B8A6",
                "table_header_bg": "#CCFBF1",
                "table_border": "#5EEAD4",
            },
            "fonts": {"family": "Segoe UI", "family_code": "Consolas"},
        },
    )
    oceanic["builtin"] = True
    oceanic["user_created"] = False

    monochrome = _deep_merge(
        professional,
        {
            "name": "Monochrome",
            "description": "Clean black-and-gray print-friendly style",
            "colors": {
                "h1": "#111827",
                "h2": "#1F2937",
                "h3": "#374151",
                "table_header_bg": "#E5E7EB",
                "table_border": "#9CA3AF",
            },
            "fonts": {"family": "Arial", "family_code": "Consolas"},
        },
    )
    monochrome["builtin"] = True
    monochrome["user_created"] = False

    startup = _deep_merge(
        professional,
        {
            "name": "Startup Pitch",
            "description": "Pitch-deck oriented theme",
            "colors": {
                "h1": "#0E7490",
                "h2": "#0284C7",
                "h3": "#0369A1",
                "table_header_bg": "#CFFAFE",
                "table_border": "#67E8F9",
            },
            "fonts": {"family": "Calibri", "family_code": "Consolas"},
            "spacing": {"line_spacing": 1.3},
        },
    )
    startup["builtin"] = True
    startup["user_created"] = False

    frontlines = _deep_merge(
        professional,
        {
            "name": "Frontlines Edu Tech",
            "description": "Times New Roman theme with purple-orange academic styling.",
            "colors": {
                "h1": "#6A00F4",
                "h2": "#7B2CBF",
                "h3": "#9D4EDD",
                "h4": "#B5179E",
                "h5": "#7209B7",
                "h6": "#560BAD",
                "table_header_bg": "#F77F00",
                "table_header_text": "#FFFFFF",
                "table_odd_row": "#FFF4E6",
                "table_even_row": "#FFE5B4",
                "code_background": "#1E1B2E",
                "code_text": "#FFFFFF",
                "link": "#6A00F4",
            },
            "fonts": {
                "family": "Times New Roman",
                "family_code": "JetBrains Mono",
                "h1_family": "Times New Roman",
                "h2_family": "Times New Roman",
                "h3_family": "Times New Roman",
                "h4_family": "Times New Roman",
                "h5_family": "Times New Roman",
                "h6_family": "Times New Roman",
                "bullet_family": "Times New Roman",
                "sizes": {"h1": 20, "h2": 18, "h3": 16, "h4": 14, "h5": 12, "h6": 12, "body": 12, "code": 11},
            },
            "spacing": {
                "line_spacing": 1.5,
                "paragraph_spacing_after": 14,
                "heading_spacing_before": 14,
                "heading_spacing_after": 8,
                "bullet_base_indent": 0.5,
                "bullet_indent_per_level": 0.75,
                "code_indent": 0.35,
                "quote_indent": 0.5,
            },
            "header": {
                "enabled": True,
                "text": "Frontlines Edu Tech",
                "alignment": "center",
                "color": "#F77F00",
                "font_family": "Segoe UI",
                "size": 10,
                "show_page_numbers": True,
                "page_format": "X | Page",
                "page_number_style": "arabic",
                "separator": True,
                "separator_color": "#CCCCCC",
            },
            "footer": {
                "enabled": True,
                "text": "Cryptography |",
                "alignment": "right",
                "color": "#7B2CBF",
                "font_family": "Segoe UI",
                "size": 10,
                "show_page_numbers": True,
                "page_format": "X | Page",
                "page_number_style": "arabic",
                "separator": True,
                "separator_color": "#CCCCCC",
            },
            "page": {
                "size": "A4",
                "orientation": "portrait",
                "margins": {"top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0},
                "border": {"enabled": True, "width": 1, "color": "#000000", "style": "single", "offset": 24},
            },
            "watermark": {
                "enabled": True,
                "type": "text",
                "text": "CONFIDENTIAL",
                "font": "Times New Roman",
                "size": 48,
                "color": "#6200EA",
                "opacity": 0.1,
                "rotation": 315,
                "position": "center",
            },
        },
    )
    frontlines["builtin"] = True
    frontlines["user_created"] = False

    academic_classic = _deep_merge(
        professional,
        {
            "name": "Academic Classic",
            "description": "Classic university layout with formal typography.",
            "fonts": {"family": "Times New Roman", "family_code": "JetBrains Mono"},
            "spacing": {"line_spacing": 1.5},
            "colors": {"h1": "#1F3A5F", "h2": "#2F4F7F", "h3": "#3D5A80"},
        },
    )
    university_blue = _deep_merge(
        professional,
        {
            "name": "University Blue",
            "description": "Deep-blue institutional report style.",
            "colors": {
                "h1": "#0B3D91",
                "h2": "#1E5AA8",
                "h3": "#2F6BC5",
                "table_header_bg": "#DCEBFF",
                "table_border": "#9DC1F2",
            },
            "fonts": {"family": "Times New Roman", "family_code": "JetBrains Mono"},
        },
    )
    engineering_report = _deep_merge(
        professional,
        {
            "name": "Engineering Report",
            "description": "Structured technical report with clear section contrast.",
            "colors": {
                "h1": "#0F172A",
                "h2": "#1F2937",
                "h3": "#334155",
                "table_header_bg": "#E2E8F0",
                "table_border": "#94A3B8",
            },
            "fonts": {"family": "Inter", "family_code": "JetBrains Mono"},
        },
    )
    clean_research = _deep_merge(
        professional,
        {
            "name": "Clean Research",
            "description": "Light, clean research manuscript visual style.",
            "colors": {
                "h1": "#111827",
                "h2": "#1F2937",
                "h3": "#374151",
                "table_header_bg": "#F3F4F6",
            },
            "spacing": {"line_spacing": 1.5, "paragraph_spacing_after": 8},
            "fonts": {"family": "Times New Roman", "family_code": "JetBrains Mono"},
        },
    )
    modern_minimal = _deep_merge(
        professional,
        {
            "name": "Modern Minimal",
            "description": "Minimalist modern style for concise documents.",
            "colors": {"h1": "#111827", "h2": "#2563EB", "h3": "#3B82F6"},
            "fonts": {"family": "Inter", "family_code": "JetBrains Mono"},
            "spacing": {"line_spacing": 1.15},
        },
    )
    corporate_white = _deep_merge(
        professional,
        {
            "name": "Corporate White",
            "description": "White-paper style with polished corporate contrast.",
            "colors": {
                "h1": "#0F172A",
                "h2": "#1E293B",
                "h3": "#334155",
                "table_header_bg": "#F8FAFC",
            },
            "fonts": {"family": "Georgia", "family_code": "JetBrains Mono"},
        },
    )
    dark_technical = _deep_merge(
        professional,
        {
            "name": "Dark Technical",
            "description": "Dark-accent technical layout optimized for code-heavy docs.",
            "colors": {
                "h1": "#0EA5E9",
                "h2": "#38BDF8",
                "h3": "#7DD3FC",
                "body": "#E2E8F0",
                "code_background": "#0B1220",
                "code_text": "#E2E8F0",
                "table_header_bg": "#0F172A",
                "table_header_text": "#E2E8F0",
                "table_odd_row": "#111827",
                "table_even_row": "#0F172A",
            },
            "page": {"border": {"enabled": True, "color": "#0EA5E9", "width": 1, "style": "single", "offset": 24}},
            "fonts": {"family": "Roboto", "family_code": "JetBrains Mono"},
        },
    )
    elegant_thesis = _deep_merge(
        professional,
        {
            "name": "Elegant Thesis",
            "description": "Elegant thesis style with serif emphasis.",
            "fonts": {"family": "Georgia", "family_code": "JetBrains Mono"},
            "spacing": {"line_spacing": 2.0},
            "colors": {"h1": "#4A2C2A", "h2": "#6B3F3A", "h3": "#8A5148"},
        },
    )
    lecture_notes = _deep_merge(
        professional,
        {
            "name": "Lecture Notes",
            "description": "Readable notes style for classroom and revision docs.",
            "fonts": {"family": "Roboto", "family_code": "JetBrains Mono"},
            "spacing": {"line_spacing": 1.15},
            "colors": {"h1": "#1D4ED8", "h2": "#2563EB", "h3": "#3B82F6"},
        },
    )
    professional_docs = _deep_merge(
        professional,
        {
            "name": "Professional Docs",
            "description": "Balanced professional documentation theme.",
            "fonts": {"family": "Times New Roman", "family_code": "JetBrains Mono"},
            "spacing": {"line_spacing": 1.5},
            "colors": {"h1": "#1F3A5F", "h2": "#345995", "h3": "#4A6FA5"},
        },
    )

    for theme in [
        academic_classic,
        university_blue,
        engineering_report,
        clean_research,
        modern_minimal,
        corporate_white,
        dark_technical,
        elegant_thesis,
        lecture_notes,
        professional_docs,
    ]:
        theme["builtin"] = True
        theme["user_created"] = False

    return {
        "themes": {
            "professional": professional,
            "corporate": corporate,
            "modern": modern,
            "academic": academic,
            "executive": executive,
            "oceanic": oceanic,
            "monochrome": monochrome,
            "startup": startup,
            "frontlines_edutech_theme": frontlines,
            "academic_classic": academic_classic,
            "university_blue": university_blue,
            "engineering_report": engineering_report,
            "clean_research": clean_research,
            "modern_minimal": modern_minimal,
            "corporate_white": corporate_white,
            "dark_technical": dark_technical,
            "elegant_thesis": elegant_thesis,
            "lecture_notes": lecture_notes,
            "professional_docs": professional_docs,
        }
    }


def _normalize_config_payload(raw: Mapping[str, Any] | None) -> Dict[str, Any]:
    payload = _as_dict(raw.get("config")) if isinstance(raw, Mapping) and isinstance(raw.get("config"), dict) else _as_dict(raw)
    normalized = _deep_merge(_default_config(), payload)
    app_section = _as_dict(normalized.get("app"))
    app_section["version"] = APP_VERSION
    normalized["app"] = app_section
    return normalized


def _payload_theme_to_record(theme_key: str, payload: Mapping[str, Any], config: Mapping[str, Any]) -> Dict[str, Any]:
    record = _default_theme_record(theme_key, str(payload.get("name") or theme_key), config, builtin=False)
    primary = str(payload.get("primaryColor") or "").strip()
    family = str(payload.get("fontFamily") or "").strip()
    if primary:
        record["colors"]["h1"] = primary
        record["colors"]["h2"] = primary
        record["colors"]["h3"] = primary
    if family:
        record["fonts"]["family"] = family
    styles = payload.get("styles")
    if isinstance(styles, dict):
        record["styles"] = dict(styles)
    return record


def _normalize_theme_record(theme_key: str, raw: Mapping[str, Any], config: Mapping[str, Any], *, builtin_default: bool) -> Dict[str, Any]:
    if "colors" not in raw and "fonts" not in raw and ("primaryColor" in raw or "fontFamily" in raw):
        candidate = _payload_theme_to_record(theme_key, raw, config)
        raw_data = candidate
    else:
        raw_data = dict(raw)

    base = _default_theme_record(theme_key, str(raw_data.get("name") or theme_key.replace("_", " ").title()), config, builtin=builtin_default)
    merged = _deep_merge(base, raw_data)
    merged["name"] = str(merged.get("name") or base["name"])
    merged["description"] = str(merged.get("description") or base["description"])
    merged["builtin"] = bool(merged.get("builtin", builtin_default))
    merged["user_created"] = bool(merged.get("user_created", not merged["builtin"]))
    for section in ("fonts", "colors", "spacing", "page", "header", "footer", "watermark", "heading", "table", "code", "borders", "styles"):
        if not isinstance(merged.get(section), dict):
            merged[section] = dict(base[section])
    return merged


def _normalize_themes_payload(raw: Mapping[str, Any] | None, config: Mapping[str, Any], *, builtin_default: bool) -> Dict[str, Any]:
    if isinstance(raw, Mapping) and isinstance(raw.get("themes"), dict):
        source = _as_dict(raw.get("themes"))
    else:
        source = _as_dict(raw)

    themes: Dict[str, Dict[str, Any]] = {}
    for raw_key, raw_theme in source.items():
        if not isinstance(raw_key, str) or not isinstance(raw_theme, dict):
            continue
        theme_key = _slugify_key(raw_key)
        themes[theme_key] = _normalize_theme_record(theme_key, raw_theme, config, builtin_default=builtin_default)

    if not themes:
        return _default_themes(config)
    return {"themes": themes}


def _theme_record_from_config(theme_key: str, name: str, description: str, config: Mapping[str, Any]) -> Dict[str, Any]:
    base = _default_theme_record(theme_key, name, config, builtin=False)
    source = _as_dict(config)
    record = _deep_merge(base, {section: _as_dict(source.get(section)) for section in ("fonts", "colors", "spacing", "page", "header", "footer", "watermark")})
    record["name"] = name
    record["description"] = description or f"{name} custom theme"
    record["builtin"] = False
    record["user_created"] = True
    return record


def _apply_theme_to_config(config: Mapping[str, Any], theme_key: str, theme: Mapping[str, Any]) -> Dict[str, Any]:
    merged = _deep_merge(_default_config(), config)
    app_section = _as_dict(merged.get("app"))
    app_section["theme"] = theme_key
    merged["app"] = app_section
    for section in ("fonts", "colors", "spacing", "page", "header", "footer", "watermark"):
        incoming = theme.get(section)
        if isinstance(incoming, dict):
            merged[section] = _deep_merge(_as_dict(merged.get(section)), incoming)
    return merged


def _set_by_path(root: MutableMapping[str, Any], path: str, value: Any) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", path or ""):
        raise ValueError("Invalid config path")
    if ".." in path or path.startswith("."):
        raise ValueError("Invalid config path")

    keys = [k for k in path.split(".") if k]
    if not keys:
        raise ValueError("Invalid config path")
    cursor: MutableMapping[str, Any] = root
    for key in keys[:-1]:
        current = cursor.get(key)
        if not isinstance(current, dict):
            cursor[key] = {}
        cursor = cursor[key]
    if path.lower() in {"spacing.line_spacing", "styles.line_spacing"}:
        cursor[keys[-1]] = _normalize_line_spacing(value, default=1.5)
    else:
        cursor[keys[-1]] = value


def _infer_page_mode(page_format: Any) -> str:
    val = str(page_format or "").lower()
    return "page_x_of_y" if "of" in val else "page_x"


def _theme_to_payload(theme_key: str, theme: Mapping[str, Any]) -> ThemePayload:
    cfg = _default_config()
    merged = _apply_theme_to_config(cfg, theme_key, theme)
    fonts = _as_dict(merged.get("fonts"))
    colors = _as_dict(merged.get("colors"))
    spacing = _as_dict(merged.get("spacing"))
    page = _as_dict(merged.get("page"))
    header = _as_dict(merged.get("header"))
    footer = _as_dict(merged.get("footer"))
    table = _as_dict(theme.get("table"))
    code = _as_dict(theme.get("code"))
    sizes = _as_dict(fonts.get("sizes"))
    margins = _as_dict(page.get("margins"))
    border = _as_dict(page.get("border"))

    heading_data: Dict[str, Dict[str, Any]] = {}
    theme_headings = _as_dict(theme.get("heading"))
    for level in range(1, 7):
        token = _as_dict(theme_headings.get(f"h{level}"))
        heading_data[f"h{level}"] = {
            "size": _as_int(token.get("size"), _as_int(sizes.get(f"h{level}"), max(12, 26 - (level * 2)))),
            "weight": str(token.get("weight") or ("700" if level == 1 else "600")),
            "color": str(token.get("color") or colors.get(f"h{level}") or colors.get("h1", "#1F3A5F")),
        }

    style_map = {
        "line_spacing": _normalize_line_spacing(spacing.get("line_spacing"), default=1.5),
        "paragraph_spacing_before": spacing.get("paragraph_spacing_before", 0),
        "paragraph_spacing_after": spacing.get("paragraph_spacing_after", 6),
        "heading_spacing_before": spacing.get("heading_spacing_before", 10),
        "heading_spacing_after": spacing.get("heading_spacing_after", 6),
        "paragraph_first_line_indent": spacing.get("paragraph_first_line_indent", 0),
        "paragraph_alignment": spacing.get("paragraph_alignment", "left"),
        "bullet_base_indent": spacing.get("bullet_base_indent", 0.25),
        "bullet_indent_per_level": spacing.get("bullet_indent_per_level", 0.45),
        "code_indent": spacing.get("code_indent", 0),
        "quote_indent": spacing.get("quote_indent", 0.5),
        "body_color": colors.get("body", "#17202a"),
        "code_background": code.get("background", colors.get("code_background", "#0f172a")),
        "code_text": code.get("text", colors.get("code_text", "#e2e8f0")),
        "table_header_text": colors.get("table_header_text", "#111827"),
        "table_odd_row": colors.get("table_odd_row", "#ffffff"),
        "table_even_row": colors.get("table_even_row", "#f8fafc"),
        "link_color": colors.get("link", "#2563eb"),
        "code_font_family": code.get("font_family", fonts.get("family_code", "JetBrains Mono")),
        "code_font_size": code.get("font_size", sizes.get("code", 10)),
        "h1_family": fonts.get("h1_family", fonts.get("family", "Times New Roman")),
        "h2_family": fonts.get("h2_family", fonts.get("family", "Times New Roman")),
        "h3_family": fonts.get("h3_family", fonts.get("family", "Times New Roman")),
        "h4_family": fonts.get("h4_family", fonts.get("family", "Times New Roman")),
        "h5_family": fonts.get("h5_family", fonts.get("family", "Times New Roman")),
        "h6_family": fonts.get("h6_family", fonts.get("family", "Times New Roman")),
        "bullet_font_family": fonts.get("bullet_family", fonts.get("family", "Times New Roman")),
        "header_alignment": header.get("alignment", "center"),
        "header_font_family": header.get("font_family", fonts.get("family", "Times New Roman")),
        "header_size": header.get("size", sizes.get("header", 10)),
        "header_color": header.get("color", colors.get("h1", "#1F3A5F")),
        "header_bold": header.get("bold", False),
        "header_italic": header.get("italic", False),
        "header_separator": header.get("separator", False),
        "header_separator_color": header.get("separator_color", "#CCCCCC"),
        "header_show_page_numbers": header.get("show_page_numbers", False),
        "footer_alignment": footer.get("alignment", "center"),
        "footer_font_family": footer.get("font_family", fonts.get("family", "Times New Roman")),
        "footer_size": footer.get("size", sizes.get("footer", 9)),
        "footer_color": footer.get("color", colors.get("h2", "#1F3A5F")),
        "footer_bold": footer.get("bold", False),
        "footer_italic": footer.get("italic", False),
        "footer_separator": footer.get("separator", False),
        "footer_separator_color": footer.get("separator_color", "#CCCCCC"),
        "footer_show_page_numbers": footer.get("show_page_numbers", True),
        "page_number_position": footer.get("page_number_position", header.get("page_number_position", "footer")),
        "page_number_alignment": footer.get("page_number_alignment", header.get("page_number_alignment", "center")),
        "page_number_style": footer.get("page_number_style", header.get("page_number_style", "arabic")),
        "page_number_format": footer.get("page_format", header.get("page_format", "Page X")),
        "page_number_mode": _infer_page_mode(footer.get("page_format") or header.get("page_format")),
        "page_size": page.get("size", "A4"),
        "page_orientation": page.get("orientation", "portrait"),
        "page_border_enabled": border.get("enabled", False),
        "page_border_width": border.get("width", 1),
        "page_border_color": border.get("color", "#000000"),
        "page_border_style": border.get("style", "single"),
        "page_border_offset": border.get("offset", 24),
        "table_text_alignment": table.get("text_alignment", "left"),
        "table_border_style": table.get("border_style", "single"),
        "ascii_background": table.get("ascii_background", colors.get("code_background", "#0f172a")),
        "ascii_text": table.get("ascii_text", colors.get("code_text", "#e2e8f0")),
        "ascii_font_family": code.get("font_family", fonts.get("family_code", "JetBrains Mono")),
    }
    custom_styles = _as_dict(theme.get("styles"))
    style_map.update(custom_styles)

    payload = {
        "name": str(theme.get("name") or theme_key),
        "primaryColor": str(colors.get("h1", "#1F3A5F")),
        "fontFamily": str(fonts.get("family", "Times New Roman")),
        "headingStyle": heading_data,
        "bodyStyle": {
            "size": _as_int(sizes.get("body"), 12),
            "lineHeight": _normalize_line_spacing(spacing.get("line_spacing"), default=1.5),
        },
        "tableStyle": {
            "borderWidth": _as_int(table.get("border_width"), 1),
            "borderColor": str(table.get("border_color", colors.get("table_border", "#d1d5db"))),
            "headerFill": str(table.get("header_fill", colors.get("table_header_bg", "#f3f4f6"))),
        },
        "margins": {
            "top": _margin_to_mm(margins.get("top"), 25.0),
            "bottom": _margin_to_mm(margins.get("bottom"), 25.0),
            "left": _margin_to_mm(margins.get("left"), 25.0),
            "right": _margin_to_mm(margins.get("right"), 25.0),
        },
        "styles": style_map,
    }
    return ThemePayload.model_validate(payload)


def _merge_theme_payload(base_theme: ThemePayload, request_theme: ThemePayload) -> ThemePayload:
    if not request_theme.model_fields_set:
        return base_theme
    request_dump = request_theme.model_dump(exclude_unset=True)
    if not request_dump:
        return base_theme
    if request_theme.model_dump() == DEFAULT_THEME_MODEL.model_dump():
        return base_theme
    merged = _deep_merge(base_theme.model_dump(), request_dump)
    return ThemePayload.model_validate(merged)


def _compose_security_payload(
    incoming: GenerateSecurityPayload,
    config: Mapping[str, Any],
    theme: Mapping[str, Any],
) -> GenerateSecurityPayload:
    cfg_header = _as_dict(config.get("header"))
    cfg_footer = _as_dict(config.get("footer"))
    cfg_watermark = _as_dict(config.get("watermark"))
    th_header = _as_dict(theme.get("header"))
    th_footer = _as_dict(theme.get("footer"))
    th_watermark = _as_dict(theme.get("watermark"))

    effective_header = _deep_merge(cfg_header, th_header)
    effective_footer = _deep_merge(cfg_footer, th_footer)
    effective_watermark = _deep_merge(cfg_watermark, th_watermark)

    header_text = incoming.headerText
    if header_text is None:
        header_text = str(effective_header.get("text") or "") if effective_header.get("enabled", True) else ""

    footer_text = incoming.footerText
    if footer_text is None:
        footer_text = str(effective_footer.get("text") or "") if effective_footer.get("enabled", True) else ""

    page_mode = incoming.pageNumberMode or _infer_page_mode(
        effective_footer.get("page_format") or effective_header.get("page_format")
    )
    if page_mode not in {"page_x", "page_x_of_y"}:
        page_mode = "page_x"

    watermark = incoming.watermark
    if watermark is None and effective_watermark.get("enabled"):
        wm_type = "image" if str(effective_watermark.get("type", "text")).lower() == "image" else "text"
        wm_value = str(
            effective_watermark.get("image_path")
            if wm_type == "image"
            else effective_watermark.get("text", "")
        ).strip()
        if wm_value:
            wm_position = str(effective_watermark.get("position", "center")).lower()
            watermark = WatermarkPayload(
                type=wm_type,
                value=wm_value,
                position="header" if wm_position in {"header", "top"} else "center",
                fontFamily=str(effective_watermark.get("font") or effective_watermark.get("font_family") or ""),
                size=_as_float(effective_watermark.get("size"), 48.0),
                color=str(effective_watermark.get("color") or ""),
                opacity=_as_float(effective_watermark.get("opacity"), 0.1),
                rotation=_as_float(effective_watermark.get("rotation"), 315.0),
                scale=_as_float(effective_watermark.get("scale"), 38.0),
            )

    return GenerateSecurityPayload(
        passwordProtectPdf=incoming.passwordProtectPdf,
        disableEditingDocx=incoming.disableEditingDocx,
        removeMetadata=incoming.removeMetadata,
        watermark=watermark,
        pageNumberMode=page_mode,
        headerText=header_text,
        footerText=footer_text,
    )


class AppState:
    def __init__(self) -> None:
        self.lock = RLock()
        self.config_path = CANONICAL_CONFIG_PATH
        self.themes_path = CANONICAL_THEMES_PATH
        self.prompt_path = PROMPT_PATH
        self.config = self._bootstrap_config()
        self.theme_catalog = self._bootstrap_themes()
        self._ensure_prompt_file()
        self.generated_filenames: Dict[str, str] = {}

        storage_backend = os.environ.get("STORAGE_BACKEND", "local")
        if storage_backend != "local":
            logger.warning("Only local storage backend is implemented. Falling back to local.")

        temp_dir = os.environ.get("DOCX_TEMP_DIR", str(Path.cwd() / ".notesforge_tmp"))
        self.store = FileStore(temp_dir)
        self.exporter = DocumentExporter(self.store)
        self.templates = TemplateRepo.build_default()

    def _bootstrap_config(self) -> Dict[str, Any]:
        if self.config_path.exists():
            raw = _read_json_dict(self.config_path)
            config = _normalize_config_payload(raw)
            _write_json(self.config_path, config)
            return config

        for legacy in LEGACY_CONFIG_PATHS:
            raw = _read_json_dict(legacy)
            if raw is None:
                continue
            config = _normalize_config_payload(raw)
            _write_json(self.config_path, config)
            logger.info("Migrated config data from %s -> %s", legacy.name, self.config_path.name)
            return config

        config = _default_config()
        _write_json(self.config_path, config)
        return config

    def _bootstrap_themes(self) -> Dict[str, Dict[str, Any]]:
        if self.themes_path.exists():
            raw = _read_json_dict(self.themes_path)
            normalized = _normalize_themes_payload(raw, self.config, builtin_default=False)
            theme_map = normalized["themes"]
            defaults = _default_themes(self.config)["themes"]
            for key, value in defaults.items():
                theme_map.setdefault(key, value)
        else:
            merged: Dict[str, Dict[str, Any]] = {}
            for legacy in LEGACY_THEME_PATHS:
                raw = _read_json_dict(legacy)
                if raw is None:
                    continue
                normalized = _normalize_themes_payload(raw, self.config, builtin_default=False)
                merged.update(normalized["themes"])
                logger.info("Imported theme data from %s", legacy.name)
            if not merged:
                merged = _default_themes(self.config)["themes"]
            else:
                defaults = _default_themes(self.config)["themes"]
                for key, value in defaults.items():
                    merged.setdefault(key, value)
            theme_map = merged

        if not theme_map:
            theme_map = _default_themes(self.config)["themes"]

        app_cfg = _as_dict(self.config.get("app"))
        current = str(app_cfg.get("theme") or "")
        if current not in theme_map:
            current = next(iter(theme_map.keys()))
            app_cfg["theme"] = current
            self.config["app"] = app_cfg
            _write_json(self.config_path, self.config)

        _write_json(self.themes_path, {"themes": theme_map})
        return theme_map

    def _ensure_prompt_file(self) -> None:
        if self.prompt_path.exists():
            return
        self.prompt_path.write_text(DEFAULT_PROMPT, encoding="utf-8")

    def save_config(self) -> None:
        _write_json(self.config_path, self.config)

    def save_themes(self) -> None:
        _write_json(self.themes_path, {"themes": self.theme_catalog})

    def current_theme_key(self) -> str:
        app_cfg = _as_dict(self.config.get("app"))
        key = str(app_cfg.get("theme") or "")
        if key not in self.theme_catalog:
            key = next(iter(self.theme_catalog.keys()))
            app_cfg["theme"] = key
            self.config["app"] = app_cfg
            self.save_config()
        return key

    def remember_file_name(self, file_id: str, filename: str) -> None:
        self.generated_filenames[file_id] = filename

    def filename_for(self, file_id: str) -> str | None:
        return self.generated_filenames.get(file_id)


def _build_theme_and_security(
    state: AppState,
    incoming_theme: ThemePayload,
    incoming_security: GenerateSecurityPayload,
) -> tuple[ThemePayload, GenerateSecurityPayload, str]:
    with state.lock:
        theme_key = state.current_theme_key()
        theme_record = state.theme_catalog.get(theme_key, {})
        base_theme = _theme_to_payload(theme_key, theme_record)
        merged_theme = _merge_theme_payload(base_theme, incoming_theme)
        merged_security = _compose_security_payload(incoming_security, state.config, theme_record)
        return merged_theme, merged_security, theme_key


def _classify_line(line: str) -> Dict[str, Any]:
    stripped = line.rstrip("\n")
    if not stripped.strip():
        return {"type": "empty", "content": "", "marker": None, "indent_level": 0}

    marker_match = MARKER_RE.match(line)
    if marker_match:
        marker = marker_match.group(1).upper()
        payload = marker_match.group(2).strip()
        marker_type_map = {
            "HEADING": "heading",
            "SUBHEADING": "heading",
            "SUB-SUBHEADING": "heading",
            "PARAGRAPH": "paragraph",
            "PARA": "paragraph",
            "CENTER": "paragraph",
            "RIGHT": "paragraph",
            "JUSTIFY": "paragraph",
            "TOC": "toc",
            "LIST_OF_TABLES": "list_of_tables",
            "LIST_OF_FIGURES": "list_of_figures",
            "COVER_PAGE": "section",
            "CERTIFICATE_PAGE": "section",
            "DECLARATION_PAGE": "section",
            "ACKNOWLEDGEMENT_PAGE": "section",
            "ABSTRACT_PAGE": "section",
            "CHAPTER": "chapter",
            "APPENDIX": "appendix",
            "REFERENCES": "references",
            "REFERENCE": "reference",
            "BULLET": "bullet",
            "NUMBERED": "numbered",
            "TABLE": "table",
            "TABLE_CAPTION": "table_caption",
            "FIGURE_CAPTION": "figure_caption",
            "FIGURE": "figure",
            "IMAGE": "image",
            "CODE": "code",
            "ASCII": "ascii",
            "PAGEBREAK": "pagebreak",
            "PAGE_BREAK": "pagebreak",
        }
        return {
            "type": marker_type_map.get(marker, marker.lower()),
            "content": payload,
            "marker": marker,
            "indent_level": len(line) - len(line.lstrip(" ")),
        }

    return {
        "type": "paragraph",
        "content": stripped.strip(),
        "marker": None,
        "indent_level": len(line) - len(line.lstrip(" ")),
    }


def create_app() -> FastAPI:
    app = FastAPI(title="NotesForge API", version=APP_VERSION)
    state = AppState()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=3600,
    )

    @app.middleware("http")
    async def content_length_guard(request: Request, call_next):
        content_len = request.headers.get("content-length")
        if content_len:
            try:
                parsed_size = int(content_len)
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid content-length header"})
            if parsed_size > MAX_BODY_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Request too large"})
        return await call_next(request)

    @app.get("/api/health")
    async def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/health")
    async def health_legacy() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/health/parser", response_model=ParserHealthResponse)
    async def parser_health() -> ParserHealthResponse:
        return ParserHealthResponse(parser="ok", version=APP_VERSION)

    @app.get("/health/parser", response_model=ParserHealthResponse)
    async def parser_health_legacy() -> ParserHealthResponse:
        return ParserHealthResponse(parser="ok", version=APP_VERSION)

    @app.get("/api/version")
    async def version() -> Dict[str, str]:
        return {"name": "NotesForge API", "version": APP_VERSION}

    @app.post("/api/analyze")
    async def analyze(req: AnalyzeRequest):
        content = (req.text or req.content or "").strip()
        if not content:
            raise HTTPException(status_code=422, detail="text is required")

        lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        classifications: List[Dict[str, Any]] = []
        stats: Dict[str, int] = {}
        for idx, line in enumerate(lines, start=1):
            classified = _classify_line(line)
            classified["line_number"] = idx
            classified["original"] = line
            stats[classified["type"]] = stats.get(classified["type"], 0) + 1
            classifications.append(classified)

        return {
            "success": True,
            "total_lines": len(lines),
            "statistics": stats,
            "classifications": classifications,
            "preview": classifications[:20],
        }

    @app.post("/api/preview", response_model=PreviewResponse)
    async def preview(req: PreviewRequest) -> PreviewResponse:
        parsed = parse_notesforge(req.content)
        merged_theme, merged_security, _ = _build_theme_and_security(
            state,
            req.theme,
            GenerateSecurityPayload(
                removeMetadata=req.security.removeMetadata,
                watermark=req.security.watermark,
                pageNumberMode=req.security.pageNumberMode,
                headerText=req.security.headerText,
                footerText=req.security.footerText,
            ),
        )
        formatting = FormattingOptions(
            margins=req.formattingOptions.margins,
            lineSpacing=_normalize_line_spacing(
                req.formattingOptions.lineSpacing or merged_theme.bodyStyle.lineHeight or 1.5,
                default=1.5,
            ),
        )
        preview_html = state.exporter.create_preview_html(
            nodes=parsed.nodes,
            theme=merged_theme,
            formatting=formatting,
            security=merged_security,
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
        target_format = req.format.lower()
        if target_format not in SUPPORTED_EXPORT_FORMATS:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {target_format}")

        parsed = parse_notesforge(req.content)
        merged_theme, merged_security, _ = _build_theme_and_security(state, req.theme, req.security)
        formatting = FormattingOptions(
            margins=merged_theme.margins,
            lineSpacing=_normalize_line_spacing(merged_theme.bodyStyle.lineHeight or 1.5, default=1.5),
        )

        try:
            export_result: ExportResult = state.exporter.create_export_file(
                target_format=target_format,
                nodes=parsed.nodes,
                theme=merged_theme,
                formatting=formatting,
                security=merged_security,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        if not export_result.output_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate output file")

        ext = export_result.actual_format
        filename_base = req.filename or "notesforge_output"
        filename = f"{filename_base}.{ext}"
        all_warnings = list(export_result.warnings)
        if export_result.warning and export_result.warning not in all_warnings:
            all_warnings.append(export_result.warning)

        with state.lock:
            state.remember_file_name(export_result.file_id, filename)

        return GenerateResponse(
            success=True,
            downloadUrl=f"/api/download/{export_result.file_id}",
            fileId=export_result.file_id,
            filename=filename,
            requestedFormat=export_result.requested_format,
            actualFormat=export_result.actual_format,
            warning=export_result.warning,
            warnings=all_warnings,
        )

    @app.get("/api/download/{file_id}")
    async def download(file_id: str):
        if not re.fullmatch(r"[0-9a-fA-F]{32}", file_id or ""):
            raise HTTPException(status_code=404, detail="File not found")

        path = state.store.resolve_path(file_id.lower())
        if not path:
            raise HTTPException(status_code=404, detail="File not found")

        ext = path.suffix.lower().lstrip(".")
        media_type = MEDIA_TYPES.get(ext, "application/octet-stream")
        filename = state.filename_for(file_id.lower()) or f"notesforge_output.{ext}"
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

    @app.get("/api/config")
    async def get_config():
        with state.lock:
            return {"success": True, "config": state.config}

    @app.post("/api/config/update")
    async def update_config(req: ConfigUpdateRequest):
        with state.lock:
            updated = _deep_merge({}, state.config)
            _set_by_path(updated, req.path, req.value)
            state.config = updated
            state.save_config()
            return {"success": True}

    @app.get("/api/themes")
    async def get_themes():
        with state.lock:
            return {
                "success": True,
                "themes": state.theme_catalog,
                "current_theme": state.current_theme_key(),
            }

    @app.post("/api/themes/apply")
    async def apply_theme(req: ThemeApplyRequest):
        key = _slugify_key(req.theme_name)
        with state.lock:
            theme = state.theme_catalog.get(key)
            if not theme:
                raise HTTPException(status_code=404, detail="Theme not found")
            state.config = _apply_theme_to_config(state.config, key, theme)
            state.save_config()
            return {"success": True, "config": state.config, "current_theme": key}

    @app.post("/api/themes/save")
    async def save_theme(req: ThemeSaveRequest):
        key = _slugify_key(req.key)
        with state.lock:
            source_cfg = req.config if req.config else state.config
            record = _theme_record_from_config(key, req.name, req.description, source_cfg)
            state.theme_catalog[key] = record
            state.save_themes()
            return {"success": True, "key": key}

    @app.post("/api/themes/delete")
    async def delete_theme(req: ThemeDeleteRequest):
        key = _slugify_key(req.key)
        with state.lock:
            if key not in state.theme_catalog:
                raise HTTPException(status_code=404, detail="Theme not found")
            if len(state.theme_catalog) <= 1:
                raise HTTPException(status_code=400, detail="At least one theme must remain")
            del state.theme_catalog[key]
            current = state.current_theme_key()
            if current == key:
                fallback = next(iter(state.theme_catalog.keys()))
                state.config = _apply_theme_to_config(state.config, fallback, state.theme_catalog[fallback])
            state.save_themes()
            state.save_config()
            return {"success": True, "themes": state.theme_catalog, "current_theme": state.current_theme_key()}

    @app.post("/api/themes", response_model=CreateThemeResponse, status_code=status.HTTP_201_CREATED)
    async def create_theme(req: CreateThemeRequest) -> CreateThemeResponse:
        key = _slugify_key(req.name)
        with state.lock:
            payload = {
                "name": req.name,
                "primaryColor": req.primaryColor,
                "fontFamily": req.fontFamily,
                "styles": req.styles,
            }
            state.theme_catalog[key] = _normalize_theme_record(key, payload, state.config, builtin_default=False)
            state.save_themes()
        return CreateThemeResponse(themeId=key)

    @app.get("/api/prompt")
    async def get_prompt():
        try:
            prompt = state.prompt_path.read_text(encoding="utf-8").strip()
        except OSError:
            prompt = DEFAULT_PROMPT
        return {"success": True, "prompt": prompt or DEFAULT_PROMPT}

    @app.post("/api/prompt")
    async def save_prompt(req: PromptUpdateRequest):
        state.prompt_path.write_text(req.prompt.strip(), encoding="utf-8")
        return {"success": True}

    return app


app = create_app()
