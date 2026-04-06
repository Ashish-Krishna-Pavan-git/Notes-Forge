#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT/linux/dist"
ARCHIVE_PATH_DEFAULT="$DIST_DIR/NotesForge-linux.tar.gz"
SOURCE_PATH="${1:-$ARCHIVE_PATH_DEFAULT}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer is intended for Linux only." >&2
  exit 1
fi

if [[ -n "${NOTESFORGE_INSTALL_ROOT:-}" ]]; then
  INSTALL_ROOT="$NOTESFORGE_INSTALL_ROOT"
elif [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  INSTALL_ROOT="/opt/NotesForge"
else
  INSTALL_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/NotesForge"
fi

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  BIN_DIR="/usr/local/bin"
  APPLICATIONS_DIR="/usr/share/applications"
else
  BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
  APPLICATIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ -d "$SOURCE_PATH" ]]; then
  cp -R "$SOURCE_PATH/." "$TMP_DIR/app/"
elif [[ -f "$SOURCE_PATH" ]]; then
  mkdir -p "$TMP_DIR/app"
  tar -xzf "$SOURCE_PATH" -C "$TMP_DIR/app"
else
  echo "NotesForge package not found. Build the Linux package first." >&2
  exit 1
fi

APP_DIR="$INSTALL_ROOT/app"
mkdir -p "$INSTALL_ROOT" "$BIN_DIR" "$APPLICATIONS_DIR"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -R "$TMP_DIR/app/." "$APP_DIR/"

cat > "$BIN_DIR/notesforge" <<EOF
#!/usr/bin/env bash
exec "$APP_DIR/NotesForge" "\$@"
EOF
chmod +x "$BIN_DIR/notesforge"

cat > "$APPLICATIONS_DIR/notesforge.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=NotesForge
Comment=NotesForge desktop document authoring app
Exec=$BIN_DIR/notesforge
Icon=notesforge
Terminal=false
Categories=Office;Utility;
EOF

chmod 644 "$APPLICATIONS_DIR/notesforge.desktop"

echo "NotesForge installed successfully."
echo "Run it with: notesforge"
