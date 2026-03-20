from __future__ import annotations

from dataclasses import dataclass
from html import escape
import re
from typing import List, Sequence, Tuple

from .markers import MARKER_REGEX, normalize_marker


MARKER_RE = MARKER_REGEX


FRONT_MATTER_MARKERS = {
    "COVER_PAGE": "Cover Page",
    "CERTIFICATE_PAGE": "Certificate",
    "DECLARATION_PAGE": "Declaration",
    "ACKNOWLEDGEMENT_PAGE": "Acknowledgement",
    "ABSTRACT_PAGE": "Abstract",
}


@dataclass
class Node:
    type: str
    text: str = ""
    level: int = 0
    align: str = "left"
    items: List[str] | None = None
    rows: List[List[str]] | None = None
    role: str = "paragraph"
    levels: List[int] | None = None
    source: str = ""
    caption: str = ""
    scale: float = 100.0
    marker: str = ""


@dataclass
class StructureSummary:
    word_count: int
    heading_count: int
    reading_time_minutes: float


@dataclass
class ParseResult:
    nodes: List[Node]
    warnings: List[str]
    summary: StructureSummary


@dataclass
class _CaptionState:
    chapter_idx: int = 0
    figure_global: int = 0
    table_global: int = 0
    figure_chapter: int = 0
    table_chapter: int = 0


@dataclass
class ParseOptions:
    tab_width: int = 4
    list_indent_unit: int = 2


def _is_marker_line(line: str) -> bool:
    return bool(MARKER_RE.match(line))


def _split_table_row(row: str) -> List[str]:
    cleaned = row.strip().strip("|")
    return [col.strip() for col in cleaned.split("|")] if cleaned else []


def _effective_tab_width(tab_width: int) -> int:
    return max(1, min(12, int(tab_width or 4)))


