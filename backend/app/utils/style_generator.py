from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

from docx.shared import Inches

from ..models import DocumentSettings
from ..themes import css_from_theme, PROFESSIONAL_THEME


@dataclass
class DocxStyleSpec:
    """
    Normalized style settings for DOCX export derived from DocumentSettings.

    This is intentionally minimal: it focuses only on layout primitives that
    must be shared across header/footer, margins, borders, and watermark. The
    exporters are responsible for applying these values using python-docx.
    """

    top_margin_in: float
    bottom_margin_in: float
    left_margin_in: float
    right_margin_in: float

    header: dict
    footer: dict
    page_border: dict
    watermark: dict

    def apply_margins(self, section) -> None:
        section.top_margin = Inches(self.top_margin_in)
        section.bottom_margin = Inches(self.bottom_margin_in)
        section.left_margin = Inches(self.left_margin_in)
        section.right_margin = Inches(self.right_margin_in)


def _normalize_hex(value: str, default: str) -> str:
    v = (value or "").strip()
    if not v:
        return default
    if not v.startswith("#"):
        v = f"#{v}"
    if len(v) != 7:
        return default
    return v


def style_generator(settings: DocumentSettings) -> Tuple[DocxStyleSpec, str]:
    """
    Generate both DOCX style spec and canonical CSS for preview/HTML/PDF.

    - DOCX style spec is a light-weight description that exporters can use
      to apply margins, header/footer text and page numbers, borders, and
      watermark consistently.
    - CSS is a full stylesheet including @page rules and running header/footer
      blocks, used by the HTML preview and HTML→PDF converters (e.g. WeasyPrint).
    """

    s = settings

    header = {
        "enabled": s.header.show,
        "text": s.header.text or "",
        "color": _normalize_hex(s.header.color, "#000000"),
        "size_pt": float(s.header.size_pt),
        "font": s.header.font or "Segoe UI",
        "alignment": s.header.alignment,
        "show_page_numbers": s.header.show_page_numbers,
        "page_format": s.header.page_format or "Page {page} of {total}",
        "page_number_style": s.header.page_number_style or "1,2,3",
        "separator": s.header.separator,
        "separator_color": _normalize_hex(s.header.separator_color, "#CCCCCC"),
    }

    footer = {
        "enabled": s.footer.show,
        "text": s.footer.text or "",
        "color": _normalize_hex(s.footer.color, "#000000"),
        "size_pt": float(s.footer.size_pt),
        "font": s.footer.font or "Segoe UI",
        "alignment": s.footer.alignment,
        "show_page_numbers": s.footer.show_page_numbers,
        "page_format": s.footer.page_format or "Page {page}",
        "page_number_style": s.footer.page_number_style or "1,2,3",
        "separator": s.footer.separator,
        "separator_color": _normalize_hex(s.footer.separator_color, "#CCCCCC"),
    }

    page_border = {
        "enabled": s.page_border.enabled,
        "style": s.page_border.style,
        "color": _normalize_hex(s.page_border.color, "#000000"),
        "width_pt": float(s.page_border.width_pt),
    }

    watermark = {
        "enabled": s.watermark.enabled,
        "text": s.watermark.text or "",
        "opacity": float(s.watermark.opacity),
        "position": s.watermark.position,
    }

    docx_spec = DocxStyleSpec(
        top_margin_in=float(s.margins.top_in),
        bottom_margin_in=float(s.margins.bottom_in),
        left_margin_in=float(s.margins.left_in),
        right_margin_in=float(s.margins.right_in),
        header=header,
        footer=footer,
        page_border=page_border,
        watermark=watermark,
    )

    # For now, derive CSS from the existing ThemePayload-based implementation,
    # but override header/footer/margins/borders using DocumentSettings so that
    # HTML preview and DOCX share the same layout primitives.
    #
    # This keeps ThemePayload backward compatible while making DocumentSettings
    # the single source of truth for layout.
    from ..models import FormattingOptions, Margins, ThemePayload

    base_theme = PROFESSIONAL_THEME.model_copy(deep=True)

    # Margins: inches → millimeters
    margins_mm = Margins(
        top=s.margins.top_in * 25.4,
        bottom=s.margins.bottom_in * 25.4,
        left=s.margins.left_in * 25.4,
        right=s.margins.right_in * 25.4,
    )

    formatting = FormattingOptions(
        margins=margins_mm,
        lineSpacing=(s.spacing.line_spacing if s.spacing else 1.4),
    )

    styles = dict(base_theme.styles or {})
    styles.update(
        {
            "page_border_enabled": s.page_border.enabled,
            "page_border_width": s.page_border.width_pt,
            "page_border_color": s.page_border.color,
            "page_border_style": s.page_border.style,
            "header_size": s.header.size_pt,
            "header_color": s.header.color,
            "header_font_family": s.header.font,
            "header_alignment": s.header.alignment,
            "header_separator": s.header.separator,
            "header_separator_color": s.header.separator_color,
            "header_show_page_numbers": s.header.show_page_numbers,
            "footer_size": s.footer.size_pt,
            "footer_color": s.footer.color,
            "footer_font_family": s.footer.font,
            "footer_alignment": s.footer.alignment,
            "footer_separator": s.footer.separator,
            "footer_separator_color": s.footer.separator_color,
            "footer_show_page_numbers": s.footer.show_page_numbers,
        }
    )

    theme_for_css = ThemePayload(**{**base_theme.model_dump(), "styles": styles})
    css = css_from_theme(theme_for_css, formatting)

    return docx_spec, css

