from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from html import escape
from typing import List, Sequence, Tuple
from uuid import uuid4

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Mm, Pt, RGBColor

from .models import FormattingOptions, GenerateSecurityPayload, ThemePayload
from .parser import Node, render_preview_html, to_markdown, to_plain_text
from .security import disable_docx_editing, remove_docx_metadata, secure_pdf
from .themes import css_from_theme, watermark_html


@dataclass
class ExportResult:
    file_id: str
    output_path: Path
    warnings: List[str]
    requested_format: str
    actual_format: str
    warning: str | None = None


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _allow_low_fidelity_pdf_fallback() -> bool:
    return _env_flag(
        "NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK",
        default=False,
    )


def _docx2pdf_supported() -> bool:
    return sys.platform in {"win32", "darwin"}


def _hex_to_rgb(value: str) -> RGBColor:
    cleaned = value.strip().lstrip("#")
    if len(cleaned) != 6:
        return RGBColor(31, 58, 95)
    try:
        return RGBColor(int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16))
    except ValueError:
        return RGBColor(31, 58, 95)


def _mm_or_default(value: float, default: float) -> Mm:
    return Mm(value if value >= 0 else default)


def _font_primary(font_family: str) -> str:
    return (font_family.split(",")[0] if font_family else "Calibri").strip()


def _docx_alignment(value: str) -> WD_ALIGN_PARAGRAPH:
    if value == "center":
        return WD_ALIGN_PARAGRAPH.CENTER
    if value == "right":
        return WD_ALIGN_PARAGRAPH.RIGHT
    if value == "justify":
        return WD_ALIGN_PARAGRAPH.JUSTIFY
    return WD_ALIGN_PARAGRAPH.LEFT


