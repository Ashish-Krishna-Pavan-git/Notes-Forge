// App.tsx — NotesForge Professional v6.2 (Complete Rewrite)
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
import { API_BASE, API_HEALTH_TIMEOUT_MS, HAS_EXPLICIT_API_URL } from "./lib/config";
import { api, apiGet, apiPost, getErrorMessage, withRetry } from "./lib/api";
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
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const API = API_BASE;

const AUTOSAVE_MS = 30_000;
const ANALYZE_DEBOUNCE_MS = 600;
const HEALTH_INTERVAL_MS = 30_000;
const MAX_HISTORY = 100;
const MAX_DRAFTS = 10;
const MAX_RECENT_EXPORTS = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

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
}

type TabId =
  | "editor"
  | "templates"
  | "settings"
  | "prompt"
  | "guide"
  | "shortcuts";
type SettingsTabId = "themes" | "fonts" | "colors" | "spacing" | "page";
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

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & MAPS
// ═══════════════════════════════════════════════════════════════════

const VALID_MARKERS = new Set([
  "HEADING", "H1", "SUBHEADING", "H2", "SUB-SUBHEADING", "H3",
  "H4", "H5", "H6", "PARAGRAPH", "PARA", "BULLET", "NUMBERED",
  "CODE", "TABLE", "QUOTE", "NOTE", "IMPORTANT", "IMAGE", "LINK",
  "HIGHLIGHT", "FOOTNOTE", "TOC", "ASCII", "DIAGRAM", "LABEL",
  "CENTER", "RIGHT", "JUSTIFY", "WATERMARK", "PAGEBREAK",
]);

const MARKER_AUTOCOMPLETE = [
  "H1:",
  "H2:",
  "H3:",
  "H4:",
  "H5:",
  "H6:",
  "PARAGRAPH:",
  "CENTER:",
  "RIGHT:",
  "JUSTIFY:",
  "BULLET:",
  "NUMBERED:",
  "CODE:",
  "ASCII:",
  "TABLE:",
  "IMAGE:",
  "LINK:",
  "HIGHLIGHT:",
  "FOOTNOTE:",
  "TOC:",
  "PAGEBREAK:",
];

const PIPE_REQUIRED_MARKERS = new Set(["IMAGE", "LINK", "HIGHLIGHT"]);

const TYPE_COLOR: Record<string, string> = {
  h1: "bg-orange-500", h2: "bg-amber-500", h3: "bg-blue-600",
  h4: "bg-blue-500", h5: "bg-indigo-500", h6: "bg-purple-500",
  paragraph: "bg-gray-500", bullet: "bg-purple-600",
  numbered: "bg-purple-500", code: "bg-slate-700", table: "bg-teal-600",
  quote: "bg-yellow-600", note: "bg-green-600", image: "bg-pink-600",
  link: "bg-sky-600", highlight: "bg-yellow-500", footnote: "bg-gray-600",
  toc: "bg-orange-600", ascii: "bg-rose-600",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  h1: <Hash className="w-3 h-3" />,
  h2: <Hash className="w-3 h-3" />,
  h3: <Hash className="w-3 h-3" />,
  paragraph: <AlignLeft className="w-3 h-3" />,
  bullet: <List className="w-3 h-3" />,
  code: <Code className="w-3 h-3" />,
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
    spacing: { line_spacing: 1.4 },
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
};

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

