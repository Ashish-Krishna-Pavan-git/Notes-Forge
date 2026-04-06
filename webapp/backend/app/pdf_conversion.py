from __future__ import annotations

import io
import importlib.util
import os
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Sequence, Tuple
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import UploadFile
from pypdf import PdfReader

from .exporter import (
    FileStore,
    _convert_docx_to_pdf,
    _convert_docx_to_pdf_ilovepdf_api,
    _convert_docx_to_pdf_ilovepdf_automation,
    _docx2pdf_supported,
    _find_libreoffice_binary,
)
from .file_access import SUPPORTED_PROCESSING_SUFFIXES, runtime_target
from .security import validate_remote_media_url


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MIME = "application/pdf"


@dataclass
class ProcessingConversionResult:
    file_id: str
    output_path: Path
    source_format: str
    requested_format: str
    actual_format: str
    conversion_engine: str
    provider_used: str
    output_filename: str
    warnings: List[str] = field(default_factory=list)
    external_fallback_used: bool = False


@dataclass(frozen=True)
class ConversionAttempt:
    provider: str
    external: bool
    runner: Callable[[Path, Path], Tuple[bool, str]]


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _processing_max_bytes() -> int:
    raw = os.environ.get("NF_PROCESSING_MAX_UPLOAD_BYTES", "104857600").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 104_857_600
    return max(5 * 1024 * 1024, min(500 * 1024 * 1024, value))


def _provider_preference(value: str | None) -> str:
    candidate = (value or "auto").strip().lower()
    if candidate in {"auto", "local", "smallpdf", "ilovepdf"}:
        return candidate
    return "auto"


def _hosted_runtime() -> bool:
    return runtime_target() in {"web", "render", "vercel", "serverless"}


def _remote_providers_allowed() -> bool:
    if _env_flag("NF_DISABLE_REMOTE_PROVIDERS", default=False):
        return False
    return _hosted_runtime()


def _is_module_available(module_name: str) -> bool:
    try:
        return importlib.util.find_spec(module_name) is not None
    except Exception:
        return False


def _smallpdf_configured() -> bool:
    return bool(
        (os.environ.get("NF_SMALLPDF_WORD_TO_PDF_URL") or "").strip()
        or (os.environ.get("NF_SMALLPDF_PDF_TO_WORD_URL") or "").strip()
    )


def _ilovepdf_remote_configured() -> bool:
    return bool(
        (os.environ.get("NF_ILOVEPDF_PUBLIC_KEY") or "").strip()
        or (os.environ.get("NF_ILOVEPDF_AUTOMATION_URL") or "").strip()
        or (os.environ.get("NF_ILOVEPDF_WORD_TO_PDF_URL") or "").strip()
        or (os.environ.get("NF_ILOVEPDF_PDF_TO_WORD_URL") or "").strip()
    )


def processing_docx_ready() -> bool:
    local_ready = _is_module_available("pdf2docx")
    if local_ready:
        return True
    if not _remote_providers_allowed():
        return False
    return _smallpdf_configured() or _ilovepdf_remote_configured()


def processing_pdf_ready() -> bool:
    local_ready = _docx2pdf_supported() or bool(_find_libreoffice_binary())
    if local_ready:
        return True
    if not _remote_providers_allowed():
        return False
    return _smallpdf_configured() or _ilovepdf_remote_configured()


def preferred_pdf_provider() -> str:
    if bool(_find_libreoffice_binary()) or _docx2pdf_supported():
        return "local"
    if _remote_providers_allowed():
        if _smallpdf_configured():
            return "smallpdf"
        if _ilovepdf_remote_configured():
            return "ilovepdf"
        return "unavailable"
    return "unavailable"


def pdf_status_note() -> str:
    if not processing_pdf_ready():
        if not _remote_providers_allowed():
            return "High-fidelity local PDF conversion is not configured for this offline-first runtime, so the PDF option is hidden."
        return "High-fidelity PDF conversion is not configured, so the PDF option is hidden."
    provider = preferred_pdf_provider()
    if provider == "local":
        return "PDF stays available because a local high-fidelity conversion path is configured."
    if provider == "smallpdf":
        return "PDF stays available through Smallpdf-backed high-fidelity conversion."
    if provider == "ilovepdf":
        return "PDF stays available through iLovePDF-backed high-fidelity conversion."
    return "PDF capability is available."


def _format_from_suffix(path: Path) -> str | None:
    return SUPPORTED_PROCESSING_SUFFIXES.get(path.suffix.lower())


