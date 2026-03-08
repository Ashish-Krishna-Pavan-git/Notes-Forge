from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def register_content_length_guard(app: FastAPI, max_body_bytes: int) -> None:
    @app.middleware("http")
    async def _content_length_guard(request: Request, call_next):
        content_len = request.headers.get("content-length")
        if content_len:
            try:
                parsed_size = int(content_len)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid content-length header"},
                )
            if parsed_size > max_body_bytes:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request too large"},
                )
        return await call_next(request)
