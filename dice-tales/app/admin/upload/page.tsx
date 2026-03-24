/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

export default function AdminUploadPage() {
  const [moduleId, setModuleId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [difyApiKey, setDifyApiKey] = useState("");
  const [difyApiUrl, setDifyApiUrl] = useState("https://api.dify.ai/v1");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!moduleId || !file) {
      alert("请填写 Module ID 并选择文件");
      return;
    }
    if (!difyApiKey) {
      alert("请输入 Dify Workflow API Key");
      return;
    }

    setStatus("正在上传文件到 Dify...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user", "admin");

      const uploadRes = await fetch(`${difyApiUrl}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${difyApiKey}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(`文件上传失败: ${uploadRes.statusText}`);
      }

      const uploadData = await uploadRes.json();
      const fileId = uploadData.id;

      setStatus(`文件上传成功 (ID: ${fileId})，正在运行 Workflow...`);

      const workflowRes = await fetch(`${difyApiUrl}/workflows/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${difyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            module_id: moduleId,
            file: {
              type: "document",
              transfer_method: "local_file",
              upload_file_id: fileId,
            },
            "sys.query": "解析文本为标准json结构",
          },
          response_mode: "blocking",
          user: "admin",
        }),
      });

      if (!workflowRes.ok) {
        const errorText = await workflowRes.text();
        throw new Error(`Workflow 运行失败 (${workflowRes.status}): ${errorText}`);
      }

      const workflowData = await workflowRes.json();
      if (workflowData.data.status !== 'succeeded') {
          throw new Error(`Workflow 执行失败 (${workflowData.data.status}): ${workflowData.data.error || '请检查 Dify 日志'}`);
      }

      setResult(workflowData.data.outputs);
      setStatus("✅ Workflow 运行成功！结果已由 Dify 自动存入后端。");

    } catch (e: any) {
      console.error(e);
      setStatus(`❌ 错误: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4">
        <div className="space-y-4 rounded border border-slate-700 bg-slate-900 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Dify API URL
            </label>
            <input
              type="text"
              value={difyApiUrl}
              onChange={(e) => setDifyApiUrl(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Dify Workflow API Key
            </label>
            <input
              type="password"
              value={difyApiKey}
              onChange={(e) => setDifyApiKey(e.target.value)}
              placeholder="app-..."
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Module ID (唯一标识)
            </label>
            <input
              type="text"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              placeholder="e.g., coc_the_haunting"
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              模组文件 (PDF, Word)
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="w-full text-slate-300 file:mr-4 file:rounded file:border-0 file:bg-amber-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-amber-500"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={status.includes("正在")}
            className={`w-full py-3 px-4 rounded font-bold transition-colors ${
              status.includes("正在")
                ? "cursor-not-allowed bg-slate-700"
                : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            {status.includes("正在") ? "处理中..." : "开始上传与解析"}
          </button>

          {status && (
            <div className={`rounded p-4 ${status.includes("❌") ? "bg-red-950 text-red-200" : "bg-emerald-950 text-emerald-200"}`}>
              {status}
            </div>
          )}
        </div>

        {result && (
          <div className="rounded border border-slate-700 bg-slate-900 p-6">
            <h2 className="mb-4 text-xl font-bold text-amber-400">解析结果预览</h2>
            <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
    </div>
  );
}
