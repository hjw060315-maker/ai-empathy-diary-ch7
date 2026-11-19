import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiErrorCode } from "@/shared/types";

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