def _list_level(raw: str, *, tab_width: int = 4, unit: int = 2) -> int:
    expanded = raw.replace("\t", " " * _effective_tab_width(tab_width))
    spaces = len(expanded) - len(expanded.lstrip(" "))
    return max(0, spaces // max(1, unit))


def _parse_list_item(raw: str, numbered: bool, *, options: ParseOptions) -> tuple[str, int]:
    level = _list_level(raw, tab_width=options.tab_width, unit=options.list_indent_unit)
    stripped = raw.lstrip()
    if numbered:
        stripped = re.sub(r"^\d+[.)]\s*", "", stripped)
    else:
        stripped = re.sub(r"^[-*]\s*", "", stripped)
    return stripped.rstrip(), level


def _payload_text(payload_raw: str) -> str:
    # Keep user indentation intent while dropping a single delimiter space after ":".
    if payload_raw.startswith(" "):
        return payload_raw[1:]
    return payload_raw


def _strip_wrapping_quotes(value: str) -> str:
    text = value.strip()
    if len(text) >= 2 and ((text[0] == '"' and text[-1] == '"') or (text[0] == "'" and text[-1] == "'")):
        return text[1:-1].strip()
    return text


def _split_pipe_payload(raw: str) -> List[str]:
    if "|" not in raw:
        cleaned = _strip_wrapping_quotes(raw)
        return [cleaned] if cleaned else []
    parts = [_strip_wrapping_quotes(part) for part in raw.split("|")]
    return [part.strip() for part in parts]


def _normalize_align(raw: str, *, default: str = "center") -> str:
    value = (raw or "").strip().lower()
    if value in {"left", "center", "right", "justify"}:
        return value
    return default


def _parse_scale(raw: str, *, default: float = 100.0) -> float:
    if not raw:
        return default
    cleaned = raw.strip().rstrip("%")
    try:
        value = float(cleaned)
    except ValueError:
        return default
    return max(10.0, min(100.0, value))


def _parse_media_payload(raw: str) -> Tuple[str, str, str, float]:
    parts = _split_pipe_payload(raw)
    source = parts[0] if len(parts) > 0 else ""
    caption = parts[1] if len(parts) > 1 else ""
    align = _normalize_align(parts[2], default="center") if len(parts) > 2 else "center"
    scale = _parse_scale(parts[3], default=100.0) if len(parts) > 3 else 100.0
    return source, caption, align, scale


def _caption_number(state: _CaptionState, kind: str) -> str:
    if kind == "figure":
        state.figure_global += 1
        if state.chapter_idx > 0:
            state.figure_chapter += 1
            return f"{state.chapter_idx}.{state.figure_chapter}"
        return str(state.figure_global)
    state.table_global += 1
    if state.chapter_idx > 0:
        state.table_chapter += 1
        return f"{state.chapter_idx}.{state.table_chapter}"
    return str(state.table_global)


def _collect_caption_entries(nodes: Sequence[Node]) -> tuple[list[str], list[str]]:
    state = _CaptionState()
    figures: list[str] = []
    tables: list[str] = []
    for node in nodes:
        if node.type == "chapter":
            state.chapter_idx += 1
            state.figure_chapter = 0
            state.table_chapter = 0
            continue
        if node.type in {"figure", "image"}:
            caption = (node.caption or node.text or "").strip()
            if node.type == "figure" or caption:
                num = _caption_number(state, "figure")
                figures.append(f"Figure {num}: {caption or node.source or 'Image'}")
            continue
        if node.type == "figure_caption":
            num = _caption_number(state, "figure")
            figures.append(f"Figure {num}: {node.text}")
            continue
        if node.type == "table_caption":
            num = _caption_number(state, "table")
            tables.append(f"Table {num}: {node.text}")
    return figures, tables


def _escape_with_breaks(value: str) -> str:
    return escape(value).replace("\n", "<br/>")


def parse_notesforge(content: str, *, tab_width: int = 4) -> ParseResult:
    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    nodes: List[Node] = []
    warnings: List[str] = []
    idx = 0
    options = ParseOptions(tab_width=_effective_tab_width(tab_width), list_indent_unit=2)

    while idx < len(lines):
        raw_line = lines[idx]
        if not raw_line.strip():
            idx += 1
            continue

        marker_match = MARKER_RE.match(raw_line)
        if not marker_match:
            fallback_text = raw_line.rstrip()
            nodes.append(Node(type="paragraph", text=fallback_text))
            warnings.append(f"Line {idx + 1}: treated as PARAGRAPH (no marker found).")
            idx += 1
            continue

        raw_marker = marker_match.group(1).upper()
        marker = normalize_marker(raw_marker)
        payload_raw = marker_match.group(2)
        payload_text = _payload_text(payload_raw.rstrip())
        payload = payload_text.strip()

        if marker == "H1":
            nodes.append(Node(type="heading", level=1, text=payload, marker=raw_marker))
            idx += 1
            continue

        if marker == "H2":
            nodes.append(Node(type="heading", level=2, text=payload, marker=raw_marker))
            idx += 1
            continue

        if marker == "H3":
            nodes.append(Node(type="heading", level=3, text=payload, marker=raw_marker))
            idx += 1
            continue

        if marker in {"H4", "H5", "H6"}:
            nodes.append(Node(type="heading", level=int(marker[1:]), text=payload, marker=raw_marker))
            idx += 1
            continue

        if marker in FRONT_MATTER_MARKERS:
            nodes.append(
                Node(
                    type="section",
                    text=payload or FRONT_MATTER_MARKERS[marker],
                    role=marker.lower(),
                    marker=raw_marker,
                )
            )
            idx += 1
            continue

        if marker == "CHAPTER":
            nodes.append(Node(type="chapter", text=payload or "Chapter", role="chapter", marker=raw_marker))
            idx += 1
            continue

        if marker == "APPENDIX":
            nodes.append(Node(type="appendix", text=payload or "Appendix", role="appendix", marker=raw_marker))
            idx += 1
            continue

        if marker == "REFERENCES":
            nodes.append(
                Node(
                    type="references_heading",
                    text=payload or "References",
                    role="references",
                    marker=raw_marker,
                )
            )
            idx += 1
            continue

        if marker == "REFERENCE":
            nodes.append(Node(type="reference", text=payload, role="reference", marker=raw_marker))
            idx += 1
            continue

        if marker == "TOC":
            nodes.append(Node(type="toc", text=payload or "Table of Contents", role="toc", marker=raw_marker))
            idx += 1
            continue

        if marker == "LIST_OF_TABLES":
            nodes.append(
                Node(
                    type="list_of_tables",
                    text=payload or "List of Tables",
                    role="list_of_tables",
                    marker=raw_marker,
                )
            )
            idx += 1
            continue

        if marker == "LIST_OF_FIGURES":
            nodes.append(
                Node(
                    type="list_of_figures",
                    text=payload or "List of Figures",
                    role="list_of_figures",
                    marker=raw_marker,
                )
            )
            idx += 1
            continue

        if marker == "TABLE_CAPTION":
            nodes.append(Node(type="table_caption", text=payload, role="table_caption", marker=raw_marker))
            idx += 1
            continue

        if marker == "FIGURE_CAPTION":
            nodes.append(Node(type="figure_caption", text=payload, role="figure_caption", marker=raw_marker))
            idx += 1
            continue

        if marker in {"IMAGE", "FIGURE"}:
            source, caption, align, scale = _parse_media_payload(payload_text)
            if not source:
                warnings.append(f"Line {idx + 1}: {marker} has no image source.")
            nodes.append(
                Node(
                    type="figure" if marker == "FIGURE" else "image",
                    text=caption or payload,
                    source=source,
                    caption=caption,
                    align=align,
                    scale=scale,
                    role=marker.lower(),
                    marker=raw_marker,
                )
            )
            idx += 1
            continue

        if marker in {
            "PARAGRAPH",
            "CENTER",
            "RIGHT",
            "JUSTIFY",
            "QUOTE",
            "NOTE",
            "IMPORTANT",
            "LINK",
            "HIGHLIGHT",
            "FOOTNOTE",
            "LABEL",
            "WATERMARK",
        }:
            paragraph_lines = [payload_text] if payload_text else []
            next_idx = idx + 1
            while next_idx < len(lines):
                if _is_marker_line(lines[next_idx]):
                    break
                if not lines[next_idx].strip():
                    break
                paragraph_lines.append(lines[next_idx].rstrip())
                next_idx += 1
            align = {
                "PARAGRAPH": "left",
                "CENTER": "center",
                "RIGHT": "right",
                "JUSTIFY": "justify",
                "QUOTE": "left",
                "NOTE": "left",
                "IMPORTANT": "left",
                "LINK": "left",
                "HIGHLIGHT": "left",
                "FOOTNOTE": "left",
                "LABEL": "left",
                "WATERMARK": "left",
            }[marker]
            role = marker.lower() if marker not in {"PARAGRAPH", "CENTER", "RIGHT", "JUSTIFY"} else "paragraph"
            nodes.append(
                Node(
                    type="paragraph",
                    text="\n".join(paragraph_lines).rstrip(),
                    align=align,
                    role=role,
                    marker=raw_marker,
                )
            )
            idx = next_idx if next_idx > idx else idx + 1
            continue

        if marker == "BULLET":
            items: List[str] = []
            levels: List[int] = []
            if payload_text:
                cleaned, item_level = _parse_list_item(payload_text, numbered=False, options=options)
                if cleaned.strip():
                    items.append(cleaned)
                    levels.append(item_level)
            next_idx = idx + 1
            while next_idx < len(lines):
                nraw = lines[next_idx]
                marker_line = MARKER_RE.match(nraw)
                if marker_line:
                    next_name = normalize_marker(marker_line.group(1).upper())
                    if next_name == "BULLET":
                        cleaned, item_level = _parse_list_item(
                            _payload_text(marker_line.group(2)),
                            numbered=False,
                            options=options,
                        )
                        if cleaned.strip():
                            items.append(cleaned)
                            levels.append(item_level)
                        next_idx += 1
                        continue
                    break
                if not nraw.strip():
                    next_idx += 1
                    continue
                cleaned, item_level = _parse_list_item(nraw, numbered=False, options=options)
                if cleaned.strip():
                    items.append(cleaned)
                    levels.append(item_level)
                next_idx += 1
            if not items:
                warnings.append(f"Line {idx + 1}: BULLET block has no items.")
            nodes.append(Node(type="bullet", items=items, levels=levels, marker=raw_marker))
            idx = next_idx
            continue

        if marker == "NUMBERED":
            items: List[str] = []
            levels: List[int] = []
            if payload_text:
                cleaned, item_level = _parse_list_item(payload_text, numbered=True, options=options)
                if cleaned.strip():
                    items.append(cleaned)
                    levels.append(item_level)
            next_idx = idx + 1
            while next_idx < len(lines):
                nraw = lines[next_idx]
                marker_line = MARKER_RE.match(nraw)
                if marker_line:
                    next_name = normalize_marker(marker_line.group(1).upper())
                    if next_name == "NUMBERED":
                        cleaned, item_level = _parse_list_item(
                            _payload_text(marker_line.group(2)),
                            numbered=True,
                            options=options,
                        )
                        if cleaned.strip():
                            items.append(cleaned)
                            levels.append(item_level)
                        next_idx += 1
                        continue
                    break
                if not nraw.strip():
                    next_idx += 1
                    continue
                cleaned, item_level = _parse_list_item(nraw, numbered=True, options=options)
                items.append(cleaned if cleaned.strip() else nraw.strip())
                levels.append(item_level)
                next_idx += 1
            if not items:
                warnings.append(f"Line {idx + 1}: NUMBERED block has no items.")
            nodes.append(Node(type="numbered", items=items, levels=levels, marker=raw_marker))
            idx = next_idx
            continue

        if marker == "CODE":
            code_lines = [payload_text] if payload_text else []
            next_idx = idx + 1
            while next_idx < len(lines):
                if _is_marker_line(lines[next_idx]):
                    break
                code_lines.append(lines[next_idx])
                next_idx += 1
            code_text = "\n".join(code_lines).strip("\n")
            nodes.append(Node(type="code", text=code_text, marker=raw_marker))
            idx = next_idx
            continue

        if marker == "ASCII":
            ascii_lines = [payload_text] if payload_text else []
            next_idx = idx + 1
            while next_idx < len(lines):
                candidate = lines[next_idx]
                if _is_marker_line(candidate):
                    break
                if not candidate.strip() and ascii_lines:
                    break
                ascii_lines.append(candidate.rstrip())
                next_idx += 1
            nodes.append(Node(type="ascii", text="\n".join(ascii_lines).rstrip("\n"), marker=raw_marker))
            idx = next_idx
            continue

        if marker == "TABLE":
            rows: List[List[str]] = []
            if payload:
                row = _split_table_row(payload)
                if row:
                    rows.append(row)

            next_idx = idx + 1
            while next_idx < len(lines):
                nraw = lines[next_idx]
                nline = nraw.strip()
                next_marker = MARKER_RE.match(nraw)
                if next_marker:
                    next_name = normalize_marker(next_marker.group(1).upper())
                    if next_name == "TABLE":
                        next_payload = _payload_text(next_marker.group(2)).strip()
                        next_row = _split_table_row(next_payload)
                        if next_row:
                            rows.append(next_row)
                        else:
                            warnings.append(f"Line {next_idx + 1}: TABLE row is empty.")
                        next_idx += 1
                        continue
                    break
                if not nline:
                    next_idx += 1
                    continue
                if nline.startswith("|"):
                    split = _split_table_row(nline)
                    if split:
                        rows.append(split)
                else:
                    warnings.append(f"Line {next_idx + 1}: ignored invalid TABLE row.")
                next_idx += 1
            if not rows:
                warnings.append(f"Line {idx + 1}: TABLE has no rows.")
            else:
                max_cols = max(len(row) for row in rows)
                rows = [row + [""] * (max_cols - len(row)) for row in rows]
            nodes.append(Node(type="table", rows=rows, marker=raw_marker))
            idx = next_idx
            continue

        if marker == "PAGEBREAK":
            nodes.append(Node(type="pagebreak", marker=raw_marker))
            idx += 1
            continue

        idx += 1

    heading_count = sum(1 for n in nodes if n.type in {"heading", "chapter", "section", "appendix", "references_heading"})
    all_text_parts: List[str] = []
    for node in nodes:
        if node.type in {
            "heading",
            "chapter",
            "section",
            "appendix",
            "references_heading",
            "paragraph",
            "code",
            "table_caption",
            "figure_caption",
            "reference",
        } and node.text:
            all_text_parts.append(node.text)
        if node.caption:
            all_text_parts.append(node.caption)
        if node.items:
            all_text_parts.extend(node.items)
        if node.rows:
            for row in node.rows:
                all_text_parts.extend(row)
    word_count = len(" ".join(all_text_parts).split())
    reading_time = round(word_count / 200.0, 2)

    return ParseResult(
        nodes=nodes,
        warnings=warnings,
        summary=StructureSummary(
            word_count=word_count,
            heading_count=heading_count,
            reading_time_minutes=reading_time,
        ),
    )


def render_preview_html(
    nodes: Sequence[Node],
    css: str,
    watermark_html: str = "",
) -> str:
    fragments: List[str] = ['<div class="nf-preview-root">']

    if watermark_html:
        fragments.append(watermark_html)

    caption_state = _CaptionState()
    figures, tables = _collect_caption_entries(nodes)

    for node in nodes:
        if node.type == "heading":
            level = max(1, min(6, node.level))
            fragments.append(f"<h{level}>{escape(node.text)}</h{level}>")
        elif node.type in {"section", "chapter", "appendix", "references_heading"}:
            if node.type == "chapter":
                caption_state.chapter_idx += 1
                caption_state.figure_chapter = 0
                caption_state.table_chapter = 0
            title = node.text or node.type.replace("_", " ").title()
            if node.type == "chapter":
                title = f"CHAPTER {caption_state.chapter_idx}: {title}"
            fragments.append(f"<h1>{escape(title)}</h1>")
        elif node.type == "toc":
            fragments.append(f'<p class="nf-paragraph nf-toc"><strong>{escape(node.text or "Table of Contents")}</strong></p>')
        elif node.type == "list_of_tables":
            fragments.append(f"<h2>{escape(node.text or 'List of Tables')}</h2>")
            fragments.append('<ul class="nf-list-root">')
            for item in tables or ["Table entries are generated during export."]:
                fragments.append(f'<li class="nf-list-item">{escape(item)}</li>')
            fragments.append("</ul>")
        elif node.type == "list_of_figures":
            fragments.append(f"<h2>{escape(node.text or 'List of Figures')}</h2>")
            fragments.append('<ul class="nf-list-root">')
            for item in figures or ["Figure entries are generated during export."]:
                fragments.append(f'<li class="nf-list-item">{escape(item)}</li>')
            fragments.append("</ul>")
        elif node.type == "reference":
            fragments.append(f'<p class="nf-paragraph nf-reference">{_escape_with_breaks(node.text)}</p>')
        elif node.type == "paragraph":
            classes = ["nf-paragraph"]
            if node.role and node.role != "paragraph":
                classes.append(f"nf-{escape(node.role)}")
            style_attr = ""
            if node.align and node.align != "left":
                style_attr = f' style="text-align:{escape(node.align)}"'
            fragments.append(
                f'<p class="{" ".join(classes)}"{style_attr}>{_escape_with_breaks(node.text)}</p>'
            )
        elif node.type == "bullet":
            items = node.items or []
            levels = node.levels or []
            fragments.append('<ul class="nf-list-root">')
            for idx, item in enumerate(items):
                item_level = levels[idx] if idx < len(levels) else 0
                fragments.append(
                    f'<li class="nf-list-item" style="--nf-level:{item_level}">{escape(item)}</li>'
                )
            fragments.append("</ul>")
        elif node.type == "numbered":
            items = node.items or []
            levels = node.levels or []
            fragments.append('<ol class="nf-list-root">')
            for idx, item in enumerate(items):
                item_level = levels[idx] if idx < len(levels) else 0
                fragments.append(
                    f'<li class="nf-list-item" style="--nf-level:{item_level}">{escape(item)}</li>'
                )
            fragments.append("</ol>")
        elif node.type == "code":
            fragments.append(f"<pre><code>{escape(node.text)}</code></pre>")
        elif node.type == "ascii":
            fragments.append(f'<pre class="nf-ascii"><code>{escape(node.text)}</code></pre>')
        elif node.type == "image" or node.type == "figure":
            align_style = f'text-align:{escape(node.align or "center")};'
            src = escape(node.source, quote=True)
            scale = max(10.0, min(100.0, node.scale or 100.0))
            fragments.append(f'<figure class="nf-figure" style="{align_style}">')
            if src:
                fragments.append(f'<img src="{src}" alt="" style="max-width:{scale:.0f}%;height:auto;" />')
            else:
                fragments.append('<div class="nf-image-missing">[Image source missing]</div>')
            caption = (node.caption or "").strip()
            if node.type == "figure" or caption:
                num = _caption_number(caption_state, "figure")
                text = caption or node.text or node.source or "Image"
                fragments.append(f'<figcaption class="nf-caption">Figure {escape(num)}: {escape(text)}</figcaption>')
            fragments.append("</figure>")
        elif node.type == "table":
            rows = node.rows or []
            if rows:
                header = rows[0]
                body = rows[1:] if len(rows) > 1 else []
                fragments.append("<table><thead><tr>")
                for col in header:
                    fragments.append(f"<th>{escape(col)}</th>")
                fragments.append("</tr></thead><tbody>")
                for row in body:
                    fragments.append("<tr>")
                    for col in row:
                        fragments.append(f"<td>{escape(col)}</td>")
                    fragments.append("</tr>")
                fragments.append("</tbody></table>")
        elif node.type == "table_caption":
            num = _caption_number(caption_state, "table")
            fragments.append(f'<p class="nf-caption nf-table-caption">Table {escape(num)}: {escape(node.text)}</p>')
        elif node.type == "figure_caption":
            num = _caption_number(caption_state, "figure")
            fragments.append(f'<p class="nf-caption nf-figure-caption">Figure {escape(num)}: {escape(node.text)}</p>')
        elif node.type == "pagebreak":
            fragments.append('<div class="nf-page-break" aria-hidden="true"></div>')

    fragments.append("</div>")
    return f"<style>{css}</style>{''.join(fragments)}"


def to_markdown(nodes: Sequence[Node]) -> str:
    lines: List[str] = []
    caption_state = _CaptionState()
    figures, tables = _collect_caption_entries(nodes)
    for node in nodes:
        if node.type == "heading":
            lines.append(f"{'#' * max(1, min(6, node.level))} {node.text}")
        elif node.type == "section":
            lines.append(f"# {node.text}")
        elif node.type == "chapter":
            caption_state.chapter_idx += 1
            caption_state.figure_chapter = 0
            caption_state.table_chapter = 0
            lines.append(f"# CHAPTER {caption_state.chapter_idx}: {node.text}")
        elif node.type == "appendix":
            lines.append(f"# Appendix: {node.text}")
        elif node.type == "references_heading":
            lines.append(f"## {node.text}")
        elif node.type == "reference":
            lines.append(f"- {node.text}")
        elif node.type == "toc":
            lines.append("## Table of Contents")
        elif node.type == "list_of_tables":
            lines.append(f"## {node.text or 'List of Tables'}")
            for item in tables or ["Table entries are generated during export."]:
                lines.append(f"- {item}")
        elif node.type == "list_of_figures":
            lines.append(f"## {node.text or 'List of Figures'}")
            for item in figures or ["Figure entries are generated during export."]:
                lines.append(f"- {item}")
        elif node.type == "paragraph":
            lines.append(node.text)
        elif node.type == "pagebreak":
            lines.append("---")
        elif node.type == "bullet":
            levels = node.levels or []
            for idx, item in enumerate(node.items or []):
                item_level = levels[idx] if idx < len(levels) else 0
                lines.append(f"{'  ' * item_level}- {item}")
        elif node.type == "numbered":
            levels = node.levels or []
            for idx, item in enumerate(node.items or [], start=1):
                item_level = levels[idx - 1] if idx - 1 < len(levels) else 0
                lines.append(f"{'  ' * item_level}{idx}. {item}")
        elif node.type == "code":
            lines.append("```")
            lines.append(node.text)
            lines.append("```")
        elif node.type == "ascii":
            lines.append("```text")
            lines.append(node.text)
            lines.append("```")
        elif node.type == "image" or node.type == "figure":
            text = node.caption or node.text or "Image"
            lines.append(f"![{text}]({node.source})")
            if node.type == "figure" or node.caption:
                num = _caption_number(caption_state, "figure")
                lines.append(f"*Figure {num}: {text}*")
        elif node.type == "table":
            rows = node.rows or []
            if rows:
                lines.append("| " + " | ".join(rows[0]) + " |")
                lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")
                for row in rows[1:]:
                    lines.append("| " + " | ".join(row) + " |")
        elif node.type == "table_caption":
            num = _caption_number(caption_state, "table")
            lines.append(f"*Table {num}: {node.text}*")
        elif node.type == "figure_caption":
            num = _caption_number(caption_state, "figure")
            lines.append(f"*Figure {num}: {node.text}*")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def to_plain_text(nodes: Sequence[Node]) -> str:
    lines: List[str] = []
    caption_state = _CaptionState()
    figures, tables = _collect_caption_entries(nodes)
    for node in nodes:
        if node.type == "heading":
            lines.append(node.text)
        elif node.type == "section":
            lines.append(node.text)
        elif node.type == "chapter":
            caption_state.chapter_idx += 1
            caption_state.figure_chapter = 0
            caption_state.table_chapter = 0
            lines.append(f"CHAPTER {caption_state.chapter_idx}: {node.text}")
        elif node.type == "appendix":
            lines.append(f"Appendix: {node.text}")
        elif node.type == "references_heading":
            lines.append(node.text)
        elif node.type == "reference":
            lines.append(f"- {node.text}")
        elif node.type == "toc":
            lines.append("Table of Contents")
        elif node.type == "list_of_tables":
            lines.append(node.text or "List of Tables")
            lines.extend(f"- {entry}" for entry in tables)
        elif node.type == "list_of_figures":
            lines.append(node.text or "List of Figures")
            lines.extend(f"- {entry}" for entry in figures)
        elif node.type == "paragraph":
            lines.append(node.text)
        elif node.type == "pagebreak":
            lines.append("")
            lines.append("[PAGE BREAK]")
        elif node.type == "bullet":
            lines.extend(f"- {item}" for item in (node.items or []))
        elif node.type == "numbered":
            lines.extend(f"{idx}. {item}" for idx, item in enumerate(node.items or [], start=1))
        elif node.type == "code":
            lines.append(node.text)
        elif node.type == "ascii":
            lines.append(node.text)
        elif node.type == "image" or node.type == "figure":
            lines.append(f"[IMAGE] {node.source}")
            if node.type == "figure" or node.caption:
                num = _caption_number(caption_state, "figure")
                lines.append(f"Figure {num}: {node.caption or node.text or node.source}")
        elif node.type == "table":
            for row in node.rows or []:
                lines.append(" | ".join(row))
        elif node.type == "table_caption":
            num = _caption_number(caption_state, "table")
            lines.append(f"Table {num}: {node.text}")
        elif node.type == "figure_caption":
            num = _caption_number(caption_state, "figure")
            lines.append(f"Figure {num}: {node.text}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"
