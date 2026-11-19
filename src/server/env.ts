// 환경 변수는 이름으로만 읽는다. 값을 로그·응답에 내보내지 않는다.
// 구글 로그인 값 3개는 비어 있어도 앱이 뜬다.

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

function required(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`환경 변수 ${name}이(가) 설정되지 않았습니다.`);
  return v;
}

export const env = {
  /** DB 연결이 실제로 필요할 때만 호출한다. */
  databaseUrl: () => required("DATABASE_URL"),
  /** AI 호출이 실제로 필요할 때만 호출한다(서버 전용). */
  openRouterApiKey: () => required("OPENROUTER_API_KEY"),
  authSecret: () => read("AUTH_SECRET"),
  authGoogleId: () => read("AUTH_GOOGLE_ID"),
  authGoogleSecret: () => read("AUTH_GOOGLE_SECRET"),
};

/** 구글 로그인 값 3개가 모두 채워졌는지. 아니면 3단계 전까지 모의 사용자를 쓴다. */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.authSecret() && env.authGoogleId() && env.authGoogleSecret());
}