def _safe_output_stem(value: str | None, fallback: str) -> str:
    candidate = Path(value or "").stem.strip()
    cleaned = re.sub(r"[^A-Za-z0-9 _-]+", "_", candidate).strip().replace(" ", "_")
    return cleaned[:120] or fallback


def _mime_for_format(file_format: str) -> str:
    if file_format == "pdf":
        return PDF_MIME
    return DOCX_MIME


def _validate_pdf(path: Path) -> None:
    try:
        reader = PdfReader(str(path))
        _ = len(reader.pages)
    except Exception as exc:
        raise ValueError(f"Invalid or corrupt PDF file: {exc}")


def _validate_docx(path: Path) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            members = set(archive.namelist())
    except Exception as exc:
        raise ValueError(f"Invalid or corrupt DOCX file: {exc}")
    required = {"[Content_Types].xml", "word/document.xml"}
    if not required.issubset(members):
        raise ValueError("Invalid DOCX file: required Word document parts are missing")


def _validate_input_file(path: Path, source_format: str) -> None:
    if source_format == "pdf":
        _validate_pdf(path)
        return
    if source_format == "docx":
        _validate_docx(path)
        return
    raise ValueError(f"Unsupported source format: {source_format}")


def _validate_output_file(path: Path, target_format: str) -> None:
    if target_format == "pdf":
        _validate_pdf(path)
        return
    if target_format == "docx":
        _validate_docx(path)
        return
    raise ValueError(f"Unsupported output format: {target_format}")


async def persist_uploaded_processing_file(upload: UploadFile, target_dir: Path) -> Path:
    filename = (upload.filename or "").strip()
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_PROCESSING_SUFFIXES:
        allowed = ", ".join(sorted(SUPPORTED_PROCESSING_SUFFIXES))
        raise ValueError(f"Unsupported file type. Use one of: {allowed}")

    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / f"{uuid4().hex}{suffix}"
    total = 0
    max_bytes = _processing_max_bytes()
    try:
        with path.open("wb") as stream:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError(f"Uploaded file exceeds the {max_bytes // (1024 * 1024)} MB limit")
                stream.write(chunk)
    finally:
        await upload.close()
    return path


def _encode_multipart_form(
    fields: dict[str, str],
    file_field: str,
    file_name: str,
    file_bytes: bytes,
    file_content_type: str,
) -> tuple[bytes, str]:
    boundary = f"----NotesForgeBoundary{uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{file_field}"; filename="{file_name}"\r\n'
                f"Content-Type: {file_content_type}\r\n\r\n"
            ).encode("utf-8"),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _auth_headers(prefix: str) -> dict[str, str]:
    token = (os.environ.get(f"{prefix}_AUTH_TOKEN") or "").strip()
    if not token:
        return {}
    header = (os.environ.get(f"{prefix}_AUTH_HEADER") or "Authorization").strip() or "Authorization"
    scheme = (os.environ.get(f"{prefix}_AUTH_SCHEME") or "Bearer").strip()
    value = token if not scheme or scheme.lower() == "none" else f"{scheme} {token}".strip()
    return {header: value}


def _extract_output_bytes(payload: bytes, expected_suffix: str) -> bytes:
    if not payload.startswith(b"PK"):
        return payload
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        matches = [name for name in archive.namelist() if name.lower().endswith(expected_suffix)]
        if not matches:
            raise ValueError(f"Archive response did not contain a {expected_suffix} file")
        return archive.read(matches[0])


def _remote_conversion(
    source_path: Path,
    output_path: Path,
    *,
    url: str,
    provider: str,
    source_format: str,
    target_format: str,
    auth_prefix: str,
    preserve_layout: bool,
) -> Tuple[bool, str]:
    ok, reason = validate_remote_media_url(
        url,
        allow_private=(os.environ.get("NF_ALLOW_PRIVATE_MEDIA_URLS") or "").strip().lower() in {"1", "true", "yes", "on"},
    )
    if not ok:
        return False, f"{provider} endpoint blocked: {reason}"

    try:
        body, content_type = _encode_multipart_form(
            {
                "source_format": source_format,
                "target_format": target_format,
                "preserve_layout": "true" if preserve_layout else "false",
            },
            "file",
            source_path.name,
            source_path.read_bytes(),
            _mime_for_format(source_format),
        )
        headers = {
            "Content-Type": content_type,
            "Accept": f"{_mime_for_format(target_format)},application/octet-stream,application/zip",
            "User-Agent": "notesforge/8.1",
        }
        headers.update(_auth_headers(auth_prefix))
        req = Request(url=url, data=body, method="POST", headers=headers)
        with urlopen(req, timeout=240) as response:  # nosec B310
            payload = response.read()
        if not payload:
            return False, f"{provider} returned an empty response"
        output_bytes = _extract_output_bytes(payload, f".{target_format}")
        output_path.write_bytes(output_bytes)
        _validate_output_file(output_path, target_format)
        return True, provider
    except Exception as exc:
        return False, f"{provider} failed: {exc}"


