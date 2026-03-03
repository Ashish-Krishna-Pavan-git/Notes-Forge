from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from typing import List, Sequence, Tuple
from uuid import uuid4

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Mm, Pt, RGBColor

from .models import FormattingOptions, GenerateSecurityPayload, ThemePayload
from .parser import Node, render_preview_html, to_markdown, to_plain_text
from .security import disable_docx_editing, remove_docx_metadata, secure_pdf
from .themes import css_from_theme, watermark_html


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


def _add_page_number(paragraph, mode: str) -> None:
    paragraph.add_run("Page ")
    fld_page = OxmlElement("w:fldSimple")
    fld_page.set(qn("w:instr"), "PAGE")
    paragraph._p.append(fld_page)
    if mode == "page_x_of_y":
        paragraph.add_run(" of ")
        fld_total = OxmlElement("w:fldSimple")
        fld_total.set(qn("w:instr"), "NUMPAGES")
        paragraph._p.append(fld_total)


def _find_libreoffice_binary() -> str | None:
    for name in ("soffice", "libreoffice"):
        path = shutil.which(name)
        if path:
            return path

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

    try:
        from docx2pdf import convert as docx2pdf_convert  # type: ignore

        docx2pdf_convert(str(docx_path), str(pdf_path))
        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            return True, "docx2pdf"
        errors.append("docx2pdf produced no file")
    except Exception as exc:
        errors.append(f"docx2pdf failed: {exc}")

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
    ) -> str:
        css = css_from_theme(theme, formatting)
        watermark = watermark_html(security.watermark)
        return render_preview_html(nodes, css, watermark)

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
        section.top_margin = _mm_or_default(formatting.margins.top, 25)
        section.bottom_margin = _mm_or_default(formatting.margins.bottom, 25)
        section.left_margin = _mm_or_default(formatting.margins.left, 25)
        section.right_margin = _mm_or_default(formatting.margins.right, 25)

        if security.headerText:
            header_para = section.header.paragraphs[0] if section.header.paragraphs else section.header.add_paragraph()
            header_para.text = security.headerText
            header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        footer_para = section.footer.paragraphs[0] if section.footer.paragraphs else section.footer.add_paragraph()
        if security.footerText:
            footer_para.add_run(security.footerText + " ")
        page_mode = security.pageNumberMode or "page_x"
        _add_page_number(footer_para, page_mode)
        footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        font_name = _font_primary(theme.fontFamily)
        normal_style = document.styles["Normal"]
        normal_style.font.name = font_name
        normal_style.font.size = Pt(theme.bodyStyle.size or 11)
        normal_style.paragraph_format.line_spacing = formatting.lineSpacing or theme.bodyStyle.lineHeight or 1.4

        styles = theme.styles if isinstance(theme.styles, dict) else {}
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
                if p.runs:
                    token = getattr(theme.headingStyle, f"h{level}")
                    run = p.runs[0]
                    run.font.name = font_name
                    run.font.size = Pt(token.size or max(12, 26 - (level * 2)))
                    run.font.bold = str(token.weight or "600") in {"600", "700", "800", "900"}
                    run.font.color.rgb = _hex_to_rgb(token.color or theme.primaryColor)
            elif node.type == "paragraph":
                p = document.add_paragraph(node.text)
                p.alignment = _docx_alignment(node.align)
                p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
                p.paragraph_format.first_line_indent = Inches(max(0.0, paragraph_first_indent_em) * 0.15)
            elif node.type == "bullet":
                for item in node.items or []:
                    p = document.add_paragraph(item, style="List Bullet")
                    p.paragraph_format.left_indent = Inches(max(0.0, bullet_base_indent_in))
                    p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                    p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
            elif node.type == "numbered":
                for item in node.items or []:
                    p = document.add_paragraph(item, style="List Number")
                    p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                    p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
            elif node.type == "code":
                p = document.add_paragraph(node.text)
                p.paragraph_format.left_indent = Inches(max(0.0, code_indent_in))
                p.paragraph_format.space_before = Pt(max(0.0, paragraph_before_pt))
                p.paragraph_format.space_after = Pt(max(0.0, paragraph_after_pt))
                for run in p.runs:
                    run.font.name = "Consolas"
                    run.font.size = Pt(10)
            elif node.type == "ascii":
                p = document.add_paragraph(node.text)
                p.paragraph_format.left_indent = Inches(max(0.0, code_indent_in))
                for run in p.runs:
                    run.font.name = "Consolas"
                    run.font.size = Pt(9)
            elif node.type == "table":
                rows = node.rows or []
                if not rows:
                    continue
                cols = len(rows[0])
                table = document.add_table(rows=len(rows), cols=cols)
                for r_idx, row in enumerate(rows):
                    for c_idx in range(cols):
                        value = row[c_idx] if c_idx < len(row) else ""
                        cell = table.cell(r_idx, c_idx)
                        cell.text = value
                        if r_idx == 0 and cell.paragraphs and cell.paragraphs[0].runs:
                            cell.paragraphs[0].runs[0].font.bold = True
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
    ) -> Tuple[str, Path, List[str]]:
        docx_id, docx_path, warnings = self.create_docx(nodes, theme, formatting, security)

        if target_format == "docx":
            return docx_id, docx_path, warnings

        if target_format == "pdf":
            file_id, pdf_path = self.store.reserve_path("pdf")
            html_preview = self.create_preview_html(nodes, theme, formatting, security)
            attempts: list[str] = []
            ok, method = _convert_html_to_pdf_weasyprint(html_preview, pdf_path)
            attempts.append(method)
            if not ok:
                ok, method = _convert_docx_to_pdf(docx_path, pdf_path)
                attempts.append(method)
            if not ok:
                ok, method = _convert_nodes_to_pdf_reportlab(
                    nodes, theme, formatting, security, pdf_path
                )
                attempts.append(method)
            if not ok:
                raise RuntimeError(f"PDF conversion failed: {' | '.join(attempts)}")
            warnings.extend(secure_pdf(pdf_path, security.passwordProtectPdf, security.removeMetadata))
            if method == "reportlab":
                warnings.append("Used simplified PDF renderer fallback for this export.")
            return file_id, pdf_path, warnings

        if target_format == "html":
            file_id, html_path = self.store.reserve_path("html")
            html = self.create_preview_html(nodes, theme, formatting, security)
            html_path.write_text(html, encoding="utf-8")
            return file_id, html_path, warnings

        if target_format == "md":
            file_id, md_path = self.store.reserve_path("md")
            md_path.write_text(to_markdown(nodes), encoding="utf-8")
            return file_id, md_path, warnings

        file_id, txt_path = self.store.reserve_path("txt")
        txt_path.write_text(to_plain_text(nodes), encoding="utf-8")
        return file_id, txt_path, warnings
