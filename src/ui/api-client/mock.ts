import { MAX_CONTENT_LENGTH, MAX_ENTRIES_PER_DAY } from "@/shared/constants";
import type { Emotion, Entry, Intensity } from "@/shared/types";
import { ApiClientError, type ApiClient } from "./types";

/**
 * 모의 데이터 클라이언트(2단계). 메모리에만 저장되며 새로고침하면 처음 상태로 돌아간다.
 * 시험용 약속 문구(일기 내용에 넣으면 동작이 바뀐다)
 *  - "죽고 싶" 등 위기 표현: isCrisis true
 *  - "[대기]": AI 실패(pending)로 저장
 *  - "[실패]": 다시 받기를 눌러도 계속 pending
 */

const CRISIS_WORDS = ["죽고 싶", "죽고싶", "사라지고 싶", "자해"];

const MESSAGES: Record<Emotion, string> = {
  joy: "기쁜 하루를 보내셨군요. 그 마음이 오래 이어지면 좋겠어요.",
  sadness: "마음이 무거운 하루였군요. 오늘은 스스로에게 조금 너그러워져도 괜찮아요.",
  anxiety: "걱정이 많은 하루였군요. 여기에 적어 두는 것만으로도 큰 용기예요.",
  anger: "속상하고 화가 나는 일이 있었군요. 그럴 만했다고 생각해요.",
  calm: "차분하게 하루를 보내셨군요. 이런 평온한 시간도 소중해요.",
};
const CRISIS_MESSAGE =
  "많이 힘드셨군요. 이 이야기를 적어 주셔서 고마워요. 혼자 견디지 않으셔도 괜찮아요.";

function pickEmotion(content: string): Emotion {
  if (/기쁘|행복|좋았|신나|뿌듯/.test(content)) return "joy";
  if (/슬프|우울|눈물|외롭/.test(content)) return "sadness";
  if (/불안|걱정|떨리|긴장/.test(content)) return "anxiety";
  if (/화가|짜증|분하|억울/.test(content)) return "anger";
  return "calm";
}

function toKstIso(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 19) + "+09:00";
}

function newId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function seedEntries(now: number): Entry[] {
  const emotions: Emotion[] = ["joy", "calm", "sadness", "anxiety", "anger"];
  const list: Entry[] = [];
  for (let i = 0; i < 26; i++) {
    const emotion = emotions[i % emotions.length];
    const base = {
      id: newId(1000 - i),
      content: `모의 일기 ${i + 1}번째: 오늘도 하루를 보냈다.`,
      createdAt: toKstIso(now - (i + 1) * 5 * 3600_000 - 24 * 3600_000),
    };
    if (i === 1) {
      list.push({
        ...base,
        content: "모의 일기: 요즘 너무 힘들어서 죽고 싶다는 생각이 들었다.",
        emotion: "sadness",
        intensity: 5,
        empathyMessage: CRISIS_MESSAGE,
        empathyStatus: "done",
        isCrisis: true,
      });
    } else if (i === 2) {
      list.push({
        ...base,
        content: "모의 일기: 공감 메시지를 받지 못한 일기.",
        emotion: null,
        intensity: null,
        empathyMessage: null,
        empathyStatus: "pending",
        isCrisis: false,
      });
    } else {
      list.push({
        ...base,
        emotion,
        intensity: ((i % 5) + 1) as Intensity,
        empathyMessage: MESSAGES[emotion],
        empathyStatus: "done",
        isCrisis: false,
      });
    }
  }
  return list;
}

export interface MockOptions {
  /** 응답 지연(ms). "분석 중" 표시를 눈으로 보려면 기본값 그대로 둔다. */
  delayMs?: number;
}

export function createMockClient({ delayMs = 900 }: MockOptions = {}): ApiClient {
  let store: Entry[] = seedEntries(Date.now());
  let counter = 1;
  const wait = () => new Promise<void>((r) => setTimeout(r, delayMs));
  const clone = (e: Entry): Entry => ({ ...e });

  return {
    async createEntry(raw) {
      await wait();
      const content = raw.trim();
      if (content.length === 0) {
        throw new ApiClientError("VALIDATION_ERROR", "일기 내용을 입력해 주세요.", 400);
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        throw new ApiClientError(
          "VALIDATION_ERROR",
          `일기는 ${MAX_CONTENT_LENGTH}자까지 쓸 수 있어요.`,
          400,
        );
      }
      const createdAt = toKstIso(Date.now());
      const today = createdAt.slice(0, 10);
      if (store.filter((e) => e.createdAt.startsWith(today)).length >= MAX_ENTRIES_PER_DAY) {
        throw new ApiClientError(
          "DAILY_LIMIT_EXCEEDED",
          `하루에 ${MAX_ENTRIES_PER_DAY}개까지 쓸 수 있어요. 내일 또 만나요.`,
          429,
        );
      }
      const isCrisis = CRISIS_WORDS.some((w) => content.includes(w));
      const failed = content.includes("[대기]");
      const emotion = pickEmotion(content);
      const entry: Entry = failed
        ? {
            id: newId(counter++),
            content,
            emotion: null,
            intensity: null,
            empathyMessage: null,
            empathyStatus: "pending",
            isCrisis,
            createdAt,
          }
        : {
            id: newId(counter++),
            content,
            emotion: isCrisis ? "sadness" : emotion,
            intensity: (isCrisis ? 5 : (content.length % 5) + 1) as Intensity,
            empathyMessage: isCrisis ? CRISIS_MESSAGE : MESSAGES[emotion],
            empathyStatus: "done",
            isCrisis,
            createdAt,
          };
      store = [entry, ...store];
      return clone(entry);
    },

    async listEntries({ cursor, limit = 20 } = {}) {
      await wait();
      const start = cursor ? Number.parseInt(cursor, 10) : 0;
      if (!Number.isInteger(start) || start < 0) {
        throw new ApiClientError("VALIDATION_ERROR", "목록을 불러올 수 없어요.", 400);
      }
      const page = store.slice(start, start + limit).map(clone);
      const next = start + limit;
      return { entries: page, nextCursor: next < store.length ? String(next) : null };
    },

    async deleteEntry(id) {
      await wait();
      if (!store.some((e) => e.id === id)) {
        throw new ApiClientError("NOT_FOUND", "이미 지워졌거나 찾을 수 없는 일기예요.", 404);
      }
      store = store.filter((e) => e.id !== id);
    },

    async requestEmpathy(id) {
      await wait();
      const target = store.find((e) => e.id === id);
      if (!target) {
        throw new ApiClientError("NOT_FOUND", "이미 지워졌거나 찾을 수 없는 일기예요.", 404);
      }
      if (target.empathyStatus === "done") {
        throw new ApiClientError("ALREADY_COMPLETED", "이미 공감 메시지를 받은 일기예요.", 409);
      }
      if (target.content.includes("[실패]")) return clone(target);
      const emotion = pickEmotion(target.content);
      const updated: Entry = {
        ...target,
        emotion,
        intensity: ((target.content.length % 5) + 1) as Intensity,
        empathyMessage: MESSAGES[emotion],
        empathyStatus: "done",
      };
      store = store.map((e) => (e.id === id ? updated : e));
      return clone(updated);
    },
  };
}
