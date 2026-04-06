from __future__ import annotations

import uvicorn

from app.main import app
from config.env_config import get_fastapi_host, get_fastapi_port


def run() -> None:
    uvicorn.run("app.main:app", host=get_fastapi_host(), port=get_fastapi_port(), reload=False)


if __name__ == "__main__":
    run()
