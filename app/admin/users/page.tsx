"use client";

import { useEffect, useState } from "react";
import { getAdminTokenFromBrowser } from "../AdminTokenBar";

type AdminUser = {
  user_id: string;
  session_count: number;
  character_count: number;
  last_active_at: string;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAdminTokenFromBrowser();
    fetch("/api/backend/admin/users", {
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
  }, []);

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-700 bg-red-950 p-4 text-red-200">{error}</div>}
      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="min-w-full bg-slate-900 text-sm">
          <thead className="bg-slate-800 text-left text-slate-200">
            <tr>
              <th className="px-4 py-3">用户ID</th>
              <th className="px-4 py-3">会话数</th>
              <th className="px-4 py-3">角色数</th>
              <th className="px-4 py-3">最近活跃</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} className="border-t border-slate-800 text-slate-100">
                <td className="px-4 py-3">{row.user_id}</td>
                <td className="px-4 py-3">{row.session_count}</td>
                <td className="px-4 py-3">{row.character_count}</td>
                <td className="px-4 py-3">{row.last_active_at || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