const FALLBACK_PROMPT = `You are NotesForge Formatter v6.2.

TASK:
Convert user input into STRICT NotesForge marker syntax for direct export.

STRICT RULES:
1. Every non-empty line MUST start with a valid marker and colon.
2. No markdown fences, no explanations, no extra commentary.
3. Use deterministic structure and concise professional language.
4. Keep all data in marker lines only (no free text lines).

VALID MARKERS:
H1:
H2:
H3:
H4:
H5:
H6:
PARAGRAPH:
CENTER:
RIGHT:
JUSTIFY:
BULLET:
NUMBERED:
CODE:
ASCII:
TABLE:
PAGEBREAK:
NOTE:
QUOTE:
TOC:
LINK:
IMAGE:
HIGHLIGHT:
FOOTNOTE:

OUTPUT PATTERN:
H1: Title
H2: Section
PARAGRAPH: Summary sentence.
BULLET: Item 1
BULLET: Item 2
TABLE: Header A | Header B | Header C
TABLE: Value A1 | Value B1 | Value C1
CODE: command --flag value
PAGEBREAK:
H2: Next Section

QUALITY:
- Include TABLE when the topic has structured data.
- Include CODE when technical actions are relevant.
- Use PAGEBREAK between major sections in long documents.
- Prefer clear heading hierarchy and short paragraphs.

Return ONLY NotesForge marker lines.`;

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
      { keys: ["HEADING:"], desc: '"Title" — H1 main heading' },
      { keys: ["SUBHEADING:"], desc: '"Name" — H2 section' },
      { keys: ["SUB-SUBHEADING:"], desc: '"Name" — H3 sub-section' },
      { keys: ["PARAGRAPH:"], desc: '"Text…" — body paragraph' },
      {
        keys: ["BULLET:"],
        desc: '"Point" or "  Indented" (2 spaces)',
      },
      { keys: ["CODE:"], desc: '"code line" — monospace block' },
      { keys: ["TABLE:"], desc: '"Col1 | Col2" — pipe separated' },
      { keys: ["NOTE:"], desc: '"Warning or tip"' },
      { keys: ["QUOTE:"], desc: '"Quoted text"' },
      { keys: ["HIGHLIGHT:"], desc: '"Text" | "yellow"' },
      { keys: ["LINK:"], desc: '"Label" | "https://url"' },
      {
        keys: ["IMAGE:"],
        desc: '"file.png" | "Caption" | "center"',
      },
      { keys: ["FOOTNOTE:"], desc: '"Source reference"' },
      { keys: ["TOC:"], desc: "Inserts table of contents" },
      { keys: ["ASCII:"], desc: '"─── diagram line ───"' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════

const SAMPLE_EXAMPLE = `H1: NotesForge - Cybersecurity Incident Summary
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

const TEMPLATES: readonly {
  id: string;
  name: string;
  category: string;
  icon: string;
  content: string;
}[] = [
  {
    id: "quickstart",
    name: "Quick Start (New User)",
    category: "Academic",
    icon: "🚀",
    content: `HEADING: "My First NotesForge Document"
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

function validateMarkersInText(text: string): MarkerError[] {
  const errors: MarkerError[] = [];
  const lines = text.split("\n");

  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (!trimmed || !trimmed.includes(":")) continue;

    const match = trimmed.match(/^([A-Z][A-Z0-9-]*):(.*)$/);
    if (!match) continue;

    const [, marker, rest] = match;

    if (!VALID_MARKERS.has(marker)) {
      const suggestion = [...VALID_MARKERS].find((m) =>
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

function validateStrictModeLines(text: string): MarkerError[] {
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
    if (!VALID_MARKERS.has(marker)) {
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
  colors: Record<string, string> = {}
): string {
  const lines = text.split("\n");
  const parts: string[] = [];

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
        const indent =
          (raw.length - raw.trimStart().length) / 2;
        const cleaned = escapeHtml(raw.trim());
        parts.push(
          `<div class="text-sm mb-1" style="margin-left:${
            indent * 20 + 20
          }px;color:${cBody}">• ${cleaned}</div>`
        );
        break;
      }
      case "NUMBERED": {
        const numContent = escapeHtml(
          rawRest
            .trim()
            .replace(/^["']|["']$/g, "")
            .replace(/^\s*\d+[.)]\s*/, "")
        );
        parts.push(
          `<div class="text-sm mb-1 ml-5" style="color:${cBody}">${numContent}</div>`
        );
        break;
      }
      case "CODE":
        parts.push(
          `<pre class="text-xs p-2 rounded font-mono mb-1" style="background:${cCodeBg};color:${cCodeText}">${content}</pre>`
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
      case "ASCII":
      case "DIAGRAM":
        parts.push(
          `<pre class="text-xs font-mono leading-none mb-1" style="color:${cBody}">${content}</pre>`
        );
        break;
      case "PAGEBREAK":
        parts.push(
          `<div class="my-4 border-t-2 border-dashed border-gray-300 pt-2 text-[11px] uppercase tracking-wide text-gray-400">Page Break</div>`
        );
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

function analyzeTextLocally(text: string): AnalysisResult {
  const lines = text.split("\n");
  const statistics: Record<string, number> = {};
  const classifications: ClassRow[] = [];

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
    CODE: "code",
    TABLE: "table",
    ASCII: "ascii",
    DIAGRAM: "ascii",
    TOC: "toc",
    NOTE: "note",
    IMPORTANT: "note",
    QUOTE: "quote",
    IMAGE: "image",
    LINK: "link",
    HIGHLIGHT: "highlight",
    FOOTNOTE: "footnote",
    PAGEBREAK: "pagebreak",
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
        if (marker === "BULLET" && content) {
          const leading =
            content.length - content.trimStart().length;
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

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  // ── Core Editor State ─────────────────────────────────────────
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([""]);
  const [hIdx, setHIdx] = useState(0);

  // ── UI State ──────────────────────────────────────────────────
  const [tab, setTab] = useState<TabId>("editor");
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
  const [markerSuggestions, setMarkerSuggestions] = useState<
    string[]
  >([]);

  // ── Generation State ──────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
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

  // ── Analysis ──────────────────────────────────────────────────
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(
    null
  );
  const [analyzing, setAnalyzing] = useState(false);

  // ── Config / Themes ───────────────────────────────────────────
  const [themes, setThemes] = useState<Record<string, ThemeInfo>>(
    FALLBACK_THEME_CATALOG
  );
  const [currentTheme, setCurrentTheme] = useState("professional");
  const [config, setConfig] = useState<AppConfigState>({
    fonts: { family: "Calibri", family_code: "Fira Code" },
    header: { enabled: true },
    footer: { enabled: true },
    page: {},
    colors: {},
    spacing: {},
  });
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
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [regeneratingTemplate, setRegeneratingTemplate] =
    useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);

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
  const healthCheckInFlight = useRef(false);
  const themeFallbackNotified = useRef(false);
  const analyzeFallbackNotified = useRef(false);

  // ═════════════════════════════════════════════════════════════
  // DERIVED / MEMOIZED VALUES
  // ═════════════════════════════════════════════════════════════

  const debouncedText = useDebounce(text, ANALYZE_DEBOUNCE_MS);

  const markerErrors = useMemo(
    () =>
      debouncedText.trim()
        ? validateMarkersInText(debouncedText)
        : [],
    [debouncedText]
  );

  const strictErrors = useMemo(
    () =>
      strictMode && debouncedText.trim()
        ? validateStrictModeLines(debouncedText)
        : [],
    [strictMode, debouncedText]
  );

  const allMarkerErrors = useMemo(
    () => [...markerErrors, ...strictErrors],
    [markerErrors, strictErrors]
  );

  const selectedApiTemplate = useMemo(
    () =>
      apiTemplates.find((tpl) => tpl.id === selectedTemplateId) ||
      null,
    [apiTemplates, selectedTemplateId]
  );

  const effectiveTemplates = useMemo(() => {
    if (apiTemplates.length > 0) {
      return apiTemplates.map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        category: "Professional",
        icon: "🧩",
        content: tpl.sampleContent,
      }));
    }
    return TEMPLATES;
  }, [apiTemplates]);

  const previewHTML = useMemo(
    () =>
      (showPreview || splitPreview) && text.trim()
        ? buildPreviewHTML(text, config.colors)
        : "",
    [text, showPreview, splitPreview, config.colors]
  );

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
    setOnline((prev) =>
      prev === "online" ? "online" : "waking"
    );
    const startedAt = Date.now();
    try {
      try {
        const health = await withRetry(
          () =>
            apiGet<{ status: string }>("/api/health", {
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
            }>("/api/version", { timeout: API_HEALTH_TIMEOUT_MS });
            if (ver?.version) setBackendVersion(ver.version);
          } catch {
            try {
              const parser = await apiGet<{ version?: string }>(
                "/api/health/parser",
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
          await apiGet("/health", {
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
    }
  }, []);

  const loadTemplateCatalog = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const payload = await withRetry(
        () =>
          apiGet<ApiTemplate[] | { templates?: ApiTemplate[] }>(
            "/api/templates",
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

  const loadThemes = useCallback(async () => {
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
      }>("/api/themes");
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
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const r = await apiGet<{
        success?: boolean;
        config?: AppConfigState;
      }>("/api/config");
      if (r.success && r.config) setConfig(r.config);
      else {
        const local = localStorage.getItem("nf_local_config");
        if (local) setConfig(JSON.parse(local));
      }
    } catch {
      try {
        const local = localStorage.getItem("nf_local_config");
        if (local) setConfig(JSON.parse(local));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const loadPrompt = useCallback(async () => {
    try {
      const r = await apiGet<{
        success?: boolean;
        prompt?: string;
      }>("/api/prompt");
      if (r.success && r.prompt && r.prompt.trim().length > 20)
        setPromptText(r.prompt);
    } catch {
      /* silent */
    }
  }, []);

  const doAnalyze = useCallback(async () => {
    if (!debouncedText.trim()) {
      setAnalysis(null);
      return;
    }
    setAnalyzing(true);
    try {
      const r = await apiPost<AnalysisResult>("/api/analyze", {
        text: debouncedText,
      });
      if (r.success) setAnalysis(r);
      else setAnalysis(analyzeTextLocally(debouncedText));
    } catch {
      setAnalysis(analyzeTextLocally(debouncedText));
      analyzeFallbackNotified.current = true;
    } finally {
      setAnalyzing(false);
    }
  }, [debouncedText]);

  const doGenerate = useCallback(async () => {
    if (!text.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setWarn(null);
    try {
      const themePayload = {
        name: themes[currentTheme]?.name || currentTheme,
        primaryColor:
          config.colors?.h1 || config.header?.color || "#1F3A5F",
        fontFamily:
          config.fonts?.family || "Calibri, Arial, sans-serif",
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
          lineHeight: config.spacing?.line_spacing || 1.4,
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
            config.spacing?.line_spacing || 1.4,
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
          paragraph_first_line_indent:
            config.spacing
              ?.paragraph_first_line_indent ?? 0,
        },
      };

      const r = await apiPost<{
        success?: boolean;
        downloadUrl?: string;
        download_url?: string;
        fileId?: string;
        filename?: string;
        requestedFormat?: string;
        requested_format?: string;
        actualFormat?: string;
        actual_format?: string;
        warning?: string;
        warnings?: string[];
        error?: string;
      }>("/api/generate", {
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
            (config.footer?.page_format || "")
              .toLowerCase()
              .includes("of")
              ? "page_x_of_y"
              : "page_x",
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
                  position:
                    config.watermark?.position === "top"
                      ? "header"
                      : "center",
                }
              : undefined,
        },
      });
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
      const normalizedBase = (customName || "notesforge_output")
        .replace(/[^a-z0-9_\- ]/gi, "")
        .trim()
        .replace(/\s+/g, "_");
      const filename =
        r.filename ||
        `${normalizedBase || "notesforge_output"}.${
          actualFormat === "txt" ? "txt" : actualFormat
        }`;
      const warningMessage =
        r.warning ||
        (Array.isArray(r.warnings) && r.warnings.length > 0
          ? r.warnings.join(" | ")
          : "");
      if (r.success || downloadUrl) {
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
        }>("/api/themes/apply", {
          theme_name: name,
        });
        if (r.success) {
          setCurrentTheme(name);
          if (r.config)
            setConfig(
              mergeThemeIntoConfig(r.config, name, themes[name])
            );
          else
            setConfig((prev) =>
              mergeThemeIntoConfig(prev, name, themes[name])
            );
          setDirty(false);
          setSuccess(
            `✅ Theme applied: ${themes[name]?.name || name}`
          );
        }
      } catch {
        setCurrentTheme(name);
        setConfig((prev) =>
          mergeThemeIntoConfig(prev, name, themes[name])
        );
        localStorage.setItem(
          "nf_local_config",
          JSON.stringify(
            mergeThemeIntoConfig(config, name, themes[name])
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
          await apiPost("/api/config/update", {
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
      await apiPost("/api/themes/save", {
        key: savedKey,
        name: newThemeName,
        description: newThemeDesc,
        config,
      });
      await apiPost("/api/themes/apply", {
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
        mergeThemeIntoConfig(prev, savedKey, localThemePayload)
      );
      localStorage.setItem(
        "nf_local_config",
        JSON.stringify(
          mergeThemeIntoConfig(config, savedKey, localThemePayload)
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
        await apiPost("/api/themes/delete", { key });
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
  // PROMPT
  // ═════════════════════════════════════════════════════════════

  const savePrompt = useCallback(async () => {
    setPromptSaving(true);
    try {
      await apiPost("/api/prompt", {
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
      }>("/api/templates/regenerate", {
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
        `Using NotesForge marker syntax (H1–H6, PARAGRAPH, BULLET, NUMBERED, TABLE, CODE), generate structured content about '${topic}' for '${selectedTemplateId}' template. Output only markers.`;
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

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem("nf_onboard_done", "1");
  }, []);

  const downloadRecentExport = useCallback((item: RecentExport) => {
    const a = document.createElement("a");
    a.href = `${API}${item.download_url}`;
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
        cur[keys[keys.length - 1]] = value;
        return next;
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
      const next = MARKER_AUTOCOMPLETE.filter((m) =>
        m.startsWith(prefix)
      ).slice(0, 6);
      setMarkerSuggestions(next);
    },
    []
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

    checkHealth();
    loadThemes();
    loadTemplateCatalog();
    loadConfig();
    loadPrompt();

    const iv = setInterval(checkHealth, HEALTH_INTERVAL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (online !== "online") return;
    loadThemes();
    loadTemplateCatalog();
    loadConfig();
    loadPrompt();
  }, [online, loadThemes, loadTemplateCatalog, loadConfig, loadPrompt]);

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
    if (
      apiTemplates.length > 0 &&
      !apiTemplates.some((tpl) => tpl.id === selectedTemplateId)
    ) {
      setSelectedTemplateId(apiTemplates[0].id);
    }
  }, [apiTemplates, selectedTemplateId]);

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
      className={`min-h-screen transition-colors duration-300 ${
        dark
          ? "bg-gray-900 text-gray-100"
          : "bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 text-gray-900"
      }`}
    >
      {/* ────────────────────────────────────────────────────────
          HEADER
      ──────────────────────────────────────────────────────── */}
      <header
        className={`shadow-2xl ${
          dark
            ? "bg-gradient-to-r from-gray-900 via-gray-800 to-black"
            : "bg-gradient-to-r from-blue-700 via-purple-700 to-pink-600"
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
                  NotesForge Professional
                </h1>
                <p className="text-xs text-white/60">
                  v6.2 · Full Featured
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 bg-white/10">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    online === "online"
                      ? "bg-green-400 animate-pulse"
                      : online === "error"
                        ? "bg-red-400"
                        : "bg-yellow-400"
                  }`}
                />
                {online === "online"
                  ? "Connected"
                  : online === "error"
                    ? "Backend error"
                    : "Waking backend"}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs bg-white/10">
                API v{backendVersion}
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
              >
                {fullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
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
            className={`${card} mb-4 p-3 flex items-center justify-between gap-3 border-red-200 dark:border-red-800`}
          >
            <div className="text-sm text-red-600 dark:text-red-300">
              {online === "error"
                ? "Backend offline or unreachable. Please retry."
                : "Backend offline or starting. Please wait 10–15 seconds."}
            </div>
            <button
              onClick={checkHealth}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50"
            >
              Retry
            </button>
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
                        How NotesForge Works
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Write simple markers, then export
                        polished documents.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                        BULLET: "Ship v6.3"
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
                      __html: previewHTML,
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
                            className={`px-2 py-1 rounded-md text-xs font-mono border ${
                              dark
                                ? "border-gray-600 hover:bg-gray-700"
                                : "border-gray-300 hover:bg-white"
                            }`}
                          >
                            {marker}
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
                          previewHTML ||
                          '<p class="text-sm text-gray-400">Start typing to preview...</p>',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Generate Bar */}
              <div className={`${card} p-4`}>
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
                {format === "pdf" && (
                  <p className="text-xs mt-2 text-gray-400">
                    PDF needs LibreOffice or docx2pdf on the
                    server — falls back to DOCX if unavailable.
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
                  First time using NotesForge? Follow these 5 steps.
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
              </div>

              <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              {/* Settings Content */}
              <div className={`${card} p-6 lg:col-span-3`}>
                  {settingsTab === "themes" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          Visual Themes
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Controls fonts, colours, spacing — the look of your exported document.
                        </p>

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
                              "Hello, NotesForge!" #
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
                            0.1,
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
                                  placeholder={`e.g. © ${new Date().getFullYear()} NotesForge`}
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
                                  <option value="alpha">
                                    A, B, C
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

                                  <div>
                                    <label className={lbl}>
                                      Opacity:{" "}
                                      {(
                                        (config
                                          .watermark
                                          ?.opacity || 0.15) *
                                        100
                                      ).toFixed(0)}
                                      %
                                    </label>
                                    <input
                                      type="range"
                                      min="0.05"
                                      max="0.5"
                                      step="0.05"
                                      value={
                                        config.watermark
                                          ?.opacity || 0.15
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.opacity",
                                          parseFloat(
                                            e.target.value
                                          )
                                        )
                                      }
                                      className="w-full accent-purple-600"
                                    />
                                  </div>

                                  <div>
                                    <label className={lbl}>
                                      Rotation:{" "}
                                      {config.watermark
                                        ?.rotation ||
                                        315}
                                      °
                                    </label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="360"
                                      step="5"
                                      value={
                                        config.watermark
                                          ?.rotation ||
                                        315
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.rotation",
                                          parseInt(
                                            e.target.value
                                          )
                                        )
                                      }
                                      className="w-full accent-purple-600"
                                    />
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

                                  <div>
                                    <label className={lbl}>
                                      Placement
                                    </label>
                                    <select
                                      value={
                                        config.watermark
                                          ?.position ||
                                        "center"
                                      }
                                      onChange={(e) =>
                                        cfgLocal(
                                          "watermark.position",
                                          e.target.value
                                        )
                                      }
                                      className={inp}
                                    >
                                      <option value="center">
                                        Center
                                      </option>
                                      <option value="top">
                                        Top
                                      </option>
                                      <option value="bottom">
                                        Bottom
                                      </option>
                                      <option value="left">
                                        Left
                                      </option>
                                      <option value="right">
                                        Right
                                      </option>
                                    </select>
                                  </div>
                                </>
                              )}
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
                        {apiTemplates.length > 0
                          ? apiTemplates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name}
                              </option>
                            ))
                          : TEMPLATES.map((tpl) => (
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
        NotesForge Professional v6.2 · {stats.words} words ·{" "}
        {stats.mins} min read · Theme:{" "}
        {themes[currentTheme]?.name || currentTheme}
      </footer>
    </div>
  );
}
