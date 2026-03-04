from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


MAX_CONTENT_LENGTH = 500_000


class HeaderSettings(BaseModel):
  show: bool = True
  text: str = ""
  color: str = "#000000"
  size_pt: int = 10
  font: str = "Segoe UI"
  alignment: Literal["left", "center", "right"] = "center"
  show_page_numbers: bool = True
  page_format: str = "Page {page} of {total}"
  page_number_style: str = "1,2,3"
  separator: bool = True
  separator_color: str = "#CCCCCC"


class FooterSettings(BaseModel):
  show: bool = True
  text: str = ""
  color: str = "#000000"
  size_pt: int = 8
  font: str = "Segoe UI"
  alignment: Literal["left", "center", "right"] = "center"
  show_page_numbers: bool = True
  page_format: str = "Page {page}"
  page_number_style: str = "1,2,3"
  separator: bool = True
  separator_color: str = "#CCCCCC"


class WatermarkSettings(BaseModel):
  enabled: bool = False
  text: str = ""
  opacity: float = 0.1
  position: Literal["center", "header"] = "center"

  @field_validator("opacity")
  @classmethod
  def clamp_opacity(cls, value: float) -> float:
      return max(0.0, min(1.0, float(value)))


class MarginSettings(BaseModel):
  top_in: float = 1.0
  bottom_in: float = 1.0
  left_in: float = 1.0
  right_in: float = 1.0


class PageBorderSettings(BaseModel):
  enabled: bool = False
  style: Literal["single", "double", "dashed", "dotted", "thick"] = "single"
  color: str = "#000000"
  width_pt: float = 1.0


class PageSettings(BaseModel):
  size: Literal["A4", "A3", "LETTER", "LEGAL"] = "A4"
  orientation: Literal["portrait", "landscape"] = "portrait"


class FontFamilySettings(BaseModel):
  body: str | None = None
  code: str | None = None
  header: str | None = None
  footer: str | None = None
  h1: str | None = None
  h2: str | None = None
  h3: str | None = None
  h4: str | None = None
  h5: str | None = None
  h6: str | None = None


class SpacingSettings(BaseModel):
  line_spacing: float | None = 1.4
  paragraph_spacing_after_pt: float | None = 6.0
  heading_spacing_before_pt: float | None = 12.0
  heading_spacing_after_pt: float | None = 6.0


class DocumentSettings(BaseModel):
  """
  Canonical document settings shared across HTML preview, DOCX, and PDF.

  This model mirrors backend/config/document_schema.json and is intended to be
  the single source of truth for visual layout decisions (headers, footers,
  margins, borders, watermarks, and fonts).
  """

  theme: str = "professional"
  header: HeaderSettings = Field(default_factory=HeaderSettings)
  footer: FooterSettings = Field(default_factory=FooterSettings)
  watermark: WatermarkSettings = Field(default_factory=WatermarkSettings)
  margins: MarginSettings = Field(default_factory=MarginSettings)
  page_border: PageBorderSettings = Field(default_factory=PageBorderSettings)
  page: PageSettings = Field(default_factory=PageSettings)
  fonts: FontFamilySettings | None = None
  spacing: SpacingSettings | None = None

  model_config = ConfigDict(extra="forbid")


class HeadingTokenStyle(BaseModel):
    size: Optional[int] = None
    weight: Optional[str] = None
    color: Optional[str] = None


class HeadingStyle(BaseModel):
    h1: HeadingTokenStyle = Field(default_factory=HeadingTokenStyle)
    h2: HeadingTokenStyle = Field(default_factory=HeadingTokenStyle)
    h3: HeadingTokenStyle = Field(default_factory=HeadingTokenStyle)
    h4: HeadingTokenStyle = Field(default_factory=HeadingTokenStyle)
    h5: HeadingTokenStyle = Field(default_factory=HeadingTokenStyle)
    h6: HeadingTokenStyle = Field(default_factory=HeadingTokenStyle)


class BodyStyle(BaseModel):
    size: Optional[int] = 11
    lineHeight: Optional[float] = 1.4