def _style_num(styles: dict[str, object], *keys: str, default: float) -> float:
    for key in keys:
        if key not in styles:
            continue
        raw = styles.get(key)
        try:
            return float(raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
    return default


def _style_bool(styles: dict[str, object], *keys: str, default: bool) -> bool:
    for key in keys:
        if key not in styles:
            continue
        raw = styles.get(key)
        if isinstance(raw, bool):
            return raw
        if isinstance(raw, (int, float)):
            return bool(raw)
        if isinstance(raw, str):
            v = raw.strip().lower()
            if v in {"1", "true", "yes", "on"}:
                return True
            if v in {"0", "false", "no", "off"}:
                return False
    return default


def _style_str(styles: dict[str, object], *keys: str, default: str) -> str:
    for key in keys:
        if key not in styles:
            continue
        raw = styles.get(key)
        if raw is None:
            continue
        return str(raw).strip()
    return default


def _field_instruction(field_name: str, number_style: str) -> str:
    style = (number_style or "arabic").strip().lower()
    suffix_map = {
        "arabic": "",
        "roman": r" \* ROMAN",
        "roman_lower": r" \* roman",
        "alpha": r" \* ALPHABETIC",
        "alpha_lower": r" \* alphabetic",
    }
    return f"{field_name}{suffix_map.get(style, '')}"


def _append_field(paragraph, field_name: str, number_style: str) -> None:
    run_begin = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    run_begin._r.append(fld_begin)

    run_instr = paragraph.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = _field_instruction(field_name, number_style)
    run_instr._r.append(instr)

    run_sep = paragraph.add_run()
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    run_sep._r.append(fld_sep)

    paragraph.add_run("1")

    run_end = paragraph.add_run()
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run_end._r.append(fld_end)


def _normalize_page_template(mode: str, template: str) -> str:
    raw = (template or "").strip()
    if not raw:
        return "Page X of Y" if mode == "page_x_of_y" else "Page X"
    lowered = raw.lower()
    if "{page}" in lowered:
        raw = re.sub(r"\{page\}", "X", raw, flags=re.IGNORECASE)
    if "{pages}" in lowered or "{total}" in lowered:
        raw = re.sub(r"\{pages\}", "Y", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\{total\}", "Y", raw, flags=re.IGNORECASE)
    if "x" not in raw.lower() and "y" not in raw.lower():
        return f"{raw} X"
    if mode == "page_x_of_y" and "y" not in raw.lower():
        if "x" in raw.lower():
            return f"{raw} of Y"
        return "Page X of Y"
    return raw


def _add_page_number(
    paragraph,
    mode: str,
    *,
    number_style: str = "arabic",
    format_template: str = "",
) -> None:
    template = _normalize_page_template(mode, format_template)
    parts = re.split(r"(X|Y)", template, flags=re.IGNORECASE)
    for part in parts:
        if not part:
            continue
        token = part.upper()
        if token == "X":
            _append_field(paragraph, "PAGE", number_style)
        elif token == "Y":
            _append_field(paragraph, "NUMPAGES", number_style)
        else:
            paragraph.add_run(part)


def _docx_border_style(raw: str) -> str:
    value = (raw or "").strip().lower()
    mapping = {
        "single": "single",
        "double": "double",
        "dashed": "dashed",
        "dotted": "dotted",
        "thick": "thick",
    }
    return mapping.get(value, "single")


def _apply_paragraph_separator(paragraph, side: str, color: str, width_pt: float, style: str) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)

    edge = p_bdr.find(qn(f"w:{side}"))
    if edge is None:
        edge = OxmlElement(f"w:{side}")
        p_bdr.append(edge)

    color_hex = (color or "").strip().lstrip("#")
    if len(color_hex) != 6:
        color_hex = "BFBFBF"
    sz = max(2, min(96, int(round(max(0.25, width_pt) * 8))))
    edge.set(qn("w:val"), _docx_border_style(style))
    edge.set(qn("w:sz"), str(sz))
    edge.set(qn("w:space"), "1")
    edge.set(qn("w:color"), color_hex)


def _apply_page_borders(
    section,
    *,
    enabled: bool,
    width_pt: float,
    color: str,
    style: str,
    offset_pt: float,
) -> None:
    if not enabled:
        return

    sect_pr = section._sectPr
    pg_borders = sect_pr.find(qn("w:pgBorders"))
    if pg_borders is None:
        pg_borders = OxmlElement("w:pgBorders")
        sect_pr.append(pg_borders)

    pg_borders.set(qn("w:offsetFrom"), "page")
    color_hex = (color or "").strip().lstrip("#")
    if len(color_hex) != 6:
        color_hex = "000000"
    sz = max(2, min(96, int(round(max(0.25, width_pt) * 8))))
    spacing = max(0, min(96, int(round(max(0.0, offset_pt)))))
    border_style = _docx_border_style(style)

    for side in ("top", "left", "bottom", "right"):
        edge = pg_borders.find(qn(f"w:{side}"))
        if edge is None:
            edge = OxmlElement(f"w:{side}")
            pg_borders.append(edge)
        edge.set(qn("w:val"), border_style)
        edge.set(qn("w:sz"), str(sz))
        edge.set(qn("w:space"), str(spacing))
        edge.set(qn("w:color"), color_hex)


def _set_cell_borders(cell, *, color: str, width_pt: float, style: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = tc_pr.find(qn("w:tcBorders"))
    if tc_borders is None:
        tc_borders = OxmlElement("w:tcBorders")
        tc_pr.append(tc_borders)

    color_hex = (color or "").strip().lstrip("#")
    if len(color_hex) != 6:
        color_hex = "D1D5DB"
    sz = max(2, min(96, int(round(max(0.25, width_pt) * 8))))
    border_style = _docx_border_style(style)
    for side in ("top", "left", "bottom", "right"):
        edge = tc_borders.find(qn(f"w:{side}"))
        if edge is None:
            edge = OxmlElement(f"w:{side}")
            tc_borders.append(edge)
        edge.set(qn("w:val"), border_style)
        edge.set(qn("w:sz"), str(sz))
        edge.set(qn("w:space"), "0")
        edge.set(qn("w:color"), color_hex)


def _set_cell_shading(cell, fill_hex: str) -> None:
    cleaned = (fill_hex or "").strip().lstrip("#")
    if len(cleaned) != 6:
        return
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cleaned)


def _set_paragraph_shading(paragraph, fill_hex: str) -> None:
    cleaned = (fill_hex or "").strip().lstrip("#")
    if len(cleaned) != 6:
        return
    p_pr = paragraph._p.get_or_add_pPr()
    shd = p_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        p_pr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cleaned)


def _style_paragraph_runs(
    paragraph,
    *,
    font_name: str,
    size_pt: float,
    color_hex: str,
    bold: bool | None = None,
    italic: bool | None = None,
) -> None:
    color = _hex_to_rgb(color_hex)
    for run in paragraph.runs:
        run.font.name = font_name
        run.font.size = Pt(max(1.0, size_pt))
        run.font.color.rgb = color
        if bold is not None:
            run.font.bold = bold
        if italic is not None:
            run.font.italic = italic


def _inject_preview_running_blocks(html: str, security: GenerateSecurityPayload) -> str:
    header_text = (security.headerText or "").strip()
    footer_text = (security.footerText or "").strip()
    show_page_number = security.pageNumberMode in {"page_x", "page_x_of_y"}
    mode = security.pageNumberMode if show_page_number else "page_x"

    injected = []
    if header_text:
        injected.append(f'<div class="nf-running-header">{escape(header_text)}</div>')

    footer_parts = []
    if footer_text:
        footer_parts.append(f'<span class="nf-footer-text">{escape(footer_text)}</span>')
    if show_page_number:
        footer_parts.append(f'<span class="nf-page-num" data-mode="{mode}"></span>')
    if footer_parts:
        injected.append(f'<div class="nf-running-footer">{" ".join(footer_parts)}</div>')

    if not injected:
        return html
    return html.replace(
        '<div class="nf-preview-root">',
        f'<div class="nf-preview-root">{"".join(injected)}',
        1,
    )


