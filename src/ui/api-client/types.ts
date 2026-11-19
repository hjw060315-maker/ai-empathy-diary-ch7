import type { ApiErrorCode, Entry, EntryListResponse } from "@/shared/types";

/** 화면이 서버(또는 모의 데이터)와 대화하는 방법. docs/API.md의 네 가지 호출과 1:1로 맞춘다. */
export interface ApiClient {
  /** POST /api/entries */
  createEntry(content: string): Promise<Entry>;
  /** GET /api/entries */
  listEntries(options?: { cursor?: string | null; limit?: number }): Promise<EntryListResponse>;
  /** DELETE /api/entries/{id} */
  deleteEntry(id: string): Promise<void>;
  /** POST /api/entries/{id}/empathy */
  requestEmpathy(id: string): Promise<Entry>;
}

export type ClientErrorCode = ApiErrorCode | "NETWORK_ERROR";

/** 화면에 그대로 보여 줘도 되는 한국어 message를 가진 오류 */
export class ApiClientError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;

  constructor(code: ClientErrorCode, message: string, status = 0) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}
