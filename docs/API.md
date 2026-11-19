# API 약속

프론트·백엔드·AI가 동시에 일하기 위한 약속이다. 바꿀 때는 세 담당이 합의하고 `src/shared`와 함께 고친다. 타입 정의는 `src/shared/types.ts`, 상수는 `src/shared/constants.ts`.

## 공통

- 기본 경로 `/api`, 요청·응답은 JSON(UTF-8). 쓰기 요청은 `Content-Type: application/json`.
- 인증: 로그인한 사용자만 쓸 수 있다. 세션 쿠키로 확인하며(3단계 Auth.js), 로그인하지 않았으면 모든 엔드포인트가 `401 UNAUTHORIZED`. 개발 중(구글 값이 비어 있을 때)에는 모의 사용자 `dev-mock-user`로 동작한다.
- **사용자 분리(서버 코드)**: 작성자는 요청 본문이 아니라 서버가 세션에서 정한다. 모든 조회·삭제·재요청은 본인 일기만 대상이다. 남의 일기 id는 존재 여부를 알려 주지 않도록 항상 `404 NOT_FOUND`로 답한다.
- 시각 `createdAt`은 시간대 오프셋이 붙은 ISO 8601(예: `2026-11-19T09:30:00+09:00`). 화면은 한국 시간으로 표시한다. "하루"는 한국 시간(Asia/Seoul) 0시~24시.
- 감정 값은 영문 코드. 화면 표시용 한글은 `EMOTION_LABELS`: `joy` 기쁨, `sadness` 슬픔, `anxiety` 불안, `anger` 분노, `calm` 평온.

### 한도

| 항목 | 값 | 어기면 |
|---|---|---|
| 일기 최대 글자 수 | 200자(앞뒤 공백 제거 후) | 400 `VALIDATION_ERROR` |
| 하루 작성 개수 | 20개(한국 시간 기준) | 429 `DAILY_LIMIT_EXCEEDED` |
| 목록 한 번에 | 최대 20개 | `limit`은 1~20, 기본 20 |

### 일기 객체 `Entry`

| 필드 | 형태 | 설명 |
|---|---|---|
| `id` | string(uuid) | |
| `content` | string | 일기 내용 |
| `emotion` | `"joy"｜"sadness"｜"anxiety"｜"anger"｜"calm"｜null` | 대기 상태면 null |
| `intensity` | `1｜2｜3｜4｜5｜null` | 대기 상태면 null |
| `empathyMessage` | string｜null | 대기 상태면 null |
| `empathyStatus` | `"done"｜"pending"` | done 완료, pending 대기(재요청 필요) |
| `isCrisis` | boolean | 위기 표현 여부(AI 판단 또는 규칙 감지 중 하나라도 true). true면 화면이 상담 연락처 안내를 보여 준다 |
| `createdAt` | string | 작성 시각 |

`empathyStatus`가 `done`이면 `emotion`·`intensity`·`empathyMessage`는 모두 값이 있고, `pending`이면 모두 null이다. 사용자 식별값(`user_id`)은 응답에 넣지 않는다.

### 오류 응답 형태

