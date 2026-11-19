-- 일기 표 (PRD 7장). 사용자별 분리는 서버 코드에서 user_id 조건으로 처리한다(RLS 없음).
create table if not exists diary.entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,                                  -- 작성자(로그인 사용자 식별값)
  content          text not null
                   check (char_length(btrim(content)) between 1 and 200),
  emotion          text
                   check (emotion in ('joy', 'sadness', 'anxiety', 'anger', 'calm')),
  intensity        smallint
                   check (intensity between 1 and 5),
  empathy_message  text,
  empathy_status   text not null default 'pending'
                   check (empathy_status in ('done', 'pending')),
  is_crisis        boolean not null default false,                 -- 위기 표현 여부(AI 또는 규칙)
  created_at       timestamptz not null default now(),             -- 시간대 포함
  -- 완료 상태면 감정·강도·메시지가 모두 있어야 한다.
  constraint entries_done_has_result check (
    empathy_status = 'pending'
    or (emotion is not null and intensity is not null and empathy_message is not null)
  )
);

-- 본인 목록(최신순)과 하루 작성 개수 조회용
create index if not exists entries_user_created_idx
  on diary.entries (user_id, created_at desc, id desc);
