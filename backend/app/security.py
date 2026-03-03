from __future__ import annotations

from pathlib import Path
from typing import List

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def remove_docx_metadata(docx_path: Path) -> None:
    doc = Document(str(docx_path))
    props = doc.core_properties
    props.author = ""
    props.comments = ""
    props.category = ""
    props.title = ""
    props.subject = ""
    props.keywords = ""
    props.last_modified_by = ""
    props.language = ""
    doc.save(str(docx_path))


def disable_docx_editing(docx_path: Path) -> None:
    doc = Document(str(docx_path))
    settings = doc.settings.element
    existing = settings.find(qn("w:documentProtection"))
    if existing is not None:
        settings.remove(existing)

    protection = OxmlElement("w:documentProtection")
    protection.set(qn("w:edit"), "readOnly")
    protection.set(qn("w:enforcement"), "1")
    settings.append(protection)
    doc.save(str(docx_path))


def secure_pdf(pdf_path: Path, password: str | None, remove_metadata: bool) -> List[str]:
    warnings: List[str] = []
    if not password and not remove_metadata:
        return warnings

    try:
        from pypdf import PdfReader, PdfWriter
    except Exception as exc:  # pragma: no cover - runtime dependency missing
        warnings.append(f"PDF security skipped: {exc}")
        return warnings

    try:
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        if remove_metadata:
            writer.add_metadata({})

        if password:
            writer.encrypt(password)

        with open(pdf_path, "wb") as out_file:
            writer.write(out_file)
    except Exception as exc:  # pragma: no cover - best effort protection
        warnings.append(f"PDF security failed: {exc}")
    return warnings
