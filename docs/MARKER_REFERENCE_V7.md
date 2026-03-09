# Marker Reference v7

## Legacy Markers (Preserved)
`H1-H6`, `PARAGRAPH`, `PARA`, `CENTER`, `RIGHT`, `JUSTIFY`, `BULLET`, `NUMBERED`, `CODE`, `ASCII`, `TABLE`, `IMAGE`, `QUOTE`, `NOTE`, `IMPORTANT`, `TOC`, `LINK`, `HIGHLIGHT`, `FOOTNOTE`, `PAGEBREAK`.

## Additive v7 Markers
`COVER_PAGE`, `CERTIFICATE_PAGE`, `DECLARATION_PAGE`, `ACKNOWLEDGEMENT_PAGE`, `ABSTRACT_PAGE`, `LIST_OF_TABLES`, `LIST_OF_FIGURES`, `CHAPTER`, `REFERENCES`, `REFERENCE`, `APPENDIX`, `FIGURE`, `FIGURE_CAPTION`, `TABLE_CAPTION`.

## Figure/Image Payload
`IMAGE: source | caption | alignment | scale`
`FIGURE: source | caption | alignment | scale`

Supported source types:
- `https://...`
- `data:image/...;base64,...`

## Notes
- New markers are optional.
- Unmarked lines keep compatibility fallback behavior.
