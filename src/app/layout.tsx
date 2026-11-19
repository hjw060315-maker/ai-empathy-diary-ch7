import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 공감 다이어리",
  description: "오늘 있었던 일을 한 줄로 쓰면 AI가 공감해 주는 일기장",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
