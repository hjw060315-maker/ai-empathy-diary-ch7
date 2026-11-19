import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiErrorCode } from "@/shared/types";
import { getCurrentUserId } from "./auth";
import { ServiceError } from "./entries-service";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
  DAILY_LIMIT_EXCEEDED: 429,
  NOT_FOUND: 404,
  ALREADY_COMPLETED: 409,
  INTERNAL_ERROR: 500,
};

export function errorResponse(code: ApiErrorCode, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return NextResponse.json(body, { status: STATUS[code] });
}

/**
 * 라우트 공통 틀: 로그인 확인 → 처리 → 오류를 약속된 형태로 변환.
 * 예상 밖 오류는 내용을 숨기고 500으로 답한다(키·연결 정보 노출 방지).
 */
export async function withUser(
  handler: (userId: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");
    return await handler(userId);
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.code, e.message);
    console.error("API 처리 중 오류:", e instanceof Error ? e.name : "unknown");
    return errorResponse("INTERNAL_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}
