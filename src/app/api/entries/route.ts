// 서버·DB 구역(backend-developer). 약속: docs/API.md
import { NextResponse, type NextRequest } from "next/server";
import { createEntrySchema, listQuerySchema } from "@/shared/validation";
import type { EntryListResponse, EntryResponse } from "@/shared/types";
import { createEntry, listEntries } from "@/server/entries-service";
import { errorResponse, withUser } from "@/server/http";

export async function GET(request: NextRequest) {
  return withUser(async (userId) => {
    const sp = request.nextUrl.searchParams;
    const parsed = listQuerySchema.safeParse({
      limit: sp.get("limit") ?? undefined,
      cursor: sp.get("cursor") ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "올바르지 않은 목록 요청이에요.");
    }
    const body: EntryListResponse = await listEntries(userId, parsed.data.limit, parsed.data.cursor);
    return NextResponse.json(body);
  });
}

export async function POST(request: NextRequest) {
  return withUser(async (userId) => {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "일기 내용을 입력해 주세요.");
    }
    const parsed = createEntrySchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "일기 내용을 확인해 주세요.");
    }
    const entry = await createEntry(userId, parsed.data.content);
    const body: EntryResponse = { entry };
    return NextResponse.json(body, { status: 201 });
  });
}
