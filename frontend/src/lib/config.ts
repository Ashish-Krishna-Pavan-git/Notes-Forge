export const API = (import.meta.env.VITE_API_URL ?? "https://notes-forge.onrender.com")
  .toString()
  .trim()
  .replace(/\/+$/, "");

export const API_BASE = API;

export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 20000);

export const API_HEALTH_TIMEOUT_MS = Number(import.meta.env.VITE_API_HEALTH_TIMEOUT_MS ?? 3500);

export const HAS_EXPLICIT_API_URL = Boolean(import.meta.env.VITE_API_URL);
