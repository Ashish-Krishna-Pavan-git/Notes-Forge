"""
Compatibility entrypoint.

Single source of truth for FastAPI app now lives in: app.main:app
"""

from app.main import app, create_app  # noqa: F401


if __name__ == "__main__":
    import os
    import uvicorn

    host = os.environ.get("FASTAPI_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("FASTAPI_PORT", "10000")))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
