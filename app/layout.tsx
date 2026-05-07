import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Radiology Workstation",
  description: "Teaching-oriented CT workstation prototype",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
