# Working Guide (v10.0.0)

## 1. Start the stack
1. Start backend: `uvicorn app.main:app --reload --port 10000` from `webapp/backend`
2. Start frontend: `npm run dev` in `webapp/frontend`
3. Confirm backend status shows online in the app header
4. Use `docker compose -f docker-setup/docker-compose.yml up --build` for the local Docker stack

## 2. Start with the simple marker set
1. Use `H1` to `H6` for headings
2. Use `BODY` for normal paragraph text
3. Use `BULLET` and `NUMBERED` for lists
4. Use `TABLE`, `CODE`, `DIAGRAM`, `IMAGE`, `FIGURE`, and `CAPTION` for structured content
5. Use `TOC`, `LOT`, and `LOF` near the top when you need contents/figure/table lists

## 3. Use continuation lines
1. Start a block once with `BODY:`, `CODE:`, or `DIAGRAM:`
2. Continue the following lines without repeating the marker
3. Keep indentation/tabs where they matter for code, lists, and diagrams

Example:

```text
BODY: This starts the paragraph.
This line is still part of the same BODY block.

CODE: print("hello")
for i in range(2):
    print(i)
```

## 4. Add images and captions
1. Use `IMAGE:` or `FIGURE:` with `source | caption | align | scale`
2. Add `CAPTION:` immediately after the related table/image/figure/diagram
3. Paste images from the clipboard or use local/remote image sources

Example:

```text
IMAGE: images/site-plan.png | Site plan | center | 80
CAPTION: Site plan overview
```

## 5. Style the page
1. Use Settings for theme, fonts, colours, spacing, and page borders
2. Configure header/footer alignment, page-number position, and page-number format from Page settings
3. Use Body / Text Colour when you want the full paragraph text colour changed
4. Use page border style, width, colour, offset, shadow, and inner frame for layout polish

## 6. Export
1. Use `POST /api/generate` for normal documents
2. Use `POST /api/generate/async` for large documents
3. DOCX is the main editable format
4. PDF always remains PDF even when a fallback renderer is used

## 7. PDF contract
- `requestedFormat = pdf` still returns `actualFormat = pdf`
- LibreOffice gives the closest local Word-like PDF conversion when available
- local browser runs, desktop apps, and Docker runs are offline-first and disable remote providers
- hosted Render deployments can still use configured external providers when needed

## 8. Webapp and desktop folders
1. `webapp/` is the shared app root and serves the frontend from FastAPI
2. `windows/` packages a native Windows app window
3. `linux/` packages a native Linux app window
4. `docker-setup/` runs the shared app stack locally in containers

## 9. Music loop setup
1. Add a track in `webapp/frontend/public/music/manifest.json`
2. Put one track in a mode such as `focus`
3. Enable music in Settings → Experience and press Play

Single-track loop example:

```json
{
  "focus": [
    {
      "title": "Kushi Theme (Loop)",
      "file": "Kushi Theme (Instrumental)_spotdown.org.mp3"
    }
  ]
}
```

## Troubleshooting
- `Unknown marker`: open Marker Lab and copy the canonical syntax
- `Caption not linked`: place `CAPTION:` directly after the related content
- `Nested bullets look wrong`: adjust `Spacing -> Tab Width`
- `Music not loading`: verify `webapp/frontend/public/music/manifest.json` and file paths
- `PDF warning`: fallback renderer was used, but the response is still a PDF
