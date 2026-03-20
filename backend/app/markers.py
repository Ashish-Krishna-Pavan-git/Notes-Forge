from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Dict, Iterable, List, Tuple


@dataclass(frozen=True)
class MarkerSpec:
    key: str
    category: str
    syntax: str
    example: str
    description: str
    payload_rules: str
    aliases: Tuple[str, ...] = ()


MARKER_SPECS: Tuple[MarkerSpec, ...] = (
    MarkerSpec(
        key="H1",
        category="structure",
        syntax="H1: Title",
        example='H1: "Document Title"',
        description="Main heading.",
        payload_rules="Single line heading text.",
        aliases=("HEADING",),
    ),
    MarkerSpec(
        key="H2",
        category="structure",
        syntax="H2: Section",
        example='H2: "Section Name"',
        description="Section heading.",
        payload_rules="Single line heading text.",
        aliases=("SUBHEADING",),
    ),
    MarkerSpec(
        key="H3",
        category="structure",
        syntax="H3: Subsection",
        example='H3: "Subsection Name"',
        description="Subsection heading.",
        payload_rules="Single line heading text.",
        aliases=("SUB-SUBHEADING",),
    ),
    MarkerSpec(
        key="H4",
        category="structure",
        syntax="H4: Topic",
        example='H4: "Deep Topic"',
        description="Heading level 4.",
        payload_rules="Single line heading text.",
    ),
    MarkerSpec(
        key="H5",
        category="structure",
        syntax="H5: Topic",
        example='H5: "Fine Detail"',
        description="Heading level 5.",
        payload_rules="Single line heading text.",
    ),
    MarkerSpec(
        key="H6",
        category="structure",
        syntax="H6: Topic",
        example='H6: "Micro Topic"',
        description="Heading level 6.",
        payload_rules="Single line heading text.",
    ),
    MarkerSpec(
        key="PARAGRAPH",
        category="text",
        syntax="PARAGRAPH: Body text",
        example='PARAGRAPH: "First line"',
        description="Body paragraph, supports continuation lines.",
        payload_rules="Continuation lines are included until next marker.",
        aliases=("PARA",),
    ),
    MarkerSpec(
        key="CENTER",
        category="text",
        syntax="CENTER: Centered text",
        example='CENTER: "Centered line"',
        description="Centered paragraph.",
        payload_rules="Continuation lines are included until next marker.",
    ),
    MarkerSpec(
        key="RIGHT",
        category="text",
        syntax="RIGHT: Right aligned text",
        example='RIGHT: "Aligned right"',
        description="Right-aligned paragraph.",
        payload_rules="Continuation lines are included until next marker.",
    ),
    MarkerSpec(
        key="JUSTIFY",
        category="text",
        syntax="JUSTIFY: Justified paragraph",
        example='JUSTIFY: "Long paragraph..."',
        description="Justified paragraph.",
        payload_rules="Continuation lines are included until next marker.",
    ),
    MarkerSpec(
        key="QUOTE",
        category="text",
        syntax="QUOTE: Quoted content",
        example='QUOTE: "Important quote"',
        description="Quote block paragraph.",
        payload_rules="Continuation lines are included until next marker.",
    ),
    MarkerSpec(
        key="NOTE",
        category="text",
        syntax="NOTE: Note text",
        example='NOTE: "Important reminder"',
        description="Highlighted note paragraph.",
        payload_rules="Continuation lines are included until next marker.",
    ),
    MarkerSpec(
        key="IMPORTANT",
        category="text",
        syntax="IMPORTANT: Priority note",
        example='IMPORTANT: "Critical reminder"',
        description="High-importance note paragraph.",
        payload_rules="Continuation lines are included until next marker.",
    ),
    MarkerSpec(
        key="LINK",
        category="text",
        syntax="LINK: label | url",
        example='LINK: "Docs" | "https://example.com"',
        description="Link paragraph.",
        payload_rules="Use pipe-separated label and URL.",
    ),
    MarkerSpec(
        key="HIGHLIGHT",
        category="text",
        syntax="HIGHLIGHT: text | color",
        example='HIGHLIGHT: "Term" | "yellow"',
        description="Highlighted text paragraph.",
        payload_rules="Use pipe-separated text and optional color.",
    ),
    MarkerSpec(
        key="FOOTNOTE",
        category="text",
        syntax="FOOTNOTE: Reference note",
        example='FOOTNOTE: "[1] Primary source"',
        description="Footnote-style paragraph.",
        payload_rules="Single line reference note.",
    ),
    MarkerSpec(
        key="LABEL",
        category="text",
        syntax="LABEL: Label text",
        example='LABEL: "Figure Label"',
        description="Compatibility marker rendered as a paragraph label.",
        payload_rules="Single line text.",
    ),
    MarkerSpec(
        key="WATERMARK",
        category="text",
        syntax="WATERMARK: Text",
        example='WATERMARK: "CONFIDENTIAL"',
        description="Compatibility marker retained as normal paragraph text.",
        payload_rules="Single line text.",
    ),
    MarkerSpec(
        key="BULLET",
        category="list",
        syntax="BULLET: Item",
        example='BULLET: "  Nested item"',
        description="Bulleted list item.",
        payload_rules="Indentation determines nesting level.",
    ),
    MarkerSpec(
        key="NUMBERED",
        category="list",
        syntax="NUMBERED: Item",
        example='NUMBERED: "1. Step one"',
        description="Numbered list item.",
        payload_rules="Indentation determines nesting level; numeric prefix optional.",
    ),
    MarkerSpec(
        key="CODE",
        category="code",
        syntax="CODE: code line",
        example="CODE: print('hello')",
        description="Code block preserving spaces and tabs.",
        payload_rules="Continuation lines are preserved verbatim until next marker.",
    ),
    MarkerSpec(
        key="ASCII",
        category="code",
        syntax="ASCII: diagram line",
        example='ASCII: "+-----+"',
        description="ASCII diagram block.",
        payload_rules="Continuation lines are preserved verbatim until next marker.",
        aliases=("DIAGRAM",),
    ),
    MarkerSpec(
        key="TABLE",
        category="table",
        syntax="TABLE: col1 | col2 | col3",
        example='TABLE: "Name | Value | Notes"',
        description="Table row marker.",
        payload_rules="First row is header; subsequent TABLE lines are body rows.",
    ),
    MarkerSpec(
        key="TABLE_CAPTION",
        category="table",
        syntax="TABLE_CAPTION: Caption",
        example='TABLE_CAPTION: "Result summary"',
        description="Table caption marker.",
        payload_rules="Caption text only.",
    ),
    MarkerSpec(
        key="IMAGE",
        category="media",
        syntax="IMAGE: source | caption | align | scale",
        example='IMAGE: "https://example.com/a.png" | "Diagram" | "center" | "80"',
        description="Image marker.",
        payload_rules="Source supports URL, local path, or data URI.",
    ),
    MarkerSpec(
        key="FIGURE",
        category="media",
        syntax="FIGURE: source | caption | align | scale",
        example='FIGURE: "https://example.com/b.png" | "Architecture" | "center" | "70"',
        description="Figure marker with numbering.",
        payload_rules="Source supports URL, local path, or data URI.",
    ),
    MarkerSpec(
        key="FIGURE_CAPTION",
        category="media",
        syntax="FIGURE_CAPTION: Caption",
        example='FIGURE_CAPTION: "System diagram"',
        description="Figure caption marker.",
        payload_rules="Caption text only.",
    ),
    MarkerSpec(
        key="TOC",
        category="academic",
        syntax="TOC:",
        example="TOC:",
        description="Insert table of contents placeholder.",
        payload_rules="Optional title text.",
    ),
    MarkerSpec(
        key="LIST_OF_TABLES",
        category="academic",
        syntax="LIST_OF_TABLES:",
        example="LIST_OF_TABLES:",
        description="Insert list of tables placeholder.",
        payload_rules="Optional title text.",
    ),
    MarkerSpec(
        key="LIST_OF_FIGURES",
        category="academic",
        syntax="LIST_OF_FIGURES:",
        example="LIST_OF_FIGURES:",
        description="Insert list of figures placeholder.",
        payload_rules="Optional title text.",
    ),
    MarkerSpec(
        key="COVER_PAGE",
        category="academic",
        syntax="COVER_PAGE: Title",
        example='COVER_PAGE: "Project Report"',
        description="Cover page section heading.",
        payload_rules="Title text.",
    ),
    MarkerSpec(
        key="CERTIFICATE_PAGE",
        category="academic",
        syntax="CERTIFICATE_PAGE: Content",
        example='CERTIFICATE_PAGE: "Certified..."',
        description="Certificate section heading.",
        payload_rules="Title/content text.",
    ),
    MarkerSpec(
        key="DECLARATION_PAGE",
        category="academic",
        syntax="DECLARATION_PAGE: Content",
        example='DECLARATION_PAGE: "I declare..."',
        description="Declaration section heading.",
        payload_rules="Title/content text.",
    ),
    MarkerSpec(
        key="ACKNOWLEDGEMENT_PAGE",
        category="academic",
        syntax="ACKNOWLEDGEMENT_PAGE: Content",
        example='ACKNOWLEDGEMENT_PAGE: "Thanks..."',
        description="Acknowledgement section heading.",
        payload_rules="Title/content text.",
    ),
    MarkerSpec(
        key="ABSTRACT_PAGE",
        category="academic",
        syntax="ABSTRACT_PAGE: Content",
        example='ABSTRACT_PAGE: "This report..."',
        description="Abstract section heading.",
        payload_rules="Title/content text.",
    ),
    MarkerSpec(
        key="CHAPTER",
        category="academic",
        syntax="CHAPTER: Title",
        example='CHAPTER: "Methodology"',
        description="Chapter heading with chapter numbering support.",
        payload_rules="Title text.",
    ),
    MarkerSpec(
        key="REFERENCES",
        category="academic",
        syntax="REFERENCES:",
        example="REFERENCES:",
        description="References section heading.",
        payload_rules="Optional title text.",
    ),
    MarkerSpec(
        key="REFERENCE",
        category="academic",
        syntax="REFERENCE: Entry",
        example='REFERENCE: "[1] Journal citation"',
        description="Reference list item.",
        payload_rules="Single citation entry.",
    ),
    MarkerSpec(
        key="APPENDIX",
        category="academic",
        syntax="APPENDIX: Title",
        example='APPENDIX: "Supporting Data"',
        description="Appendix section heading.",
        payload_rules="Title text.",
    ),
    MarkerSpec(
        key="PAGEBREAK",
        category="layout",
        syntax="PAGEBREAK:",
        example="PAGEBREAK:",
        description="Manual page break marker.",
        payload_rules="No payload required.",
        aliases=("PAGE_BREAK",),
    ),
)


