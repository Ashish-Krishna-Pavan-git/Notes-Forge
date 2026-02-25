from __future__ import annotations

import os

import uvicorn

from app.main import app


if __name__ == "__main__":
    host = os.environ.get("FASTAPI_HOST", "0.0.0.0")
    port = int(os.environ.get("FASTAPI_PORT", "8000"))
    uvicorn.run("backend_server:app", host=host, port=port, reload=True)
