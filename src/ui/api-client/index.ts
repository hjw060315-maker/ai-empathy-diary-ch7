import { createHttpClient } from "./http";
import { createMockClient } from "./mock";
import type { ApiClient } from "./types";

export * from "./types";

/**
 * 데이터 접근은 모두 여기를 거친다.
 * 2단계: 기본값은 모의 데이터. 3단계에서 NEXT_PUBLIC_API_MODE를 "real"로 하거나 기본값을 바꿔 실제 API로 연결한다.
 */
export function createApiClient(mode: string | undefined): ApiClient {
  return mode === "real" ? createHttpClient() : createMockClient();
}

export const apiClient: ApiClient = createApiClient(process.env.NEXT_PUBLIC_API_MODE);
