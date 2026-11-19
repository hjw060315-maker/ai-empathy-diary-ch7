import { describe, expect, it } from "vitest";
import { detectCrisisByRules } from "@/ai";

const CRISIS = [
  "너무 힘들어서 죽고 싶다.",
  "죽고싶어",
  "요즘 자꾸 자살 생각이 나요",
  "극단적 선택을 하고 싶어졌다",
  "다 끝내고 싶다",
  "그냥 사라지고 싶어...",
  "오늘 손목을 그었다",
  "자해를 또 했다",
  "더 이상 살고 싶지 않아",
  "내가 없는 게 나을 것 같다",
  "유서를 썼다",
  "옥상에서 뛰어내리고 싶다는 생각이 들었다",
  "죽 고 싶 다",
  "죽어버리고 싶다ㅠㅠ",
  "살아갈 이유가 없다",
];

const SAFE = [
  "오늘 발표를 무사히 마쳤다.",
  "친구랑 맛있는 점심을 먹어서 기분이 좋다.",
  "시험 때문에 불안하고 걱정이 된다.",
  "너무 웃겨서 죽는 줄 알았다.",
  "배고파 죽겠다. 야식 먹고 싶다.",
  "더워 죽을 뻔했지만 시원한 빙수를 먹었다.",
  "화가 나서 소리를 질렀다.",
  "주말에 산책을 하며 마음이 편안했다.",
  "",
];

describe("detectCrisisByRules", () => {
  it.each(CRISIS)("위기 문장을 잡는다: %s", (s) => {
    expect(detectCrisisByRules(s)).toBe(true);
  });
  it.each(SAFE)("일반 문장은 넘어간다: %s", (s) => {
    expect(detectCrisisByRules(s)).toBe(false);
  });
});
