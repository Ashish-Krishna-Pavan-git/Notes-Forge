# Marker Reference (v8-compatible)

## Core structure
- `H1` `H2` `H3` `H4` `H5` `H6`
- Aliases: `HEADING` -> `H1`, `SUBHEADING` -> `H2`, `SUB-SUBHEADING` -> `H3`

## Text blocks
- `PARAGRAPH`, `PARA`, `CENTER`, `RIGHT`, `JUSTIFY`
- `QUOTE`, `NOTE`, `IMPORTANT`
- v8 additions: `TIP`, `WARNING`, `INFO`, `SUCCESS`, `CALLOUT`, `SUMMARY`
- Compatibility: `LABEL`, `WATERMARK`

## Lists
- `BULLET`
- `NUMBERED`
- v8 additions: `CHECKLIST` (aliases: `TASK`, `TODO`)

Checklist payload examples:
- `CHECKLIST: [ ] Pending task`
- `CHECKLIST: [x] Completed task`

## Code and technical blocks
- `CODE`
- `ASCII` (alias: `DIAGRAM`)
- v8 addition: `EQUATION`

## Table and media
- `TABLE`
- `TABLE_CAPTION`
- `IMAGE`
- `FIGURE`
- `FIGURE_CAPTION`

Media payload:
- `IMAGE: source | caption | align | scale`
- `FIGURE: source | caption | align | scale`

Supported image source types:
- `https://...`
- local file paths
- `data:image/...;base64,...`

## Academic/document sections
- `TOC`
- `LIST_OF_TABLES`
- `LIST_OF_FIGURES`
- `COVER_PAGE`
- `CERTIFICATE_PAGE`
- `DECLARATION_PAGE`
- `ACKNOWLEDGEMENT_PAGE`
- `ABSTRACT_PAGE`
- `CHAPTER`
- `REFERENCES`
- `REFERENCE`
- `APPENDIX`

## Layout control
- `PAGEBREAK` (alias: `PAGE_BREAK`)
- v8 addition: `SEPARATOR` (aliases: `HR`, `HORIZONTAL_RULE`)

## Notes
- Existing marker documents remain backward compatible.
- Parser preserves indentation/tabs for list/code/multiline payloads.
- For authoritative list at runtime, use `GET /api/markers`.

