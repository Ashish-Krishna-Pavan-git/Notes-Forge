import {
  ArrowRight,
  Download,
  FolderOpen,
  Laptop2,
  Music4,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { API_ENDPOINTS, apiGet, getErrorMessage } from "../services/api";

type DesktopPlatform = "windows" | "linux" | "desktop";

type ProcessingRecentFile = {
  name: string;
  format: "pdf" | "docx";
  sizeBytes: number;
  modifiedAt: number;
  directoryKey: string;
};

type ProcessingDirectory = {
  key: string;
  label: string;
  path: string;
  readable: boolean;
  autoDetected: boolean;
  recentFiles: ProcessingRecentFile[];
};

type ProcessingContextResponse = {
  runtimeTarget: string;
  platform: string;
  currentWorkingDirectory: string;
  downloadDirectory?: string | null;
  outputDirectory?: string | null;
  pdfStatusNote?: string;
  preferredPdfProvider?: string;
  directories: ProcessingDirectory[];
  notes: string[];
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function platformCopy(platform: DesktopPlatform) {
  if (platform === "windows") {
    return {
      title: "Windows desktop shell",
      subtitle: "Optimized for folder-heavy workflows, local converters, and one-click packaging.",
      accent: "from-sky-600 to-blue-700",
      pdfNote: "Windows prefers local PDF tooling first and keeps external providers as explicit fallback.",
    };
  }
  if (platform === "linux") {
    return {
      title: "Linux desktop shell",
      subtitle: "Tuned for distro-friendly packaging, runtime portability, and Qt-backed desktop delivery.",
      accent: "from-emerald-600 to-teal-700",
      pdfNote: "Linux requires local PDF conversion support first, then uses remote providers only when configured.",
    };
  }
  return {
    title: "Desktop shell",
    subtitle: "A dedicated desktop landing experience for NotesForge local workflows.",
    accent: "from-slate-700 to-slate-900",
    pdfNote: "Desktop builds prioritize local conversion and safe runtime directory discovery.",
  };
}

export default function DesktopHomePage({ platform }: { platform: DesktopPlatform }) {
  const [context, setContext] = useState<ProcessingContextResponse | null>(null);
  const [error, setError] = useState("");

  const copy = useMemo(() => platformCopy(platform), [platform]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const payload = await apiGet<ProcessingContextResponse>(API_ENDPOINTS.processingContext);
        if (active) setContext(payload);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const directoryCards = context?.directories.slice(0, 4) ?? [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_22%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f6_100%)] text-slate-900">
      <div className="mx-auto max-w-[1480px] px-4 py-5 lg:px-6">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[34px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className={`inline-flex items-center gap-3 rounded-full bg-gradient-to-r px-4 py-2 text-sm font-semibold text-white ${copy.accent}`}>
              <Laptop2 className="h-4 w-4" />
              {copy.title}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
              NotesForge desktop for {platform === "desktop" ? "local work" : platform}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{copy.subtitle}</p>

            <div className="mt-6 grid gap-3">
              <a href="/processing" className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 hover:border-slate-400">
                Open processing workspace
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/workspace" className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 hover:border-slate-400">
                Open document editor
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/" className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 hover:border-slate-400">
                Open product home
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/guide" className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 hover:border-slate-400">
                Read workflow guide
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                <ShieldCheck className="h-4 w-4" />
                PDF reliability
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-950/85">
                {context?.pdfStatusNote || copy.pdfNote}
              </p>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-emerald-800/80">
                preferred provider: {context?.preferredPdfProvider || "loading"}
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Music4 className="h-4 w-4" />
                Platform music bundle
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Desktop packages can carry their own `music/manifest.json` and tracks while the web app keeps its own shared music library.
              </p>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(15,23,42,0.97),_rgba(30,41,59,0.96))] p-6 text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    Desktop command center
                  </div>
                  <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                    Local files, output folders, and download paths stay visible.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    This desktop route is meant to feel closer to a polished product shell than a thin wrapper. Users can see where files are coming from, where outputs go, and which folders are safe to reuse.
                  </p>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                  {context?.platform ?? platform}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Working directory</div>
                  <div className="mt-2 break-all text-sm text-white/88">{context?.currentWorkingDirectory ?? "Loading..."}</div>
                </div>
                <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Output directory</div>
                  <div className="mt-2 break-all text-sm text-white/88">{context?.outputDirectory ?? "Loading..."}</div>
                </div>
                <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    <Download className="h-3.5 w-3.5" />
                    Downloads folder
                  </div>
                  <div className="mt-2 break-all text-sm text-white/88">{context?.downloadDirectory ?? "Unavailable"}</div>
                </div>
                <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    <Server className="h-3.5 w-3.5" />
                    Runtime target
                  </div>
                  <div className="mt-2 text-sm text-white/88">{context?.runtimeTarget ?? "Loading..."}</div>
                </div>
              </div>
            </section>

            {error ? (
              <div className="rounded-[26px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <Sparkles className="h-4 w-4" />
                  Fast paths
                </div>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  {(context?.notes ?? [
                    "Desktop runtimes can detect safe local folders.",
                    "Use the processing page for PDF and DOCX conversion.",
                    "Use the editor page for sticky-marker authoring and export.",
                  ]).map((note) => (
                    <div key={note} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                      {note}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <FolderOpen className="h-4 w-4" />
                  Recent folders
                </div>
                <div className="mt-4 space-y-3">
                  {directoryCards.length > 0 ? (
                    directoryCards.map((directory) => (
                      <div key={directory.key} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{directory.label}</div>
                          <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                            {directory.recentFiles.length}
                          </div>
                        </div>
                        <div className="mt-2 break-all text-xs leading-5 text-slate-500">{directory.path}</div>
                        <div className="mt-3 space-y-2">
                          {directory.recentFiles.slice(0, 3).map((file) => (
                            <div key={`${directory.key}:${file.name}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              <span className="truncate pr-3">{file.name}</span>
                              <span className="text-xs text-slate-500">{formatBytes(file.sizeBytes)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                      Runtime folder details will appear here once the backend context loads.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
