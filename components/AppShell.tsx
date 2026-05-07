"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navItems = [
    { href: "/worklist", label: "Worklist" },
    { href: "/workstation/study-ct-001", label: "Workstation" },
    { href: "/reports/study-ct-001", label: "Reports" },
    { href: "/research", label: "Research" },
    { href: "/ct-sandbox", label: "CT Sandbox" },
    { href: "/viewer-lab/ct-stack", label: "Viewer Lab" },
  ];

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <div className="brand">AI Radiology Workstation</div>
          <div className="tiny">教学导向最小原型：先讲清工作站结构，再逐步替换成真 viewer / 真 DICOM。</div>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
