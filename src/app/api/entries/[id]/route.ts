// 서버·DB 구역(backend-developer). 약속: docs/API.md
import { NextResponse } from "next/server";
import { entryIdSchema } from "@/shared/validation";
import { deleteEntry } from "@/server/entries-service";
import { errorResponse, withUser } from "@/server/http";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withUser(async (userId) => {
    const id = entryIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return errorResponse("VALIDATION_ERROR", "올바르지 않은 일기 번호예요.");
    await deleteEntry(userId, id.data);
    return NextResponse.json({ deleted: true });
  });
}
