import { describe, expect, it } from "vitest";
import { createApiClient, ApiClientError } from "@/ui/api-client";
import { createMockClient } from "@/ui/api-client/mock";
import { countContent, formatKoreanDateTime } from "@/ui/format";

const client = () => createMockClient({ delayMs: 0 });

describe("모의 API 클라이언트", () => {
  it("목록은 최신순 20개씩, 커서로 더 불러온다", async () => {
    const c = client();
    const first = await c.listEntries({ limit: 20 });
    expect(first.entries).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const times = first.entries.map((e) => e.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
    const second = await c.listEntries({ cursor: first.nextCursor });
    expect(second.entries.length).toBeGreaterThan(0);
    expect(second.nextCursor).toBeNull();
    const ids = new Set([...first.entries, ...second.entries].map((e) => e.id));
    expect(ids.size).toBe(first.entries.length + second.entries.length);
  });

  it("일기를 저장하면 done 상태로 목록 맨 위에 온다", async () => {
    const c = client();
    const entry = await c.createEntry("  오늘 발표를 무사히 마쳤다.  ");
    expect(entry.content).toBe("오늘 발표를 무사히 마쳤다.");
    expect(entry.empathyStatus).toBe("done");
    expect(entry.emotion).not.toBeNull();
    const list = await c.listEntries();
    expect(list.entries[0].id).toBe(entry.id);
  });

  it("빈 입력과 200자 초과는 거부한다", async () => {
    const c = client();
    await expect(c.createEntry("   ")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(c.createEntry("가".repeat(201))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("하루 20개를 넘기면 DAILY_LIMIT_EXCEEDED", async () => {
    const c = client();
    for (let i = 0; i < 20; i++) await c.createEntry(`일기 ${i}`);
    await expect(c.createEntry("하나 더")).rejects.toMatchObject({
      code: "DAILY_LIMIT_EXCEEDED",
    });
  });

  it("위기 표현은 isCrisis, [대기]는 pending, 다시 받기로 done이 된다", async () => {
    const c = client();
    const crisis = await c.createEntry("죽고 싶다는 생각이 들었다");
    expect(crisis.isCrisis).toBe(true);
    expect(crisis.empathyStatus).toBe("done");

    const pending = await c.createEntry("오늘 일기 [대기]");
    expect(pending.empathyStatus).toBe("pending");
    expect(pending.emotion).toBeNull();
    expect(pending.empathyMessage).toBeNull();

    const retried = await c.requestEmpathy(pending.id);
    expect(retried.empathyStatus).toBe("done");
    await expect(c.requestEmpathy(pending.id)).rejects.toMatchObject({
      code: "ALREADY_COMPLETED",
    });
  });

  it("[실패]가 들어 있으면 다시 받아도 pending", async () => {
    const c = client();
    const e = await c.createEntry("[대기] [실패]");
    const again = await c.requestEmpathy(e.id);
    expect(again.empathyStatus).toBe("pending");
  });

  it("삭제하면 목록에서 사라지고, 없는 id는 NOT_FOUND", async () => {
    const c = client();
    const e = await c.createEntry("지울 일기");
    await c.deleteEntry(e.id);
    const list = await c.listEntries();
    expect(list.entries.some((x) => x.id === e.id)).toBe(false);
    await expect(c.deleteEntry(e.id)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("기본 모드는 실제 API, mock이면 모의 클라이언트", () => {
    expect(createApiClient(undefined)).toBeDefined();
    expect(createApiClient(undefined)).not.toBe(createApiClient(undefined));
    expect(createApiClient("mock")).not.toBe(createApiClient("mock"));
  });
});

describe("표시용 보조 함수", () => {
  it("한국 시간으로 표시한다", () => {
    expect(formatKoreanDateTime("2026-11-19T09:30:00+09:00")).toBe("2026년 11월 19일 (목) 오전 9:30");
    expect(formatKoreanDateTime("2026-11-19T00:30:00Z")).toBe("2026년 11월 19일 (목) 오전 9:30");
    expect(formatKoreanDateTime("잘못된 값")).toBe("");
  });

  it("글자 수는 앞뒤 공백을 뺀다", () => {
    expect(countContent("  안녕  ")).toBe(2);
    expect(countContent("   ")).toBe(0);
  });
});
