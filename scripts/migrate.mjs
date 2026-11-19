// 마이그레이션 실행 스크립트. 실행: npm run db:migrate (node --env-file=.env 로 DATABASE_URL을 읽음)
// diary.schema_migrations 에 적용 기록을 남기고, 이미 적용된 파일은 건너뛴다.
// 연결 문자열 등 값은 출력하지 않는다. diary 스키마 안에서만 작업한다.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("환경 변수 DATABASE_URL이 설정되지 않았습니다.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
const dryRun = process.argv.includes("--dry-run");

try {
  await client.connect();

  let applied = new Set();
  if (dryRun) {
    // 드라이런은 DB를 바꾸지 않는다. 기록 표가 있으면 읽기만 한다.
    const exists = (await client.query("select to_regclass('diary.schema_migrations') as t")).rows[0].t;
    if (exists) {
      applied = new Set(
        (await client.query("select version from diary.schema_migrations")).rows.map((r) => r.version),
      );
    }
  } else {
    // 기록 표를 먼저 보장한다(0001 파일과 같은 내용, 여러 번 실행해도 안전).
    await client.query("create schema if not exists diary");
    await client.query(
      `create table if not exists diary.schema_migrations (
         version text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    applied = new Set(
      (await client.query("select version from diary.schema_migrations")).rows.map((r) => r.version),
    );
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`건너뜀(이미 적용): ${file}`);
      continue;
    }
    if (dryRun) {
      console.log(`적용 예정: ${file}`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into diary.schema_migrations (version) values ($1)", [file]);
      await client.query("commit");
      console.log(`적용 완료: ${file}`);
      count++;
    } catch (err) {
      await client.query("rollback");
      console.error(`실패: ${file} - ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      process.exitCode = 1;
      break;
    }
  }
  console.log(dryRun ? "드라이런 종료(DB 변경 없음)." : `끝. 새로 적용: ${count}개`);
} catch (err) {
  console.error(`DB 연결 또는 실행 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
