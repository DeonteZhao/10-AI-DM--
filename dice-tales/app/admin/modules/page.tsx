"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminTokenFromBrowser } from "../AdminTokenBar";

type ModuleRow = {
  id: string;
  name: string;
  description: string;
  has_structured: boolean;
  has_draft: boolean;
  schema_version: number | null;
  status: string;
  draft_updated_at?: string | null;
  version_count: number;
  latest_import?: {
    task_id: string;
    status: string;
    status_label: string;
    stage_label: string;
    result_source_label?: string | null;
    error_label?: string | null;
    output_summary?: string | null;
    updated_at: string;
  } | null;
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>{row.has_structured ? "已结构化" : "未结构化"}</span>
              <span>{row.has_draft ? "有草稿" : "无草稿"}</span>
              <span>schema: {row.schema_version ?? "-"}</span>
              <span>版本: {row.version_count}</span>
              {row.latest_import && <span>导入: {row.latest_import.status_label}</span>}
            </div>
            {row.draft_updated_at && (
              <div className="mt-2 text-xs text-slate-400">草稿更新时间：{row.draft_updated_at}</div>
            )}
            {row.latest_import && (
              <div className="mt-2 rounded bg-slate-950 px-3 py-2 text-xs text-slate-300">
                <div>{row.latest_import.stage_label}</div>
                <div className="mt-1 text-slate-400">
                  来源：{row.latest_import.result_source_label || "-"} · 最近更新：{row.latest_import.updated_at}
                </div>
                {row.latest_import.error_label && (
                  <div className="mt-1 text-red-300">失败来源：{row.latest_import.error_label}</div>
                )}
                {row.latest_import.output_summary && (
                  <div className="mt-1 text-slate-400">{row.latest_import.output_summary}</div>
                )}
              </div>
            )}
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
