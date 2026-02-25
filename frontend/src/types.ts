export type ExportFormat = "docx" | "pdf" | "html" | "md" | "txt";
export type AiProvider = "chatgpt" | "notebooklm" | "claude";
export type WatermarkType = "text" | "image";
export type WatermarkPosition = "center" | "header";

export interface HeadingTokenStyle {
  size?: number;
  weight?: string;
  color?: string;
}

export interface Theme {
  name: string;
  primaryColor: string;
  fontFamily: string;
  headingStyle: {
    h1?: HeadingTokenStyle;
    h2?: HeadingTokenStyle;
    h3?: HeadingTokenStyle;
    h4?: HeadingTokenStyle;
    h5?: HeadingTokenStyle;
    h6?: HeadingTokenStyle;
  };
  bodyStyle: {
    size?: number;
    lineHeight?: number;
  };
  tableStyle?: {
    borderWidth?: number;
    borderColor?: string;
    headerFill?: string;
  };
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  styles?: Record<string, string>;
}

export interface FormattingOptions {
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  lineSpacing: number;
}

export interface Watermark {
  type: WatermarkType;
  value: string;
  position: WatermarkPosition;
}

export interface PreviewRequest {
  content: string;
  theme: Theme;
  formattingOptions: FormattingOptions;
  security: {
    removeMetadata: boolean;
    watermark?: Watermark;
  };
}

export interface PreviewResponse {
  previewHtml: string;
  warnings: string[];
  structure: {
    wordCount: number;
    headingCount: number;
    readingTimeMinutes: number;
  };
}

export interface GenerateRequest {
  content: string;
  theme: Theme;
  format: ExportFormat;
  filename: string;
  security: {
    passwordProtectPdf?: string;
    disableEditingDocx: boolean;
    removeMetadata: boolean;
    watermark?: Watermark;
  };
  templateId?: string;
}

export interface GenerateResponse {
  downloadUrl: string;
  fileId: string;
}

export interface CreateThemeResponse {
  themeId: string;
}

export interface RegenerateTemplateResponse {
  content: string;
  prompt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  defaultTheme: Theme;
  sampleContent: string;
  aiPromptTemplate: string;
}
