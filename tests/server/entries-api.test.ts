// DB와 AI를 모의로 바꿔 API 라우트를 시험한다. 실제 DB·네트워크에는 접근하지 않는다.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  user_id: string;
  content: string;
  emotion: string | null;
  intensity: number | null;
  empathy_message: string | null;
  empathy_status: "done" | "pending";
  is_crisis: boolean;
  created_at: Date;
}

const h = vi.hoisted(() => ({
  rows: [] as Row[],
  sqls: [] as string[],
  seq: 0,
  user: "user-a" as string | null,
  analyze: vi.fn(),
  rules: vi.fn(),
  AiErr: class extends Error {},
}));
const FakeAiUnavailableError = h.AiErr;

vi.mock("@/ai", () => ({
  AiUnavailableError: h.AiErr,
  analyzeDiary: h.analyze,
  detectCrisisByRules: h.rules,
}));
vi.mock("@/server/auth", () => ({ getCurrentUserId: async () => h.user }));

const ts = (r: Row) => r.created_at.toISOString().replace("Z", "000Z");
const out = (r: Row) => ({ ...r, cursor_ts: ts(r) });

vi.mock("@/server/db", () => ({
  getPool: () => ({
    query: async (sql: string, p: unknown[] = []) => {
      h.sqls.push(sql);
      const s = sql.replace(/\s+/g, " ");
      if (s.includes("count(*)")) {
        return { rows: [{ n: h.rows.filter((r) => r.user_id === p[0]).length }] };
      }
      if (s.startsWith("insert")) {
        const row: Row = {
          id: `00000000-0000-4000-8000-${String(++h.seq).padStart(12, "0")}`,
          user_id: p[0] as string,
          content: p[1] as string,
          emotion: p[2] as string | null,
          intensity: p[3] as number | null,
          empathy_message: p[4] as string | null,
          empathy_status: p[5] as "done" | "pending",
          is_crisis: p[6] as boolean,
          created_at: new Date(Date.UTC(2026, 10, 19, 0, 30, h.seq)),
        };
        h.rows.push(row);
        return { rows: [out(row)] };
      }
      if (s.startsWith("delete")) {
        const i = h.rows.findIndex((r) => r.id === p[0] && r.user_id === p[1]);
        if (i >= 0) h.rows.splice(i, 1);
        return { rows: [], rowCount: i >= 0 ? 1 : 0 };
      }
      if (s.startsWith("update") && s.includes("empathy_status = 'done'")) {
        const r = h.rows.find((x) => x.id === p[0] && x.user_id === p[1] && x.empathy_status === "pending");
        if (!r) return { rows: [] };
        Object.assign(r, {
          emotion: p[2], intensity: p[3], empathy_message: p[4],
          empathy_status: "done", is_crisis: r.is_crisis || (p[5] as boolean),
        });
        return { rows: [out(r)] };
      }
      if (s.startsWith("update")) {
        const r = h.rows.find((x) => x.id === p[0] && x.user_id === p[1]);
        if (r) r.is_crisis = true;
        return { rows: [] };
      }
      if (s.includes("order by created_at desc")) {
        let list = h.rows.filter((r) => r.user_id === p[0]);
        list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        if (p.length === 4) {
          list = list.filter((r) => ts(r) < (p[1] as string) || (ts(r) === p[1] && r.id < (p[2] as string)));
        }
        return { rows: list.slice(0, p[p.length - 1] as number).map(out) };
      }
      if (s.includes("where id = $1 and user_id = $2")) {
        const r = h.rows.find((x) => x.id === p[0] && x.user_id === p[1]);
        return { rows: r ? [out(r)] : [] };
      }
      throw new Error("모의 DB가 모르는 쿼리");
    },
  }),
}));

import { GET, POST } from "@/app/api/entries/route";
import { DELETE } from "@/app/api/entries/[id]/route";
import { POST as RETRY } from "@/app/api/entries/[id]/empathy/route";
import { NextRequest } from "next/server";

