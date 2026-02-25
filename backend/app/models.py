from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


MAX_CONTENT_LENGTH = 500_000


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
    styles: Dict[str, str] = Field(default_factory=dict)

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


class GenerateSecurityPayload(BaseModel):
    passwordProtectPdf: Optional[str] = None
    disableEditingDocx: bool = False
    removeMetadata: bool = False
    watermark: Optional[WatermarkPayload] = None


class PreviewRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)
    theme: ThemePayload = Field(default_factory=ThemePayload)
    formattingOptions: FormattingOptions = Field(default_factory=FormattingOptions)
    security: PreviewSecurityPayload = Field(default_factory=PreviewSecurityPayload)


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

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        cleaned = "".join(ch for ch in value if ch.isalnum() or ch in ("_", "-", " "))
        cleaned = cleaned.strip().replace(" ", "_")
        return cleaned[:120] if cleaned else "notesforge_output"


class GenerateResponse(BaseModel):
    downloadUrl: str
    fileId: str


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
