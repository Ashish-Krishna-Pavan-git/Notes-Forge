from __future__ import annotations

import ipaddress
import socket
from pathlib import Path
from typing import List, Tuple
from urllib.parse import urlparse

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


def _is_private_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _host_resolves_private(hostname: str) -> bool:
    try:
        records = socket.getaddrinfo(hostname, None)
    except OSError:
        return True
    for record in records:
        ip_addr = record[4][0]
        if _is_private_ip(ip_addr):
            return True
    return False


def validate_remote_media_url(raw_url: str, *, allow_private: bool = False) -> Tuple[bool, str]:
    value = (raw_url or "").strip()
    if not value:
        return False, "Empty URL"
    parsed = urlparse(value)
    if parsed.scheme.lower() not in {"http", "https"}:
        return False, "Only http/https URLs are allowed"
    if not parsed.hostname:
        return False, "URL hostname is missing"
    host = parsed.hostname.strip().lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return False, "Loopback hosts are not allowed"
    if parsed.username or parsed.password:
        return False, "Credentialed URLs are not allowed"
    if not allow_private and _host_resolves_private(host):
        return False, "Private or local network targets are not allowed"
    return True, ""


def mask_sensitive_url(raw_url: str) -> str:
    parsed = urlparse((raw_url or "").strip())
    if not parsed.scheme or not parsed.hostname:
        return "invalid-url"
    port = f":{parsed.port}" if parsed.port else ""
    return f"{parsed.scheme}://{parsed.hostname}{port}"
