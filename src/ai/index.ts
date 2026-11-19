// AI 구역(ai-integration-specialist). 서버는 이 파일의 함수만 부른다.
import type { AiAnalysis } from "@/shared/types";

/** 두 모델 모두 실패했을 때 던진다. 서버는 일기를 저장하고 상태를 '대기'로 둔다. */
export class AiUnavailableError extends Error {
  constructor(message = "AI 모델을 사용할 수 없습니다.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** 감정 분석 + 공감 메시지. 2단계에서 OpenRouter 호출·폴백으로 교체한다. */
export async function analyzeDiary(content: string): Promise<AiAnalysis> {
  void content;
  // 1단계 뼈대: 실제 호출 없음.
  throw new AiUnavailableError("아직 연결되지 않았습니다.");
}

/** 규칙 기반 위기 표현 감지(AI와 별도). 2단계에서 표현 목록으로 교체한다. */
export function detectCrisisByRules(content: string): boolean {
  void content;
  return false;
}
