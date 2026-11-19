// 실제 OpenRouter 호출 점검. 실행: node --env-file=.env scripts/check-ai.mjs
// src/ai가 "@/" 경로 별칭을 쓰므로 node의 타입 제거 실행으로는 불러올 수 없다.
// 그래서 이미 설치된 vite로 src/ai/index.ts를 임시 폴더에 번들한 뒤 불러온다(별도 설정 파일 불필요).
// 출력: 감정·강도·메시지 길이·응답 모델·소요 시간뿐. 키와 일기·메시지 본문은 출력하지 않는다.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");

// 개인정보 없는 예시 문장
const SAMPLES = [
  { label: "기쁨 계열", text: "오늘 시험을 잘 봐서 정말 기뻤다. 친구들과 맛있는 걸 먹으며 웃었다." },
  { label: "불안 계열", text: "내일 발표가 걱정돼서 잠이 안 온다. 실수할까 봐 계속 마음이 불안하다." },
  { label: "일반 문장", text: "점심에 국수를 먹고 도서관에서 책을 조금 읽었다. 저녁에는 산책을 했다." },
];

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.error("OPENROUTER_API_KEY가 설정되지 않았습니다. `node --env-file=.env scripts/check-ai.mjs`로 실행하세요.");
  process.exit(1);
}

const outDir = await mkdtemp(join(tmpdir(), "check-ai-"));
try {
  await build({
    root,
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": join(root, "src") } },
    build: {
      ssr: join(root, "src/ai/index.ts"),
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { format: "es", entryFileNames: "ai.mjs" } },
    },
    ssr: { noExternal: true },
  });

  const ai = await import(pathToFileURL(join(outDir, "ai.mjs")).href);

  // 어느 모델이 답했는지 알기 위해 fetch 응답의 model 이름만 기록한다(본문은 건드리지 않음).
  const realFetch = globalThis.fetch;
  let lastModel = "-";
  globalThis.fetch = async (input, init) => {
    try {
      lastModel = JSON.parse(init?.body ?? "{}").model ?? "-";
    } catch {
      lastModel = "-";
    }
    return realFetch(input, init);
  };

  let failed = 0;
  for (const s of SAMPLES) {
    const started = performance.now();
    lastModel = "-";
    try {
      const r = await ai.analyzeDiary(s.text);
      const sec = ((performance.now() - started) / 1000).toFixed(1);
      console.log(
        `[${s.label}] 감정=${r.emotion} 강도=${r.intensity} 메시지길이=${r.message.length}자 위기=${r.isCrisis} 응답모델=${lastModel} 소요=${sec}초`,
      );
    } catch (e) {
      failed++;
      const sec = ((performance.now() - started) / 1000).toFixed(1);
      console.log(`[${s.label}] 실패(${e instanceof Error ? e.name : "unknown"}) 마지막시도모델=${lastModel} 소요=${sec}초`);
    }
  }
  console.log(`기본 모델: ${ai.PRIMARY_MODEL} / 대체 모델: ${ai.FALLBACK_MODEL}`);
  console.log(failed === 0 ? "점검 통과" : `점검 실패 ${failed}/${SAMPLES.length}`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  await rm(outDir, { recursive: true, force: true });
}
