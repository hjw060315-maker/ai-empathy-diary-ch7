"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LIST_PAGE_SIZE } from "@/shared/constants";
import type { Entry } from "@/shared/types";
import { apiClient, ApiClientError } from "@/ui/api-client";
import { EntryCard } from "./EntryCard";
import { EntryForm } from "./EntryForm";

type LoadState = "loading" | "ready" | "error";

function messageOf(e: unknown): { text: string; needLogin: boolean } {
  if (e instanceof ApiClientError) {
    return { text: e.message, needLogin: e.code === "UNAUTHORIZED" };
  }
  return { text: "문제가 생겼어요. 잠시 후 다시 시도해 주세요.", needLogin: false };
}

export function DiaryApp({
  userLabel = null,
  signOutAction,
}: {
  userLabel?: string | null;
  signOutAction?: () => void | Promise<void>;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [listError, setListError] = useState<{ text: string; needLogin: boolean } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();

  const loadFirst = useCallback(async () => {
    setLoadState("loading");
    setListError(null);
    try {
      const page = await apiClient.listEntries({ limit: LIST_PAGE_SIZE });
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
      setLoadState("ready");
    } catch (e) {
      const m = messageOf(e);
      setListError(m);
      setLoadState("error");
      // 로그인이 풀렸으면 로그인 화면으로 안내한다(글 쓰기는 입력칸이 그대로 남는다).
      if (m.needLogin) router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    // 처음 한 번 지난 기록을 불러온다 (외부 데이터와 맞추는 일)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFirst();
  }, [loadFirst]);

  async function handleCreate(content: string): Promise<boolean> {
    setSubmitting(true);
    setFormError(null);
    setNeedLogin(false);
    setStatus("공감 메시지를 만드는 중이에요. 잠시만 기다려 주세요.");
    try {
      const entry = await apiClient.createEntry(content);
      setEntries((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)]);
      setNewId(entry.id);
      setStatus(
        entry.empathyStatus === "done"
          ? "일기를 저장했고 공감 메시지가 도착했어요."
          : "일기는 저장했지만 공감 메시지는 아직 받지 못했어요. 다시 받기를 눌러 주세요.",
      );
      if (loadState !== "ready") setLoadState("ready");
      return true;
    } catch (e) {
      const m = messageOf(e);
      setFormError(m.text);
      setNeedLogin(m.needLogin);
      setStatus("");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setListError(null);
    try {
      const page = await apiClient.listEntries({ cursor: nextCursor, limit: LIST_PAGE_SIZE });
      setEntries((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.entries.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (e) {
      setListError(messageOf(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    await apiClient.deleteEntry(id);
    setEntries((prev) => prev.filter((p) => p.id !== id));
    setStatus("일기를 삭제했어요.");
    headingRef.current?.focus();
  }

  async function handleRetry(id: string): Promise<Entry> {
    const updated = await apiClient.requestEmpathy(id);
    setEntries((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (updated.empathyStatus === "done") setStatus("공감 메시지가 도착했어요.");
    return updated;
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <p className="site-header__title">AI 공감 다이어리</p>
          <div className="site-header__user">
            {userLabel && <span className="site-header__name">{userLabel}님</span>}
            {signOutAction ? (
              <form action={signOutAction}>
                <button type="submit" className="btn btn--ghost">
                  로그아웃
                </button>
              </form>
            ) : (
              <Link className="site-header__link" href="/login">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="page" tabIndex={-1}>
        <h1 className="page__title">오늘 하루는 어땠나요?</h1>
        <p className="page__lead">한 줄이면 충분해요. 쓰고 나면 AI가 따뜻하게 답해 드려요.</p>

        <EntryForm submitting={submitting} serverError={formError} onSubmit={handleCreate} />

        {needLogin && (
          <p className="notice" role="alert">
            로그인이 풀렸어요. <Link href="/login">다시 로그인</Link>해 주세요. 쓰던 글은 입력칸에
            그대로 남아 있어요.
          </p>
        )}

        <div className="sr-only" role="status" aria-live="polite">
          {status}
        </div>
        {submitting && (
          <div className="analyzing" aria-hidden="true">
            <span className="analyzing__spinner" />
            <span>분석 중이에요. 최대 40초쯤 걸릴 수 있어요.</span>
          </div>
        )}

        <section className="list" aria-labelledby="list-title">
          <h2 id="list-title" className="list__title" tabIndex={-1} ref={headingRef}>
            지난 기록
          </h2>

          {loadState === "loading" && <p className="muted">기록을 불러오는 중이에요...</p>}

          {loadState === "error" && listError && (
            <div className="notice" role="alert">
              <p>
                {listError.text}
                {listError.needLogin && (
                  <>
                    {" "}
                    <Link href="/login">로그인하러 가기</Link>
                  </>
                )}
              </p>
              <button type="button" className="btn btn--secondary" onClick={() => void loadFirst()}>
                다시 불러오기
              </button>
            </div>
          )}

          {loadState === "ready" && entries.length === 0 && (
            <p className="empty">아직 쓴 일기가 없어요. 위에 오늘의 한 줄을 적어 보세요.</p>
          )}

          {entries.length > 0 && (
            <ul className="list__items">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <EntryCard
                    entry={entry}
                    highlighted={entry.id === newId}
                    onDelete={handleDelete}
                    onRetry={handleRetry}
                  />
                </li>
              ))}
            </ul>
          )}

          {loadState === "ready" && listError && (
            <p className="form__error" role="alert">
              {listError.text}
            </p>
          )}

          {nextCursor && (
            <div className="list__more">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "불러오는 중이에요..." : "더 보기"}
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
