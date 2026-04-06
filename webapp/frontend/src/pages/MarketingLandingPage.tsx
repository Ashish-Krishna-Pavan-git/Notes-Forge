import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Download,
  FileArchive,
  FolderSearch,
  Globe2,
  Layers3,
  LayoutPanelTop,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";

import { API_ENDPOINTS, apiGet, getErrorMessage } from "../services/api";

type ProcessingContextResponse = {
  runtimeTarget: string;
  pdfConversionReady: boolean;
  docxConversionReady: boolean;
  editorPdfExportReady: boolean;
  preferredPdfProvider: string;
  pdfStatusNote: string;
  outputDirectory?: string | null;
  downloadDirectory?: string | null;
};

const platformCards = [
  {
    title: "Webapp",
    body: "Hosted or local browser workflow from `webapp/` with React, FastAPI, and deploy-ready routes.",
    icon: Globe2,
  },
  {
    title: "Windows",
    body: "Desktop shell that surfaces working directory, Downloads, output path, and Windows packaging.",
    icon: MonitorPlay,
  },
  {
    title: "Linux",
    body: "Desktop shell tuned first for Debian, Ubuntu, Kali, and Parrot packaging flows.",
    icon: Layers3,
  },
  {
    title: "Docker Setup",
    body: "Local container stack for browser-based NotesForge runs without mixing Docker files into the product shell.",
    icon: Workflow,
  },
];

const polishCards = [
  {
    title: "Premium navigation",
    body: "Sidebar-first workflows, context panels, and less header crowding create a calmer entry point.",
    icon: Layers3,
  },
  {
    title: "Path-independent runtime",
    body: "Desktop can scan safe folders, while web keeps browser pickers and drag-drop as the correct cross-platform equivalent.",
    icon: FolderSearch,
  },
  {
    title: "Capability-based PDF",
    body: "If high-fidelity PDF support is not ready, NotesForge hides the option instead of leaving a broken promise.",
    icon: ShieldCheck,
  },
];

const workflowCards = [
  ["Discover", "Detect safe folders, uploads, and runtime context.", Workflow],
  ["Process", "Choose DOCX or PDF only when the runtime can truly support it.", FileArchive],
  ["Deliver", "Preview, download, and continue editing with sticky markers.", Download],
] as const;

