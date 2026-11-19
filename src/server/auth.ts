import { isGoogleAuthConfigured } from "./env";

/**
 * 현재 로그인한 사용자 식별값을 돌려준다. 없으면 null(401).
 * 1단계 뼈대: 구글 값이 비어 있으면 개발용 모의 사용자를 쓴다(운영에서는 쓰지 않음).
 * 3단계에서 Auth.js 세션으로 교체한다.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isGoogleAuthConfigured()) {
    return process.env.NODE_ENV === "production" ? null : "dev-mock-user";
  }
  return null; // TODO(3단계): Auth.js 세션의 사용자 id
}
