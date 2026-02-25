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
from docx.shared import Mm, Pt, RGBColor

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

        font_name = _font_primary(theme.fontFamily)
        normal_style = document.styles["Normal"]
        normal_style.font.name = font_name
        normal_style.font.size = Pt(theme.bodyStyle.size or 11)

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
                if p.runs:
                    token = getattr(theme.headingStyle, f"h{level}")
                    run = p.runs[0]
                    run.font.name = font_name
                    run.font.size = Pt(token.size or max(12, 26 - (level * 2)))
                    run.font.bold = str(token.weight or "600") in {"600", "700", "800", "900"}
                    run.font.color.rgb = _hex_to_rgb(token.color or theme.primaryColor)
            elif node.type == "paragraph":
                document.add_paragraph(node.text)
            elif node.type == "bullet":
                for item in node.items or []:
                    document.add_paragraph(item, style="List Bullet")
            elif node.type == "numbered":
                for item in node.items or []:
                    document.add_paragraph(item, style="List Number")
            elif node.type == "code":
                p = document.add_paragraph(node.text)
                for run in p.runs:
                    run.font.name = "Consolas"
                    run.font.size = Pt(10)
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
            ok, method = _convert_docx_to_pdf(docx_path, pdf_path)
            if not ok:
                warnings.append(f"PDF conversion failed: {method}")
                return docx_id, docx_path, warnings
            warnings.extend(secure_pdf(pdf_path, security.passwordProtectPdf, security.removeMetadata))
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
