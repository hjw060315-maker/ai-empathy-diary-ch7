export const MAX_CONTENT_LENGTH = 200; // 일기 최대 글자 수
export const MAX_ENTRIES_PER_DAY = 20; // 하루 작성 상한 (한국 시간 기준)
export const LIST_PAGE_SIZE = 20; // 목록 한 번에 20개
export const AI_TIMEOUT_MS = 20_000; // 모델 한 번 호출 제한 시간
export const DAY_TIME_ZONE = "Asia/Seoul";

// 위기 상담 연락처 (PRD 6.3). 번호는 이 한곳에서만 바꾼다.
export const CRISIS_CONTACTS = [
  { name: "자살예방 상담전화", number: "109", purpose: "자살 위기 상담" },
  { name: "정신건강 위기상담전화", number: "1577-0199", purpose: "정신건강 위기 상담" },
  { name: "청소년 상담전화", number: "1388", purpose: "청소년 상담" },
  { name: "긴급 신고(응급)", number: "119", purpose: "지금 당장 위험할 때" },
] as const;
