import type { Theme } from "../types";

interface LocalStructure {
  wordCount: number;
  headingCount: number;
  readingTimeMinutes: number;
}

export interface LocalPreviewResult {
  previewHtml: string;
  warnings: string[];
  structure: LocalStructure;
}

const markerRe =
  /^\s*(H[1-6]|PARAGRAPH|BULLET|NUMBERED|CODE|TABLE)\s*:\s*(.*)$/i;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssFromTheme(theme: Theme): string {
  const bodySize = theme.bodyStyle.size ?? 11;
  const lineHeight = theme.bodyStyle.lineHeight ?? 1.4;
  return `
    .nf-preview-root{font-family:${theme.fontFamily};font-size:${bodySize}px;line-height:${lineHeight};color:#1f2937;}
    .nf-preview-root h1,.nf-preview-root h2,.nf-preview-root h3,.nf-preview-root h4,.nf-preview-root h5,.nf-preview-root h6{color:${theme.primaryColor};margin:0.8rem 0 0.45rem;}
    .nf-preview-root p{margin:0.45rem 0;}
    .nf-preview-root ul,.nf-preview-root ol{margin:0.4rem 0 0.8rem 1.3rem;}
    .nf-preview-root pre{background:#0f172a;color:#e2e8f0;padding:0.75rem;border-radius:8px;}
    .nf-preview-root table{width:100%;border-collapse:collapse;margin:0.8rem 0;}
    .nf-preview-root th,.nf-preview-root td{border:1px solid #d1d5db;padding:0.45rem;text-align:left;}
    .nf-preview-root thead{background:#f3f4f6;}
  `;
}

export function renderLocalPreview(content: string, theme: Theme): LocalPreviewResult {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const warnings: string[] = [];
  const html: string[] = ['<div class="nf-preview-root">'];
  let idx = 0;
  let headingCount = 0;
  const words: string[] = [];

  while (idx < lines.length) {
    const line = lines[idx];
    const match = markerRe.exec(line);
    if (!line.trim()) {
      idx += 1;
      continue;
    }

    if (!match) {
      html.push(`<p>${escapeHtml(line.trim())}</p>`);
      words.push(...line.trim().split(/\s+/));
      warnings.push(`Line ${idx + 1}: rendered as paragraph (marker missing).`);
      idx += 1;
      continue;
    }

    const marker = match[1].toUpperCase();
    const payload = match[2].trim();

    if (marker.startsWith("H")) {
      const level = Number(marker.slice(1));
      html.push(`<h${level}>${escapeHtml(payload)}</h${level}>`);
      headingCount += 1;
      words.push(...payload.split(/\s+/).filter(Boolean));
      idx += 1;
      continue;
    }

    if (marker === "PARAGRAPH") {
      html.push(`<p>${escapeHtml(payload)}</p>`);
      words.push(...payload.split(/\s+/).filter(Boolean));
      idx += 1;
      continue;
    }

    if (marker === "BULLET") {
      html.push("<ul>");
      let found = false;
      idx += 1;
      while (idx < lines.length && !markerRe.test(lines[idx])) {
        const item = lines[idx].trim();
        if (item.startsWith("-")) {
          const text = item.replace(/^-+\s*/, "");
          html.push(`<li>${escapeHtml(text)}</li>`);
          words.push(...text.split(/\s+/).filter(Boolean));
          found = true;
        }
        idx += 1;
      }
      if (!found) {
        warnings.push("BULLET block has no list items.");
      }
      html.push("</ul>");
      continue;
    }

    if (marker === "NUMBERED") {
      html.push("<ol>");
      let found = false;
      idx += 1;
      while (idx < lines.length && !markerRe.test(lines[idx])) {
        const item = lines[idx].trim();
        if (!item) {
          idx += 1;
          continue;
        }
        const normalized = item.replace(/^\d+[.)]\s*/, "");
        html.push(`<li>${escapeHtml(normalized)}</li>`);
        words.push(...normalized.split(/\s+/).filter(Boolean));
        found = true;
        idx += 1;
      }
      if (!found) {
        warnings.push("NUMBERED block has no items.");
      }
      html.push("</ol>");
      continue;
    }

    if (marker === "CODE") {
      idx += 1;
      const codeLines: string[] = payload ? [payload] : [];
      while (idx < lines.length && !markerRe.test(lines[idx])) {
        codeLines.push(lines[idx]);
        idx += 1;
      }
      const code = codeLines.join("\n");
      html.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      words.push(...code.split(/\s+/).filter(Boolean));
      continue;
    }

    if (marker === "TABLE") {
      idx += 1;
      const rows: string[][] = [];
      while (idx < lines.length && !markerRe.test(lines[idx])) {
        const row = lines[idx].trim();
        if (row.startsWith("|")) {
          rows.push(
            row
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((col) => col.trim()),
          );
        }
        idx += 1;
      }
      if (rows.length > 0) {
        html.push("<table><thead><tr>");
        rows[0].forEach((col) => html.push(`<th>${escapeHtml(col)}</th>`));
        html.push("</tr></thead><tbody>");
        rows.slice(1).forEach((row) => {
          html.push("<tr>");
          row.forEach((col) => html.push(`<td>${escapeHtml(col)}</td>`));
          html.push("</tr>");
        });
        html.push("</tbody></table>");
        rows.flat().forEach((cell) => words.push(...cell.split(/\s+/).filter(Boolean)));
      } else {
        warnings.push("TABLE block has no rows.");
      }
      continue;
    }

    idx += 1;
  }

  html.push("</div>");
  return {
    previewHtml: `<style>${cssFromTheme(theme)}</style>${html.join("")}`,
    warnings,
    structure: {
      wordCount: words.length,
      headingCount,
      readingTimeMinutes: Number((words.length / 200).toFixed(2)),
    },
  };
}
