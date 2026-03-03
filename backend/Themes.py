import logging
import json
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


class ThemeManager:
    """Manages theme loading, saving, and application."""

    def __init__(self, themes_path: Path):
        self.themes_path = themes_path
        self.themes: Dict[str, Any] = {}
        self.load_themes()

    def load_themes(self) -> None:
        """Load themes from Themes.json file."""
        try:
            if self.themes_path.exists():
                with self.themes_path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                themes = data.get("themes", {})
                self.themes = themes if isinstance(themes, dict) else {}
                logger.info("Loaded %d themes", len(self.themes))
            else:
                logger.warning("Themes file not found: %s", self.themes_path)
                self.themes = {}
        except Exception:
            logger.exception("Error loading themes")
            self.themes = {}

    def save_themes(self) -> None:
        """Save current themes to Themes.json file."""
        try:
            self.themes_path.parent.mkdir(parents=True, exist_ok=True)
            with self.themes_path.open("w", encoding="utf-8") as f:
                json.dump({"themes": self.themes}, f, indent=2, ensure_ascii=False)
            logger.info("Saved %d themes to %s", len(self.themes), self.themes_path)
        except Exception:
            logger.exception("Error saving themes")

    def get_theme(self, key: str) -> Dict[str, Any] | None:
        """Get a specific theme by key."""
        return self.themes.get(key)

    def set_theme(self, key: str, theme_data: Dict[str, Any]) -> None:
        """Set a theme and save."""
        self.themes[key] = theme_data
        self.save_themes()

    def delete_theme(self, key: str) -> bool:
        """Delete a theme."""
        if key in self.themes:
            del self.themes[key]
            self.save_themes()
            return True
        return False

    def list_themes(self) -> Dict[str, Any]:
        """Return all themes."""
        return self.themes.copy()
