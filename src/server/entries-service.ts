// 일기 업무 로직. AI는 src/ai/index.ts의 함수만 부른다.
import { AiUnavailableError, analyzeDiary, detectCrisisByRules } from "@/ai";
import { MAX_ENTRIES_PER_DAY } from "@/shared/constants";
import type { AiAnalysis, ApiErrorCode, Entry, EntryListResponse } from "@/shared/types";
import * as repo from "./entries-repo";

export class ServiceError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

const notFound = () => new ServiceError("NOT_FOUND", "일기를 찾을 수 없어요.");

/** AI 호출. 사용 불가면 null(대기 처리). 그 밖의 예외도 일기 저장을 막지 않도록 null로 본다. */
async function tryAnalyze(content: string): Promise<AiAnalysis | null> {
  try {
    return await analyzeDiary(content);
  } catch (e) {
    if (!(e instanceof AiUnavailableError)) {
      // 일기 내용은 남기지 않고 오류 종류만 기록한다.
      console.error("AI 호출 중 예상 밖 오류:", e instanceof Error ? e.name : "unknown");
    }
    return null;
  }
}

export async function createEntry(userId: string, content: string): Promise<Entry> {
  if ((await repo.countToday(userId)) >= MAX_ENTRIES_PER_DAY) {
    throw new ServiceError("DAILY_LIMIT_EXCEEDED", `하루에 ${MAX_ENTRIES_PER_DAY}개까지 쓸 수 있어요.`);
  }
  const ruleCrisis = detectCrisisByRules(content);
  const analysis = await tryAnalyze(content);
  return repo.insertEntry({
    userId,
    content,
    isCrisis: ruleCrisis || Boolean(analysis?.isCrisis),
    analysis,
  });
}

export async function listEntries(
  userId: string,
  limit: number,
  cursor: string | undefined,
): Promise<EntryListResponse> {
  const after = cursor ? decodeCursor(cursor) : null;
  const { entries, next } = await repo.listOwnEntries(userId, limit, after);
  return { entries, nextCursor: next ? encodeCursor(next) : null };
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  if (!(await repo.deleteOwnEntry(userId, id))) throw notFound();
}

export async function retryEmpathy(userId: string, id: string): Promise<Entry> {
  const entry = await repo.findOwnEntry(userId, id);
  if (!entry) throw notFound();
  if (entry.empathyStatus === "done") {
    throw new ServiceError("ALREADY_COMPLETED", "이미 공감 메시지를 받은 일기예요.");
  }
  const ruleCrisis = detectCrisisByRules(entry.content);
  const analysis = await tryAnalyze(entry.content);
  if (!analysis) {
    if (ruleCrisis && !entry.isCrisis) {
      await repo.markCrisis(userId, id);
      return { ...entry, isCrisis: true };
    }
    return entry; // 여전히 pending
  }
  const updated = await repo.completeEntry(userId, id, analysis, ruleCrisis || analysis.isCrisis);
  if (!updated) {
    // 그 사이 다른 요청이 먼저 완료했거나 삭제됨
    const again = await repo.findOwnEntry(userId, id);
    if (!again) throw notFound();
    throw new ServiceError("ALREADY_COMPLETED", "이미 공감 메시지를 받은 일기예요.");
  }
  return updated;
}

// 커서: 화면이 해석하지 않는 불투명 문자열(base64url JSON).
function encodeCursor(p: repo.CursorPoint): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeCursor(cursor: string): repo.CursorPoint {
  const bad = () => new ServiceError("VALIDATION_ERROR", "올바르지 않은 목록 위치예요.");
  try {
    const p = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof p === "object" && p !== null &&
      typeof (p as repo.CursorPoint).ts === "string" && TS_RE.test((p as repo.CursorPoint).ts) &&
      typeof (p as repo.CursorPoint).id === "string" && UUID_RE.test((p as repo.CursorPoint).id)
    ) {
      return { ts: (p as repo.CursorPoint).ts, id: (p as repo.CursorPoint).id };
    }
  } catch {
    // 아래에서 처리
  }
  throw bad();
}
