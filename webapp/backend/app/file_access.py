from __future__ import annotations

import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

SUPPORTED_PROCESSING_SUFFIXES: Dict[str, str] = {
    ".pdf": "pdf",
    ".docx": "docx",
}


@dataclass(frozen=True)
class RecentProcessingFile:
    name: str
    format: str
    size_bytes: int
    modified_at: int
    directory_key: str


@dataclass(frozen=True)
class ProcessingDirectorySnapshot:
    key: str
    label: str
    path: str
    readable: bool
    auto_detected: bool
    recent_files: List[RecentProcessingFile]


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def runtime_target() -> str:
    raw = (os.environ.get("NF_RUNTIME_TARGET") or os.environ.get("NF_APP_RUNTIME") or "").strip().lower()
    return raw or "local"


def platform_name() -> str:
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform.startswith("linux"):
        return "linux"
    if sys.platform == "darwin":
        return "macos"
    return sys.platform.lower() or "unknown"


def _server_file_discovery_enabled() -> bool:
    target = runtime_target()
    default = target not in {"web", "serverless", "render", "vercel"}
    return _env_flag("NF_ENABLE_SERVER_FILE_DISCOVERY", default=default)


def _scan_limit() -> int:
    raw = os.environ.get("NF_FILE_DISCOVERY_MAX_FILES", "6").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 6
    return max(1, min(20, value))


