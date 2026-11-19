-- diary 스키마와 마이그레이션 기록 표. 다른 스키마는 건드리지 않는다.
create schema if not exists diary;

create table if not exists diary.schema_migrations (
  version    text primary key,                 -- 파일 이름(예: 0001_create_diary_schema.sql)
  applied_at timestamptz not null default now()
);
