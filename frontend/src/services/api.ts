import type {
  ApiResponse,
  PreviewRequest,
  PreviewResponse,
  GenerateRequest,
  GenerateResponse,
  SourceItem,
} from "../types";

import { API_BASE_URL } from "../config";

const BASE_URL = API_BASE_URL;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error || "API request failed");
  }

  return json.data as T;
}

export async function previewInvoice(
  data: PreviewRequest,
): Promise<PreviewResponse> {
  return request<PreviewResponse>("/api/invoices/preview", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generateInvoice(
  data: GenerateRequest,
): Promise<GenerateResponse> {
  return request<GenerateResponse>("/api/invoices/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMockSourceItems(): Promise<SourceItem[]> {
  return request<SourceItem[]>("/api/mock/source-items");
}
