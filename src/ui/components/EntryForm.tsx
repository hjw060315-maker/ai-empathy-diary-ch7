"use client";

import { useId, useState, type FormEvent } from "react";
import { MAX_CONTENT_LENGTH } from "@/shared/constants";
import { countContent } from "@/ui/format";

interface Props {
  submitting: boolean;
  /** 서버가 돌려준 오류 문장 */
  serverError: string | null;
  /** 저장 성공이면 true (입력칸을 비운다) */
  onSubmit: (content: string) => Promise<boolean>;
}

export function EntryForm({ submitting, serverError, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [touchedEmpty, setTouchedEmpty] = useState(false);
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const noticeId = useId();

  const count = countContent(text);
  const tooLong = count > MAX_CONTENT_LENGTH;
  const error = tooLong
    ? `${MAX_CONTENT_LENGTH}자까지 쓸 수 있어요. ${count - MAX_CONTENT_LENGTH}자만 줄여 주세요.`
    : touchedEmpty && count === 0
      ? "일기를 한 줄 적어 주세요. 짧아도 괜찮아요."
      : serverError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (count === 0) {
      setTouchedEmpty(true);
      document.getElementById(inputId)?.focus();
      return;
    }
    if (tooLong) {
      document.getElementById(inputId)?.focus();
      return;
    }
    const ok = await onSubmit(text.trim());
    if (ok) {
      setText("");
      setTouchedEmpty(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <label className="form__label" htmlFor={inputId}>
        오늘 있었던 일을 한 줄로 적어 보세요
      </label>
      <textarea
        id={inputId}
        className="form__input"
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (touchedEmpty) setTouchedEmpty(false);
        }}
        aria-describedby={`${helpId} ${noticeId}${error ? ` ${errorId}` : ""}`}
        aria-invalid={error ? true : undefined}
        placeholder="예: 오늘 발표를 무사히 마쳤다."
        disabled={submitting}
      />
      <div className="form__row">
        <p id={helpId} className={`form__count${tooLong ? " form__count--over" : ""}`}>
          <span className="sr-only">현재 글자 수 </span>
          {count} / {MAX_CONTENT_LENGTH}자
        </p>
        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "분석 중이에요..." : "일기 저장하기"}
        </button>
      </div>
      {error && (
        <p id={errorId} className="form__error" role="alert">
          {error}
        </p>
      )}
      <p id={noticeId} className="form__notice">
        작성한 일기는 AI 분석을 위해 외부 무료 모델로 전달됩니다. 일기는 내 계정에만 저장되고,
        언제든 직접 삭제할 수 있어요. 다만 외부 모델에 전달된 내용까지는 이 앱이 지울 수 없어요.
      </p>
    </form>
  );
}
