import {
  Clock3,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Loader2,
  Monitor,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";

import { API } from "../config/env";
import { API_ENDPOINTS, api, apiGet, getErrorMessage } from "../services/api";

type ProcessingFormat = "pdf" | "docx";
type ProviderPreference = "auto" | "local" | "smallpdf" | "ilovepdf";

type ProcessingRecentFile = {
  name: string;
  format: ProcessingFormat;
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
  serverFileDiscoveryEnabled: boolean;
  browserUploadEnabled: boolean;
  pdfConversionReady: boolean;
  docxConversionReady: boolean;
  editorPdfExportReady: boolean;
  preferredPdfProvider: string;
  pdfStatusNote: string;
  directories: ProcessingDirectory[];
  markerTemplateExample: string;
  notes: string[];
};

type ProcessingConversionResponse = {
  success: boolean;
  downloadUrl: string;
  fileId: string;
  filename: string;
  sourceFormat: ProcessingFormat;
  targetFormat: ProcessingFormat;
  actualFormat: ProcessingFormat;
  conversionEngine: string;
  providerUsed: string;
  externalFallbackUsed: boolean;
  warnings: string[];
};

type HistoryEntry = {
  id: string;
  filename: string;
  sourceFormat: ProcessingFormat | "mixed";
  targetFormat: ProcessingFormat;
  conversionEngine: string;
  providerUsed: string;
  createdAt: string;
  downloadUrl: string;
};

type BatchJobStatus = {
  success: boolean;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  filename?: string;
  downloadUrl?: string;
  warnings?: string[];
  error?: string;
};

const HISTORY_KEY = "notesforge-file-processing-history-v1";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function inferFormat(filename: string): ProcessingFormat | null {
  const lowered = filename.toLowerCase();
  if (lowered.endsWith(".pdf")) return "pdf";
  if (lowered.endsWith(".docx")) return "docx";
  return null;
}

function toAbsoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${API}${value.startsWith("/") ? value : `/${value}`}`;
}

export default function FileProcessingPage() {
  const [context, setContext] = useState<ProcessingContextResponse | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDetectedFile, setSelectedDetectedFile] = useState<ProcessingRecentFile | null>(null);
  const [targetFormat, setTargetFormat] = useState<ProcessingFormat>("docx");
  const [providerPreference, setProviderPreference] = useState<ProviderPreference>("auto");
  const [preserveLayout, setPreserveLayout] = useState(true);
  const [result, setResult] = useState<ProcessingConversionResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [working, setWorking] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchWorking, setBatchWorking] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchJob, setBatchJob] = useState<BatchJobStatus | null>(null);

  const sourceFormat = useMemo<ProcessingFormat | null>(() => {
    if (selectedFile) return inferFormat(selectedFile.name);
    if (selectedDetectedFile) return selectedDetectedFile.format;
    return null;
  }, [selectedDetectedFile, selectedFile]);

  const hostedRuntime = ["web", "render", "vercel", "serverless"].includes(
    context?.runtimeTarget ?? ""
  );

  useEffect(() => {
    let active = true;
    async function loadContext() {
      setLoadingContext(true);
      setContextError("");
      try {
        const payload = await apiGet<ProcessingContextResponse>(API_ENDPOINTS.processingContext);
        if (active) setContext(payload);
      } catch (err) {
        if (active) setContextError(getErrorMessage(err));
      } finally {
        if (active) setLoadingContext(false);
      }
    }
    loadContext();
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryEntry[];
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 8));
      }
    } catch {
      // Ignore malformed local history.
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (sourceFormat && sourceFormat === targetFormat) {
      setTargetFormat(sourceFormat === "pdf" ? "docx" : "pdf");
    }
  }, [sourceFormat, targetFormat]);

  useEffect(() => {
    if (!context?.pdfConversionReady && targetFormat === "pdf") {
      setTargetFormat("docx");
    }
  }, [context?.pdfConversionReady, targetFormat]);

  useEffect(() => {
    if (
      hostedRuntime === false &&
      (providerPreference === "smallpdf" || providerPreference === "ilovepdf")
    ) {
      setProviderPreference("local");
    }
  }, [hostedRuntime, providerPreference]);

  useEffect(() => {
    if (!selectedFile || inferFormat(selectedFile.name) !== "pdf") {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  function persistHistory(entries: HistoryEntry[]) {
    setHistory(entries);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 8)));
  }

  function selectFile(file: File | null) {
    if (!file) return;
    if (!inferFormat(file.name)) {
      setError("Use a .pdf or .docx file.");
      return;
    }
    setError("");
    setResult(null);
    setSelectedDetectedFile(null);
    setSelectedFile(file);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleConvert() {
    if (!selectedFile && !selectedDetectedFile) {
      setError("Choose a file first.");
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("target_format", targetFormat);
      formData.append("provider_preference", providerPreference);
      formData.append("preserve_layout", preserveLayout ? "true" : "false");
      if (selectedFile) {
        formData.append("file", selectedFile);
      } else if (selectedDetectedFile) {
        formData.append("detected_directory_key", selectedDetectedFile.directoryKey);
        formData.append("detected_filename", selectedDetectedFile.name);
      }
      const response = await api.post<ProcessingConversionResponse>(
        API_ENDPOINTS.processingConvert,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(response.data);
      persistHistory(
        [
          {
            id: response.data.fileId,
            filename: response.data.filename,
            sourceFormat: response.data.sourceFormat,
            targetFormat: response.data.targetFormat,
            conversionEngine: response.data.conversionEngine,
            providerUsed: response.data.providerUsed,
            createdAt: new Date().toISOString(),
            downloadUrl: toAbsoluteUrl(response.data.downloadUrl),
          },
          ...history,
        ].slice(0, 8)
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  function onBatchFilesInput(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []).filter((file) => inferFormat(file.name));
    setBatchError("");
    setBatchJob(null);
    setBatchFiles(nextFiles);
  }

  async function pollBatchJob(jobId: string): Promise<BatchJobStatus> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await apiGet<BatchJobStatus>(API_ENDPOINTS.processingBatchJob(jobId));
      setBatchJob(response);
      if (response.status === "completed" || response.status === "failed") {
        return response;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
    throw new Error("Batch processing timed out");
  }

  async function handleBatchConvert() {
    if (batchFiles.length === 0) {
      setBatchError("Choose at least one PDF or DOCX file for batch conversion.");
      return;
    }
    setBatchWorking(true);
    setBatchError("");
    setBatchJob(null);
    try {
      const formData = new FormData();
      formData.append("target_format", targetFormat);
      formData.append("provider_preference", providerPreference);
      formData.append("preserve_layout", preserveLayout ? "true" : "false");
      for (const file of batchFiles) {
        formData.append("files", file);
      }
      const launch = await api.post<BatchJobStatus>(API_ENDPOINTS.processingBatchConvert, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const finalJob = await pollBatchJob(launch.data.jobId);
      if (finalJob.status === "failed") {
        throw new Error(finalJob.error || "Batch processing failed");
      }
      if (finalJob.downloadUrl && finalJob.filename) {
        persistHistory(
          [
            {
              id: finalJob.jobId,
              filename: finalJob.filename,
              sourceFormat: "mixed",
              targetFormat,
              conversionEngine: "batch_processing",
              providerUsed: providerPreference,
              createdAt: new Date().toISOString(),
              downloadUrl: toAbsoluteUrl(finalJob.downloadUrl),
            },
            ...history,
          ].slice(0, 8)
        );
      }
    } catch (err) {
      setBatchError(getErrorMessage(err));
    } finally {
      setBatchWorking(false);
    }
  }

  const resultUrl = result ? toAbsoluteUrl(result.downloadUrl) : "";
  const detectedTotal =
    context?.directories.reduce((sum, directory) => sum + directory.recentFiles.length, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(13,148,136,0.16),_transparent_34%),linear-gradient(180deg,_#f8fbff_0%,_#eef5f4_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col gap-6 px-4 py-5 lg:flex-row lg:px-6">
        <aside className="w-full shrink-0 rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:sticky lg:top-5 lg:w-[320px] lg:self-start">
          <div className="inline-flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            <FileArchive className="h-4 w-4" />
            NotesForge Processing
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            PDF and DOCX conversion without fixed paths
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Upload from anywhere, or reuse auto-detected files when the runtime can safely scan local folders.
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">1. Pick a source.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">2. Choose the target format.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">3. Convert, preview, and download.</div>
          </div>
              <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <ShieldCheck className="h-4 w-4" />
              Secure by default
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-950/80">
              {hostedRuntime
                ? "Use upload-based selection on hosted web deployments and keep provider credentials on the backend or a secure proxy."
                : "This runtime is offline-first, so local files and local converters are the primary path."}
            </p>
          </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href="/workspace" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:border-slate-900">
              Workspace
            </a>
            <a href="/" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:border-slate-900">
              Home
            </a>
            <a href="/guide" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:border-slate-900">
              Guide
            </a>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Source Selection</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Upload or drag a file</h2>
                </div>
                <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                  <div className="flex items-center gap-2 font-semibold">
                    <Monitor className="h-4 w-4" />
                    Runtime
                  </div>
                  <div className="mt-1 text-white/70">
                    {loadingContext ? "Loading..." : `${context?.platform ?? "unknown"} · ${context?.runtimeTarget ?? "unknown"}`}
                  </div>
                </div>
              </div>

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) setDragActive(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                className={`mt-5 rounded-[28px] border-2 border-dashed px-6 py-10 text-center ${
                  dragActive ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50/80"
                }`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-slate-950">Drag a PDF or DOCX here</h3>
                <p className="mt-2 text-sm text-slate-600">Manual selection works across web, Windows, and Linux.</p>
                <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                  <FolderOpen className="h-4 w-4" />
                  Choose file
                  <input type="file" accept=".pdf,.docx" className="hidden" onChange={onFileInput} />
                </label>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedFile?.name ?? selectedDetectedFile?.name ?? "No source selected"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {selectedFile
                        ? `Browser-selected file · ${formatBytes(selectedFile.size)}`
                        : selectedDetectedFile
                          ? `Detected runtime file · ${selectedDetectedFile.format}`
                          : "Choose a PDF or DOCX input."}
                    </div>
                  </div>
                  {sourceFormat ? (
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {sourceFormat}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Engine Controls</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Conversion policy</h2>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Target format</span>
                  <select
                    value={targetFormat}
                    onChange={(event) => setTargetFormat(event.target.value as ProcessingFormat)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value="docx">DOCX</option>
                    {context?.pdfConversionReady ? <option value="pdf">PDF</option> : null}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Provider preference</span>
                  <select
                    value={providerPreference}
                    onChange={(event) => setProviderPreference(event.target.value as ProviderPreference)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="local">Local tools first</option>
                    {hostedRuntime ? <option value="smallpdf">Smallpdf first</option> : null}
                    {hostedRuntime ? <option value="ilovepdf">iLovePDF first</option> : null}
                  </select>
                </label>
                <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={preserveLayout}
                    onChange={(event) => setPreserveLayout(event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">Preserve layout and spacing where provider support allows it.</span>
                </label>
              </div>
              <button
                type="button"
                onClick={handleConvert}
                disabled={working}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {working ? "Converting..." : "Start conversion"}
              </button>
              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">PDF availability</div>
                <div className="mt-2">{context?.pdfStatusNote ?? "Loading PDF capability state..."}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  preferred provider: {context?.preferredPdfProvider ?? "loading"}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Runtime Files</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Auto-detected common folders
                  </h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {detectedTotal} files
                </div>
              </div>

              {loadingContext ? (
                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading runtime context...
                </div>
              ) : contextError ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {contextError}
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Downloads</div>
                      <div className="mt-2 break-all text-sm text-slate-900">
                        {context?.downloadDirectory ?? "Browser-managed"}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Output path</div>
                      <div className="mt-2 break-all text-sm text-slate-900">
                        {context?.outputDirectory ?? "Runtime temp"}
                      </div>
                    </div>
                  </div>
                  {context?.directories.map((directory) => (
                    <div key={directory.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{directory.label}</div>
                          <div className="mt-1 break-all text-xs leading-5 text-slate-500">{directory.path}</div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            directory.readable
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {directory.readable ? "Ready" : "Unavailable"}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {directory.recentFiles.length > 0 ? (
                          directory.recentFiles.map((entry) => {
                            const active =
                              selectedDetectedFile?.directoryKey === entry.directoryKey &&
                              selectedDetectedFile.name === entry.name;
                            return (
                              <button
                                type="button"
                                key={`${entry.directoryKey}:${entry.name}`}
                                onClick={() => {
                                  setError("");
                                  setResult(null);
                                  setSelectedFile(null);
                                  setSelectedDetectedFile(entry);
                                }}
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                                  active
                                    ? "border-sky-500 bg-sky-50"
                                    : "border-slate-200 bg-white hover:border-slate-400"
                                }`}
                              >
                                <span>
                                  <span className="block text-sm font-medium text-slate-900">{entry.name}</span>
                                  <span className="mt-1 block text-xs text-slate-500">
                                    {formatBytes(entry.sizeBytes)} · {new Date(entry.modifiedAt * 1000).toLocaleString()}
                                  </span>
                                </span>
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                                  {entry.format}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                            No recent PDF or DOCX files detected here.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Result</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Preview, warnings, and download
                </h2>

                {result ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Output</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{result.filename}</div>
                        <div className="mt-2 text-sm text-slate-600">
                          {result.sourceFormat} to {result.targetFormat} via {result.conversionEngine}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provider</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{result.providerUsed}</div>
                        <div className="mt-2 text-sm text-slate-600">
                          {result.externalFallbackUsed ? "External provider used" : "Local runtime processing"}
                        </div>
                      </div>
                    </div>

                    <a
                      href={resultUrl}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4" />
                      Download output
                    </a>

                    {result.warnings.length > 0 ? (
                      <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                        <div className="font-semibold">Warnings</div>
                        <div className="mt-2 space-y-2">
                          {result.warnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {result.actualFormat === "pdf" ? (
                      <iframe src={resultUrl} title="Converted PDF preview" className="h-[460px] w-full rounded-[24px] border border-slate-200 bg-white" />
                    ) : previewUrl ? (
                      <iframe src={previewUrl} title="Selected PDF preview" className="h-[460px] w-full rounded-[24px] border border-slate-200 bg-white" />
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                        Select a PDF to preview it here before converting, or convert any input to PDF for output preview.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                    Results appear here after a conversion completes.
                  </div>
                )}
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Batch Processing</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Multi-file conversion to ZIP
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Upload multiple files to create a single ZIP package with converted outputs and a machine-readable batch report.
                </p>

                <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-900">
                  <FolderOpen className="h-4 w-4" />
                  Choose multiple files
                  <input type="file" accept=".pdf,.docx" multiple className="hidden" onChange={onBatchFilesInput} />
                </label>

                <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {batchFiles.length > 0 ? `${batchFiles.length} files ready` : "No batch files selected"}
                  </div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600">
                    {batchFiles.slice(0, 5).map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3">
                        <span className="truncate">{file.name}</span>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    ))}
                    {batchFiles.length > 5 ? <div>+ {batchFiles.length - 5} more files</div> : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBatchConvert}
                  disabled={batchWorking}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {batchWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {batchWorking ? "Processing batch..." : "Create ZIP package"}
                </button>

                {batchError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {batchError}
                  </div>
                ) : null}

                {batchJob ? (
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">Job {batchJob.status}</div>
                      <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        {batchJob.progress}%
                      </div>
                    </div>
                    {batchJob.downloadUrl ? (
                      <a
                        href={toAbsoluteUrl(batchJob.downloadUrl)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <Download className="h-4 w-4" />
                        Download batch ZIP
                      </a>
                    ) : null}
                    {batchJob.warnings && batchJob.warnings.length > 0 ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        {batchJob.warnings.slice(0, 3).map((warning) => (
                          <div key={warning}>{warning}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">Recent conversions</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {history.length > 0 ? (
                      history.map((item) => (
                        <a
                          key={`${item.id}-${item.createdAt}`}
                          href={item.downloadUrl}
                          className="block rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 hover:border-slate-400"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{item.filename}</div>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                              {item.targetFormat}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {item.sourceFormat} to {item.targetFormat} via {item.conversionEngine}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </a>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                        Conversion history is stored locally in this browser.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">Marker template bridge</h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    After conversion, you can continue shaping content with NotesForge&apos;s marker-based document engine.
                  </p>
                  <pre className="mt-4 overflow-x-auto rounded-[22px] bg-slate-950 px-4 py-4 text-sm leading-6 text-slate-100">
                    {context?.markerTemplateExample ?? "Loading template example..."}
                  </pre>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    {(context?.notes ?? []).map((note) => (
                      <div key={note}>{note}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
