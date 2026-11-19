import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { isGoogleAuthConfigured } from "@/server/env";
import { DiaryApp } from "@/ui/components/DiaryApp";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  let userLabel: string | null = null;
  try {
    const session = await auth();
    userLabel = session?.user?.name ?? session?.user?.email ?? null;
    if (!session?.user && isGoogleAuthConfigured()) redirect("/login");
  } catch (e) {
    // redirect()는 예외로 동작하므로 그대로 다시 던진다.
    if (e && typeof e === "object" && "digest" in e) throw e;
    // 세션 확인이 실패해도 화면은 열고, 데이터 요청의 401 안내에 맡긴다.
  }
  if (!userLabel && !isGoogleAuthConfigured()) userLabel = "개발용 사용자";

  return <DiaryApp userLabel={userLabel} signOutAction={signOutAction} />;
}
