"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EMOTION_LABELS, type Entry } from "@/shared/types";
import { formatKoreanDateTime } from "@/ui/format";
import { ApiClientError } from "@/ui/api-client";
import { CrisisBox } from "./CrisisBox";

interface Props {
  entry: Entry;
  highlighted?: boolean;
  onDelete: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<Entry>;
}

function messageOf(e: unknown): string {
  return e instanceof ApiClientError ? e.message : "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

export function EntryCard({ entry, highlighted, onDelete, onRetry }: Props) {
  const titleId = useId();
  const crisisId = useId();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"delete" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const done = entry.empathyStatus === "done" && entry.emotion && entry.intensity;

  async function handleDelete() {
    setBusy("delete");
    setError(null);
    try {
      await onDelete(entry.id);
    } catch (e) {
      setError(messageOf(e));
      setBusy(null);
      setConfirming(false);
      deleteBtnRef.current?.focus();
    }
  }

  async function handleRetry() {
    setBusy("retry");
    setError(null);
    try {
      const updated = await onRetry(entry.id);
      if (updated.empathyStatus === "pending") {
        setError("이번에도 공감 메시지를 만들지 못했어요. 잠시 후 다시 눌러 주세요.");
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={`entry${highlighted ? " entry--new" : ""}${entry.isCrisis ? " entry--crisis" : ""}`}
      aria-labelledby={titleId}
      data-entry-id={entry.id}
    >
      <header className="entry__head">
        <h3 id={titleId} className="entry__time">
          {highlighted && <span className="entry__badge">방금 쓴 일기</span>}
          <time dateTime={entry.createdAt}>{formatKoreanDateTime(entry.createdAt)}</time>
        </h3>
        {done && (
          <p className={`mood mood--${entry.emotion}`}>
            <span className="mood__label">
              <span className="sr-only">감정: </span>
              {EMOTION_LABELS[entry.emotion!]}
            </span>
            <span
              className="mood__level"
              role="img"
              aria-label={`강도 5단계 중 ${entry.intensity}단계`}
            >
              <span aria-hidden="true">
                강도 {entry.intensity}
                <span className="mood__dots">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= entry.intensity! ? "dot dot--on" : "dot"} />
                  ))}
                </span>
              </span>
            </span>
          </p>
        )}
      </header>

      <p className="entry__content">{entry.content}</p>

      {done ? (
        <div className="entry__empathy">
          <p className="entry__empathy-label">AI의 공감 한마디</p>
          <p className="entry__empathy-text">{entry.empathyMessage}</p>
        </div>
      ) : (
        <div className="notice" role="group" aria-label="공감 메시지 대기 중">
          <p>
            일기는 잘 저장되었어요. 공감 메시지를 지금 만들지 못했어요. 잠시 후 다시 받아 볼 수
            있어요.
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleRetry}
            disabled={busy !== null}
          >
            {busy === "retry" ? "다시 받는 중이에요..." : "다시 받기"}
          </button>
        </div>
      )}

      {entry.isCrisis && <CrisisBox id={crisisId} />}

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <footer className="entry__foot">
        {confirming ? (
          <div className="confirm" role="group" aria-label="삭제 확인">
            <p className="confirm__text">
              정말 삭제할까요? 삭제한 일기는 되돌릴 수 없어요.
            </p>
            <div className="confirm__buttons">
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDelete}
                disabled={busy !== null}
              >
                {busy === "delete" ? "지우는 중이에요..." : "네, 삭제할게요"}
              </button>
              <button
                ref={cancelRef}
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setConfirming(false);
                  deleteBtnRef.current?.focus();
                }}
                disabled={busy !== null}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={deleteBtnRef}
            type="button"
            className="btn btn--ghost"
            onClick={() => setConfirming(true)}
            aria-label={`${formatKoreanDateTime(entry.createdAt)} 일기 삭제`}
          >
            삭제
          </button>
        )}
      </footer>
    </article>
  );
}
