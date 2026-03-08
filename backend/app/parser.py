from __future__ import annotations

from dataclasses import dataclass
from html import escape
import re
from typing import List, Sequence


MARKER_RE = re.compile(
    r"^\s*(HEADING|SUBHEADING|SUB-SUBHEADING|H[1-6]|PARAGRAPH|PARA|CENTER|RIGHT|JUSTIFY|BULLET|NUMBERED|CODE|ASCII|TABLE|PAGEBREAK|PAGE_BREAK|QUOTE|NOTE|IMPORTANT|TOC|IMAGE|LINK|HIGHLIGHT|FOOTNOTE)\s*:(.*)$",
    re.IGNORECASE,
)


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


def _is_marker_line(line: str) -> bool:
    return bool(MARKER_RE.match(line))


def _split_table_row(row: str) -> List[str]:
    cleaned = row.strip().strip("|")
    return [col.strip() for col in cleaned.split("|")] if cleaned else []


def _list_level(raw: str, unit: int = 2) -> int:
    expanded = raw.replace("\t", " " * unit)
    spaces = len(expanded) - len(expanded.lstrip(" "))
    return max(0, spaces // max(1, unit))


def _parse_list_item(raw: str, numbered: bool) -> tuple[str, int]:
    level = _list_level(raw)
    stripped = raw.lstrip()
    if numbered:
        stripped = re.sub(r"^\d+[.)]\s*", "", stripped)
    else:
        stripped = re.sub(r"^[-*]\s*", "", stripped)
    return stripped.strip(), level


def parse_notesforge(content: str) -> ParseResult:
    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    nodes: List[Node] = []
    warnings: List[str] = []
    idx = 0

    while idx < len(lines):
        raw_line = lines[idx]
        line = raw_line.strip()

        if not line:
            idx += 1
            continue

        marker_match = MARKER_RE.match(raw_line)
        if not marker_match:
            nodes.append(Node(type="paragraph", text=line))
            warnings.append(f"Line {idx + 1}: treated as PARAGRAPH (no marker found).")
            idx += 1
            continue

        marker = marker_match.group(1).upper()
        payload_raw = marker_match.group(2)
        payload = payload_raw.strip()

        if marker in {"HEADING", "H1"}:
            nodes.append(Node(type="heading", level=1, text=payload))
            idx += 1
            continue

        if marker in {"SUBHEADING", "H2"}:
            nodes.append(Node(type="heading", level=2, text=payload))
            idx += 1
            continue

        if marker in {"SUB-SUBHEADING", "H3"}:
            nodes.append(Node(type="heading", level=3, text=payload))
            idx += 1
            continue

        if marker in {"H4", "H5", "H6"}:
            nodes.append(Node(type="heading", level=int(marker[1:]), text=payload))
            idx += 1
            continue

        if marker in {
            "PARAGRAPH",
            "PARA",
            "CENTER",
            "RIGHT",
            "JUSTIFY",
            "QUOTE",
            "NOTE",
            "IMPORTANT",
            "TOC",
            "IMAGE",
            "LINK",
            "HIGHLIGHT",
            "FOOTNOTE",
        }:
            paragraph_lines = [payload] if payload else []
            next_idx = idx + 1
            while next_idx < len(lines):
                if _is_marker_line(lines[next_idx]):
                    break
                if not lines[next_idx].strip():
                    break
                paragraph_lines.append(lines[next_idx].strip())
                next_idx += 1
            align = {
                "PARAGRAPH": "left",
                "PARA": "left",
                "CENTER": "center",
                "RIGHT": "right",
                "JUSTIFY": "justify",
                "QUOTE": "left",
                "NOTE": "left",
                "IMPORTANT": "left",
                "TOC": "left",
                "IMAGE": "left",
                "LINK": "left",
                "HIGHLIGHT": "left",
                "FOOTNOTE": "left",
            }[marker]
            nodes.append(
                Node(
                    type="paragraph",
                    text=" ".join(p for p in paragraph_lines if p).strip(),
                    align=align,
                    role=marker.lower() if marker not in {"PARAGRAPH", "PARA", "CENTER", "RIGHT", "JUSTIFY"} else "paragraph",
                )
            )
            idx = next_idx if next_idx > idx else idx + 1
            continue

        if marker == "BULLET":
            items: List[str] = []
            levels: List[int] = []
            if payload:
                cleaned, item_level = _parse_list_item(payload_raw, numbered=False)
                if cleaned:
                    items.append(cleaned)
                    levels.append(item_level)
            next_idx = idx + 1
            while next_idx < len(lines):
                nraw = lines[next_idx]
                marker_line = MARKER_RE.match(nraw)
                if marker_line:
                    if marker_line.group(1).upper() == "BULLET":
                        cleaned, item_level = _parse_list_item(marker_line.group(2), numbered=False)
                        if cleaned:
                            items.append(cleaned)
                            levels.append(item_level)
                        next_idx += 1
                        continue
                    break
                nline = nraw.strip()
                if not nline:
                    next_idx += 1
                    continue
                cleaned, item_level = _parse_list_item(nraw, numbered=False)
                if cleaned:
                    items.append(cleaned)
                    levels.append(item_level)
                next_idx += 1
            if not items:
                warnings.append(f"Line {idx + 1}: BULLET block has no items.")
            nodes.append(Node(type="bullet", items=items, levels=levels))
            idx = next_idx
            continue

        if marker == "NUMBERED":
            items = []
            levels: List[int] = []
            if payload:
                cleaned, item_level = _parse_list_item(payload_raw, numbered=True)
                if cleaned:
                    items.append(cleaned)
                    levels.append(item_level)
            next_idx = idx + 1
            while next_idx < len(lines):
                nraw = lines[next_idx]
                marker_line = MARKER_RE.match(nraw)
                if marker_line:
                    if marker_line.group(1).upper() == "NUMBERED":
                        cleaned, item_level = _parse_list_item(marker_line.group(2), numbered=True)
                        if cleaned:
                            items.append(cleaned)
                            levels.append(item_level)
                        next_idx += 1
                        continue
                    break
                nline = nraw.strip()
                if not nline:
                    next_idx += 1
                    continue
                cleaned, item_level = _parse_list_item(nraw, numbered=True)
                items.append(cleaned if cleaned else nline)
                levels.append(item_level)
                next_idx += 1
            if not items:
                warnings.append(f"Line {idx + 1}: NUMBERED block has no items.")
            nodes.append(Node(type="numbered", items=items, levels=levels))
            idx = next_idx
            continue

        if marker == "CODE":
            code_lines = [payload] if payload else []
            next_idx = idx + 1
            while next_idx < len(lines):
                if _is_marker_line(lines[next_idx]):
                    break
                code_lines.append(lines[next_idx].rstrip())
                next_idx += 1
            code_text = "\n".join(code_lines).strip("\n")
            nodes.append(Node(type="code", text=code_text))
            idx = next_idx
            continue

        if marker == "ASCII":
            ascii_lines = [payload] if payload else []
            next_idx = idx + 1
            while next_idx < len(lines):
                candidate = lines[next_idx]
                if _is_marker_line(candidate):
                    break
                if not candidate.strip() and ascii_lines:
                    break
                ascii_lines.append(candidate.rstrip())
                next_idx += 1
            nodes.append(Node(type="ascii", text="\n".join(ascii_lines).rstrip("\n")))
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
                    next_name = next_marker.group(1).upper()
                    if next_name == "TABLE":
                        next_payload = next_marker.group(2).strip()
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
            nodes.append(Node(type="table", rows=rows))
            idx = next_idx
            continue

        if marker in {"PAGEBREAK", "PAGE_BREAK"}:
            nodes.append(Node(type="pagebreak"))
            idx += 1
            continue

        idx += 1

    heading_count = sum(1 for n in nodes if n.type == "heading")
    all_text_parts: List[str] = []
    for node in nodes:
        if node.type in {"heading", "paragraph", "code"} and node.text:
            all_text_parts.append(node.text)
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

    for node in nodes:
        if node.type == "heading":
            level = max(1, min(6, node.level))
            fragments.append(f"<h{level}>{escape(node.text)}</h{level}>")
        elif node.type == "paragraph":
            classes = ["nf-paragraph"]
            if node.role and node.role != "paragraph":
                classes.append(f"nf-{escape(node.role)}")
            style_attr = ""
            if node.align and node.align != "left":
                style_attr = f' style="text-align:{escape(node.align)}"'
            fragments.append(
                f'<p class="{" ".join(classes)}"{style_attr}>{escape(node.text)}</p>'
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
        elif node.type == "pagebreak":
            fragments.append('<div class="nf-page-break" aria-hidden="true"></div>')

    fragments.append("</div>")
    return f"<style>{css}</style>{''.join(fragments)}"


def to_markdown(nodes: Sequence[Node]) -> str:
    lines: List[str] = []
    for node in nodes:
        if node.type == "heading":
            lines.append(f"{'#' * max(1, min(6, node.level))} {node.text}")
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
        elif node.type == "table":
            rows = node.rows or []
            if rows:
                lines.append("| " + " | ".join(rows[0]) + " |")
                lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")
                for row in rows[1:]:
                    lines.append("| " + " | ".join(row) + " |")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def to_plain_text(nodes: Sequence[Node]) -> str:
    lines: List[str] = []
    for node in nodes:
        if node.type == "heading":
            lines.append(node.text)
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
        elif node.type == "table":
            for row in node.rows or []:
                lines.append(" | ".join(row))
        lines.append("")
    return "\n".join(lines).strip() + "\n"