export default function MarketingLandingPage() {
  const [context, setContext] = useState<ProcessingContextResponse | null>(null);
  const [error, setError] = useState("");

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

  const pdfReady = context?.editorPdfExportReady ?? false;

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_26%),radial-gradient(circle_at_86%_16%,_rgba(14,165,233,0.14),_transparent_18%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#fbfdff_0%,_#f5f8fd_42%,_#eef4f1_100%)] text-slate-950">
      <div className="mx-auto max-w-[1560px] px-4 py-5 lg:px-6">
        <header className="rounded-[34px] border border-white/85 bg-white/82 px-5 py-4 shadow-[0_28px_100px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-950 text-white shadow-lg shadow-slate-950/25">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  NotesForge Suite
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Premium documentation workflows for web, Windows, Linux, and Docker
                </h1>
              </div>
            </div>

            <nav className="flex flex-wrap gap-3 text-sm">
              <a href="/workspace" className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 transition hover:border-slate-950">
                Workspace
              </a>
              <a href="/processing" className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 transition hover:border-slate-950">
                Processing
              </a>
              <a href="/guide" className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 transition hover:border-slate-950">
                Docs
              </a>
            </nav>
          </div>
        </header>

        <main className="mt-6">
          <section className="grid gap-6 xl:grid-cols-[1.03fr_0.97fr]">
            <div className="rounded-[42px] border border-white/85 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(240,247,255,0.94))] p-6 shadow-[0_30px_120px_rgba(15,23,42,0.08)] backdrop-blur-2xl lg:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                <BadgeCheck className="h-4 w-4" />
                Digital-product quality shell
              </div>

              <h2 className="mt-6 max-w-[780px] text-5xl font-semibold tracking-[-0.05em] text-slate-950 lg:text-7xl">
                NotesForge makes technical documentation feel closer to a modern product platform than a utility screen.
              </h2>

              <p className="mt-5 max-w-[740px] text-base leading-8 text-slate-600 lg:text-lg">
                Product storytelling, sticky-marker authoring, and PDF or DOCX processing now live in distinct surfaces.
                That separation gives the app a calmer Apple-style feel while keeping the workflow clarity power users expect.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/workspace" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800">
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href="/processing" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                  Open file processing
                  <FileArchive className="h-4 w-4" />
                </a>
                <a href="/guide" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                  Read product guide
                  <LayoutPanelTop className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {polishCards.map((item) => (
                  <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <item.icon className="h-5 w-5 text-slate-700" />
                    <div className="mt-4 text-lg font-semibold text-slate-950">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[38px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(15,23,42,0.97),_rgba(30,41,59,0.96))] p-6 text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                      Live product snapshot
                    </div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight">
                      {pdfReady ? "PDF is ready" : "PDF is hidden until fidelity is ready"}
                    </div>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                    {context?.runtimeTarget ?? "loading"}
                  </div>
                </div>

                <p className="mt-4 max-w-[560px] text-sm leading-7 text-white/72">
                  {context?.pdfStatusNote || "Checking runtime capabilities and export readiness..."}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Preferred provider</div>
                    <div className="mt-2 text-lg font-semibold text-white">{context?.preferredPdfProvider || "loading"}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Output path</div>
                    <div className="mt-2 break-all text-sm text-white/88">{context?.outputDirectory || "Loading..."}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Downloads path</div>
                    <div className="mt-2 break-all text-sm text-white/88">{context?.downloadDirectory || "Browser-managed"}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Export stance</div>
                    <div className="mt-2 text-sm text-white/88">
                      {pdfReady ? "Keep PDF visible." : "Hide PDF until it is trustworthy."}
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-5 rounded-[22px] border border-rose-400/40 bg-rose-500/12 px-4 py-4 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {workflowCards.map(([title, body, Icon]) => (
                  <div key={title} className="rounded-[30px] border border-white/85 bg-white/88 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <Icon className="h-5 w-5 text-slate-700" />
                    <div className="mt-4 text-lg font-semibold text-slate-950">{title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-4">
            {platformCards.map((item) => (
              <div key={item.title} className="rounded-[30px] border border-white/85 bg-white/88 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <item.icon className="h-5 w-5 text-slate-700" />
                <div className="mt-4 text-xl font-semibold text-slate-950">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[38px] border border-white/85 bg-white/90 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                <BadgeCheck className="h-4 w-4" />
                Sticky marker contract
              </div>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                One marker starts a block. The next marker ends it.
              </h3>
              <p className="mt-3 max-w-[760px] text-sm leading-7 text-slate-600">
                That sticky grammar keeps authoring simple while still supporting multiline headings, paragraph continuity, tabs, and code indentation.
              </p>
              <pre className="mt-5 overflow-x-auto rounded-[28px] bg-slate-950 px-5 py-5 text-sm leading-7 text-slate-100 shadow-inner">
{`H1: Product launch review
This heading stays active until the next marker.

H2: Summary
This subheading also continues until another marker appears.

PARA: The launch performed well in Windows, Linux, and webapp.
Continue the same paragraph here without repeating PARA.

CODE:
\tpdf2docx --input summary.pdf --output summary.docx
\tlibreoffice --headless --convert-to pdf summary.docx`}
              </pre>
            </div>

            <div className="rounded-[38px] border border-white/85 bg-white/90 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:p-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                <LayoutPanelTop className="h-4 w-4" />
                Product UX direction
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  "The homepage now acts like a product site first, not a dump of every control at once.",
                  "Processing has its own conversion-first experience instead of sharing a crowded utility header.",
                  "Desktop pages show working, output, and download paths so users know where files go.",
                  "Documentation is separated into root, webapp, windows, linux, and docker setup runbooks.",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/workspace" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800">
                  Start writing
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href="/processing" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                  Start converting
                  <FileArchive className="h-4 w-4" />
                </a>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Structured authoring",
                body: "Sticky markers keep H1, PARA, CODE, TABLE, and CAPTION predictable across exports.",
                icon: Blocks,
              },
              {
                title: "Platform clarity",
                body: "Windows and Linux desktop shells have dedicated entry routes instead of pretending one generic layout fits every runtime.",
                icon: Layers3,
              },
              {
                title: "Safer operations",
                body: "Capability-aware PDF controls, path-safe file access, and provider-backed decisions reduce broken promises in the UI.",
                icon: ShieldCheck,
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <item.icon className="h-5 w-5 text-slate-700" />
                <div className="mt-4 text-xl font-semibold text-slate-950">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
