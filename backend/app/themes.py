from __future__ import annotations

from html import escape
from typing import Dict, Mapping

from .models import FormattingOptions, ThemePayload, WatermarkPayload


PROFESSIONAL_THEME = ThemePayload(
    name="Professional",
    primaryColor="#1F3A5F",
    fontFamily="Times New Roman, Georgia, serif",
    headingStyle={
        "h1": {"size": 18, "weight": "700", "color": "#1F3A5F"},
        "h2": {"size": 16, "weight": "600"},
        "h3": {"size": 14, "weight": "600"},
    },
    bodyStyle={"size": 12, "lineHeight": 1.5},
    tableStyle={"borderWidth": 1, "borderColor": "#ddd", "headerFill": "#f6f6f6"},
    margins={"top": 25, "bottom": 25, "left": 25, "right": 25},
)


def _style_num(styles: Mapping[str, object], *keys: str, default: float) -> float:
    for key in keys:
        if key not in styles:
            continue
        raw = styles.get(key)
        try:
            return float(raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
    return default


def _style_bool(styles: Mapping[str, object], *keys: str, default: bool) -> bool:
    for key in keys:
        if key not in styles:
            continue
        raw = styles.get(key)
        if isinstance(raw, bool):
            return raw
        if isinstance(raw, (int, float)):
            return bool(raw)
        if isinstance(raw, str):
            value = raw.strip().lower()
            if value in {"1", "true", "yes", "on"}:
                return True
            if value in {"0", "false", "no", "off"}:
                return False
    return default


def _style_str(styles: Mapping[str, object], *keys: str, default: str) -> str:
    for key in keys:
        if key not in styles:
            continue
        raw = styles.get(key)
        if raw is None:
            continue
        return str(raw).strip()
    return default


def _css_border_style(raw: str) -> str:
    value = (raw or "").strip().lower()
    mapping = {
        "single": "solid",
        "double": "double",
        "dashed": "dashed",
        "dotted": "dotted",
        "thick": "solid",
    }
    return mapping.get(value, "solid")


def _heading_css(theme: ThemePayload) -> str:
    styles = theme.styles if isinstance(theme.styles, dict) else {}
    heading_before_pt = _style_num(
        styles,
        "heading_spacing_before",
        "headingSpacingBefore",
        default=10.0,
    )
    heading_after_pt = _style_num(
        styles,
        "heading_spacing_after",
        "headingSpacingAfter",
        default=6.0,
    )
    before_rem = max(0.0, (heading_before_pt * 1.333) / 16.0)
    after_rem = max(0.0, (heading_after_pt * 1.333) / 16.0)
    chunks = []
    for level in range(1, 7):
        key = f"h{level}"
        token = getattr(theme.headingStyle, key)
        size = token.size if token.size else max(12, 26 - (level * 2))
        weight = token.weight if token.weight else ("700" if level == 1 else "600")
        color = token.color if token.color else theme.primaryColor
        family = _style_str(
            styles,
            f"h{level}_family",
            f"h{level}Family",
            default=theme.fontFamily,
        )
        chunks.append(
            f"{key}{{font-family:{family};font-size:{size}px;font-weight:{weight};color:{color};"
            f"margin:{before_rem:.3f}rem 0 {after_rem:.3f}rem;}}"
        )
    return "".join(chunks)


def css_from_theme(theme: ThemePayload, formatting: FormattingOptions) -> str:
    styles = theme.styles if isinstance(theme.styles, dict) else {}
    body_size = theme.bodyStyle.size or 12
    line_height = formatting.lineSpacing or theme.bodyStyle.lineHeight or 1.5
    line_height = max(1.0, min(3.0, float(line_height)))
    margins = formatting.margins
    table_border = theme.tableStyle.borderColor or "#ddd"
    table_width = theme.tableStyle.borderWidth or 1
    table_header = theme.tableStyle.headerFill or "#f6f6f6"
    paragraph_after_pt = _style_num(
        styles,
        "paragraph_spacing_after",
        "paragraphSpacingAfter",
        default=6.0,
    )
    paragraph_before_pt = _style_num(
        styles,
        "paragraph_spacing_before",
        "paragraphSpacingBefore",
        default=0.0,
    )
    paragraph_before_rem = max(0.0, (paragraph_before_pt * 1.333) / 16.0)
    paragraph_after_rem = max(0.0, (paragraph_after_pt * 1.333) / 16.0)
    first_line_indent = _style_num(
        styles,
        "paragraph_first_line_indent",
        "paragraphFirstLineIndent",
        default=0.0,
    )
    first_line_indent_em = max(0.0, first_line_indent)
    paragraph_align = _style_str(
        styles,
        "paragraph_alignment",
        "paragraphAlignment",
        default="left",
    ).lower()
    if paragraph_align not in {"left", "center", "right", "justify"}:
        paragraph_align = "left"
    bullet_base_indent = _style_num(
        styles,
        "bullet_base_indent",
        "bulletBaseIndent",
        default=0.25,
    )
    bullet_indent_per_level = _style_num(
        styles,
        "bullet_indent_per_level",
        "bulletIndentPerLevel",
        default=0.45,
    )
    quote_indent = _style_num(
        styles,
        "quote_indent",
        "quoteIndent",
        default=0.5,
    )
    code_indent = _style_num(
        styles,
        "code_indent",
        "codeIndent",
        default=0.0,
    )
    page_size = _style_str(styles, "page_size", "pageSize", default="A4").upper()
    if page_size not in {"A4", "A3", "LETTER", "LEGAL"}:
        page_size = "A4"
    page_orientation = _style_str(
        styles,
        "page_orientation",
        "pageOrientation",
        default="portrait",
    ).lower()
    if page_orientation not in {"portrait", "landscape"}:
        page_orientation = "portrait"
    body_color = _style_str(styles, "body_color", "bodyColor", default="#17202a")
    code_bg = _style_str(styles, "code_background", "codeBackground", default="#0f172a")
    code_text = _style_str(styles, "code_text", "codeText", default="#e2e8f0")
    code_font = _style_str(
        styles,
        "code_font_family",
        "codeFontFamily",
        default="JetBrains Mono, Consolas, Courier New, monospace",
    )
    code_font_size = _style_num(
        styles,
        "code_font_size",
        "codeFontSize",
        default=10.0,
    )
    ascii_bg = _style_str(styles, "ascii_background", "asciiBackground", default=code_bg)
    ascii_text = _style_str(styles, "ascii_text", "asciiText", default=code_text)
    ascii_font = _style_str(
        styles,
        "ascii_font_family",
        "asciiFontFamily",
        default=code_font,
    )
    bullet_font = _style_str(
        styles,
        "bullet_font_family",
        "bulletFontFamily",
        default=theme.fontFamily,
    )
    table_header_text = _style_str(styles, "table_header_text", "tableHeaderText", default="#111827")
    table_odd_row = _style_str(styles, "table_odd_row", "tableOddRow", default="#ffffff")
    table_even_row = _style_str(styles, "table_even_row", "tableEvenRow", default="#f8fafc")
    table_text_alignment = _style_str(styles, "table_text_alignment", "tableTextAlignment", default="left").lower()
    if table_text_alignment not in {"left", "center", "right", "justify"}:
        table_text_alignment = "left"
    link_color = _style_str(styles, "link_color", "linkColor", default=theme.primaryColor)
    page_border_enabled = _style_bool(
        styles,
        "page_border_enabled",
        "pageBorderEnabled",
        default=False,
    )
    page_border_width = _style_num(
        styles,
        "page_border_width",
        "pageBorderWidth",
        default=1.0,
    )
    page_border_color = _style_str(
        styles,
        "page_border_color",
        "pageBorderColor",
        default=theme.primaryColor,
    )
    page_border_style = _css_border_style(
        _style_str(
            styles,
            "page_border_style",
            "pageBorderStyle",
            default="single",
        )
    )
    header_align = _style_str(styles, "header_alignment", "headerAlignment", default="center").lower()
    footer_align = _style_str(styles, "footer_alignment", "footerAlignment", default="center").lower()
    header_size = _style_num(styles, "header_size", "headerSize", default=10.0)
    footer_size = _style_num(styles, "footer_size", "footerSize", default=9.0)
    header_color = _style_str(styles, "header_color", "headerColor", default=theme.primaryColor)
    footer_color = _style_str(styles, "footer_color", "footerColor", default=theme.primaryColor)
    header_font = _style_str(styles, "header_font_family", "headerFontFamily", default=theme.fontFamily)
    footer_font = _style_str(styles, "footer_font_family", "footerFontFamily", default=theme.fontFamily)
    header_separator = _style_bool(styles, "header_separator", "headerSeparator", default=False)
    footer_separator = _style_bool(styles, "footer_separator", "footerSeparator", default=False)
    header_separator_color = _style_str(
        styles,
        "header_separator_color",
        "headerSeparatorColor",
        default="#cbd5e1",
    )
    footer_separator_color = _style_str(
        styles,
        "footer_separator_color",
        "footerSeparatorColor",
        default="#cbd5e1",
    )
    border_css = (
        f"border:{max(0.5, page_border_width) * 1.333:.2f}px {page_border_style} {page_border_color};"
        if page_border_enabled
        else ""
    )

    return (
        "@page{"
        f"size:{page_size} {page_orientation};"
        f"margin:{margins.top}mm {margins.right}mm {margins.bottom}mm {margins.left}mm;"
        "}"
        ".nf-preview-root{position:relative;font-family:"
        f"{theme.fontFamily};font-size:{body_size}px;line-height:{line_height};"
        f"padding:{margins.top}mm {margins.right}mm {margins.bottom}mm {margins.left}mm;"
        f"color:{body_color};{border_css}box-sizing:border-box;min-height:100%;"
        f"--nf-bullet-base-indent:{bullet_base_indent:.3f}in;"
        f"--nf-bullet-step-indent:{bullet_indent_per_level:.3f}in;"
        f"--nf-quote-indent:{quote_indent:.3f}in;"
        f"--nf-code-indent:{code_indent:.3f}in;"
        "}"
        f"p{{margin:{paragraph_before_rem:.3f}rem 0 {paragraph_after_rem:.3f}rem 0;text-indent:{first_line_indent_em:.3f}em;text-align:{paragraph_align};}}"
        f".nf-paragraph.nf-quote{{margin-left:var(--nf-quote-indent);padding-left:0.75rem;border-left:4px solid {theme.primaryColor};font-style:italic;}}"
        ".nf-paragraph.nf-note,.nf-paragraph.nf-important,.nf-paragraph.nf-highlight,.nf-paragraph.nf-footnote,"
        ".nf-paragraph.nf-tip,.nf-paragraph.nf-warning,.nf-paragraph.nf-info,.nf-paragraph.nf-success,.nf-paragraph.nf-callout,.nf-paragraph.nf-summary"
        "{padding:0.35rem 0.65rem;border-radius:0.5rem;background:#f8fafc;}"
        ".nf-paragraph.nf-warning{background:#fef3c7;}"
        ".nf-paragraph.nf-tip{background:#e0f2fe;}"
        ".nf-paragraph.nf-info{background:#dbeafe;}"
        ".nf-paragraph.nf-success{background:#dcfce7;}"
        ".nf-paragraph.nf-callout{background:#eef2ff;}"
        ".nf-paragraph.nf-summary{background:#f1f5f9;}"
        ".nf-paragraph.nf-reference{padding-left:1rem;text-indent:-0.75rem;}"
        ".nf-caption{font-size:0.92em;color:#475569;text-align:center;font-style:italic;margin:0.15rem 0 0.75rem;}"
        ".nf-figure{margin:0.5rem 0 0.9rem;}"
        ".nf-figure img{border-radius:0.25rem;}"
        ".nf-image-missing{padding:0.75rem;border:1px dashed #94a3b8;color:#64748b;display:inline-block;}"
        f"ul.nf-list-root,ol.nf-list-root{{margin:0.4rem 0 0.8rem 0;padding-left:1.5rem;}}"
        f".nf-list-item{{font-family:{bullet_font};margin-left:calc(var(--nf-bullet-base-indent) + (var(--nf-bullet-step-indent) * var(--nf-level, 0)));}}"
        ".nf-checklist-root .nf-checklist-item{list-style:none;}"
        f"pre{{background:{code_bg};color:{code_text};padding:0.75rem;border-radius:8px;overflow:auto;margin-left:var(--nf-code-indent);font-family:{code_font};font-size:{code_font_size}px;}}"
        f".nf-equation{{background:{code_bg};color:{code_text};text-align:center;}}"
        f"code{{font-family:{code_font};font-size:{code_font_size}px;}}"
        f"table{{width:100%;border-collapse:collapse;margin:0.6rem 0;}}"
        f"th,td{{border:{table_width}px solid {table_border};padding:0.45rem;text-align:{table_text_alignment};}}"
        f"thead{{background:{table_header};color:{table_header_text};}}"
        f"tbody tr:nth-child(odd){{background:{table_odd_row};}}"
        f"tbody tr:nth-child(even){{background:{table_even_row};}}"
        f"a{{color:{link_color};}}"
        ".nf-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"
        "pointer-events:none;z-index:0;}"
        ".nf-watermark--header{align-items:flex-start;padding-top:12mm;}"
        ".nf-preview-root>*{position:relative;z-index:1;}"
        ".nf-page-break{margin:1rem 0;border-top:2px dashed #cbd5e1;height:1px;page-break-after:always;break-after:page;}"
        ".nf-separator{border:0;border-top:1px solid #cbd5e1;margin:0.9rem 0;}"
        f".nf-ascii{{background:{ascii_bg};color:{ascii_text};font-family:{ascii_font};text-align:center;white-space:pre;}}"
        f".nf-running-header{{position:fixed;top:6mm;left:0;right:0;text-align:{header_align};font-size:{header_size}px;"
        f"font-family:{header_font};color:{header_color};padding:0 8mm;"
        f"{'border-bottom:1px solid ' + header_separator_color + ';' if header_separator else ''}}}"
        f".nf-running-footer{{position:fixed;bottom:6mm;left:0;right:0;text-align:{footer_align};font-size:{footer_size}px;"
        f"font-family:{footer_font};color:{footer_color};padding:0 8mm;"
        f"{'border-top:1px solid ' + footer_separator_color + ';' if footer_separator else ''}}}"
        '.nf-page-num[data-mode="page_x"]::after{content:"Page " counter(page);}'
        '.nf-page-num[data-mode="page_x_of_y"]::after{content:"Page " counter(page) " of " counter(pages);}'
        + _heading_css(theme)
    )


def watermark_html(watermark: WatermarkPayload | None) -> str:
    if not watermark or not watermark.value:
        return ""
    if watermark.type == "text":
        font_family = escape(watermark.fontFamily or "Calibri", quote=True)
        font_size = max(18.0, float(watermark.size or 42))
        color = escape(watermark.color or "#64748B", quote=True)
        opacity = min(1.0, max(0.03, float(watermark.opacity or 0.14)))
        rotation = float(watermark.rotation if watermark.rotation is not None else -24)
        return (
            '<div class="nf-watermark" aria-hidden="true">'
            f'<span style="font-family:{font_family};font-size:{font_size:.0f}px;'
            f"font-weight:700;opacity:{opacity:.3f};transform:rotate({rotation:.0f}deg);"
            f'color:{color};">{escape(watermark.value)}</span></div>'
        )
    # For preview image watermark we trust only URL-like values and escape otherwise.
    src = escape(watermark.value, quote=True)
    opacity = min(1.0, max(0.03, float(watermark.opacity or 0.18)))
    scale = min(100.0, max(10.0, float(watermark.scale or 38.0)))
    rotation = float(watermark.rotation if watermark.rotation is not None else 0)
    return (
        '<div class="nf-watermark" aria-hidden="true">'
        f'<img src="{src}" alt="" style="max-width:{scale:.0f}%;opacity:{opacity:.3f};transform:rotate({rotation:.0f}deg);"/>'
        "</div>"
    )


def theme_to_dict(theme: ThemePayload) -> Dict[str, object]:
    return theme.model_dump()
