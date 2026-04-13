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
  const getNavLinkClassName = (active: boolean) =>
    `riso-nav-link flex items-center gap-2 px-3 py-2 font-bold uppercase tracking-[0.12em] outline-none ${active ? "text-[var(--accent-color)]" : "text-[var(--ink-color)]"}`;

  return (
    <nav className={`sticky top-0 z-[999] bg-[var(--bg-color)] px-10 py-4 transition-colors duration-500 ${isHub ? "border-b-[2px] border-[var(--ink-color)]" : "border-b-[2px] border-[var(--ink-color)]"}`}>
      <div className="flex w-full items-center justify-between gap-8">
        <Link href="/" className="riso-nav-link flex items-center gap-2 px-3 py-2 font-bold outline-none group">
          <span className="font-huiwen text-2xl font-black uppercase tracking-[0.15em] text-[var(--ink-color)]" style={{ filter: "url(#rough-edge)" }}>
            {mode === "dnd" ? "DICE TALES // D&D 5E" : mode === "coc" ? "DICE TALES // COC 7TH" : "DICE TALES // HUB"}
          </span>
        </Link>
        
        <div className="flex items-center gap-8">
          {mode === "dnd" && (
            <>
              <Link
                href="/dnd/adventures"
                className={getNavLinkClassName(isActive("/dnd/adventures"))}
                data-active={isActive("/dnd/adventures")}
              >
                <Sword className="w-5 h-5" weight="bold" />
                <span className="font-huiwen uppercase tracking-[0.12em]">任务</span>
              </Link>
              <Link
                href="/dnd/characters"
                className={getNavLinkClassName(isActive("/dnd/characters"))}
                data-active={isActive("/dnd/characters")}
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
                className={getNavLinkClassName(isActive("/modules") || isActive("/coc/cases"))}
                data-active={isActive("/modules") || isActive("/coc/cases")}
              >
                <BookBookmark className="w-5 h-5" weight="bold" />
                <span className="font-huiwen uppercase tracking-[0.12em]">机密</span>
              </Link>
              <Link
                href="/coc/characters"
                className={getNavLinkClassName(isActive("/coc/characters") || isActive("/character"))}
                data-active={isActive("/coc/characters") || isActive("/character")}
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
              <div className="flex h-10 w-10 items-center justify-center border-2 border-[var(--ink-color)] bg-[var(--paper-light)] shadow-[3px_3px_0_rgba(31,32,65,0.55)]">
                <User className="w-5 h-5 text-[var(--ink-color)]" weight="bold" />
              </div>
              <div className="riso-panel-soft px-4 py-2 text-right">
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
