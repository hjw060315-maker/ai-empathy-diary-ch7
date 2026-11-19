// Auth.js 라우트(서버 구역). 로그인·로그아웃·세션 요청을 처리한다.
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;
