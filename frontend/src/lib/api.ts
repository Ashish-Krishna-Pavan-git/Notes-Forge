import axios, { AxiosInstance } from "axios";
import type {
  CreateThemeResponse,
  GenerateRequest,
  GenerateResponse,
  PreviewRequest,
  PreviewResponse,
  RegenerateTemplateResponse,
  Template,
} from "../types";

export function createApiClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 20000,
    headers: { "Content-Type": "application/json" },
  });
}

export async function apiHealth(client: AxiosInstance): Promise<boolean> {
  const res = await client.get<{ status: string }>("/api/health");
  return res.data.status === "ok";
}

export async function apiPreview(
  client: AxiosInstance,
  payload: PreviewRequest,
): Promise<PreviewResponse> {
  const res = await client.post<PreviewResponse>("/api/preview", payload);
  return res.data;
}

export async function apiGenerate(
  client: AxiosInstance,
  payload: GenerateRequest,
): Promise<GenerateResponse> {
  const res = await client.post<unknown>("/api/generate", payload);
  const data = res.data;
  if (
    data &&
    typeof data === "object" &&
    "downloadUrl" in data &&
    "fileId" in data
  ) {
    return data as GenerateResponse;
  }
  if (
    data &&
    typeof data === "object" &&
    "download_url" in data &&
    typeof (data as { download_url?: unknown }).download_url === "string"
  ) {
    const legacyUrl = (data as { download_url: string }).download_url;
    const tail = legacyUrl.split("/").pop() ?? `legacy_${Date.now()}`;
    const inferredId = tail.replace(/\.[^.]+$/, "");
    return { downloadUrl: legacyUrl, fileId: inferredId };
  }
  throw new Error("Generate endpoint returned unexpected payload");
}

export async function apiTemplates(client: AxiosInstance): Promise<Template[]> {
  const paths = ["/api/templates", "/templates"];
  for (const path of paths) {
    try {
      const res = await client.get<unknown>(path);
      const data = res.data;
      if (Array.isArray(data)) {
        return data as Template[];
      }
      if (
        data &&
        typeof data === "object" &&
        "templates" in data &&
        Array.isArray((data as { templates: unknown }).templates)
      ) {
        return (data as { templates: Template[] }).templates;
      }
    } catch {
      // try next path
    }
  }
  throw new Error("Templates endpoint unavailable");
}

export async function apiRegenerateTemplate(
  client: AxiosInstance,
  payload: { templateId: string; topic: string; aiProvider?: "chatgpt" | "notebooklm" | "claude" },
): Promise<RegenerateTemplateResponse> {
  const paths = ["/api/templates/regenerate", "/templates/regenerate"];
  for (const path of paths) {
    try {
      const res = await client.post<RegenerateTemplateResponse>(path, payload);
      return res.data;
    } catch {
      // try next path
    }
  }
  throw new Error("Template regeneration endpoint unavailable");
}

export async function apiCreateTheme(
  client: AxiosInstance,
  payload: { name: string; primaryColor: string; fontFamily: string; styles: Record<string, string> },
): Promise<CreateThemeResponse> {
  const res = await client.post<CreateThemeResponse>("/api/themes", payload);
  return res.data;
}