모든 오류는 같은 형태다. `message`는 사용자에게 그대로 보여 줘도 되는 한국어 문장이며, 스택 트레이스·키·내부 주소는 담지 않는다.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "일기는 200자까지 쓸 수 있어요." } }
```

| HTTP | `code` | 언제 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 빈 입력, 200자 초과, 문자열 아님, 잘못된 id·쿼리 |
| 401 | `UNAUTHORIZED` | 로그인하지 않음 또는 세션 만료 |
| 404 | `NOT_FOUND` | 없는 일기이거나 남의 일기 |
| 409 | `ALREADY_COMPLETED` | 이미 공감 메시지가 완료된 일기를 재요청 |
| 429 | `DAILY_LIMIT_EXCEEDED` | 오늘 20개를 이미 씀 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류(내용은 숨김) |

AI 모델 실패는 오류가 아니다. 일기는 저장되고 `empathyStatus: "pending"`으로 응답한다(F6).

---

## POST `/api/entries` — 일기 저장 (F2, F3, F4, F6)

일기를 저장하고, 이어서 감정 분석·공감 메시지를 받아 같이 저장한 뒤 응답한다. AI 호출에 시간이 걸리므로(모델당 최대 20초, 폴백 포함 최대 약 40초) 화면은 "분석 중"을 보여 준다.

처리 순서(서버): 로그인 확인 → 입력 검증 → 오늘 개수 확인 → 규칙 기반 위기 감지 → AI 호출 → 저장 → 응답. 어떤 경우에도 검증을 통과한 일기는 저장한다.

요청

```json
{ "content": "오늘 발표를 무사히 마쳤다." }
```

성공 `201`: AI 성공(`done`)

```json
{
  "entry": {
    "id": "123e4567-e89b-42d3-a456-426614174000",
    "content": "오늘 발표를 무사히 마쳤다.",
    "emotion": "joy",
    "intensity": 4,
    "empathyMessage": "긴장되는 발표를 잘 마무리하셨군요. 정말 수고 많으셨어요.",
    "empathyStatus": "done",
    "isCrisis": false,
    "createdAt": "2026-11-19T09:30:00+09:00"
  }
}
```

성공 `201`: 두 모델 모두 실패(`pending`). 일기는 저장됨

```json
{
  "entry": {
    "id": "123e4567-e89b-42d3-a456-426614174001",
    "content": "오늘 발표를 무사히 마쳤다.",
    "emotion": null,
    "intensity": null,
    "empathyMessage": null,
    "empathyStatus": "pending",
    "isCrisis": false,
    "createdAt": "2026-11-19T09:30:00+09:00"
  }
}
```

위기 표현이 있으면 `isCrisis: true`(AI가 실패해도 규칙 감지로 true가 될 수 있음). 일기는 그대로 저장하며 거부하지 않는다.

오류: 400 빈 입력·200자 초과, 401, 429 하루 20개 초과, 500.

## GET `/api/entries` — 지난 기록 (F5)

본인 일기만 최신 작성 순. 커서 방식으로 나눠 준다.

쿼리: `limit`(1~20, 기본 20), `cursor`(이전 응답의 `nextCursor`, 첫 요청은 생략). `cursor`는 서버가 만든 불투명한 문자열이며 화면은 해석하지 않고 그대로 되돌려 보낸다.

요청: `GET /api/entries?limit=20`

응답 `200`

```json
{
  "entries": [
    {
      "id": "123e4567-e89b-42d3-a456-426614174000",
      "content": "오늘 발표를 무사히 마쳤다.",
      "emotion": "joy",
      "intensity": 4,
      "empathyMessage": "긴장되는 발표를 잘 마무리하셨군요. 정말 수고 많으셨어요.",
      "empathyStatus": "done",
      "isCrisis": false,
      "createdAt": "2026-11-19T09:30:00+09:00"
    }
  ],
  "nextCursor": "opaque-cursor-string"
}
```

기록이 없으면 `{ "entries": [], "nextCursor": null }`. 더 없으면 `nextCursor`는 null.

오류: 400 잘못된 `limit`·`cursor`, 401, 500.

## DELETE `/api/entries/{id}` — 일기 삭제 (F7)

본인 일기를 DB에서 지운다(되돌릴 수 없음). 수정 API는 없다. 확인 절차("정말 삭제할까요?")는 화면이 맡는다.

요청: `DELETE /api/entries/123e4567-e89b-42d3-a456-426614174000`

응답 `200`

```json
{ "deleted": true }
```

오류: 400 id 형식 오류, 401, 404 없거나 남의 일기, 500.

## POST `/api/entries/{id}/empathy` — 공감 메시지 재요청 (F6)

`pending` 상태인 본인 일기에 대해 감정 분석·공감 메시지를 다시 요청한다. 본문은 없다. 성공하면 결과가 저장되어 `done`이 된다. 위기 여부는 기존 값과 새 결과 중 하나라도 true면 true를 유지한다(한 번 true가 된 안내는 사라지지 않는다).

요청: `POST /api/entries/123e4567-e89b-42d3-a456-426614174001/empathy`

응답 `200`: 성공(`done`)

```json
{
  "entry": {
    "id": "123e4567-e89b-42d3-a456-426614174001",
    "content": "오늘 발표를 무사히 마쳤다.",
    "emotion": "joy",
    "intensity": 4,
    "empathyMessage": "긴장되는 발표를 잘 마무리하셨군요. 정말 수고 많으셨어요.",
    "empathyStatus": "done",
    "isCrisis": false,
    "createdAt": "2026-11-19T09:30:00+09:00"
  }
}
```

응답 `200`: 이번에도 AI 실패. 여전히 `pending`인 일기를 돌려주며 화면은 [다시 받기]를 계속 보여 준다.

오류: 400 id 형식 오류, 401, 404 없거나 남의 일기, 409 이미 `done`, 500.

---

## AI 결과 타입 (서버 ↔ `src/ai`)

화면은 쓰지 않는다. 서버가 `src/ai/index.ts`의 함수를 부른다.

```ts
interface AiAnalysis {
  emotion: "joy" | "sadness" | "anxiety" | "anger" | "calm"; // 5종 안의 값만
  intensity: 1 | 2 | 3 | 4 | 5;                               // 정수
  message: string;                                            // 한국어, 따뜻한 말투, 진단·처방·훈계 없음
  isCrisis: boolean;                                          // AI의 위기 판단
}

analyzeDiary(content: string): Promise<AiAnalysis>;  // 실패(둘 다 실패, 파싱 실패, 목록 밖 값)면 AiUnavailableError
detectCrisisByRules(content: string): boolean;       // AI와 별개로 항상 동작
```

- `src/ai`가 1순위 → 2순위 폴백, 20초 제한, 응답 검증(감정 목록, 강도 1~5 정수, 빈 메시지 불가)을 모두 맡는다. 검증에 실패한 결과는 성공으로 돌려주지 않고 폴백 또는 `AiUnavailableError`로 처리한다.
- 서버는 `isCrisis = analysis.isCrisis || detectCrisisByRules(content)`로 합쳐 저장한다. AI가 실패해도 규칙 감지 결과는 저장한다.
- 일기 내용은 로그에 남기지 않는다.

## 화면 개발용 모의 데이터

2단계에서 화면은 위 예시 JSON을 그대로 모의 데이터로 쓴다. 위기 예시(`isCrisis: true`, `empathyStatus: "done"`)와 대기 예시(`pending`)도 포함해 시험한다. 상담 연락처는 `src/shared/constants.ts`의 `CRISIS_CONTACTS`를 쓴다.
