import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/shared/types";

/** 1단계 뼈대용. 2단계에서 각 라우트를 실제 구현으로 바꾸면 이 파일은 지운다. */
export function notImplemented() {
  const body: ApiErrorBody = {
    error: { code: "INTERNAL_ERROR", message: "아직 구현되지 않았어요." },
  };
  return NextResponse.json(body, { status: 501 });
}
