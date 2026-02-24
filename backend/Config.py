import logging
import json
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


class AppConfig:
    """Application configuration manager."""

    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.data: Dict[str, Any] = {}
        self.load()

    def load(self) -> None:
        """Load config from JSON file."""
        try:
            if self.config_path.exists():
                with self.config_path.open("r", encoding="utf-8") as f:
                    loaded = json.load(f)
                self.data = loaded if isinstance(loaded, dict) else self._get_default_config()
                logger.info("Loaded config from %s", self.config_path)
            else:
                self.data = self._get_default_config()
                self.save()
        except Exception:
            logger.exception("Error loading config")
            self.data = self._get_default_config()

    def save(self) -> None:
        """Save config to JSON file."""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with self.config_path.open("w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            logger.info("Saved config to %s", self.config_path)
        except Exception:
            logger.exception("Error saving config")

    def get(self, path: str, default: Any = None) -> Any:
        """Get config value by dot-notation path."""
        if not path:
            return default

        keys = path.split(".")
        val = self.data
        for key in keys:
            if isinstance(val, dict):
                val = val.get(key)
            else:
                return default
        return val if val is not None else default

    def set(self, path: str, value: Any) -> None:
        """Set config value by dot-notation path."""
        if not path:
            return

        keys = path.split(".")
        cfg = self.data
        for key in keys[:-1]:
            if key not in cfg or not isinstance(cfg.get(key), dict):
                cfg[key] = {}
            cfg = cfg[key]
        cfg[keys[-1]] = value
        self.save()

    def update(self, section: str, data: Dict[str, Any]) -> None:
        """Update a config section."""
        self.data[section] = data
        self.save()

    def to_dict(self) -> Dict[str, Any]:
        """Return config as dictionary."""
        return self.data.copy()

    def from_dict(self, data: Dict[str, Any]) -> None:
        """Load config from dictionary."""
        self.data = data if isinstance(data, dict) else {}
        self.save()

    @staticmethod
    def _get_default_config() -> Dict[str, Any]:
        """Return default configuration."""
        return {
            "fonts": {
                "family": "Calibri",
                "family_code": "Courier New",
                "sizes": {
                    "h1": 22,
                    "h2": 18,
                    "h3": 15,
                    "h4": 14,
                    "h5": 13,
                    "h6": 12,
                    "body": 12,
                    "code": 10
                }
            },
            "colors": {
                "h1": "#003366",
                "h2": "#004080",
                "h3": "#0052A3",
                "h4": "#1E5A96",
                "h5": "#333333",
                "h6": "#555555",
                "body": "#000000",
                "code_background": "#F5F5F5",
                "code_text": "#D32F2F",
                "table_header_bg": "#003366",
                "table_header_text": "#FFFFFF",
                "table_odd_row": "#E3F2FD",
                "table_even_row": "#FFFFFF",
                "table_border": "#90CAF9",
                "link": "#0563C1"
            },
            "spacing": {
                "line_spacing": 1.5,
                "paragraph_spacing_after": 6.0
            },
            "page": {
                "size": "A4",
                "orientation": "portrait",
                "margins": {
                    "top": 1.0,
                    "bottom": 1.0,
                    "left": 1.0,
                    "right": 1.0
                }
            },
            "header": {
                "enabled": True,
                "text": "NotesForge Document",
                "size": 10,
                "color": "#003366"
            },
            "footer": {
                "enabled": True,
                "text": "",
                "size": 10,
                "show_page_numbers": True
            }
        }
