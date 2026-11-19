import type { Metadata } from "next";
import { signInWithGoogle } from "../actions";

export const metadata: Metadata = { title: "로그인 - AI 공감 다이어리" };

export default function LoginPage() {
  return (
    <main id="main" className="page page--narrow" tabIndex={-1}>
      <h1 className="page__title">AI 공감 다이어리</h1>
      <p className="page__lead">
        오늘 있었던 일을 한 줄로 쓰면 AI가 따뜻하게 공감해 드려요. 내 일기는 내 계정으로만 볼 수
        있어요.
      </p>
      <div className="card login">
        <form action={signInWithGoogle}>
          <button type="submit" className="btn btn--primary btn--block">
            구글로 시작하기
          </button>
        </form>
        <p className="muted">구글 계정으로 로그인하면 바로 일기를 쓸 수 있어요.</p>
      </div>
    </main>
  );
}
