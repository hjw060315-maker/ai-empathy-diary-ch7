// diary.entries 쿼리 모음. 모든 조회·수정·삭제에 user_id 조건을 건다(남의 일기는 못 건드림).
import { getPool } from "./db";
import type { Emotion, Entry, EmpathyStatus, Intensity } from "@/shared/types";

interface EntryRow {
  id: string;
  content: string;
  emotion: Emotion | null;
  intensity: number | null;
  empathy_message: string | null;
  empathy_status: EmpathyStatus;
  is_crisis: boolean;
  created_at: Date;
  cursor_ts?: string;
}

const COLUMNS = `id, content, emotion, intensity, empathy_message, empathy_status, is_crisis, created_at`;

/** Date를 한국 시간 오프셋(+09:00)이 붙은 ISO 8601로 바꾼다. 한국은 일광절약시간이 없다. */
export function toKstIso(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 19)}+09:00`;
}

export function rowToEntry(row: EntryRow): Entry {
  const done = row.empathy_status === "done";
  return {
    id: row.id,
    content: row.content,
    emotion: done ? row.emotion : null,
    intensity: done ? (row.intensity as Intensity | null) : null,
    empathyMessage: done ? row.empathy_message : null,
    empathyStatus: row.empathy_status,
    isCrisis: row.is_crisis,
    createdAt: toKstIso(row.created_at),
  };
}

/** 오늘(한국 시간 0시~) 본인이 쓴 일기 수 */
export async function countToday(userId: string): Promise<number> {
  const r = await getPool().query<{ n: number }>(
    `select count(*)::int as n from diary.entries
      where user_id = $1
        and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`,
    [userId],
  );
  return r.rows[0]?.n ?? 0;
}

export interface NewEntry {
  userId: string;
  content: string;
  isCrisis: boolean;
  analysis: { emotion: Emotion; intensity: Intensity; message: string } | null;
}

export async function insertEntry(e: NewEntry): Promise<Entry> {
  const a = e.analysis;
  const r = await getPool().query<EntryRow>(
    `insert into diary.entries
       (user_id, content, emotion, intensity, empathy_message, empathy_status, is_crisis)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning ${COLUMNS}`,
    [
      e.userId,
      e.content,
      a?.emotion ?? null,
      a?.intensity ?? null,
      a?.message ?? null,
      a ? "done" : "pending",
      e.isCrisis,
    ],
  );
  return rowToEntry(r.rows[0]);
}

export async function findOwnEntry(userId: string, id: string): Promise<Entry | null> {
  const r = await getPool().query<EntryRow>(
    `select ${COLUMNS} from diary.entries where id = $1 and user_id = $2`,
    [id, userId],
  );
  return r.rows[0] ? rowToEntry(r.rows[0]) : null;
}

export async function deleteOwnEntry(userId: string, id: string): Promise<boolean> {
  const r = await getPool().query(
    `delete from diary.entries where id = $1 and user_id = $2`,
    [id, userId],
  );
  return (r.rowCount ?? 0) > 0;
}

export interface CursorPoint {
  ts: string; // 마이크로초까지 담은 UTC 시각 문자열
  id: string;
}

/** 최신순 목록. limit+1개를 읽어 다음 쪽이 있는지 판단한다. */
export async function listOwnEntries(
  userId: string,
  limit: number,
  after: CursorPoint | null,
): Promise<{ entries: Entry[]; next: CursorPoint | null }> {
  const params: unknown[] = [userId];
  let where = `user_id = $1`;
  if (after) {
    params.push(after.ts, after.id);
    where += ` and (created_at, id) < ($2::timestamptz, $3::uuid)`;
  }
  params.push(limit + 1);
  const r = await getPool().query<EntryRow>(
    `select ${COLUMNS},
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_ts
       from diary.entries
      where ${where}
      order by created_at desc, id desc
      limit $${params.length}`,
    params,
  );
  const hasMore = r.rows.length > limit;
  const rows = hasMore ? r.rows.slice(0, limit) : r.rows;
  const last = rows[rows.length - 1];
  return {
    entries: rows.map(rowToEntry),
    next: hasMore && last?.cursor_ts ? { ts: last.cursor_ts, id: last.id } : null,
  };
}

/** pending 일기에 결과를 채운다. 이미 done이면 갱신하지 않고 null. */
export async function completeEntry(
  userId: string,
  id: string,
  analysis: { emotion: Emotion; intensity: Intensity; message: string },
  isCrisis: boolean,
): Promise<Entry | null> {
  const r = await getPool().query<EntryRow>(
    `update diary.entries
        set emotion = $3, intensity = $4, empathy_message = $5,
            empathy_status = 'done', is_crisis = (is_crisis or $6)
      where id = $1 and user_id = $2 and empathy_status = 'pending'
      returning ${COLUMNS}`,
    [id, userId, analysis.emotion, analysis.intensity, analysis.message, isCrisis],
  );
  return r.rows[0] ? rowToEntry(r.rows[0]) : null;
}

/** AI 실패 시 규칙 감지로 위기가 잡혔다면 true로 올린다(내리지는 않는다). */
export async function markCrisis(userId: string, id: string): Promise<void> {
  await getPool().query(
    `update diary.entries set is_crisis = true where id = $1 and user_id = $2`,
    [id, userId],
  );
}
