import type { ApiErrorBody, Entry, EntryListResponse, EntryResponse } from "@/shared/types";
import { ApiClientError, type ApiClient } from "./types";

const NETWORK_MESSAGE =
  "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.";
const UNKNOWN_MESSAGE = "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", NETWORK_MESSAGE);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 본문이 비었거나 JSON이 아님
  }

  if (!res.ok) {
    const err = (body as Partial<ApiErrorBody> | null)?.error;
    throw new ApiClientError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? UNKNOWN_MESSAGE,
      res.status,
    );
  }
  if (body === null) throw new ApiClientError("INTERNAL_ERROR", UNKNOWN_MESSAGE, res.status);
  return body as T;
}

/** 실제 API(`/api/...`)를 부르는 클라이언트. 3단계에서 연결한다. */
export function createHttpClient(): ApiClient {
  return {
    async createEntry(content) {
      const data = await request<EntryResponse>("/api/entries", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      return data.entry;
    },
    async listEntries({ cursor, limit = 20 } = {}) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      return request<EntryListResponse>(`/api/entries?${params.toString()}`);
    },
    async deleteEntry(id) {
      await request<{ deleted: boolean }>(`/api/entries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    async requestEmpathy(id): Promise<Entry> {
      const data = await request<EntryResponse>(
        `/api/entries/${encodeURIComponent(id)}/empathy`,
        { method: "POST" },
      );
      return data.entry;
    },
  };
}
