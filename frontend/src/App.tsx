import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import DOMPurify from "dompurify";

import type {
  AiProvider,
  ExportFormat,
  GenerateRequest,
  PreviewRequest,
  Template,
  Theme,
  WatermarkType,
} from "./types";
import { notesforgeToMarkdown } from "./lib/copyFormats";
import { renderLocalPreview } from "./lib/localPreview";
import { useDebounce } from "./lib/useDebounce";
import {
  apiCreateTheme,
  apiGenerate,
  apiPreview,
  apiRegenerateTemplate,
  apiTemplates,
  createApiClient,
} from "./lib/api";

const SAMPLE_EXAMPLE = `H1: NotesForge — Cybersecurity Incident Summary
H2: Executive Summary
PARAGRAPH: A brief summary of the incident, its impact, and immediate actions taken.
H2: Details
PARAGRAPH: The incident occurred on 2026-02-24 at 22:15 IST. Affected systems included DB server and internal API.
BULLET:
- Initial detection via IDS alert.
- Systems isolated.
- Forensic snapshot taken.
H2: Indicators of Compromise (IOCs)
TABLE:
| Type | Value | Notes |
| IP | 203.0.113.45 | Suspicious outbound traffic |
| Hash | e3b0c442... | Malware sample hash |
H2: Recommendations
NUMBERED:
1. Rotate compromised credentials.
2. Patch vulnerable services.
3. Run a full internal audit.
CODE:
curl -X GET "https://internal-api.local/health" -H "Authorization: Bearer <token>"`;

const PROFESSIONAL_THEME: Theme = {
  name: "Professional",
  primaryColor: "#1F3A5F",
  fontFamily: "Calibri, Arial, sans-serif",
  headingStyle: {
    h1: { size: 24, weight: "700", color: "#1F3A5F" },
    h2: { size: 20, weight: "600" },
  },
  bodyStyle: { size: 11, lineHeight: 1.4 },
  tableStyle: { borderWidth: 1, borderColor: "#ddd", headerFill: "#f6f6f6" },
  margins: { top: 25, bottom: 25, left: 25, right: 25 },
};

const LOCAL_TEMPLATES: Template[] = [
  {
    id: "assignment",
    name: "Assignment",
    description: "Academic assignment/report layout",
    defaultTheme: PROFESSIONAL_THEME,
    aiPromptTemplate:
      "Write a structured assignment on {topic} using NotesForge markers: H1:Title, H2:Overview, PARAGRAPH, BULLET, TABLE, CODE if needed.",
    sampleContent: SAMPLE_EXAMPLE,
  },
  {
    id: "resume",
    name: "Resume",
    description: "One page resume layout",
    defaultTheme: PROFESSIONAL_THEME,
    aiPromptTemplate:
      "Generate a concise one-page resume for {topic} (role), with sections: H1:Name, H2:Profile, BULLET:Experience, BULLET:Skills, PARAGRAPH:Summary.",
    sampleContent:
      "H1: Candidate Name\nH2: Profile\nPARAGRAPH: Short profile statement.\nH2: Experience\nBULLET:\n- Role at Company A\n- Role at Company B\nH2: Skills\nBULLET:\n- Skill 1\n- Skill 2\nH2: Summary\nPARAGRAPH: One-line summary.",
  },
  {
    id: "report",
    name: "Report",
    description: "Professional report",
    defaultTheme: PROFESSIONAL_THEME,
    aiPromptTemplate:
      "Create a professional report for {topic} using NotesForge markers including H1, H2, PARAGRAPH, TABLE, BULLET, and Conclusion.",
    sampleContent:
      "H1: Professional Report\nH2: Executive Summary\nPARAGRAPH: Objective and scope.\nH2: Findings\nTABLE:\n| Area | Status | Note |\n| Risk | Medium | Follow-up required |\nH2: Recommendations\nBULLET:\n- Recommendation A\n- Recommendation B\nH2: Conclusion\nPARAGRAPH: Final summary.",
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    description: "Meeting minutes template",
    defaultTheme: PROFESSIONAL_THEME,
    aiPromptTemplate:
      "Give meeting minutes for {topic} with H1, PARAGRAPH, BULLET for action items, and NUMBERED for agenda.",
    sampleContent:
      "H1: Meeting Minutes\nPARAGRAPH: Date, attendees, and objective.\nH2: Agenda\nNUMBERED:\n1. Review updates\n2. Discuss blockers\n3. Confirm actions\nH2: Action Items\nBULLET:\n- Owner A: complete task X\n- Owner B: send summary",
  },
  {
    id: "cybersec",
    name: "Cybersecurity Report",
    description: "Incident or audit report for security",
    defaultTheme: PROFESSIONAL_THEME,
    aiPromptTemplate:
      "Write a cybersecurity incident report for {topic} with sections: H1:Incident Title, H2:Executive Summary, PARAGRAPH, TABLE:Indicators, BULLET:Recommendations, CODE for IOCs if present.",
    sampleContent: SAMPLE_EXAMPLE,
  },
];

