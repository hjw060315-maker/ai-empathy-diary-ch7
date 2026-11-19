// Next.js 16의 proxy(예전 middleware). 로그인하지 않았으면 페이지 요청을 /login으로 보낸다.
// API(/api/*)는 각 라우트가 401로 답하므로 제외한다. 구글 값이 비고 개발 중이면 막지 않는다(모의 사용자).
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { isGoogleAuthConfigured } from "@/server/env";

export default auth((req) => {
  if (!isGoogleAuthConfigured() && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  // 로그인 화면, API, Next 내부 파일, 정적 파일은 제외
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
