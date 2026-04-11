"use client";

import { useEffect, useState } from "react";
import { getAdminTokenFromBrowser } from "./AdminTokenBar";

type StatsData = {
  module_count: number;
  structured_module_count: number;
  character_count: number;
  session_count: number;
  recent_session_at: string | null;
};

export default function AdminHomePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAdminTokenFromBrowser();
    fetch("/api/backend/admin/stats", {
      headers: token ? { "x-admin-token": token } : undefined
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((json) => setStats(json.data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="rounded border border-red-700 bg-red-950 p-4 text-red-200">{error}</div>;
  }

  if (!stats) {
    return <div className="text-slate-300">加载中...</div>;
  }

  const cards = [
    { title: "模组总数", value: stats.module_count },
    { title: "结构化模组", value: stats.structured_module_count },
    { title: "角色总数", value: stats.character_count },
    { title: "会话总数", value: stats.session_count }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded border border-slate-700 bg-slate-900 p-4">
            <div className="text-sm text-slate-300">{card.title}</div>
            <div className="mt-2 text-3xl font-bold text-amber-400">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
        最近会话时间：{stats.recent_session_at || "暂无"}
      </div>
    </div>
  );
}