type BackendStatus = "checking" | "online" | "offline";
type MobileTab = "edit" | "preview" | "settings";

interface Toast {
  id: string;
  text: string;
  tone: "success" | "error" | "info";
}

const ENV_API_URL = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;

function buildPrompt(topic: string, templateName: string): string {
  return `Using NotesForge marker syntax (H1–H6, PARAGRAPH, BULLET, NUMBERED, TABLE, CODE), generate a structured document about '${topic}' for the '${templateName}' template. Keep sections concise, include sample TABLE and CODE if relevant, and ensure the content is deterministic. Output ONLY NotesForge markers content, no commentary.`;
}

export default function App() {
  const [content, setContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [headingCount, setHeadingCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [theme, setTheme] = useState<Theme>(PROFESSIONAL_THEME);
  const [topic, setTopic] = useState("Cybersecurity Incident");
  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [promptText, setPromptText] = useState("");
  const [format, setFormat] = useState<ExportFormat>("docx");
  const [filename, setFilename] = useState("notesforge_output");
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [disableEditingDocx, setDisableEditingDocx] = useState(false);
  const [passwordProtectPdf, setPasswordProtectPdf] = useState("");
  const [watermarkType, setWatermarkType] = useState<WatermarkType>("text");
  const [watermarkValue, setWatermarkValue] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const debouncedContent = useDebounce(content, 500);
  const [apiBase, setApiBase] = useState<string>(ENV_API_URL ?? "");
  const candidateBases = useMemo(() => {
    const browserDefault = `${window.location.protocol}//${window.location.hostname}:8000`;
    const persisted = localStorage.getItem("nf_v5_api_base") ?? "";
    const raw = [ENV_API_URL ?? "", persisted, browserDefault, "http://127.0.0.1:8000", "http://localhost:8000"];
    return Array.from(new Set(raw.map((v) => v.trim()).filter(Boolean)));
  }, []);
  const client = useMemo(() => (apiBase ? createApiClient(apiBase) : null), [apiBase]);

  const score = useMemo(() => {
    const base = Math.min(55, wordCount / 3) + Math.min(35, headingCount * 7) - Math.min(30, warnings.length * 4);
    return Math.max(0, Math.min(100, Math.round(base)));
  }, [headingCount, warnings.length, wordCount]);

  const notify = useCallback((tone: Toast["tone"], text: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, tone, text }].slice(-4));
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3200);
  }, []);

  const applyPreview = useCallback(
    (html: string, noteWarnings: string[], stats: { wordCount: number; headingCount: number; readingTimeMinutes: number }) => {
      setPreviewHtml(DOMPurify.sanitize(html));
      setWarnings(noteWarnings);
      setWordCount(stats.wordCount);
      setHeadingCount(stats.headingCount);
      setReadingTime(stats.readingTimeMinutes);
    },
    [],
  );

  const previewLocal = useCallback(
    (text: string, activeTheme: Theme) => {
      const result = renderLocalPreview(text, activeTheme);
      applyPreview(result.previewHtml, result.warnings, result.structure);
    },
    [applyPreview],
  );

  const checkHealth = useCallback(async () => {
    setStatus("checking");
    const orderedBases = Array.from(
      new Set([apiBase, ...candidateBases].map((v) => v.trim()).filter(Boolean)),
    );

    for (const base of orderedBases) {
      const probeClient = createApiClient(base);
      for (const path of ["/api/health", "/health"]) {
        try {
          const probe = await probeClient.get<{ status?: string }>(path, {
            timeout: 2500,
          });
          if (probe.data?.status === "ok") {
            setStatus("online");
            if (base !== apiBase) {
              setApiBase(base);
              localStorage.setItem("nf_v5_api_base", base);
            }
            return;
          }
        } catch {
          // try next endpoint/base
        }
      }
    }
    setStatus("offline");
  }, [apiBase, candidateBases]);

  const runPreview = useCallback(
    async (text: string, forcedTheme?: Theme) => {
      const activeTheme = forcedTheme ?? theme;
      if (!text.trim()) {
        applyPreview("", [], { wordCount: 0, headingCount: 0, readingTimeMinutes: 0 });
        return;
      }
      if (!client || status !== "online") {
        previewLocal(text, activeTheme);
        return;
      }
      const payload: PreviewRequest = {
        content: text,
        theme: activeTheme,
        formattingOptions: {
          margins: activeTheme.margins,
          lineSpacing: activeTheme.bodyStyle.lineHeight ?? 1.4,
        },
        security: {
          removeMetadata,
          watermark: watermarkValue ? { type: watermarkType, value: watermarkValue, position: "center" } : undefined,
        },
      };
      setPreviewing(true);
      try {
        const res = await apiPreview(client, payload);
        applyPreview(res.previewHtml, res.warnings, res.structure);
      } catch {
        setStatus("offline");
        previewLocal(text, activeTheme);
      } finally {
        setPreviewing(false);
      }
    },
    [applyPreview, client, previewLocal, removeMetadata, status, theme, watermarkType, watermarkValue],
  );

  const applyTemplateSet = useCallback(
    async (list: Template[], fillContent: boolean) => {
      setTemplates(list);
      const remembered = localStorage.getItem("nf_v5_last_template");
      const selected = list.find((item) => item.id === remembered) ?? list[0];
      if (!selected) return;
      setTemplateId(selected.id);
      setPromptText(buildPrompt(topic, selected.name));
      if (fillContent && !content.trim()) {
        setTheme(selected.defaultTheme);
        setContent(selected.sampleContent);
        await runPreview(selected.sampleContent, selected.defaultTheme);
      }
    },
    [content, runPreview, topic],
  );

  useEffect(() => {
    void checkHealth();
    const timer = window.setInterval(() => void checkHealth(), 30000);
    return () => window.clearInterval(timer);
  }, [checkHealth]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("nf_v5_theme");
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme) as Theme);
      } catch {
        setTheme(PROFESSIONAL_THEME);
      }
    }
    const params = new URLSearchParams(window.location.search);
    const sampleParam = params.get("sample");
    if (sampleParam) setContent(decodeURIComponent(sampleParam));
  }, []);

  useEffect(() => {
    void runPreview(debouncedContent);
  }, [debouncedContent, runPreview]);

  useEffect(() => {
    if (!client || status !== "online") return;
    const loadTemplates = async () => {
      try {
        const list = await apiTemplates(client);
        if (list.length === 0) {
          await applyTemplateSet(LOCAL_TEMPLATES, true);
          notify("info", "Backend returned no templates. Using local templates.");
          return;
        }
        await applyTemplateSet(list, true);
      } catch {
        await applyTemplateSet(LOCAL_TEMPLATES, true);
        notify("info", "Failed to load templates from backend. Using local templates.");
      }
    };
    void loadTemplates();
  }, [applyTemplateSet, client, notify, status]);

  useEffect(() => {
    const tName = templates.find((item) => item.id === templateId)?.name ?? "Template";
    setPromptText(buildPrompt(topic, tName));
  }, [templateId, templates, topic]);

  useEffect(() => {
    localStorage.setItem("nf_v5_theme", JSON.stringify(theme));
  }, [theme]);

  const tryExample = async () => {
    setContent(SAMPLE_EXAMPLE);
    await runPreview(SAMPLE_EXAMPLE);
    notify("info", "Example loaded");
  };

  const onTemplateChange = async (id: string) => {
    setTemplateId(id);
    localStorage.setItem("nf_v5_last_template", id);
    const selected = templates.find((tpl) => tpl.id === id);
    if (!selected) return;
    setTheme(selected.defaultTheme);
    setContent(selected.sampleContent);
    await runPreview(selected.sampleContent, selected.defaultTheme);
    notify("info", `Template applied: ${selected.name}`);
  };

  const regenerateTemplate = async () => {
    if (!client || !templateId || !topic.trim()) return;
    setRegenerating(true);
    try {
      const res = await apiRegenerateTemplate(client, { templateId, topic, aiProvider: provider });
      setPromptText(res.prompt);
      setContent(res.content);
      await runPreview(res.content);
      notify("success", "Template regenerated");
    } catch {
      const template = templates.find((item) => item.id === templateId);
      const fallbackPrompt = buildPrompt(topic, template?.name ?? "Template");
      setPromptText(fallbackPrompt);
      if (template?.sampleContent) {
        const fallbackContent = template.sampleContent.replace(
          /Cybersecurity Incident Summary/g,
          `${topic} Summary`,
        );
        setContent(fallbackContent);
        await runPreview(fallbackContent, template.defaultTheme);
      }
      notify("info", "Template regeneration endpoint unavailable. Used local fallback.");
    } finally {
      setRegenerating(false);
    }
  };

  const saveTheme = async () => {
    if (!client) return;
    try {
      await apiCreateTheme(client, {
        name: theme.name,
        primaryColor: theme.primaryColor,
        fontFamily: theme.fontFamily,
        styles: theme.styles ?? {},
      });
      localStorage.setItem("nf_v5_theme", JSON.stringify(theme));
      notify("success", "Theme saved");
    } catch {
      notify("error", "Theme save failed");
    }
  };

  const generate = async () => {
    if (!client || !apiBase || !content.trim()) return;
    setGenerating(true);
    try {
      const payload: GenerateRequest = {
        content,
        theme,
        format,
        filename,
        security: {
          removeMetadata,
          disableEditingDocx,
          passwordProtectPdf: format === "pdf" ? passwordProtectPdf || undefined : undefined,
          watermark: watermarkValue ? { type: watermarkType, value: watermarkValue, position: "center" } : undefined,
        },
        templateId: templateId || undefined,
      };
      const res = await apiGenerate(client, payload);
      setDownloadUrl(`${apiBase}${res.downloadUrl}`);
      notify("success", "Document generated");
    } catch {
      notify("error", "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}?sample=${encodeURIComponent(content || SAMPLE_EXAMPLE)}`;
  const chatGptUrl = `https://chat.openai.com/?q=${encodeURIComponent(promptText)}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dbeafe_0%,#f8fafc_42%,#e2e8f0_100%)] pb-16 md:pb-0 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center shadow-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            NotesForge v5.0
          </div>
          <div className="text-sm flex items-center gap-2">
            {status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
            {status === "online" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {status === "offline" && <AlertCircle className="w-4 h-4 text-red-600" />}
            <span className="hidden md:inline">
              {status === "offline"
                ? "Backend offline or starting. Please wait 10–15 seconds"
                : `Backend ${status}`}
            </span>
            <button
              onClick={() => void checkHealth()}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white hover:bg-slate-50 transition"
            >
              <RefreshCw className="w-3 h-3 inline mr-1" />
              Retry
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="rounded-3xl border border-white/80 bg-white/80 backdrop-blur-xl px-4 py-3 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.55)] flex flex-wrap justify-between items-center gap-3">
          <div>
            <p className="text-sm font-semibold">Smart Backend Detection Active</p>
            <p className="text-xs text-slate-500">
              Active API: <span className="font-mono">{apiBase || "not detected yet"}</span>
            </p>
          </div>
          {!ENV_API_URL && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              VITE_API_URL not set. Auto-detect fallback in use.
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className={`${mobileTab === "edit" ? "block" : "hidden"} lg:block rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl p-4 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.5)]`}>
            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={() => void tryExample()} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-sm hover:bg-slate-800 transition">Try Example</button>
              <button onClick={() => void navigator.clipboard.writeText(notesforgeToMarkdown(content))} className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm hover:bg-slate-50 transition">Copy-as-Markdown</button>
              <button onClick={() => void navigator.clipboard.writeText(content)} className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm hover:bg-slate-50 transition">Copy-as-NotesForge</button>
              <a href={shareUrl} className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm hover:bg-slate-50 transition">Share Sample</a>
            </div>
            <label htmlFor="editor" className="block text-sm font-medium mb-1">Editor</label>
            <textarea
              id="editor"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[500px] font-mono text-sm p-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </section>

          <section className={`${mobileTab === "preview" ? "block" : "hidden"} lg:block rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl p-4 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.5)]`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-base">Live Preview</h2>
              {previewing && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
              <div className="p-2 border border-slate-200 rounded-xl bg-white"><div>Words</div><strong>{wordCount}</strong></div>
              <div className="p-2 border border-slate-200 rounded-xl bg-white"><div>Headings</div><strong>{headingCount}</strong></div>
              <div className="p-2 border border-slate-200 rounded-xl bg-white"><div>Read min</div><strong>{readingTime.toFixed(2)}</strong></div>
              <div className="p-2 border border-slate-200 rounded-xl bg-white"><div>Score</div><strong>{score}</strong></div>
            </div>
            <div className="h-[460px] overflow-auto border border-slate-200 rounded-2xl p-3 bg-slate-50/80">
              {previewHtml ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} /> : <p className="text-slate-500 text-sm">Preview will appear here.</p>}
            </div>
            {warnings.length > 0 && <p className="text-xs text-amber-700 mt-2">{warnings[0]}</p>}
          </section>
        </div>

        <section className={`${mobileTab === "settings" ? "block" : "hidden"} lg:block rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl p-4 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.5)]`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-2xl p-3 bg-white">
              <label className="text-sm font-medium block mb-1">Template</label>
              <select value={templateId} onChange={(e) => void onTemplateChange(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2 text-sm">
                <option value="">Select template</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="text-sm font-medium block mt-2 mb-1">Topic</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2 text-sm" />
              <label className="text-sm font-medium block mt-2 mb-1">AI Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)} className="w-full border border-slate-200 rounded-xl p-2 text-sm">
                <option value="chatgpt">chatgpt</option><option value="notebooklm">notebooklm</option><option value="claude">claude</option>
              </select>
              <button onClick={() => void regenerateTemplate()} className="w-full mt-2 bg-slate-900 text-white rounded-xl p-2 text-sm hover:bg-slate-800 transition">{regenerating ? "Regenerating..." : "Regenerate Template"}</button>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 bg-white">
              <label className="text-sm font-medium block mb-1">Theme Name</label>
              <input value={theme.name} onChange={(e) => setTheme((p) => ({ ...p, name: e.target.value }))} className="w-full border border-slate-200 rounded-xl p-2 text-sm" />
              <label className="text-sm font-medium block mt-2 mb-1">Primary Color</label>
              <input type="color" value={theme.primaryColor} onChange={(e) => setTheme((p) => ({ ...p, primaryColor: e.target.value }))} className="w-full h-10 border border-slate-200 rounded-xl" />
              <label className="text-sm font-medium block mt-2 mb-1">Font</label>
              <input value={theme.fontFamily} onChange={(e) => setTheme((p) => ({ ...p, fontFamily: e.target.value }))} className="w-full border border-slate-200 rounded-xl p-2 text-sm" />
              <button onClick={() => void saveTheme()} className="w-full mt-2 border border-slate-200 rounded-xl p-2 text-sm hover:bg-slate-50 transition">Save Theme</button>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 bg-white">
              <label className="text-sm font-medium block mb-1">AI Prompt Preview</label>
              <textarea readOnly value={promptText} className="w-full h-32 border border-slate-200 rounded-xl p-2 text-xs bg-slate-50" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => void navigator.clipboard.writeText(promptText)} className="flex-1 border border-slate-200 rounded-xl p-2 text-xs hover:bg-slate-50 transition"><Copy className="w-3 h-3 inline mr-1" />Copy Prompt</button>
                <a href={chatGptUrl} target="_blank" rel="noreferrer" className="flex-1 border border-slate-200 rounded-xl p-2 text-xs text-center hover:bg-slate-50 transition"><Send className="w-3 h-3 inline mr-1" />Open ChatGPT</a>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 bg-white">
              <label className="text-sm font-medium block mb-1">Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className="w-full border border-slate-200 rounded-xl p-2 text-sm">
                <option value="docx">DOCX</option><option value="pdf">PDF</option><option value="html">HTML</option><option value="md">MD</option><option value="txt">TXT</option>
              </select>
              <label className="text-sm font-medium block mt-2 mb-1">Filename</label>
              <input value={filename} onChange={(e) => setFilename(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2 text-sm" />
              <div className="mt-2 text-sm space-y-1">
                <label className="flex items-center gap-2"><input type="checkbox" checked={removeMetadata} onChange={(e) => setRemoveMetadata(e.target.checked)} />Remove metadata</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={disableEditingDocx} onChange={(e) => setDisableEditingDocx(e.target.checked)} />Disable docx editing</label>
              </div>
              {format === "pdf" && <input value={passwordProtectPdf} onChange={(e) => setPasswordProtectPdf(e.target.value)} placeholder="PDF password (optional)" className="w-full border border-slate-200 rounded-xl p-2 text-sm mt-2" />}
              <div className="grid grid-cols-2 gap-1 mt-2">
                <select value={watermarkType} onChange={(e) => setWatermarkType(e.target.value as WatermarkType)} className="border border-slate-200 rounded-xl p-2 text-sm"><option value="text">text</option><option value="image">image</option></select>
                <input value={watermarkValue} onChange={(e) => setWatermarkValue(e.target.value)} placeholder="Watermark value" className="border border-slate-200 rounded-xl p-2 text-sm" />
              </div>
              <button onClick={() => void generate()} className="w-full mt-2 bg-emerald-600 text-white rounded-xl p-2 text-sm hover:bg-emerald-700 transition">{generating ? "Generating..." : "Generate"}</button>
              {downloadUrl && <a href={downloadUrl} className="block mt-2 text-sm text-blue-700 underline"><Download className="w-3 h-3 inline mr-1" />Download file</a>}
            </div>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white/90 backdrop-blur border-t border-slate-300 p-2">
        <div className="grid grid-cols-3 gap-2">
          <button className={`rounded-xl p-2 text-sm ${mobileTab === "edit" ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setMobileTab("edit")}>Edit</button>
          <button
            className={`rounded-xl p-2 text-sm ${mobileTab === "preview" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            onClick={() => {
              setMobileTab("preview");
              void runPreview(content);
            }}
          >
            Preview
          </button>
          <button className={`rounded-xl p-2 text-sm ${mobileTab === "settings" ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setMobileTab("settings")}>Settings</button>
        </div>
      </nav>

      <div className="fixed right-3 top-20 space-y-2 z-40">
        {toasts.map((t) => (
          <div key={t.id} className={`text-sm px-3 py-2 rounded-xl border shadow-lg ${t.tone === "success" ? "bg-emerald-50 border-emerald-300" : t.tone === "error" ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-300"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
