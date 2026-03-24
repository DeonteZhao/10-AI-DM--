"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminTokenFromBrowser } from "../AdminTokenBar";

type ModuleRow = {
  id: string;
  name: string;
  description: string;
  has_structured: boolean;
  schema_version: number | null;
};

export default function AdminModulesPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAdminTokenFromBrowser();
    const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    fetch(`/api/backend/admin/modules${query}`, {
      headers: token ? { "x-admin-token": token } : undefined
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((json) => setRows(json.data || []))
      .catch((e) => setError(e.message));
  }, [keyword]);

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-700 bg-red-950 p-4 text-red-200">{error}</div>}
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索模组ID或名称"
        className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 bg-slate-900 p-4">
            <div className="text-lg font-semibold text-amber-300">{row.name}</div>
            <div className="mt-1 text-xs text-slate-400">{row.id}</div>
            <p className="mt-2 line-clamp-3 text-sm text-slate-200">{row.description || "暂无描述"}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <span>{row.has_structured ? "已结构化" : "未结构化"}</span>
              <span>schema: {row.schema_version ?? "-"}</span>
            </div>
            <Link
              href={`/admin/modules/${row.id}/edit`}
              className="mt-3 inline-block rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
            >
              编辑结构化结果
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
