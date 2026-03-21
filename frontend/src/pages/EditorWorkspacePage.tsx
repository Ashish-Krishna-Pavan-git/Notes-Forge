// App.tsx — Quick Doc Formatter v8.0.0
// Fixes: Broken JSX nesting, XSS, dynamic Tailwind, missing types,
//        performance (useMemo/useCallback), missing endpoints support

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import DOMPurify from "dompurify";
import { API, API_HEALTH_TIMEOUT_MS, HAS_EXPLICIT_API_URL } from "../config/env";
import { API_ENDPOINTS, api, apiGet, apiPost, getErrorMessage, withRetry } from "../services/api";
import {
  Sparkles,
  FileText,
  Settings,
  BookOpen,
  Download,
  Moon,
  Sun,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  Search,
  X,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  Eye,
  Type,
  Code,
  List,
  Table,
  Hash,
  AlignLeft,
  Image as Img,
  Link,
  Highlighter,
  FileSignature,
  PaintBucket,
  Ruler,
  Layout,
  Palette,
  Clock,
  Plus,
  Trash2,
  Copy,
  Check,
  Bot,
  Pencil,
  Keyboard,
  Upload,
  Folder,
  Monitor,
  AlertTriangle,
  ImagePlus,
  Music2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const AUTOSAVE_MS = 30_000;
const ANALYZE_DEBOUNCE_MS = 600;
const HEALTH_INTERVAL_MS = 30_000;
const MAX_HISTORY = 100;
const MAX_DRAFTS = 10;
const MAX_RECENT_EXPORTS = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const LARGE_DOC_ASYNC_LINE_THRESHOLD = 100_000;
const ASYNC_POLL_INTERVAL_MS = 1000;
const ASYNC_POLL_MAX_ATTEMPTS = 900;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface ClassRow {
  line_number: number;
  original: string;
  type: string;
  content: string;
  marker?: string;
  indent_level?: number;
}

interface AnalysisResult {
  success: boolean;
  total_lines: number;
  statistics: Record<string, number>;
  classifications: ClassRow[];
  preview: ClassRow[];
}

interface ThemeInfo {
  name: string;
  description: string;
  user_created?: boolean;
  builtin?: boolean;
  colors?: Record<string, string>;
  fonts?: Partial<FontsConfig>;
  spacing?: Record<string, number>;
}

interface MarkerError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

interface SavedDraft {
  id: string;
  name: string;
  content: string;
  savedAt: number;
}

interface RecentExport {
  id: string;
  filename: string;
  download_url: string;
  format: ExportFormat;
  createdAt: number;
  warning?: string;
}

interface ApiTemplate {
  id: string;
  name: string;
  description: string;
  defaultTheme?: Record<string, unknown>;
  sampleContent: string;
  aiPromptTemplate: string;
  category?: string;
  icon?: string;
  builtin?: boolean;
}

interface TemplateCard {
  id: string;
  name: string;
  category: string;
  icon: string;
  content: string;
  description?: string;
  aiPromptTemplate?: string;
}

type TabId =
  | "editor"
  | "templates"
  | "settings"
  | "prompt"
  | "guide"
  | "shortcuts";
type EditorWorkspacePageProps = {
  initialTab?: TabId;
};
type SettingsTabId =
  | "themes"
  | "fonts"
  | "colors"
  | "spacing"
  | "page"
  | "experience";
type ConnectionStatus = "checking" | "waking" | "online" | "error";
type ExportFormat = "docx" | "pdf" | "md" | "html" | "txt";

interface FontsConfig {
  family?: string;
  family_code?: string;
  h1_family?: string;
  h2_family?: string;
  h3_family?: string;
  h4_family?: string;
  h5_family?: string;
  h6_family?: string;
  bullet_family?: string;
  families?: Record<string, string>;
  available_fonts?: string[];
  available_code_fonts?: string[];
  sizes?: Record<string, number>;
}

interface HeaderFooterConfig {
  enabled?: boolean;
  text?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: string;
  position?: string;
  font_family?: string;
  show_page_numbers?: boolean;
  page_number_style?: string;
  separator?: boolean;
  separator_color?: string;
  title_enabled?: boolean;
  title_position?: string;
  title_alignment?: string;
  page_number_position?: string;
  page_number_alignment?: string;
  page_format?: string;
}

interface WatermarkConfig {
  enabled?: boolean;
  type?: string;
  text?: string;
  size?: number;
  color?: string;
  opacity?: number;
  rotation?: number;
  image_path?: string;
  image_data?: string;
  scale?: number;
  placement?: string;
  position?: string;
  font?: string;
}

interface PageConfig {
  size?: string;
  orientation?: string;
  margins?: Record<string, number>;
  border?: {
    enabled?: boolean;
    width?: number;
    style?: string;
    color?: string;
    offset?: number;
  };
  border_enabled?: boolean;
  border_width?: number;
  border_style?: string;
  border_color?: string;
  border_offset?: number;
}

interface AppConfigState {
  app?: { name?: string; version?: string; theme?: string };
  app_ui?: {
    theme?: string;
    mode?: string;
    music?: {
      enabled?: boolean;
      volume?: number;
      playlist_mode?: string;
      autoplay?: boolean;
    };
  };
  fonts: FontsConfig;
  header: HeaderFooterConfig;
  footer: HeaderFooterConfig;
  page: PageConfig;
  colors: Record<string, string>;
  spacing: Record<string, number>;
  watermark?: WatermarkConfig;
  titlePlacement?: string;
  pageNumberPlacement?: string;
}

interface MarkerCatalogEntry {
  key: string;
  aliases?: string[];
  category?: string;
  syntax?: string;
  example?: string;
  description?: string;
  payloadRules?: string;
}

interface MusicTrack {
  title: string;
  file: string;
  sourceType?: "local" | "url";
  artist?: string;
  duration?: string;
}

type MusicManifest = Partial<
  Record<
    ModeName,
    Array<
      | string
      | {
          title?: string;
          file?: string;
          url?: string;
          link?: string;
          artist?: string;
          duration?: string;
        }
    >
  >
>;

type ModeName =
  | "smooth"
  | "calming"
  | "energetic"
  | "gaming"
  | "vibing"
  | "focus";

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & MAPS
// ═══════════════════════════════════════════════════════════════════

const FALLBACK_MARKERS = [
  "HEADING", "H1", "SUBHEADING", "H2", "SUB-SUBHEADING", "H3",
  "H4", "H5", "H6", "PARAGRAPH", "PARA", "BULLET", "NUMBERED",
  "CHECKLIST", "TASK", "TODO",
  "CODE", "EQUATION", "TABLE", "TABLE_CAPTION", "QUOTE", "NOTE", "IMPORTANT",
  "TIP", "WARNING", "INFO", "SUCCESS", "CALLOUT", "SUMMARY",
  "IMAGE", "FIGURE", "FIGURE_CAPTION", "LINK", "HIGHLIGHT", "FOOTNOTE",
  "TOC", "LIST_OF_TABLES", "LIST_OF_FIGURES", "ASCII", "DIAGRAM", "LABEL",
  "CENTER", "RIGHT", "JUSTIFY", "WATERMARK", "PAGEBREAK", "PAGE_BREAK", "SEPARATOR", "HR", "HORIZONTAL_RULE",
  "COVER_PAGE", "CERTIFICATE_PAGE", "DECLARATION_PAGE", "ACKNOWLEDGEMENT_PAGE",
  "ABSTRACT_PAGE", "CHAPTER", "REFERENCES", "REFERENCE", "APPENDIX",
] as const;

const FALLBACK_MARKER_CATALOG: MarkerCatalogEntry[] = FALLBACK_MARKERS.map(
  (marker) => ({
    key: marker,
    category: "general",
    syntax: `${marker}: value`,
    example: `${marker}: "Sample"`,
    description: `${marker} marker`,
    payloadRules: "Marker-prefixed line.",
    aliases: [],
  })
);

const MARKER_AUTOCOMPLETE = FALLBACK_MARKERS.map((marker) => `${marker}:`);

const PIPE_REQUIRED_MARKERS = new Set(["IMAGE", "FIGURE", "LINK", "HIGHLIGHT"]);

const TYPE_COLOR: Record<string, string> = {
  h1: "bg-orange-500", h2: "bg-amber-500", h3: "bg-blue-600",
  h4: "bg-blue-500", h5: "bg-indigo-500", h6: "bg-purple-500",
  paragraph: "bg-gray-500", bullet: "bg-purple-600",
  numbered: "bg-purple-500", checklist: "bg-fuchsia-600",
  code: "bg-slate-700", equation: "bg-slate-600", table: "bg-teal-600",
  quote: "bg-yellow-600", note: "bg-green-600", warning: "bg-amber-600", info: "bg-blue-600", success: "bg-emerald-600", image: "bg-pink-600",
  link: "bg-sky-600", highlight: "bg-yellow-500", footnote: "bg-gray-600",
  toc: "bg-orange-600", ascii: "bg-rose-600", separator: "bg-gray-400",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  h1: <Hash className="w-3 h-3" />,
  h2: <Hash className="w-3 h-3" />,
  h3: <Hash className="w-3 h-3" />,
  paragraph: <AlignLeft className="w-3 h-3" />,
  bullet: <List className="w-3 h-3" />,
  checklist: <CheckCircle className="w-3 h-3" />,
  code: <Code className="w-3 h-3" />,
  equation: <Code className="w-3 h-3" />,
  table: <Table className="w-3 h-3" />,
  image: <Img className="w-3 h-3" />,
  link: <Link className="w-3 h-3" />,
  highlight: <Highlighter className="w-3 h-3" />,
  footnote: <FileSignature className="w-3 h-3" />,
  toc: <BookOpen className="w-3 h-3" />,
};

// Fixed: Tailwind cannot compile dynamic class names like `bg-${x}-50`
// Use a static lookup map instead
const ALERT_STYLES: Record<string, string> = {
  red:
    "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-300",
  green:
    "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 text-green-700 dark:text-green-300",
  yellow:
    "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
};

const MARKER_BUTTON_STYLES: Record<string, string> = {
  orange:
    "hover:bg-orange-50 dark:hover:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
  gray:
    "hover:bg-gray-50 dark:hover:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300",
  purple:
    "hover:bg-purple-50 dark:hover:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
  slate:
    "hover:bg-slate-50 dark:hover:bg-slate-900/20 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300",
  teal:
    "hover:bg-teal-50 dark:hover:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300",
  green:
    "hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
};

const CATEGORY_BADGE: Record<string, string> = {
  Business:
    "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
  Academic:
    "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  default:
    "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300",
};

const BUILTIN_THEME_KEYS = new Set([
  "professional",
  "modern",
  "minimal",
  "academic",
  "corporate",
  "creative",
  "startup",
  "executive",
  "oceanic",
  "monochrome",
  "frontlines_edutech_theme",
  "academic_classic",
  "university_blue",
  "engineering_report",
  "clean_research",
  "modern_minimal",
  "corporate_white",
  "dark_technical",
  "elegant_thesis",
  "lecture_notes",
  "professional_docs",
]);

const FALLBACK_THEME_CATALOG: Record<string, ThemeInfo> = {
  professional: {
    name: "Professional",
    description: "Balanced default for business and academic documents.",
    builtin: true,
    colors: {
      h1: "#1F3A5F",
      h2: "#2C5282",
      h3: "#2B6CB0",
      table_header_bg: "#E2E8F0",
    },
    fonts: { family: "Calibri" },
    spacing: { line_spacing: 1.5 },
  },
  modern: {
    name: "Modern",
    description: "Clean modern styling with blue accents.",
    builtin: true,
    colors: {
      h1: "#0F172A",
      h2: "#1D4ED8",
      h3: "#0284C7",
      table_header_bg: "#DBEAFE",
    },
    fonts: { family: "Segoe UI" },
    spacing: { line_spacing: 1.35 },
  },
  academic: {
    name: "Academic",
    description: "Conservative typography optimized for reports.",
    builtin: true,
    colors: {
      h1: "#111827",
      h2: "#374151",
      h3: "#4B5563",
      table_header_bg: "#E5E7EB",
    },
    fonts: { family: "Times New Roman" },
    spacing: { line_spacing: 1.6 },
  },
  corporate: {
    name: "Corporate Red",
    description: "Executive style with strong heading contrast.",
    builtin: true,
    colors: {
      h1: "#B91C1C",
      h2: "#DC2626",
      h3: "#EF4444",
      table_header_bg: "#FEE2E2",
    },
    fonts: { family: "Arial" },
    spacing: { line_spacing: 1.35 },
  },
  creative: {
    name: "Creative Vibrant",
    description: "Colorful theme for creative project documents.",
    builtin: true,
    colors: {
      h1: "#F97316",
      h2: "#F59E0B",
      h3: "#EC4899",
      table_header_bg: "#FEF3C7",
    },
    fonts: { family: "Candara" },
    spacing: { line_spacing: 1.35 },
  },
  startup: {
    name: "Startup Pitch",
    description: "Pitch-deck-like style for startup notes.",
    builtin: true,
    colors: {
      h1: "#0E7490",
      h2: "#0284C7",
      h3: "#0369A1",
      table_header_bg: "#CFFAFE",
    },
    fonts: { family: "Calibri" },
    spacing: { line_spacing: 1.3 },
  },
  executive: {
    name: "Executive Slate",
    description: "High-contrast executive style with formal spacing.",
    builtin: true,
    colors: {
      h1: "#0F172A",
      h2: "#1E293B",
      h3: "#334155",
      table_header_bg: "#E2E8F0",
      table_header_text: "#0F172A",
    },
    fonts: { family: "Georgia" },
    spacing: { line_spacing: 1.5 },
  },
  oceanic: {
    name: "Oceanic Teal",
    description: "Cool teal palette for technical and product docs.",
    builtin: true,
    colors: {
      h1: "#0F766E",
      h2: "#0D9488",
      h3: "#14B8A6",
      table_header_bg: "#CCFBF1",
      table_header_text: "#134E4A",
    },
    fonts: { family: "Segoe UI" },
    spacing: { line_spacing: 1.35 },
  },
  monochrome: {
    name: "Monochrome",
    description: "Clean black-and-gray style for print-heavy workflows.",
    builtin: true,
    colors: {
      h1: "#111827",
      h2: "#1F2937",
      h3: "#374151",
      table_header_bg: "#E5E7EB",
      table_header_text: "#111827",
    },
    fonts: { family: "Arial" },
    spacing: { line_spacing: 1.5 },
  },
  frontlines_edutech_theme: {
    name: "Daily Notes Maker",
    description:
      "Times New Roman theme with purple-orange styling, headers, footer, border and watermark.",
    builtin: true,
    colors: {
      h1: "#6A00F4",
      h2: "#7B2CBF",
      h3: "#9D4EDD",
      h4: "#B5179E",
      h5: "#7209B7",
      h6: "#560BAD",
      table_header_bg: "#F77F00",
      table_header_text: "#FFFFFF",
      table_odd_row: "#FFF4E6",
      table_even_row: "#FFE5B4",
      code_background: "#1E1B2E",
      code_text: "#FFFFFF",
      link: "#6A00F4",
    },
    fonts: {
      family: "Times New Roman",
      family_code: "JetBrains Mono",
      h1_family: "Times New Roman",
      h2_family: "Times New Roman",
      h3_family: "Times New Roman",
      h4_family: "Times New Roman",
      h5_family: "Times New Roman",
      h6_family: "Times New Roman",
      bullet_family: "Times New Roman",
      sizes: {
        h1: 20,
        h2: 18,
        h3: 16,
        h4: 14,
        h5: 12,
        h6: 12,
        body: 12,
        code: 11,
        header: 10,
        footer: 10,
      },
    },
    spacing: {
      line_spacing: 1.5,
      paragraph_spacing_after: 14,
      heading_spacing_before: 14,
      heading_spacing_after: 8,
      bullet_base_indent: 0.5,
      bullet_indent_per_level: 0.75,
      code_indent: 0.35,
      quote_indent: 0.5,
    },
  },
  academic_classic: {
    name: "Academic Classic",
    description: "Formal academic style with serif typography.",
    builtin: true,
    colors: { h1: "#1F3A5F", h2: "#2F4F7F", h3: "#3D5A80", table_header_bg: "#E2E8F0" },
    fonts: { family: "Times New Roman", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.5 },
  },
  university_blue: {
    name: "University Blue",
    description: "Institutional blue palette for reports.",
    builtin: true,
    colors: { h1: "#0B3D91", h2: "#1E5AA8", h3: "#2F6BC5", table_header_bg: "#DCEBFF" },
    fonts: { family: "Times New Roman", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.5 },
  },
  engineering_report: {
    name: "Engineering Report",
    description: "Structured technical style with clean contrast.",
    builtin: true,
    colors: { h1: "#0F172A", h2: "#1F2937", h3: "#334155", table_header_bg: "#E2E8F0" },
    fonts: { family: "Inter", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.15 },
  },
  clean_research: {
    name: "Clean Research",
    description: "Lightweight manuscript style for research notes.",
    builtin: true,
    colors: { h1: "#111827", h2: "#1F2937", h3: "#374151", table_header_bg: "#F3F4F6" },
    fonts: { family: "Times New Roman", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.5 },
  },
  modern_minimal: {
    name: "Modern Minimal",
    description: "Minimal style with modern contrast.",
    builtin: true,
    colors: { h1: "#111827", h2: "#2563EB", h3: "#3B82F6", table_header_bg: "#EFF6FF" },
    fonts: { family: "Inter", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.15 },
  },
  corporate_white: {
    name: "Corporate White",
    description: "White-paper corporate document style.",
    builtin: true,
    colors: { h1: "#0F172A", h2: "#1E293B", h3: "#334155", table_header_bg: "#F8FAFC" },
    fonts: { family: "Georgia", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.5 },
  },
  dark_technical: {
    name: "Dark Technical",
    description: "Dark-accent technical docs with readable contrast.",
    builtin: true,
    colors: {
      h1: "#0EA5E9",
      h2: "#38BDF8",
      h3: "#7DD3FC",
      body: "#E2E8F0",
      code_background: "#0B1220",
      code_text: "#E2E8F0",
      table_header_bg: "#0F172A",
      table_header_text: "#E2E8F0",
    },
    fonts: { family: "Roboto", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.15 },
  },
  elegant_thesis: {
    name: "Elegant Thesis",
    description: "Elegant thesis style with generous spacing.",
    builtin: true,
    colors: { h1: "#4A2C2A", h2: "#6B3F3A", h3: "#8A5148", table_header_bg: "#F5EDE9" },
    fonts: { family: "Georgia", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 2 },
  },
  lecture_notes: {
    name: "Lecture Notes",
    description: "Readable notes style for classroom usage.",
    builtin: true,
    colors: { h1: "#1D4ED8", h2: "#2563EB", h3: "#3B82F6", table_header_bg: "#DBEAFE" },
    fonts: { family: "Roboto", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.15 },
  },
  professional_docs: {
    name: "Professional Docs",
    description: "Balanced professional documentation style.",
    builtin: true,
    colors: { h1: "#1F3A5F", h2: "#345995", h3: "#4A6FA5", table_header_bg: "#E2E8F0" },
    fonts: { family: "Times New Roman", family_code: "JetBrains Mono" },
    spacing: { line_spacing: 1.5 },
  },
};

const APP_UI_THEMES = {
  aurora: {
    name: "Aurora Flow",
    rootLight: "bg-[radial-gradient(circle_at_20%_0%,#dbeafe_0%,#f8fafc_42%,#fdf2f8_100%)]",
    rootDark: "bg-[radial-gradient(circle_at_20%_0%,#0f172a_0%,#111827_48%,#1f2937_100%)]",
    headerLight: "bg-gradient-to-r from-sky-600 via-cyan-600 to-blue-700",
    headerDark: "bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950",
  },
  ember: {
    name: "Ember Studio",
    rootLight: "bg-[radial-gradient(circle_at_15%_10%,#ffedd5_0%,#fef9c3_42%,#fff7ed_100%)]",
    rootDark: "bg-[radial-gradient(circle_at_15%_10%,#292524_0%,#1c1917_55%,#111827_100%)]",
    headerLight: "bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600",
    headerDark: "bg-gradient-to-r from-stone-900 via-zinc-900 to-rose-950",
  },
  mintwave: {
    name: "Mint Wave",
    rootLight: "bg-[radial-gradient(circle_at_80%_0%,#dcfce7_0%,#ecfeff_44%,#f8fafc_100%)]",
    rootDark: "bg-[radial-gradient(circle_at_80%_0%,#052e2b_0%,#0f172a_46%,#111827_100%)]",
    headerLight: "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700",
    headerDark: "bg-gradient-to-r from-emerald-950 via-teal-950 to-cyan-950",
  },
  cobalt: {
    name: "Cobalt Grid",
    rootLight: "bg-[radial-gradient(circle_at_70%_0%,#dbeafe_0%,#eef2ff_44%,#f8fafc_100%)]",
    rootDark: "bg-[radial-gradient(circle_at_70%_0%,#172554_0%,#111827_50%,#020617_100%)]",
    headerLight: "bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-700",
    headerDark: "bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950",
  },
} as const;

const MODE_PROFILES: Record<
  ModeName,
  {
    label: string;
    pill: string;
    hint: string;
    shellLight: string;
    shellDark: string;
  }
> = {
  smooth: {
    label: "Smooth",
    pill: "from-sky-500 to-blue-600",
    hint: "Balanced transitions and neutral focus.",
    shellLight: "ring-sky-200/40",
    shellDark: "ring-sky-900/30",
  },
  calming: {
    label: "Calming",
    pill: "from-emerald-500 to-teal-600",
    hint: "Softer contrast and slower visual rhythm.",
    shellLight: "ring-emerald-200/40",
    shellDark: "ring-emerald-900/30",
  },
  energetic: {
    label: "Energetic",
    pill: "from-orange-500 to-rose-600",
    hint: "Higher contrast and active visual tone.",
    shellLight: "ring-orange-200/40",
    shellDark: "ring-orange-900/30",
  },
  gaming: {
    label: "Gaming",
    pill: "from-fuchsia-600 to-indigo-700",
    hint: "Bold neon-like accents for high intensity.",
    shellLight: "ring-fuchsia-200/40",
    shellDark: "ring-fuchsia-900/30",
  },
  vibing: {
    label: "Vibing",
    pill: "from-pink-500 to-purple-600",
    hint: "Expressive gradients and creative mood.",
    shellLight: "ring-pink-200/40",
    shellDark: "ring-pink-900/30",
  },
  focus: {
    label: "Focus",
    pill: "from-slate-600 to-slate-800",
    hint: "Low distraction and utilitarian layout.",
    shellLight: "ring-slate-300/50",
    shellDark: "ring-slate-800/40",
  },
};

const MODE_ORDER: ModeName[] = [
  "smooth",
  "calming",
  "energetic",
  "gaming",
  "vibing",
  "focus",
];

const MUSIC_MANIFEST_URL = "/music/manifest.json";

const EMPTY_MUSIC_LIBRARY: Record<ModeName, MusicTrack[]> = {
  smooth: [],
  calming: [],
  energetic: [],
  gaming: [],
  vibing: [],
  focus: [],
};

const DEFAULT_CONFIG: AppConfigState = {
  fonts: { family: "Times New Roman", family_code: "JetBrains Mono" },
  app_ui: {
    theme: "aurora",
    mode: "smooth",
    music: {
      enabled: false,
      volume: 0.35,
      playlist_mode: "smooth",
      autoplay: false,
    },
  },
  header: { enabled: true },
  footer: { enabled: true },
  page: {},
  colors: {},
  spacing: { line_spacing: 1.5, tab_width: 4 },
  watermark: { enabled: false, type: "text", position: "center" },
};

function normalizeMode(value: unknown): ModeName {
  const raw = String(value || "").trim().toLowerCase() as ModeName;
  return MODE_ORDER.includes(raw) ? raw : "smooth";
}

function isYouTubePageUrl(value: string): boolean {
  const raw = value.trim().toLowerCase();
  if (!/^https?:\/\//.test(raw)) return false;
  if (/\.(mp3|wav|ogg|m4a|aac|flac|mp4|webm)(\?.*)?$/.test(raw)) return false;
  return (
    raw.includes("youtube.com/watch") ||
    raw.includes("youtu.be/") ||
    raw.includes("youtube.com/shorts/") ||
    raw.includes("youtube.com/live/")
  );
}

function normalizeTabWidth(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.min(12, Math.max(1, Math.round(parsed)));
}

function normalizeAppConfig(value: Partial<AppConfigState> | null | undefined): AppConfigState {
  const base = {
    ...DEFAULT_CONFIG,
    ...(value || {}),
  } as AppConfigState;
  const mode = normalizeMode(base.app_ui?.mode);
  const themeKey = (base.app_ui?.theme || "aurora").toLowerCase();
  const uiTheme =
    themeKey in APP_UI_THEMES ? themeKey : "aurora";
  return {
    ...base,
    app_ui: {
      ...(DEFAULT_CONFIG.app_ui || {}),
      ...(base.app_ui || {}),
      theme: uiTheme,
      mode,
      music: {
        ...(DEFAULT_CONFIG.app_ui?.music || {}),
        ...(base.app_ui?.music || {}),
        playlist_mode: mode,
        autoplay: false,
      },
    },
    spacing: {
      ...(DEFAULT_CONFIG.spacing || {}),
      ...(base.spacing || {}),
      line_spacing: normalizeLineSpacing(
        Number(base.spacing?.line_spacing || 1.5)
      ),
      tab_width: normalizeTabWidth(base.spacing?.tab_width),
    },
    watermark: {
      ...(base.watermark || {}),
      position: "center",
    },
  };
}

function mergeThemeIntoConfig(
  prev: AppConfigState,
  themeKey: string,
  theme?: ThemeInfo
): AppConfigState {
  const preset =
    FALLBACK_THEME_CATALOG[themeKey.toLowerCase()] || {};
  const mergedColors = {
    ...prev.colors,
    ...(preset.colors || {}),
    ...(theme?.colors || {}),
  };
  const mergedFonts = {
    ...prev.fonts,
    ...(preset.fonts || {}),
    ...(theme?.fonts || {}),
  };
  const mergedSpacing = {
    ...prev.spacing,
    ...(preset.spacing || {}),
    ...(theme?.spacing || {}),
  };
  return {
    ...prev,
    app: { ...(prev.app || {}), theme: themeKey },
    colors: mergedColors,
    fonts: mergedFonts,
    spacing: mergedSpacing,
    header: {
      ...(prev.header || {}),
      color: mergedColors.h1 || prev.header?.color,
    },
    footer: {
      ...(prev.footer || {}),
      color: mergedColors.h2 || prev.footer?.color,
    },
  };
}

function themeSwatches(
  themeKey: string,
  theme?: ThemeInfo
): string[] {
  const preset =
    FALLBACK_THEME_CATALOG[themeKey.toLowerCase()] || {};
  const colors = {
    ...(preset.colors || {}),
    ...(theme?.colors || {}),
  };
  return [
    colors.h1 || "#1F3A5F",
    colors.h2 || "#374151",
    colors.h3 || "#6B7280",
    colors.table_header_bg || "#D1D5DB",
  ];
}

const LOCAL_THEME_STORE_KEY = "nf_local_themes";
const LOCAL_TEMPLATE_STORE_KEY = "nf_local_templates";

function readLocalThemeCatalog(): Record<string, ThemeInfo> {
  try {
    const raw = localStorage.getItem(LOCAL_THEME_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalThemeCatalog(
  data: Record<string, ThemeInfo>
): void {
  try {
    localStorage.setItem(
      LOCAL_THEME_STORE_KEY,
      JSON.stringify(data)
    );
  } catch {
    /* ignore local storage failures */
  }
}

function readLocalTemplateCatalog(): TemplateCard[] {
  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATE_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalTemplateCatalog(data: TemplateCard[]): void {
  try {
    localStorage.setItem(
      LOCAL_TEMPLATE_STORE_KEY,
      JSON.stringify(data)
    );
  } catch {
    /* ignore local storage failures */
  }
}

function slugifyIdentifier(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return cleaned || fallback;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed =
      typeof value === "number" ? value : Number(String(value).trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on", "enabled"].includes(normalized))
        return true;
      if (["0", "false", "no", "off", "disabled"].includes(normalized))
        return false;
    }
  }
  return undefined;
}

function compactRecord<T extends Record<string, any>>(value: T): Partial<T> {
  const result: Record<string, any> = {};
  Object.entries(value).forEach(([key, item]) => {
    if (item === undefined || item === null) return;
    if (
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.keys(item).length === 0
    ) {
      return;
    }
    result[key] = item;
  });
  return result as Partial<T>;
}

function normalizeAlignment(value: unknown): string | undefined {
  const raw = pickString(value)?.toLowerCase();
  if (!raw) return undefined;
  if (["left", "center", "centre", "right"].includes(raw)) {
    return raw === "centre" ? "center" : raw;
  }
  return undefined;
}

function normalizePageNumberStyle(value: unknown): string | undefined {
  const raw = pickString(value)?.toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("roman_lower"))
    return "roman_lower";
  if (raw.includes("roman") || raw.includes("i, ii, iii"))
    return "roman";
  if (raw.includes("alpha_lower"))
    return "alpha_lower";
  if (raw.includes("alpha") || raw.includes("a, b, c"))
    return "alpha";
  if (raw.includes("arabic") || raw.includes("1, 2, 3") || raw === "1")
    return "arabic";
  return undefined;
}

function normalizeBorderStyle(value: unknown): string | undefined {
  const raw = pickString(value)?.toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("double")) return "double";
  if (raw.includes("dashed")) return "dashed";
  if (raw.includes("dotted")) return "dotted";
  if (raw.includes("single")) return "single";
  return raw;
}

function normalizeWatermarkType(value: unknown): string | undefined {
  const raw = pickString(value)?.toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("image")) return "image";
  if (raw.includes("text")) return "text";
  return undefined;
}

const SAMPLE_THEME_IMPORT = {
  key: "frontlines_edutech_theme",
  name: "Daily Notes Maker",
  description:
    "Full theme import with body font, per-heading fonts, bullet font, colors, spacing, header, footer, watermark and page setup.",
  config: {
    app: { theme: "frontlines_edutech_theme" },
    fonts: {
      family: "Times New Roman",
      family_code: "JetBrains Mono",
      h1_family: "Times New Roman",
      h2_family: "Times New Roman",
      h3_family: "Times New Roman",
      h4_family: "Times New Roman",
      h5_family: "Times New Roman",
      h6_family: "Times New Roman",
      bullet_family: "Times New Roman",
      sizes: {
        h1: 20,
        h2: 18,
        h3: 16,
        h4: 14,
        h5: 12,
        h6: 12,
        body: 12,
        code: 11,
        header: 10,
        footer: 10,
      },
    },
    colors: {
      h1: "#6A00F4",
      h2: "#7B2CBF",
      h3: "#9D4EDD",
      h4: "#B5179E",
      h5: "#7209B7",
      h6: "#560BAD",
      body: "#000000",
      table_header_bg: "#F77F00",
      table_header_text: "#FFFFFF",
      table_odd_row: "#FFF4E6",
      table_even_row: "#FFE5B4",
      code_background: "#1E1B2E",
      code_text: "#FFFFFF",
      link: "#6A00F4",
    },
    spacing: {
      line_spacing: 1.5,
      paragraph_spacing_before: 8,
      paragraph_spacing_after: 14,
      heading_spacing_before: 14,
      heading_spacing_after: 8,
      bullet_base_indent: 0.5,
      bullet_indent_per_level: 0.75,
      code_indent: 0.35,
      quote_indent: 0.5,
    },
    page: {
      size: "A4",
      orientation: "portrait",
      margins: { top: 1, right: 1, bottom: 1, left: 1 },
      border: {
        enabled: true,
        width: 1,
        style: "single",
        color: "#000000",
        offset: 24,
      },
    },
    header: {
      enabled: true,
      text: "Daily Notes Maker",
      alignment: "center",
      color: "#F77F00",
      size: 10,
      font_family: "Segoe UI",
      show_page_numbers: true,
      page_format: "X | Page",
      page_number_style: "arabic",
      separator: true,
      separator_color: "#CCCCCC",
    },
    footer: {
      enabled: true,
      text: "Cryptography |",
      alignment: "right",
      color: "#7B2CBF",
      size: 10,
      font_family: "Segoe UI",
      show_page_numbers: true,
      page_format: "X | Page",
      page_number_style: "arabic",
      separator: true,
      separator_color: "#CCCCCC",
    },
    watermark: {
      enabled: true,
      type: "text",
      text: "CONFIDENTIAL",
      font: "Calibri",
      size: 48,
      color: "#6200EA",
      opacity: 0.1,
      rotation: 315,
      position: "center",
      scale: 38,
    },
  },
};

const SAMPLE_TEMPLATE_IMPORT = {
  templates: [
    {
      id: "incident_ascii_code",
      name: "Incident + ASCII + CODE",
      category: "Technical",
      icon: "🛡️",
      description:
        "Sample template using ASCII and CODE markers for your import flow.",
      content: `H1: Incident Investigation Report
H2: Summary
PARAGRAPH: Brief summary of the incident and response timeline.
H2: Topology Diagram
ASCII: +-----------+    +-----------+    +-----------+
ASCII: |  Client   | -> |   API     | -> | Database  |
ASCII: +-----------+    +-----------+    +-----------+
H2: Commands Used
CODE: curl -X GET "https://internal-api.local/health"
CODE: python -m pytest -q
H2: Findings
TABLE: Indicator | Value | Notes
TABLE: Host | api-prod-01 | Elevated error rate
H2: Actions
NUMBERED: Contain affected service.
NUMBERED: Rotate credentials.
NUMBERED: Verify recovery and monitor.`,
      aiPromptTemplate:
        "Generate strict marker content for {topic} using CHAPTER, PARAGRAPH, TABLE, TABLE_CAPTION, FIGURE, CODE and REFERENCES markers. Output only marker lines.",
    },
  ],
};

const SAMPLE_PROMPT_IMPORT = {
  prompt: `You are Quick Doc Formatter AI v8.
Return ONLY strict marker lines. No markdown fences, no commentary, no prose outside markers.

Rules:
1. Every non-empty line must be MARKER: payload.
2. Preserve intended indentation and tabs inside payload text.
3. Use deterministic section structure: heading -> details -> table/figure/code where relevant -> references.
4. Keep language concise and professional.

Required marker coverage when relevant:
H1-H6, PARAGRAPH, CENTER, RIGHT, JUSTIFY, BULLET, NUMBERED, CHECKLIST, CODE, EQUATION, ASCII, DIAGRAM, TABLE, TABLE_CAPTION, IMAGE, FIGURE, FIGURE_CAPTION, NOTE, IMPORTANT, TIP, WARNING, INFO, SUCCESS, CALLOUT, SUMMARY, LINK, HIGHLIGHT, FOOTNOTE, TOC, LIST_OF_TABLES, LIST_OF_FIGURES, COVER_PAGE, ABSTRACT_PAGE, CHAPTER, REFERENCES, REFERENCE, APPENDIX, PAGEBREAK, SEPARATOR.

Example output:
H1: Incident Summary
H2: Timeline
PARAGRAPH: Primary event sequence.
TABLE: Time | Event | Owner
TABLE: 22:15 | Alert triggered | SOC
TABLE_CAPTION: Incident timeline
FIGURE: https://example.com/flow.png | Response flow | center | 80
CODE: curl -X GET "https://internal-api.local/health"
PAGEBREAK:
REFERENCES:
REFERENCE: [1] Internal SOC report`,
};

const DEFAULT_FONT_OPTIONS = [
  "Arial",
  "Arial Black",
  "Bahnschrift",
  "Book Antiqua",
  "Calibri",
  "Cambria",
  "Candara",
  "Century Gothic",
  "Comic Sans MS",
  "Consolas",
  "Constantia",
  "Corbel",
  "Courier New",
  "Franklin Gothic Medium",
  "Garamond",
  "Georgia",
  "Helvetica",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Monaco",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Fira Code",
  "Source Code Pro",
  "Roboto",
  "Open Sans",
];

const DEFAULT_CODE_FONT_OPTIONS = [
  "Consolas",
  "Courier New",
  "Fira Code",
  "JetBrains Mono",
  "Source Code Pro",
  "Cascadia Code",
  "Menlo",
  "Monaco",
  "Lucida Console",
  "Inconsolata",
];

// ═══════════════════════════════════════════════════════════════════
// FALLBACK AI PROMPT
// ═══════════════════════════════════════════════════════════════════

const FALLBACK_PROMPT = `You are Quick Doc Formatter AI v8.

TASK:
Convert user input into strict Quick Doc Formatter marker syntax for direct export.

NON-NEGOTIABLE RULES:
1. Every non-empty line MUST be MARKER: payload.
2. No markdown fences, no explanatory text, no JSON wrapper.
3. Keep indentation/tabs when they are semantically meaningful (lists/code/aligned text).
4. Use concise professional wording and deterministic section order.

SUPPORTED MARKERS:
H1 H2 H3 H4 H5 H6
PARAGRAPH PARA CENTER RIGHT JUSTIFY QUOTE NOTE IMPORTANT TIP WARNING INFO SUCCESS CALLOUT SUMMARY LABEL
BULLET NUMBERED CHECKLIST TASK TODO
CODE EQUATION ASCII DIAGRAM
TABLE TABLE_CAPTION
IMAGE FIGURE FIGURE_CAPTION
LINK HIGHLIGHT FOOTNOTE
TOC LIST_OF_TABLES LIST_OF_FIGURES
COVER_PAGE CERTIFICATE_PAGE DECLARATION_PAGE ACKNOWLEDGEMENT_PAGE ABSTRACT_PAGE
CHAPTER REFERENCES REFERENCE APPENDIX
PAGEBREAK PAGE_BREAK SEPARATOR HR HORIZONTAL_RULE

PAYLOAD GUIDELINES:
- IMAGE/FIGURE: source | caption | align | scale
- LINK: label | url
- HIGHLIGHT: text | color
- TABLE: col1 | col2 | col3
- PAGEBREAK/TOC/LIST_OF_TABLES/LIST_OF_FIGURES/REFERENCES can be marker-only lines.

PREFERRED STRUCTURE:
COVER_PAGE -> ABSTRACT_PAGE -> TOC -> LIST_OF_TABLES -> LIST_OF_FIGURES -> CHAPTER blocks -> REFERENCES -> APPENDIX.

EXAMPLE:
H1: Security Review
H2: Executive Summary
PARAGRAPH: High-level summary of findings and business impact.
H2: Findings
TABLE: Control | Status | Notes
TABLE: MFA | Partial | Enforce on legacy apps
TABLE_CAPTION: Control assessment
FIGURE: https://example.com/network.png | Network overview | center | 80
CODE: nmap -sV 10.0.0.0/24
PAGEBREAK:
REFERENCES:
REFERENCE: [1] NIST guidance

Return ONLY Quick Doc Formatter markers output.`;

// ═══════════════════════════════════════════════════════════════════
// SHORTCUTS DATA
// ═══════════════════════════════════════════════════════════════════

const SHORTCUTS = [
  {
    group: "Editor",
    items: [
      { keys: ["Ctrl", "Z"], desc: "Undo last change" },
      { keys: ["Ctrl", "Y"], desc: "Redo (also Ctrl+Shift+Z)" },
      { keys: ["Ctrl", "F"], desc: "Open Find & Replace panel" },
      { keys: ["Ctrl", "S"], desc: "Generate & download document" },
      { keys: ["Ctrl", "A"], desc: "Select all text in editor" },
    ],
  },
  {
    group: "Markers (type in editor)",
    items: [
      { keys: ["H1:"], desc: '"Title" — main heading (alias: HEADING:)' },
      { keys: ["H2:"], desc: '"Name" — section heading (alias: SUBHEADING:)' },
      { keys: ["H3:"], desc: '"Name" — subsection heading (alias: SUB-SUBHEADING:)' },
      { keys: ["PARAGRAPH:"], desc: '"Text…" — body paragraph' },
      {
        keys: ["BULLET:"],
        desc: '"Point" or "\\tNested"/"  Nested" based on tab width',
      },
      { keys: ["NUMBERED:"], desc: '"Step" with optional nesting/number prefix' },
      { keys: ["CODE:"], desc: '"code line" — monospace block' },
      { keys: ["DIAGRAM:"], desc: 'Alias of ASCII: for diagram lines' },
      { keys: ["TABLE:"], desc: '"Col1 | Col2" — pipe separated' },
      { keys: ["TABLE_CAPTION:"], desc: '"Caption for current table"' },
      { keys: ["NOTE:"], desc: '"Warning or tip"' },
      { keys: ["IMPORTANT:"], desc: '"High-priority note"' },
      { keys: ["QUOTE:"], desc: '"Quoted text"' },
      { keys: ["HIGHLIGHT:"], desc: '"Text" | "yellow"' },
      { keys: ["LINK:"], desc: '"Label" | "https://url"' },
      {
        keys: ["IMAGE:"],
        desc: '"file.png" | "Caption" | "center"',
      },
      {
        keys: ["FIGURE:"],
        desc: '"source" | "Caption" | "center" | "80"',
      },
      { keys: ["FIGURE_CAPTION:"], desc: '"Caption for current figure"' },
      { keys: ["FOOTNOTE:"], desc: '"Source reference"' },
      { keys: ["TOC:"], desc: "Inserts table of contents" },
      { keys: ["LIST_OF_TABLES:"], desc: "Inserts list of tables placeholder" },
      { keys: ["LIST_OF_FIGURES:"], desc: "Inserts list of figures placeholder" },
      { keys: ["CHAPTER:"], desc: '"Chapter title"' },
      { keys: ["REFERENCES:"], desc: "Starts references section" },
      { keys: ["REFERENCE:"], desc: '"Single reference item"' },
      { keys: ["APPENDIX:"], desc: '"Appendix section title"' },
      { keys: ["ASCII:"], desc: '"─── diagram line ───"' },
      { keys: ["PAGEBREAK:"], desc: "Manual page break (alias: PAGE_BREAK:)" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════

const SAMPLE_EXAMPLE = `H1: Quick Doc Formatter - Cybersecurity Incident Summary
H2: Executive Summary
PARAGRAPH: A brief summary of the incident, its impact, and immediate actions taken.
H2: Details
PARAGRAPH: The incident occurred on 2026-02-24 at 22:15 IST. Affected systems included DB server and internal API.
BULLET: Initial detection via IDS alert.
BULLET: Systems isolated.
BULLET: Forensic snapshot taken.
H2: Indicators of Compromise (IOCs)
TABLE: Type | Value | Notes
TABLE: IP | 203.0.113.45 | Suspicious outbound traffic
TABLE: Hash | e3b0c442... | Malware sample hash
H2: Recommendations
NUMBERED: Rotate compromised credentials.
NUMBERED: Patch vulnerable services.
NUMBERED: Run a full internal audit.
CODE: curl -X GET "https://internal-api.local/health" -H "Authorization: Bearer <token>"
PAGEBREAK:
H2: Appendix
ASCII: +-----------------------+
ASCII: | Incident Flow Diagram |
ASCII: +-----------------------+`;

const TEMPLATES: readonly TemplateCard[] = [
  {
    id: "project_report_template",
    name: "Project Report Template",
    category: "Academic",
    icon: "🧾",
    content: `COVER_PAGE: "Project Report"
CERTIFICATE_PAGE: "Certified submission statement"
DECLARATION_PAGE: "Original work declaration"
ACKNOWLEDGEMENT_PAGE: "Acknowledgement text"
ABSTRACT_PAGE: "Brief abstract"
TOC:
LIST_OF_TABLES:
LIST_OF_FIGURES:
CHAPTER: "Introduction"
PARAGRAPH: "Project scope and objective."
CHAPTER: "Implementation"
TABLE: "Module | Status | Notes"
TABLE: "Parser | Complete | Marker expansion done"
TABLE_CAPTION: "Implementation status"
FIGURE: "https://example.com/architecture.png" | "System architecture" | "center" | "80"
CHAPTER: "Conclusion"
PARAGRAPH: "Final summary and future work."
REFERENCES:
REFERENCE: "[1] Reference source"
APPENDIX: "Supporting data"`,
  },
  {
    id: "research_paper_template",
    name: "Research Paper Template",
    category: "Academic",
    icon: "🔬",
    content: `COVER_PAGE: "Research Paper"
ABSTRACT_PAGE: "Objective, method and findings summary."
TOC:
CHAPTER: "Introduction"
PARAGRAPH: "Research background and motivation."
CHAPTER: "Methodology"
PARAGRAPH: "Approach, dataset and process."
CHAPTER: "Results"
TABLE: "Metric | Value"
TABLE: "Accuracy | 0.94"
TABLE_CAPTION: "Evaluation metrics"
FIGURE_CAPTION: "Confusion matrix overview"
CHAPTER: "Discussion"
PARAGRAPH: "Interpretation and limitations."
REFERENCES:
REFERENCE: "[1] Journal citation"`,
  },
  {
    id: "study_notes_template",
    name: "Study Notes Template",
    category: "Academic",
    icon: "📘",
    content: `COVER_PAGE: "Study Notes"
TOC:
CHAPTER: "Core Concepts"
BULLET: "Concept 1"
BULLET: "Concept 2"
CHAPTER: "Practice"
NUMBERED: "Problem set 1"
NUMBERED: "Problem set 2"
TABLE: "Topic | Formula | Notes"
TABLE: "Networking | Throughput = Data/Time | Key relation"
TABLE_CAPTION: "Formula quick sheet"
APPENDIX: "Revision cards"`,
  },
  {
    id: "technical_documentation_template",
    name: "Technical Documentation Template",
    category: "Technical",
    icon: "🛠️",
    content: `COVER_PAGE: "Technical Documentation"
TOC:
CHAPTER: "Overview"
PARAGRAPH: "Scope and audience."
CHAPTER: "Architecture"
FIGURE: "https://example.com/service-map.png" | "Service interaction map" | "center" | "75"
CHAPTER: "API Reference"
TABLE: "Endpoint | Method | Purpose"
TABLE: "/api/preview | POST | Generate preview"
TABLE_CAPTION: "API endpoint table"
CHAPTER: "Operations"
CODE: "docker compose up --build"
REFERENCES:
REFERENCE: "[1] Standards doc"`,
  },
  {
    id: "assignment_template",
    name: "Assignment Template",
    category: "Academic",
    icon: "📝",
    content: `COVER_PAGE: "Assignment"
DECLARATION_PAGE: "I declare this assignment is my original submission."
TOC:
CHAPTER: "Problem Statement"
PARAGRAPH: "Define assignment objective."
CHAPTER: "Solution"
PARAGRAPH: "Present solution with explanation."
TABLE: "Criteria | Outcome"
TABLE: "Correctness | Satisfied"
TABLE_CAPTION: "Evaluation criteria"
CHAPTER: "Conclusion"
PARAGRAPH: "Summarize outcomes."
REFERENCES:
REFERENCE: "[1] Course source"`,
  },
  {
    id: "quickstart",
    name: "Quick Start (New User)",
    category: "Academic",
    icon: "🚀",
    content: `HEADING: "My First Quick Doc Formatter Document"
PARAGRAPH: "Author: [Your name]  |  Date: [Date]"

NOTE: "Delete this note after reading. Replace bracket text with your content."

SUBHEADING: "1) What this document is about"
PARAGRAPH: "[Add a short introduction.]"

SUBHEADING: "2) Key Points"
BULLET: "[Main point]"
BULLET: "[Second point]"
BULLET: "  [Optional sub-point]"

SUBHEADING: "3) Important Data"
TABLE: "Item | Value | Notes"
TABLE: "[Item A] | [Value] | [Notes]"

SUBHEADING: "4) Next Steps"
NUMBERED: "1. [First action]"
NUMBERED: "2. [Second action]"

SUBHEADING: "5) References"
LINK: "Source" | "https://example.com"
FOOTNOTE: "[Optional citation]"`,
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    category: "Business",
    icon: "📋",
    content: `HEADING: "Meeting Notes - [Topic]"
PARAGRAPH: "Date: [Date]  |  Attendees: [Names]  |  Location: [Room]"

SUBHEADING: "Agenda"
BULLET: "[Item 1]"
BULLET: "[Item 2]"
BULLET: "[Item 3]"

SUBHEADING: "Discussion Points"
PARAGRAPH: "[Key points discussed during the meeting]"

SUBHEADING: "Action Items"
TABLE: "Task | Owner | Due Date | Status"
TABLE: "[Task 1] | [Name] | [Date] | Pending"
TABLE: "[Task 2] | [Name] | [Date] | Pending"

SUBHEADING: "Next Meeting"
PARAGRAPH: "Scheduled for [Date] at [Time]."`,
  },
  {
    id: "report",
    name: "Project Report",
    category: "Business",
    icon: "📊",
    content: `HEADING: "Project Report - [Project Name]"
PARAGRAPH: "Prepared by: [Author]  |  Date: [Date]  |  Version: [1.0]"

TOC:

SUBHEADING: "Executive Summary"
PARAGRAPH: "[Brief overview of the project status, key achievements, and next steps.]"

SUBHEADING: "Progress Overview"
TABLE: "Milestone | Status | Completion %"
TABLE: "[Milestone 1] | Complete | 100%"
TABLE: "[Milestone 2] | In Progress | 60%"

SUBHEADING: "Key Findings"
BULLET: "[Finding 1]"
BULLET: "[Finding 2]"
BULLET: "[Finding 3]"

SUBHEADING: "Recommendations"
NUMBERED: "1. [Recommendation 1]"
NUMBERED: "2. [Recommendation 2]"

SUBHEADING: "Conclusion"
PARAGRAPH: "[Summary and next steps.]"`,
  },
  {
    id: "lecture",
    name: "Lecture Notes",
    category: "Academic",
    icon: "🎓",
    content: `HEADING: "[Course Name] - Lecture Notes"
PARAGRAPH: "Lecture [#]  |  Date: [Date]  |  Instructor: [Name]"

SUBHEADING: "Key Concepts"
BULLET: "[Concept 1]"
BULLET: "[Concept 2]"
BULLET: "[Concept 3]"

SUBHEADING: "Detailed Notes"
SUB-SUBHEADING: "[Topic 1]"
PARAGRAPH: "[Detailed explanation of the topic.]"

SUB-SUBHEADING: "[Topic 2]"
PARAGRAPH: "[Detailed explanation of the topic.]"
CODE: "[Any formulas or code examples]"

SUBHEADING: "Summary"
PARAGRAPH: "[Key takeaways from the lecture.]"

NOTE: "Review chapters [X-Y] before next class."`,
  },
  {
    id: "technical",
    name: "Technical Documentation",
    category: "Technical",
    icon: "⚙️",
    content: `HEADING: "[System/API] Documentation"
PARAGRAPH: "Version: [1.0]  |  Last Updated: [Date]  |  Author: [Name]"

TOC:

SUBHEADING: "Overview"
PARAGRAPH: "[Brief description of the system or API.]"

SUBHEADING: "Prerequisites"
BULLET: "[Requirement 1]"
BULLET: "[Requirement 2]"

SUBHEADING: "Installation"
CODE: "npm install [package-name]"
CODE: "# or"
CODE: "pip install [package-name]"

SUBHEADING: "Configuration"
TABLE: "Parameter | Type | Default | Description"
TABLE: "[param1] | string | [value] | [Description]"
TABLE: "[param2] | number | [value] | [Description]"

SUBHEADING: "Usage"
CODE: "[Example code line 1]"
CODE: "[Example code line 2]"
CODE: "[Example code line 3]"

NOTE: "[Important note about usage.]"`,
  },
  {
    id: "research",
    name: "Research Notes",
    category: "Academic",
    icon: "🔬",
    content: `H1: "Research Notes - [Topic]"
H2: "Objective"
PARAGRAPH: "[Define research objective and expected outcomes.]"
H2: "Sources"
BULLET: "[Source 1]"
BULLET: "[Source 2]"
H2: "Findings"
TABLE: "Finding | Evidence | Confidence"
TABLE: "[F1] | [Dataset/Ref] | [High/Medium/Low]"
H2: "Next Steps"
NUMBERED: "[Step 1]"
NUMBERED: "[Step 2]"`,
  },
  {
    id: "interview",
    name: "Interview Prep",
    category: "Business",
    icon: "💼",
    content: `H1: "Interview Preparation - [Role]"
H2: "Core Topics"
BULLET: "[Topic 1]"
BULLET: "[Topic 2]"
BULLET: "[Topic 3]"
H2: "Practice Plan"
NUMBERED: "[Practice action 1]"
NUMBERED: "[Practice action 2]"
H2: "Technical Snippet"
CODE: "[Code or pseudocode line]"`,
  },
];

// ═══════════════════════════════════════════════════════════════════
// PURE UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validateMarkersInText(
  text: string,
  validMarkers: Set<string>
): MarkerError[] {
  const errors: MarkerError[] = [];
  const lines = text.split("\n");

  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (!trimmed || !trimmed.includes(":")) continue;

    const match = trimmed.match(/^([A-Z][A-Z0-9-]*):(.*)$/);
    if (!match) continue;

    const [, marker, rest] = match;

    if (!validMarkers.has(marker)) {
      const suggestion = [...validMarkers].find((m) =>
        m.startsWith(marker.slice(0, 3))
      );
      errors.push({
        line: idx + 1,
        column: 0,
        message: `Unknown marker "${marker}".${
          suggestion ? ` Did you mean ${suggestion}?` : ""
        }`,
        severity: "error",
      });
    }

    const content = rest.trim();
    if (content.startsWith('"') && !content.slice(1).includes('"')) {
      errors.push({
        line: idx + 1,
        column: marker.length + 2,
        message: 'Unclosed quote — missing closing "',
        severity: "error",
      });
    }

    if (PIPE_REQUIRED_MARKERS.has(marker) && !content.includes("|")) {
      errors.push({
        line: idx + 1,
        column: 0,
        message: `${marker} expects pipe-separated format: "text" | "value"`,
        severity: "warning",
      });
    }
  }

  return errors;
}

function validateStrictModeLines(
  text: string,
  validMarkers: Set<string>
): MarkerError[] {
  const errors: MarkerError[] = [];
  const lines = text.split("\n");
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = raw.match(/^\s*([A-Z][A-Z0-9-]*):(.*)$/);
    if (!match) {
      errors.push({
        line: idx + 1,
        column: 0,
        message:
          "Strict Mode: every non-empty line must start with a valid marker (e.g., PARAGRAPH: ...).",
        severity: "warning",
      });
      continue;
    }
    const marker = match[1];
    if (!validMarkers.has(marker)) {
      errors.push({
        line: idx + 1,
        column: 0,
        message: `Strict Mode: unknown marker "${marker}".`,
        severity: "warning",
      });
    }
  }
  return errors;
}

function previewColor(
  raw: string | undefined,
  fallback: string
): string {
  const val = (raw || "").trim();
  return /^#?[0-9a-fA-F]{3,8}$/.test(val)
    ? (val.startsWith("#") ? val : `#${val}`)
    : fallback;
}

function buildPreviewHTML(
  text: string,
  colors: Record<string, string> = {},
  tabWidth = 4
): string {
  const lines = text.split("\n");
  const parts: string[] = [];
  const safeTabWidth = Math.max(1, Math.min(12, Math.floor(tabWidth || 4)));

  const cH1 = previewColor(colors.h1, "#ea580c");
  const cH2 = previewColor(colors.h2, "#d97706");
  const cH3 = previewColor(colors.h3, "#1d4ed8");
  const cH4 = previewColor(colors.h4, "#2563eb");
  const cH5 = previewColor(colors.h5, "#4f46e5");
  const cH6 = previewColor(colors.h6, "#7e22ce");
  const cBody = previewColor(colors.body, "#111827");
  const cCodeBg = previewColor(colors.code_background, "#f3f4f6");
  const cCodeText = previewColor(colors.code_text, "#1f2937");
  const cTableHeaderBg = previewColor(colors.table_header_bg, "#e5e7eb");
  const cTableHeaderText = previewColor(colors.table_header_text, "#111827");
  const cTableOdd = previewColor(colors.table_odd_row, "#ffffff");
  const cTableEven = previewColor(colors.table_even_row, "#f9fafb");
  const cLink = previewColor(colors.link, "#2563eb");

  let tableRowIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      parts.push("<br>");
      continue;
    }

    const match = trimmed.match(/^([A-Z][A-Z0-9-]*):\s*(.*)$/);
    if (!match) {
      parts.push(
        `<p class="text-gray-500 text-sm" style="color:${cBody}">${escapeHtml(trimmed)}</p>`
      );
      continue;
    }

    const [, marker, rawRest] = match;
    if (marker !== "TABLE") {
      tableRowIndex = 0;
    }
    const content = escapeHtml(
      rawRest.trim().replace(/^["']|["']$/g, "")
    );

    switch (marker) {
      case "HEADING":
      case "H1":
        parts.push(
          `<h1 class="text-2xl font-bold mt-4 mb-2" style="color:${cH1}">${content}</h1>`
        );
        break;
      case "SUBHEADING":
      case "H2":
        parts.push(
          `<h2 class="text-xl font-bold mt-3 mb-2" style="color:${cH2}">${content}</h2>`
        );
        break;
      case "SUB-SUBHEADING":
      case "H3":
        parts.push(
          `<h3 class="text-lg font-bold mt-3 mb-1" style="color:${cH3}">${content}</h3>`
        );
        break;
      case "H4":
        parts.push(
          `<h4 class="text-base font-bold mt-2 mb-1" style="color:${cH4}">${content}</h4>`
        );
        break;
      case "H5":
        parts.push(
          `<h5 class="text-sm font-bold mt-2 mb-1" style="color:${cH5}">${content}</h5>`
        );
        break;
      case "H6":
        parts.push(
          `<h6 class="text-sm font-semibold mt-2 mb-1" style="color:${cH6}">${content}</h6>`
        );
        break;
      case "COVER_PAGE":
      case "CERTIFICATE_PAGE":
      case "DECLARATION_PAGE":
      case "ACKNOWLEDGEMENT_PAGE":
      case "ABSTRACT_PAGE":
        parts.push(
          `<h1 class="text-2xl font-bold mt-4 mb-2" style="color:${cH1}">${content || marker.replaceAll("_", " ")}</h1>`
        );
        break;
      case "CHAPTER":
        parts.push(
          `<h2 class="text-xl font-bold mt-4 mb-2 uppercase tracking-wide" style="color:${cH2}">Chapter: ${content}</h2>`
        );
        break;
      case "APPENDIX":
        parts.push(
          `<h2 class="text-xl font-bold mt-4 mb-2" style="color:${cH2}">Appendix: ${content}</h2>`
        );
        break;
      case "REFERENCES":
        parts.push(
          `<h2 class="text-xl font-bold mt-4 mb-2" style="color:${cH2}">${content || "References"}</h2>`
        );
        break;
      case "REFERENCE":
        parts.push(
          `<p class="text-sm leading-relaxed mb-1" style="color:${cBody}">• ${content}</p>`
        );
        break;
      case "PARAGRAPH":
      case "PARA":
        parts.push(
          `<p class="text-sm leading-relaxed mb-2" style="color:${cBody}">${content}</p>`
        );
        break;
      case "CENTER":
        parts.push(
          `<p class="text-sm leading-relaxed mb-2 text-center" style="color:${cBody}">${content}</p>`
        );
        break;
      case "RIGHT":
        parts.push(
          `<p class="text-sm leading-relaxed mb-2 text-right" style="color:${cBody}">${content}</p>`
        );
        break;
      case "JUSTIFY":
        parts.push(
          `<p class="text-sm leading-relaxed mb-2" style="color:${cBody};text-align:justify">${content}</p>`
        );
        break;
      case "BULLET": {
        const raw = rawRest.trim().replace(/^["']|["']$/g, "");
        const expanded = raw.replace(/\t/g, " ".repeat(safeTabWidth));
        const indent =
          (expanded.length - expanded.trimStart().length) / 2;
        const cleaned = escapeHtml(expanded.trim());
        parts.push(
          `<div class="text-sm mb-1" style="margin-left:${
            indent * 20 + 20
          }px;color:${cBody}">• ${cleaned}</div>`
        );
        break;
      }
      case "NUMBERED": {
        const expanded = rawRest.replace(/\t/g, " ".repeat(safeTabWidth));
        const leading = expanded.length - expanded.trimStart().length;
        const numContent = escapeHtml(
          expanded
            .trim()
            .replace(/^["']|["']$/g, "")
            .replace(/^\s*\d+[.)]\s*/, "")
        );
        parts.push(
          `<div class="text-sm mb-1" style="margin-left:${leading * 8 + 20}px;color:${cBody}">${numContent}</div>`
        );
        break;
      }
      case "CHECKLIST":
      case "TASK":
      case "TODO": {
        const expanded = rawRest.replace(/\t/g, " ".repeat(safeTabWidth));
        const leading = expanded.length - expanded.trimStart().length;
        const cleaned = expanded
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/^[-*]\s*/, "");
        const markMatch = cleaned.match(/^\[(x|X| )\]\s*(.*)$/);
        const checked = (markMatch?.[1] || "").toLowerCase() === "x";
        const label = escapeHtml(markMatch?.[2] || cleaned);
        parts.push(
          `<div class="text-sm mb-1" style="margin-left:${leading * 8 + 20}px;color:${cBody}">${checked ? "☑" : "☐"} ${label}</div>`
        );
        break;
      }
      case "CODE":
        parts.push(
          `<pre class="text-xs p-2 rounded font-mono mb-1" style="background:${cCodeBg};color:${cCodeText}">${content}</pre>`
        );
        break;
      case "EQUATION":
        parts.push(
          `<pre class="text-xs p-2 rounded font-mono mb-1 text-center italic" style="background:${cCodeBg};color:${cCodeText}">${content}</pre>`
        );
        break;
      case "TABLE": {
        const cells = content.split("|").map((c) => c.trim());
        const isHeader = tableRowIndex === 0;
        const rowBg = isHeader
          ? cTableHeaderBg
          : tableRowIndex % 2 === 0
            ? cTableEven
            : cTableOdd;
        const rowText = isHeader ? cTableHeaderText : cBody;
        tableRowIndex += 1;
        parts.push(
          `<div class="flex gap-2 text-xs border-b pb-1 mb-1 px-2 py-1 rounded" style="background:${rowBg};color:${rowText}">${cells
            .map(
              (c) =>
                `<span class="flex-1 font-medium">${c}</span>`
            )
            .join("")}</div>`
        );
        break;
      }
      case "TABLE_CAPTION":
        parts.push(
          `<p class="text-xs italic text-center mb-2" style="color:${cBody}">Table: ${content}</p>`
        );
        break;
      case "QUOTE":
        parts.push(
          `<blockquote class="border-l-4 border-yellow-500 pl-3 italic text-sm mb-2" style="color:${cBody}">"${content}"</blockquote>`
        );
        break;
      case "NOTE":
      case "IMPORTANT":
        parts.push(
          `<div class="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-600 p-2 text-sm mb-2" style="color:${cBody}">📝 ${content}</div>`
        );
        break;
      case "TIP":
      case "INFO":
      case "SUCCESS":
      case "WARNING":
      case "CALLOUT":
      case "SUMMARY":
        parts.push(
          `<div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 p-2 text-sm mb-2" style="color:${cBody}">${content}</div>`
        );
        break;
      case "HIGHLIGHT": {
        const [hlText] = content
          .split("|")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        parts.push(
          `<p class="text-sm"><mark class="bg-yellow-200 px-1">${hlText}</mark></p>`
        );
        break;
      }
      case "LINK": {
        const linkParts = content
          .split("|")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        const linkLabel = linkParts[0] || "Link";
        const linkUrl = linkParts[1] || "#";
        parts.push(
          `<p class="text-sm"><a class="underline" style="color:${cLink}">${linkLabel}</a> <span class="text-gray-400 text-xs">(${escapeHtml(linkUrl)})</span></p>`
        );
        break;
      }
      case "IMAGE": {
        const imgParts = content
          .split("|")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        parts.push(
          `<div class="text-center my-2"><div class="inline-block bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-500">🖼️ ${
            imgParts[1] || imgParts[0] || "Image"
          }</div></div>`
        );
        break;
      }
      case "FIGURE": {
        const figParts = content
          .split("|")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        parts.push(
          `<div class="text-center my-2"><div class="inline-block bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-500">📊 ${
            figParts[1] || figParts[0] || "Figure"
          }</div></div>`
        );
        break;
      }
      case "FIGURE_CAPTION":
        parts.push(
          `<p class="text-xs italic text-center mb-2" style="color:${cBody}">Figure: ${content}</p>`
        );
        break;
      case "FOOTNOTE":
        parts.push(
          `<p class="text-xs text-gray-500 italic border-t pt-1 mt-2" style="color:${cBody}">[*] ${content}</p>`
        );
        break;
      case "TOC":
        parts.push(
          `<p class="text-sm font-semibold mb-2" style="color:${cH2}">📑 Table of Contents</p>`
        );
        break;
      case "LIST_OF_TABLES":
        parts.push(
          `<p class="text-sm font-semibold mb-2" style="color:${cH2}">📋 List of Tables</p>`
        );
        break;
      case "LIST_OF_FIGURES":
        parts.push(
          `<p class="text-sm font-semibold mb-2" style="color:${cH2}">🖼️ List of Figures</p>`
        );
        break;
      case "ASCII":
      case "DIAGRAM":
        parts.push(
          `<pre class="text-xs font-mono leading-none mb-1" style="color:${cBody}">${content}</pre>`
        );
        break;
      case "PAGEBREAK":
      case "PAGE_BREAK":
        parts.push(
          `<div class="my-4 border-t-2 border-dashed border-gray-300 pt-2 text-[11px] uppercase tracking-wide text-gray-400">Page Break</div>`
        );
        break;
      case "SEPARATOR":
      case "HR":
      case "HORIZONTAL_RULE":
        parts.push('<hr class="my-4 border-t border-gray-300" />');
        break;
      default:
        parts.push(
          `<p class="text-xs text-gray-400" style="color:${cBody}">${escapeHtml(
            marker
          )}: ${content}</p>`
        );
    }
  }

  return DOMPurify.sanitize(parts.join(""));
}

function analyzeTextLocally(text: string, tabWidth = 4): AnalysisResult {
  const lines = text.split("\n");
  const statistics: Record<string, number> = {};
  const classifications: ClassRow[] = [];
  const safeTabWidth = Math.max(1, Math.min(12, Math.floor(tabWidth || 4)));

  const markerTypeMap: Record<string, string> = {
    HEADING: "h1",
    H1: "h1",
    SUBHEADING: "h2",
    H2: "h2",
    "SUB-SUBHEADING": "h3",
    H3: "h3",
    H4: "h4",
    H5: "h5",
    H6: "h6",
    PARAGRAPH: "paragraph",
    PARA: "paragraph",
    BULLET: "bullet",
    NUMBERED: "numbered",
    CHECKLIST: "checklist",
    TASK: "checklist",
    TODO: "checklist",
    CODE: "code",
    EQUATION: "equation",
    TABLE: "table",
    TABLE_CAPTION: "table_caption",
    ASCII: "ascii",
    DIAGRAM: "ascii",
    TOC: "toc",
    LIST_OF_TABLES: "list_of_tables",
    LIST_OF_FIGURES: "list_of_figures",
    NOTE: "note",
    IMPORTANT: "note",
    TIP: "note",
    WARNING: "warning",
    INFO: "info",
    SUCCESS: "success",
    CALLOUT: "note",
    SUMMARY: "note",
    QUOTE: "quote",
    IMAGE: "image",
    FIGURE: "figure",
    FIGURE_CAPTION: "figure_caption",
    LINK: "link",
    HIGHLIGHT: "highlight",
    FOOTNOTE: "footnote",
    COVER_PAGE: "section",
    CERTIFICATE_PAGE: "section",
    DECLARATION_PAGE: "section",
    ACKNOWLEDGEMENT_PAGE: "section",
    ABSTRACT_PAGE: "section",
    CHAPTER: "chapter",
    REFERENCES: "references",
    REFERENCE: "reference",
    APPENDIX: "appendix",
    PAGEBREAK: "pagebreak",
    PAGE_BREAK: "pagebreak",
    SEPARATOR: "separator",
    HR: "separator",
    HORIZONTAL_RULE: "separator",
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    let type = "empty";
    let content = "";
    let indent_level = 0;
    let marker: string | undefined;

    if (trimmed) {
      const m = trimmed.match(/^([A-Z][A-Z0-9-]*):\s*(.*)$/);
      if (m) {
        marker = m[1].toUpperCase();
        type = markerTypeMap[marker] || marker.toLowerCase();
        content = m[2] || "";
        if (
          (marker === "BULLET" ||
            marker === "NUMBERED" ||
            marker === "CHECKLIST" ||
            marker === "TASK" ||
            marker === "TODO") &&
          content
        ) {
          const expanded = content.replace(/\t/g, " ".repeat(safeTabWidth));
          const leading =
            expanded.length - expanded.trimStart().length;
          indent_level = Math.max(
            0,
            Math.floor(leading / 2)
          );
        }
      } else {
        type = "text";
        content = trimmed;
      }
    }

    statistics[type] = (statistics[type] || 0) + 1;
    classifications.push({
      line_number: idx + 1,
      original: line,
      type,
      content,
      marker,
      indent_level,
    });
  });

  return {
    success: true,
    total_lines: lines.length,
    statistics,
    classifications,
    preview: classifications.slice(0, 20),
  };
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// ═══════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const KBD = React.memo(
  ({ k, dark }: { k: string; dark: boolean }) => (
    <kbd
      className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
        dark
          ? "bg-gray-700 border-gray-500 text-gray-200"
          : "bg-gray-100 border-gray-300 text-gray-700"
      }`}
    >
      {k}
    </kbd>
  )
);
KBD.displayName = "KBD";

type TourStep = {
  id: string;
  tab: TabId;
  selector: string;
  title: string;
  description: string;
};

const GUIDED_TOUR_STEPS: readonly TourStep[] = [
  {
    id: "editor-nav",
    tab: "editor",
    selector: "nav-editor",
    title: "Editor Tab",
    description:
      "Start here to write or paste your content. This is the main workspace.",
  },
  {
    id: "editor-toolbar",
    tab: "editor",
    selector: "editor-toolbar",
    title: "Editor Tools",
    description:
      "Use these buttons for preview, search, drafts, strict mode, and quick examples.",
  },
  {
    id: "editor-area",
    tab: "editor",
    selector: "editor-textarea",
    title: "Writing Area",
    description:
      "Type markers like H1:, PARAGRAPH:, BULLET:, ASCII:, and CODE: here.",
  },
  {
    id: "generate",
    tab: "editor",
    selector: "generate-bar",
    title: "Export Area",
    description:
      "Choose an output format and generate. PDF always returns as PDF with fallback engines when needed.",
  },
  {
    id: "templates-nav",
    tab: "templates",
    selector: "nav-templates",
    title: "Templates",
    description:
      "Load starter documents or import your own template JSON files.",
  },
  {
    id: "template-import",
    tab: "templates",
    selector: "template-import",
    title: "Template Import",
    description:
      "Import reusable templates with ASCII and CODE examples already included.",
  },
  {
    id: "settings-nav",
    tab: "settings",
    selector: "nav-settings",
    title: "Settings",
    description:
      "Control fonts, colors, spacing, borders, header, footer, and page layout.",
  },
  {
    id: "theme-import",
    tab: "settings",
    selector: "theme-import",
    title: "Theme Import",
    description:
      "Import full theme JSON files with colors, fonts, size, spacing, page, header, and footer values.",
  },
  {
    id: "app-experience",
    tab: "settings",
    selector: "app-experience",
    title: "App Experience",
    description:
      "Switch app UI theme/mode and mode-based music without changing document output styling.",
  },
  {
    id: "watermark-panel",
    tab: "settings",
    selector: "watermark-panel",
    title: "Watermark",
    description:
      "Watermark controls are center-only for text and image, with shared opacity, rotation, and scale.",
  },
  {
    id: "prompt-nav",
    tab: "prompt",
    selector: "nav-prompt",
    title: "AI Prompt",
    description:
      "Manage your prompt, import prompt files, and generate structured text from a topic.",
  },
  {
    id: "prompt-import",
    tab: "prompt",
    selector: "prompt-import",
    title: "Prompt Import",
    description:
      "Import a .txt or .json prompt file and reuse it whenever you want.",
  },
  {
    id: "marker-lab",
    tab: "shortcuts",
    selector: "marker-lab",
    title: "Marker Lab",
    description:
      "Search every supported marker, copy snippets, and check payload rules with examples.",
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const LINE_SPACING_PRESETS = [1, 1.15, 1.5, 2, 2.5, 3] as const;

function normalizeLineSpacing(value: number): number {
  if (!Number.isFinite(value)) return 1.5;
  const clamped = Math.min(3, Math.max(1, value));
  return Math.round(clamped * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════

export default function App({
  initialTab = "editor",
}: EditorWorkspacePageProps) {
  // ── Core Editor State ─────────────────────────────────────────
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([""]);
  const [hIdx, setHIdx] = useState(0);

  // ── UI State ──────────────────────────────────────────────────
  const [tab, setTab] = useState<TabId>(initialTab);
  const [settingsTab, setSettingsTab] =
    useState<SettingsTabId>("themes");
  const [dark, setDark] = useState(
    () => localStorage.getItem("nf_dark") === "1"
  );
  const [fullscreen, setFullscreen] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [replaceQ, setReplaceQ] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [splitPreview, setSplitPreview] = useState(false);
  const [strictMode, setStrictMode] = useState(
    () => localStorage.getItem("nf_strict_mode") === "1"
  );
  const [showDrafts, setShowDrafts] = useState(false);
  const [showASCII, setShowASCII] = useState(false);
  const [showFontPreview, setShowFontPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem("nf_onboard_done") !== "1"
  );
  const [onboardingExpanded, setOnboardingExpanded] = useState(true);
  const [guidedTourOpen, setGuidedTourOpen] = useState(false);
  const [guidedTourIndex, setGuidedTourIndex] = useState(0);
  const [guidedTourRect, setGuidedTourRect] =
    useState<DOMRect | null>(null);
  const [markerSuggestions, setMarkerSuggestions] = useState<
    string[]
  >([]);
  const [markerCatalog, setMarkerCatalog] = useState<
    MarkerCatalogEntry[]
  >(FALLBACK_MARKER_CATALOG);
  const [markerSearch, setMarkerSearch] = useState("");
  const [musicLibrary, setMusicLibrary] = useState<
    Record<ModeName, MusicTrack[]>
  >(EMPTY_MUSIC_LIBRARY);
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicLoadError, setMusicLoadError] = useState<string | null>(
    null
  );

  // ── Generation State ──────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<number | null>(null);
  const [generateStatusLabel, setGenerateStatusLabel] = useState("");
  const [format, setFormat] = useState<ExportFormat>("docx");
  const [customName, setCustomName] = useState("");

  // ── Notifications ─────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  // ── Connection ────────────────────────────────────────────────
  const [online, setOnline] =
    useState<ConnectionStatus>("checking");
  const [backendVersion, setBackendVersion] = useState("...");
  const [loadingHealth, setLoadingHealth] = useState(false);

  // ── Analysis ──────────────────────────────────────────────────
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(
    null
  );
  const [analyzing, setAnalyzing] = useState(false);

  // ── Config / Themes ───────────────────────────────────────────
  const [themes, setThemes] = useState<Record<string, ThemeInfo>>(
    FALLBACK_THEME_CATALOG
  );
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("professional");
  const [config, setConfig] = useState<AppConfigState>(() =>
    normalizeAppConfig(DEFAULT_CONFIG)
  );
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Theme Creation ────────────────────────────────────────────
  const [newThemeKey, setNewThemeKey] = useState("");
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDesc, setNewThemeDesc] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);

  // ── AI Prompt ─────────────────────────────────────────────────
  const [promptText, setPromptText] = useState(FALLBACK_PROMPT);
  const [promptTopic, setPromptTopic] = useState("");
  const [templateTopic, setTemplateTopic] = useState(
    "Cybersecurity Incident"
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () =>
      localStorage.getItem("nf_last_template") ||
      "quickstart"
  );
  const [aiProvider, setAiProvider] = useState<
    "chatgpt" | "notebooklm" | "claude"
  >("chatgpt");
  const [apiTemplates, setApiTemplates] = useState<ApiTemplate[]>(
    []
  );
  const [importedTemplates, setImportedTemplates] = useState<
    TemplateCard[]
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [regeneratingTemplate, setRegeneratingTemplate] =
    useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [remotePreviewHTML, setRemotePreviewHTML] = useState("");

  // ── Drafts ────────────────────────────────────────────────────
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [recentExports, setRecentExports] = useState<RecentExport[]>(
    []
  );
  const [draftName, setDraftName] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // ── Refs ──────────────────────────────────────────────────────
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const themeImportInputRef = useRef<HTMLInputElement>(null);
  const templateImportInputRef = useRef<HTMLInputElement>(null);
  const promptImportInputRef = useRef<HTMLInputElement>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const healthCheckInFlight = useRef(false);
  const themeFallbackNotified = useRef(false);
  const analyzeFallbackNotified = useRef(false);

  // ═════════════════════════════════════════════════════════════
  // DERIVED / MEMOIZED VALUES
  // ═════════════════════════════════════════════════════════════

  const debouncedText = useDebounce(text, ANALYZE_DEBOUNCE_MS);
  const currentUiThemeKey = (
    config.app_ui?.theme || "aurora"
  ).toLowerCase();
  const activeUiTheme =
    APP_UI_THEMES[
      (currentUiThemeKey in APP_UI_THEMES
        ? currentUiThemeKey
        : "aurora") as keyof typeof APP_UI_THEMES
    ];
  const currentMode = normalizeMode(config.app_ui?.mode);
  const activeMode = MODE_PROFILES[currentMode] || MODE_PROFILES.smooth;
  const modeShellRing = dark
    ? activeMode.shellDark
    : activeMode.shellLight;
  const markerMap = useMemo(() => {
    const map = new Map<string, MarkerCatalogEntry>();
    markerCatalog.forEach((entry) => {
      map.set(entry.key.toUpperCase(), entry);
      (entry.aliases || []).forEach((alias) =>
        map.set(alias.toUpperCase(), entry)
      );
    });
    return map;
  }, [markerCatalog]);
  const validMarkers = useMemo(() => {
    const set = new Set<string>();
    markerCatalog.forEach((entry) => {
      set.add(entry.key.toUpperCase());
      (entry.aliases || []).forEach((alias) =>
        set.add(alias.toUpperCase())
      );
    });
    if (set.size === 0) {
      FALLBACK_MARKERS.forEach((marker) => set.add(marker));
    }
    return set;
  }, [markerCatalog]);
  const markerAutocomplete = useMemo(() => {
    const options = new Set<string>();
    markerCatalog.forEach((entry) => {
      options.add(`${entry.key.toUpperCase()}:`);
      (entry.aliases || []).forEach((alias) =>
        options.add(`${alias.toUpperCase()}:`)
      );
    });
    if (options.size === 0) {
      MARKER_AUTOCOMPLETE.forEach((marker) => options.add(marker));
    }
    return Array.from(options).sort();
  }, [markerCatalog]);
  const filteredMarkerCatalog = useMemo(() => {
    const query = markerSearch.trim().toLowerCase();
    if (!query) return markerCatalog;
    return markerCatalog.filter((item) =>
      [
        item.key,
        ...(item.aliases || []),
        item.category || "",
        item.description || "",
        item.syntax || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [markerCatalog, markerSearch]);
  const activeTracks = useMemo(
    () => musicLibrary[currentMode] || [],
    [musicLibrary, currentMode]
  );
  const activeTrack = useMemo(
    () =>
      activeTracks.length > 0
        ? activeTracks[clamp(musicIndex, 0, activeTracks.length - 1)]
        : null,
    [activeTracks, musicIndex]
  );

  const markerErrors = useMemo(
    () =>
      debouncedText.trim()
        ? validateMarkersInText(debouncedText, validMarkers)
        : [],
    [debouncedText, validMarkers]
  );

  const strictErrors = useMemo(
    () =>
      strictMode && debouncedText.trim()
        ? validateStrictModeLines(debouncedText, validMarkers)
        : [],
    [strictMode, debouncedText, validMarkers]
  );

  const allMarkerErrors = useMemo(
    () => [...markerErrors, ...strictErrors],
    [markerErrors, strictErrors]
  );

  const effectiveTemplates = useMemo(() => {
    const baseTemplates: TemplateCard[] =
      apiTemplates.length > 0
        ? apiTemplates.map((tpl) => ({
            id: tpl.id,
            name: tpl.name,
            category: tpl.category || "Professional",
            icon: tpl.icon || "🧩",
            content: tpl.sampleContent,
            description: tpl.description,
            aiPromptTemplate: tpl.aiPromptTemplate,
          }))
        : [...TEMPLATES];

    const byId = new Map<string, TemplateCard>();
    baseTemplates.forEach((tpl) => byId.set(tpl.id, tpl));
    importedTemplates.forEach((tpl) => byId.set(tpl.id, tpl));
    return Array.from(byId.values());
  }, [apiTemplates, importedTemplates]);

  const selectedApiTemplate = useMemo(() => {
    const selectedCard =
      effectiveTemplates.find(
        (tpl) => tpl.id === selectedTemplateId
      ) || null;
    if (!selectedCard) return null;
    return {
      id: selectedCard.id,
      name: selectedCard.name,
      description: selectedCard.description || "",
      sampleContent: selectedCard.content,
      aiPromptTemplate: selectedCard.aiPromptTemplate || "",
      category: selectedCard.category,
      icon: selectedCard.icon,
    } as ApiTemplate;
  }, [effectiveTemplates, selectedTemplateId]);

  const activeTourStep = guidedTourOpen
    ? GUIDED_TOUR_STEPS[guidedTourIndex] || null
    : null;

  const guidedTourCardStyle = useMemo(() => {
    if (typeof window === "undefined") {
      return {} as React.CSSProperties;
    }
    if (!guidedTourRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      } as React.CSSProperties;
    }

    const cardWidth = 340;
    const preferredTop =
      guidedTourRect.bottom + 16 + window.scrollY;
    const fallbackTop =
      guidedTourRect.top - 180 + window.scrollY;
    const cardTop =
      preferredTop + 180 < window.innerHeight + window.scrollY
        ? preferredTop
        : Math.max(16 + window.scrollY, fallbackTop);
    const cardLeft = clamp(
      guidedTourRect.left + window.scrollX,
      16 + window.scrollX,
      Math.max(
        16 + window.scrollX,
        window.innerWidth - cardWidth - 16 + window.scrollX
      )
    );

    return {
      top: `${cardTop}px`,
      left: `${cardLeft}px`,
      width: `${cardWidth}px`,
    } as React.CSSProperties;
  }, [guidedTourRect]);

  const previewHTML = useMemo(
    () =>
      (showPreview || splitPreview) && text.trim()
        ? buildPreviewHTML(
            text,
            config.colors,
            Number(config.spacing?.tab_width || 4)
          )
        : "",
    [text, showPreview, splitPreview, config.colors, config.spacing?.tab_width]
  );
  const activePreviewHTML = remotePreviewHTML || previewHTML;

  const lineNumbers = useMemo(() => {
    const count = Math.max(1, text.split("\n").length);
    return Array.from({ length: count }, (_, i) =>
      String(i + 1)
    ).join("\n");
  }, [text]);

  const stats = useMemo(() => {
    const words = text.trim()
      ? text.trim().split(/\s+/).length
      : 0;
    const chars = text.length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return { words, chars, mins };
  }, [text]);

  const availableFonts = useMemo(() => {
    return Array.from(
      new Set([
        ...DEFAULT_FONT_OPTIONS,
        ...(config.fonts?.available_fonts ?? []),
      ])
    );
  }, [config.fonts?.available_fonts]);

  const availableCodeFonts = useMemo(() => {
    return Array.from(
      new Set([
        ...DEFAULT_CODE_FONT_OPTIONS,
        ...availableFonts,
        ...(config.fonts?.available_code_fonts ?? []),
      ])
    );
  }, [config.fonts?.available_code_fonts, availableFonts]);

  // ═════════════════════════════════════════════════════════════
  // HISTORY
  // ═════════════════════════════════════════════════════════════

  const pushHistory = useCallback(
    (t: string) => {
      setHistory((prev) => {
        const next = [...prev.slice(0, hIdx + 1), t].slice(
          -MAX_HISTORY
        );
        setHIdx(next.length - 1);
        return next;
      });
    },
    [hIdx]
  );

  const handleText = useCallback(
    (v: string) => {
      setText(v);
      pushHistory(v);
    },
    [pushHistory]
  );

  const undo = useCallback(() => {
    if (hIdx > 0) {
      const i = hIdx - 1;
      setHIdx(i);
      setText(history[i]);
    }
  }, [hIdx, history]);

  const redo = useCallback(() => {
    if (hIdx < history.length - 1) {
      const i = hIdx + 1;
      setHIdx(i);
      setText(history[i]);
    }
  }, [hIdx, history]);

  // ═════════════════════════════════════════════════════════════
  // API HELPERS
  // ═════════════════════════════════════════════════════════════

  const checkHealth = useCallback(async () => {
    if (healthCheckInFlight.current) return false;
    healthCheckInFlight.current = true;
    setLoadingHealth(true);
    setOnline((prev) =>
      prev === "online" ? "online" : "waking"
    );
    const startedAt = Date.now();
    try {
      try {
        const health = await withRetry(
          () =>
            apiGet<{ status: string }>(API_ENDPOINTS.health, {
              timeout: API_HEALTH_TIMEOUT_MS,
            }),
          { attempts: 5, baseDelayMs: 500, maxDelayMs: 2500 }
        );
        if (health?.status === "ok") {
          setOnline("online");
          try {
            const ver = await apiGet<{
              name?: string;
              version?: string;
            }>(API_ENDPOINTS.version, { timeout: API_HEALTH_TIMEOUT_MS });
            if (ver?.version) setBackendVersion(ver.version);
          } catch {
            try {
              const parser = await apiGet<{ version?: string }>(
                API_ENDPOINTS.parserHealth,
                { timeout: API_HEALTH_TIMEOUT_MS }
              );
              if (parser?.version) setBackendVersion(parser.version);
            } catch {
              setBackendVersion("unknown");
            }
          }
          return true;
        }
      } catch {
        // ignore and continue legacy fallback
      }

      // legacy compatibility fallback while backend wakes up
      while (Date.now() - startedAt < 10_000) {
        try {
          await apiGet(API_ENDPOINTS.healthLegacy, {
            timeout: API_HEALTH_TIMEOUT_MS,
          });
          setOnline("online");
          return true;
        } catch {
          setOnline("waking");
          await new Promise((resolve) =>
            setTimeout(resolve, 1000)
          );
        }
      }

      setOnline("error");
      return false;
    } finally {
      healthCheckInFlight.current = false;
      setLoadingHealth(false);
    }
  }, []);

  const loadTemplateCatalog = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const payload = await withRetry(
        () =>
          apiGet<ApiTemplate[] | { templates?: ApiTemplate[] }>(
            API_ENDPOINTS.templates,
            { timeout: 8000 }
          ),
        { attempts: 4, baseDelayMs: 600, maxDelayMs: 2500 }
      );
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.templates)
          ? payload.templates
          : [];
      if (list.length > 0) {
        setApiTemplates(list);
        setWarn(null);
      } else {
        setWarn(
          "Template API returned empty list. Using built-in templates."
        );
      }
    } catch {
      setWarn(
        "Failed to load templates from backend. Using built-in templates while backend wakes."
      );
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadMarkerCatalog = useCallback(async () => {
    try {
      const payload = await withRetry(
        () =>
          apiGet<{
            success?: boolean;
            markers?: MarkerCatalogEntry[];
          }>(API_ENDPOINTS.markers, { timeout: 8000 }),
        { attempts: 4, baseDelayMs: 500, maxDelayMs: 2500 }
      );
      const list = Array.isArray(payload?.markers)
        ? payload.markers
        : [];
      if (list.length > 0) {
        setMarkerCatalog(
          list.map((item) => ({
            key: String(item.key || "").toUpperCase(),
            aliases: Array.isArray(item.aliases)
              ? item.aliases.map((a) => String(a).toUpperCase())
              : [],
            category: String(item.category || "general"),
            syntax: String(item.syntax || `${item.key}: value`),
            example: String(item.example || `${item.key}: "Sample"`),
            description: String(item.description || `${item.key} marker`),
            payloadRules: String(item.payloadRules || "Marker-prefixed line."),
          }))
        );
      } else {
        setMarkerCatalog(FALLBACK_MARKER_CATALOG);
      }
    } catch {
      setMarkerCatalog(FALLBACK_MARKER_CATALOG);
    }
  }, []);

  const loadMusicManifest = useCallback(async () => {
    try {
      const response = await fetch(MUSIC_MANIFEST_URL, {
        cache: "no-store",
      });
      if (!response.ok) {
        setMusicLibrary(EMPTY_MUSIC_LIBRARY);
        setMusicLoadError(
          "No music manifest found in /public/music. Add tracks to enable player."
        );
        return;
      }
      const raw = (await response.json()) as MusicManifest;
      const parsed: Record<ModeName, MusicTrack[]> = {
        smooth: [],
        calming: [],
        energetic: [],
        gaming: [],
        vibing: [],
        focus: [],
      };
      let blockedYouTube = 0;

      MODE_ORDER.forEach((mode) => {
        const rows = Array.isArray(raw?.[mode]) ? raw?.[mode] : [];
        parsed[mode] = rows
          .map((item, index) => {
            if (typeof item === "string") {
              const source = item.trim();
              if (!source) return null;
              if (isYouTubePageUrl(source)) {
                blockedYouTube += 1;
                return null;
              }
              return {
                title: `Track ${index + 1}`,
                file: source,
                sourceType: /^https?:\/\//i.test(source) ? "url" : "local",
              } as MusicTrack;
            }
            const source = String(item?.file || item?.url || item?.link || "").trim();
            if (!source) return null;
            if (isYouTubePageUrl(source)) {
              blockedYouTube += 1;
              return null;
            }
            return {
              title: String(item?.title || `Track ${index + 1}`),
              file: source,
              sourceType: /^https?:\/\//i.test(source) ? "url" : "local",
              artist: item?.artist ? String(item.artist) : undefined,
              duration: item?.duration ? String(item.duration) : undefined,
            } as MusicTrack;
          })
          .filter((track): track is MusicTrack => Boolean(track));
      });

      setMusicLibrary(parsed);
      const total = Object.values(parsed).reduce(
        (sum, list) => sum + list.length,
        0
      );
      setMusicLoadError(
        total > 0
          ? null
          : "Music manifest loaded, but no tracks are mapped yet."
      );
      if (blockedYouTube > 0) {
        setWarn(
          `${blockedYouTube} YouTube page link(s) were skipped. Add direct media URLs (.mp3/.m4a/.wav/.mp4) instead.`
        );
      }
    } catch {
      setMusicLibrary(EMPTY_MUSIC_LIBRARY);
      setMusicLoadError(
        "Failed to read /music/manifest.json. Check JSON syntax and file paths."
      );
    }
  }, []);

  const loadThemes = useCallback(async () => {
    setLoadingThemes(true);
    const localThemes = readLocalThemeCatalog();
    const baseCatalog: Record<string, ThemeInfo> = {
      ...FALLBACK_THEME_CATALOG,
      ...localThemes,
    };
    try {
      const r = await apiGet<{
        success?: boolean;
        themes?: Record<string, ThemeInfo & Record<string, unknown>>;
        current_theme?: string;
      }>(API_ENDPOINTS.themes);
      if (
        r.success &&
        r.themes &&
        Object.keys(r.themes).length > 0
      ) {
        const merged = { ...baseCatalog };
        Object.entries(r.themes).forEach(([key, rawTheme]) => {
          const rawColors =
            rawTheme?.colors &&
            typeof rawTheme.colors === "object"
              ? (rawTheme.colors as Record<string, string>)
              : {};
          const primary =
            typeof rawTheme?.primaryColor === "string"
              ? rawTheme.primaryColor
              : "";
          const resolved: ThemeInfo = {
            ...(merged[key] || {}),
            ...rawTheme,
            colors: {
              ...(merged[key]?.colors || {}),
              ...(primary
                ? { h1: primary, h2: primary }
                : {}),
              ...rawColors,
            },
          };
          merged[key] = resolved;
        });
        setThemes(merged);
        if (r.current_theme) setCurrentTheme(r.current_theme);
      } else {
        setThemes(baseCatalog);
      }
    } catch {
      setThemes(baseCatalog);
      if (!themeFallbackNotified.current) {
        setWarn(
          "Theme list API is unavailable on this backend. Using built-in themes locally."
        );
        themeFallbackNotified.current = true;
      }
    } finally {
      setLoadingThemes(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const r = await apiGet<{
        success?: boolean;
        config?: AppConfigState;
      }>(API_ENDPOINTS.config);
      if (r.success && r.config) setConfig(normalizeAppConfig(r.config));
      else {
        const local = localStorage.getItem("nf_local_config");
        if (local) {
          setConfig(normalizeAppConfig(JSON.parse(local)));
        } else {
          setConfig(normalizeAppConfig(DEFAULT_CONFIG));
        }
      }
    } catch {
      try {
        const local = localStorage.getItem("nf_local_config");
        if (local) {
          setConfig(normalizeAppConfig(JSON.parse(local)));
        } else {
          setConfig(normalizeAppConfig(DEFAULT_CONFIG));
        }
      } catch {
        setConfig(normalizeAppConfig(DEFAULT_CONFIG));
      }
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const loadPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    try {
      const r = await apiGet<{
        success?: boolean;
        prompt?: string;
      }>(API_ENDPOINTS.prompt);
      if (r.success && r.prompt && r.prompt.trim().length > 20)
        setPromptText(r.prompt);
    } catch {
      /* silent */
    } finally {
      setLoadingPrompt(false);
    }
  }, []);

  const doAnalyze = useCallback(async () => {
    if (!debouncedText.trim()) {
      setAnalysis(null);
      return;
    }
    setAnalyzing(true);
    try {
      const r = await apiPost<AnalysisResult>(API_ENDPOINTS.analyze, {
        text: debouncedText,
      });
      if (r.success) setAnalysis(r);
      else
        setAnalysis(
          analyzeTextLocally(
            debouncedText,
            Number(config.spacing?.tab_width || 4)
          )
        );
    } catch {
      setAnalysis(
        analyzeTextLocally(
          debouncedText,
          Number(config.spacing?.tab_width || 4)
        )
      );
      analyzeFallbackNotified.current = true;
    } finally {
      setAnalyzing(false);
    }
  }, [debouncedText, config.spacing?.tab_width]);

  const doGenerate = useCallback(async () => {
    if (!text.trim() || generating) return;
    setGenerating(true);
    setGenerateProgress(4);
    setGenerateStatusLabel("Preparing export...");
    setError(null);
    setSuccess(null);
    setWarn(null);
    try {
      const themePayload = {
        name: themes[currentTheme]?.name || currentTheme,
        primaryColor:
          config.colors?.h1 || config.header?.color || "#1F3A5F",
        fontFamily:
          config.fonts?.family || "Times New Roman, Georgia, serif",
        headingStyle: {
          h1: {
            size: config.fonts?.sizes?.h1 || 24,
            weight: "700",
            color:
              config.colors?.h1 ||
              config.header?.color ||
              "#1F3A5F",
          },
          h2: {
            size: config.fonts?.sizes?.h2 || 20,
            weight: "600",
            color:
              config.colors?.h2 ||
              config.header?.color ||
              "#1F3A5F",
          },
          h3: {
            size: config.fonts?.sizes?.h3 || 16,
            weight: "600",
            color:
              config.colors?.h3 ||
              config.colors?.h2 ||
              config.header?.color ||
              "#2B6CB0",
          },
          h4: {
            size: config.fonts?.sizes?.h4 || 14,
            weight: "600",
            color:
              config.colors?.h4 ||
              config.colors?.h3 ||
              config.colors?.h2 ||
              "#2B6CB0",
          },
          h5: {
            size: config.fonts?.sizes?.h5 || 13,
            weight: "600",
            color:
              config.colors?.h5 ||
              config.colors?.h4 ||
              config.colors?.h3 ||
              "#334155",
          },
          h6: {
            size: config.fonts?.sizes?.h6 || 12,
            weight: "600",
            color:
              config.colors?.h6 ||
              config.colors?.h5 ||
              config.colors?.h4 ||
              "#475569",
          },
        },
        bodyStyle: {
          size: config.fonts?.sizes?.body || 11,
          lineHeight: normalizeLineSpacing(config.spacing?.line_spacing || 1.5),
        },
        tableStyle: {
          borderWidth: 1,
          borderColor:
            config.colors?.table_border ||
            "#d1d5db",
          headerFill:
            config.colors?.table_header_bg ||
            "#f3f4f6",
        },
        margins: {
          top: (config.page?.margins?.top || 1) * 25.4,
          bottom: (config.page?.margins?.bottom || 1) * 25.4,
          left: (config.page?.margins?.left || 1) * 25.4,
          right: (config.page?.margins?.right || 1) * 25.4,
        },
        styles: {
          lineSpacing:
            normalizeLineSpacing(config.spacing?.line_spacing || 1.5),
          tab_width: normalizeTabWidth(config.spacing?.tab_width || 4),
          paragraph_spacing_before:
            config.spacing
              ?.paragraph_spacing_before ?? 0,
          paragraph_spacing_after:
            config.spacing
              ?.paragraph_spacing_after ?? 0,
          heading_spacing_before:
            config.spacing
              ?.heading_spacing_before ?? 0,
          heading_spacing_after:
            config.spacing
              ?.heading_spacing_after ?? 0,
          bullet_base_indent:
            config.spacing?.bullet_base_indent ?? 0.25,
          bullet_indent_per_level:
            config.spacing
              ?.bullet_indent_per_level ?? 0.25,
          code_indent:
            config.spacing?.code_indent ?? 0,
          quote_indent:
            config.spacing?.quote_indent ?? 0.5,
          paragraph_first_line_indent:
            config.spacing
              ?.paragraph_first_line_indent ?? 0,
          paragraph_alignment:
            config.spacing
              ?.paragraph_alignment || "left",
          body_color:
            config.colors?.body || "#17202a",
          code_background:
            config.colors?.code_background ||
            "#0f172a",
          code_text:
            config.colors?.code_text || "#e2e8f0",
          table_header_text:
            config.colors
              ?.table_header_text || "#111827",
          table_odd_row:
            config.colors?.table_odd_row || "#ffffff",
          table_even_row:
            config.colors
              ?.table_even_row || "#f8fafc",
          link_color:
            config.colors?.link || "#2563eb",
          h1_family:
            config.fonts?.h1_family ||
            config.fonts?.family ||
            "Calibri",
          h2_family:
            config.fonts?.h2_family ||
            config.fonts?.family ||
            "Calibri",
          h3_family:
            config.fonts?.h3_family ||
            config.fonts?.family ||
            "Calibri",
          h4_family:
            config.fonts?.h4_family ||
            config.fonts?.family ||
            "Calibri",
          h5_family:
            config.fonts?.h5_family ||
            config.fonts?.family ||
            "Calibri",
          h6_family:
            config.fonts?.h6_family ||
            config.fonts?.family ||
            "Calibri",
          bullet_font_family:
            config.fonts?.bullet_family ||
            config.fonts?.family ||
            "Calibri",
          code_font_family:
            config.fonts?.family_code ||
            "JetBrains Mono",
          code_font_size:
            config.fonts?.sizes?.code || 10,
          header_alignment:
            config.header?.alignment || "center",
          header_font_family:
            config.header?.font_family ||
            config.fonts?.family ||
            "Calibri",
          header_size:
            config.header?.size ||
            config.fonts?.sizes?.header ||
            10,
          header_color:
            config.header?.color ||
            config.colors?.h1 ||
            "#1F3A5F",
          header_bold:
            config.header?.bold ?? false,
          header_italic:
            config.header?.italic ?? false,
          header_separator:
            config.header?.separator ?? false,
          header_separator_color:
            config.header?.separator_color ||
            "#cccccc",
          header_show_page_numbers:
            config.header
              ?.show_page_numbers ?? false,
          footer_alignment:
            config.footer?.alignment || "center",
          footer_font_family:
            config.footer?.font_family ||
            config.fonts?.family ||
            "Calibri",
          footer_size:
            config.footer?.size ||
            config.fonts?.sizes?.footer ||
            9,
          footer_color:
            config.footer?.color ||
            config.colors?.h2 ||
            "#1F3A5F",
          footer_bold:
            config.footer?.bold ?? false,
          footer_italic:
            config.footer?.italic ?? false,
          footer_separator:
            config.footer?.separator ?? false,
          footer_separator_color:
            config.footer?.separator_color ||
            "#cccccc",
          footer_show_page_numbers:
            config.footer
              ?.show_page_numbers ?? true,
          page_number_position:
            config.footer
              ?.page_number_position ||
            config.header
              ?.page_number_position ||
            "footer",
          page_number_alignment:
            config.footer
              ?.page_number_alignment ||
            config.header
              ?.page_number_alignment ||
            "center",
          page_number_style:
            config.footer?.page_number_style ||
            config.header?.page_number_style ||
            "arabic",
          page_number_format:
            config.footer?.page_format ||
            config.header?.page_format ||
            "Page X",
          page_number_mode:
            (config.footer?.page_format || "")
              .toLowerCase()
              .includes("of")
              ? "page_x_of_y"
              : "page_x",
          page_size:
            config.page?.size || "A4",
          page_orientation:
            config.page?.orientation ||
            "portrait",
          page_border_enabled:
            config.page?.border?.enabled ??
            config.page?.border_enabled ??
            false,
          page_border_width:
            config.page?.border?.width ??
            config.page?.border_width ??
            1,
          page_border_color:
            config.page?.border?.color ??
            config.page?.border_color ??
            "#000000",
          page_border_style:
            config.page?.border?.style ??
            config.page?.border_style ??
            "single",
          page_border_offset:
            config.page?.border?.offset ??
            config.page?.border_offset ??
            24,
        },
      };

      const requestPayload = {
        content: text,
        text,
        format,
        filename: customName || undefined,
        strictMode,
        theme: themePayload,
        security: {
          removeMetadata: false,
          disableEditingDocx: false,
          pageNumberMode:
            (
              config.footer
                ?.show_page_numbers ||
              config.header
                ?.show_page_numbers
            )
              ? (
                  (
                    config.footer
                      ?.page_format ||
                    config.header
                      ?.page_format ||
                    ""
                  )
                    .toLowerCase()
                    .includes("of")
                    ? "page_x_of_y"
                    : "page_x"
                )
              : undefined,
          headerText: config.header?.enabled
            ? config.header?.text || ""
            : "",
          footerText: config.footer?.enabled
            ? config.footer?.text || ""
            : "",
          watermark:
            config.watermark?.enabled &&
            (config.watermark?.text ||
              config.watermark?.image_path)
              ? {
                  type:
                    config.watermark?.type === "image"
                      ? "image"
                      : "text",
                  value:
                    config.watermark?.type === "image"
                      ? config.watermark?.image_path || ""
                      : config.watermark?.text || "",
                  position: "center",
                  fontFamily:
                    config.watermark?.font ||
                    config.fonts?.family ||
                    "Calibri",
                  size: config.watermark?.size || 48,
                  color:
                    config.watermark?.color || "#CCCCCC",
                  opacity:
                    config.watermark?.opacity ?? 0.15,
                  rotation:
                    config.watermark?.rotation ?? 315,
                  scale: config.watermark?.scale || 38,
                }
              : undefined,
        },
      };

      type GenerateApiPayload = {
        success?: boolean;
        downloadUrl?: string;
        download_url?: string;
        fileId?: string;
        filename?: string;
        requestedFormat?: string;
        requested_format?: string;
        actualFormat?: string;
        actual_format?: string;
        conversionEngine?: string;
        conversion_engine?: string;
        externalFallbackUsed?: boolean;
        external_fallback_used?: boolean;
        warning?: string;
        warnings?: string[];
        error?: string;
      };

      const lineCount = text.split("\n").length;
      const useAsyncPath = lineCount >= LARGE_DOC_ASYNC_LINE_THRESHOLD;
      let r: GenerateApiPayload | null = null;

      if (useAsyncPath) {
        setGenerateProgress(10);
        setGenerateStatusLabel("Queued large export job...");
        const start = await apiPost<{
          success?: boolean;
          jobId?: string;
          status?: string;
          progress?: number;
        }>(API_ENDPOINTS.generateAsync, requestPayload);

        const jobId = String(start?.jobId || "").trim();
        if (!jobId) {
          throw new Error("Async export did not return a job id.");
        }

        for (let attempt = 0; attempt < ASYNC_POLL_MAX_ATTEMPTS; attempt += 1) {
          const job = await apiGet<{
            success?: boolean;
            status?: string;
            progress?: number;
            downloadUrl?: string;
            fileId?: string;
            filename?: string;
            requestedFormat?: string;
            actualFormat?: string;
            conversionEngine?: string;
            externalFallbackUsed?: boolean;
            warning?: string;
            warnings?: string[];
            error?: string;
          }>(API_ENDPOINTS.generateJob(jobId));

          const progress = Math.max(0, Math.min(100, Number(job?.progress ?? 0)));
          setGenerateProgress(progress);
          setGenerateStatusLabel(`Large export job: ${progress}%`);

          if (job?.status === "completed") {
            r = {
              success: true,
              downloadUrl: job.downloadUrl,
              fileId: job.fileId,
              filename: job.filename,
              requestedFormat: job.requestedFormat,
              actualFormat: job.actualFormat,
              conversionEngine: job.conversionEngine,
              externalFallbackUsed: job.externalFallbackUsed,
              warning: job.warning,
              warnings: job.warnings,
            };
            break;
          }

          if (job?.status === "failed") {
            throw new Error(job.error || "Async export job failed.");
          }

          await new Promise((resolve) =>
            window.setTimeout(resolve, ASYNC_POLL_INTERVAL_MS)
          );
        }

        if (!r) {
          throw new Error("Async export timed out before completion.");
        }
      } else {
        setGenerateProgress(20);
        setGenerateStatusLabel("Generating document...");
        r = await apiPost<GenerateApiPayload>(
          API_ENDPOINTS.generate,
          requestPayload
        );
        setGenerateProgress(82);
      }
      if (!r) {
        throw new Error("Export response was empty.");
      }

      const downloadUrl = r.downloadUrl || r.download_url;
      const actualFormatRaw =
        r.actualFormat || r.actual_format || format;
      const actualFormat = (
        ["docx", "pdf", "html", "md", "txt"].includes(
          String(actualFormatRaw).toLowerCase()
        )
          ? String(actualFormatRaw).toLowerCase()
          : format
      ) as ExportFormat;
      const externalFallbackUsed = Boolean(
        r.externalFallbackUsed || r.external_fallback_used
      );
      const normalizedBase = (customName || "quick_doc_formatter_output")
        .replace(/[^a-z0-9_\- ]/gi, "")
        .trim()
        .replace(/\s+/g, "_");
      const filename =
        r.filename ||
        `${normalizedBase || "quick_doc_formatter_output"}.${
          actualFormat === "txt" ? "txt" : actualFormat
        }`;
      const warningParts = [
        ...(r.warning ? [String(r.warning)] : []),
        ...(Array.isArray(r.warnings)
          ? r.warnings.map((item) => String(item))
          : []),
        ...(externalFallbackUsed
          ? ["PDF generated via iLovePDF external fallback."]
          : []),
      ]
        .flatMap((msg) => msg.split("|"))
        .map((msg) => msg.trim())
        .filter(Boolean)
        .filter(
          (msg) =>
            !(
              actualFormat === "pdf" &&
              msg.toLowerCase().includes("pdf generated via fallback renderer")
            )
        );
      const warningMessage = [...new Set(warningParts)].join(" | ");
      if (r.success || downloadUrl) {
        setGenerateProgress(90);
        setGenerateStatusLabel("Downloading export...");
        const resolvedUrl = downloadUrl
          ? /^https?:\/\//i.test(downloadUrl)
            ? downloadUrl
            : `${API}${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`
          : "";
        try {
          const fileResp = await api.get<Blob>(resolvedUrl, {
            responseType: "blob",
            timeout: 120000,
          });
          const contentType =
            fileResp.headers?.["content-type"] ||
            "application/octet-stream";
          const blob = new Blob([fileResp.data], {
            type: contentType,
          });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        } catch {
          // Last-resort fallback for strict browser policies.
          const a = document.createElement("a");
          a.href = resolvedUrl;
          a.download = filename;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setWarn(
            "Could not stream file directly; opened download link in a new tab."
          );
        }
        setGenerateProgress(100);
        setGenerateStatusLabel("Export complete.");
        setSuccess(`✅ ${filename} downloaded!`);
        if (warningMessage) setWarn(warningMessage);
        const entry: RecentExport = {
          id: Date.now().toString(),
          filename,
          download_url: resolvedUrl,
          format: actualFormat,
          createdAt: Date.now(),
          warning: warningMessage || undefined,
        };
        setRecentExports((prev) => {
          const next = [entry, ...prev].slice(
            0,
            MAX_RECENT_EXPORTS
          );
          localStorage.setItem(
            "nf_recent_exports",
            JSON.stringify(next)
          );
          return next;
        });
      } else {
        setError(r.error || "Generation failed");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGenerating(false);
      window.setTimeout(() => {
        setGenerateProgress(null);
        setGenerateStatusLabel("");
      }, 900);
    }
  }, [
    text,
    format,
    customName,
    generating,
    strictMode,
    config,
    themes,
    currentTheme,
  ]);

  // ═════════════════════════════════════════════════════════════
  // SETTINGS / THEMES
  // ═════════════════════════════════════════════════════════════

  const applyTheme = useCallback(
    async (name: string) => {
      try {
        const r = await apiPost<{
          success?: boolean;
          config?: AppConfigState;
        }>(API_ENDPOINTS.themesApply, {
          theme_name: name,
        });
        if (r.success) {
          setCurrentTheme(name);
          if (r.config)
            setConfig(
              normalizeAppConfig(
                mergeThemeIntoConfig(r.config, name, themes[name])
              )
            );
          else
            setConfig((prev) =>
              normalizeAppConfig(
                mergeThemeIntoConfig(prev, name, themes[name])
              )
            );
          setDirty(false);
          setSuccess(
            `✅ Theme applied: ${themes[name]?.name || name}`
          );
        }
      } catch {
        setCurrentTheme(name);
        setConfig((prev) =>
          normalizeAppConfig(
            mergeThemeIntoConfig(prev, name, themes[name])
          )
        );
        localStorage.setItem(
          "nf_local_config",
          JSON.stringify(
            normalizeAppConfig(
              mergeThemeIntoConfig(config, name, themes[name])
            )
          )
        );
        setDirty(false);
        setSuccess(
          `✅ Theme applied locally: ${themes[name]?.name || name}`
        );
        if (!themeFallbackNotified.current) {
          setWarn(
            "Theme apply API is unavailable. Theme changes are local until backend is updated."
          );
          themeFallbackNotified.current = true;
        }
      }
    },
    [themes, config]
  );

  const saveSettings = useCallback(async () => {
    try {
      const sections: (keyof AppConfigState)[] = [
        "app_ui",
        "fonts",
        "colors",
        "spacing",
        "page",
        "header",
        "footer",
        "watermark",
      ];

      for (const section of sections) {
        const val = config[section];
        if (val) {
          await apiPost(API_ENDPOINTS.configUpdate, {
            path: section,
            value: val,
          });
        }
      }
      setDirty(false);
      setSuccess("✅ Settings saved!");
    } catch {
      localStorage.setItem(
        "nf_local_config",
        JSON.stringify(config)
      );
      setDirty(false);
      setWarn(
        "Cloud settings API unavailable. Saved locally in this browser."
      );
      setSuccess("✅ Settings saved locally");
    }
  }, [config]);

  const saveAsTheme = useCallback(async () => {
    if (!newThemeKey.trim() || !newThemeName.trim()) {
      setError("Key and name required");
      return;
    }
    const savedKey = newThemeKey
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!savedKey) {
      setError("Invalid theme key");
      return;
    }
    setSavingTheme(true);
    const localThemePayload: ThemeInfo = {
      name: newThemeName,
      description: newThemeDesc || "Custom theme",
      user_created: true,
      colors: { ...(config.colors || {}) },
      fonts: { ...(config.fonts || {}) },
      spacing: { ...(config.spacing || {}) },
    };
    try {
      await apiPost(API_ENDPOINTS.themesSave, {
        key: savedKey,
        name: newThemeName,
        description: newThemeDesc,
        config,
      });
      await apiPost(API_ENDPOINTS.themesApply, {
        theme_name: savedKey,
      });
      saveLocalThemeCatalog({
        ...readLocalThemeCatalog(),
        [savedKey]: localThemePayload,
      });
      await loadThemes();
      await loadConfig();
      setCurrentTheme(savedKey);
      setDirty(false);
      setNewThemeKey("");
      setNewThemeName("");
      setNewThemeDesc("");
      setSuccess(
        `✅ Theme "${newThemeName}" saved and applied!`
      );
    } catch (e) {
      setThemes((prev) => ({
        ...prev,
        [savedKey]: localThemePayload,
      }));
      saveLocalThemeCatalog({
        ...readLocalThemeCatalog(),
        [savedKey]: localThemePayload,
      });
      setCurrentTheme(savedKey);
      setConfig((prev) =>
        normalizeAppConfig(
          mergeThemeIntoConfig(prev, savedKey, localThemePayload)
        )
      );
      localStorage.setItem(
        "nf_local_config",
        JSON.stringify(
          normalizeAppConfig(
            mergeThemeIntoConfig(config, savedKey, localThemePayload)
          )
        )
      );
      setDirty(false);
      setNewThemeKey("");
      setNewThemeName("");
      setNewThemeDesc("");
      setSuccess(
        `✅ Theme "${newThemeName}" saved locally (backend save unavailable)`
      );
      if (!themeFallbackNotified.current) {
        setWarn(
          "Theme save endpoint is unavailable on this backend. Saved locally for this session."
        );
        themeFallbackNotified.current = true;
      }
    } finally {
      setSavingTheme(false);
    }
  }, [
    newThemeKey,
    newThemeName,
    newThemeDesc,
    config,
    loadThemes,
    loadConfig,
  ]);

  const deleteTheme = useCallback(
    async (key: string) => {
      if (!window.confirm(`Delete "${themes[key]?.name}"?`))
        return;
      try {
        await apiPost(API_ENDPOINTS.themesDelete, { key });
        const local = { ...readLocalThemeCatalog() };
        delete local[key];
        saveLocalThemeCatalog(local);
        await loadThemes();
        if (currentTheme === key) {
          setCurrentTheme("professional");
          await loadConfig();
        }
        setSuccess("✅ Deleted");
      } catch {
        const local = { ...readLocalThemeCatalog() };
        delete local[key];
        saveLocalThemeCatalog(local);
        setThemes((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        if (currentTheme === key) {
          setCurrentTheme("professional");
        }
        setSuccess("✅ Theme removed locally");
      }
    },
    [themes, currentTheme, loadThemes, loadConfig]
  );

  // ═════════════════════════════════════════════════════════════
  // IMPORT / EXPORT HELPERS
  // ═════════════════════════════════════════════════════════════

  const toRecord = useCallback((value: unknown): Record<string, any> => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};
  }, []);

  const mergeImportedConfig = useCallback(
    (
      base: AppConfigState,
      incoming: Partial<AppConfigState>
    ): AppConfigState =>
      normalizeAppConfig({
        ...base,
        app: { ...(base.app || {}), ...(incoming.app || {}) },
        app_ui: {
          ...(base.app_ui || {}),
          ...(incoming.app_ui || {}),
          music: {
            ...(base.app_ui?.music || {}),
            ...(incoming.app_ui?.music || {}),
            autoplay: false,
          },
        },
        fonts: { ...(base.fonts || {}), ...(incoming.fonts || {}) },
        header: {
          ...(base.header || {}),
          ...(incoming.header || {}),
        },
        footer: {
          ...(base.footer || {}),
          ...(incoming.footer || {}),
        },
        page: {
          ...(base.page || {}),
          ...(incoming.page || {}),
          margins: {
            ...(base.page?.margins || {}),
            ...(incoming.page?.margins || {}),
          },
          border: {
            ...(base.page?.border || {}),
            ...(incoming.page?.border || {}),
          },
        },
        colors: {
          ...(base.colors || {}),
          ...(incoming.colors || {}),
        },
        spacing: {
          ...(base.spacing || {}),
          ...(incoming.spacing || {}),
        },
        watermark: {
          ...(base.watermark || {}),
          ...(incoming.watermark || {}),
          position: "center",
        },
      }),
    []
  );

  const downloadFile = useCallback(
    (filename: string, content: string, mime: string) => {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    []
  );

  const downloadSampleThemeJson = useCallback(() => {
    downloadFile(
      "Quick Doc Formatter-theme-sample.json",
      JSON.stringify(SAMPLE_THEME_IMPORT, null, 2),
      "application/json"
    );
  }, [downloadFile]);

  const downloadSampleTemplateJson = useCallback(() => {
    downloadFile(
      "Quick Doc Formatter-template-sample.json",
      JSON.stringify(SAMPLE_TEMPLATE_IMPORT, null, 2),
      "application/json"
    );
  }, [downloadFile]);

  const downloadSamplePromptJson = useCallback(() => {
    downloadFile(
      "Quick Doc Formatter-prompt-sample.json",
      JSON.stringify(SAMPLE_PROMPT_IMPORT, null, 2),
      "application/json"
    );
  }, [downloadFile]);

  const buildCurrentThemeExport = useCallback(() => {
    const key = slugifyIdentifier(
      currentTheme || themes[currentTheme]?.name || "Quick Doc Formatter_theme",
      "Quick Doc Formatter_theme"
    );
    return {
      key,
      name: themes[currentTheme]?.name || "Custom Theme",
      description:
        themes[currentTheme]?.description ||
        "Exported Quick Doc Formatter theme",
      config: {
        app: { ...(config.app || {}), theme: key },
        fonts: {
          ...(config.fonts || {}),
          sizes: { ...(config.fonts?.sizes || {}) },
        },
        colors: { ...(config.colors || {}) },
        spacing: { ...(config.spacing || {}) },
        page: {
          ...(config.page || {}),
          margins: { ...(config.page?.margins || {}) },
          border: { ...(config.page?.border || {}) },
        },
        header: { ...(config.header || {}) },
        footer: { ...(config.footer || {}) },
        watermark: { ...(config.watermark || {}) },
      },
    };
  }, [config, currentTheme, themes]);

  const exportCurrentThemeJson = useCallback(() => {
    const payload = buildCurrentThemeExport();
    downloadFile(
      `${payload.key || "Quick Doc Formatter_theme"}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    setSuccess("✅ Current theme exported as JSON.");
  }, [buildCurrentThemeExport, downloadFile]);

  const normalizeImportedTheme = useCallback(
    (
      rawTheme: unknown,
      keyHint: string,
      idx: number
    ): {
      key: string;
      info: ThemeInfo;
      configPatch: Partial<AppConfigState>;
    } => {
      const themeObj = toRecord(rawTheme);
      const themeConfig = toRecord(themeObj.config);
      const themeApp = toRecord(themeConfig.app || themeObj.app);

      const fontsSource = {
        ...toRecord(themeObj.fonts),
        ...toRecord(themeConfig.fonts),
      };
      const fontSizesSource = {
        ...toRecord(toRecord(themeObj.fonts).sizes),
        ...toRecord(toRecord(themeConfig.fonts).sizes),
        ...toRecord(themeObj.font_sizes),
        ...toRecord(themeConfig.font_sizes),
      };
      const heading1 = toRecord(fontsSource.h1);
      const heading2 = toRecord(fontsSource.h2);
      const heading3 = toRecord(fontsSource.h3);
      const heading4 = toRecord(fontsSource.h4);
      const heading5 = toRecord(fontsSource.h5);
      const heading6 = toRecord(fontsSource.h6);

      const colorsSource = {
        ...toRecord(themeObj.colors),
        ...toRecord(themeConfig.colors),
      };
      const spacingSource = {
        ...toRecord(themeObj.spacing),
        ...toRecord(themeConfig.spacing),
      };
      const pageSource = {
        ...toRecord(themeObj.page),
        ...toRecord(themeConfig.page),
      };
      const pageMarginsSource = {
        ...toRecord(toRecord(themeObj.page).margins),
        ...toRecord(toRecord(themeConfig.page).margins),
      };
      const pageBorderSource = {
        ...toRecord(toRecord(themeObj.page).border),
        ...toRecord(toRecord(themeConfig.page).border),
      };
      const headerSource = {
        ...toRecord(themeObj.header),
        ...toRecord(themeConfig.header),
      };
      const footerSource = {
        ...toRecord(themeObj.footer),
        ...toRecord(themeConfig.footer),
      };
      const watermarkSource = {
        ...toRecord(themeObj.watermark),
        ...toRecord(themeConfig.watermark),
      };

      const fallbackKey = `imported_theme_${idx + 1}`;
      const key = slugifyIdentifier(
        pickString(
          themeObj.key,
          themeApp.theme,
          keyHint,
          themeObj.name
        ) || fallbackKey,
        fallbackKey
      );
      const name = pickString(themeObj.name, themeApp.theme, key) || key;
      const description =
        pickString(themeObj.description, themeConfig.description) ||
        "Imported theme";

      const normalizedColors = compactRecord({
        h1:
          pickString(colorsSource.h1, themeObj.primaryColor) ||
          undefined,
        h2:
          pickString(colorsSource.h2, themeObj.primaryColor) ||
          undefined,
        h3:
          pickString(colorsSource.h3, themeObj.primaryColor) ||
          undefined,
        h4: pickString(colorsSource.h4),
        h5: pickString(colorsSource.h5),
        h6: pickString(colorsSource.h6),
        body: pickString(colorsSource.body, colorsSource.text),
        code_background: pickString(
          colorsSource.code_background,
          colorsSource.code_bg
        ),
        code_text: pickString(colorsSource.code_text),
        table_header_bg: pickString(
          colorsSource.table_header_bg,
          colorsSource.table_header_background
        ),
        table_header_text: pickString(
          colorsSource.table_header_text
        ),
        table_odd_row: pickString(
          colorsSource.table_odd_row,
          colorsSource.table_row_odd
        ),
        table_even_row: pickString(
          colorsSource.table_even_row,
          colorsSource.table_row_even
        ),
        table_border: pickString(colorsSource.table_border),
        link: pickString(colorsSource.link),
      });

      const normalizedFontSizes = compactRecord({
        h1: pickNumber(fontSizesSource.h1, fontsSource.h1_size, heading1.size),
        h2: pickNumber(fontSizesSource.h2, fontsSource.h2_size, heading2.size),
        h3: pickNumber(fontSizesSource.h3, fontsSource.h3_size, heading3.size),
        h4: pickNumber(fontSizesSource.h4, fontsSource.h4_size, heading4.size),
        h5: pickNumber(fontSizesSource.h5, fontsSource.h5_size, heading5.size),
        h6: pickNumber(fontSizesSource.h6, fontsSource.h6_size, heading6.size),
        body: pickNumber(fontSizesSource.body, fontsSource.body_size),
        code: pickNumber(fontSizesSource.code, fontsSource.code_size),
        header: pickNumber(fontSizesSource.header, headerSource.size),
        footer: pickNumber(fontSizesSource.footer, footerSource.size),
      });

      const normalizedFonts = compactRecord({
        family: pickString(
          fontsSource.family,
          fontsSource.family_body,
          fontsSource.body_family,
          themeObj.fontFamily
        ),
        family_code: pickString(
          fontsSource.family_code,
          fontsSource.code_family,
          fontsSource.code_font,
          fontsSource.monospace,
          fontsSource.code,
          themeObj.codeFontFamily
        ),
        h1_family: pickString(fontsSource.h1_family, heading1.family),
        h2_family: pickString(fontsSource.h2_family, heading2.family),
        h3_family: pickString(fontsSource.h3_family, heading3.family),
        h4_family: pickString(fontsSource.h4_family, heading4.family),
        h5_family: pickString(fontsSource.h5_family, heading5.family),
        h6_family: pickString(fontsSource.h6_family, heading6.family),
        bullet_family: pickString(
          fontsSource.bullet_family,
          fontsSource.bullet_font,
          fontsSource.list_family
        ),
        available_fonts: Array.isArray(fontsSource.available_fonts)
          ? fontsSource.available_fonts
          : undefined,
        available_code_fonts: Array.isArray(
          fontsSource.available_code_fonts
        )
          ? fontsSource.available_code_fonts
          : undefined,
        sizes:
          Object.keys(normalizedFontSizes).length > 0
            ? normalizedFontSizes
            : undefined,
      });

      const normalizedSpacing = compactRecord({
        line_spacing: pickNumber(
          spacingSource.line_spacing,
          spacingSource.lineHeight
        ),
        paragraph_spacing_before: pickNumber(
          spacingSource.paragraph_spacing_before,
          spacingSource.paragraph_before
        ),
        paragraph_spacing_after: pickNumber(
          spacingSource.paragraph_spacing_after,
          spacingSource.paragraph_after
        ),
        heading_spacing_before: pickNumber(
          spacingSource.heading_spacing_before
        ),
        heading_spacing_after: pickNumber(
          spacingSource.heading_spacing_after
        ),
        bullet_base_indent: pickNumber(
          spacingSource.bullet_base_indent,
          spacingSource.bullet_indent
        ),
        bullet_indent_per_level: pickNumber(
          spacingSource.bullet_indent_per_level,
          spacingSource.bullet_level_increment,
          spacingSource.bullet_level_indent
        ),
        code_indent: pickNumber(
          spacingSource.code_indent,
          spacingSource.code_block_indent
        ),
        quote_indent: pickNumber(
          spacingSource.quote_indent,
          spacingSource.blockquote_indent
        ),
        paragraph_alignment: pickString(
          spacingSource.paragraph_alignment,
          spacingSource.alignment
        ),
      });

      const normalizedPageMargins = compactRecord({
        top: pickNumber(pageMarginsSource.top, pageSource.margin_top),
        right: pickNumber(pageMarginsSource.right, pageSource.margin_right),
        bottom: pickNumber(
          pageMarginsSource.bottom,
          pageSource.margin_bottom
        ),
        left: pickNumber(pageMarginsSource.left, pageSource.margin_left),
      });

      const normalizedPageBorder = compactRecord({
        enabled: pickBoolean(
          pageBorderSource.enabled,
          pageSource.border_enabled
        ),
        width: pickNumber(
          pageBorderSource.width,
          pageSource.border_width
        ),
        style: normalizeBorderStyle(
          pickString(pageBorderSource.style, pageSource.border_style)
        ),
        color: pickString(
          pageBorderSource.color,
          pageSource.border_color
        ),
        offset: pickNumber(
          pageBorderSource.offset,
          pageSource.border_offset
        ),
      });

      const normalizedPage = compactRecord({
        size: pickString(pageSource.size),
        orientation: pickString(pageSource.orientation)?.toLowerCase(),
        margins:
          Object.keys(normalizedPageMargins).length > 0
            ? normalizedPageMargins
            : undefined,
        border:
          Object.keys(normalizedPageBorder).length > 0
            ? normalizedPageBorder
            : undefined,
      });

      const normalizedHeader = compactRecord({
        enabled: pickBoolean(
          headerSource.enabled,
          headerSource.visible,
          headerSource.show
        ),
        text: pickString(headerSource.text, headerSource.content),
        size: pickNumber(headerSource.size, headerSource.font_size),
        color: pickString(headerSource.color, headerSource.text_color),
        bold: pickBoolean(headerSource.bold),
        italic: pickBoolean(headerSource.italic),
        alignment: normalizeAlignment(headerSource.alignment),
        font_family: pickString(
          headerSource.font_family,
          headerSource.font,
          headerSource.family
        ),
        show_page_numbers: pickBoolean(
          headerSource.show_page_numbers,
          headerSource.page_numbers
        ),
        page_number_style: normalizePageNumberStyle(
          headerSource.page_number_style
        ),
        separator: pickBoolean(
          headerSource.separator,
          headerSource.show_separator
        ),
        separator_color: pickString(
          headerSource.separator_color,
          headerSource.line_color
        ),
        page_number_position: pickString(
          headerSource.page_number_position
        ),
        page_number_alignment: normalizeAlignment(
          headerSource.page_number_alignment
        ),
        page_format: pickString(
          headerSource.page_format,
          headerSource.pageNumberFormat
        ),
      });

      const normalizedFooter = compactRecord({
        enabled: pickBoolean(
          footerSource.enabled,
          footerSource.visible,
          footerSource.show
        ),
        text: pickString(footerSource.text, footerSource.content),
        size: pickNumber(footerSource.size, footerSource.font_size),
        color: pickString(footerSource.color, footerSource.text_color),
        bold: pickBoolean(footerSource.bold),
        italic: pickBoolean(footerSource.italic),
        alignment: normalizeAlignment(footerSource.alignment),
        font_family: pickString(
          footerSource.font_family,
          footerSource.font,
          footerSource.family
        ),
        show_page_numbers: pickBoolean(
          footerSource.show_page_numbers,
          footerSource.page_numbers
        ),
        page_number_style: normalizePageNumberStyle(
          footerSource.page_number_style
        ),
        separator: pickBoolean(
          footerSource.separator,
          footerSource.show_separator
        ),
        separator_color: pickString(
          footerSource.separator_color,
          footerSource.line_color
        ),
        page_number_position: pickString(
          footerSource.page_number_position
        ),
        page_number_alignment: normalizeAlignment(
          footerSource.page_number_alignment
        ),
        page_format: pickString(
          footerSource.page_format,
          footerSource.pageNumberFormat
        ),
      });

      const normalizedWatermark = compactRecord({
        enabled: pickBoolean(watermarkSource.enabled),
        type: normalizeWatermarkType(watermarkSource.type),
        text: pickString(watermarkSource.text, watermarkSource.value),
        image_path: pickString(
          watermarkSource.image_path,
          watermarkSource.image,
          watermarkSource.url
        ),
        size: pickNumber(
          watermarkSource.size,
          watermarkSource.font_size
        ),
        color: pickString(watermarkSource.color),
        opacity: pickNumber(
          watermarkSource.opacity,
          watermarkSource.alpha
        ),
        rotation: pickNumber(
          watermarkSource.rotation,
          watermarkSource.angle
        ),
        position: "center",
        scale: pickNumber(watermarkSource.scale),
        font: pickString(
          watermarkSource.font,
          watermarkSource.font_family,
          watermarkSource.family
        ),
      });

      return {
        key,
        info: {
          name,
          description,
          user_created: true,
          builtin: false,
          colors: normalizedColors,
          fonts: normalizedFonts,
          spacing: normalizedSpacing,
        },
        configPatch: compactRecord({
          app: { theme: key },
          fonts: normalizedFonts,
          colors: normalizedColors,
          spacing: normalizedSpacing,
          page: normalizedPage,
          header: normalizedHeader,
          footer: normalizedFooter,
          watermark: normalizedWatermark,
        }),
      };
    },
    [toRecord]
  );

  const importThemesFromFile = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        const root = toRecord(parsed);
        const themeSource =
          root.themes && typeof root.themes === "object"
            ? Object.entries(toRecord(root.themes))
            : [[String(root.key || root.name || "imported_theme"), parsed]];

        const importedThemes: Array<{
          key: string;
          info: ThemeInfo;
          configPatch: Partial<AppConfigState>;
        }> = [];

        themeSource.forEach(([keyHint, rawTheme], idx) => {
          importedThemes.push(
            normalizeImportedTheme(rawTheme, keyHint, idx)
          );
        });

        if (importedThemes.length === 0) {
          setError("No valid theme entries found in JSON.");
          return;
        }

        const localCatalog = {
          ...readLocalThemeCatalog(),
        };
        importedThemes.forEach((item) => {
          localCatalog[item.key] = item.info;
        });
        saveLocalThemeCatalog(localCatalog);

        const first = importedThemes[0];
        const mergedConfig = mergeThemeIntoConfig(
          mergeImportedConfig(config, first.configPatch),
          first.key,
          first.info
        );
        setConfig(mergedConfig);
        localStorage.setItem(
          "nf_local_config",
          JSON.stringify(mergedConfig)
        );

        setThemes((prev) => {
          const next = { ...prev };
          importedThemes.forEach((item) => {
            next[item.key] = item.info;
          });
          return next;
        });
        setCurrentTheme(first.key);
        setDirty(true);

        for (const item of importedThemes) {
          try {
            await apiPost(API_ENDPOINTS.themesSave, {
              key: item.key,
              name: item.info.name,
              description: item.info.description || "",
              config: mergeImportedConfig(config, item.configPatch),
            });
          } catch {
            // local fallback already applied
          }
        }
        try {
          await apiPost(API_ENDPOINTS.themesApply, {
            theme_name: first.key,
          });
        } catch {
          // local fallback already applied
        }
        await loadThemes();
        setSuccess(
          `✅ Imported ${importedThemes.length} theme(s): ${importedThemes
            .map((item) => item.info.name)
            .join(", ")}`
        );
      } catch {
        setError("Invalid theme JSON file.");
      }
    },
    [
      config,
      loadThemes,
      mergeImportedConfig,
      normalizeImportedTheme,
      toRecord,
    ]
  );

  const importTemplatesFromFile = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        const root = toRecord(parsed);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(root.templates)
            ? root.templates
            : [parsed];

        const normalized: TemplateCard[] = [];
        list.forEach((item: unknown, idx: number) => {
          const entry = toRecord(item);
          const rawContent = String(
            entry.content || entry.sampleContent || ""
          ).trim();
          if (!rawContent) return;
          const fallbackName = `Imported Template ${idx + 1}`;
          const name = String(entry.name || fallbackName);
          const id = slugifyIdentifier(
            String(entry.id || entry.key || name),
            `imported_template_${idx + 1}`
          );
          normalized.push({
            id,
            name,
            category: String(entry.category || "Imported"),
            icon: String(entry.icon || "📦"),
            content: rawContent,
            description: String(entry.description || ""),
            aiPromptTemplate: String(
              entry.aiPromptTemplate || entry.prompt || ""
            ),
          });
        });

        if (normalized.length === 0) {
          setError("No valid templates found in JSON.");
          return;
        }

        setImportedTemplates((prev) => {
          const byId = new Map<string, TemplateCard>();
          prev.forEach((tpl) => byId.set(tpl.id, tpl));
          normalized.forEach((tpl) => byId.set(tpl.id, tpl));
          const merged = Array.from(byId.values());
          saveLocalTemplateCatalog(merged);
          return merged;
        });

        setSuccess(
          `✅ Imported ${normalized.length} template(s).`
        );
      } catch {
        setError("Invalid template JSON file.");
      }
    },
    [toRecord]
  );

  const importPromptFromFile = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        let promptValue = raw;
        try {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            typeof parsed === "object" &&
            typeof (parsed as { prompt?: unknown }).prompt ===
              "string"
          ) {
            promptValue = (parsed as { prompt: string }).prompt;
          }
        } catch {
          // plain text prompt is also valid
        }

        const trimmed = promptValue.trim();
        if (!trimmed) {
          setError("Prompt file is empty.");
          return;
        }
        setPromptText(trimmed);
        setPromptEditing(false);
        try {
          await apiPost(API_ENDPOINTS.prompt, {
            prompt: trimmed,
          });
        } catch {
          // local-only prompt update if backend save fails
        }
        setSuccess(`✅ Prompt imported from ${file.name}`);
      } catch {
        setError("Could not read prompt file.");
      }
    },
    []
  );

  const onThemeImportInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await importThemesFromFile(file);
    },
    [importThemesFromFile]
  );

  const onTemplateImportInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await importTemplatesFromFile(file);
    },
    [importTemplatesFromFile]
  );

  const onPromptImportInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await importPromptFromFile(file);
    },
    [importPromptFromFile]
  );

  // ═════════════════════════════════════════════════════════════
  // PROMPT
  // ═════════════════════════════════════════════════════════════

  const savePrompt = useCallback(async () => {
    setPromptSaving(true);
    try {
      await apiPost(API_ENDPOINTS.prompt, {
        prompt: promptText,
      });
      setPromptEditing(false);
      setSuccess("✅ Prompt saved!");
    } catch {
      setError("Failed to save prompt");
    } finally {
      setPromptSaving(false);
    }
  }, [promptText]);

  const composedPrompt = useMemo(() => {
    const topic = promptTopic.trim();
    if (!topic) return promptText;
    return `${promptText}\n\n## USER TOPIC\n${topic}`;
  }, [promptText, promptTopic]);

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(composedPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2500);
  }, [composedPrompt]);

  const openInChatGPT = useCallback(() => {
    const q = encodeURIComponent(composedPrompt);
    window.open(
      `https://chat.openai.com/?q=${q}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [composedPrompt]);

  const regenerateTemplateContent = useCallback(async () => {
    const topic = templateTopic.trim();
    if (!selectedTemplateId || !topic) {
      setError("Select a template and enter topic first");
      return;
    }
    setRegeneratingTemplate(true);
    try {
      const r = await apiPost<{
        content?: string;
        prompt?: string;
      }>(API_ENDPOINTS.templatesRegenerate, {
        templateId: selectedTemplateId,
        topic,
        aiProvider,
      });
      if (r?.content) {
        handleText(r.content);
        setTab("editor");
        setShowPreview(true);
        setSuccess("✅ Template regenerated and loaded");
      }
      if (r?.prompt) {
        setPromptText(r.prompt);
      }
    } catch {
      const fallback =
        selectedApiTemplate?.aiPromptTemplate?.replace(
          "{topic}",
          topic
        ) ||
        `Using Quick Doc Formatter marker syntax (H1-H6, PARAGRAPH, BULLET, NUMBERED, CHECKLIST, TABLE, TABLE_CAPTION, IMAGE, FIGURE, FIGURE_CAPTION, CODE, EQUATION, TIP, WARNING, INFO, SUCCESS, TOC, LIST_OF_TABLES, LIST_OF_FIGURES, CHAPTER, REFERENCES, REFERENCE), generate structured content about '${topic}' for '${selectedTemplateId}' template. Output only markers.`;
      setPromptText(fallback);
      setWarn(
        "Template regenerate API unavailable. Prompt prepared locally."
      );
    } finally {
      setRegeneratingTemplate(false);
    }
  }, [
    templateTopic,
    selectedTemplateId,
    aiProvider,
    selectedApiTemplate,
    handleText,
  ]);

  const openGuidedTour = useCallback((startIndex = 0) => {
    setShowOnboarding(false);
    setGuidedTourIndex(
      clamp(startIndex, 0, GUIDED_TOUR_STEPS.length - 1)
    );
    setGuidedTourOpen(true);
  }, []);

  const finishGuidedTour = useCallback(() => {
    setGuidedTourOpen(false);
    setGuidedTourRect(null);
    setShowOnboarding(false);
    localStorage.setItem("nf_guided_tour_done", "1");
    localStorage.setItem("nf_onboard_done", "1");
  }, []);

  const skipGuidedTour = useCallback(() => {
    finishGuidedTour();
    setSuccess("Guided tour skipped. You can restart it from the guide.");
  }, [finishGuidedTour]);

  const nextGuidedTourStep = useCallback(() => {
    if (guidedTourIndex >= GUIDED_TOUR_STEPS.length - 1) {
      finishGuidedTour();
      setSuccess("Guided tour completed.");
      return;
    }
    setGuidedTourIndex((prev) => prev + 1);
  }, [guidedTourIndex, finishGuidedTour]);

  const previousGuidedTourStep = useCallback(() => {
    setGuidedTourIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem("nf_onboard_done", "1");
  }, []);

  const downloadRecentExport = useCallback((item: RecentExport) => {
    const a = document.createElement("a");
    a.href = /^https?:\/\//i.test(item.download_url)
      ? item.download_url
      : `${API}${item.download_url.startsWith("/") ? "" : "/"}${item.download_url}`;
    a.download = item.filename;
    a.click();
  }, []);

  // ═════════════════════════════════════════════════════════════
  // CONFIG LOCAL UPDATES
  // ═════════════════════════════════════════════════════════════

  const cfgLocal = useCallback(
    (path: string, value: unknown) => {
      setConfig((prev) => {
        const next = structuredClone(prev);
        const keys = path.split(".");
        let cur: Record<string, unknown> =
          next as unknown as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
          if (
            !cur[keys[i]] ||
            typeof cur[keys[i]] !== "object"
          ) {
            cur[keys[i]] = {};
          }
          cur = cur[keys[i]] as Record<string, unknown>;
        }
        if (path === "spacing.line_spacing" && typeof value === "number") {
          cur[keys[keys.length - 1]] = normalizeLineSpacing(value);
        } else if (path === "spacing.tab_width") {
          cur[keys[keys.length - 1]] = normalizeTabWidth(value);
        } else if (path === "watermark.position") {
          cur[keys[keys.length - 1]] = "center";
        } else {
          cur[keys[keys.length - 1]] = value;
        }
        return normalizeAppConfig(next);
      });
      setDirty(true);
    },
    []
  );

  const refreshMarkerSuggestions = useCallback(
    (value: string, cursor: number) => {
      const lineStart =
        value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
      const currentChunk = value.slice(lineStart, cursor);
      const prefix = currentChunk.trimStart().toUpperCase();
      if (!prefix || prefix.includes(":")) {
        setMarkerSuggestions([]);
        return;
      }
      const next = markerAutocomplete.filter((m) =>
        m.toUpperCase().startsWith(prefix)
      ).slice(0, 6);
      setMarkerSuggestions(next);
    },
    [markerAutocomplete]
  );

  const applyMarkerSuggestion = useCallback(
    (marker: string) => {
      const el = taRef.current;
      if (!el) return;
      const cursor = el.selectionStart ?? text.length;
      const lineStart =
        text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
      const leading =
        text
          .slice(lineStart, cursor)
          .match(/^\s*/)?.[0] || "";
      const value =
        `${text.slice(0, lineStart)}${leading}${marker} ${text.slice(cursor)}`;
      handleText(value);
      setMarkerSuggestions([]);
      window.requestAnimationFrame(() => {
        const pos = lineStart + leading.length + marker.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [text, handleText]
  );

  const copyMarkerSnippet = useCallback(
    async (snippet: string) => {
      try {
        await navigator.clipboard.writeText(snippet);
        setSuccess("Marker snippet copied.");
      } catch {
        setWarn("Could not copy marker snippet.");
      }
    },
    []
  );

  const toggleMusicPlayback = useCallback(() => {
    if (!config.app_ui?.music?.enabled) {
      cfgLocal("app_ui.music.enabled", true);
      return;
    }
    if (!activeTrack) {
      setWarn("No track mapped for this mode. Add files in /public/music.");
      return;
    }
    setMusicPlaying((prev) => !prev);
  }, [activeTrack, config.app_ui?.music?.enabled, cfgLocal]);

  const nextTrack = useCallback(() => {
    if (activeTracks.length === 0) return;
    setMusicIndex((prev) => (prev + 1) % activeTracks.length);
  }, [activeTracks.length]);

  const prevTrack = useCallback(() => {
    if (activeTracks.length === 0) return;
    setMusicIndex((prev) =>
      (prev - 1 + activeTracks.length) % activeTracks.length
    );
  }, [activeTracks.length]);

  // ═════════════════════════════════════════════════════════════
  // SEARCH
  // ═════════════════════════════════════════════════════════════

  const doSearch = useCallback(() => {
    if (!searchQ || !taRef.current) return;
    const idx = taRef.current.value
      .toLowerCase()
      .indexOf(searchQ.toLowerCase());
    if (idx !== -1) {
      taRef.current.focus();
      taRef.current.setSelectionRange(
        idx,
        idx + searchQ.length
      );
    }
  }, [searchQ]);

  const doReplace = useCallback(() => {
    if (!searchQ) return;
    const escaped = searchQ.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    handleText(
      text.replace(new RegExp(escaped, "gi"), replaceQ)
    );
  }, [searchQ, replaceQ, text, handleText]);

  // ═════════════════════════════════════════════════════════════
  // DRAG & DROP
  // ═════════════════════════════════════════════════════════════

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget === dropZoneRef.current)
        setIsDragging(false);
    },
    []
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const textFile = files.find(
        (f) =>
          f.type === "text/plain" ||
          f.type === "text/markdown" ||
          f.name.endsWith(".txt") ||
          f.name.endsWith(".md")
      );

      if (!textFile) {
        setWarn("Please drop a .txt or .md file");
        return;
      }

      const content = await textFile.text();
      handleText(content);
      setSuccess(
        `✅ Loaded: ${textFile.name} (${(
          textFile.size / 1024
        ).toFixed(1)}KB)`
      );
    },
    [handleText]
  );

  // ═════════════════════════════════════════════════════════════
  // DRAFTS
  // ═════════════════════════════════════════════════════════════

  const saveDraft = useCallback(() => {
    if (!draftName.trim()) {
      setError("Draft name required");
      return;
    }
    const newDraft: SavedDraft = {
      id: Date.now().toString(),
      name: draftName.trim(),
      content: text,
      savedAt: Date.now(),
    };
    const updated = [...savedDrafts, newDraft].slice(
      -MAX_DRAFTS
    );
    setSavedDrafts(updated);
    localStorage.setItem(
      "nf_saved_drafts",
      JSON.stringify(updated)
    );
    setDraftName("");
    setSuccess(`✅ Saved draft: ${newDraft.name}`);
  }, [draftName, text, savedDrafts]);

  const loadDraft = useCallback(
    (draft: SavedDraft) => {
      handleText(draft.content);
      setShowDrafts(false);
      setSuccess(`✅ Loaded: ${draft.name}`);
    },
    [handleText]
  );

  const deleteDraft = useCallback((id: string) => {
    setSavedDrafts((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      localStorage.setItem(
        "nf_saved_drafts",
        JSON.stringify(updated)
      );
      return updated;
    });
    setSuccess("✅ Draft deleted");
  }, []);

  // ═════════════════════════════════════════════════════════════
  // EFFECTS
  // ═════════════════════════════════════════════════════════════

  // Initialise
  useEffect(() => {
    const draft = localStorage.getItem("nf_draft");
    if (draft?.trim()) {
      setText(draft);
      setHistory([draft]);
    }

    try {
      const stored = localStorage.getItem("nf_saved_drafts");
      if (stored) setSavedDrafts(JSON.parse(stored));
    } catch {
      /* ignore */
    }

    try {
      const stored = localStorage.getItem("nf_recent_exports");
      if (stored) setRecentExports(JSON.parse(stored));
    } catch {
      /* ignore */
    }

    setImportedTemplates(readLocalTemplateCatalog());

    checkHealth();
    loadThemes();
    loadTemplateCatalog();
    loadMarkerCatalog();
    loadConfig();
    loadPrompt();
    loadMusicManifest();

    const iv = setInterval(checkHealth, HEALTH_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("nf_guided_tour_done") === "1") {
      return;
    }
    const timer = window.setTimeout(() => {
      setShowOnboarding(false);
      setGuidedTourIndex(0);
      setGuidedTourOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (online !== "online") return;
    loadThemes();
    loadTemplateCatalog();
    loadMarkerCatalog();
    loadConfig();
    loadPrompt();
  }, [
    online,
    loadThemes,
    loadTemplateCatalog,
    loadMarkerCatalog,
    loadConfig,
    loadPrompt,
  ]);

  useEffect(() => {
    if (!showOnboarding || !text.trim()) return;
    dismissOnboarding();
  }, [text, showOnboarding, dismissOnboarding]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("nf_dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("nf_strict_mode", strictMode ? "1" : "0");
  }, [strictMode]);

  useEffect(() => {
    localStorage.setItem("nf_last_template", selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!config.app_ui?.mode) return;
    const normalized = normalizeMode(config.app_ui.mode);
    if (normalized !== config.app_ui.mode) {
      setConfig((prev) =>
        normalizeAppConfig({
          ...prev,
          app_ui: {
            ...(prev.app_ui || {}),
            mode: normalized,
          },
        })
      );
      return;
    }
    setConfig((prev) => ({
      ...prev,
      app_ui: {
        ...(prev.app_ui || {}),
        mode: normalized,
        music: {
          ...(prev.app_ui?.music || {}),
          playlist_mode: normalized,
          autoplay: false,
        },
      },
    }));
  }, [config.app_ui?.mode]);

  useEffect(() => {
    setMusicIndex(0);
    setMusicPlaying(false);
  }, [currentMode]);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio) return;
    const volume = Math.min(
      1,
      Math.max(0, Number(config.app_ui?.music?.volume ?? 0.35))
    );
    audio.volume = volume;
  }, [config.app_ui?.music?.volume]);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio) return;

    const enabled = Boolean(config.app_ui?.music?.enabled);
    if (!enabled || !activeTrack?.file) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setMusicPlaying(false);
      return;
    }

    if (isYouTubePageUrl(activeTrack.file)) {
      audio.pause();
      setMusicPlaying(false);
      setMusicLoadError(
        "YouTube page links are not supported. Use a direct media URL or local file in /public/music."
      );
      return;
    }

    const src = /^https?:\/\//i.test(activeTrack.file)
      ? activeTrack.file
      : activeTrack.file.startsWith("/")
        ? activeTrack.file
        : `/music/${activeTrack.file.replace(/^\/+/, "")}`;
    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }
    if (musicPlaying) {
      audio.play().catch(() => {
        setMusicPlaying(false);
        setWarn(
          "Music playback needs manual interaction. Click Play again to start."
        );
      });
    }
  }, [config.app_ui?.music?.enabled, activeTrack, musicPlaying]);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (activeTracks.length <= 1) {
        setMusicPlaying(false);
        return;
      }
      setMusicIndex((prev) => (prev + 1) % activeTracks.length);
    };
    const onError = () => {
      setMusicPlaying(false);
      setMusicLoadError(
        activeTrack?.file
          ? `Could not load track: ${activeTrack.file}`
          : "Could not load selected track."
      );
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [activeTracks, activeTrack?.file]);

  useEffect(() => {
    if (
      effectiveTemplates.length > 0 &&
      !effectiveTemplates.some(
        (tpl) => tpl.id === selectedTemplateId
      )
    ) {
      setSelectedTemplateId(effectiveTemplates[0].id);
    }
  }, [effectiveTemplates, selectedTemplateId]);

  useEffect(() => {
    if (!guidedTourOpen || !activeTourStep) {
      setGuidedTourRect(null);
      return;
    }

    if (tab !== activeTourStep.tab) {
      setTab(activeTourStep.tab);
      setGuidedTourRect(null);
    }

    let cancelled = false;
    const updateRect = () => {
      if (cancelled) return;
      const target = document.querySelector(
        `[data-tour="${activeTourStep.selector}"]`
      ) as HTMLElement | null;
      if (!target) {
        setGuidedTourRect(null);
        return;
      }
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        setGuidedTourRect(target.getBoundingClientRect());
      });
    };

    const focusStep = () => {
      if (cancelled) return;
      const target = document.querySelector(
        `[data-tour="${activeTourStep.selector}"]`
      ) as HTMLElement | null;
      if (!target) {
        setGuidedTourRect(null);
        return;
      }
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      updateRect();
    };

    const timer = window.setTimeout(
      focusStep,
      tab === activeTourStep.tab ? 120 : 300
    );

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [guidedTourOpen, activeTourStep, tab]);

  // Autosave
  useEffect(() => {
    if (!text.trim()) return;
    const timer = setTimeout(() => {
      localStorage.setItem("nf_draft", text);
      setSavedAt(new Date());
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Auto-analyze
  useEffect(() => {
    doAnalyze();
  }, [doAnalyze]);

  // Online preview uses backend rendering for theme-accurate output, with local fallback.
  useEffect(() => {
    if (!(showPreview || splitPreview) || !text.trim()) {
      setRemotePreviewHTML("");
      return;
    }
    if (online !== "online") {
      setRemotePreviewHTML("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const margins = {
          top: (config.page?.margins?.top || 1) * 25.4,
          bottom: (config.page?.margins?.bottom || 1) * 25.4,
          left: (config.page?.margins?.left || 1) * 25.4,
          right: (config.page?.margins?.right || 1) * 25.4,
        };
        const previewTheme = {
          name: themes[currentTheme]?.name || currentTheme,
          primaryColor:
            config.colors?.h1 || config.header?.color || "#1F3A5F",
          fontFamily:
            config.fonts?.family || "Times New Roman, Georgia, serif",
          headingStyle: {
            h1: {
              size: config.fonts?.sizes?.h1 || 24,
              weight: "700",
              color:
                config.colors?.h1 ||
                config.header?.color ||
                "#1F3A5F",
            },
            h2: {
              size: config.fonts?.sizes?.h2 || 20,
              weight: "600",
              color:
                config.colors?.h2 ||
                config.header?.color ||
                "#1F3A5F",
            },
            h3: {
              size: config.fonts?.sizes?.h3 || 16,
              weight: "600",
              color:
                config.colors?.h3 ||
                config.colors?.h2 ||
                "#2B6CB0",
            },
            h4: {
              size: config.fonts?.sizes?.h4 || 14,
              weight: "600",
              color:
                config.colors?.h4 ||
                config.colors?.h3 ||
                "#2B6CB0",
            },
            h5: {
              size: config.fonts?.sizes?.h5 || 13,
              weight: "600",
              color:
                config.colors?.h5 ||
                config.colors?.h4 ||
                "#334155",
            },
            h6: {
              size: config.fonts?.sizes?.h6 || 12,
              weight: "600",
              color:
                config.colors?.h6 ||
                config.colors?.h5 ||
                "#475569",
            },
          },
          bodyStyle: {
            size: config.fonts?.sizes?.body || 11,
            lineHeight: normalizeLineSpacing(config.spacing?.line_spacing || 1.5),
          },
          tableStyle: {
            borderWidth: 1,
            borderColor: config.colors?.table_border || "#d1d5db",
            headerFill: config.colors?.table_header_bg || "#f3f4f6",
          },
          margins,
          styles: {
            tab_width: normalizeTabWidth(config.spacing?.tab_width || 4),
            paragraph_spacing_before:
              config.spacing?.paragraph_spacing_before ?? 0,
            paragraph_spacing_after:
              config.spacing?.paragraph_spacing_after ?? 0,
            heading_spacing_before:
              config.spacing?.heading_spacing_before ?? 0,
            heading_spacing_after:
              config.spacing?.heading_spacing_after ?? 0,
            bullet_base_indent:
              config.spacing?.bullet_base_indent ?? 0.25,
            bullet_indent_per_level:
              config.spacing?.bullet_indent_per_level ?? 0.25,
            code_indent:
              config.spacing?.code_indent ?? 0,
            quote_indent:
              config.spacing?.quote_indent ?? 0.5,
            paragraph_first_line_indent:
              config.spacing?.paragraph_first_line_indent ?? 0,
            paragraph_alignment:
              config.spacing?.paragraph_alignment || "left",
            body_color:
              config.colors?.body || "#17202a",
            code_background:
              config.colors?.code_background || "#0f172a",
            code_text:
              config.colors?.code_text || "#e2e8f0",
            table_header_text:
              config.colors?.table_header_text || "#111827",
            table_odd_row:
              config.colors?.table_odd_row || "#ffffff",
            table_even_row:
              config.colors?.table_even_row || "#f8fafc",
            link_color:
              config.colors?.link || "#2563eb",
            h1_family:
              config.fonts?.h1_family ||
              config.fonts?.family ||
              "Calibri",
            h2_family:
              config.fonts?.h2_family ||
              config.fonts?.family ||
              "Calibri",
            h3_family:
              config.fonts?.h3_family ||
              config.fonts?.family ||
              "Calibri",
            h4_family:
              config.fonts?.h4_family ||
              config.fonts?.family ||
              "Calibri",
            h5_family:
              config.fonts?.h5_family ||
              config.fonts?.family ||
              "Calibri",
            h6_family:
              config.fonts?.h6_family ||
              config.fonts?.family ||
              "Calibri",
            bullet_font_family:
              config.fonts?.bullet_family ||
              config.fonts?.family ||
              "Calibri",
            code_font_family:
              config.fonts?.family_code || "JetBrains Mono",
            code_font_size:
              config.fonts?.sizes?.code || 10,
            header_alignment: config.header?.alignment || "center",
            footer_alignment: config.footer?.alignment || "center",
            header_font_family:
              config.header?.font_family || config.fonts?.family || "Calibri",
            footer_font_family:
              config.footer?.font_family || config.fonts?.family || "Calibri",
            header_size:
              config.header?.size || config.fonts?.sizes?.header || 10,
            footer_size:
              config.footer?.size || config.fonts?.sizes?.footer || 9,
            header_color:
              config.header?.color || config.colors?.h1 || "#1F3A5F",
            footer_color:
              config.footer?.color || config.colors?.h2 || "#1F3A5F",
            header_show_page_numbers: config.header?.show_page_numbers ?? false,
            footer_show_page_numbers: config.footer?.show_page_numbers ?? true,
            page_number_position:
              config.footer?.page_number_position ||
              config.header?.page_number_position ||
              "footer",
            page_number_alignment:
              config.footer?.page_number_alignment ||
              config.header?.page_number_alignment ||
              "center",
            page_number_style:
              config.footer?.page_number_style ||
              config.header?.page_number_style ||
              "arabic",
            page_number_format:
              config.footer?.page_format ||
              config.header?.page_format ||
              "Page X",
            page_number_mode:
              (config.footer?.page_format || config.header?.page_format || "")
                .toLowerCase()
                .includes("of")
                ? "page_x_of_y"
                : "page_x",
          },
        };

        const previewResponse = await apiPost<{
          previewHtml?: string;
        }>(API_ENDPOINTS.preview, {
          content: text,
          theme: previewTheme,
          formattingOptions: {
            margins,
            lineSpacing: normalizeLineSpacing(config.spacing?.line_spacing || 1.5),
          },
          security: {
            removeMetadata: false,
            watermark:
              config.watermark?.enabled &&
              (config.watermark?.text ||
                config.watermark?.image_path)
                ? {
                    type:
                      config.watermark?.type === "image"
                        ? "image"
                        : "text",
                    value:
                      config.watermark?.type === "image"
                        ? config.watermark?.image_path || ""
                        : config.watermark?.text || "",
                    position: "center",
                    fontFamily:
                      config.watermark?.font ||
                      config.fonts?.family ||
                      "Calibri",
                    size: config.watermark?.size || 48,
                    color:
                      config.watermark?.color || "#CCCCCC",
                    opacity:
                      config.watermark?.opacity ?? 0.15,
                    rotation:
                      config.watermark?.rotation ?? 315,
                    scale: config.watermark?.scale || 38,
                  }
                : undefined,
            pageNumberMode:
              config.footer?.show_page_numbers || config.header?.show_page_numbers
                ? ((config.footer?.page_format || config.header?.page_format || "")
                    .toLowerCase()
                    .includes("of")
                    ? "page_x_of_y"
                    : "page_x")
                : undefined,
            headerText: config.header?.enabled ? config.header?.text || "" : "",
            footerText: config.footer?.enabled ? config.footer?.text || "" : "",
          },
        });

        if (!cancelled) {
          setRemotePreviewHTML(previewResponse?.previewHtml || "");
        }
      } catch {
        if (!cancelled) {
          setRemotePreviewHTML("");
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    showPreview,
    splitPreview,
    text,
    online,
    config,
    themes,
    currentTheme,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        ctrl &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
      if (ctrl && e.key === "f") {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
      if (ctrl && e.key === "s") {
        e.preventDefault();
        doGenerate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, doGenerate]);

  // Image paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (
        !taRef.current ||
        document.activeElement !== taRef.current
      )
        return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (!blob) continue;
          if (blob.size > MAX_IMAGE_BYTES) {
            setError(
              "Image too large (max 2 MB). Use a smaller image or server upload."
            );
            return;
          }

          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64 = evt.target?.result as string;
            const ts = Date.now();
            try {
              localStorage.setItem(
                `nf_image_${ts}`,
                base64
              );
              const marker = `IMAGE: "pasted_image_${ts}.png" | "Pasted image" | "center"`;
              const pos =
                taRef.current?.selectionStart ?? text.length;
              handleText(
                `${text.slice(0, pos)}\n${marker}\n${text.slice(pos)}`
              );
              setSuccess("📸 Image pasted!");
            } catch {
              setError(
                "Storage full. Clear old images or use smaller files."
              );
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () =>
      window.removeEventListener("paste", handlePaste);
  }, [text, handleText]);

  // ═════════════════════════════════════════════════════════════
  // STYLE HELPERS
  // ═════════════════════════════════════════════════════════════

  const card = `rounded-2xl shadow-xl border ${
    dark
      ? "bg-gray-800 border-gray-700"
      : "bg-white border-gray-200"
  }`;

  const lbl = `block text-sm font-medium mb-1 ${
    dark ? "text-gray-300" : "text-gray-700"
  }`;

  const inp = `w-full px-3 py-2 rounded-lg border text-sm ${
    dark
      ? "bg-gray-700 border-gray-600 text-gray-200"
      : "bg-white border-gray-300 text-gray-900"
  }`;

  const tbtn = (on: boolean) =>
    `px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
      on
        ? dark
          ? "bg-white/20 shadow-inner"
          : "bg-white/30 shadow-inner"
        : dark
          ? "bg-white/5 hover:bg-white/10"
          : "bg-white/10 hover:bg-white/20"
    }`;

  const MARKER_BUTTONS: { label: string; color: string }[] = [
    { label: 'HEADING: "Title"', color: "orange" },
    { label: 'PARAGRAPH: "Text"', color: "gray" },
    { label: 'BULLET: "Point"', color: "purple" },
    { label: 'CODE: "code"', color: "slate" },
    { label: 'TABLE: "A | B"', color: "teal" },
    { label: 'NOTE: "Info"', color: "green" },
    { label: "PAGEBREAK:", color: "gray" },
  ];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ring-1 ${modeShellRing} ${
        dark
          ? `${activeUiTheme.rootDark} text-gray-100`
          : `${activeUiTheme.rootLight} text-gray-900`
      }`}
    >
      {/* ────────────────────────────────────────────────────────
          HEADER
      ──────────────────────────────────────────────────────── */}
      <header
        className={`shadow-2xl ${
          dark ? activeUiTheme.headerDark : activeUiTheme.headerLight
        } text-white`}
      >
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Quick Doc Formatter
                </h1>
                <p className="text-xs text-white/60">
                  v8.0.0 · Full Featured
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 bg-white/10">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      online === "online"
                        ? "bg-green-400 animate-pulse"
                        : online === "error"
                          ? "bg-orange-400"
                          : "bg-yellow-400"
                    }`}
                  />
                  {online === "online"
                    ? "Connected"
                    : online === "error"
                      ? "Connection issue"
                      : loadingHealth
                        ? "Checking backend"
                        : "Waking backend"}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs bg-white/10">
                  API v{backendVersion}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs bg-white/10">
                  UI {activeUiTheme.name}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs bg-gradient-to-r ${activeMode.pill}`}
                >
                  {activeMode.label}
                </span>

                {savedAt && (
                  <span className="px-2.5 py-1 rounded-lg text-xs bg-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Saved
                  </span>
                )}

                {dirty && (
                  <span className="px-2.5 py-1 rounded-lg text-xs bg-yellow-500/30 text-yellow-200">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    Unsaved
                  </span>
                )}

                <button
                  onClick={() => setDark(!dark)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"
                  title="Toggle dark mode"
                >
                  {dark ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"
                  title="Toggle fullscreen"
                >
                  {fullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <label className="text-[11px] text-white/80">
                  Theme
                </label>
                <select
                  value={currentUiThemeKey}
                  onChange={(e) =>
                    cfgLocal("app_ui.theme", e.target.value)
                  }
                  className="text-xs rounded-lg bg-black/20 border border-white/20 px-2 py-1"
                >
                  {Object.entries(APP_UI_THEMES).map(([key, info]) => (
                    <option key={key} value={key} className="text-black">
                      {info.name}
                    </option>
                  ))}
                </select>

                <label className="text-[11px] text-white/80">
                  Mode
                </label>
                <select
                  value={currentMode}
                  onChange={(e) =>
                    cfgLocal("app_ui.mode", normalizeMode(e.target.value))
                  }
                  className="text-xs rounded-lg bg-black/20 border border-white/20 px-2 py-1"
                >
                  {MODE_ORDER.map((mode) => (
                    <option key={mode} value={mode} className="text-black">
                      {MODE_PROFILES[mode].label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    cfgLocal(
                      "app_ui.music.enabled",
                      !config.app_ui?.music?.enabled
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border ${
                    config.app_ui?.music?.enabled
                      ? "bg-emerald-500/20 border-emerald-300/40"
                      : "bg-white/10 border-white/20"
                  }`}
                  title="Enable or disable mode music"
                >
                  <Music2 className="w-3 h-3" />
                  {config.app_ui?.music?.enabled ? "Music On" : "Music Off"}
                </button>

                <div className="flex items-center gap-1 rounded-lg bg-black/20 border border-white/20 px-1 py-1">
                  <button
                    onClick={prevTrack}
                    className="p-1 rounded hover:bg-white/10"
                    title="Previous track"
                    disabled={!config.app_ui?.music?.enabled || activeTracks.length === 0}
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={toggleMusicPlayback}
                    className="p-1 rounded hover:bg-white/10"
                    title="Play/Pause music"
                    disabled={!config.app_ui?.music?.enabled || activeTracks.length === 0}
                  >
                    {musicPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={nextTrack}
                    className="p-1 rounded hover:bg-white/10"
                    title="Next track"
                    disabled={!config.app_ui?.music?.enabled || activeTracks.length === 0}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-black/20 border border-white/20 rounded-lg px-2 py-1">
                  {Number(config.app_ui?.music?.volume || 0) <= 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-white/70" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-white/70" />
                  )}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(config.app_ui?.music?.volume ?? 0.35)}
                    onChange={(e) =>
                      cfgLocal("app_ui.music.volume", Number(e.target.value))
                    }
                    disabled={!config.app_ui?.music?.enabled}
                    className="w-20 accent-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* NAV TABS */}
          <nav className="flex gap-2 mt-4 flex-wrap">
            {(
              [
                ["editor", "Editor", FileText],
                ["templates", "Templates", BookOpen],
                ["guide", "New User", Sparkles],
                ["settings", "Settings", Settings],
                ["prompt", "AI Prompt", Bot],
                ["shortcuts", "Shortcuts", Keyboard],
              ] as const
            ).map(([t, label, Icon]) => (
              <button
                key={t}
                onClick={() => setTab(t as TabId)}
                data-tour={`nav-${t}`}
                className={tbtn(tab === t)}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {t === "settings" && dirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────
          MAIN
      ──────────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* ALERTS */}
        {(
          [
            [error, "red", AlertCircle, setError],
            [success, "green", CheckCircle, setSuccess],
            [warn, "yellow", AlertCircle, setWarn],
          ] as [
            string | null,
            string,
            typeof AlertCircle,
            React.Dispatch<React.SetStateAction<string | null>>,
          ][]
        ).map(
          ([msg, color, Icon, clear]) =>
            msg && (
              <div
                key={color}
                className={`mb-4 p-3 rounded-xl flex items-center gap-3 text-sm border-2 ${ALERT_STYLES[color]}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{msg}</span>
                <button onClick={() => clear(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
        )}

        {!HAS_EXPLICIT_API_URL && (
          <div
            className={`${card} mb-4 p-3 text-sm border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300`}
          >
            `VITE_API_URL` is not set. Using default backend: {API}
          </div>
        )}

        {online !== "online" && (
          <div
            className={`${card} mb-4 p-3 flex items-center justify-between gap-3 ${
              online === "error"
                ? "border-orange-200 dark:border-orange-800"
                : "border-yellow-200 dark:border-yellow-800"
            }`}
          >
            <div
              className={`text-sm ${
                online === "error"
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-yellow-700 dark:text-yellow-300"
              }`}
            >
              {online === "error"
                ? "Backend is unreachable right now. Retry after a few seconds."
                : "Backend is waking up. Keep this tab open while retry checks run."}
            </div>
            <button
              onClick={checkHealth}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                online === "error"
                  ? "bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
                  : "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50"
              }`}
            >
              Retry
            </button>
          </div>
        )}

        {(loadingHealth ||
          loadingThemes ||
          loadingTemplates ||
          loadingConfig ||
          loadingPrompt) && (
          <div
            className={`${card} mb-4 p-3 flex items-center gap-3 text-sm border-blue-200 dark:border-blue-800`}
          >
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="font-medium text-blue-700 dark:text-blue-300">
              Syncing backend resources
            </span>
            <span className="text-xs text-blue-600/90 dark:text-blue-300/80">
              {[
                loadingHealth && "health",
                loadingThemes && "themes",
                loadingTemplates && "templates",
                loadingConfig && "config",
                loadingPrompt && "prompt",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            EDITOR TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "editor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* LEFT: Editor */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Toolbar */}
              <div
                data-tour="editor-toolbar"
                className={`${card} p-3 flex items-center gap-2 flex-wrap`}
              >
                <button
                  onClick={undo}
                  disabled={hIdx <= 0}
                  title="Undo (Ctrl+Z)"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={hIdx >= history.length - 1}
                  title="Redo (Ctrl+Y)"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSearch((s) => !s)}
                  title="Find & Replace (Ctrl+F)"
                  className={`p-2 rounded-lg ${
                    showSearch
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowPreview((p) => !p)}
                  title="Toggle Live Preview"
                  className={`p-2 rounded-lg ${
                    showPreview
                      ? "bg-green-100 dark:bg-green-900/40 text-green-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSplitPreview((v) => !v)}
                  title="Toggle Split Preview"
                  className={`p-2 rounded-lg ${
                    splitPreview
                      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Layout className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDrafts(true)}
                  title="Manage Drafts"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
                >
                  <Folder className="w-4 h-4" />
                  {savedDrafts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                      {savedDrafts.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setStrictMode((v) => !v)}
                  title="Strict Mode"
                  className={`px-2 py-1 rounded-lg text-xs font-semibold border ${
                    strictMode
                      ? "bg-red-100 dark:bg-red-900/40 text-red-600 border-red-300 dark:border-red-700"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent"
                  }`}
                >
                  Strict {strictMode ? "ON" : "OFF"}
                </button>

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
                <span className="text-xs text-gray-400">
                  {stats.words} words
                </span>
                <span className="text-xs text-gray-400">
                  {stats.chars} chars
                </span>
                <span className="text-xs text-gray-400">
                  {stats.mins} min read
                </span>

                {allMarkerErrors.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {allMarkerErrors.length} warning
                    {allMarkerErrors.length > 1 ? "s" : ""}
                  </span>
                )}

                <div className="flex-1" />
                <button
                  onClick={() => {
                    handleText(SAMPLE_EXAMPLE);
                    setShowPreview(true);
                    setSplitPreview(true);
                  }}
                  className="text-xs text-purple-500 hover:underline px-2"
                >
                  Try Example
                </button>
                <button
                  onClick={() => handleText("")}
                  className="text-xs text-red-400 hover:underline px-2"
                >
                  Clear
                </button>
              </div>

              {showOnboarding && (
                <div className={`${card} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm mb-1">
                        How Quick Doc Formatter Works
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Write simple markers, then export
                        polished documents.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openGuidedTour(0)}
                        className="text-xs px-2 py-1 rounded bg-purple-600 text-white"
                      >
                        Start tour
                      </button>
                      <button
                        onClick={() =>
                          setOnboardingExpanded((v) => !v)
                        }
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600"
                      >
                        {onboardingExpanded
                          ? "Collapse"
                          : "Expand"}
                      </button>
                      <button
                        onClick={dismissOnboarding}
                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                      >
                        Got it
                      </button>
                    </div>
                  </div>

                  {onboardingExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div
                        className={`rounded-lg p-3 text-xs font-mono ${
                          dark
                            ? "bg-gray-900 text-gray-300"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        HEADING: "Weekly Plan"
                        <br />
                        BULLET: "Finish API docs"
                        <br />
                        BULLET: "Ship v7.1"
                      </div>
                      <div
                        className={`rounded-lg p-3 text-xs ${
                          dark
                            ? "bg-gray-900 text-gray-300"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        <p className="font-semibold mb-1">
                          Result
                        </p>
                        <p>Big heading + clean bullet list in exported file.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Marker Errors */}
              {allMarkerErrors.length > 0 && (
                <div className={`${card} p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-semibold text-sm">
                      Marker Checks ({allMarkerErrors.length})
                    </span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {allMarkerErrors.map((err, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                          err.severity === "error"
                            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                            : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300"
                        }`}
                      >
                        <span className="font-bold">
                          Line {err.line}:
                        </span>
                        <span className="flex-1">
                          {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Panel */}
              {showSearch && (
                <div className={`${card} p-4`}>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      value={searchQ}
                      onChange={(e) =>
                        setSearchQ(e.target.value)
                      }
                      placeholder="Search…"
                      className={inp}
                      onKeyDown={(e) =>
                        e.key === "Enter" && doSearch()
                      }
                    />
                    <input
                      value={replaceQ}
                      onChange={(e) =>
                        setReplaceQ(e.target.value)
                      }
                      placeholder="Replace with…"
                      className={inp}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={doSearch}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                      Find Next
                    </button>
                    <button
                      onClick={doReplace}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                    >
                      Replace All
                    </button>
                    <button
                      onClick={() => setShowSearch(false)}
                      className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Live Preview */}
              {showPreview && !splitPreview && (
                <div className={`${card} overflow-hidden`}>
                  <div
                    className={`px-5 py-3 border-b flex items-center justify-between ${
                      dark
                        ? "border-gray-700 bg-gray-700/40"
                        : "border-gray-100 bg-green-50"
                    }`}
                  >
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-green-600" />
                      Live Preview
                    </span>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div
                    className={`p-5 max-h-[400px] overflow-y-auto ${
                      dark ? "bg-gray-900" : "bg-white"
                    }`}
                    dangerouslySetInnerHTML={{
                      __html:
                        activePreviewHTML ||
                        (loadingPreview
                          ? '<p class="text-sm text-gray-400">Rendering preview...</p>'
                          : '<p class="text-sm text-gray-400">Start typing to preview...</p>'),
                    }}
                  />
                </div>
              )}

              {/* Editor Textarea */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`${card} overflow-hidden relative ${
                  isDragging
                    ? "ring-4 ring-blue-500 ring-opacity-50"
                    : ""
                }`}
              >
                {/* Drag overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-10 flex items-center justify-center border-4 border-dashed border-blue-500">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl text-center">
                      <Upload className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                      <p className="text-lg font-bold text-blue-600">
                        Drop .txt or .md file here
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        File will load into editor
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick insert hints */}
                {!text.trim() && (
                  <div
                    className={`px-6 py-4 border-b ${
                      dark
                        ? "border-gray-700 bg-gray-900/40"
                        : "border-gray-100 bg-blue-50/50"
                    }`}
                  >
                    <p className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                      <ImagePlus className="w-4 h-4" />
                      Paste images from clipboard · Drop
                      .txt/.md files · Load from drafts ·
                      Use New User tab for step-by-step guide
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MARKER_BUTTONS.map((btn) => (
                        <button
                          key={btn.label}
                          onClick={() =>
                            handleText(
                              text +
                                (text ? "\n" : "") +
                                btn.label
                            )
                          }
                          className={`text-xs font-mono px-2.5 py-1 rounded-lg border bg-white dark:bg-gray-800 ${MARKER_BUTTON_STYLES[btn.color]} transition-colors`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`${
                    splitPreview
                      ? "grid grid-cols-1 xl:grid-cols-2"
                      : "block"
                  }`}
                >
                  <div
                    className={`flex ${
                      splitPreview
                        ? "xl:border-r xl:border-gray-200 xl:dark:border-gray-700"
                        : ""
                    }`}
                  >
                    <div
                      ref={lineNumRef}
                      className={`w-12 shrink-0 px-2 py-5 text-right font-mono text-xs select-none overflow-hidden ${
                        dark
                          ? "bg-gray-900 text-gray-500"
                          : "bg-gray-50 text-gray-400"
                      } ${
                        fullscreen
                          ? "h-[calc(100vh-260px)]"
                          : "h-[440px]"
                      }`}
                    >
                      <pre className="leading-relaxed">
                        {lineNumbers}
                      </pre>
                    </div>
                    <textarea
                      data-tour="editor-textarea"
                      ref={taRef}
                      value={text}
                      onChange={(e) => {
                        handleText(e.target.value);
                        refreshMarkerSuggestions(
                          e.target.value,
                          e.target.selectionStart
                        );
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Tab" &&
                          markerSuggestions.length > 0
                        ) {
                          e.preventDefault();
                          applyMarkerSuggestion(
                            markerSuggestions[0]
                          );
                          return;
                        }
                        if (
                          e.ctrlKey &&
                          e.key.toLowerCase() === " "
                        ) {
                          e.preventDefault();
                          const pos =
                            e.currentTarget.selectionStart ??
                            text.length;
                          refreshMarkerSuggestions(
                            e.currentTarget.value,
                            pos
                          );
                        }
                      }}
                      onClick={(e) =>
                        refreshMarkerSuggestions(
                          e.currentTarget.value,
                          e.currentTarget.selectionStart
                        )
                      }
                      onScroll={(e) => {
                        if (lineNumRef.current) {
                          lineNumRef.current.scrollTop =
                            e.currentTarget.scrollTop;
                        }
                      }}
                      spellCheck={false}
                      placeholder={`Start typing with markers, or:\n• Drag & drop a .txt/.md file here\n• Paste an image from clipboard (Ctrl+V)\n• Click 'Manage Drafts' to save/load multiple documents\n\nHEADING: "My Document"\nPARAGRAPH: "Introduction..."\nBULLET: "First point"`}
                      className={`flex-1 p-5 font-mono text-sm resize-none focus:outline-none leading-relaxed ${
                        fullscreen
                          ? "h-[calc(100vh-260px)]"
                          : "h-[440px]"
                      } ${
                        dark
                          ? "bg-gray-800 text-gray-100 placeholder-gray-600"
                          : "bg-white text-gray-900 placeholder-gray-400"
                      }`}
                    />
                  </div>

                  {markerSuggestions.length > 0 && (
                    <div
                      className={`px-4 py-2 border-t ${
                        dark
                          ? "border-gray-700 bg-gray-900/70"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <p className="text-[11px] text-gray-500 mb-1">
                        Marker autocomplete (Tab to insert):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {markerSuggestions.map((marker) => (
                          <button
                            key={marker}
                            onClick={() =>
                              applyMarkerSuggestion(marker)
                            }
                            className={`px-2 py-1 rounded-md text-left text-xs border ${
                              dark
                                ? "border-gray-600 hover:bg-gray-700"
                                : "border-gray-300 hover:bg-white"
                            }`}
                          >
                            <div className="font-mono font-semibold">
                              {marker}
                            </div>
                            <div className="text-[10px] opacity-70">
                              {markerMap
                                .get(marker.replace(":", "").toUpperCase())
                                ?.description || "Marker"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {splitPreview && (
                    <div
                      className={`p-5 overflow-y-auto ${
                        fullscreen
                          ? "h-[calc(100vh-260px)]"
                          : "h-[440px]"
                      } ${
                        dark
                          ? "bg-gray-900"
                          : "bg-white"
                      }`}
                      dangerouslySetInnerHTML={{
                        __html:
                          activePreviewHTML ||
                          (loadingPreview
                            ? '<p class="text-sm text-gray-400">Rendering preview...</p>'
                            : '<p class="text-sm text-gray-400">Start typing to preview...</p>'),
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Generate Bar */}
              <div data-tour="generate-bar" className={`${card} p-4 sticky bottom-2 z-20 md:static`}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      value={customName}
                      onChange={(e) =>
                        setCustomName(e.target.value)
                      }
                      placeholder="Filename (optional)"
                      className={`${inp} max-w-[160px]`}
                    />
                  </div>
                  <select
                    value={format}
                    onChange={(e) =>
                      setFormat(
                        e.target.value as ExportFormat
                      )
                    }
                    className={`${inp} w-auto`}
                  >
                    <option value="docx">
                      Word (.docx)
                    </option>
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="md">
                      Markdown (.md)
                    </option>
                    <option value="html">
                      HTML (.html)
                    </option>
                    <option value="txt">
                      Text (.txt)
                    </option>
                  </select>
                  <button
                    onClick={doGenerate}
                    disabled={
                      generating ||
                      !text.trim() ||
                      online !== "online"
                    }
                    className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-bold py-3 px-5 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Document
                        <Download className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
                {generating && generateProgress !== null && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{generateStatusLabel || "Processing..."}</span>
                      <span>{Math.round(generateProgress)}%</span>
                    </div>
                    <div className={`h-2 rounded-full ${dark ? "bg-gray-800" : "bg-gray-200"}`}>
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, generateProgress))}%` }}
                      />
                    </div>
                  </div>
                )}
                {format === "pdf" && (
                  <p className="text-xs mt-2 text-gray-400">
                    PDF export always returns a PDF. If primary converters fail, Quick Doc Formatter uses fallback engines and keeps the response format as PDF.
                  </p>
                )}
              </div>

              {recentExports.length > 0 && (
                <div className={`${card} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Recent Exports
                    </h3>
                    <button
                      onClick={() => {
                        setRecentExports([]);
                        localStorage.removeItem(
                          "nf_recent_exports"
                        );
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2">
                    {recentExports.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                          dark
                            ? "border-gray-700 bg-gray-800/70"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {item.filename}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(
                              item.createdAt
                            ).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            downloadRecentExport(item)
                          }
                          className="px-2.5 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Stats & Preview */}
            <div className="flex flex-col gap-4">
              {/* Stats */}
              <div className={`${card} p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  <h3 className="font-bold text-sm">
                    Live Statistics
                  </h3>
                  {analyzing && (
                    <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                  )}
                </div>
                {analysis ? (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div
                        className={`rounded-xl p-3 ${
                          dark
                            ? "bg-blue-900/30 border border-blue-800"
                            : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <div className="text-2xl font-bold text-blue-600">
                          {analysis.total_lines}
                        </div>
                        <div className="text-xs text-blue-500">
                          Lines
                        </div>
                      </div>
                      <div
                        className={`rounded-xl p-3 ${
                          dark
                            ? "bg-purple-900/30 border border-purple-800"
                            : "bg-purple-50 border border-purple-200"
                        }`}
                      >
                        <div className="text-2xl font-bold text-purple-600">
                          {Object.values(
                            analysis.statistics
                          ).reduce((a, b) => a + b, 0)}
                        </div>
                        <div className="text-xs text-purple-500">
                          Elements
                        </div>
                      </div>
                    </div>
                    {Object.entries(analysis.statistics)
                      .filter(([k]) => k !== "empty")
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <div
                          key={type}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            dark
                              ? "bg-gray-700/50"
                              : "bg-gray-50"
                          }`}
                        >
                          <div
                            className={`${
                              TYPE_COLOR[type] ||
                              "bg-gray-500"
                            } text-white p-1.5 rounded shrink-0`}
                          >
                            {TYPE_ICON[type] || (
                              <Type className="w-3 h-3" />
                            )}
                          </div>
                          <span className="text-xs flex-1 capitalize">
                            {type.replace("_", " ")}
                          </span>
                          <span className="text-sm font-bold">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <Eye className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      Start typing to see analysis
                    </p>
                  </div>
                )}
              </div>

              {/* Element Preview */}
              {analysis &&
                analysis.preview.length > 0 && (
                  <div className={`${card} p-5`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Eye className="w-5 h-5 text-green-500" />
                      <h3 className="font-bold text-sm">
                        Element Preview
                      </h3>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {analysis.preview
                        .filter((r) => r.type !== "empty")
                        .slice(0, 10)
                        .map((row, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded-lg ${
                              dark
                                ? "bg-gray-700/50"
                                : "bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`${
                                  TYPE_COLOR[row.type] ||
                                  "bg-gray-500"
                                } text-white text-xs px-1.5 py-0.5 rounded font-bold`}
                              >
                                {row.type.toUpperCase()}
                              </span>
                              {(row.indent_level ?? 0) >
                                0 && (
                                <span className="text-xs text-gray-400">
                                  ↳L{row.indent_level}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono truncate text-gray-500 dark:text-gray-400">
                              {row.content}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TEMPLATES TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "templates" && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className={`${card} overflow-hidden`}>
              <div
                className={`px-6 py-4 ${
                  dark
                    ? "bg-gray-700/50"
                    : "bg-gradient-to-r from-purple-50 to-orange-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold mb-1">
                      Document Templates
                    </h2>
                    <p
                      className={`text-sm ${
                        dark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Select a structure, load it into the editor,
                      then fill in your content and generate.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      data-tour="template-import"
                      onClick={() =>
                        templateImportInputRef.current?.click()
                      }
                      className="px-3 py-2 rounded-lg text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20 flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Import Templates
                    </button>
                    <button
                      onClick={downloadSampleTemplateJson}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                        dark
                          ? "border-gray-600 hover:bg-gray-700"
                          : "border-gray-300 hover:bg-gray-50"
                      } flex items-center gap-2`}
                    >
                      <Download className="w-4 h-4" />
                      Sample Template JSON
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Templates explanation */}
                <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 flex items-center gap-2 text-white">
                    <BookOpen className="w-5 h-5" />
                    <span className="font-bold">
                      Templates = Content Structure
                    </span>
                    <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      This tab
                    </span>
                  </div>
                  <div
                    className={`p-4 ${
                      dark
                        ? "bg-purple-900/10"
                        : "bg-purple-50/50"
                    }`}
                  >
                    <p
                      className={`text-sm leading-relaxed mb-3 ${
                        dark
                          ? "text-gray-300"
                          : "text-gray-700"
                      }`}
                    >
                      Templates are{" "}
                      <strong>
                        pre-written document skeletons
                      </strong>
                      . They define{" "}
                      <em>what information goes in</em> and in
                      what order.
                    </p>
                    <div
                      className={`rounded-lg p-3 font-mono text-xs ${
                        dark
                          ? "bg-gray-900 text-purple-300"
                          : "bg-white text-purple-700"
                      } border border-purple-200 dark:border-purple-800 leading-relaxed`}
                    >
                      <div className="text-gray-400 mb-1">
                        # Example: Meeting template
                      </div>
                      HEADING: "Meeting Notes"
                      <br />
                      SUBHEADING: "Agenda"
                      <br />
                      BULLET: "[Item 1]"
                      <br />
                      TABLE: "Task | Owner | Due"
                    </div>
                    <p
                      className={`text-xs mt-2 ${
                        dark
                          ? "text-purple-400"
                          : "text-purple-600"
                      }`}
                    >
                      ✓ Choose template → Fill brackets →
                      Generate
                    </p>
                  </div>
                </div>

                {/* Themes explanation */}
                <div className="rounded-2xl border-2 border-orange-200 dark:border-orange-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-3 flex items-center gap-2 text-white">
                    <Palette className="w-5 h-5" />
                    <span className="font-bold">
                      Themes = Visual Style
                    </span>
                    <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      Settings tab
                    </span>
                  </div>
                  <div
                    className={`p-4 ${
                      dark
                        ? "bg-orange-900/10"
                        : "bg-orange-50/50"
                    }`}
                  >
                    <p
                      className={`text-sm leading-relaxed mb-3 ${
                        dark
                          ? "text-gray-300"
                          : "text-gray-700"
                      }`}
                    >
                      Themes control{" "}
                      <strong>
                        how the document looks
                      </strong>{" "}
                      when exported — fonts, colours, spacing.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        [
                          "Professional",
                          "Orange + Times New Roman",
                        ],
                        [
                          "Academic",
                          "Black + Double spacing",
                        ],
                        ["Modern", "Blue + Calibri"],
                        ["Tech", "Purple + code-friendly"],
                      ].map(([n, d]) => (
                        <div
                          key={n}
                          className={`rounded-lg px-3 py-2 text-xs ${
                            dark
                              ? "bg-gray-800 border border-gray-700"
                              : "bg-white border border-orange-200"
                          }`}
                        >
                          <div className="font-bold">
                            {n}
                          </div>
                          <div className="text-gray-400">
                            {d}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Cards */}
            {loadingTemplates && (
              <div
                className={`${card} p-3 text-xs text-gray-500 flex items-center gap-2`}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading template catalog…
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {effectiveTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    handleText(tpl.content);
                    setSelectedTemplateId(tpl.id);
                    setTab("editor");
                    setSuccess(`✅ Loaded: ${tpl.name}`);
                  }}
                  className={`${card} p-5 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 group`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">
                          {tpl.icon}
                        </span>
                        <h3 className="font-bold">
                          {tpl.name}
                        </h3>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          CATEGORY_BADGE[tpl.category] ||
                          CATEGORY_BADGE.default
                        }`}
                      >
                        {tpl.category}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-mono mb-4 p-2.5 rounded-lg leading-relaxed ${
                      dark
                        ? "bg-gray-900 text-gray-400"
                        : "bg-gray-50 text-gray-500"
                    } overflow-hidden`}
                    style={{ maxHeight: "72px" }}
                  >
                    {tpl.content
                      .split("\n")
                      .slice(0, 4)
                      .join("\n")}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tpl.content
                      .split("\n")
                      .filter((line) => line.includes(":"))
                      .slice(0, 4)
                      .map((line, idx) => (
                        <span
                          key={`${tpl.id}-${idx}`}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            dark
                              ? "bg-gray-700 text-gray-300"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {line.split(":")[0]}
                        </span>
                      ))}
                  </div>
                  <button className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium group-hover:opacity-90 transition-opacity">
                    Load Template →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            NEW USER GUIDE TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "guide" && (
          <div className="space-y-5">
            <div className={`${card} overflow-hidden`}>
              <div
                className={`px-6 py-4 ${
                  dark
                    ? "bg-gray-700/50"
                    : "bg-gradient-to-r from-blue-50 to-emerald-50"
                }`}
              >
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  New User Guide
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  First time using Quick Doc Formatter? Follow these 5 steps.
                </p>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  [
                    "1",
                    "Pick a starter",
                    "Open Templates and load Quick Start.",
                  ],
                  [
                    "2",
                    "Fill your content",
                    "Replace bracket text with your actual notes.",
                  ],
                  [
                    "3",
                    "Check preview",
                    "Use Live Preview and marker error list.",
                  ],
                  [
                    "4",
                    "Style document",
                    "Open Settings for fonts, footer, colors, and border.",
                  ],
                  [
                    "5",
                    "Generate file",
                    "Click Generate Document and download DOCX/PDF.",
                  ],
                ].map(([n, title, desc]) => (
                  <div
                    key={n}
                    className={`p-3 rounded-xl border ${
                      dark
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mb-2">
                      {n}
                    </div>
                    <div className="text-sm font-semibold mb-1">
                      {title}
                    </div>
                    <p className="text-xs text-gray-500">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-6 pb-6 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    handleText(TEMPLATES[0].content);
                    setTab("editor");
                    setSuccess("✅ Starter template loaded");
                  }}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                  Load Starter Template
                </button>
                <button
                  onClick={() => setTab("templates")}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${
                    dark
                      ? "border-gray-600 hover:bg-gray-700"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Browse All Templates
                </button>
                <button
                  onClick={() => setTab("settings")}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${
                    dark
                      ? "border-gray-600 hover:bg-gray-700"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Open Settings
                </button>
                <button
                  onClick={() => openGuidedTour(0)}
                  className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
                >
                  Start Guided Tour
                </button>
                <a
                  href="/guide"
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${
                    dark
                      ? "border-gray-600 hover:bg-gray-700"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Open /guide Page
                </a>
              </div>

              <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-2">
                    Strict Marker Playbook
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    In strict mode, every non-empty line must start with a marker.
                  </p>
                  <pre
                    className={`text-xs rounded-lg p-3 overflow-auto ${
                      dark
                        ? "bg-gray-900 text-gray-300"
                        : "bg-white text-gray-700"
                    }`}
                  >
{`H1: "Document Title"
H2: "Overview"
PARAGRAPH: "Single paragraph line."
CENTER: "Centered text"
RIGHT: "Right aligned text"
JUSTIFY: "Justified paragraph."
BULLET: "Main bullet"
BULLET: "  Nested bullet"
CODE: "print('hello')"
ASCII: "+---+"
TABLE: "Col A | Col B"
TABLE: "A1 | B1"
PAGEBREAK:
H2: "Next Page"`}
                  </pre>
                  <button
                    onClick={() => {
                      handleText(`H1: "Document Title"\nH2: "Overview"\nPARAGRAPH: "Single paragraph line."\nCENTER: "Centered text"\nRIGHT: "Right aligned text"\nJUSTIFY: "Justified paragraph."\nBULLET: "Main bullet"\nBULLET: "  Nested bullet"\nCODE: "print('hello')"\nASCII: "+---+"\nTABLE: "Col A | Col B"\nTABLE: "A1 | B1"\nPAGEBREAK:\nH2: "Next Page"`);
                      setTab("editor");
                      setStrictMode(true);
                      setSuccess("✅ Strict marker example loaded");
                    }}
                    className="mt-3 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Load Strict Example
                  </button>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-2">
                    Full Control Guide
                  </h3>
                  <div className="space-y-2 text-xs text-gray-500">
                    <p>
                      <strong>Alignment:</strong> use `CENTER:`, `RIGHT:`, `JUSTIFY:` markers.
                    </p>
                    <p>
                      <strong>Indent:</strong> use spaces inside `BULLET:` and set spacing controls in Settings → Spacing.
                    </p>
                    <p>
                      <strong>Page breaks:</strong> insert `PAGEBREAK:` where next section should start.
                    </p>
                    <p>
                      <strong>Page numbers:</strong> Settings → Page → Header/Footer → Page format (`Page X` or `Page X of Y`).
                    </p>
                    <p>
                      <strong>Fonts available:</strong> {availableFonts.length} text fonts, {availableCodeFonts.length} code fonts.
                    </p>
                    <p>
                      <strong>Theme customization:</strong> use Themes/Fonts/Colors/Spacing/Page tabs, then Save Settings.
                    </p>
                    <p>
                      <strong>Template + Prompt flow:</strong> Templates tab → pick template, AI Prompt tab → regenerate with topic, then generate.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setTab("prompt")}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Open AI Prompt
                    </button>
                    <button
                      onClick={() => setTab("settings")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                        dark
                          ? "border-gray-600 hover:bg-gray-700"
                          : "border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      Open Settings
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-2">
                    Run Modes (Local / Docker / Cloud)
                  </h3>
                  <pre
                    className={`text-[11px] rounded-lg p-3 overflow-auto ${
                      dark
                        ? "bg-gray-900 text-gray-300"
                        : "bg-white text-gray-700"
                    }`}
                  >
{`# Local (hot reload)
backend: python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 10000
frontend: npm run dev

# Docker
docker compose up --build

# Cloud
frontend: Vercel (Root: frontend)
backend: Render (Root: backend)`}
                  </pre>
                  <p className="text-xs text-gray-500 mt-2">
                    For PDF fidelity matching DOCX, keep LibreOffice available on backend.
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-3">
                    Main Interface Map
                  </h3>
                  <div className="space-y-2 text-xs text-gray-500">
                    <p>
                      <strong>Editor:</strong> write or paste marker-based content, then generate files.
                    </p>
                    <p>
                      <strong>Templates:</strong> load ready-made document structures or import your own template JSON.
                    </p>
                    <p>
                      <strong>Settings:</strong> change theme, fonts, colours, spacing, header, footer, watermark and page setup.
                    </p>
                    <p>
                      <strong>AI Prompt:</strong> prepare a reusable prompt, import prompt files, and regenerate template content.
                    </p>
                    <p>
                      <strong>Live Preview:</strong> check how headings, spacing and layout will look before export.
                    </p>
                    <p>
                      <strong>Generate Document:</strong> create DOCX, PDF, HTML, Markdown or TXT.
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-3">
                    Import and Export Flow
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-xs mb-1">
                        1. Theme JSON
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Import full styling: fonts, sizes, colours, spacing, page, header, footer and watermark.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setTab("settings")}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Open Theme Settings
                        </button>
                        <button
                          onClick={downloadSampleThemeJson}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                            dark
                              ? "border-gray-600 hover:bg-gray-700"
                              : "border-gray-300 hover:bg-white"
                          }`}
                        >
                          Download Theme Sample
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-xs mb-1">
                        2. Template JSON
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Import reusable content skeletons with markers like `H1:`, `TABLE:`, `ASCII:` and `CODE:`.
                      </p>
                      <button
                        onClick={downloadSampleTemplateJson}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                          dark
                            ? "border-gray-600 hover:bg-gray-700"
                            : "border-gray-300 hover:bg-white"
                        }`}
                      >
                        Download Template Sample
                      </button>
                    </div>
                    <div>
                      <div className="font-semibold text-xs mb-1">
                        3. Prompt Import
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Import prompt text or JSON so the AI workflow stays reusable across topics.
                      </p>
                      <button
                        onClick={downloadSamplePromptJson}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                          dark
                            ? "border-gray-600 hover:bg-gray-700"
                            : "border-gray-300 hover:bg-white"
                        }`}
                      >
                        Download Prompt Sample
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-3">
                    Start Here in 60 Seconds
                  </h3>
                  <ol className="list-decimal pl-4 text-xs text-gray-500 space-y-1">
                    <li>Open Templates and load any starter.</li>
                    <li>Edit content in Editor using markers.</li>
                    <li>Use Shortcuts → Marker Lab for syntax/payload help.</li>
                    <li>Use Settings → Themes for document style.</li>
                    <li>Use Settings → Experience for app theme/mode/music only.</li>
                    <li>Generate DOCX/PDF/HTML/MD/TXT.</li>
                  </ol>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="font-semibold text-sm mb-3">
                    Troubleshooting
                  </h3>
                  <div className="space-y-2 text-xs text-gray-500">
                    <p><strong>Unknown marker warning:</strong> open Marker Lab and copy exact syntax.</p>
                    <p><strong>Nested bullets look wrong:</strong> adjust <code>Spacing → Tab Width</code> and keep consistent indentation.</p>
                    <p><strong>Watermark not centered:</strong> center-only behavior is enforced for all preview/export formats.</p>
                    <p><strong>PDF conversion warnings:</strong> PDF still returns as PDF; warnings indicate fallback renderer used.</p>
                    <p><strong>Music not playing:</strong> verify <code>/public/music/manifest.json</code> and local track paths.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SETTINGS TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "settings" && (
          <div className="space-y-4">
            {/* Save Bar */}
            <div
              className={`${card} p-4 flex items-center justify-between`}
            >
              <div>
                <p className="font-bold">
                  Document Settings
                </p>
                <p className="text-sm text-gray-500">
                  Theme:{" "}
                  <strong className="text-purple-500">
                    {themes[currentTheme]?.name ||
                      currentTheme}
                  </strong>
                  {dirty && (
                    <span className="ml-3 text-yellow-500 text-xs">
                      ● Unsaved changes
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => applyTheme(currentTheme)}
                  disabled={!dirty}
                  className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm border-2 ${
                    dirty
                      ? dark
                        ? "border-gray-500 hover:bg-gray-700"
                        : "border-gray-300 hover:bg-gray-50"
                      : "border-transparent opacity-30 cursor-not-allowed"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={saveSettings}
                  disabled={!dirty}
                  className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm ${
                    dirty
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:opacity-90"
                      : "bg-gray-200 dark:bg-gray-700 opacity-30 cursor-not-allowed"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              {/* Sidebar */}
              <div className={`${card} p-3 h-fit`}>
                {(
                  [
                    "themes",
                    "fonts",
                    "colors",
                    "spacing",
                    "page",
                    "experience",
                  ] as const
                ).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSettingsTab(st)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${
                      settingsTab === st
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow"
                        : dark
                          ? "hover:bg-gray-700"
                          : "hover:bg-gray-100"
                    }`}
                  >
                    {st === "themes" && (
                      <Palette className="w-4 h-4" />
                    )}
                    {st === "fonts" && (
                      <Type className="w-4 h-4" />
                    )}
                    {st === "colors" && (
                      <PaintBucket className="w-4 h-4" />
                    )}
                    {st === "spacing" && (
                      <Ruler className="w-4 h-4" />
                    )}
                    {st === "page" && (
                      <Layout className="w-4 h-4" />
                    )}
                    {st === "experience" && (
                      <Music2 className="w-4 h-4" />
                    )}
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              {/* Settings Content */}
              <div className={`${card} p-6 lg:col-span-3`}>
                  {settingsTab === "themes" && (
                    <div className="space-y-6">
                      <div data-tour="watermark-panel">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          Visual Themes
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Controls fonts, colours, spacing — the look of your exported document.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          <button
                            data-tour="theme-import"
                            onClick={() =>
                              themeImportInputRef.current?.click()
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20 flex items-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            Import Theme JSON
                          </button>
                          <button
                            onClick={downloadSampleThemeJson}
                            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Sample Theme JSON
                          </button>
                          <button
                            onClick={exportCurrentThemeJson}
                            className="px-3 py-2 rounded-lg text-sm font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Export Current Theme
                          </button>
                        </div>

                        {/* Built-in Themes Grid */}
                        {(() => {
                          const themeSource =
                            themes &&
                            Object.keys(themes).length > 0
                              ? themes
                              : FALLBACK_THEME_CATALOG;
                          const builtinThemeEntries =
                            Object.entries(themeSource).filter(
                              ([key]) =>
                                BUILTIN_THEME_KEYS.has(
                                  key.toLowerCase()
                                )
                            );
                          if (builtinThemeEntries.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-400">
                                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                                <p className="text-sm">
                                  Loading themes...
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                              {builtinThemeEntries.map(
                                ([key, theme]: [string, any]) => (
                                  <div
                                    key={key}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                                      currentTheme === key
                                        ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20"
                                        : "border-gray-200 dark:border-gray-700 hover:border-purple-400"
                                    }`}
                                  >
                                    <div className="mb-3">
                                      <h4 className="font-semibold text-gray-900 dark:text-white">
                                        {theme.name ||
                                          key.charAt(0).toUpperCase() +
                                            key.slice(1)}
                                      </h4>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                        {theme.description ||
                                          "Custom theme"}
                                      </p>
                                    </div>

                                    {/* Color Swatches */}
                                    <div className="flex gap-1.5 mb-4">
                                      {themeSwatches(key, theme).map((color, i) => (
                                        <div
                                          key={i}
                                          className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"
                                          style={{
                                            backgroundColor:
                                              color,
                                          }}
                                          title={color}
                                        />
                                      ))}
                                    </div>

                                    <button
                                      onClick={() =>
                                        applyTheme(key)
                                      }
                                      className={`w-full py-2 rounded text-sm font-medium transition ${
                                        currentTheme === key
                                          ? "bg-purple-600 text-white"
                                          : "bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 hover:bg-purple-300"
                                      }`}
                                    >
                                      {currentTheme === key
                                        ? "✓ Applied"
                                        : "Apply"}
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })()}

                        {/* Save as New Theme */}
                        <div className="border-t dark:border-gray-700 pt-6 mt-6">
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              Save Current Settings as New
                              Theme
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                              Tweak fonts/colours/spacing in
                              other tabs, then save as a
                              reusable theme.
                            </p>

                            <div className="space-y-3">
                              <div>
                                <label className={lbl}>
                                  Key (slug)
                                </label>
                                <input
                                  type="text"
                                  placeholder="my_theme"
                                  value={newThemeKey}
                                  onChange={(e) =>
                                    setNewThemeKey(
                                      e.target.value
                                        .toLowerCase()
                                        .replace(
                                          /\s+/g,
                                          "_"
                                        )
                                        .replace(
                                          /[^a-z0-9_]/g,
                                          ""
                                        )
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Display Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="My Theme"
                                  value={newThemeName}
                                  onChange={(e) =>
                                    setNewThemeName(
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Description
                                </label>
                                <input
                                  type="text"
                                  placeholder="Optional"
                                  value={newThemeDesc}
                                  onChange={(e) =>
                                    setNewThemeDesc(
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>

                              <button
                                onClick={saveAsTheme}
                                disabled={
                                  !newThemeKey ||
                                  !newThemeName ||
                                  savingTheme
                                }
                                className="w-full py-2.5 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                              >
                                {savingTheme ? (
                                  <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                                ) : (
                                  "💾"
                                )}{" "}
                                Save as Theme
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Custom Themes List */}
                        {themes &&
                          Object.keys(themes).filter(
                            (k) =>
                              !BUILTIN_THEME_KEYS.has(
                                k.toLowerCase()
                              )
                          ).length > 0 && (
                            <div className="border-t dark:border-gray-700 pt-6 mt-6">
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                Custom Themes (
                                {
                                  Object.keys(themes).filter(
                                    (k) =>
                                      !BUILTIN_THEME_KEYS.has(
                                        k.toLowerCase()
                                      )
                                  ).length
                                }
                                )
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(themes)
                                  .filter(
                                    ([k]) =>
                                      !BUILTIN_THEME_KEYS.has(
                                        k.toLowerCase()
                                      )
                                  )
                                  .map(
                                    (
                                      [key, theme]: [
                                        string,
                                        any,
                                      ]
                                    ) => (
                                      <div
                                        key={key}
                                        className={`p-4 rounded-lg border-2 transition ${
                                          currentTheme === key
                                            ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20"
                                            : "border-gray-200 dark:border-gray-700 hover:border-purple-400"
                                        }`}
                                      >
                                        <div className="mb-3">
                                          <p className="font-medium text-gray-900 dark:text-white">
                                            {theme.name ||
                                              key}
                                          </p>
                                          <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {theme.description ||
                                              "Custom"}
                                          </p>
                                        </div>

                                        <div className="flex gap-1.5 mb-3">
                                          {themeSwatches(key, theme).map((color, i) => (
                                            <div
                                              key={i}
                                              className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"
                                              style={{
                                                backgroundColor:
                                                  color,
                                              }}
                                              title={color}
                                            />
                                          ))}
                                        </div>

                                        <div
                                          className={`rounded-lg p-2.5 text-xs mb-3 border ${
                                            dark
                                              ? "bg-gray-900 border-gray-700 text-gray-300"
                                              : "bg-white border-gray-200 text-gray-700"
                                          }`}
                                          style={{
                                            fontFamily:
                                              theme.fonts
                                                ?.family ||
                                              "inherit",
                                          }}
                                        >
                                          Preview text for{" "}
                                          {theme.name || key}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() =>
                                              applyTheme(
                                                key
                                              )
                                            }
                                            className={`flex-1 py-2 rounded text-xs font-medium transition ${
                                              currentTheme ===
                                              key
                                                ? "bg-purple-600 text-white"
                                                : "bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 hover:bg-purple-300"
                                            }`}
                                          >
                                            {currentTheme ===
                                            key
                                              ? "✓ Applied"
                                              : "Apply"}
                                          </button>
                                          <button
                                            onClick={() =>
                                              deleteTheme(
                                                key
                                              )
                                            }
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition border border-red-200 dark:border-red-900/30"
                                            title="Delete theme"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                {/* ── FONTS ──────────────────────── */}
                {settingsTab === "fonts" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">
                        Font Settings
                      </h3>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showFontPreview}
                          onChange={(e) =>
                            setShowFontPreview(
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 accent-purple-600"
                        />
                        Preview fonts
                      </label>
                    </div>
                    <div className="space-y-5">
                      {/* Body Font */}
                      <div>
                        <label className={lbl}>
                          Body Font
                        </label>
                        <select
                          value={
                            config.fonts?.family || ""
                          }
                          onChange={(e) =>
                            cfgLocal(
                              "fonts.family",
                              e.target.value
                            )
                          }
                          className={inp}
                          style={
                            showFontPreview
                              ? {
                                  fontFamily:
                                    config.fonts?.family,
                                }
                              : {}
                          }
                        >
                          {availableFonts.map((f) => (
                            <option
                              key={f}
                              value={f}
                              style={
                                showFontPreview
                                  ? { fontFamily: f }
                                  : {}
                              }
                            >
                              {f}
                            </option>
                          ))}
                        </select>
                        {showFontPreview &&
                          config.fonts?.family && (
                            <div
                              className={`mt-2 p-3 rounded-lg text-sm ${
                                dark
                                  ? "bg-gray-700"
                                  : "bg-gray-50"
                              }`}
                              style={{
                                fontFamily:
                                  config.fonts.family,
                              }}
                            >
                              The quick brown fox jumps
                              over the lazy dog.{" "}
                              <strong>Bold text.</strong>{" "}
                              <em>Italic text.</em>{" "}
                              1234567890.
                            </div>
                          )}
                      </div>

                      {/* Code Font */}
                      <div>
                        <label className={lbl}>
                          Code / Monospace Font
                        </label>
                        <select
                          value={
                            config.fonts?.family_code || ""
                          }
                          onChange={(e) =>
                            cfgLocal(
                              "fonts.family_code",
                              e.target.value
                            )
                          }
                          className={inp}
                          style={
                            showFontPreview
                              ? {
                                  fontFamily:
                                    config.fonts
                                      ?.family_code,
                                }
                              : {}
                          }
                        >
                          {availableCodeFonts.map((f) => (
                            <option
                              key={f}
                              value={f}
                              style={
                                showFontPreview
                                  ? { fontFamily: f }
                                  : {}
                              }
                            >
                              {f}
                            </option>
                          ))}
                        </select>
                        {showFontPreview &&
                          config.fonts?.family_code && (
                            <div
                              className={`mt-2 p-3 rounded-lg text-sm ${
                                dark
                                  ? "bg-gray-900"
                                  : "bg-gray-50"
                              }`}
                              style={{
                                fontFamily:
                                  config.fonts
                                    .family_code,
                              }}
                            >
                              def hello_world(): return
                              "Hello, Quick Doc Formatter!" #
                              0O1lIi
                            </div>
                          )}
                      </div>

                      {/* Per-heading fonts */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm">
                          Heading Fonts
                        </h4>
                        {[
                          "h1",
                          "h2",
                          "h3",
                          "h4",
                          "h5",
                          "h6",
                        ].map((level) => (
                          <div key={level} className="mb-3">
                            <label className={lbl}>
                              {level.toUpperCase()} Font
                            </label>
                            <select
                              value={
                                config.fonts?.[
                                  `${level}_family` as keyof FontsConfig
                                ]?.toString() ||
                                config.fonts?.families?.[
                                  level
                                ] ||
                                config.fonts?.family ||
                                ""
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  `fonts.${level}_family`,
                                  e.target.value
                                )
                              }
                              className={inp}
                            >
                              {availableFonts.map((f) => (
                                <option key={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className={lbl}>
                          Bullet / Numbered List Font
                        </label>
                        <select
                          value={
                            config.fonts?.bullet_family ||
                            config.fonts?.family ||
                            ""
                          }
                          onChange={(e) =>
                            cfgLocal(
                              "fonts.bullet_family",
                              e.target.value
                            )
                          }
                          className={inp}
                        >
                          {availableFonts.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Font Sizes */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm">
                          Font Sizes (pt)
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {(
                            [
                              ["h1", "H1 Heading"],
                              ["h2", "H2 Heading"],
                              ["h3", "H3 Heading"],
                              ["h4", "H4 Heading"],
                              ["h5", "H5 Heading"],
                              ["h6", "H6 Heading"],
                              ["body", "Body Text"],
                              ["code", "Code Text"],
                            ] as const
                          ).map(([k, label]) => (
                            <div key={k}>
                              <label className={lbl}>
                                {label}:{" "}
                                <strong>
                                  {config.fonts?.sizes?.[
                                    k
                                  ] || 12}
                                  pt
                                </strong>
                              </label>
                              <input
                                type="range"
                                min="8"
                                max="32"
                                value={
                                  config.fonts?.sizes?.[
                                    k
                                  ] || 12
                                }
                                onChange={(e) =>
                                  cfgLocal(
                                    `fonts.sizes.${k}`,
                                    parseInt(
                                      e.target.value
                                    )
                                  )
                                }
                                className="w-full accent-purple-600"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── COLOURS ────────────────────── */}
                {settingsTab === "colors" && (
                  <div>
                    <h3 className="text-lg font-bold mb-4">
                      Colour Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(
                        [
                          ["h1", "H1 Heading Colour"],
                          ["h2", "H2 Heading Colour"],
                          ["h3", "H3 Heading Colour"],
                          ["h4", "H4 Heading Colour"],
                          ["h5", "H5 Heading Colour"],
                          ["h6", "H6 Heading Colour"],
                          [
                            "code_background",
                            "Code Background",
                          ],
                          [
                            "table_header_bg",
                            "Table Header Background",
                          ],
                          [
                            "table_header_text",
                            "Table Header Text",
                          ],
                          [
                            "table_odd_row",
                            "Table Odd Row",
                          ],
                          [
                            "table_even_row",
                            "Table Even Row",
                          ],
                        ] as const
                      ).map(([k, label]) => (
                        <div key={k}>
                          <label className={lbl}>
                            {label}
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={
                                config.colors?.[k] ||
                                "#000000"
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  `colors.${k}`,
                                  e.target.value
                                )
                              }
                              className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"
                            />
                            <input
                              type="text"
                              value={
                                config.colors?.[k] ||
                                "#000000"
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  `colors.${k}`,
                                  e.target.value
                                )
                              }
                              className={`${inp} font-mono`}
                              maxLength={7}
                            />
                            <div
                              className="w-8 h-8 rounded-lg border shrink-0"
                              style={{
                                background:
                                  config.colors?.[k] ||
                                  "#000",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── SPACING ────────────────────── */}
                {settingsTab === "spacing" && (
                  <div>
                    <h3 className="text-lg font-bold mb-4">
                      Spacing Settings
                    </h3>
                    <div className="space-y-5">
                      {(
                        [
                          [
                            "spacing.line_spacing",
                            "Line Spacing (multiplier)",
                            1.0,
                            3.0,
                            0.05,
                          ],
                          [
                            "spacing.paragraph_spacing_after",
                            "Paragraph Space After (pt)",
                            0,
                            24,
                            1,
                          ],
                          [
                            "spacing.heading_spacing_before",
                            "Heading Space Before (pt)",
                            0,
                            36,
                            1,
                          ],
                          [
                            "spacing.heading_spacing_after",
                            "Heading Space After (pt)",
                            0,
                            24,
                            1,
                          ],
                          [
                            "spacing.bullet_base_indent",
                            'Bullet Base Indent (")',
                            0,
                            1.5,
                            0.05,
                          ],
                          [
                            "spacing.bullet_indent_per_level",
                            'Bullet Per-Level Indent (")',
                            0.1,
                            1,
                            0.05,
                          ],
                          [
                            "spacing.code_indent",
                            'Code Block Indent (")',
                            0,
                            1,
                            0.05,
                          ],
                          [
                            "spacing.quote_indent",
                            'Quote Indent (")',
                            0,
                            1.5,
                            0.05,
                          ],
                        ] as [
                          string,
                          string,
                          number,
                          number,
                          number,
                        ][]
                      ).map(
                        ([path, label, min, max, step]) => {
                          const [, key] = path.split(".");
                          const val =
                            config.spacing?.[key] ?? min;
                          return (
                            <div key={path}>
                              <label className={lbl}>
                                {label}:{" "}
                                <strong className="text-purple-500">
                                  {typeof val === "number"
                                    ? val.toFixed(
                                        step < 1 ? 2 : 0
                                      )
                                    : val}
                                </strong>
                              </label>
                              <input
                                type="range"
                                min={min}
                                max={max}
                                step={step}
                                value={val}
                                onChange={(e) =>
                                  cfgLocal(
                                    path,
                                    step < 1
                                      ? parseFloat(
                                          e.target.value
                                        )
                                      : parseInt(
                                          e.target.value
                                        )
                                  )
                                }
                                className="w-full accent-purple-600"
                              />
                              <div
                                className={`flex justify-between text-xs mt-0.5 ${
                                  dark
                                    ? "text-gray-600"
                                    : "text-gray-400"
                                }`}
                              >
                                <span>{min}</span>
                                <span>{max}</span>
                              </div>
                            </div>
                          );
                        }
                      )}

                      <div>
                        <label className={lbl}>
                          Line Spacing Presets
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {LINE_SPACING_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              onClick={() =>
                                cfgLocal("spacing.line_spacing", preset)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                                Math.abs(
                                  Number(config.spacing?.line_spacing || 1.5) - Number(preset)
                                ) < 0.01
                                  ? "bg-purple-600 text-white border-purple-600"
                                  : dark
                                    ? "border-gray-600 hover:bg-gray-700"
                                    : "border-gray-300 hover:bg-gray-100"
                              }`}
                            >
                              {preset.toFixed(2)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={lbl}>
                          Tab Width:{" "}
                          <strong className="text-purple-500">
                            {normalizeTabWidth(config.spacing?.tab_width || 4)}
                          </strong>{" "}
                          spaces
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="12"
                          step="1"
                          value={normalizeTabWidth(config.spacing?.tab_width || 4)}
                          onChange={(e) =>
                            cfgLocal("spacing.tab_width", Number(e.target.value))
                          }
                          className="w-full accent-purple-600"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Used for list/code indent detection in parser, analyzer, and preview.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── EXPERIENCE ─────────────────── */}
                {settingsTab === "experience" && (
                  <div data-tour="app-experience" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold mb-2">
                        App Experience
                      </h3>
                      <p className="text-sm text-gray-500">
                        App Theme and Mode change the editor UI only. Document preview/export styling still comes from document theme settings.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>App UI Theme</label>
                        <select
                          value={currentUiThemeKey}
                          onChange={(e) =>
                            cfgLocal("app_ui.theme", e.target.value)
                          }
                          className={inp}
                        >
                          {Object.entries(APP_UI_THEMES).map(([key, theme]) => (
                            <option key={key} value={key}>
                              {theme.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Mode</label>
                        <select
                          value={currentMode}
                          onChange={(e) =>
                            cfgLocal("app_ui.mode", normalizeMode(e.target.value))
                          }
                          className={inp}
                        >
                          {MODE_ORDER.map((mode) => (
                            <option key={mode} value={mode}>
                              {MODE_PROFILES[mode].label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          {activeMode.hint}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      {MODE_ORDER.map((mode) => (
                        <button
                          key={mode}
                          onClick={() => cfgLocal("app_ui.mode", mode)}
                          className={`rounded-lg px-2 py-2 text-xs font-medium border transition ${
                            currentMode === mode
                              ? "border-purple-500 bg-purple-100 dark:bg-purple-900/30"
                              : dark
                                ? "border-gray-600 hover:bg-gray-700"
                                : "border-gray-300 hover:bg-gray-100"
                          }`}
                        >
                          {MODE_PROFILES[mode].label}
                        </button>
                      ))}
                    </div>

                    <div className={`rounded-xl border p-4 ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Music2 className="w-4 h-4 text-purple-500" />
                        Mode Music (Copyright-Free Local Assets)
                      </h4>
                      <p className="text-xs text-gray-500 mb-3">
                        Manual play only. Use local files or direct media URLs in <code>frontend/public/music/manifest.json</code>. YouTube page links are intentionally blocked.
                      </p>

                      <label className="flex items-center gap-2 text-sm mb-3">
                        <input
                          type="checkbox"
                          checked={Boolean(config.app_ui?.music?.enabled)}
                          onChange={(e) =>
                            cfgLocal("app_ui.music.enabled", e.target.checked)
                          }
                          className="w-4 h-4 accent-purple-600"
                        />
                        Enable music for this workspace
                      </label>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={lbl}>
                            Volume: {Math.round(Number(config.app_ui?.music?.volume ?? 0.35) * 100)}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={Number(config.app_ui?.music?.volume ?? 0.35)}
                            onChange={(e) =>
                              cfgLocal("app_ui.music.volume", Number(e.target.value))
                            }
                            disabled={!config.app_ui?.music?.enabled}
                            className="w-full accent-purple-600"
                          />
                        </div>
                        <div>
                          <label className={lbl}>Active Track</label>
                          <div className={`rounded-lg border px-3 py-2 text-xs ${dark ? "border-gray-600 bg-gray-900 text-gray-200" : "border-gray-300 bg-white text-gray-700"}`}>
                            {activeTrack ? (
                              <>
                                <div className="font-semibold">{activeTrack.title}</div>
                                <div className="opacity-70">
                                  {activeTrack.artist || "Unknown artist"}{activeTrack.duration ? ` · ${activeTrack.duration}` : ""}
                                </div>
                              </>
                            ) : (
                              "No track mapped for this mode."
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={prevTrack}
                          disabled={!config.app_ui?.music?.enabled || activeTracks.length === 0}
                          className="px-3 py-2 rounded-lg border text-xs font-medium disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          onClick={toggleMusicPlayback}
                          disabled={!config.app_ui?.music?.enabled || activeTracks.length === 0}
                          className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium disabled:opacity-40"
                        >
                          {musicPlaying ? "Pause" : "Play"}
                        </button>
                        <button
                          onClick={nextTrack}
                          disabled={!config.app_ui?.music?.enabled || activeTracks.length === 0}
                          className="px-3 py-2 rounded-lg border text-xs font-medium disabled:opacity-40"
                        >
                          Next
                        </button>
                        <span className="text-xs text-gray-500">
                          {activeTracks.length} track(s) in {MODE_PROFILES[currentMode].label} mode
                        </span>
                      </div>

                      {musicLoadError && (
                        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                          {musicLoadError}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── PAGE SETUP ─────────────────── */}
                {settingsTab === "page" && (
                  <div>
                    <h3 className="text-lg font-bold mb-4">
                      Page Setup
                    </h3>
                    <div className="space-y-6">
                      <div className={`rounded-xl border p-3 ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
                        <p className="text-xs font-semibold mb-2">
                          Quick Header/Footer Actions
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setDirty(true);
                              setConfig((prev) =>
                                normalizeAppConfig({
                                  ...prev,
                                  header: { enabled: true, text: "", alignment: "center", show_page_numbers: false, separator: false },
                                })
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                          >
                            Reset Header
                          </button>
                          <button
                            onClick={() => {
                              setDirty(true);
                              setConfig((prev) =>
                                normalizeAppConfig({
                                  ...prev,
                                  footer: { enabled: true, text: "", alignment: "center", show_page_numbers: true, separator: false },
                                })
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                          >
                            Reset Footer
                          </button>
                          <button
                            onClick={() => {
                              setDirty(true);
                              setConfig((prev) =>
                                normalizeAppConfig({
                                  ...prev,
                                  footer: {
                                    ...(prev.footer || {}),
                                    color: prev.header?.color,
                                    size: prev.header?.size,
                                    font_family: prev.header?.font_family,
                                    alignment: prev.header?.alignment,
                                  },
                                })
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                          >
                            Copy Header Style to Footer
                          </button>
                          <button
                            onClick={() => {
                              setDirty(true);
                              setConfig((prev) =>
                                normalizeAppConfig({
                                  ...prev,
                                  header: {
                                    ...(prev.header || {}),
                                    color: prev.footer?.color,
                                    size: prev.footer?.size,
                                    font_family: prev.footer?.font_family,
                                    alignment: prev.footer?.alignment,
                                  },
                                })
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                          >
                            Copy Footer Style to Header
                          </button>
                        </div>
                      </div>

                      {/* HEADER */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">
                          Document Header
                        </h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                config.header?.enabled ||
                                false
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  "header.enabled",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 accent-purple-600"
                            />
                            <span className="text-sm">
                              Show header on every page
                            </span>
                          </label>

                          {config.header?.enabled && (
                            <div className="space-y-3 pl-6">
                              <div>
                                <label className={lbl}>
                                  Header Text
                                </label>
                                <input
                                  type="text"
                                  value={
                                    config.header?.text ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.text",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                  placeholder="e.g. Company Name · Confidential"
                                />
                              </div>
                              <div>
                                <label className={lbl}>
                                  Header Colour
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={
                                      config.header
                                        ?.color ||
                                      "#FF8C00"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "header.color",
                                        e.target.value
                                      )
                                    }
                                    className="w-10 h-9 rounded-lg cursor-pointer border-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      config.header
                                        ?.color || ""
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "header.color",
                                        e.target.value
                                      )
                                    }
                                    className={`${inp} font-mono`}
                                    maxLength={7}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={lbl}>
                                  Header Size:{" "}
                                  {config.header?.size ||
                                    11}
                                  pt
                                </label>
                                <input
                                  type="range"
                                  min="8"
                                  max="16"
                                  value={
                                    config.header?.size ||
                                    11
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.size",
                                      parseInt(
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="w-full accent-purple-600"
                                />
                              </div>
                              <div>
                                <label className={lbl}>
                                  Header Font
                                </label>
                                <select
                                  value={
                                    config.header
                                      ?.font_family ||
                                    config.fonts
                                      ?.family ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.font_family",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  {availableFonts.map((f) => (
                                    <option key={f}>
                                      {f}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className={lbl}>
                                  Header Alignment
                                </label>
                                <select
                                  value={
                                    config.header
                                      ?.alignment ||
                                    "center"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.alignment",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  <option value="left">
                                    Left
                                  </option>
                                  <option value="center">
                                    Center
                                  </option>
                                  <option value="right">
                                    Right
                                  </option>
                                </select>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={
                                    config.header
                                      ?.show_page_numbers ||
                                    false
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.show_page_numbers",
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-purple-600"
                                />
                                <span className="text-sm">
                                  Show page numbers in header
                                </span>
                              </label>

                              <div>
                                <label className={lbl}>
                                  Header Page Format
                                </label>
                                <input
                                  type="text"
                                  value={
                                    config.header
                                      ?.page_format ||
                                    "Page X of Y"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.page_format",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                  placeholder="Use X for current page and Y for total pages"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Header Page Number Style
                                </label>
                                <select
                                  value={
                                    config.header
                                      ?.page_number_style ||
                                    "arabic"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.page_number_style",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  <option value="arabic">
                                    1, 2, 3
                                  </option>
                                  <option value="roman">
                                    I, II, III
                                  </option>
                                  <option value="roman_lower">
                                    i, ii, iii
                                  </option>
                                  <option value="alpha">
                                    A, B, C
                                  </option>
                                  <option value="alpha_lower">
                                    a, b, c
                                  </option>
                                </select>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={
                                    config.header
                                      ?.separator !== false
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "header.separator",
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-purple-600"
                                />
                                <span className="text-sm">
                                  Show separator line below header
                                </span>
                              </label>

                              <div>
                                <label className={lbl}>
                                  Header Separator Colour
                                </label>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="color"
                                    value={
                                      config.header
                                        ?.separator_color ||
                                      "#CCCCCC"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "header.separator_color",
                                        e.target.value
                                      )
                                    }
                                    className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      config.header
                                        ?.separator_color ||
                                      "#CCCCCC"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "header.separator_color",
                                        e.target.value
                                      )
                                    }
                                    className={`${inp} font-mono`}
                                    maxLength={7}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* FOOTER */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">
                          Footer & Page Numbers
                        </h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                config.footer?.enabled ||
                                false
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  "footer.enabled",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 accent-purple-600"
                            />
                            <span className="text-sm">
                              Show footer
                            </span>
                          </label>

                          {config.footer?.enabled && (
                            <div className="space-y-3 pl-6">
                              <div>
                                <label className={lbl}>
                                  Footer Text
                                </label>
                                <input
                                  type="text"
                                  value={
                                    config.footer?.text ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.text",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                  placeholder={`e.g. © ${new Date().getFullYear()} Quick Doc Formatter`}
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Footer Colour
                                </label>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="color"
                                    value={
                                      config.footer
                                        ?.color ||
                                      "#333333"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "footer.color",
                                        e.target.value
                                      )
                                    }
                                    className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      config.footer
                                        ?.color ||
                                      "#333333"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "footer.color",
                                        e.target.value
                                      )
                                    }
                                    className={`${inp} font-mono`}
                                    maxLength={7}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className={lbl}>
                                  Footer Size:{" "}
                                  {config.footer?.size ||
                                    10}
                                  pt
                                </label>
                                <input
                                  type="range"
                                  min="8"
                                  max="16"
                                  value={
                                    config.footer?.size ||
                                    10
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.size",
                                      parseInt(
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="w-full accent-purple-600"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Footer Font
                                </label>
                                <select
                                  value={
                                    config.footer
                                      ?.font_family ||
                                    config.fonts?.family ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.font_family",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  {availableFonts.map((f) => (
                                    <option
                                      key={f}
                                      value={f}
                                    >
                                      {f}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className={lbl}>
                                  Footer Alignment
                                </label>
                                <select
                                  value={
                                    config.footer
                                      ?.alignment ||
                                    "center"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.alignment",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  <option value="left">
                                    Left
                                  </option>
                                  <option value="center">
                                    Center
                                  </option>
                                  <option value="right">
                                    Right
                                  </option>
                                </select>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={
                                    config.footer
                                      ?.show_page_numbers ||
                                    false
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.show_page_numbers",
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-purple-600"
                                />
                                <span className="text-sm">
                                  Show page numbers
                                </span>
                              </label>

                              <div>
                                <label className={lbl}>
                                  Page Number Format
                                </label>
                                <input
                                  type="text"
                                  value={
                                    config.footer
                                      ?.page_format ||
                                    "Page X of Y"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.page_format",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                  placeholder="Use X for current page and Y for total pages"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Page Number Style
                                </label>
                                <select
                                  value={
                                    config.footer
                                      ?.page_number_style ||
                                    "arabic"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.page_number_style",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  <option value="arabic">
                                    1, 2, 3
                                  </option>
                                  <option value="roman">
                                    I, II, III
                                  </option>
                                  <option value="roman_lower">
                                    i, ii, iii
                                  </option>
                                  <option value="alpha">
                                    A, B, C
                                  </option>
                                  <option value="alpha_lower">
                                    a, b, c
                                  </option>
                                </select>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={
                                    config.footer
                                      ?.separator !== false
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "footer.separator",
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-purple-600"
                                />
                                <span className="text-sm">
                                  Show separator line above footer
                                </span>
                              </label>

                              <div>
                                <label className={lbl}>
                                  Separator Colour
                                </label>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="color"
                                    value={
                                      config.footer
                                        ?.separator_color ||
                                      "#CCCCCC"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "footer.separator_color",
                                        e.target.value
                                      )
                                    }
                                    className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      config.footer
                                        ?.separator_color ||
                                      "#CCCCCC"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "footer.separator_color",
                                        e.target.value
                                      )
                                    }
                                    className={`${inp} font-mono`}
                                    maxLength={7}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>


                      {/* WATERMARK */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">
                          Watermark
                        </h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                config.watermark
                                  ?.enabled || false
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  "watermark.enabled",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 accent-purple-600"
                            />
                            <span className="text-sm">
                              Enable watermark
                            </span>
                          </label>

                          {config.watermark?.enabled && (
                            <div className="pl-6 space-y-4">
                              {/* Watermark Type */}
                              <div>
                                <label className={lbl}>
                                  Watermark Type
                                </label>
                                <select
                                  value={
                                    config.watermark
                                      ?.type || "text"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "watermark.type",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  <option value="text">
                                    Text
                                  </option>
                                  <option value="image">
                                    Image
                                  </option>
                                </select>
                              </div>

                              {/* Text Watermark */}
                              {config.watermark?.type ===
                                "text" && (
                                <>
                                  <div>
                                    <label className={lbl}>
                                      Watermark Text
                                    </label>
                                    <input
                                      type="text"
                                      value={
                                        config.watermark
                                          ?.text || ""
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.text",
                                          e.target.value
                                        )
                                      }
                                      className={inp}
                                      placeholder="CONFIDENTIAL"
                                    />
                                  </div>

                                  <div>
                                    <label className={lbl}>
                                      Watermark Font
                                    </label>
                                    <select
                                      value={
                                        config.watermark
                                          ?.font ||
                                        config.fonts
                                          ?.family ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.font",
                                          e.target.value
                                        )
                                      }
                                      className={inp}
                                    >
                                      {availableFonts.map((f) => (
                                        <option
                                          key={f}
                                          value={f}
                                        >
                                          {f}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className={lbl}>
                                      Size:{" "}
                                      {config.watermark
                                        ?.size || 48}
                                      pt
                                    </label>
                                    <input
                                      type="range"
                                      min="24"
                                      max="96"
                                      step="1"
                                      value={
                                        config.watermark
                                          ?.size || 48
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.size",
                                          parseInt(
                                            e.target.value
                                          )
                                        )
                                      }
                                      className="w-full accent-purple-600"
                                    />
                                  </div>

                                  <div>
                                    <label className={lbl}>
                                      Colour
                                    </label>
                                    <div className="flex gap-2 items-center">
                                      <input
                                        type="color"
                                        value={
                                          config.watermark
                                            ?.color ||
                                          "#CCCCCC"
                                        }
                                        onChange={(e) =>
                                          cfgLocal(
                                            "watermark.color",
                                            e.target.value
                                          )
                                        }
                                        className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"
                                      />
                                      <input
                                        type="text"
                                        value={
                                          config.watermark
                                            ?.color || ""
                                        }
                                        onChange={(e) =>
                                          cfgLocal(
                                            "watermark.color",
                                            e.target.value
                                          )
                                        }
                                        className={`${inp} font-mono`}
                                        maxLength={7}
                                      />
                                    </div>
                                  </div>

                                </>
                              )}

                              {/* Image Watermark */}
                              {config.watermark?.type ===
                                "image" && (
                                <>
                                  <div>
                                    <label className={lbl}>
                                      Watermark Image
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file =
                                            e.target
                                              .files?.[0];
                                          if (file) {
                                            const reader =
                                              new FileReader();
                                            reader.onload =
                                              (evt) => {
                                                cfgLocal(
                                                  "watermark.image_path",
                                                  evt
                                                    .target
                                                    ?.result as string
                                                );
                                              };
                                            reader.readAsDataURL(
                                              file
                                            );
                                          }
                                        }}
                                        className={`${inp} flex-1`}
                                      />
                                    </div>
                                    {config.watermark
                                      ?.image_path && (
                                      <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                                        ✓ Image selected
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <label className={lbl}>
                                      Image Scale:{" "}
                                      {config.watermark
                                        ?.scale || 100}
                                      %
                                    </label>
                                    <input
                                      type="range"
                                      min="10"
                                      max="200"
                                      step="10"
                                      value={
                                        config.watermark
                                          ?.scale || 100
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.scale",
                                          parseInt(
                                            e.target.value
                                          )
                                        )
                                      }
                                      className="w-full accent-purple-600"
                                    />
                                  </div>

                                  <p className="text-xs text-gray-500">
                                    Placement is center-only in preview and exports for consistent behavior.
                                  </p>
                                </>
                              )}

                              <div>
                                <label className={lbl}>
                                  Opacity:{" "}
                                  {(
                                    (config.watermark?.opacity || 0.15) * 100
                                  ).toFixed(0)}
                                  %
                                </label>
                                <input
                                  type="range"
                                  min="0.05"
                                  max="0.6"
                                  step="0.01"
                                  value={config.watermark?.opacity || 0.15}
                                  onChange={(e) =>
                                    cfgLocal("watermark.opacity", Number(e.target.value))
                                  }
                                  className="w-full accent-purple-600"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Rotation: {config.watermark?.rotation || 315}°
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="360"
                                  step="1"
                                  value={config.watermark?.rotation || 315}
                                  onChange={(e) =>
                                    cfgLocal("watermark.rotation", Number(e.target.value))
                                  }
                                  className="w-full accent-purple-600"
                                />
                              </div>

                              <div>
                                <label className={lbl}>Placement</label>
                                <input
                                  type="text"
                                  value="center"
                                  readOnly
                                  className={`${inp} opacity-70`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* MARGINS */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">
                          Page Margins (inches)
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {(
                            [
                              "top",
                              "bottom",
                              "left",
                              "right",
                            ] as const
                          ).map((side) => (
                            <div key={side}>
                              <label className={lbl}>
                                {side
                                  .charAt(0)
                                  .toUpperCase() +
                                  side.slice(1)}
                                :{" "}
                                <strong>
                                  {config.page?.margins?.[
                                    side
                                  ] || 1.0}
                                  "
                                </strong>
                              </label>
                              <input
                                type="range"
                                min="0.5"
                                max="2.5"
                                step="0.1"
                                value={
                                  config.page?.margins?.[
                                    side
                                  ] || 1.0
                                }
                                onChange={(e) =>
                                  cfgLocal(
                                    `page.margins.${side}`,
                                    parseFloat(
                                      e.target.value
                                    )
                                  )
                                }
                                className="w-full accent-purple-600"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* PAGE BORDER */}
                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">
                          Page Border
                        </h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                config.page?.border
                                  ?.enabled || false
                              }
                              onChange={(e) =>
                                cfgLocal(
                                  "page.border.enabled",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 accent-purple-600"
                            />
                            <span className="text-sm">
                              Enable page border
                            </span>
                          </label>
                          {config.page?.border?.enabled && (
                            <div className="pl-6 space-y-3">
                              <div>
                                <label className={lbl}>
                                  Border Style
                                </label>
                                <select
                                  value={
                                    config.page?.border
                                      ?.style || "single"
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "page.border.style",
                                      e.target.value
                                    )
                                  }
                                  className={inp}
                                >
                                  <option value="single">
                                    Single (thin)
                                  </option>
                                  <option value="double">
                                    Double
                                  </option>
                                  <option value="thick">
                                    Thick
                                  </option>
                                  <option value="dashed">
                                    Dashed
                                  </option>
                                  <option value="dotted">
                                    Dotted
                                  </option>
                                  <option value="inset">
                                    Inset
                                  </option>
                                  <option value="outset">
                                    Outset
                                  </option>
                                  <option value="triple">
                                    Triple
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label className={lbl}>
                                  Border Colour
                                </label>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="color"
                                    value={
                                      config.page?.border
                                        ?.color ||
                                      "#000000"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "page.border.color",
                                        e.target.value
                                      )
                                    }
                                    className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      config.page?.border
                                        ?.color ||
                                      "#000000"
                                    }
                                    onChange={(e) =>
                                      cfgLocal(
                                        "page.border.color",
                                        e.target.value
                                      )
                                    }
                                    className={`${inp} font-mono`}
                                    maxLength={7}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={lbl}>
                                  Border Width:{" "}
                                  <strong>
                                    {config.page?.border
                                      ?.width || 4}
                                    pt
                                  </strong>{" "}
                                  {(config.page?.border
                                    ?.width || 4) <= 6
                                    ? "(thin)"
                                    : (config.page?.border
                                          ?.width || 4) <=
                                        16
                                      ? "(medium)"
                                      : "(thick)"}
                                </label>
                                <input
                                  type="range"
                                  min="1"
                                  max="36"
                                  step="1"
                                  value={
                                    config.page?.border
                                      ?.width || 4
                                  }
                                  onChange={(e) =>
                                    cfgLocal(
                                      "page.border.width",
                                      parseInt(
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="w-full accent-purple-600"
                                />
                                <div
                                  className={`flex justify-between text-xs mt-0.5 ${
                                    dark
                                      ? "text-gray-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  <span>
                                    1 (hairline)
                                  </span>
                                  <span>36 (thick)</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* END settings content card */}
            </div>
            {/* END settings grid */}
          </div>
          /* END settings space-y-4 */
        )}
        {/* END tab==="settings" */}

        {/* ══════════════════════════════════════════════════════
            AI PROMPT TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "prompt" && (
          <div className="space-y-5">
            <div className={`${card} overflow-hidden`}>
              <div
                className={`px-6 py-4 ${
                  dark
                    ? "bg-gray-700/50"
                    : "bg-gradient-to-r from-purple-50 to-blue-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Bot className="w-6 h-6 text-purple-500" />
                      AI Formatting Prompt
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Copy this into ChatGPT or Claude with your
                      raw notes. The AI returns marker-formatted
                      text ready to paste and generate.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={copyPrompt}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 text-sm shadow-lg"
                    >
                      {promptCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Prompt
                        </>
                      )}
                    </button>
                    <button
                      data-tour="prompt-import"
                      onClick={() =>
                        promptImportInputRef.current?.click()
                      }
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border-2 ${
                        dark
                          ? "border-blue-700 text-blue-300 hover:bg-blue-900/20"
                          : "border-blue-300 text-blue-700 hover:bg-blue-50"
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Import Prompt
                    </button>
                    <button
                      onClick={downloadSamplePromptJson}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border-2 ${
                        dark
                          ? "border-gray-600 hover:bg-gray-700"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      Sample Prompt
                    </button>
                    {!promptEditing ? (
                      <button
                        onClick={() =>
                          setPromptEditing(true)
                        }
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border-2 ${
                          dark
                            ? "border-gray-600 hover:bg-gray-700"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={savePrompt}
                          disabled={promptSaving}
                          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm"
                        >
                          {promptSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setPromptEditing(false);
                            loadPrompt();
                          }}
                          className={`px-3 py-2.5 rounded-xl border-2 ${
                            dark
                              ? "border-gray-600 hover:bg-gray-700"
                              : "border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={async () => {
                        await copyPrompt();
                        openInChatGPT();
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      Copy + Open ChatGPT
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div
                  className={`mb-5 p-4 rounded-xl border ${
                    dark
                      ? "bg-gray-900/50 border-gray-700"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>
                        Topic / Task for AI
                      </label>
                      <input
                        value={promptTopic}
                        onChange={(e) =>
                          setPromptTopic(e.target.value)
                        }
                        placeholder="e.g. Explain Kubernetes networking from beginner to intermediate"
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        Template
                      </label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) =>
                          setSelectedTemplateId(
                            e.target.value
                          )
                        }
                        className={inp}
                      >
                        {effectiveTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className={lbl}>Regenerate Topic</label>
                      <input
                        value={templateTopic}
                        onChange={(e) =>
                          setTemplateTopic(e.target.value)
                        }
                        placeholder="e.g. Cloud Security Audit"
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>AI Provider</label>
                      <select
                        value={aiProvider}
                        onChange={(e) =>
                          setAiProvider(
                            e.target
                              .value as "chatgpt" | "notebooklm" | "claude"
                          )
                        }
                        className={inp}
                      >
                        <option value="chatgpt">ChatGPT</option>
                        <option value="notebooklm">NotebookLM</option>
                        <option value="claude">Claude</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={regenerateTemplateContent}
                        disabled={regeneratingTemplate}
                        className="w-full px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {regeneratingTemplate && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        Regenerate Content
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Prompt copy/open uses topic above. Regenerate fetches strict marker content from selected template endpoint.
                  </p>
                </div>

                {/* How-to banner */}
                <div
                  className={`flex gap-4 mb-5 p-4 rounded-xl ${
                    dark
                      ? "bg-blue-900/20 border border-blue-800"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                      ?
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-2">
                      How to use this prompt
                    </p>
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs ${
                        dark
                          ? "text-blue-300"
                          : "text-blue-700"
                      }`}
                    >
                      {[
                        [
                          "1",
                          "Copy",
                          "Click 'Copy Prompt' above",
                        ],
                        [
                          "2",
                          "Open",
                          "Open ChatGPT or Claude",
                        ],
                        [
                          "3",
                          "Paste",
                          "Paste prompt + add notes",
                        ],
                        [
                          "4",
                          "Get",
                          "AI returns marker format",
                        ],
                        [
                          "5",
                          "Generate",
                          "Paste here → Generate",
                        ],
                      ].map(([n, title, desc]) => (
                        <div
                          key={n}
                          className={`p-2.5 rounded-lg ${
                            dark
                              ? "bg-blue-900/30"
                              : "bg-white"
                          } text-center`}
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs mx-auto mb-1">
                            {n}
                          </div>
                          <div className="font-bold mb-0.5">
                            {title}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Prompt Editor / Display */}
                {promptEditing ? (
                  <textarea
                    value={promptText}
                    onChange={(e) =>
                      setPromptText(e.target.value)
                    }
                    className={`w-full h-[520px] p-4 font-mono text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      dark
                        ? "bg-gray-900 border-gray-600 text-gray-200"
                        : "bg-gray-50 border-gray-300 text-gray-900"
                    }`}
                  />
                ) : (
                  <div
                    className={`relative rounded-xl border ${
                      dark
                        ? "bg-gray-900 border-gray-700"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <button
                      onClick={copyPrompt}
                      className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium shadow"
                    >
                      {promptCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                    <pre
                      className={`p-5 text-sm leading-relaxed whitespace-pre-wrap max-h-[520px] overflow-y-auto font-mono select-all ${
                        dark
                          ? "text-gray-300"
                          : "text-gray-800"
                      }`}
                    >
                      {promptText}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SHORTCUTS TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "shortcuts" && (
          <div className="space-y-5">
            <div className={`${card} overflow-hidden`}>
              <div
                className={`px-6 py-4 ${
                  dark
                    ? "bg-gray-700/50"
                    : "bg-gradient-to-r from-slate-50 to-blue-50"
                }`}
              >
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Keyboard className="w-6 h-6 text-blue-500" />
                  Keyboard Shortcuts & Marker Reference
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Complete reference for all shortcuts and every
                  marker command.
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div
                  data-tour="marker-lab"
                  className={`rounded-xl border p-4 ${
                    dark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <Code className="w-4 h-4 text-purple-500" />
                        Marker Lab
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Search all supported markers, aliases, syntax, payload rules, and copy-ready examples.
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                      {filteredMarkerCatalog.length}/{markerCatalog.length} markers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input
                      value={markerSearch}
                      onChange={(e) => setMarkerSearch(e.target.value)}
                      placeholder="Search marker, alias, category, syntax..."
                      className={inp}
                    />
                    <div className={`text-xs rounded-lg px-3 py-2 border ${dark ? "border-gray-700 bg-gray-900 text-gray-300" : "border-gray-200 bg-white text-gray-600"}`}>
                      Tab-aware indent examples: <code>BULLET: \"\tNested\"</code> and <code>BULLET: \"  Nested\"</code> are supported based on <strong>Spacing → Tab Width</strong>.
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                    {filteredMarkerCatalog.map((entry) => (
                      <div
                        key={entry.key}
                        className={`rounded-lg border p-3 ${
                          dark
                            ? "border-gray-700 bg-gray-900/60"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-semibold">
                              {entry.key}:
                            </code>
                            {entry.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                {entry.category}
                              </span>
                            )}
                            {entry.aliases && entry.aliases.length > 0 && (
                              <span className="text-[10px] text-gray-500">
                                aliases: {entry.aliases.join(", ")}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              copyMarkerSnippet(
                                entry.example && entry.example.trim().length > 0
                                  ? entry.example
                                  : `${entry.key}: "Sample"`
                              )
                            }
                            className="px-2 py-1 rounded-md text-[11px] border"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          {entry.description || "No description"}
                        </p>
                        <pre className={`text-[11px] p-2 rounded ${dark ? "bg-gray-800 text-gray-200" : "bg-gray-50 text-gray-700"}`}>
{entry.syntax || `${entry.key}: value`}
                        </pre>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Example: <code>{entry.example || `${entry.key}: "Sample"`}</code>
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Payload: {entry.payloadRules || "Marker-prefixed line."}
                        </p>
                      </div>
                    ))}
                    {filteredMarkerCatalog.length === 0 && (
                      <div className="text-xs text-gray-500">
                        No markers match your search.
                      </div>
                    )}
                  </div>

                  <div className={`mt-3 rounded-lg border p-3 text-xs ${dark ? "border-gray-700 bg-gray-900 text-gray-300" : "border-gray-200 bg-white text-gray-600"}`}>
                    Common fixes:
                    <span className="ml-1">1) Use uppercase marker names.</span>
                    <span className="ml-2">2) Keep <code>MARKER:</code> format.</span>
                    <span className="ml-2">3) Use pipe payload where required (<code>IMAGE</code>, <code>FIGURE</code>, <code>LINK</code>, <code>HIGHLIGHT</code>).</span>
                  </div>
                </div>

                {SHORTCUTS.map((group) => (
                  <div key={group.group}>
                    <h3
                      className={`font-bold text-sm mb-3 pb-2 border-b flex items-center gap-2 ${
                        dark
                          ? "border-gray-700 text-gray-200"
                          : "border-gray-200 text-gray-900"
                      }`}
                    >
                      {group.group === "Editor" ? (
                        <Keyboard className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Code className="w-4 h-4 text-purple-500" />
                      )}
                      {group.group}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.items.map((item, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-2.5 rounded-lg ${
                            dark
                              ? "bg-gray-700/50 hover:bg-gray-700"
                              : "bg-gray-50 hover:bg-gray-100"
                          } transition-colors`}
                        >
                          <div className="flex items-center gap-1 shrink-0">
                            {item.keys.map((k, ki) => (
                              <React.Fragment key={ki}>
                                <KBD k={k} dark={dark} />
                                {ki <
                                  item.keys.length -
                                    1 && (
                                  <span className="text-gray-400 text-xs">
                                    +
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                          <span
                            className={`text-sm ${
                              dark
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            {item.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Highlight Colors */}
                <div>
                  <h3
                    className={`font-bold text-sm mb-3 pb-2 border-b flex items-center gap-2 ${
                      dark
                        ? "border-gray-700"
                        : "border-gray-200"
                    }`}
                  >
                    <Highlighter className="w-4 h-4 text-yellow-500" />
                    HIGHLIGHT Colours
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["yellow", "#FFFF00"],
                      ["green", "#92D050"],
                      ["cyan", "#00FFFF"],
                      ["blue", "#BDD7EE"],
                      ["red", "#FF0000"],
                      ["magenta", "#FF00FF"],
                      ["darkBlue", "#0070C0"],
                      ["darkGreen", "#375623"],
                      ["darkRed", "#C00000"],
                      ["lightGray", "#D9D9D9"],
                      ["darkGray", "#808080"],
                    ].map(([name, hex]) => (
                      <div
                        key={name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium"
                        style={{
                          background: hex,
                          color: [
                            "darkBlue",
                            "darkGreen",
                            "darkRed",
                            "darkGray",
                          ].includes(name)
                            ? "white"
                            : "#111",
                          borderColor: hex,
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                  <p
                    className={`text-xs mt-2 ${
                      dark
                        ? "text-gray-500"
                        : "text-gray-400"
                    }`}
                  >
                    Usage:{" "}
                    <code className="font-mono">
                      HIGHLIGHT: "Your text here" | "yellow"
                    </code>
                  </p>
                </div>

                {/* Pro Tips */}
                <div
                  className={`p-4 rounded-xl ${
                    dark
                      ? "bg-green-900/20 border border-green-800"
                      : "bg-green-50 border border-green-200"
                  }`}
                >
                  <h3 className="font-bold text-green-600 dark:text-green-400 text-sm mb-3">
                    💡 Pro Tips
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      [
                        "Bullet indent",
                        'Use 2 spaces inside quotes: BULLET: "  Indented item"',
                      ],
                      [
                        "Multi-line code",
                        "Use one CODE: per line — they stack into a code block",
                      ],
                      [
                        "Table rows",
                        "First TABLE row = header (styled differently automatically)",
                      ],
                      [
                        "TOC position",
                        "Put TOC: at the very start, after the main HEADING",
                      ],
                      [
                        "Auto-save",
                        "Your draft saves to browser every 30 seconds automatically",
                      ],
                      [
                        "Custom filename",
                        "Type in the filename field before generating — no extension needed",
                      ],
                      [
                        "Theme workflow",
                        "Apply theme → Adjust in Settings → Save Settings → Generate",
                      ],
                      [
                        "AI workflow",
                        "Copy AI Prompt → paste in ChatGPT with notes → copy output → paste here",
                      ],
                    ].map(([title, tip]) => (
                      <div
                        key={title}
                        className={`p-2.5 rounded-lg ${
                          dark ? "bg-gray-800" : "bg-white"
                        }`}
                      >
                        <div className="font-semibold text-xs text-green-600 dark:text-green-400 mb-0.5">
                          {title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {tip}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <audio ref={musicAudioRef} preload="none" />

      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2">
        <button
          onClick={() => setTab("guide")}
          className="px-4 py-2.5 rounded-full shadow-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Open Guide
        </button>
        <button
          onClick={() => openGuidedTour(0)}
          className="px-4 py-2.5 rounded-full shadow-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Start Tour
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          DRAFTS MODAL
      ════════════════════════════════════════════════════════ */}
      {showDrafts && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowDrafts(false)}
        >
          <div
            className={`${card} max-w-2xl w-full max-h-[80vh] overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-6 py-4 border-b ${
                dark
                  ? "border-gray-700 bg-gray-700/50"
                  : "border-gray-100 bg-gray-50"
              } flex items-center justify-between`}
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Folder className="w-5 h-5 text-purple-500" />
                Saved Drafts ({savedDrafts.length}/
                {MAX_DRAFTS})
              </h2>
              <button
                onClick={() => setShowDrafts(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Save current */}
              <div
                className={`p-4 rounded-xl border-2 border-dashed ${
                  dark
                    ? "border-gray-600"
                    : "border-purple-200"
                }`}
              >
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Save Current Document
                </p>
                <div className="flex gap-2">
                  <input
                    value={draftName}
                    onChange={(e) =>
                      setDraftName(e.target.value)
                    }
                    placeholder="Draft name..."
                    className={inp}
                    onKeyDown={(e) =>
                      e.key === "Enter" && saveDraft()
                    }
                  />
                  <button
                    onClick={saveDraft}
                    disabled={!draftName.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="w-4 h-4 inline mr-1" />
                    Save
                  </button>
                </div>
              </div>

              {/* Draft list */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedDrafts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                      No saved drafts yet
                    </p>
                    <p className="text-xs mt-1">
                      Save your current document above to
                      create one
                    </p>
                  </div>
                ) : (
                  savedDrafts
                    .slice()
                    .reverse()
                    .map((draft) => (
                      <div
                        key={draft.id}
                        className={`p-4 rounded-lg border ${
                          dark
                            ? "bg-gray-700/50 border-gray-600 hover:bg-gray-700"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        } transition-colors`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">
                              {draft.name}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Saved{" "}
                              {new Date(
                                draft.savedAt
                              ).toLocaleString()}{" "}
                              ·{" "}
                              {
                                draft.content.split("\n")
                                  .length
                              }{" "}
                              lines
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <button
                              onClick={() =>
                                loadDraft(draft)
                              }
                              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                              title="Load"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                deleteDraft(draft.id)
                              }
                              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div
                          className={`text-xs font-mono p-2 rounded ${
                            dark
                              ? "bg-gray-800"
                              : "bg-white"
                          } overflow-hidden`}
                          style={{ maxHeight: "60px" }}
                        >
                          {draft.content
                            .split("\n")
                            .slice(0, 3)
                            .join("\n")}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ASCII MODAL
      ════════════════════════════════════════════════════════ */}
      {showASCII && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setShowASCII(false)}
        >
          <div
            className={`${card} max-w-3xl w-full max-h-[80vh] overflow-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-6 py-4 border-b ${
                dark ? "border-gray-700" : "border-gray-200"
              } flex items-center justify-between`}
            >
              <h2 className="text-lg font-bold">
                ASCII Character Helper
              </h2>
              <button onClick={() => setShowASCII(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3 text-sm">
                  Box Characters (click to copy)
                </h3>
                <div className="grid grid-cols-12 gap-2">
                  {[
                    "┌",
                    "┐",
                    "└",
                    "┘",
                    "│",
                    "─",
                    "├",
                    "┤",
                    "┬",
                    "┴",
                    "┼",
                    "═",
                    "║",
                    "╔",
                    "╗",
                    "╚",
                    "╝",
                  ].map((char) => (
                    <button
                      key={char}
                      onClick={() => {
                        navigator.clipboard.writeText(char);
                        setSuccess(`Copied: ${char}`);
                      }}
                      className={`p-3 rounded-lg font-mono text-xl ${
                        dark
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-sm">
                  Arrows & Symbols
                </h3>
                <div className="grid grid-cols-12 gap-2">
                  {[
                    "→",
                    "←",
                    "↑",
                    "↓",
                    "●",
                    "○",
                    "■",
                    "□",
                    "▲",
                    "▼",
                    "◆",
                    "★",
                    "☆",
                    "✓",
                    "✗",
                  ].map((char) => (
                    <button
                      key={char}
                      onClick={() => {
                        navigator.clipboard.writeText(char);
                        setSuccess(`Copied: ${char}`);
                      }}
                      className={`p-3 rounded-lg font-mono text-xl ${
                        dark
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-sm">
                  Quick Templates
                </h3>
                <button
                  onClick={() => {
                    const template = `ASCII: "┌─────────┐"\nASCII: "│  Start  │"\nASCII: "└────┬────┘"\nASCII: "     │"\nASCII: "     ▼"\nASCII: "┌─────────┐"\nASCII: "│   End   │"\nASCII: "└─────────┘"`;
                    const cursor =
                      taRef.current?.selectionStart ||
                      text.length;
                    handleText(
                      text.slice(0, cursor) +
                        "\n" +
                        template +
                        "\n" +
                        text.slice(cursor)
                    );
                    setShowASCII(false);
                    setSuccess(
                      "✅ Inserted flowchart template"
                    );
                  }}
                  className={`w-full text-left p-3 rounded-lg border ${
                    dark
                      ? "border-gray-600 hover:border-blue-500"
                      : "border-gray-200 hover:border-blue-400"
                  }`}
                >
                  <div className="font-semibold text-sm">
                    Simple Flowchart
                  </div>
                  <pre className="text-xs mt-1 text-gray-500">
                    ┌─────┐{"\n"}│Start│{"\n"}└──┬──┘...
                  </pre>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {guidedTourOpen && activeTourStep && (
        <>
          <div className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-[1px]" />
          {guidedTourRect && (
            <>
              <div
                className="fixed z-[71] rounded-2xl ring-2 ring-cyan-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)] pointer-events-none"
                style={{
                  top: `${Math.max(8, guidedTourRect.top - 8)}px`,
                  left: `${Math.max(8, guidedTourRect.left - 8)}px`,
                  width: `${guidedTourRect.width + 16}px`,
                  height: `${guidedTourRect.height + 16}px`,
                }}
              />
              <div
                className="fixed z-[72] w-8 h-8 rounded-full bg-cyan-500 text-slate-950 text-sm font-bold flex items-center justify-center shadow-lg pointer-events-none"
                style={{
                  top: `${Math.max(8, guidedTourRect.top - 16)}px`,
                  left: `${Math.max(8, guidedTourRect.left - 16)}px`,
                }}
              >
                {guidedTourIndex + 1}
              </div>
            </>
          )}
          <div
            className={`${card} fixed z-[73] p-5 border-cyan-300 dark:border-cyan-700 shadow-2xl`}
            style={guidedTourCardStyle}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-500 font-bold">
                  Guided Tour
                </p>
                <h3 className="text-base font-bold mt-1">
                  {activeTourStep.title}
                </h3>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {guidedTourIndex + 1}/{GUIDED_TOUR_STEPS.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {activeTourStep.description}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={skipGuidedTour}
                className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                  dark
                    ? "border-gray-600 hover:bg-gray-700"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                Skip
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={previousGuidedTourStep}
                  disabled={guidedTourIndex === 0}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                    guidedTourIndex === 0
                      ? "opacity-40 cursor-not-allowed border-transparent"
                      : dark
                        ? "border-gray-600 hover:bg-gray-700"
                        : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Back
                </button>
                <button
                  onClick={nextGuidedTourStep}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                >
                  {guidedTourIndex === GUIDED_TOUR_STEPS.length - 1
                    ? "Finish"
                    : "Next"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <input
        ref={themeImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onThemeImportInput}
      />
      <input
        ref={templateImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onTemplateImportInput}
      />
      <input
        ref={promptImportInputRef}
        type="file"
        accept=".txt,.md,.json,text/plain,application/json"
        className="hidden"
        onChange={onPromptImportInput}
      />

      {/* ════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════ */}
      <footer
        className={`mt-10 py-3 text-center border-t text-xs ${
          dark
            ? "border-gray-800 text-gray-600"
            : "border-gray-200 text-gray-400"
        }`}
      >
        Quick Doc Formatter v8.0.0 · {stats.words} words ·{" "}
        {stats.mins} min read · Theme:{" "}
        {themes[currentTheme]?.name || currentTheme}
      </footer>
    </div>
  );
}


