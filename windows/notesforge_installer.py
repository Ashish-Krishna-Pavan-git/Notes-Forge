from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import threading
import zipfile
from pathlib import Path
from tkinter import BooleanVar, StringVar, Tk, filedialog, messagebox, ttk


APP_NAME = "NotesForge"
PAYLOAD_NAME = "notesforge-windows-app.zip"
WEBVIEW2_BOOTSTRAPPER_NAME = "MicrosoftEdgeWebView2Setup.exe"


def _bundle_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parent


def _payload_path() -> Path:
    return _bundle_root() / "payload" / PAYLOAD_NAME


def _webview_bootstrapper() -> Path | None:
    candidate = _bundle_root() / "payload" / WEBVIEW2_BOOTSTRAPPER_NAME
    return candidate if candidate.exists() else None


def _default_install_dir() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    return base / "Programs" / APP_NAME


def _desktop_dir() -> Path:
    return Path(os.environ.get("USERPROFILE") or str(Path.home())) / "Desktop"


def _start_menu_dir() -> Path:
    appdata = Path(os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming"))
    return appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / APP_NAME


def _create_shortcut(shortcut_path: Path, target_path: Path, working_dir: Path) -> None:
    try:
        from win32com.client import Dispatch  # type: ignore
    except Exception:
        return

    shell = Dispatch("WScript.Shell")
    shortcut = shell.CreateShortcut(str(shortcut_path))
    shortcut.TargetPath = str(target_path)
    shortcut.WorkingDirectory = str(working_dir)
    shortcut.Description = f"{APP_NAME} desktop application"
    shortcut.IconLocation = str(target_path)
    shortcut.save()


def _write_launcher_files(install_dir: Path, exe_path: Path, desktop_shortcut: bool) -> None:
    start_menu_dir = _start_menu_dir()
    start_menu_dir.mkdir(parents=True, exist_ok=True)
    _create_shortcut(start_menu_dir / f"{APP_NAME}.lnk", exe_path, install_dir)

    if desktop_shortcut:
        desktop_dir = _desktop_dir()
        desktop_dir.mkdir(parents=True, exist_ok=True)
        _create_shortcut(desktop_dir / f"{APP_NAME}.lnk", exe_path, install_dir)


def _install_webview2() -> None:
    bootstrapper = _webview_bootstrapper()
    if not bootstrapper:
        return
    try:
        subprocess.run(
            [str(bootstrapper), "/silent", "/install"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=180,
        )
    except Exception:
        # Continue: many systems already have the runtime.
        return


def _extract_payload(destination: Path) -> Path:
    payload = _payload_path()
    if not payload.is_file():
        raise FileNotFoundError("The installer payload is missing.")

    staging_root = Path(tempfile.mkdtemp(prefix="notesforge-installer-"))
    staging_dir = staging_root / APP_NAME
    staging_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(payload, "r") as archive:
        archive.extractall(staging_dir)

    exe_path = staging_dir / "NotesForge.exe"
    if not exe_path.exists():
        raise FileNotFoundError("The packaged application could not be prepared.")

    backup_dir = destination.with_name(f"{destination.name}.backup")
    try:
        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
        if destination.exists():
            shutil.move(str(destination), str(backup_dir))

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(staging_dir), str(destination))

        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
    except Exception:
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
        if backup_dir.exists():
            shutil.move(str(backup_dir), str(destination))
        raise
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)

    return destination / "NotesForge.exe"


