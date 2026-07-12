"use client";

import { Activity, AlertCircle, Bot, ChevronRight, ExternalLink, RefreshCw, Search, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type TraceRow = {
  id: string;
  startTime: string;
  type: string;
  name: string;
  traceName: string;
  input: unknown;
  output: unknown;
  latencyMs?: number;
  totalCost?: number;
  environment?: string;
  url?: string;
};

type TraceResponse = {
  data: TraceRow[];
  source: "langfuse" | "demo";
  configured: boolean;
  message?: string;
};

const typeStyle: Record<string, string> = {
  GENERATION: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  SPAN: "bg-orange-50 text-orange-700 border-orange-200",
  AGENT: "bg-violet-50 text-violet-700 border-violet-200",
  EVENT: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function LangfuseTracing() {
  const [result, setResult] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/langfuse/traces", { cache: "no-store" });
      if (!response.ok) throw new Error("Không tải được dữ liệu tracing");
      setResult(await response.json());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu tracing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return result?.data || [];
    return (result?.data || []).filter((row) =>
      [row.name, row.traceName, row.type, preview(row.input), preview(row.output)]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, result]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-[#13253d]">Langfuse Tracing</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Inspect each query step, tool call, latency, and model cost.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {!result?.configured && !loading && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>Đang dùng dữ liệu demo.</strong> Thêm LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY và LANGFUSE_PROJECT_ID vào môi trường để hiển thị traces thật.</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus-within:ring-2 focus-within:ring-[#8bb6f0]">
          <Search className="h-4 w-4" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-slate-800 outline-none" placeholder="Search name, type, input or output..." />
        </label>
        <span className="text-xs text-slate-500">Past 7 days · {rows.length} observations</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <div className="m-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : (
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{["Start time", "Type", "Name", "Trace name", "Input", "Output", "Latency", "Cost", ""].map((label) => <th key={label} className="border-b border-slate-200 px-4 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !result ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-500">Đang tải traces...</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id} className="group hover:bg-[#f8fbff]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{formatDate(row.startTime)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold ${typeStyle[row.type] || "border-slate-200 bg-slate-50 text-slate-600"}`}>{row.type === "GENERATION" ? <Bot className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}{row.type}</span></td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-semibold text-slate-700">{row.name}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">{row.traceName}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-slate-500" title={preview(row.input, 1000)}>{preview(row.input)}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-slate-500" title={preview(row.output, 1000)}>{preview(row.output)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{row.latencyMs == null ? "—" : `${row.latencyMs} ms`}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{row.totalCost == null ? "—" : `$${row.totalCost.toFixed(5)}`}</td>
                  <td className="px-4 py-3">{row.url ? <a href={row.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#1f5fbf] hover:underline">Open <ExternalLink className="h-3 w-3" /></a> : <ChevronRight className="h-4 w-4 text-slate-300" />}</td>
                </tr>
              )) : <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-500">Không tìm thấy trace phù hợp.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function preview(value: unknown, max = 120) {
  if (value == null) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}
