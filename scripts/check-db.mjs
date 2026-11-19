// 실제 DB 확인 스크립트. 실행: npm run db:check (node --env-file=.env 로 DATABASE_URL을 읽음)
// 시험용 사용자 id(itest- 접두사)로 저장 → 목록(커서) → 삭제를 돌리고, 만든 행은 모두 지운다.
// 연결 문자열·일기 값은 출력하지 않는다. diary 스키마 안에서만 작업한다.
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("환경 변수 DATABASE_URL이 설정되지 않았습니다.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
const runId = randomUUID().slice(0, 8);
const userA = `itest-${runId}-a`;
const userB = `itest-${runId}-b`;
let failed = 0;

function check(name, ok) {
  console.log(`${ok ? "통과" : "실패"}: ${name}`);
  if (!ok) failed++;
}

const INSERT = `insert into diary.entries (user_id, content, empathy_status, created_at)
                values ($1, $2, 'pending', $3) returning id`;
const COUNT_TODAY = `select count(*)::int as n from diary.entries
    where user_id = $1
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;

try {
  await client.connect();

  // 1) 저장: A 3개(1초 간격), B 1개
  const base = Date.now() - 60_000;
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const r = await client.query(INSERT, [userA, `시험 ${i}`, new Date(base + i * 1000)]);
    ids.push(r.rows[0].id);
  }
  await client.query(INSERT, [userB, "시험 B", new Date(base)]);
  check("일기 저장(제약 조건 통과)", ids.length === 3);

  // 2) 한국 시간 하루 계산(repo의 countToday와 같은 식)
  const kstStart = (
    await client.query(
      `select (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as t`,
    )
  ).rows[0].t;
  const kstHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).format(
      kstStart,
    ),
  );
  check("한국 시간 하루 시작이 0시(KST)", kstHour === 0);
  const todayBefore = (await client.query(COUNT_TODAY, [userA])).rows[0].n;
  // 한국 자정 직전 1분 행은 오늘 개수에 들어가지 않아야 한다.
  await client.query(INSERT, [userA, "시험 어제", new Date(kstStart.getTime() - 60_000)]);
  const todayAfter = (await client.query(COUNT_TODAY, [userA])).rows[0].n;
  check("어제(KST 23:59) 일기는 오늘 개수에서 제외", todayAfter === todayBefore);
  // 한국 자정 직후 1분 행은 오늘 개수에 들어가야 한다.
  await client.query(INSERT, [userA, "시험 오늘 0시", new Date(kstStart.getTime() + 60_000)]);
  const todayAfter2 = (await client.query(COUNT_TODAY, [userA])).rows[0].n;
  check("오늘(KST 00:01) 일기는 오늘 개수에 포함", todayAfter2 === todayAfter + 1);

  // 3) 목록 + 커서(repo의 listOwnEntries와 같은 식). 어제·0시 시험 행은 별도 사용자로 두지 않고 id 목록으로만 비교.
  const listSql = (withCursor) => `select id,
        to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_ts
      from diary.entries
     where user_id = $1 and created_at >= $${withCursor ? 5 : 3}
       ${withCursor ? "and (created_at, id) < ($2::timestamptz, $3::uuid)" : ""}
     order by created_at desc, id desc
     limit $${withCursor ? 4 : 2}`;
  const since = new Date(base - 1000); // 앞서 만든 3개만 비교 대상
  const page1 = (await client.query(listSql(false), [userA, 2, since])).rows;
  check("1쪽: 최신순 2개", page1.length === 2 && page1[0].id === ids[2] && page1[1].id === ids[1]);
  const last = page1[1];
  const page2 = (await client.query(listSql(true), [userA, last.cursor_ts, last.id, 5, since])).rows;
  check(
    "커서 다음 쪽: 겹침·누락 없이 나머지가 이어짐",
    page2.length === 1 && page2[0].id === ids[0] && !page2.some((r) => page1.some((p) => p.id === r.id)),
  );

  // 4) 사용자 격리
  const listB = (await client.query(listSql(false), [userB, 10, since])).rows;
  check("B의 목록에 A의 일기 없음", listB.length === 1 && !ids.includes(listB[0].id));
  const delOther = await client.query(`delete from diary.entries where id = $1 and user_id = $2`, [
    ids[0],
    userB,
  ]);
  check("B가 A의 일기를 삭제할 수 없음", (delOther.rowCount ?? 0) === 0);

  // 5) 본인 삭제
  const delOwn = await client.query(`delete from diary.entries where id = $1 and user_id = $2`, [
    ids[0],
    userA,
  ]);
  check("본인 일기 삭제", delOwn.rowCount === 1);
} catch (err) {
  failed++;
  console.error(`DB 연결 또는 실행 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
} finally {
  // 시험 행 정리: 이번 실행의 itest-<id>- 접두사 행만 지운다.
  try {
    const r = await client.query(`delete from diary.entries where user_id like $1`, [`itest-${runId}-%`]);
    const left = await client.query(`select count(*)::int as n from diary.entries where user_id like $1`, [
      `itest-${runId}-%`,
    ]);
    console.log(`시험 행 정리: ${r.rowCount}개 삭제, 남은 행 ${left.rows[0].n}개`);
    if (left.rows[0].n !== 0) failed++;
  } catch (err) {
    failed++;
    console.error(`정리 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
  }
  await client.end().catch(() => {});
}

console.log(failed === 0 ? "모든 확인 통과." : `실패 ${failed}건.`);
process.exitCode = failed === 0 ? 0 : 1;