def _convert_pdf_to_docx_local(pdf_path: Path, docx_path: Path) -> Tuple[bool, str]:
    try:
        from pdf2docx import Converter  # type: ignore
    except Exception as exc:
        return False, f"pdf2docx unavailable: {exc}"

    converter = None
    try:
        converter = Converter(str(pdf_path))
        converter.convert(str(docx_path))
        converter.close()
        _validate_docx(docx_path)
        return True, "pdf2docx"
    except Exception as exc:
        if converter is not None:
            try:
                converter.close()
            except Exception:
                pass
        return False, f"pdf2docx failed: {exc}"


def _convert_docx_to_pdf_local(docx_path: Path, pdf_path: Path) -> Tuple[bool, str]:
    ok, detail = _convert_docx_to_pdf(docx_path, pdf_path)
    if ok:
        try:
            _validate_pdf(pdf_path)
        except Exception as exc:
            return False, f"local pdf validation failed: {exc}"
        return True, detail
    return False, detail


def _smallpdf_pdf_to_docx(pdf_path: Path, docx_path: Path, preserve_layout: bool) -> Tuple[bool, str]:
    url = (os.environ.get("NF_SMALLPDF_PDF_TO_WORD_URL") or "").strip()
    if not url:
        return False, "smallpdf endpoint not configured"
    return _remote_conversion(
        pdf_path,
        docx_path,
        url=url,
        provider="smallpdf_proxy",
        source_format="pdf",
        target_format="docx",
        auth_prefix="NF_SMALLPDF",
        preserve_layout=preserve_layout,
    )


def _smallpdf_docx_to_pdf(docx_path: Path, pdf_path: Path, preserve_layout: bool) -> Tuple[bool, str]:
    url = (os.environ.get("NF_SMALLPDF_WORD_TO_PDF_URL") or "").strip()
    if not url:
        return False, "smallpdf endpoint not configured"
    return _remote_conversion(
        docx_path,
        pdf_path,
        url=url,
        provider="smallpdf_proxy",
        source_format="docx",
        target_format="pdf",
        auth_prefix="NF_SMALLPDF",
        preserve_layout=preserve_layout,
    )


def _ilovepdf_pdf_to_docx_bridge(pdf_path: Path, docx_path: Path, preserve_layout: bool) -> Tuple[bool, str]:
    url = (os.environ.get("NF_ILOVEPDF_PDF_TO_WORD_URL") or "").strip()
    if not url:
        return False, "ilovepdf pdf-to-word bridge not configured"
    return _remote_conversion(
        pdf_path,
        docx_path,
        url=url,
        provider="ilovepdf_bridge",
        source_format="pdf",
        target_format="docx",
        auth_prefix="NF_ILOVEPDF_REMOTE",
        preserve_layout=preserve_layout,
    )


def _ilovepdf_docx_to_pdf_bridge(docx_path: Path, pdf_path: Path, preserve_layout: bool) -> Tuple[bool, str]:
    url = (os.environ.get("NF_ILOVEPDF_WORD_TO_PDF_URL") or "").strip()
    if not url:
        return False, "ilovepdf word-to-pdf bridge not configured"
    return _remote_conversion(
        docx_path,
        pdf_path,
        url=url,
        provider="ilovepdf_bridge",
        source_format="docx",
        target_format="pdf",
        auth_prefix="NF_ILOVEPDF_REMOTE",
        preserve_layout=preserve_layout,
    )


