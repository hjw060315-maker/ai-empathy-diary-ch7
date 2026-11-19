import { z } from "zod";
import { EMOTIONS, type AiAnalysis } from "@/shared/types";

const schema = z.object({
  emotion: z.enum(EMOTIONS),
  intensity: z.number().int().min(1).max(5),
  message: z.string().trim().min(1),
  isCrisis: z.boolean(),
});

/** 모델 응답 텍스트에서 JSON 객체를 꺼내 검증한다. 실패하면 null. */
export function parseAnalysis(raw: unknown): AiAnalysis | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const text = raw.replace(/```(?:json)?/gi, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const r = schema.safeParse(json);
  if (!r.success) return null;
  return { ...r.data, message: r.data.message.trim() } as AiAnalysis;
}
