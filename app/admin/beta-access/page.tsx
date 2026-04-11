"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminTokenFromBrowser } from "../AdminTokenBar";

type BetaAccessSummary = {
  verified_total: number;
  waitlist_total: number;
  active_waitlist_total: number;
  verified_limit: number;
  recent_verified_at: string | null;
  recent_waitlist_at: string | null;
};

type VerifiedEmailRow = {
  email: string;
  is_verified: boolean;
  first_verified_at: string | null;
  last_verified_at: string | null;
  last_login_at: string | null;
  last_otp_requested_at: string | null;
  last_otp_sent_at: string | null;
  last_waitlist_at: string | null;
  waitlist_status: string | null;
  created_at: string;
  updated_at: string;
};

type WaitlistRow = {
  email: string;
  status: string;
  source_status: string | null;
  first_requested_at: string;
  last_requested_at: string;
  created_at: string;
  updated_at: string;
};

type AdminBetaAccessPayload = {
  summary: BetaAccessSummary;
  verified_emails: VerifiedEmailRow[];
  waitlist: WaitlistRow[];
};

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminBetaAccessPage() {
  const [data, setData] = useState<AdminBetaAccessPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAdminTokenFromBrowser();
    fetch("/api/backend/admin/beta-access", {
      headers: token ? { "x-admin-token": token } : undefined,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((json) => setData(json.data))
      .catch((nextError) => setError((nextError as Error).message));
  }, []);

  const cards = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { title: "已验证邮箱", value: `${data.summary.verified_total} / ${data.summary.verified_limit}` },
      { title: "Waitlist 总数", value: data.summary.waitlist_total },
      { title: "活跃 Waitlist", value: data.summary.active_waitlist_total },
      { title: "最近验证", value: formatTime(data.summary.recent_verified_at) },
    ];
  }, [data]);

  if (error) {
    return <div className="rounded border border-red-700 bg-red-950 p-4 text-red-200">{error}</div>;
  }

  if (!data) {
    return <div className="text-slate-300">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded border border-slate-700 bg-slate-900 p-4">
            <div className="text-sm text-slate-300">{card.title}</div>
            <div className="mt-2 text-2xl font-bold text-amber-400">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
        最近 waitlist 登记：{formatTime(data.summary.recent_waitlist_at)}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">已验证邮箱</h2>
          <span className="text-sm text-slate-400">{data.verified_emails.length} 条</span>
        </div>
        <div className="overflow-x-auto rounded border border-slate-700">
          <table className="min-w-full bg-slate-900 text-sm">
            <thead className="bg-slate-800 text-left text-slate-200">
              <tr>
                <th className="px-4 py-3">邮箱</th>
                <th className="px-4 py-3">首次验证</th>
                <th className="px-4 py-3">最近验证</th>
                <th className="px-4 py-3">最近登录</th>
                <th className="px-4 py-3">最近发码</th>
                <th className="px-4 py-3">Waitlist 状态</th>
              </tr>
            </thead>
            <tbody>
              {data.verified_emails.length === 0 && (
                <tr className="border-t border-slate-800 text-slate-400">
                  <td className="px-4 py-6" colSpan={6}>暂无已验证邮箱</td>
                </tr>
              )}
              {data.verified_emails.map((row) => (
                <tr key={row.email} className="border-t border-slate-800 text-slate-100">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">{formatTime(row.first_verified_at)}</td>
                  <td className="px-4 py-3">{formatTime(row.last_verified_at)}</td>
                  <td className="px-4 py-3">{formatTime(row.last_login_at)}</td>
                  <td className="px-4 py-3">{formatTime(row.last_otp_sent_at)}</td>
                  <td className="px-4 py-3">{row.waitlist_status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Waitlist</h2>
          <span className="text-sm text-slate-400">{data.waitlist.length} 条</span>
        </div>
        <div className="overflow-x-auto rounded border border-slate-700">
          <table className="min-w-full bg-slate-900 text-sm">
            <thead className="bg-slate-800 text-left text-slate-200">
              <tr>
                <th className="px-4 py-3">邮箱</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">来源</th>
                <th className="px-4 py-3">首次登记</th>
                <th className="px-4 py-3">最近登记</th>
                <th className="px-4 py-3">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {data.waitlist.length === 0 && (
                <tr className="border-t border-slate-800 text-slate-400">
                  <td className="px-4 py-6" colSpan={6}>暂无 waitlist 记录</td>
                </tr>
              )}
              {data.waitlist.map((row) => (
                <tr key={row.email} className="border-t border-slate-800 text-slate-100">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.source_status || "-"}</td>
                  <td className="px-4 py-3">{formatTime(row.first_requested_at)}</td>
                  <td className="px-4 py-3">{formatTime(row.last_requested_at)}</td>
                  <td className="px-4 py-3">{formatTime(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
