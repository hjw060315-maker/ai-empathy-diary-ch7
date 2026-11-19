import { Pool } from "pg";
import { env } from "./env";

// 모든 쿼리는 diary 스키마의 표를 `diary.` 접두어로 직접 지정해 쓴다.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.databaseUrl(), max: 5 });
  }
  return pool;
}