def _find_libreoffice_binary() -> str | None:
    for name in ("soffice", "libreoffice"):
        path = shutil.which(name)
        if path:
            return path

    if os.name != "nt":
        candidates = [
            Path("/usr/bin/soffice"),
            Path("/usr/local/bin/soffice"),
            Path("/usr/lib/libreoffice/program/soffice"),
            Path("/opt/libreoffice/program/soffice"),
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)

    if os.name == "nt":
        candidates = [
            Path(os.environ.get("ProgramFiles", "")) / "LibreOffice" / "program" / "soffice.exe",
            Path(os.environ.get("ProgramFiles(x86)", "")) / "LibreOffice" / "program" / "soffice.exe",
            Path("C:/Program Files/LibreOffice/program/soffice.exe"),
            Path("C:/Program Files (x86)/LibreOffice/program/soffice.exe"),
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
    return None


def _convert_docx_to_pdf(docx_path: Path, pdf_path: Path) -> Tuple[bool, str]:
    errors: List[str] = []

    if _docx2pdf_supported():
        try:
            from docx2pdf import convert as docx2pdf_convert  # type: ignore

            docx2pdf_convert(str(docx_path), str(pdf_path))
            if pdf_path.exists() and pdf_path.stat().st_size > 0:
                return True, "docx2pdf"
            errors.append("docx2pdf produced no file")
        except Exception as exc:
            errors.append(f"docx2pdf failed: {exc}")
    else:
        errors.append(f"docx2pdf skipped on {sys.platform}")

    binary = _find_libreoffice_binary()
    if binary:
        cmd = [
            binary,
            "--headless",
            "--convert-to",
            "pdf",
            str(docx_path),
            "--outdir",
            str(pdf_path.parent),
        ]
        try:
            result = subprocess.run(cmd, timeout=90, check=False, capture_output=True, text=True)
            produced = pdf_path.parent / f"{docx_path.stem}.pdf"
            if result.returncode == 0 and produced.exists() and produced.stat().st_size > 0:
                if produced != pdf_path:
                    produced.replace(pdf_path)
                return True, "libreoffice"
            errors.append(result.stderr.strip() or result.stdout.strip() or "libreoffice failed")
        except Exception as exc:
            errors.append(f"libreoffice exception: {exc}")
    else:
        errors.append("libreoffice binary not found")

    return False, "; ".join(err for err in errors if err)


def _convert_html_to_pdf_weasyprint(html: str, pdf_path: Path) -> Tuple[bool, str]:
    try:
        from weasyprint import HTML  # type: ignore

        HTML(string=html).write_pdf(str(pdf_path))
        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            return True, "weasyprint"
        return False, "weasyprint produced no file"
    except Exception as exc:
        return False, f"weasyprint failed: {exc}"


def _nodes_to_plain_lines(nodes: Sequence[Node]) -> list[str]:
    lines: list[str] = []
    for node in nodes:
        if node.type == "heading":
            lines.append(node.text.strip())
            lines.append("")
        elif node.type == "paragraph":
            lines.append(node.text.strip())
            lines.append("")
        elif node.type == "bullet":
            for item in node.items or []:
                lines.append(f"- {item}".strip())
            lines.append("")
        elif node.type == "numbered":
            for idx, item in enumerate(node.items or [], start=1):
                lines.append(f"{idx}. {item}".strip())
            lines.append("")
        elif node.type == "code":
            lines.append("CODE:")
            for ln in node.text.splitlines() or [""]:
                lines.append(f"  {ln}")
            lines.append("")
        elif node.type == "ascii":
            lines.append(node.text)
        elif node.type == "table":
            for row in node.rows or []:
                lines.append(" | ".join(row))
            lines.append("")
        elif node.type == "pagebreak":
            lines.append("__NF_PAGE_BREAK__")
    return lines or ["(empty document)"]


def _convert_nodes_to_pdf_reportlab(
    nodes: Sequence[Node],
    theme: ThemePayload,
    formatting: FormattingOptions,
    security: GenerateSecurityPayload,
    pdf_path: Path,
) -> Tuple[bool, str]:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except Exception as exc:
        return False, f"reportlab unavailable: {exc}"

    try:
        lines = _nodes_to_plain_lines(nodes)
        page_w, page_h = A4
        margin_top = (formatting.margins.top or 25) * mm
        margin_bottom = (formatting.margins.bottom or 25) * mm
        margin_left = (formatting.margins.left or 25) * mm
        margin_right = (formatting.margins.right or 25) * mm
        usable_h = max(60.0, page_h - margin_top - margin_bottom)

        font_size = float(theme.bodyStyle.size or 11)
        line_height = max(12.0, font_size * 1.55)
        max_lines = max(5, int(usable_h // line_height) - 2)

        pages: list[list[str]] = []
        cur: list[str] = []
        for ln in lines:
            if ln == "__NF_PAGE_BREAK__":
                pages.append(cur)
                cur = []
                continue
            cur.append(ln)
            if len(cur) >= max_lines:
                pages.append(cur)
                cur = []
        if cur or not pages:
            pages.append(cur)

        c = canvas.Canvas(str(pdf_path), pagesize=A4)
        c.setAuthor("NotesForge")
        c.setTitle("NotesForge Export")
        try:
            c.setSubject(theme.name or "NotesForge Document")
        except Exception:
            pass

        for p_idx, page_lines in enumerate(pages, start=1):
            y = page_h - margin_top
            if security.headerText:
                c.setFont("Helvetica-Bold", 10)
                c.drawString(margin_left, y, str(security.headerText))
                y -= line_height

            c.setFont("Helvetica", font_size)
            for ln in page_lines:
                text = (ln or "").replace("\t", "    ")
                max_chars = max(20, int((page_w - margin_left - margin_right) / (font_size * 0.55)))
                while len(text) > max_chars:
                    c.drawString(margin_left, y, text[:max_chars])
                    text = text[max_chars:]
                    y -= line_height
                    if y < margin_bottom + line_height:
                        break
                if y < margin_bottom + line_height:
                    break
                c.drawString(margin_left, y, text)
                y -= line_height

            footer_parts: list[str] = []
            if security.footerText:
                footer_parts.append(str(security.footerText))
            mode = security.pageNumberMode or "page_x"
            if mode == "page_x_of_y":
                footer_parts.append(f"Page {p_idx} of {len(pages)}")
            else:
                footer_parts.append(f"Page {p_idx}")
            c.setFont("Helvetica", 9)
            c.drawString(margin_left, margin_bottom * 0.55, " | ".join(footer_parts))
            c.showPage()

        c.save()
        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            return True, "reportlab"
        return False, "reportlab produced no file"
    except Exception as exc:
        return False, f"reportlab failed: {exc}"


class FileStore:
    def __init__(self, base_dir: str, ttl_seconds: int = 60 * 60 * 6) -> None:
        root = Path(base_dir) if base_dir else Path(tempfile.gettempdir()) / "notesforge_exports"
        root.mkdir(parents=True, exist_ok=True)
        self.base_dir = root
        self.ttl_seconds = ttl_seconds

    def cleanup(self) -> None:
        now = time.time()
        for file_path in self.base_dir.glob("*"):
            if not file_path.is_file():
                continue
            age = now - file_path.stat().st_mtime
            if age > self.ttl_seconds:
                try:
                    file_path.unlink()
                except OSError:
                    continue

    def reserve_path(self, ext: str) -> Tuple[str, Path]:
        file_id = uuid4().hex
        path = self.base_dir / f"{file_id}.{ext}"
        return file_id, path

    def resolve_path(self, file_id: str) -> Path | None:
        if not file_id or not all(ch in "0123456789abcdef" for ch in file_id.lower()):
            return None
        matches = list(self.base_dir.glob(f"{file_id}.*"))
        return matches[0] if matches else None


class DocumentExporter:
    def __init__(self, store: FileStore) -> None:
        self.store = store

    def create_preview_html(
        self,
        nodes: Sequence[Node],
        theme: ThemePayload,
        formatting: FormattingOptions,
        security: GenerateSecurityPayload,
        include_running_blocks: bool = True,
    ) -> str:
        css = css_from_theme(theme, formatting)
        watermark = watermark_html(security.watermark)
        html = render_preview_html(nodes, css, watermark)
        if include_running_blocks:
            return _inject_preview_running_blocks(html, security)
        return html

    def create_docx(
        self,
        nodes: Sequence[Node],
        theme: ThemePayload,
        formatting: FormattingOptions,
        security: GenerateSecurityPayload,
    ) -> Tuple[str, Path, List[str]]:
        self.store.cleanup()
        warnings: List[str] = []
        file_id, path = self.store.reserve_path("docx")

        document = Document()
        section = document.sections[0]
        styles = theme.styles if isinstance(theme.styles, dict) else {}

        page_size = _style_str(styles, "page_size", "pageSize", default="A4").upper()
        page_orientation = _style_str(
            styles,
            "page_orientation",
            "pageOrientation",
            default="portrait",
        ).lower()
        if page_size in {"A4", "A3", "LETTER", "LEGAL"}:
            page_sizes_mm = {
                "A4": (210.0, 297.0),
                "A3": (297.0, 420.0),
                "LETTER": (215.9, 279.4),
                "LEGAL": (215.9, 355.6),
            }
            w_mm, h_mm = page_sizes_mm[page_size]
            if page_orientation == "landscape":
                section.orientation = WD_ORIENT.LANDSCAPE
                section.page_width = Mm(h_mm)
                section.page_height = Mm(w_mm)
            else:
                section.orientation = WD_ORIENT.PORTRAIT
                section.page_width = Mm(w_mm)
                section.page_height = Mm(h_mm)

        section.top_margin = _mm_or_default(formatting.margins.top, 25)
        section.bottom_margin = _mm_or_default(formatting.margins.bottom, 25)
        section.left_margin = _mm_or_default(formatting.margins.left, 25)
        section.right_margin = _mm_or_default(formatting.margins.right, 25)

        font_name = _font_primary(theme.fontFamily)
        body_color = _style_str(styles, "body_color", "bodyColor", default="#17202a")
        code_font_name = _font_primary(
            _style_str(
                styles,
                "code_font_family",
                "codeFontFamily",
                default="Consolas, Courier New, monospace",
            )
        )
        bullet_font_name = _font_primary(
            _style_str(styles, "bullet_font_family", "bulletFontFamily", default=font_name)
        )
        code_font_size = _style_num(styles, "code_font_size", "codeFontSize", default=10.0)
        line_spacing = formatting.lineSpacing or theme.bodyStyle.lineHeight or 1.4

        normal_style = document.styles["Normal"]
        normal_style.font.name = font_name
        normal_style.font.size = Pt(theme.bodyStyle.size or 11)
        normal_style.font.color.rgb = _hex_to_rgb(body_color)
        normal_style.paragraph_format.line_spacing = line_spacing

        _apply_page_borders(
            section,
            enabled=_style_bool(styles, "page_border_enabled", "pageBorderEnabled", default=False),
            width_pt=_style_num(
                styles,
                "page_border_width",
                "pageBorderWidth",
                default=1.0,
            ),
            color=_style_str(
                styles,
                "page_border_color",
                "pageBorderColor",
                default=theme.primaryColor,
            ),
            style=_style_str(
                styles,
                "page_border_style",
                "pageBorderStyle",
                default="single",
            ),
            offset_pt=_style_num(
                styles,
                "page_border_offset",
                "pageBorderOffset",
                default=24.0,
            ),
        )

        header_para = section.header.paragraphs[0] if section.header.paragraphs else section.header.add_paragraph()
        footer_para = section.footer.paragraphs[0] if section.footer.paragraphs else section.footer.add_paragraph()
        header_para.text = (security.headerText or "").strip()
        footer_para.text = (security.footerText or "").strip()

        header_align = _style_str(styles, "header_alignment", "headerAlignment", default="center").lower()
        footer_align = _style_str(styles, "footer_alignment", "footerAlignment", default="center").lower()
        header_para.alignment = _docx_alignment(header_align)
        footer_para.alignment = _docx_alignment(footer_align)

        header_size = _style_num(styles, "header_size", "headerSize", default=10.0)
        footer_size = _style_num(styles, "footer_size", "footerSize", default=9.0)
        header_color = _style_str(styles, "header_color", "headerColor", default=theme.primaryColor)
        footer_color = _style_str(styles, "footer_color", "footerColor", default=theme.primaryColor)
        header_font = _font_primary(
            _style_str(styles, "header_font_family", "headerFontFamily", default=font_name)
        )
        footer_font = _font_primary(
            _style_str(styles, "footer_font_family", "footerFontFamily", default=font_name)
        )
        header_bold = _style_bool(styles, "header_bold", "headerBold", default=False)
        footer_bold = _style_bool(styles, "footer_bold", "footerBold", default=False)
        header_italic = _style_bool(styles, "header_italic", "headerItalic", default=False)
        footer_italic = _style_bool(styles, "footer_italic", "footerItalic", default=False)
        _style_paragraph_runs(
            header_para,
            font_name=header_font,
            size_pt=header_size,
            color_hex=header_color,
            bold=header_bold,
            italic=header_italic,
        )
        _style_paragraph_runs(
            footer_para,
            font_name=footer_font,
            size_pt=footer_size,
            color_hex=footer_color,
            bold=footer_bold,
            italic=footer_italic,
        )

        if _style_bool(styles, "header_separator", "headerSeparator", default=False):
            _apply_paragraph_separator(
                header_para,
                "bottom",
                _style_str(styles, "header_separator_color", "headerSeparatorColor", default="#CFCFCF"),
                0.75,
                "single",
            )
        if _style_bool(styles, "footer_separator", "footerSeparator", default=False):
            _apply_paragraph_separator(
                footer_para,
                "top",
                _style_str(styles, "footer_separator_color", "footerSeparatorColor", default="#CFCFCF"),
                0.75,
                "single",
            )

        page_mode = security.pageNumberMode or _style_str(
            styles,
            "page_number_mode",
            "pageNumberMode",
            default="page_x",
        )
        if page_mode not in {"page_x", "page_x_of_y"}:
            page_mode = "page_x"
        page_number_position = _style_str(
            styles,
            "page_number_position",
            "pageNumberPosition",
            default="footer",
        ).lower()
        if page_number_position not in {"header", "footer"}:
            page_number_position = "footer"
        show_header_page_numbers = _style_bool(
            styles,
            "header_show_page_numbers",
            "headerShowPageNumbers",
            default=False,
        )
        show_footer_page_numbers = _style_bool(
            styles,
            "footer_show_page_numbers",
            "footerShowPageNumbers",
            default=True,
        )
        page_number_alignment = _style_str(
            styles,
            "page_number_alignment",
            "pageNumberAlignment",
            default="",
        ).lower()
        if not page_number_alignment:
            page_number_alignment = (
                header_align if page_number_position == "header" else footer_align
            )
        page_number_style = _style_str(
            styles,
            "page_number_style",
            "pageNumberStyle",
            default="arabic",
        ).lower()
        if page_number_style not in {"arabic", "roman", "roman_lower", "alpha", "alpha_lower"}:
            page_number_style = "arabic"
        page_number_format = _style_str(
            styles,
            "page_number_format",
            "pageNumberFormat",
            default="Page X of Y" if page_mode == "page_x_of_y" else "Page X",
        )

        page_para = header_para if page_number_position == "header" else footer_para
        include_page_numbers = (
            show_header_page_numbers if page_number_position == "header" else show_footer_page_numbers
        )
        if include_page_numbers:
            if page_para.runs and page_para.runs[-1].text and not page_para.runs[-1].text.endswith(" "):
                page_para.add_run(" ")
            _add_page_number(
                page_para,
                page_mode,
                number_style=page_number_style,
                format_template=page_number_format,
            )
            page_para.alignment = _docx_alignment(page_number_alignment)
            is_header = page_number_position == "header"
            _style_paragraph_runs(
                page_para,
                font_name=header_font if is_header else footer_font,
                size_pt=header_size if is_header else footer_size,
                color_hex=header_color if is_header else footer_color,
                bold=header_bold if is_header else footer_bold,
                italic=header_italic if is_header else footer_italic,
            )

        paragraph_after_pt = _style_num(
            styles,
            "paragraph_spacing_after",
            "paragraphSpacingAfter",
            default=0.0,
        )
        paragraph_before_pt = _style_num(
            styles,
            "paragraph_spacing_before",
            "paragraphSpacingBefore",
            default=0.0,
        )
        heading_before_pt = _style_num(
            styles,
            "heading_spacing_before",
            "headingSpacingBefore",
            default=10.0,
        )
        heading_after_pt = _style_num(
            styles,
            "heading_spacing_after",
            "headingSpacingAfter",
            default=6.0,
        )
        paragraph_first_indent_em = _style_num(
            styles,
            "paragraph_first_line_indent",
            "paragraphFirstLineIndent",
            default=0.0,
        )
        bullet_base_indent_in = _style_num(
            styles,
            "bullet_base_indent",
            "bulletBaseIndent",
            default=0.25,
        )
        code_indent_in = _style_num(
            styles,
            "code_indent",
            "codeIndent",
            default=0.0,
        )
        paragraph_alignment = _style_str(
            styles,
            "paragraph_alignment",
            "paragraphAlignment",
            default="left",
        ).lower()
        table_text_alignment = _style_str(
            styles,
            "table_text_alignment",
            "tableTextAlignment",
            default="left",
        ).lower()
        table_border_width = float(theme.tableStyle.borderWidth or 1)
        table_border_color = theme.tableStyle.borderColor or "#d1d5db"
        table_border_style = _style_str(
            styles,
            "table_border_style",
            "tableBorderStyle",
            default="single",
        )
        table_header_fill = theme.tableStyle.headerFill or "#f3f4f6"
        table_header_text = _style_str(
            styles,
            "table_header_text",
            "tableHeaderText",
            default="#111827",
        )
        table_odd_fill = _style_str(
            styles,
            "table_odd_row",
            "tableOddRow",
            default="#FFFFFF",
        )
        table_even_fill = _style_str(
            styles,
            "table_even_row",
            "tableEvenRow",
            default="#F8FAFC",
        )

        if security.watermark and security.watermark.type == "text" and security.watermark.value:
            p = document.add_paragraph(security.watermark.value)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.runs[0]
            run.font.color.rgb = _hex_to_rgb(theme.primaryColor)
            run.font.size = Pt(28)
            run.font.bold = True
        elif security.watermark and security.watermark.type == "image" and security.watermark.value:
            image_path = Path(security.watermark.value)
            if image_path.exists():
                p = document.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.add_run().add_picture(str(image_path), width=Mm(80))
            else:
                warnings.append("Image watermark path not found; skipped watermark image.")

        for node in nodes:
            if node.type == "heading":
                level = max(1, min(6, node.level))
                p = document.add_heading(node.text, level=level)
                p.paragraph_format.space_before = Pt(max(0.0, heading_before_pt))
                p.paragraph_format.space_after = Pt(max(0.0, heading_after_pt))
                p.paragraph_format.line_spacing = line_spacing
                if p.runs:
                    token = getattr(theme.headingStyle, f"h{level}")
                    run = p.runs[0]
                    run.font.name = _font_primary(
                        _style_str(
                            styles,
                            f"h{level}_family",
                            f"h{level}Family",
                            default=font_name,
                        )
                    )
                    run.font.size = Pt(token.size or max(12, 26 - (level * 2)))
                    run.font.bold = str(token.weight or "600") in {"600", "700", "800", "900"}
                    run.font.color.rgb = _hex_to_rgb(token.color or theme.primaryColor)
            elif node.type == "paragraph":
                p = document.add_paragraph(node.text)
                effective_align = node.align if node.align and node.align != "left" else paragraph_alignment
                p.alignment = _docx_alignment(effective_align)
                p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
                p.paragraph_format.line_spacing = line_spacing
                p.paragraph_format.first_line_indent = Inches(max(0.0, paragraph_first_indent_em) * 0.15)
                _style_paragraph_runs(
                    p,
                    font_name=font_name,
                    size_pt=float(theme.bodyStyle.size or 11),
                    color_hex=body_color,
                )
            elif node.type == "bullet":
                for item in node.items or []:
                    p = document.add_paragraph(item, style="List Bullet")
                    p.alignment = _docx_alignment(paragraph_alignment)
                    p.paragraph_format.left_indent = Inches(max(0.0, bullet_base_indent_in))
                    p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                    p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
                    p.paragraph_format.line_spacing = line_spacing
                    _style_paragraph_runs(
                        p,
                        font_name=bullet_font_name,
                        size_pt=float(theme.bodyStyle.size or 11),
                        color_hex=body_color,
                    )
            elif node.type == "numbered":
                for item in node.items or []:
                    p = document.add_paragraph(item, style="List Number")
                    p.alignment = _docx_alignment(paragraph_alignment)
                    p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                    p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
                    p.paragraph_format.line_spacing = line_spacing
                    _style_paragraph_runs(
                        p,
                        font_name=bullet_font_name,
                        size_pt=float(theme.bodyStyle.size or 11),
                        color_hex=body_color,
                    )
            elif node.type == "code":
                p = document.add_paragraph(node.text)
                p.paragraph_format.left_indent = Inches(max(0.0, code_indent_in))
                p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
                p.paragraph_format.line_spacing = line_spacing
                _set_paragraph_shading(
                    p,
                    _style_str(styles, "code_background", "codeBackground", default="#0f172a"),
                )
                _style_paragraph_runs(
                    p,
                    font_name=code_font_name,
                    size_pt=code_font_size,
                    color_hex=_style_str(styles, "code_text", "codeText", default="#1f2937"),
                )
            elif node.type == "ascii":
                p = document.add_paragraph(node.text)
                p.paragraph_format.left_indent = Inches(0)
                p.paragraph_format.line_spacing = line_spacing
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                _set_paragraph_shading(
                    p,
                    _style_str(
                        styles,
                        "ascii_background",
                        "asciiBackground",
                        default=_style_str(styles, "code_background", "codeBackground", default="#0f172a"),
                    ),
                )
                _style_paragraph_runs(
                    p,
                    font_name=_font_primary(
                        _style_str(
                            styles,
                            "ascii_font_family",
                            "asciiFontFamily",
                            default=code_font_name,
                        )
                    ),
                    size_pt=max(8.0, code_font_size - 1.0),
                    color_hex=_style_str(
                        styles,
                        "ascii_text",
                        "asciiText",
                        default=_style_str(styles, "code_text", "codeText", default="#1f2937"),
                    ),
                )
            elif node.type == "table":
                rows = node.rows or []
                if not rows:
                    continue
                cols = len(rows[0])
                table = document.add_table(rows=len(rows), cols=cols)
                table.style = "Table Grid"
                for r_idx, row in enumerate(rows):
                    for c_idx in range(cols):
                        value = row[c_idx] if c_idx < len(row) else ""
                        cell = table.cell(r_idx, c_idx)
                        cell.text = value
                        _set_cell_borders(
                            cell,
                            color=table_border_color,
                            width_pt=table_border_width,
                            style=table_border_style,
                        )
                        if r_idx == 0:
                            _set_cell_shading(cell, table_header_fill)
                        elif r_idx % 2 == 1:
                            _set_cell_shading(cell, table_odd_fill)
                        else:
                            _set_cell_shading(cell, table_even_fill)
                        for para in cell.paragraphs:
                            para.alignment = _docx_alignment(table_text_alignment)
                            para.paragraph_format.line_spacing = line_spacing
                            _style_paragraph_runs(
                                para,
                                font_name=font_name,
                                size_pt=float(theme.bodyStyle.size or 11),
                                color_hex=table_header_text if r_idx == 0 else body_color,
                                bold=True if r_idx == 0 else None,
                            )
            elif node.type == "pagebreak":
                document.add_page_break()

        document.save(str(path))

        if security.removeMetadata:
            remove_docx_metadata(path)
        if security.disableEditingDocx:
            disable_docx_editing(path)

        return file_id, path, warnings

    def create_export_file(
        self,
        target_format: str,
        nodes: Sequence[Node],
        theme: ThemePayload,
        formatting: FormattingOptions,
        security: GenerateSecurityPayload,
    ) -> ExportResult:
        docx_id, docx_path, warnings = self.create_docx(nodes, theme, formatting, security)
        requested = target_format.lower()

        if requested == "docx":
            return ExportResult(
                file_id=docx_id,
                output_path=docx_path,
                warnings=warnings,
                requested_format="docx",
                actual_format="docx",
            )

        if requested == "pdf":
            file_id, pdf_path = self.store.reserve_path("pdf")
            attempts: list[str] = []
            allow_low_fidelity = _allow_low_fidelity_pdf_fallback()
            ok, method = _convert_docx_to_pdf(docx_path, pdf_path)
            attempts.append(method)
            if not ok and allow_low_fidelity:
                html_preview = self.create_preview_html(
                    nodes,
                    theme,
                    formatting,
                    security,
                    include_running_blocks=False,
                )
                ok, method = _convert_html_to_pdf_weasyprint(
                    html_preview,
                    pdf_path,
                )
                attempts.append(method)
            if not ok and allow_low_fidelity:
                ok, method = _convert_nodes_to_pdf_reportlab(
                    nodes,
                    theme,
                    formatting,
                    security,
                    pdf_path,
                )
                attempts.append(method)
            if ok:
                warnings.extend(secure_pdf(pdf_path, security.passwordProtectPdf, security.removeMetadata))
                if (
                    method in {"weasyprint", "reportlab"}
                    and _env_flag("NF_WARN_ON_FALLBACK_PDF", default=False)
                ):
                    warnings.append(
                        "PDF generated via fallback renderer; install LibreOffice for closer DOCX-to-PDF fidelity."
                    )
                return ExportResult(
                    file_id=file_id,
                    output_path=pdf_path,
                    warnings=warnings,
                    requested_format="pdf",
                    actual_format="pdf",
                )

            if pdf_path.exists():
                try:
                    pdf_path.unlink()
                except OSError:
                    pass

            fallback_warning = (
                "High-fidelity PDF conversion is unavailable on this host; returned DOCX instead. "
                f"Converter detail: {' | '.join(attempts)}. "
                "Install LibreOffice (or enable NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK=1 for fallback renderers)."
            )
            warnings.append(fallback_warning)
            if security.passwordProtectPdf:
                warnings.append("PDF password was skipped because no PDF was produced.")
            return ExportResult(
                file_id=docx_id,
                output_path=docx_path,
                warnings=warnings,
                requested_format="pdf",
                actual_format="docx",
                warning=fallback_warning,
            )

        if requested == "html":
            file_id, html_path = self.store.reserve_path("html")
            html = self.create_preview_html(nodes, theme, formatting, security)
            html_path.write_text(html, encoding="utf-8")
            return ExportResult(
                file_id=file_id,
                output_path=html_path,
                warnings=warnings,
                requested_format="html",
                actual_format="html",
            )

        if requested == "md":
            file_id, md_path = self.store.reserve_path("md")
            md_path.write_text(to_markdown(nodes), encoding="utf-8")
            return ExportResult(
                file_id=file_id,
                output_path=md_path,
                warnings=warnings,
                requested_format="md",
                actual_format="md",
            )

        file_id, txt_path = self.store.reserve_path("txt")
        txt_path.write_text(to_plain_text(nodes), encoding="utf-8")
        return ExportResult(
            file_id=file_id,
            output_path=txt_path,
            warnings=warnings,
            requested_format=requested,
            actual_format="txt",
        )
