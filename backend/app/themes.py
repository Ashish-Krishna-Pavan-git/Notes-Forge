from __future__ import annotations

from html import escape
from typing import Dict

from .models import FormattingOptions, ThemePayload, WatermarkPayload


PROFESSIONAL_THEME = ThemePayload(
    name="Professional",
    primaryColor="#1F3A5F",
    fontFamily="Calibri, Arial, sans-serif",
    headingStyle={
        "h1": {"size": 24, "weight": "700", "color": "#1F3A5F"},
        "h2": {"size": 20, "weight": "600"},
    },
    bodyStyle={"size": 11, "lineHeight": 1.4},
    tableStyle={"borderWidth": 1, "borderColor": "#ddd", "headerFill": "#f6f6f6"},
    margins={"top": 25, "bottom": 25, "left": 25, "right": 25},
)


def _heading_css(theme: ThemePayload) -> str:
    chunks = []
    for level in range(1, 7):
        key = f"h{level}"
        token = getattr(theme.headingStyle, key)
        size = token.size if token.size else max(12, 26 - (level * 2))
        weight = token.weight if token.weight else ("700" if level == 1 else "600")
        color = token.color if token.color else theme.primaryColor
        chunks.append(f"{key}{{font-size:{size}px;font-weight:{weight};color:{color};margin:0.8rem 0 0.4rem;}}")
    return "".join(chunks)


def css_from_theme(theme: ThemePayload, formatting: FormattingOptions) -> str:
    body_size = theme.bodyStyle.size or 11
    line_height = formatting.lineSpacing or theme.bodyStyle.lineHeight or 1.4
    margins = formatting.margins
    table_border = theme.tableStyle.borderColor or "#ddd"
    table_width = theme.tableStyle.borderWidth or 1
    table_header = theme.tableStyle.headerFill or "#f6f6f6"

    return (
        ".nf-preview-root{position:relative;font-family:"
        f"{theme.fontFamily};font-size:{body_size}px;line-height:{line_height};"
        f"padding:{margins.top}px {margins.right}px {margins.bottom}px {margins.left}px;color:#17202a;"
        "}"
        "p{margin:0.4rem 0;}"
        "ul,ol{margin:0.4rem 0 0.8rem 1.3rem;}"
        "pre{background:#0f172a;color:#e2e8f0;padding:0.75rem;border-radius:8px;overflow:auto;}"
        f"table{{width:100%;border-collapse:collapse;margin:0.6rem 0;}}"
        f"th,td{{border:{table_width}px solid {table_border};padding:0.45rem;text-align:left;}}"
        f"thead{{background:{table_header};}}"
        ".nf-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"
        "pointer-events:none;z-index:0;}"
        ".nf-watermark span{font-size:42px;font-weight:700;opacity:0.14;transform:rotate(-24deg);"
        + f"color:{theme.primaryColor};"
        + "}"
        ".nf-preview-root>*{position:relative;z-index:1;}"
        + _heading_css(theme)
    )


def watermark_html(watermark: WatermarkPayload | None) -> str:
    if not watermark or not watermark.value:
        return ""
    if watermark.type == "text":
        return (
            '<div class="nf-watermark" aria-hidden="true">'
            f"<span>{escape(watermark.value)}</span></div>"
        )
    # For preview image watermark we trust only URL-like values and escape otherwise.
    src = escape(watermark.value, quote=True)
    return (
        '<div class="nf-watermark" aria-hidden="true">'
        f'<img src="{src}" alt="" style="max-width:38%;opacity:0.18;"/>'
        "</div>"
    )


def theme_to_dict(theme: ThemePayload) -> Dict[str, object]:
    return theme.model_dump()
