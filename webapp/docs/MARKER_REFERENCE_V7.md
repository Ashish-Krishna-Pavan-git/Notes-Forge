# Marker Reference (v10 compatible)

This file keeps the historic filename, but the content reflects the `v10.0.0` marker set.

## Recommended starter markers

### Structure
- `H1` `H2` `H3` `H4` `H5` `H6`
- aliases: `HEADING -> H1`, `SUBHEADING -> H2`, `SUB-SUBHEADING -> H3`

### Body text
- `BODY`
- compatibility aliases: `PARAGRAPH`, `PARA`, `TEXT`
- aligned text: `CENTER`, `RIGHT`, `JUSTIFY`

### Lists
- `BULLET`
- `NUMBERED`
- `CHECKLIST`
- checklist aliases: `TASK`, `TODO`

### Technical/data blocks
- `CODE`
- `DIAGRAM`
- compatibility alias: `ASCII`
- `TABLE`
- `EQUATION`

### Media and captioning
- `IMAGE`
- `FIGURE`
- `CAPTION`
- compatibility markers: `TABLE_CAPTION`, `FIGURE_CAPTION`

Media payload:

```text
IMAGE: source | caption | align | scale
FIGURE: source | caption | align | scale
```

`CAPTION:` is context-aware:
- after `TABLE` -> table caption
- after `IMAGE`, `FIGURE`, or `DIAGRAM` -> figure caption

### Document helpers
- `TOC`
- `LOT`
- `LOF`
- compatibility markers: `LIST_OF_TABLES`, `LIST_OF_FIGURES`
- `REFERENCES`
- `REFERENCE`
- `APPENDIX`
- `PAGEBREAK`
- compatibility alias: `PAGE_BREAK`

## Academic and formal sections
- `COVER_PAGE`
- `CERTIFICATE_PAGE`
- `DECLARATION_PAGE`
- `ACKNOWLEDGEMENT_PAGE`
- `ABSTRACT_PAGE`
- `CHAPTER`

## Notes and callouts
- `NOTE`
- `IMPORTANT`
- `TIP`
- `WARNING`
- `INFO`
- `SUCCESS`
- `CALLOUT`
- `SUMMARY`
- `QUOTE`
- `HIGHLIGHT`
- `LINK`
- `FOOTNOTE`

## Layout helpers
- `SEPARATOR`
- aliases: `HR`, `HORIZONTAL_RULE`
- `LABEL`

## Continuation-line behavior

You do not need to repeat the marker on every line for block-style content. The parser keeps continuation lines for:
- `H1` to `H6`
- `BODY` and paragraph-style markers
- `CAPTION` and `REFERENCE`
- `CODE`
- `DIAGRAM` / `ASCII`
- list/table blocks where continuation lines still belong to the same block

Example:

```text
H1: Release Notes
Quarterly Update

BODY: This is the first line.
This is still part of the same BODY block.

CODE: print("hello")
for i in range(2):
    print(i)
```

## Numbering behavior

- `NUMBERED` is hierarchical and automatic in preview/export
- `TOC`, `LOT`, and `LOF` are generated from headings and captions
- figure/table numbering is derived from captions and chapter structure

## Supported image source types
- `https://...`
- local file paths
- `data:image/...;base64,...`

## Runtime source of truth

For the authoritative list at runtime, use:

```text
GET /api/markers
```
