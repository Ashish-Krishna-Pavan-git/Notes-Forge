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
  const res = await client.post<GenerateResponse>("/api/generate", payload);
  return res.data;
}

export async function apiTemplates(client: AxiosInstance): Promise<Template[]> {
  const res = await client.get<Template[]>("/api/templates");
  return res.data;
}

export async function apiRegenerateTemplate(
  client: AxiosInstance,
  payload: { templateId: string; topic: string; aiProvider?: "chatgpt" | "notebooklm" | "claude" },
): Promise<RegenerateTemplateResponse> {
  const res = await client.post<RegenerateTemplateResponse>("/api/templates/regenerate", payload);
  return res.data;
}

export async function apiCreateTheme(
  client: AxiosInstance,
  payload: { name: string; primaryColor: string; fontFamily: string; styles: Record<string, string> },
): Promise<CreateThemeResponse> {
  const res = await client.post<CreateThemeResponse>("/api/themes", payload);
  return res.data;
}
