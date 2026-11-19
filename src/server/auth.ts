// Auth.js(next-auth v5) 구글 로그인. 화면은 아래 export 이름만 쓴다.
//   signIn("google", { redirectTo: "/" }), signOut({ redirectTo: "/login" })
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env, isGoogleAuthConfigured } from "./env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.authSecret(),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: env.authGoogleId(),
      clientSecret: env.authGoogleSecret(),
    }),
  ],
  callbacks: {
    // 구글 계정 id(sub, 바뀌지 않는 값)를 토큰의 sub에 고정해 둔다.
    jwt({ token, account }) {
      if (account?.provider === "google" && account.providerAccountId) {
        token.sub = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/**
 * 현재 로그인한 사용자 식별값(구글 계정 id)을 돌려준다. 없으면 null(401).
 * 구글 값이 비어 있으면 개발에서는 모의 사용자, 운영에서는 null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isGoogleAuthConfigured()) {
    return process.env.NODE_ENV === "production" ? null : "dev-mock-user";
  }
  try {
    const session = await auth();
    const id = session?.user?.id;
    return id ? `google:${id}` : null;
  } catch {
    return null;
  }
}
