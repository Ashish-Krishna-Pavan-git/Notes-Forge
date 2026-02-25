from __future__ import annotations

from dataclasses import dataclass
from html import escape
import re
from typing import List, Sequence


MARKER_RE = re.compile(r"^\s*(H[1-6]|PARAGRAPH|BULLET|NUMBERED|CODE|TABLE)\s*:\s*(.*)$", re.IGNORECASE)


@dataclass
class Node:
    type: str
    text: str = ""
    level: int = 0
    items: List[str] | None = None
    rows: List[List[str]] | None = None


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
        payload = marker_match.group(2).strip()

        if marker.startswith("H") and marker[1:].isdigit():
            nodes.append(Node(type="heading", level=int(marker[1:]), text=payload))
            idx += 1
            continue

        if marker == "PARAGRAPH":
            paragraph_lines = [payload] if payload else []
            next_idx = idx + 1
            while next_idx < len(lines):
                if _is_marker_line(lines[next_idx]):
                    break
                if not lines[next_idx].strip():
                    break
                paragraph_lines.append(lines[next_idx].strip())
                next_idx += 1
            nodes.append(Node(type="paragraph", text=" ".join(p for p in paragraph_lines if p).strip()))
            idx = next_idx if next_idx > idx else idx + 1
            continue

        if marker == "BULLET":
            items: List[str] = []
            if payload:
                cleaned = payload.lstrip("-* ").strip()
                if cleaned:
                    items.append(cleaned)
            next_idx = idx + 1
            while next_idx < len(lines):
                nline = lines[next_idx].strip()
                if _is_marker_line(lines[next_idx]):
                    break
                if not nline:
                    next_idx += 1
                    continue
                if nline.startswith(("-", "*")):
                    items.append(nline.lstrip("-* ").strip())
                else:
                    items.append(nline)
                next_idx += 1
            if not items:
                warnings.append(f"Line {idx + 1}: BULLET block has no items.")
            nodes.append(Node(type="bullet", items=items))
            idx = next_idx
            continue

        if marker == "NUMBERED":
            items = []
            if payload:
                cleaned = re.sub(r"^\d+[.)]\s*", "", payload).strip()
                if cleaned:
                    items.append(cleaned)
            next_idx = idx + 1
            while next_idx < len(lines):
                nline = lines[next_idx].strip()
                if _is_marker_line(lines[next_idx]):
                    break
                if not nline:
                    next_idx += 1
                    continue
                cleaned = re.sub(r"^\d+[.)]\s*", "", nline).strip()
                items.append(cleaned if cleaned else nline)
                next_idx += 1
            if not items:
                warnings.append(f"Line {idx + 1}: NUMBERED block has no items.")
            nodes.append(Node(type="numbered", items=items))
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

        if marker == "TABLE":
            rows: List[List[str]] = []
            if payload.startswith("|"):
                row = _split_table_row(payload)
                if row:
                    rows.append(row)

            next_idx = idx + 1
            while next_idx < len(lines):
                nline = lines[next_idx].strip()
                if _is_marker_line(lines[next_idx]):
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
            nodes.append(Node(type="table", rows=rows))
            idx = next_idx
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
            fragments.append(f"<p>{escape(node.text)}</p>")
        elif node.type == "bullet":
            items = node.items or []
            fragments.append("<ul>")
            for item in items:
                fragments.append(f"<li>{escape(item)}</li>")
            fragments.append("</ul>")
        elif node.type == "numbered":
            items = node.items or []
            fragments.append("<ol>")
            for item in items:
                fragments.append(f"<li>{escape(item)}</li>")
            fragments.append("</ol>")
        elif node.type == "code":
            fragments.append(f"<pre><code>{escape(node.text)}</code></pre>")
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

    fragments.append("</div>")
    return f"<style>{css}</style>{''.join(fragments)}"


def to_markdown(nodes: Sequence[Node]) -> str:
    lines: List[str] = []
    for node in nodes:
        if node.type == "heading":
            lines.append(f"{'#' * max(1, min(6, node.level))} {node.text}")
        elif node.type == "paragraph":
            lines.append(node.text)
        elif node.type == "bullet":
            for item in node.items or []:
                lines.append(f"- {item}")
        elif node.type == "numbered":
            for idx, item in enumerate(node.items or [], start=1):
                lines.append(f"{idx}. {item}")
        elif node.type == "code":
            lines.append("```")
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
        elif node.type == "bullet":
            lines.extend(f"- {item}" for item in (node.items or []))
        elif node.type == "numbered":
            lines.extend(f"{idx}. {item}" for idx, item in enumerate(node.items or [], start=1))
        elif node.type == "code":
            lines.append(node.text)
        elif node.type == "table":
            for row in node.rows or []:
                lines.append(" | ".join(row))
        lines.append("")
    return "\n".join(lines).strip() + "\n"
