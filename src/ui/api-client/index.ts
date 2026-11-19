import { createHttpClient } from "./http";
import { createMockClient } from "./mock";
import type { ApiClient } from "./types";

export * from "./types";

/**
 * 데이터 접근은 모두 여기를 거친다.
 * 기본값은 실제 `/api` 호출. 시험이나 화면 연습용으로만 mode를 "mock"으로 준다
 * (NEXT_PUBLIC_API_MODE=mock).
 */
export function createApiClient(mode: string | undefined): ApiClient {
  return mode === "mock" ? createMockClient() : createHttpClient();
}

export const apiClient: ApiClient = createApiClient(process.env.NEXT_PUBLIC_API_MODE);
