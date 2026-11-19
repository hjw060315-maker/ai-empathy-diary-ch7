# 구조와 구역 안내

2단계에서 세 에이전트가 **서로 다른 구역의 파일만** 고친다. 다른 구역 파일을 고쳐야 하면 직접 고치지 말고 담당에게 요청한다.

## 구역 표

| 구역 | 담당 | 파일 | 비고 |
|---|---|---|---|
| 서버·DB | backend-developer | `src/app/api/**`, `src/server/**`, `db/**`, `scripts/**` | API 라우트, 쿼리, 인증, 마이그레이션 |
| AI 호출·프롬프트 | ai-integration-specialist | `src/ai/**` | OpenRouter 호출, 폴백, 프롬프트, 파싱, 규칙 기반 위기 감지 |
| 화면 | frontend-developer | `src/app/**`(단 `src/app/api/**` 제외), `src/ui/**`, `src/app/globals.css` | 페이지, 컴포넌트, 스타일 |
| 공통 약속 | backend-developer가 관리 | `src/shared/**`, `docs/API.md` | 타입·상수·검증. **바꾸려면 세 담당이 합의**하고 `docs/API.md`와 같이 고친다 |
| 시험 | 각자 자기 구역 | `tests/<구역>/**` 권장 | 1단계 시험은 `tests/shared.test.ts` |

## 호출 방향 (의존 규칙)

```
화면 (src/app, src/ui)  --HTTP-->  API 라우트 (src/app/api)
                                       |
                                       v
                                  src/server  --->  src/ai (analyzeDiary, detectCrisisByRules)
                                       |
                                       v
                                   diary 스키마 (Postgres)
```

- 화면은 `src/server`, `src/ai`를 import 하지 않는다. `src/shared`의 타입·상수만 쓰고, 서버와는 HTTP(`docs/API.md`)로만 대화한다.
- `src/ai`는 DB와 `src/server`를 모른다. 입력(일기 글)을 받아 `AiAnalysis`를 돌려주거나 `AiUnavailableError`를 던진다.
- `OPENROUTER_API_KEY`는 `src/ai`와 `src/server/env.ts`에서만 읽는다. 브라우저 코드(화면 구역)에서는 읽지 않는다.

## 구역 사이 연결점 (인터페이스)

| 연결점 | 위치 | 설명 |
|---|---|---|
| API 약속 | `docs/API.md` | 화면 ↔ 서버. 화면은 모의 데이터, 서버는 이 형태로 응답 |
| `analyzeDiary(content): Promise<AiAnalysis>` | `src/ai/index.ts` | 서버 → AI. 둘 다 실패하면 `AiUnavailableError` |
| `detectCrisisByRules(content): boolean` | `src/ai/index.ts` | 서버 → AI(규칙 감지). AI 실패와 무관하게 동작 |
| `getCurrentUserId(): Promise<string \| null>` | `src/server/auth.ts` | 라우트에서 사용자 확인. 구글 값이 비면 개발용 모의 사용자 |
| 타입·상수·검증 | `src/shared/*` | `Entry`, `AiAnalysis`, 상담 연락처 `CRISIS_CONTACTS`, 글자 수 상한 등 |

## 폴더 구조

```
src/
  app/              화면(페이지·레이아웃) + api/ (서버 구역)
    api/entries/    일기 API 라우트
  ui/               화면 컴포넌트
  server/           서버 코드: env.ts(환경 변수), db.ts, auth.ts, http.ts
  ai/               AI 호출·프롬프트
  shared/           공통 타입·상수·검증
db/
  migrations/       SQL 마이그레이션 (번호순 적용)
  snapshots/        DB 스냅샷 (.gitignore, 저장소에 올리지 않음)
scripts/migrate.mjs 마이그레이션 실행 스크립트
tests/              vitest 시험
docs/               PRD, PLAN, API, ARCHITECTURE
```

## 환경 변수

`.env`는 깃에 올리지 않는다(`.gitignore` 등록). 빈 이름표는 `.env.example`에 있다. 코드는 `src/server/env.ts`를 통해 이름으로만 읽고 값을 출력하지 않는다.

| 이름 | 용도 | 비어 있으면 |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres 연결 | DB를 쓰는 요청에서 오류(앱 자체는 뜸) |
| `OPENROUTER_API_KEY` | OpenRouter 호출(서버 전용) | AI 호출 실패 → 공감 메시지 '대기' 처리 |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | 구글 로그인(3단계) | 앱은 뜸. 개발 중에는 모의 사용자 `dev-mock-user`, 운영(production)에서는 모두 401 |

## DB 규칙

- 모든 작업은 `diary` 스키마 안에서만 한다. 쿼리에는 `diary.entries`처럼 스키마를 명시한다.
- 사용자별 분리는 서버 코드에서 한다. **모든 조회·삭제·재요청 쿼리에 `user_id = $현재사용자` 조건을 넣는다.** RLS는 쓰지 않는다(8장).
- 마이그레이션: `db/migrations/NNNN_이름.sql`을 번호순으로 적용하고, 적용한 파일 이름을 `diary.schema_migrations`에 기록한다. 이미 적용된 파일은 건너뛴다. 실행은 `npm run db:migrate`(미리보기 `-- --dry-run`). 이미 적용된 파일은 고치지 말고 새 번호 파일을 추가한다.
- 스냅샷은 `db/snapshots`에 두며 공개 저장소에 올리지 않는다.

## 명령

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 빌드 |
| `npm run lint` | 린트 |
| `npm run typecheck` | 타입 검사 |
| `npm test` | 시험(vitest) |
| `npm run db:migrate` | 마이그레이션 적용(`.env`의 `DATABASE_URL` 사용) |
