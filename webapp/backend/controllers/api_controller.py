"""
Compatibility controller module.

Canonical FastAPI app wiring remains in app.main.
"""

from app.main import app, create_app  # noqa: F401
