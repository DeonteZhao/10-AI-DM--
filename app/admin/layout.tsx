import Link from "next/link";
import type { ReactNode } from "react";
import AdminTokenBar from "./AdminTokenBar";

const navItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/users", label: "用户" },
  { href: "/admin/beta-access", label: "内测准入" },
  { href: "/admin/sessions", label: "会话" },
  { href: "/admin/modules", label: "模组编辑" },
  { href: "/admin/upload", label: "导入模组" }
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-amber-400">Dice Tales 管理后台</h1>
            <Link href="/" className="text-sm text-slate-300 hover:text-white">
              返回前台
            </Link>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <AdminTokenBar />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
