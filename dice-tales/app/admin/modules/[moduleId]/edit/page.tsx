"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getAdminTokenFromBrowser } from "../../../AdminTokenBar";

export default function AdminModuleEditPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState("");

  const token = useMemo(() => getAdminTokenFromBrowser(), []);

  useEffect(() => {
    fetch(`/api/backend/admin/modules/${moduleId}`, {
      headers: token ? { "x-admin-token": token } : undefined
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((json) => {
        setJsonText(JSON.stringify(json.data.structured, null, 2));
        setStatus("已加载结构化结果");
      })
      .catch((e) => setStatus(`加载失败: ${e.message}`));
  }, [moduleId, token]);

  const handleSave = async () => {
    try {
      const payload = JSON.parse(jsonText);
      const res = await fetch(`/api/backend/admin/modules/${moduleId}/structured`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setStatus("保存成功");
    } catch (e) {
      setStatus(`保存失败: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-amber-300">{moduleId}</h2>
      <p className="text-sm text-slate-300">支持直接编辑结构化 JSON 并保存到后端。</p>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        className="h-[560px] w-full rounded border border-slate-700 bg-slate-900 p-4 font-mono text-sm text-slate-100"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-500"
        >
          保存结构化结果
        </button>
        <span className="text-sm text-slate-300">{status}</span>
      </div>
    </div>
  );
}
