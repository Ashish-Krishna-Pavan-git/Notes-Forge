from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_ROOT / "app"
CONFIG_FILE = BACKEND_ROOT / "config.json"
THEMES_FILE = BACKEND_ROOT / "themes.json"
PROMPT_FILE = BACKEND_ROOT / "prompt.txt"
