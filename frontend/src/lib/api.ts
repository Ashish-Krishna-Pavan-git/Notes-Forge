import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { API, API_TIMEOUT_MS } from "./config";

export const API_ENDPOINTS = {
  healthLegacy: `${API}/health`,
  health: `${API}/api/health`,
  parserHealth: `${API}/api/health/parser`,
  version: `${API}/api/version`,
  analyze: `${API}/api/analyze`,
  preview: `${API}/api/preview`,
  generate: `${API}/api/generate`,
  download: (token: string) => `${API}/api/download/${token}`,
  config: `${API}/api/config`,
  configUpdate: `${API}/api/config/update`,
  themes: `${API}/api/themes`,
  themesApply: `${API}/api/themes/apply`,
  themesSave: `${API}/api/themes/save`,
  themesDelete: `${API}/api/themes/delete`,
  templates: `${API}/api/templates`,
  templatesRegenerate: `${API}/api/templates/regenerate`,
  prompt: `${API}/api/prompt`,
};

export const api = axios.create({
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  (config as any).__startedAt = Date.now();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const started = ((error.config as any)?.__startedAt || 0) as number;
    const duration = started ? Date.now() - started : null;
    if (duration !== null) {
      // Keep lightweight telemetry in console for production debugging.
      console.warn(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} failed in ${duration}ms`
      );
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  const axErr = error as AxiosError<{ detail?: string; message?: string }>;
  if (axErr?.response?.data?.detail) return axErr.response.data.detail;
  if (axErr?.response?.data?.message) return axErr.response.data.message;
  if (axErr?.message === "Network Error") {
    return "Network error. Backend may be sleeping or unreachable.";
  }
  return axErr?.message || "Request failed";
}

type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 3000;

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      const jitter = Math.floor(Math.random() * 120);
      const delay = Math.min(baseDelayMs * 2 ** i + jitter, maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastError;
}

export async function apiGet<T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.get<T>(url, config);
  return res.data;
}

export async function apiPost<T = any>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.post<T>(url, data, config);
  return res.data;
}
