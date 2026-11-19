import { describe, expect, it, afterEach } from "vitest";
import { createEntrySchema, entryIdSchema } from "@/shared/validation";
import { MAX_CONTENT_LENGTH } from "@/shared/constants";
import { isGoogleAuthConfigured } from "@/server/env";

describe("일기 입력 검증", () => {
  it("앞뒤 공백은 지우고 통과시킨다", () => {
    expect(createEntrySchema.parse({ content: "  오늘은 좋았다  " }).content).toBe("오늘은 좋았다");
  });
  it("공백만 있으면 거부한다", () => {
    expect(createEntrySchema.safeParse({ content: "   " }).success).toBe(false);
  });
  it("200자까지 허용하고 201자는 거부한다", () => {
    expect(createEntrySchema.safeParse({ content: "가".repeat(MAX_CONTENT_LENGTH) }).success).toBe(true);
    expect(createEntrySchema.safeParse({ content: "가".repeat(MAX_CONTENT_LENGTH + 1) }).success).toBe(false);
  });
  it("문자열이 아니면 거부한다", () => {
    expect(createEntrySchema.safeParse({ content: 1 }).success).toBe(false);
    expect(createEntrySchema.safeParse({}).success).toBe(false);
  });
  it("일기 번호는 uuid여야 한다", () => {
    expect(entryIdSchema.safeParse("abc").success).toBe(false);
    expect(entryIdSchema.safeParse("123e4567-e89b-42d3-a456-426614174000").success).toBe(true);
  });
});

describe("환경 변수", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it("구글 로그인 값이 비어 있으면 미설정으로 본다(앱은 뜬다)", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    expect(isGoogleAuthConfigured()).toBe(false);
  });
});
