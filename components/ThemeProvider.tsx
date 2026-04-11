"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let theme = "hub";
    if (pathname.startsWith("/dnd")) {
      theme = "dnd";
    } else if (pathname.startsWith("/coc")) {
      theme = "coc";
    }
    
    // Only set theme if not already set by hover interaction on hub page
    const currentTheme = document.body.getAttribute("data-theme");
    if (pathname !== "/" || currentTheme === null || !["dnd", "coc"].includes(currentTheme)) {
      document.body.setAttribute("data-theme", theme);
    }
  }, [pathname]);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}