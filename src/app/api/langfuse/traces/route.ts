import { NextResponse } from "next/server";

type Observation = {
  id: string;
  traceId: string;
  startTime: string;
  endTime?: string;
  type: string;
  name?: string;
  traceName?: string;
  input?: unknown;
  output?: unknown;
  environment?: string;
  latency?: number;
  totalCost?: number | string;
  costDetails?: { total?: number };
};

export async function GET() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = (process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com").replace(/\/$/, "");
  const projectId = process.env.LANGFUSE_PROJECT_ID;

  if (!publicKey || !secretKey) return NextResponse.json({ data: demoRows(), source: "demo", configured: false });

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      fields: "core,basic,io,usage,metrics,trace_context",
      fromStartTime: from.toISOString(),
      toStartTime: to.toISOString(),
      limit: "100",
    });
    const response = await fetch(`${host}/api/public/v2/observations?${params}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Langfuse API returned ${response.status}`);
    const payload = await response.json() as { data?: Observation[] };
    const data = (payload.data || []).map((item) => ({
      id: item.id,
      startTime: item.startTime,
      type: item.type,
      name: item.name || "unnamed",
      traceName: item.traceName || item.name || "unnamed-trace",
      input: item.input,
      output: item.output,
      environment: item.environment,
      latencyMs: item.latency != null ? Math.round(item.latency * 1000) : duration(item.startTime, item.endTime),
      totalCost: numberValue(item.totalCost) ?? item.costDetails?.total,
      url: projectId ? `${host}/project/${projectId}/traces/${item.traceId}` : undefined,
    }));
    return NextResponse.json({ data, source: "langfuse", configured: true });
  } catch (error) {
    return NextResponse.json({ data: demoRows(), source: "demo", configured: true, message: error instanceof Error ? error.message : "Langfuse unavailable" });
  }
}

function duration(start: string, end?: string) {
  if (!end) return undefined;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

function numberValue(value?: number | string) {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function demoRows() {
  const now = Date.now();
  return [
    { id: "demo-1", startTime: new Date(now - 45000).toISOString(), type: "GENERATION", name: "OpenAI.chat", traceName: "mina-workspace-chat-turn", input: { messages: [{ role: "user", content: "Chính sách nghỉ phép năm như thế nào?" }] }, output: { role: "assistant", content: "Theo chính sách nhân sự..." }, latencyMs: 1842, totalCost: 0.00124, environment: "demo" },
    { id: "demo-2", startTime: new Date(now - 46800).toISOString(), type: "SPAN", name: "search_knowledge_base", traceName: "mina-workspace-chat-turn", input: { query: "chính sách nghỉ phép năm", userId: "U001" }, output: { results: 6, allowed: 4, denied: 2 }, latencyMs: 126, environment: "demo" },
    { id: "demo-3", startTime: new Date(now - 47000).toISOString(), type: "SPAN", name: "check_acl", traceName: "mina-workspace-chat-turn", input: { role: "Employee", department: "HR" }, output: { decision: "allow", classification: "Internal" }, latencyMs: 18, environment: "demo" },
    { id: "demo-4", startTime: new Date(now - 320000).toISOString(), type: "AGENT", name: "travel-request-agent", traceName: "mina-agent-workflow", input: { destination: "Đà Nẵng", dates: "15–17/07/2026" }, output: { status: "awaiting_user_confirmation", steps: 5 }, latencyMs: 6230, totalCost: 0.00481, environment: "demo" },
    { id: "demo-5", startTime: new Date(now - 322000).toISOString(), type: "GENERATION", name: "OpenAI.chat", traceName: "mina-agent-workflow", input: { task: "Plan business travel" }, output: { plan: ["Check policy", "Search flight", "Create draft"] }, latencyMs: 2110, totalCost: 0.00236, environment: "demo" },
  ];
}
