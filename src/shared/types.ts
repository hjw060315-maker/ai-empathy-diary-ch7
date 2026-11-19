// 프론트·백엔드·AI가 함께 쓰는 타입. 이 파일은 docs/API.md 약속과 함께만 바꾼다.

export const EMOTIONS = ["joy", "sadness", "anxiety", "anger", "calm"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const EMOTION_LABELS: Record<Emotion, string> = {
  joy: "기쁨",
  sadness: "슬픔",
  anxiety: "불안",
  anger: "분노",
  calm: "평온",
};

export type EmpathyStatus = "done" | "pending";
export type Intensity = 1 | 2 | 3 | 4 | 5;

/** API가 돌려주는 일기 한 건 */
export interface Entry {
  id: string;
  content: string;
  emotion: Emotion | null; // pending이면 null
  intensity: Intensity | null; // pending이면 null
  empathyMessage: string | null; // pending이면 null
  empathyStatus: EmpathyStatus;
  isCrisis: boolean;
  createdAt: string; // ISO 8601, 시간대 오프셋 포함 (예: 2026-11-19T09:30:00+09:00)
}

/** AI 호출 결과 (src/ai가 반환, 서버가 저장) */
export interface AiAnalysis {
  emotion: Emotion;
  intensity: Intensity;
  message: string; // 한국어 공감 메시지
  isCrisis: boolean; // AI의 위기 판단
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "DAILY_LIMIT_EXCEEDED"
  | "NOT_FOUND"
  | "ALREADY_COMPLETED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export interface EntryListResponse {
  entries: Entry[];
  nextCursor: string | null;
}

export interface EntryResponse {
  entry: Entry;
}
