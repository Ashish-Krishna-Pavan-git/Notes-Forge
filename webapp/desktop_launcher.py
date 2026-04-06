from __future__ import annotations

import os
import socket
import sys
import threading
import time
from pathlib import Path


APP_TITLE = "NotesForge"


def _bundle_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parent


def _desktop_route() -> str:
    if sys.platform.startswith("win"):
        return "/desktop/windows"
    if sys.platform.startswith("linux"):
        return "/desktop/linux"
    return "/desktop"


def _runtime_target() -> str:
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform.startswith("linux"):
        return "linux"
    return "desktop"


def _user_data_dir() -> Path:
    if sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming"))
        return base / APP_TITLE
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_TITLE
    base = Path(os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config"))
    return base / APP_TITLE.lower()


def _show_error(message: str) -> None:
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(APP_TITLE, message)
        root.destroy()
    except Exception:
        print(message, file=sys.stderr)


def _pick_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(host: str, port: int, timeout_seconds: float = 20.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def _configure_environment(root: Path) -> Path:
    candidates = [
        root / "frontend" / "dist",
        root / "webapp" / "frontend" / "dist",
    ]
    frontend_dist = next((candidate for candidate in candidates if (candidate / "index.html").is_file()), None)
    if frontend_dist is None:
        raise FileNotFoundError("Frontend bundle not found. Rebuild the desktop package and try again.")

    app_data_dir = _user_data_dir()
    output_dir = app_data_dir / "outputs"
    app_data_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    os.environ["NF_SERVE_FRONTEND"] = "1"
    os.environ["NF_FRONTEND_DIST"] = str(frontend_dist)
    os.environ["NF_APP_DATA_DIR"] = str(app_data_dir)
    os.environ["NF_RUNTIME_TARGET"] = _runtime_target()
    os.environ["NF_DISABLE_REMOTE_PROVIDERS"] = "1"
    os.environ.setdefault("DOCX_TEMP_DIR", str(output_dir))
    os.environ.setdefault("FASTAPI_HOST", "127.0.0.1")
    return frontend_dist


def main() -> int:
    root = _bundle_root()
    backend_candidates = [root / "backend", root / "webapp" / "backend"]
    backend_root = next((candidate for candidate in backend_candidates if candidate.is_dir()), root / "backend")
    if not backend_root.is_dir():
        _show_error("NotesForge could not locate its bundled backend files.")
        return 1

    try:
        frontend_dist = _configure_environment(root)
    except FileNotFoundError as exc:
        _show_error(str(exc))
        return 1

    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    try:
        import uvicorn
        import webview
        from app.main import create_app
    except Exception as exc:
        _show_error(
            "Desktop dependencies are missing. Install backend requirements plus the desktop requirements.\n\n"
            f"Details: {exc}"
        )
        return 1

    host = "127.0.0.1"
    port = _pick_port()
    app = create_app()
    config = uvicorn.Config(app=app, host=host, port=port, log_level="warning", access_log=False)
    server = uvicorn.Server(config)
    server.install_signal_handlers = lambda: None  # type: ignore[assignment]
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    if not _wait_for_server(host, port):
        server.should_exit = True
        _show_error("NotesForge could not start its local desktop service.")
        return 1

    url = f"http://{host}:{port}{_desktop_route()}"
    try:
        webview.create_window(
            APP_TITLE,
            url,
            width=1440,
            height=920,
            min_size=(1100, 760),
            confirm_close=True,
        )
        start_kwargs = {"gui": "qt"} if sys.platform.startswith("linux") else {"gui": "edgechromium"}
        try:
            webview.start(**start_kwargs)
        except Exception:
            webview.start()
    finally:
        server.should_exit = True
        thread.join(timeout=5.0)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