class InstallerApp:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title(f"{APP_NAME} Setup")
        self.root.geometry("560x360")
        self.root.minsize(520, 330)

        self.install_dir = StringVar(value=str(_default_install_dir()))
        self.desktop_shortcut = BooleanVar(value=True)
        self.launch_after_install = BooleanVar(value=True)
        self.status = StringVar(value="Ready to install.")

        self._install_button: ttk.Button | None = None
        self._cancel_button: ttk.Button | None = None
        self._progress: ttk.Progressbar | None = None

        self._build_ui()

    def _build_ui(self) -> None:
        frame = ttk.Frame(self.root, padding=22)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text=f"{APP_NAME} Setup", font=("Segoe UI", 20, "bold")).pack(anchor="w")
        ttk.Label(
            frame,
            text="Install the NotesForge desktop app with offline-first local processing and bundled web assets.",
            wraplength=500,
            justify="left",
        ).pack(anchor="w", pady=(8, 18))

        ttk.Label(frame, text="Install location").pack(anchor="w")
        path_row = ttk.Frame(frame)
        path_row.pack(fill="x", pady=(6, 16))
        ttk.Entry(path_row, textvariable=self.install_dir).pack(side="left", fill="x", expand=True)
        ttk.Button(path_row, text="Browse", command=self._browse_install_dir).pack(side="left", padx=(10, 0))

        options = ttk.Frame(frame)
        options.pack(fill="x", pady=(0, 18))
        ttk.Checkbutton(
            options,
            text="Create a desktop shortcut",
            variable=self.desktop_shortcut,
        ).pack(anchor="w")
        ttk.Checkbutton(
            options,
            text="Launch NotesForge after installation",
            variable=self.launch_after_install,
        ).pack(anchor="w", pady=(6, 0))

        self._progress = ttk.Progressbar(frame, mode="indeterminate")
        self._progress.pack(fill="x", pady=(0, 10))

        ttk.Label(frame, textvariable=self.status, wraplength=500, justify="left").pack(anchor="w", pady=(0, 18))

        actions = ttk.Frame(frame)
        actions.pack(fill="x")
        self._cancel_button = ttk.Button(actions, text="Cancel", command=self.root.destroy)
        self._cancel_button.pack(side="right")
        self._install_button = ttk.Button(actions, text="Install", command=self._start_install)
        self._install_button.pack(side="right", padx=(0, 10))

    def _browse_install_dir(self) -> None:
        selected = filedialog.askdirectory(
            title=f"Choose {APP_NAME} install location",
            initialdir=self.install_dir.get() or str(_default_install_dir().parent),
            mustexist=False,
        )
        if selected:
            self.install_dir.set(selected)

    def _set_busy(self, busy: bool) -> None:
        if self._install_button:
            self._install_button.configure(state="disabled" if busy else "normal")
        if self._cancel_button:
            self._cancel_button.configure(state="disabled" if busy else "normal")
        if self._progress:
            if busy:
                self._progress.start(12)
            else:
                self._progress.stop()

    def _start_install(self) -> None:
        destination = Path(self.install_dir.get()).expanduser()
        if not destination.name:
            messagebox.showerror(APP_NAME, "Choose a valid installation folder.")
            return

        self._set_busy(True)
        self.status.set("Preparing installation...")
        thread = threading.Thread(target=self._install_worker, args=(destination,), daemon=True)
        thread.start()

    def _install_worker(self, destination: Path) -> None:
        try:
            self.root.after(0, lambda: self.status.set("Checking desktop runtime..."))
            _install_webview2()

            self.root.after(0, lambda: self.status.set("Installing NotesForge files..."))
            exe_path = _extract_payload(destination)

            self.root.after(0, lambda: self.status.set("Creating shortcuts..."))
            _write_launcher_files(destination, exe_path, self.desktop_shortcut.get())

            if self.launch_after_install.get():
                subprocess.Popen([str(exe_path)], close_fds=True)

            self.root.after(0, self._install_success)
        except Exception:
            self.root.after(0, self._install_failure)

    def _install_success(self) -> None:
        self._set_busy(False)
        self.status.set("Installation complete.")
        messagebox.showinfo(APP_NAME, "NotesForge was installed successfully.")
        self.root.destroy()

    def _install_failure(self) -> None:
        self._set_busy(False)
        self.status.set("Installation failed.")
        messagebox.showerror(
            APP_NAME,
            "NotesForge could not be installed. Please run the installer again or rebuild the installer package.",
        )

    def run(self) -> int:
        self.root.mainloop()
        return 0


def main() -> int:
    return InstallerApp().run()


if __name__ == "__main__":
    raise SystemExit(main())
