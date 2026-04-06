#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="$ROOT/webapp"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend"
MUSIC_SOURCE="$ROOT/linux/music"
MUSIC_TARGET="$FRONTEND/dist/music"
SPEC_FILE="$ROOT/linux/NotesForge.spec"
PACKAGE_DIR="$ROOT/linux/dist/NotesForge"
ARCHIVE_PATH="$ROOT/linux/dist/NotesForge-linux.tar.gz"
INSTALLER_COPY="$ROOT/linux/dist/install_notesforge.sh"
PYTHON_BIN="${PYTHON_BIN:-python3}"
export NOTESFORGE_REPO_ROOT="$ROOT"
if [ -n "${PIP_INSTALL_FLAGS:-}" ]; then
  # shellcheck disable=SC2206
  PIP_FLAGS=( ${PIP_INSTALL_FLAGS} )
else
  PIP_FLAGS=()
fi

cd "$FRONTEND"
if [ "${SKIP_FRONTEND_BUILD:-0}" != "1" ]; then
  npm run build
fi

"$PYTHON_BIN" "$BACKEND/scripts/validate_platform_music.py" linux
rm -rf "$MUSIC_TARGET"
mkdir -p "$MUSIC_TARGET"
cp -R "$MUSIC_SOURCE/." "$MUSIC_TARGET/"

"$PYTHON_BIN" -m pip install "${PIP_FLAGS[@]}" -r "$BACKEND/requirements.txt"
"$PYTHON_BIN" -m pip install "${PIP_FLAGS[@]}" -r "$ROOT/linux/requirements-desktop.txt"

"$PYTHON_BIN" -m PyInstaller \
  --noconfirm \
  --clean \
  --distpath "$ROOT/linux/dist" \
  --workpath "$ROOT/linux/build" \
  "$SPEC_FILE"

if [ ! -x "$PACKAGE_DIR/NotesForge" ]; then
  echo "Portable Linux bundle was not created." >&2
  exit 1
fi

rm -f "$ARCHIVE_PATH"
tar -czf "$ARCHIVE_PATH" -C "$PACKAGE_DIR" .
cp "$ROOT/linux/install_notesforge.sh" "$INSTALLER_COPY"
chmod +x "$INSTALLER_COPY"

echo
echo "Linux build complete:"
echo "  portable: linux/dist/NotesForge/NotesForge"
echo "  archive:  linux/dist/NotesForge-linux.tar.gz"
echo "  install:  linux/dist/install_notesforge.sh"
