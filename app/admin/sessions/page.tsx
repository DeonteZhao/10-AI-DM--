"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminTokenFromBrowser } from "../AdminTokenBar";

type AdminSession = {
  id: string;
  user_id?: string;
  module_id: string;
  character_id: string;
  status: string;
  created_at: string;
};

export default function AdminSessionsPage() {
  const [rows, setRows] = useState<AdminSession[]>([]);
  const [moduleFilter, setModuleFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAdminTokenFromBrowser();
    const query = moduleFilter ? `?module_id=${encodeURIComponent(moduleFilter)}` : "";
    fetch(`/api/backend/admin/sessions${query}`, {
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
  }, [moduleFilter]);

  const moduleIds = useMemo(
    () => Array.from(new Set(rows.map((item) => item.module_id))).sort(),
    [rows]
  );

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-700 bg-red-950 p-4 text-red-200">{error}</div>}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300">模组过滤</span>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="">全部</option>
          {moduleIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="min-w-full bg-slate-900 text-sm">
          <thead className="bg-slate-800 text-left text-slate-200">
            <tr>
              <th className="px-4 py-3">会话ID</th>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">模组</th>
              <th className="px-4 py-3">角色</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800 text-slate-100">
                <td className="px-4 py-3">{row.id}</td>
                <td className="px-4 py-3">{row.user_id || "anonymous"}</td>
                <td className="px-4 py-3">{row.module_id}</td>
                <td className="px-4 py-3">{row.character_id}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.created_at || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