const OK = { emotion: "joy", intensity: 4, message: "수고하셨어요.", isCrisis: false };
const post = (body: unknown) =>
  POST(new NextRequest("http://t/api/entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
const get = (q = "") => GET(new NextRequest(`http://t/api/entries${q}`));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const seed = (user: string, extra: Partial<Row> = {}) => {
  const row: Row = {
    id: `11111111-1111-4111-8111-${String(++h.seq).padStart(12, "0")}`,
    user_id: user, content: "x", emotion: null, intensity: null, empathy_message: null,
    empathy_status: "pending", is_crisis: false,
    created_at: new Date(Date.UTC(2026, 10, 18, 0, 0, h.seq)), ...extra,
  };
  h.rows.push(row);
  return row;
};

beforeEach(() => {
  h.rows = []; h.sqls = []; h.seq = 0; h.user = "user-a";
  h.analyze.mockReset().mockResolvedValue(OK);
  h.rules.mockReset().mockReturnValue(false);
});

describe("POST /api/entries", () => {
  it("AI 성공이면 done으로 저장하고 201, user_id는 응답에 없다", async () => {
    const res = await post({ content: " 발표를 마쳤다 " });
    expect(res.status).toBe(201);
    const { entry } = await res.json();
    expect(entry).toMatchObject({
      content: "발표를 마쳤다", emotion: "joy", intensity: 4,
      empathyMessage: "수고하셨어요.", empathyStatus: "done", isCrisis: false,
    });
    expect(entry.createdAt).toBe("2026-11-19T09:30:01+09:00");
    expect(entry).not.toHaveProperty("user_id");
    expect(entry).not.toHaveProperty("userId");
  });

  it("AI 실패면 일기는 저장하고 pending, 값은 모두 null", async () => {
    h.analyze.mockRejectedValue(new FakeAiUnavailableError());
    const res = await post({ content: "일기" });
    expect(res.status).toBe(201);
    const { entry } = await res.json();
    expect(entry).toMatchObject({ emotion: null, intensity: null, empathyMessage: null, empathyStatus: "pending" });
    expect(h.rows).toHaveLength(1);
  });

  it("AI가 예상 밖 오류를 내도 일기는 저장된다", async () => {
    h.analyze.mockRejectedValue(new Error("boom"));
    expect((await post({ content: "일기" })).status).toBe(201);
    expect(h.rows).toHaveLength(1);
  });

  it("위기 판단은 AI 또는 규칙 중 하나라도 true면 true", async () => {
    h.analyze.mockResolvedValue({ ...OK, isCrisis: true });
    expect((await (await post({ content: "a" })).json()).entry.isCrisis).toBe(true);
    h.analyze.mockResolvedValue(OK);
    h.rules.mockReturnValue(true);
    expect((await (await post({ content: "b" })).json()).entry.isCrisis).toBe(true);
    h.analyze.mockRejectedValue(new FakeAiUnavailableError());
    const { entry } = await (await post({ content: "c" })).json();
    expect(entry.isCrisis).toBe(true);
    expect(entry.empathyStatus).toBe("pending");
  });

  it("빈 입력·201자·문자열 아님·깨진 JSON은 400이고 저장하지 않는다", async () => {
    for (const b of [{ content: "  " }, { content: "가".repeat(201) }, { content: 1 }, {}, "{깨진"]) {
      const res = await post(b);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(h.rows).toHaveLength(0);
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it("200자는 통과한다", async () => {
    expect((await post({ content: "가".repeat(200) })).status).toBe(201);
  });

  it("오늘 20개를 이미 썼으면 429이고 AI도 부르지 않는다", async () => {
    for (let i = 0; i < 20; i++) seed("user-a");
    const res = await post({ content: "하나 더" });
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it("다른 사용자의 개수는 한도에 영향이 없다", async () => {
    for (let i = 0; i < 20; i++) seed("user-b");
    expect((await post({ content: "나는 처음" })).status).toBe(201);
  });

  it("로그인하지 않으면 401", async () => {
    h.user = null;
    const res = await post({ content: "a" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("DB 오류는 내용을 숨기고 500", async () => {
    h.rows = null as unknown as Row[]; // 모의 DB를 고장 낸다
    const res = await post({ content: "a" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/null|TypeError|at /);
  });
});

describe("GET /api/entries", () => {
  it("본인 일기만 최신순으로 준다", async () => {
    seed("user-a", { content: "옛날" });
    seed("user-b", { content: "남의 것" });
    seed("user-a", { content: "최근" });
    const body = await (await get()).json();
    expect(body.entries.map((e: { content: string }) => e.content)).toEqual(["최근", "옛날"]);
    expect(body.nextCursor).toBeNull();
  });

  it("기록이 없으면 빈 목록과 null", async () => {
    expect(await (await get()).json()).toEqual({ entries: [], nextCursor: null });
  });

  it("커서로 이어서 받으면 겹침·누락이 없다", async () => {
    for (let i = 0; i < 5; i++) seed("user-a", { content: `일기${i}` });
    const first = await (await get("?limit=2")).json();
    expect(first.entries.map((e: { content: string }) => e.content)).toEqual(["일기4", "일기3"]);
    expect(typeof first.nextCursor).toBe("string");
    const second = await (await get(`?limit=2&cursor=${first.nextCursor}`)).json();
    expect(second.entries.map((e: { content: string }) => e.content)).toEqual(["일기2", "일기1"]);
    const third = await (await get(`?limit=2&cursor=${second.nextCursor}`)).json();
    expect(third.entries.map((e: { content: string }) => e.content)).toEqual(["일기0"]);
    expect(third.nextCursor).toBeNull();
  });

  it("limit 기본값은 20, 범위 밖·잘못된 cursor는 400", async () => {
    for (let i = 0; i < 25; i++) seed("user-a");
    expect((await (await get()).json()).entries).toHaveLength(20);
    for (const q of ["?limit=0", "?limit=21", "?limit=abc", "?cursor=zzz", "?cursor=" + Buffer.from("{}").toString("base64url")]) {
      const res = await get(q);
      expect(res.status).toBe(400);
    }
  });

  it("로그인하지 않으면 401", async () => {
    h.user = null;
    expect((await get()).status).toBe(401);
  });
});

describe("DELETE /api/entries/{id}", () => {
  it("본인 일기는 지운다", async () => {
    const r = seed("user-a");
    const res = await DELETE(new Request("http://t"), ctx(r.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(h.rows).toHaveLength(0);
  });

  it("남의 일기·없는 일기는 똑같이 404이고 지워지지 않는다", async () => {
    const other = seed("user-b");
    const a = await DELETE(new Request("http://t"), ctx(other.id));
    const b = await DELETE(new Request("http://t"), ctx("123e4567-e89b-42d3-a456-426614174000"));
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.json()).toEqual(await b.json());
    expect(h.rows).toHaveLength(1);
  });

  it("id 형식 오류는 400, 비로그인은 401", async () => {
    expect((await DELETE(new Request("http://t"), ctx("abc"))).status).toBe(400);
    h.user = null;
    expect((await DELETE(new Request("http://t"), ctx("123e4567-e89b-42d3-a456-426614174000"))).status).toBe(401);
  });
});

describe("POST /api/entries/{id}/empathy", () => {
  it("pending 일기가 성공하면 done으로 바뀐다", async () => {
    const r = seed("user-a");
    const res = await RETRY(new Request("http://t", { method: "POST" }), ctx(r.id));
    expect(res.status).toBe(200);
    expect((await res.json()).entry).toMatchObject({ empathyStatus: "done", emotion: "joy", intensity: 4 });
  });

  it("AI가 또 실패하면 200으로 여전히 pending", async () => {
    h.analyze.mockRejectedValue(new FakeAiUnavailableError());
    const r = seed("user-a");
    const res = await RETRY(new Request("http://t", { method: "POST" }), ctx(r.id));
    expect(res.status).toBe(200);
    expect((await res.json()).entry).toMatchObject({ empathyStatus: "pending", emotion: null });
  });

  it("이미 done이면 409이고 AI를 부르지 않는다", async () => {
    const r = seed("user-a", { empathy_status: "done", emotion: "joy", intensity: 3, empathy_message: "m" });
    const res = await RETRY(new Request("http://t", { method: "POST" }), ctx(r.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ALREADY_COMPLETED");
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it("남의 일기·없는 일기는 404", async () => {
    const other = seed("user-b");
    expect((await RETRY(new Request("http://t", { method: "POST" }), ctx(other.id))).status).toBe(404);
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it("기존에 위기였으면 새 결과가 false여도 true를 유지한다", async () => {
    const r = seed("user-a", { is_crisis: true });
    const { entry } = await (await RETRY(new Request("http://t", { method: "POST" }), ctx(r.id))).json();
    expect(entry.isCrisis).toBe(true);
  });

  it("AI는 실패했지만 규칙이 위기를 잡으면 pending인 채 true로 올린다", async () => {
    h.analyze.mockRejectedValue(new FakeAiUnavailableError());
    h.rules.mockReturnValue(true);
    const r = seed("user-a");
    const { entry } = await (await RETRY(new Request("http://t", { method: "POST" }), ctx(r.id))).json();
    expect(entry).toMatchObject({ empathyStatus: "pending", isCrisis: true });
    expect(h.rows[0].is_crisis).toBe(true);
  });

  it("id 형식 오류는 400, 비로그인은 401", async () => {
    expect((await RETRY(new Request("http://t", { method: "POST" }), ctx("abc"))).status).toBe(400);
    h.user = null;
    expect((await RETRY(new Request("http://t", { method: "POST" }), ctx("123e4567-e89b-42d3-a456-426614174000"))).status).toBe(401);
  });
});

describe("사용자 분리", () => {
  it("id로 접근하는 모든 쿼리에 user_id 조건이 있다", async () => {
    const r = seed("user-a");
    await RETRY(new Request("http://t", { method: "POST" }), ctx(r.id));
    await DELETE(new Request("http://t"), ctx(r.id));
    await get();
    const scoped = h.sqls.filter((q) => /diary\.entries/.test(q) && !/^\s*insert/.test(q));
    expect(scoped.length).toBeGreaterThan(0);
    for (const q of scoped) expect(q).toMatch(/user_id\s*=\s*\$/);
    for (const q of h.sqls) expect(q).toMatch(/diary\.entries/);
  });
});
