from __future__ import annotations

import os


def get_fastapi_host() -> str:
    return os.environ.get("FASTAPI_HOST", "0.0.0.0")


def get_fastapi_port() -> int:
    raw = os.environ.get("PORT", os.environ.get("FASTAPI_PORT", "10000"))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 10000


def get_storage_backend() -> str:
    return os.environ.get("STORAGE_BACKEND", "local")


def get_temp_dir() -> str:
    return os.environ.get("DOCX_TEMP_DIR", ".notesforge_tmp")
