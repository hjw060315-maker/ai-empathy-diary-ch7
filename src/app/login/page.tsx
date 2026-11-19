import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "로그인 - AI 공감 다이어리" };

// 자리만 만든 화면. 구글 로그인은 3단계(Auth.js)에서 연결한다.
export default function LoginPage() {
  return (
    <main id="main" className="page page--narrow" tabIndex={-1}>
      <h1 className="page__title">AI 공감 다이어리</h1>
      <p className="page__lead">
        오늘 있었던 일을 한 줄로 쓰면 AI가 따뜻하게 공감해 드려요. 내 일기는 내 계정으로만 볼 수
        있어요.
      </p>
      <div className="card login">
        <button type="button" className="btn btn--primary btn--block" disabled aria-describedby="login-help">
          구글로 시작하기
        </button>
        <p id="login-help" className="muted">
          구글 로그인은 곧 연결돼요. 지금은 준비 중이라 누를 수 없어요.
        </p>
        <Link className="login__back" href="/">
          일기장 화면 미리 보기
        </Link>
      </div>
    </main>
  );
}
