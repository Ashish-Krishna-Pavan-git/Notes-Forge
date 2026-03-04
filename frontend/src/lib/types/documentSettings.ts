export type HeaderAlignment = "left" | "center" | "right";

export interface HeaderSettings {
  show: boolean;
  text: string;
  color: string;
  size_pt: number;
  font: string;
  alignment: HeaderAlignment;
  show_page_numbers: boolean;
  page_format: string;
  page_number_style: "1,2,3" | "i,ii,iii" | "I,II,III" | "a,b,c" | "A,B,C";
  separator: boolean;
  separator_color: string;
}

export interface FooterSettings {
  show: boolean;
  text: string;
  color: string;
  size_pt: number;
  font: string;
  alignment: HeaderAlignment;
  show_page_numbers: boolean;
  page_format: string;
  page_number_style: "1,2,3" | "i,ii,iii" | "I,II,III" | "a,b,c" | "A,B,C";
  separator: boolean;
  separator_color: string;
}

export type WatermarkPosition = "center" | "header";

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
  position: WatermarkPosition;
}

export interface MarginSettings {
  top_in: number;
  bottom_in: number;
  left_in: number;
  right_in: number;
}

export type PageBorderStyle = "single" | "double" | "dashed" | "dotted" | "thick";

export interface PageBorderSettings {
  enabled: boolean;
  style: PageBorderStyle;
  color: string;
  width_pt: number;
}

export type PageSize = "A4" | "A3" | "LETTER" | "LEGAL";
export type PageOrientation = "portrait" | "landscape";

export interface PageSettings {
  size: PageSize;
  orientation: PageOrientation;
}

export interface FontFamilySettings {
  body?: string;
  code?: string;
  header?: string;
  footer?: string;
  h1?: string;
  h2?: string;
  h3?: string;
  h4?: string;
  h5?: string;
  h6?: string;
}

export interface SpacingSettings {
  line_spacing?: number;
  paragraph_spacing_after_pt?: number;
  heading_spacing_before_pt?: number;
  heading_spacing_after_pt?: number;
}

export interface DocumentSettings {
  theme: string;
  header: HeaderSettings;
  footer: FooterSettings;
  watermark: WatermarkSettings;
  margins: MarginSettings;
  page_border: PageBorderSettings;
  page: PageSettings;
  fonts?: FontFamilySettings;
  spacing?: SpacingSettings;
}

// Canonical sample used for tests and debug tooling.
export const CANONICAL_SAMPLE_DOCUMENT_SETTINGS: DocumentSettings = {
  theme: "FLM",
  header: {
    show: true,
    text: "Frontlines Edu Tech",
    color: "#ff4000",
    size_pt: 10,
    font: "Segoe UI",
    alignment: "center",
    show_page_numbers: true,
    page_format: "Page {page} of {total}",
    page_number_style: "1,2,3",
    separator: true,
    separator_color: "#CCCCCC",
  },
  footer: {
    show: true,
    text: "© 2026 NotesForge",
    color: "#2C5282",
    size_pt: 8,
    font: "Segoe UI",
    alignment: "center",
    show_page_numbers: true,
    page_format: "| Page {page}",
    page_number_style: "1,2,3",
    separator: true,
    separator_color: "#CCCCCC",
  },
  watermark: {
    enabled: true,
    text: "NotesForge PRO",
    opacity: 0.08,
    position: "center",
  },
  margins: {
    top_in: 1.0,
    bottom_in: 1.0,
    left_in: 1.0,
    right_in: 1.0,
  },
  page_border: {
    enabled: true,
    style: "single",
    color: "#000000",
    width_pt: 1,
  },
  page: {
    size: "A4",
    orientation: "portrait",
  },
  fonts: {
    body: "Segoe UI",
    code: "Fira Code",
    header: "Segoe UI",
    footer: "Segoe UI",
    h1: "Segoe UI",
    h2: "Segoe UI",
    h3: "Segoe UI",
  },
  spacing: {
    line_spacing: 1.6,
    paragraph_spacing_after_pt: 8,
    heading_spacing_before_pt: 14,
    heading_spacing_after_pt: 8,
  },
};

