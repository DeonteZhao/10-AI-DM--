"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sword, User, MagnifyingGlass, BookBookmark } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine current theme/mode
  let mode = "hub";
  if (pathname.startsWith("/dnd")) mode = "dnd";
  if (
    pathname.startsWith("/coc")
    || pathname.startsWith("/modules")
    || pathname.startsWith("/game")
    || pathname.startsWith("/character")
  ) {
    mode = "coc";
  }

  // Prevent hydration mismatch by not rendering anything on the server
  // that depends on the current path/mode which might change on the client
  if (!mounted) return null;

  // Show navbar on hub page, but with different styling
  const isHub = mode === "hub";

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  return (
    <nav className={`sticky top-0 z-[999] bg-[var(--bg-color)] px-10 py-4 transition-colors duration-500 ${isHub ? "border-b-[2px] border-[var(--ink-color)]" : "border-b-[2px] border-[var(--ink-color)]"}`}>
      <div className="flex w-full items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-2 transition-transform hover:-translate-y-0.5 group">
          <span className="font-huiwen text-2xl font-black uppercase tracking-[0.15em] text-[var(--ink-color)]" style={{ filter: "url(#rough-edge)" }}>
            {mode === "dnd" ? "DICE TALES // D&D 5E" : mode === "coc" ? "DICE TALES // COC 7TH" : "DICE TALES // HUB"}
          </span>
        </Link>
        
        <div className="flex items-center gap-8">
          {mode === "dnd" && (
            <>
              <Link
                href="/dnd/adventures"
                className={`flex items-center gap-2 px-1 py-2 font-bold transition-all ${
                  isActive("/dnd/adventures")
                    ? "text-[var(--accent-color)] border-b-[3px] border-[var(--accent-color)]"
                    : "text-[var(--ink-color)] border-b-[3px] border-transparent hover:text-[var(--accent-color)]"
                }`}
              >
                <Sword className="w-5 h-5" weight="bold" />
                <span className="font-huiwen uppercase tracking-[0.12em]">任务</span>
              </Link>
              <Link
                href="/dnd/characters"
                className={`flex items-center gap-2 px-1 py-2 font-bold transition-all ${
                  isActive("/dnd/characters")
                    ? "text-[var(--accent-color)] border-b-[3px] border-[var(--accent-color)]"
                    : "text-[var(--ink-color)] border-b-[3px] border-transparent hover:text-[var(--accent-color)]"
                }`}
              >
                <User className="w-5 h-5" weight="bold" />
                <span className="font-huiwen uppercase tracking-[0.12em]">名册</span>
              </Link>
            </>
          )}

          {mode === "coc" && (
            <>
              <Link
                href="/modules"
                className={`flex items-center gap-2 px-1 py-2 font-bold transition-all ${
                  isActive("/modules") || isActive("/coc/cases")
                    ? "text-[var(--accent-color)] border-b-[3px] border-[var(--accent-color)]"
                    : "text-[var(--ink-color)] border-b-[3px] border-transparent hover:text-[var(--accent-color)]"
                }`}
              >
                <BookBookmark className="w-5 h-5" weight="bold" />
                <span className="font-huiwen uppercase tracking-[0.12em]">机密</span>
              </Link>
              <Link
                href="/coc/characters"
                className={`flex items-center gap-2 px-1 py-2 font-bold transition-all ${
                  isActive("/coc/characters") || isActive("/character")
                    ? "text-[var(--accent-color)] border-b-[3px] border-[var(--accent-color)]"
                    : "text-[var(--ink-color)] border-b-[3px] border-transparent hover:text-[var(--accent-color)]"
                }`}
              >
                <MagnifyingGlass className="w-5 h-5" weight="bold" />
                <span className="font-huiwen uppercase tracking-[0.12em]">名录</span>
              </Link>
            </>
          )}

          {mode === "hub" && (
            <div className="font-bold text-[var(--ink-color)] uppercase text-xl font-huiwen font-black" style={{ filter: 'url(#rough-edge)', letterSpacing: '0.1em' }}>
              SYSTEM: ONLINE
            </div>
          )}

          {mode !== "hub" && (
            <div className="ml-2 flex items-center gap-3 border-l-[2px] border-[var(--ink-color)] pl-6">
              <button
                onClick={() => {
                  localStorage.removeItem('trpg_characters');
                  localStorage.removeItem('trpg_adventures');
                  window.location.href = '/';
                }}
                className="border border-[var(--ink-color)] px-3 py-1 font-vt323 text-xs uppercase tracking-[0.18em] text-[var(--ink-color)] transition-colors hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)]"
              >
                清除存档
              </button>
              <div className="flex h-8 w-8 items-center justify-center border border-[var(--ink-color)] bg-theme-bg">
                <User className="w-5 h-5 text-[var(--ink-color)]" weight="bold" />
              </div>
              <div className="text-right">
                <div className="font-vt323 text-[11px] uppercase tracking-[0.24em] text-[var(--ink-color)] opacity-70">Session Role</div>
                <span className="font-huiwen text-sm font-bold tracking-[0.12em] text-[var(--ink-color)]">{mode === "dnd" ? "玩家" : "守秘人"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
