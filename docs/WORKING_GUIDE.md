# Working Guide (v8.0.0)

## Step 1: Start the stack
1. Start backend (`uvicorn app.main:app --reload --port 10000`).
2. Start frontend (`npm run dev` in `frontend`).
3. Confirm backend status is online in the app header.

## Step 2: Write marker content
1. Use structure markers (`H1`-`H6`, `CHAPTER`, `APPENDIX`).
2. Use text markers (`PARAGRAPH`, `CENTER`, `JUSTIFY`, `QUOTE`, `TIP`, `WARNING`, `SUMMARY`).
3. Use list markers (`BULLET`, `NUMBERED`, `CHECKLIST`).
4. Use data/media markers (`TABLE`, `TABLE_CAPTION`, `IMAGE`, `FIGURE`, `FIGURE_CAPTION`, `CODE`, `EQUATION`, `ASCII`).

## Step 3: Use Marker Lab
1. Open Marker Lab from Shortcuts.
2. Search any marker and copy syntax snippets.
3. Use strict mode to catch unknown/invalid marker lines.

## Step 4: Theme and mode
1. Set document theme for output styling.
2. Set app UI theme + mode for workspace visuals only.
3. Verify preview/export style is unchanged when switching app mode.

## Step 5: Watermark and layout
1. Watermark is center-only for text/image.
2. Tune opacity, rotation, and scale from settings.
3. Use header/footer quick controls and page-number format helpers.

## Step 6: Export
1. Export sync (`POST /api/generate`) for normal documents.
2. Use async job flow (`POST /api/generate/async`) for large docs.
3. Poll `GET /api/generate/jobs/{jobId}` until `completed`.
4. Download via `GET /api/generate/jobs/{jobId}/download`.

## Step 7: PDF contract
- PDF requests always return PDF (`actualFormat=pdf`).
- Conversion path metadata:
  - `conversionEngine`
  - `externalFallbackUsed`
- Warnings indicate fallback engine used; response format still remains PDF.

## Troubleshooting
- `Unknown marker`: open Marker Lab and copy canonical syntax.
- `PDF warning`: converter fallback was used; install LibreOffice for closer DOCX fidelity.
- `Music not loading`: verify `frontend/public/music/manifest.json` and file paths.
- `YouTube link skipped`: use a direct media URL (`.mp3/.wav/.m4a/.mp4`) instead.

