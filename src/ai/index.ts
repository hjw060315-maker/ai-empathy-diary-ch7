// AI 구역(ai-integration-specialist). 서버는 이 파일의 함수만 부른다.
import { AI_TIMEOUT_MS } from "@/shared/constants";
import type { AiAnalysis } from "@/shared/types";
import { parseAnalysis } from "./parse";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export { detectCrisisByRules } from "./crisis";

/** 두 모델 모두 실패했을 때 던진다. 서버는 일기를 저장하고 상태를 '대기'로 둔다. */
export class AiUnavailableError extends Error {
  constructor(message = "AI 모델을 사용할 수 없습니다.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export const PRIMARY_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const FALLBACK_MODEL = "nvidia/nemotron-3.5-super-vl:free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** 모델 한 번 호출. 성공하면 검증된 결과, 어떤 실패든 null(내용·키는 로그에 남기지 않는다). */
async function callModel(model: string, content: string, apiKey: string): Promise<AiAnalysis | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(content) },
        ],
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[ai] ${model} 실패: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] } | null;
    const parsed = parseAnalysis(data?.choices?.[0]?.message?.content);
    if (!parsed) console.warn(`[ai] ${model} 실패: 빈 응답 또는 형식 오류`);
    return parsed;
  } catch (e) {
    const kind = e instanceof Error ? e.name : "unknown";
    console.warn(`[ai] ${model} 실패: ${kind}`);
    return null;
  }
}

/** 감정 분석 + 공감 메시지. 1순위 → 2순위 폴백, 둘 다 실패하면 AiUnavailableError. */
export async function analyzeDiary(content: string): Promise<AiAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new AiUnavailableError("AI 설정이 없습니다.");

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    const result = await callModel(model, content, apiKey);
    if (result) return result;
  }
  throw new AiUnavailableError();
}
