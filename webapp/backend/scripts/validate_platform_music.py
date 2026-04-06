from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
WEB_MUSIC = ROOT / "webapp" / "frontend" / "public" / "music"
PLATFORM_DIRS = {
    "web": WEB_MUSIC,
    "windows": ROOT / "windows" / "music",
    "linux": ROOT / "linux" / "music",
}


def _load_manifest(manifest_path: Path) -> dict:
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{manifest_path} must contain a JSON object")
    return raw


def _validate_manifest(platform: str, folder: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = folder / "manifest.json"
    if not manifest_path.is_file():
        return [f"[{platform}] Missing manifest: {manifest_path}"]

    try:
        payload = _load_manifest(manifest_path)
    except Exception as exc:
        return [f"[{platform}] Invalid manifest JSON: {exc}"]

    for mode, tracks in payload.items():
        if not isinstance(tracks, list):
            errors.append(f"[{platform}] Mode '{mode}' must contain a list of tracks")
            continue
        for index, track in enumerate(tracks, start=1):
            if not isinstance(track, dict):
                errors.append(f"[{platform}] Track {mode}[{index}] must be an object")
                continue
            file_name = str(track.get("file") or "").strip()
            if file_name:
                media_path = folder / file_name
                if not media_path.is_file():
                    errors.append(f"[{platform}] Missing media file: {media_path}")
    return errors


def _compare_with_web(platform: str, folder: Path) -> list[str]:
    if platform == "web":
        return []
    errors: list[str] = []
    web_manifest = _load_manifest(WEB_MUSIC / "manifest.json")
    platform_manifest = _load_manifest(folder / "manifest.json")
    web_modes = set(web_manifest.keys())
    platform_modes = set(platform_manifest.keys())
    if web_modes != platform_modes:
        errors.append(
            f"[{platform}] Manifest modes differ from web bundle. expected={sorted(web_modes)} actual={sorted(platform_modes)}"
        )
    return errors


def main(argv: list[str]) -> int:
    targets = argv[1:] if len(argv) > 1 else ["web", "windows", "linux"]
    errors: list[str] = []
    for target in targets:
        folder = PLATFORM_DIRS.get(target)
        if folder is None:
            errors.append(f"Unknown target: {target}")
            continue
        errors.extend(_validate_manifest(target, folder))
        if folder.is_dir() and (folder / "manifest.json").is_file():
            errors.extend(_compare_with_web(target, folder))

    if errors:
        for error in errors:
            print(error)
        return 1

    print("Platform music manifests validated successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
