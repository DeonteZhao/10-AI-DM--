"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sword, User, House, MagnifyingGlass, BookBookmark } from "@phosphor-icons/react";
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
  if (pathname.startsWith("/coc")) mode = "coc";

  // Prevent hydration mismatch by not rendering anything on the server
  // that depends on the current path/mode which might change on the client
  if (!mounted) return null;

// Show navbar on hub page, but with different styling
  const isHub = mode === "hub";

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  return (
    <nav className={`px-10 py-4 flex justify-between items-center sticky top-0 z-[999] transition-colors duration-500 bg-[var(--bg-color)] relative ${isHub ? 'border-b-[3px] border-[var(--ink-color)]' : 'border-b-[3px] border-[var(--ink-color)] shadow-[0_4px_0_var(--ink-color)]'}`}>
      <div className="w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:-translate-y-0.5 transition-transform group">
          <span className="text-[var(--ink-color)] font-black text-2xl tracking-widest uppercase font-huiwen" style={{ filter: 'url(#rough-edge)', letterSpacing: '0.15em' }}>
            {mode === "dnd" ? "DICE TALES // D&D 5E" : mode === "coc" ? "DICE TALES // COC 7TH" : "DICE TALES // HUB"}
          </span>
        </Link>
        
        <div className="flex items-center gap-4">
          {mode === "dnd" && (
            <>
              <Link
                href="/dnd/adventures"
                className={`flex items-center gap-2 px-4 py-2 font-bold transition-all ${
                  isActive("/dnd/adventures")
                    ? "bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]"
                    : "text-[var(--ink-color)] border-[3px] border-transparent hover:border-[var(--ink-color)] hover:shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:bg-[var(--paper-light)]"
                }`}
              >
                <Sword className="w-5 h-5" weight="bold" />
                <span className="font-huiwen" style={{ letterSpacing: '0.1em' }}>任务</span>
              </Link>
              <Link
                href="/dnd/characters"
                className={`flex items-center gap-2 px-4 py-2 font-bold transition-all ${
                  isActive("/dnd/characters")
                    ? "bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]"
                    : "text-[var(--ink-color)] border-[3px] border-transparent hover:border-[var(--ink-color)] hover:shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:bg-[var(--paper-light)]"
                }`}
              >
                <User className="w-5 h-5" weight="bold" />
                <span className="font-huiwen" style={{ letterSpacing: '0.1em' }}>名册</span>
              </Link>
            </>
          )}

          {mode === "coc" && (
            <>
              <Link
                href="/coc/cases"
                className={`flex items-center gap-2 px-4 py-2 font-bold transition-all ${
                  isActive("/coc/cases")
                    ? "bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]"
                    : "text-[var(--ink-color)] border-[3px] border-transparent hover:border-[var(--ink-color)] hover:shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:bg-[var(--paper-light)]"
                }`}
              >
                <BookBookmark className="w-5 h-5" weight="bold" />
                <span className="font-huiwen" style={{ letterSpacing: '0.1em' }}>机密</span>
              </Link>
              <Link
                href="/coc/characters"
                className={`flex items-center gap-2 px-4 py-2 font-bold transition-all ${
                  isActive("/coc/characters")
                    ? "bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]"
                    : "text-[var(--ink-color)] border-[3px] border-transparent hover:border-[var(--ink-color)] hover:shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)]"
                }`}
              >
                <MagnifyingGlass className="w-5 h-5" weight="bold" />
                <span className="font-huiwen" style={{ letterSpacing: '0.1em' }}>名录</span>
              </Link>
            </>
          )}

          {mode === "hub" && (
            <div className="font-bold text-[var(--ink-color)] uppercase text-xl font-huiwen font-black" style={{ filter: 'url(#rough-edge)', letterSpacing: '0.1em' }}>
              SYSTEM: ONLINE
            </div>
          )}

          {mode !== "hub" && (
            <div className="flex items-center gap-3 ml-4 pl-6 border-l-[3px] border-[var(--ink-color)] h-8 riso-border" style={{ borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
              <button
                onClick={() => {
                  localStorage.removeItem('trpg_characters');
                  localStorage.removeItem('trpg_adventures');
                  window.location.href = '/';
                }}
                className="text-xs font-bold text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-2 py-1 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-huiwen"
                style={{ letterSpacing: '0.1em' }}
              >
                清除存档
              </button>
              <div className="w-8 h-8 bg-theme-bg border-[3px] border-[var(--ink-color)] flex items-center justify-center shadow-[2px_2px_0_var(--ink-color)]">
                <User className="w-5 h-5 text-[var(--ink-color)]" weight="bold" />
              </div>
              <span className="text-sm font-bold text-[var(--ink-color)] tracking-wider font-huiwen" style={{ letterSpacing: '0.1em' }}>
                {mode === "dnd" ? "玩家" : "守秘人"}
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}