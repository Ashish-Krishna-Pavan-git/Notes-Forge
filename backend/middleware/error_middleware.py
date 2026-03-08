from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def register_global_error_handler(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def _unhandled_error(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(exc)},
        )