def _build_alias_map(specs: Iterable[MarkerSpec]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for spec in specs:
        mapping[spec.key.upper()] = spec.key
        for alias in spec.aliases:
            mapping[alias.upper()] = spec.key
    return mapping


MARKER_ALIAS_MAP: Dict[str, str] = _build_alias_map(MARKER_SPECS)
MARKER_NAMES: Tuple[str, ...] = tuple(sorted(MARKER_ALIAS_MAP.keys(), key=len, reverse=True))
MARKER_REGEX = re.compile(
    r"^\s*(" + "|".join(re.escape(name) for name in MARKER_NAMES) + r")\s*:(.*)$",
    re.IGNORECASE,
)


def normalize_marker(marker: str) -> str:
    if not marker:
        return ""
    return MARKER_ALIAS_MAP.get(marker.upper(), marker.upper())


def canonical_marker_keys() -> List[str]:
    return [spec.key for spec in MARKER_SPECS]


def marker_catalog_payload() -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for spec in MARKER_SPECS:
        payload.append(
            {
                "key": spec.key,
                "aliases": list(spec.aliases),
                "category": spec.category,
                "syntax": spec.syntax,
                "example": spec.example,
                "description": spec.description,
                "payloadRules": spec.payload_rules,
            }
        )
    return payload
