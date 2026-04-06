from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

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
    size: Optional[int] = 12
    lineHeight: Optional[float] = 1.5

    @field_validator("lineHeight", mode="before")
    @classmethod
    def normalize_line_height(cls, value: Any) -> Optional[float]:
        if value is None:
            return value
        try:
            candidate = float(value)
        except (TypeError, ValueError):
            return 1.5
        return max(1.0, min(3.0, round(candidate, 2)))


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
    fontFamily: str = "Times New Roman, Georgia, serif"
    headingStyle: HeadingStyle = Field(default_factory=HeadingStyle)
    bodyStyle: BodyStyle = Field(default_factory=BodyStyle)
    tableStyle: TableStyle = Field(default_factory=TableStyle)
    margins: Margins = Field(default_factory=Margins)
    styles: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class FormattingOptions(BaseModel):
    margins: Margins = Field(default_factory=Margins)
    lineSpacing: float = 1.5

    @field_validator("lineSpacing", mode="before")
    @classmethod
    def normalize_line_spacing(cls, value: Any) -> float:
        try:
            candidate = float(value)
        except (TypeError, ValueError):
            candidate = 1.5
        return max(1.0, min(3.0, round(candidate, 2)))


class PreviewSecurityPayload(BaseModel):
    removeMetadata: bool = False
    pageNumberMode: Optional[Literal["page_x", "page_x_of_y"]] = None
    headerText: Optional[str] = None
    footerText: Optional[str] = None


class GenerateSecurityPayload(BaseModel):
    passwordProtectPdf: Optional[str] = None
    disableEditingDocx: bool = False
    removeMetadata: bool = False
    pageNumberMode: Optional[Literal["page_x", "page_x_of_y"]] = None
    headerText: Optional[str] = None
    footerText: Optional[str] = None


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
    success: bool = True
    downloadUrl: str
    fileId: str
    filename: Optional[str] = None
    requestedFormat: Optional[str] = None
    actualFormat: Optional[str] = None
    conversionEngine: Optional[str] = None
    externalFallbackUsed: bool = False
    warning: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


class AsyncGenerateResponse(BaseModel):
    success: bool = True
    jobId: str
    status: Literal["queued", "running", "completed", "failed"] = "queued"
    progress: int = 0


class GenerateJobStatusResponse(BaseModel):
    success: bool = True
    jobId: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: int = 0
    requestedFormat: Optional[str] = None
    actualFormat: Optional[str] = None
    conversionEngine: Optional[str] = None
    externalFallbackUsed: bool = False
    fileId: Optional[str] = None
    filename: Optional[str] = None
    downloadUrl: Optional[str] = None
    warning: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    createdAt: int
    updatedAt: int


class ProcessingRecentFile(BaseModel):
    name: str
    format: Literal["pdf", "docx"]
    sizeBytes: int
    modifiedAt: int
    directoryKey: str


class ProcessingDirectory(BaseModel):
    key: str
    label: str
    path: str
    readable: bool
    autoDetected: bool = True
    recentFiles: List[ProcessingRecentFile] = Field(default_factory=list)


class ProcessingContextResponse(BaseModel):
    runtimeTarget: str
    platform: str
    currentWorkingDirectory: str
    downloadDirectory: Optional[str] = None
    outputDirectory: Optional[str] = None
    serverFileDiscoveryEnabled: bool
    browserUploadEnabled: bool = True
    pdfConversionReady: bool = False
    docxConversionReady: bool = False
    editorPdfExportReady: bool = False
    preferredPdfProvider: str = "local"
    pdfStatusNote: str = ""
    directories: List[ProcessingDirectory] = Field(default_factory=list)
    markerTemplateExample: str
    notes: List[str] = Field(default_factory=list)


class ProcessingConversionResponse(BaseModel):
    success: bool = True
    downloadUrl: str
    fileId: str
    filename: str
    sourceFormat: Literal["pdf", "docx"]
    targetFormat: Literal["pdf", "docx"]
    actualFormat: Literal["pdf", "docx"]
    conversionEngine: str
    providerUsed: str
    externalFallbackUsed: bool = False
    warnings: List[str] = Field(default_factory=list)


class TemplateDefinition(BaseModel):
    id: str
    name: str
    description: str
    defaultTheme: ThemePayload
    sampleContent: str
    aiPromptTemplate: str
    layout: Dict[str, Any] = Field(default_factory=dict)
    guideSteps: List[str] = Field(default_factory=list)


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