class PdfConversionService:
    def __init__(self, store: FileStore) -> None:
        self.store = store
        self.input_dir = store.base_dir / "processing_inputs"
        self.input_dir.mkdir(parents=True, exist_ok=True)

    def convert(
        self,
        source_path: Path,
        *,
        target_format: str,
        provider_preference: str = "auto",
        preserve_layout: bool = True,
        output_basename: str | None = None,
    ) -> ProcessingConversionResult:
        source_format = _format_from_suffix(source_path)
        requested_format = (target_format or "").strip().lower()
        provider = _provider_preference(provider_preference)

        if source_format not in {"pdf", "docx"}:
            raise ValueError("Only PDF and DOCX inputs are supported")
        if requested_format not in {"pdf", "docx"}:
            raise ValueError("Target format must be pdf or docx")
        if source_format == requested_format:
            raise ValueError("Source and target formats must be different")

        _validate_input_file(source_path, source_format)

        output_stem = _safe_output_stem(output_basename, source_path.stem)
        output_name = f"{output_stem}_converted.{requested_format}"
        file_id, output_path = self.store.reserve_path(requested_format)
        attempts = self._attempts(
            source_format=source_format,
            target_format=requested_format,
            provider_preference=provider,
            preserve_layout=preserve_layout,
        )
        errors: List[str] = []
        for attempt in attempts:
            try:
                output_path.unlink(missing_ok=True)
            except OSError:
                pass
            ok, detail = attempt.runner(source_path, output_path)
            if ok:
                warnings: List[str] = []
                if attempt.external:
                    warnings.append(
                        "External provider used for conversion. Keep API credentials on the server or a secure proxy only."
                    )
                return ProcessingConversionResult(
                    file_id=file_id,
                    output_path=output_path,
                    source_format=source_format,
                    requested_format=requested_format,
                    actual_format=requested_format,
                    conversion_engine=detail,
                    provider_used=attempt.provider,
                    output_filename=output_name,
                    warnings=warnings,
                    external_fallback_used=attempt.external,
                )
            errors.append(detail)

        joined = " | ".join(error for error in errors if error)
        raise RuntimeError(joined or "Conversion failed")

    def _attempts(
        self,
        *,
        source_format: str,
        target_format: str,
        provider_preference: str,
        preserve_layout: bool,
    ) -> Sequence[ConversionAttempt]:
        local_first = not _hosted_runtime()
        allow_remote = _remote_providers_allowed()

        if source_format == "pdf" and target_format == "docx":
            local = [
                ConversionAttempt("local", False, _convert_pdf_to_docx_local),
            ]
            remote = (
                [
                    ConversionAttempt(
                        "smallpdf",
                        True,
                        lambda src, dest: _smallpdf_pdf_to_docx(src, dest, preserve_layout),
                    ),
                    ConversionAttempt(
                        "ilovepdf",
                        True,
                        lambda src, dest: _ilovepdf_pdf_to_docx_bridge(src, dest, preserve_layout),
                    ),
                ]
                if allow_remote
                else []
            )
            return self._ordered_attempts(local, remote, provider_preference, local_first)

        local = [
            ConversionAttempt("local", False, _convert_docx_to_pdf_local),
        ]
        remote = (
            [
                ConversionAttempt(
                    "smallpdf",
                    True,
                    lambda src, dest: _smallpdf_docx_to_pdf(src, dest, preserve_layout),
                ),
                ConversionAttempt("ilovepdf", True, _convert_docx_to_pdf_ilovepdf_api),
                ConversionAttempt("ilovepdf", True, _convert_docx_to_pdf_ilovepdf_automation),
                ConversionAttempt(
                    "ilovepdf",
                    True,
                    lambda src, dest: _ilovepdf_docx_to_pdf_bridge(src, dest, preserve_layout),
                ),
            ]
            if allow_remote
            else []
        )
        return self._ordered_attempts(local, remote, provider_preference, local_first)

    def _ordered_attempts(
        self,
        local: Sequence[ConversionAttempt],
        remote: Sequence[ConversionAttempt],
        provider_preference: str,
        local_first: bool,
    ) -> Sequence[ConversionAttempt]:
        if provider_preference == "local":
            return [*local, *remote]
        if provider_preference == "smallpdf":
            preferred_remote = [item for item in remote if item.provider == "smallpdf"]
            other_remote = [item for item in remote if item.provider != "smallpdf"]
            return [*preferred_remote, *local, *other_remote]
        if provider_preference == "ilovepdf":
            preferred_remote = [item for item in remote if item.provider == "ilovepdf"]
            other_remote = [item for item in remote if item.provider != "ilovepdf"]
            return [*preferred_remote, *local, *other_remote]
        if local_first:
            return [*local, *remote]
        return [*remote, *local]
