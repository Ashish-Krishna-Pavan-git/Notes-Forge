const EXPLICIT_API_URL = (import.meta.env.VITE_API_URL ?? "")
  .toString()
  .trim();

function resolveDefaultApiUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0"
    ) {
      return `http://${host}:10000`;
    }
  }
  return "https://notes-forge.onrender.com";
}

export const API = (EXPLICIT_API_URL || resolveDefaultApiUrl())
  .replace(/\/+$/, "");

export const API_BASE = API;

export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 20000);

export const API_HEALTH_TIMEOUT_MS = Number(import.meta.env.VITE_API_HEALTH_TIMEOUT_MS ?? 3500);

export const HAS_EXPLICIT_API_URL = Boolean(EXPLICIT_API_URL);
