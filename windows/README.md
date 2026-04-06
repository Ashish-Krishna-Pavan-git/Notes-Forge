# Windows

`windows/` is the Windows desktop application area for NotesForge.

It contains Windows-specific packaging, launch/build files, native desktop settings, music/assets, and the Windows runbook.

## Build

```powershell
./windows/build_windows.ps1
```

## Output

The Windows packaging flow now produces both a portable desktop bundle and an installer executable:

```text
windows/dist/NotesForge/NotesForge.exe
windows/dist/NotesForge-Setup.exe
```

## Runtime Behavior

- The Windows build creates a self-contained desktop output with `NotesForge.exe`.
- The Windows installer creates a normal installed app without requiring the user to run PowerShell after installation.
- The Windows app launches the bundled NotesForge product inside a native desktop window and does not need the repo at runtime.
- The desktop route shows the working directory, output directory, and detected Downloads path so users can see where files are read from and written to.
- User config, themes, prompt text, and cached outputs are stored under `%APPDATA%\\NotesForge`, with generated files staged in `%APPDATA%\\NotesForge\\outputs`.
- Platform music is sourced from `windows/music`.
- Remote conversion providers are disabled in the desktop runtime so the packaged app stays offline-first.
- The installer targets a normal per-user app location and can bundle the WebView2 runtime installer so the app does not depend on a pre-prepared desktop environment.

## PDF Expectations

- `PDF -> DOCX` should prefer `pdf2docx` locally on Windows.
- `DOCX -> PDF` should prefer the local converter chain first.
- If high-fidelity PDF support is not available at runtime, NotesForge hides PDF actions in the UI instead of leaving a broken option visible.

## Related Docs

- Shared web/backend product: [`../webapp/README.md`](../webapp/README.md)
- Local containers: [`../docker-setup/README.md`](../docker-setup/README.md)