class TableStyle(BaseModel):
    borderWidth: Optional[int] = 1
    borderColor: Optional[str] = "#ddd"
    headerFill: Optional[str] = "#f6f6f6"


class Margins(BaseModel):
    top: float = 25
    bottom: float = 25
    left: float = 25
    right: float = 25


class ThemePayload(BaseModel):
    name: str = "Professional"
    primaryColor: str = "#1F3A5F"
    fontFamily: str = "Calibri, Arial, sans-serif"
    headingStyle: HeadingStyle = Field(default_factory=HeadingStyle)
    bodyStyle: BodyStyle = Field(default_factory=BodyStyle)
    tableStyle: TableStyle = Field(default_factory=TableStyle)
    margins: Margins = Field(default_factory=Margins)
    styles: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class FormattingOptions(BaseModel):
    margins: Margins = Field(default_factory=Margins)
    lineSpacing: float = 1.4


class WatermarkPayload(BaseModel):
    type: Literal["text", "image"] = "text"
    value: str = ""
    position: Literal["center", "header"] = "center"


class PreviewSecurityPayload(BaseModel):
    removeMetadata: bool = False
    watermark: Optional[WatermarkPayload] = None
    pageNumberMode: Optional[Literal["page_x", "page_x_of_y"]] = None
    headerText: Optional[str] = None
    footerText: Optional[str] = None


class GenerateSecurityPayload(BaseModel):
    passwordProtectPdf: Optional[str] = None
    disableEditingDocx: bool = False
    removeMetadata: bool = False
    watermark: Optional[WatermarkPayload] = None
    pageNumberMode: Optional[Literal["page_x", "page_x_of_y"]] = None
    headerText: Optional[str] = None
    footerText: Optional[str] = None


class PreviewRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)
    theme: ThemePayload = Field(default_factory=ThemePayload)
    formattingOptions: FormattingOptions = Field(default_factory=FormattingOptions)
    security: PreviewSecurityPayload = Field(default_factory=PreviewSecurityPayload)
    documentSettings: DocumentSettings | None = Field(
        default=None,
        description="Canonical document settings; when provided, this becomes the source of truth for header/footer/margins/borders/watermark.",
    )


class StructureSummary(BaseModel):
    wordCount: int
    headingCount: int
    readingTimeMinutes: float


class PreviewResponse(BaseModel):
    previewHtml: str
    warnings: List[str]
    structure: StructureSummary


class GenerateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)
    theme: ThemePayload = Field(default_factory=ThemePayload)
    format: Literal["docx", "pdf", "html", "md", "txt"] = "docx"
    filename: str = "notesforge_output"
    security: GenerateSecurityPayload = Field(default_factory=GenerateSecurityPayload)
    templateId: Optional[str] = None
    documentSettings: DocumentSettings | None = Field(
        default=None,
        description="Canonical document settings; when provided, used for header/footer/margins/border/watermark across exporters.",
    )

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        cleaned = "".join(ch for ch in value if ch.isalnum() or ch in ("_", "-", " "))
        cleaned = cleaned.strip().replace(" ", "_")
        return cleaned[:120] if cleaned else "notesforge_output"


class GenerateResponse(BaseModel):
    success: bool = True
    downloadUrl: str
    fileId: str
    filename: Optional[str] = None
    requestedFormat: Optional[str] = None
    actualFormat: Optional[str] = None
    warning: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


class TemplateDefinition(BaseModel):
    id: str
    name: str
    description: str
    defaultTheme: ThemePayload
    sampleContent: str
    aiPromptTemplate: str


class RegenerateTemplateRequest(BaseModel):
    templateId: str
    topic: str = Field(..., min_length=1, max_length=200)
    aiProvider: Optional[Literal["chatgpt", "notebooklm", "claude"]] = None


class RegenerateTemplateResponse(BaseModel):
    content: str
    prompt: str


class CreateThemeRequest(BaseModel):
    name: str
    primaryColor: str
    fontFamily: str
    styles: Dict[str, str] = Field(default_factory=dict)


class CreateThemeResponse(BaseModel):
    themeId: str


class ParserHealthResponse(BaseModel):
    parser: str
    version: str