class FileAccessService:
    def __init__(self) -> None:
        self._scan_limit = _scan_limit()

    def build_context(self) -> dict:
        from .pdf_conversion import (
            pdf_status_note,
            preferred_pdf_provider,
            processing_docx_ready,
            processing_pdf_ready,
        )

        directories = [self._directory_payload(snapshot) for snapshot in self._discover_directories()]
        home = Path.home()
        download_dir = home / "Downloads"
        output_dir = Path(os.environ.get("DOCX_TEMP_DIR") or tempfile.gettempdir()).resolve()
        notes = [
            "Use browser or desktop file pickers for manual selection from any location.",
            "Desktop and local runtimes can also scan common folders like Downloads and Documents.",
            "Sticky markers keep formatting active until the next marker, so multiline H1, H2, PARA, and CODE blocks stay predictable.",
            "NotesForge marker templates remain available after conversion for follow-up editing and export.",
        ]
        if not _server_file_discovery_enabled():
            notes[1] = "Server-side folder discovery is disabled for this runtime, so uploads and browser pickers are the primary file source."

        return {
            "runtimeTarget": runtime_target(),
            "platform": platform_name(),
            "currentWorkingDirectory": str(Path.cwd().resolve()),
            "downloadDirectory": str(download_dir.resolve()) if download_dir.exists() else None,
            "outputDirectory": str(output_dir),
            "serverFileDiscoveryEnabled": _server_file_discovery_enabled(),
            "browserUploadEnabled": True,
            "pdfConversionReady": processing_pdf_ready(),
            "docxConversionReady": processing_docx_ready(),
            "editorPdfExportReady": processing_pdf_ready(),
            "preferredPdfProvider": preferred_pdf_provider(),
            "pdfStatusNote": pdf_status_note(),
            "directories": directories,
            "markerTemplateExample": (
                "H1: Conversion Summary\n"
                "This heading continues until the next marker.\n"
                "H2: Source and output\n"
                "This subheading also stays active until the next marker.\n"
                "PARA: PDF uploaded from Downloads.\n"
                "Continue the same paragraph here without repeating PARA.\n"
                "CODE:\n"
                "\tpdf2docx --input incident-report.pdf --output incident-report.docx\n"
                "\tlibreoffice --headless --convert-to pdf incident-report.docx\n"
            ),
            "notes": notes,
        }

    def resolve_detected_file(self, directory_key: str, filename: str) -> Path | None:
        cleaned_name = (filename or "").strip()
        if not cleaned_name:
            return None
        # Only accept a plain filename from the client.
        if Path(cleaned_name).name != cleaned_name:
            return None
        for directory in self._discover_directories():
            if directory.key != directory_key or not directory.readable:
                continue
            base = Path(directory.path)
            candidate = self._safe_child_file(base, cleaned_name)
            if candidate is None:
                return None
            if candidate.suffix.lower() not in SUPPORTED_PROCESSING_SUFFIXES:
                return None
            if not candidate.exists() or not candidate.is_file():
                return None
            return candidate
        return None

    def _discover_directories(self) -> List[ProcessingDirectorySnapshot]:
        candidates = self._candidate_directories()
        seen: set[str] = set()
        results: List[ProcessingDirectorySnapshot] = []
        allow_scan = _server_file_discovery_enabled()
        for key, label, path in candidates:
            try:
                resolved = path.resolve()
            except OSError:
                continue
            resolved_str = str(resolved)
            if resolved_str in seen:
                continue
            seen.add(resolved_str)
            readable = resolved.exists() and resolved.is_dir()
            recent_files = self._recent_files(resolved, key) if readable and allow_scan else []
            results.append(
                ProcessingDirectorySnapshot(
                    key=key,
                    label=label,
                    path=resolved_str,
                    readable=readable,
                    auto_detected=True,
                    recent_files=recent_files,
                )
            )
        return results

    def _candidate_directories(self) -> List[tuple[str, str, Path]]:
        home = Path.home()
        temp_root = Path(os.environ.get("DOCX_TEMP_DIR") or tempfile.gettempdir())
        candidates: List[tuple[str, str, Path]] = [
            ("cwd", "Current Workspace", Path.cwd()),
            ("downloads", "Downloads", home / "Downloads"),
            ("documents", "Documents", home / "Documents"),
            ("desktop", "Desktop", home / "Desktop"),
            ("temp", "Runtime Temp", temp_root),
        ]
        extra_raw = os.environ.get("NF_EXTRA_DISCOVERY_DIRS", "").strip()
        if extra_raw:
            for index, item in enumerate(extra_raw.split(os.pathsep), start=1):
                value = item.strip()
                if not value:
                    continue
                candidates.append((f"extra_{index}", f"Configured Directory {index}", Path(value)))
        return candidates

    def _recent_files(self, base_dir: Path, directory_key: str) -> List[RecentProcessingFile]:
        entries: List[tuple[float, RecentProcessingFile]] = []
        try:
            for child in base_dir.iterdir():
                if not child.is_file():
                    continue
                suffix = child.suffix.lower()
                if suffix not in SUPPORTED_PROCESSING_SUFFIXES:
                    continue
                safe_child = self._safe_child_file(base_dir, child.name)
                if safe_child is None:
                    continue
                stat = safe_child.stat()
                payload = RecentProcessingFile(
                    name=safe_child.name,
                    format=SUPPORTED_PROCESSING_SUFFIXES[suffix],
                    size_bytes=int(stat.st_size),
                    modified_at=int(stat.st_mtime),
                    directory_key=directory_key,
                )
                entries.append((stat.st_mtime, payload))
        except OSError:
            return []
        entries.sort(key=lambda item: item[0], reverse=True)
        return [item[1] for item in entries[: self._scan_limit]]

    def _directory_payload(self, snapshot: ProcessingDirectorySnapshot) -> dict:
        return {
            "key": snapshot.key,
            "label": snapshot.label,
            "path": snapshot.path,
            "readable": snapshot.readable,
            "autoDetected": snapshot.auto_detected,
            "recentFiles": [
                {
                    "name": item.name,
                    "format": item.format,
                    "sizeBytes": item.size_bytes,
                    "modifiedAt": item.modified_at,
                    "directoryKey": item.directory_key,
                }
                for item in snapshot.recent_files
            ],
        }

    def _safe_child_file(self, base_dir: Path, filename: str) -> Path | None:
        try:
            resolved_base = base_dir.resolve()
            candidate = (resolved_base / filename).resolve()
        except OSError:
            return None
        if candidate == resolved_base or resolved_base not in candidate.parents:
            return None
        return candidate
