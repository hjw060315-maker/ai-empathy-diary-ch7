import { DAY_TIME_ZONE } from "@/shared/constants";

const formatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: DAY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** ISO 8601 시각을 한국 시간 문장으로. 예: "2026년 11월 19일 (목) 오전 9:30" */
export function formatKoreanDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(formatter.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 (${parts.weekday}) ${parts.dayPeriod} ${parts.hour}:${parts.minute}`;
}

/** 입력창 글자 수 판단 (서버와 같이 앞뒤 공백을 뺀 길이) */
export function countContent(text: string): number {
  return text.trim().length;
}
