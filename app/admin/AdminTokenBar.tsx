"use client";

import { useEffect, useState } from "react";

const TOKEN_KEY = "dice_tales_admin_api_token";

export function getAdminTokenFromBrowser() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export default function AdminTokenBar() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = getAdminTokenFromBrowser();
    setToken(current);
  }, []);

  const handleSave = () => {
    window.localStorage.setItem(TOKEN_KEY, token.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="flex items-center gap-3 rounded border border-slate-700 bg-slate-800 p-3">
      <span className="text-xs text-slate-300">ADMIN_API_TOKEN</span>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="可留空（后端未配置令牌时）"
        className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
      />
      <button
        onClick={handleSave}
        className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
      >
        保存
      </button>
      {saved && <span className="text-xs text-emerald-400">已保存</span>}
    </div>
  );
}
