# Linux

`linux/` is the Linux desktop application area for NotesForge.

It contains distro-focused packaging, launch/build files, native desktop settings, music/assets, and Linux runtime notes.

## Build

```bash
./linux/build_linux.sh
```

## Output

The Linux packaging flow now produces a portable bundle, a tar archive, and an install script:

```text
linux/dist/NotesForge/NotesForge
linux/dist/NotesForge-linux.tar.gz
linux/dist/install_notesforge.sh
```

## Runtime Behavior

- The Linux build creates a self-contained desktop output in `linux/dist/NotesForge/NotesForge`.
- The install script can place the packaged app into a normal user or system app location without depending on the repo checkout path.
- The Linux app launches the bundled NotesForge product inside a native desktop window and does not need the repo at runtime.
- The desktop route shows the working directory, output directory, and detected Downloads path so users can see where files are read from and written to.
- User config, themes, prompt text, and cached outputs are stored under `~/.config/notesforge` unless `XDG_CONFIG_HOME` is set, with generated files staged in `~/.config/notesforge/outputs`.
- Platform music is sourced from `linux/music`.
- Remote conversion providers are disabled in the desktop runtime so the packaged app stays offline-first.

## Target Distros

The current build is tuned first for:

- Debian
- Ubuntu
- Kali
- Parrot

## PDF Expectations

- `PDF -> DOCX` should prefer `pdf2docx` locally on Linux.
- `DOCX -> PDF` should prefer the local converter chain first.
- If high-fidelity PDF support is not available at runtime, NotesForge hides PDF actions in the UI instead of leaving a broken option visible.

## Runtime Package Notes

If a minimal distro image still fails to start, install the common QtWebEngine runtime packages such as `libnss3`, `libnspr4`, `libxkbcommon-x11-0`, `libxcb-xinerama0`, `libxcb-keysyms1`, `libxcb-render-util0`, `libxcb-icccm4`, `libxcb-image0`, `libxcb-shape0`, `libxcb-xkb1`, and `libasound2`.

## Install

```bash
./linux/dist/install_notesforge.sh
```

## Related Docs

- Shared web/backend product: [`../webapp/README.md`](../webapp/README.md)
- Local containers: [`../docker-setup/README.md`](../docker-setup/README.md)
