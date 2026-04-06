from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_ROOT / "app"


def _first_existing_path(*names: str) -> Path:
    for name in names:
        candidate = BACKEND_ROOT / name
        if candidate.exists():
            return candidate
    return BACKEND_ROOT / names[0]


CONFIG_FILE = _first_existing_path("config.json", "Config.json")
THEMES_FILE = _first_existing_path("themes.json", "Themes.json", "theme_store.json")
PROMPT_FILE = _first_existing_path("prompt.txt")
