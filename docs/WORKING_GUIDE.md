# Working Guide (v7.0.0)

## Step 1: Setup
1. Run backend (`uvicorn app.main:app --reload --port 10000`).
2. Run frontend (`npm run dev` in `frontend`).
3. Open the app and check backend health indicator.

## Step 2: Write Markers
1. Use `H1:`/`H2:`/`PARAGRAPH:` for structure.
2. Use `BULLET:`/`NUMBERED:` for lists.
3. Use `TABLE:` for table rows.

## Step 3: Academic Structure
1. Add front matter markers (`COVER_PAGE:`, `ABSTRACT_PAGE:`).
2. Insert `TOC:`, `LIST_OF_TABLES:`, `LIST_OF_FIGURES:`.
3. Start chapters with `CHAPTER:`.

## Step 4: Figures/Tables
1. Add images using `IMAGE:` or `FIGURE:` (`source | caption | align | scale`).
2. Add `TABLE_CAPTION:` and `FIGURE_CAPTION:` when needed.
3. Keep references in `REFERENCES:` and `REFERENCE:` lines.

## Step 5: Theme + Template
1. Choose a template and theme.
2. Adjust fonts, spacing, page, header/footer, watermark.
3. Save settings.

## Step 6: Export + Troubleshoot
1. Export `DOCX`, `PDF`, `HTML`, `Markdown`, or `TXT`.
2. If PDF converter is unavailable, fallback contract returns DOCX with warning.
3. Use `/guide` page or Guide tab for onboarding.
