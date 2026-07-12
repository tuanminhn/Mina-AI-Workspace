"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Info,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import LangfuseTracing from "@/components/langfuse-tracing";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { APP_VERSION } from "@/lib/version";

type User = {
  user_id: string;
  full_name: string;
  department: string;
  role: string;
  email: string;
};

type Citation = {
  chunk_id: string;
  document_id: string;
  title: string;
  department: string;
  classification: string;
  quote: string;
};

type Retrieved = {
  chunk_id: string;
  document_id: string;
  title: string;
  department: string;
  classification: string;
  score: number;
  allowed: boolean;
  reason: string;
};

type AgentStep = {
  name: string;
  status: "completed" | "blocked" | "skipped" | "needs_input";
  summary: string;
};

type AgentToolResult = {
  name?: string;
  status?: string;
  steps?: AgentStep[];
  plan?: string[];
  decisions?: Array<{ label: string; summary: string }>;
  approval?: { status: string; summary: string; nextAction: string };
  draft?: LeaveDraft | null;
  travelDrafts?: TravelDraftBundle | null;
};

type LeaveDraft = {
  id: string;
  status: string;
  staffId: string;
  staffName: string;
  fromDate: string;
  toDate: string;
  workingDays: number;
  reason: string;
  submitted: boolean;
  currentApprover: {
    staffName: string;
    title: string;
    email: string;
  };
};

type TravelDraftBundle = {
  submitted: boolean;
  recommendation: { flightId: string; hotelId: string; reason: string };
  flightOptions: TravelFlightOption[];
  hotelOptions: TravelHotelOption[];
  approver: { staffName: string; title: string; email: string };
  bookingRequest: {
    id: string;
    status: string;
    flight: TravelFlightOption;
    hotel: TravelHotelOption;
    totalPrice: number;
    currency: string;
    confirmed: boolean;
  };
  travelRequest: {
    id: string;
    status: string;
    traveler: { staffId: string; staffName: string; department: string; title: string };
    destination: string;
    fromDate: string;
    toDate: string;
    calendarDays: number;
    nights: number;
    purpose: string;
  };
  advanceRequest: {
    id: string;
    status: string;
    linkedTravelRequestId: string;
    amount: number;
    currency: string;
    note: string;
    breakdown: {
      hotelPerNight: number;
      nights: number;
      hotelTotal: number;
      mealPerDay: number;
      days: number;
      mealTotal: number;
      excludes: string[];
    };
  };
};

type TravelFlightOption = {
  id: string;
  airline: string;
  outbound: string;
  return: string;
  route: string;
  totalPrice: number;
  baggage: string;
  refundable: boolean;
};

type TravelHotelOption = {
  id: string;
  name: string;
  area: string;
  pricePerNight: number;
  totalPrice: number;
  distanceKm: number;
  rating: number;
  refundable: boolean;
  policyCompliant: boolean;
};

type DemoQuestion = {
  text: string;
  badge?: string;
  poweredBy?: "Tinyfish";
  description?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  retrieved?: Retrieved[];
  intent?: string;
  latencyMs?: number;
  toolResult?: unknown;
};

const roleTone: Record<string, string> = {
  Employee: "bg-sky-50 text-sky-700 border-sky-200",
  Manager: "bg-teal-50 text-teal-700 border-teal-200",
  Director: "bg-amber-50 text-amber-800 border-amber-200",
  Executive: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"workspace" | "tracing">("workspace");
  const [users, setUsers] = useState<User[]>([]);
  const [demoQuestions, setDemoQuestions] = useState<DemoQuestion[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("U001");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Chào anh chị, em là trợ lý AI Tasco Workspace. Chọn user ở bên trái rồi hỏi thử các câu liên quan chính sách, tài liệu Confidential/Restricted hoặc thao tác My Tasco.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [openedDraft, setOpenedDraft] = useState<LeaveDraft | null>(null);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, LeaveDraft>>({});
  const [openedTravelDrafts, setOpenedTravelDrafts] = useState<TravelDraftBundle | null>(null);
  const [travelDraftOverrides, setTravelDraftOverrides] = useState<Record<string, TravelDraftBundle>>({});
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.user_id === selectedUserId) || users[0],
    [selectedUserId, users],
  );

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const latestAgentResult = latestAssistant?.toolResult as AgentToolResult | undefined;

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setDemoQuestions(data.demoQuestions || []);
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function ask(override?: string) {
    const finalQuestion = (override || question).trim();
    if (!finalQuestion || !selectedUser) return;
    setLoading(true);
    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: finalQuestion },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQuestion, userId: selectedUser.user_id }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          retrieved: data.retrieved,
          intent: data.intent,
          latencyMs: data.latencyMs,
          toolResult: data.toolResult,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function selectTravelFlight(flight: TravelFlightOption) {
    setOpenedTravelDrafts((current) => current ? {
      ...current,
      bookingRequest: {
        ...current.bookingRequest,
        flight,
        totalPrice: flight.totalPrice + current.bookingRequest.hotel.totalPrice,
      },
      advanceRequest: {
        ...current.advanceRequest,
        amount: flight.totalPrice + current.bookingRequest.hotel.totalPrice + current.advanceRequest.breakdown.mealTotal,
      },
    } : current);
  }

  function selectTravelHotel(hotel: TravelHotelOption) {
    if (!hotel.policyCompliant) return;
    setOpenedTravelDrafts((current) => current ? {
      ...current,
      bookingRequest: {
        ...current.bookingRequest,
        hotel,
        totalPrice: current.bookingRequest.flight.totalPrice + hotel.totalPrice,
      },
      advanceRequest: {
        ...current.advanceRequest,
        amount: current.bookingRequest.flight.totalPrice + hotel.totalPrice + current.advanceRequest.breakdown.mealTotal,
      },
    } : current);
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#122033] lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 px-4 py-4 lg:h-dvh lg:min-h-0 lg:px-6">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="flex shrink-0 items-center gap-3 text-[#213368]">
              <Image
                src="/tasco-logo-primary.svg"
                alt="TASCO"
                width={160}
                height={24}
                priority
                className="h-6 w-40 shrink-0"
              />
              <span className="text-2xl font-semibold leading-none">AI Workspace</span>
            </h1>
            <div className="flex items-center gap-2 text-sm font-semibold leading-none text-[#315f9a]">
              <ShieldCheck className="h-4 w-4" />
              Secure enterprise knowledge
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <nav className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="Workspace views">
              <button
                type="button"
                onClick={() => setActiveTab("workspace")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  activeTab === "workspace" ? "bg-[#1f5fbf] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MessageSquareText className="h-4 w-4" />
                <span className="hidden sm:inline">AI Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tracing")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  activeTab === "tracing" ? "bg-[#1f5fbf] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Langfuse Tracing</span>
              </button>
            </nav>
            <details className="group relative shrink-0">
              <summary
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-[#315f9a] shadow-sm transition hover:border-[#75a9eb] hover:bg-[#edf5ff] focus:outline-none focus:ring-2 focus:ring-[#8bb6f0] [&::-webkit-details-marker]:hidden"
                aria-label="System information"
                title="System information"
              >
                <Info className="h-4.5 w-4.5" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                <div className="mb-2 text-sm font-semibold text-[#13253d]">System information</div>
                <dl className="divide-y divide-slate-100 text-sm">
                  <InfoRow label="Version" value={APP_VERSION} />
                  <InfoRow label="Documents" value="40" />
                  <InfoRow label="Demo users" value="32" />
                  <InfoRow label="Access rules" value="RBAC + ABAC" />
                  <InfoRow label="My Tasco tools" value="3 mock APIs" />
                </dl>
              </div>
            </details>
          </div>
        </header>

        {activeTab === "workspace" ? (
        <section className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Panel title="Fast Scenarios" icon={<Search className="h-4 w-4" />}>
              <div className="flex flex-col gap-2">
                {demoQuestions.map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    onClick={() => ask(item.text)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#75a9eb] hover:bg-[#edf5ff]"
                  >
                    {item.badge && (
                      <span className="mb-1.5 flex flex-wrap items-center justify-start gap-2">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          item.badge === "AI Agent"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {item.badge}
                        </span>
                        {item.poweredBy === "Tinyfish" && (
                          <span className="inline-flex items-center gap-1 border-l border-violet-200 pl-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            <span>Powered by</span>
                            <Image
                              src="/tinyfish-horizontal.svg"
                              alt="Tinyfish"
                              width={66}
                              height={15}
                              className="h-3 w-auto"
                            />
                          </span>
                        )}
                        {item.description && (
                          <span className="text-[11px] leading-4 text-violet-600">{item.description}</span>
                        )}
                      </span>
                    )}
                    <span className="block w-full">
                      {item.text}
                    </span>
                    {!item.badge && item.description && (
                      <span className="mt-1.5 block text-xs leading-4 text-violet-600">{item.description}</span>
                    )}
                  </button>
                ))}
              </div>
            </Panel>
          </aside>

          <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:min-h-0">
            <div className="flex items-center border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 font-semibold">
                <MessageSquareText className="h-4 w-4 text-[#315f9a]" />
                Secure Chat
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fbfcfe] p-4">
              {messages.map((message) => {
                const draft = getLeaveDraft(message.toolResult);
                const travelDrafts = getTravelDrafts(message.toolResult);
                return (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "border-[#2d6cdf] bg-[#2d6cdf] text-white"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {draft && (
                      <button
                        type="button"
                        onClick={() => setOpenedDraft(draftOverrides[draft.id] || draft)}
                        className="mt-3 inline-flex items-center text-sm font-semibold text-[#1f5fbf] underline decoration-[#8bb6f0] underline-offset-4 transition hover:text-[#174c9c]"
                      >
                        Xem đơn nháp đã tạo
                      </button>
                    )}
                    {travelDrafts && (
                      <button
                        type="button"
                        onClick={() => setOpenedTravelDrafts(travelDraftOverrides[travelDrafts.travelRequest.id] || travelDrafts)}
                        className="mt-3 block text-sm font-semibold text-[#1f5fbf] underline decoration-[#8bb6f0] underline-offset-4 transition hover:text-[#174c9c]"
                      >
                        Xem đề nghị công tác và tạm ứng
                      </button>
                    )}
                    {message.intent && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                          intent: {message.intent}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                          {message.latencyMs} ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Bot className="h-4 w-4 animate-pulse" />
                  Mina đang kiểm quyền và tìm nguồn...
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            <div className="border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      ask();
                    }
                  }}
                  className="min-h-12 flex-1 resize-none rounded-md border border-slate-250 bg-white px-3 py-3 text-sm outline-none ring-[#8bb6f0] focus:ring-2"
                  placeholder="Hỏi chính sách, tài liệu nội bộ hoặc thao tác My Tasco..."
                />
                <button
                  type="button"
                  onClick={() => ask()}
                  disabled={loading}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#1f5fbf] text-white transition hover:bg-[#174c9c] disabled:opacity-50"
                  aria-label="Send question"
                  title="Send"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pl-1">
            <Panel
              title="Acting as"
              icon={<UserRound className="h-4 w-4" />}
              className="order-1"
              description="This user list is fixed from a mock API for access-control demonstrations. It is not connected to a live employee directory or production environment."
            >
              <select
                id="user"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="w-full rounded-md border border-slate-250 bg-white px-3 py-2 pr-11 text-[13px] outline-none ring-[#8bb6f0] focus:ring-2"
              >
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_id} - {user.full_name} - {user.role} - {user.department}
                  </option>
                ))}
              </select>
              {selectedUser && (
                <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="text-slate-600">{selectedUser.email}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded border px-2 py-1 text-xs ${roleTone[selectedUser.role] || roleTone.Employee}`}>
                      {selectedUser.role}
                    </span>
                    <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      {selectedUser.department}
                    </span>
                  </div>
                </div>
              )}
            </Panel>

            <Panel
              title="Agent Trace"
              icon={<Bot className="h-4 w-4" />}
              description="Steps Mina completed for multi-step requests. Business tools create drafts only and never submit requests automatically."
              defaultCollapsed
              className="order-2"
              expandedSignal={latestAgentResult?.name?.endsWith(".agent") ? latestAssistant?.id : undefined}
            >
              <div className="space-y-3">
                {latestAgentResult?.name?.endsWith(".agent") && latestAgentResult.steps?.length ? (
                  <>
                    <TraceGroup title="Plan" tone="blue">
                      <ol className="space-y-1.5 text-xs leading-5 text-slate-600">
                        {latestAgentResult.plan?.map((item, index) => (
                          <li key={item} className="flex gap-2">
                            <span className="font-semibold text-[#315f9a]">{index + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </TraceGroup>

                    <TraceGroup title="Decision" tone="amber">
                      <div className="space-y-2">
                        {latestAgentResult.decisions?.map((decision) => (
                          <div key={decision.label} className="text-xs leading-5">
                            <div className="font-semibold text-slate-700">{decision.label}</div>
                            <div className="text-slate-500">{decision.summary}</div>
                          </div>
                        ))}
                      </div>
                    </TraceGroup>

                    <TraceGroup title="Actions" tone="slate">
                      <div className="space-y-2">
                        {latestAgentResult.steps.map((step, index) => (
                          <div key={`${step.name}-${index}`} className="rounded border border-slate-200 bg-white p-2.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-700">{step.name}</span>
                              <span className={`rounded px-1.5 py-0.5 font-semibold ${
                                step.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : step.status === "blocked"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-amber-50 text-amber-700"
                              }`}>
                                {step.status}
                              </span>
                            </div>
                            <div className="mt-1 leading-5 text-slate-500">{step.summary}</div>
                          </div>
                        ))}
                      </div>
                    </TraceGroup>

                    <TraceGroup title="Approval" tone="violet">
                      <div className="text-xs leading-5">
                        <div className="font-semibold text-violet-700">
                          {latestAgentResult.approval?.status === "awaiting_user_confirmation"
                            ? "Chờ user xác nhận"
                            : "Đang bị chặn"}
                        </div>
                        <div className="mt-1 text-slate-600">{latestAgentResult.approval?.summary}</div>
                        <div className="mt-1 text-slate-500">Bước tiếp theo: {latestAgentResult.approval?.nextAction}</div>
                      </div>
                    </TraceGroup>
                  </>
                ) : (
                  <Empty text="Trace sẽ xuất hiện khi chạy một yêu cầu AI Agent nhiều bước." />
                )}
              </div>
            </Panel>

            <Panel
              title="Citations"
              icon={<ClipboardCheck className="h-4 w-4" />}
              defaultCollapsed
              className="order-4"
              description={
                <>
                  <p>
                    Authorized source documents used as context for the latest response.
                    Each source shows its document ID, classification, owning department, and relevant excerpt.
                  </p>
                  <p className="mt-2">
                    Documents denied by ACL are not listed here and their content is never sent to the LLM.
                  </p>
                </>
              }
            >
              <div className="space-y-3">
                {latestAssistant?.citations?.length ? (
                  latestAssistant.citations.map((citation) => (
                    <div key={citation.chunk_id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{citation.document_id}</div>
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {citation.classification}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{citation.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{citation.department}</div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{citation.quote}</p>
                    </div>
                  ))
                ) : (
                  <Empty text="Chưa có source được cấp quyền cho lượt trả lời mới nhất." />
                )}
              </div>
            </Panel>

            <Panel
              title="ACL Trace"
              icon={<ShieldCheck className="h-4 w-4" />}
              defaultCollapsed
              className="order-3"
              description={
                <>
                  <p>
                    Authorization trace for retrieval results. <strong>Allow</strong> means the user may access the source;
                    <strong>Deny</strong> means it is blocked by role, department, or classification.
                  </p>
                  <p className="mt-2">
                    <strong>Score</strong> measures relevance to the question, not security level.
                    The final line explains exactly why each document is allowed or denied.
                  </p>
                </>
              }
            >
              <div className="space-y-2">
                {latestAssistant?.retrieved?.length ? (
                  latestAssistant.retrieved.slice(0, 6).map((hit) => (
                    <div key={hit.chunk_id} className="rounded-md border border-slate-200 bg-white p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{hit.document_id}</span>
                        {hit.allowed ? (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            allow
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-700">
                            <XCircle className="h-3.5 w-3.5" />
                            deny
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-slate-700">{hit.title}</div>
                      <div className="mt-1 text-slate-500">
                        {hit.classification} / {hit.department} / score {hit.score}
                      </div>
                      <div className="mt-2 text-slate-500">{hit.reason}</div>
                    </div>
                  ))
                ) : (
                  <Empty text="Trace sẽ xuất hiện sau khi hỏi RAG." />
                )}
              </div>
            </Panel>

          </aside>
        </section>
        ) : (
          <LangfuseTracing />
        )}
      </div>
      {openedDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-draft-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenedDraft(null);
          }}
        >
          <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#315f9a]">My Tasco · Leave request</div>
                <h2 id="leave-draft-title" className="mt-1 text-xl font-semibold text-[#13253d]">Đơn nghỉ phép {openedDraft.id}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenedDraft(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng đơn nháp"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <DraftRow label="Trạng thái" value={openedDraft.submitted ? openedDraft.status : `${openedDraft.status} · Chưa gửi`} />
              <DraftRow label="Nhân viên" value={`${openedDraft.staffName} (${openedDraft.staffId})`} />
              <DraftRow label="Thời gian nghỉ" value={`${formatDisplayDate(openedDraft.fromDate)} – ${formatDisplayDate(openedDraft.toDate)}`} />
              <DraftRow label="Số ngày làm việc" value={`${openedDraft.workingDays} ngày`} />
              <DraftRow label="Người phê duyệt" value={`${openedDraft.currentApprover.staffName} · ${openedDraft.currentApprover.title}`} />
              <DraftRow label="Email phê duyệt" value={openedDraft.currentApprover.email} />
            </dl>
            <div className="mt-4 text-sm">
              <label htmlFor="leave-request-reason" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nội dung yêu cầu
              </label>
              <textarea
                id="leave-request-reason"
                value={openedDraft.reason}
                onChange={(event) => setOpenedDraft((current) => current ? { ...current, reason: event.target.value } : current)}
                disabled={openedDraft.submitted}
                className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-250 bg-white px-3 py-2 leading-6 text-slate-700 outline-none ring-[#8bb6f0] focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={openedDraft.submitted || !openedDraft.reason.trim()}
                onClick={() => {
                  const submittedDraft = { ...openedDraft, submitted: true, status: "SUBMITTED" };
                  setOpenedDraft(submittedDraft);
                  setDraftOverrides((current) => ({ ...current, [submittedDraft.id]: submittedDraft }));
                  setSubmissionNotice("Đơn nghỉ phép đã được chuyển tới người phê duyệt.");
                }}
                className="rounded-md bg-[#1f5fbf] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#174c9c] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {openedDraft.submitted ? "Đã gửi" : "Gửi yêu cầu"}
              </button>
            </div>
          </section>
        </div>
      )}
      {openedTravelDrafts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="travel-draft-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenedTravelDrafts(null);
          }}
        >
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#315f9a]">My Tasco · Business travel workflow</div>
                <h2 id="travel-draft-title" className="mt-1 text-xl font-semibold text-[#13253d]">Bộ nháp công tác và tạm ứng</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenedTravelDrafts(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng bộ nháp công tác"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <section className="mt-4 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-[#13253d]">Phương án đặt dịch vụ</h3>
                <a
                  href="https://www.tinyfish.ai/"
                  target="_blank"
                  rel="noreferrer"
                  title="Powered by Tinyfish · Mock integration"
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-[#ff6700] hover:shadow-sm"
                >
                  <span>Powered by</span>
                  <Image
                    src="/tinyfish-horizontal.svg"
                    alt="Tinyfish"
                    width={88}
                    height={20}
                    className="h-4 w-auto"
                  />
                </a>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{openedTravelDrafts.recommendation.reason}</p>

              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Chuyến bay</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {openedTravelDrafts.flightOptions.map((flight) => {
                  const selected = openedTravelDrafts.bookingRequest.flight.id === flight.id;
                  return (
                    <button
                      key={flight.id}
                      type="button"
                      disabled={openedTravelDrafts.submitted}
                      onClick={() => selectTravelFlight(flight)}
                      className={`rounded-md border p-3 text-left text-xs transition ${selected ? "border-violet-500 bg-white ring-2 ring-violet-200" : "border-slate-200 bg-white hover:border-violet-300"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-800">{flight.airline}</span>
                        {selected && <span className="text-violet-700">Đã chọn</span>}
                      </div>
                      <div className="mt-1 text-slate-500">Đi {flight.outbound.slice(11)} · Về {flight.return.slice(11)}</div>
                      <div className="mt-1 text-slate-500">Hành lý {flight.baggage} · {flight.refundable ? "Có hoàn huỷ" : "Không hoàn huỷ"}</div>
                      <div className="mt-2 font-semibold text-[#13253d]">{formatMoney(flight.totalPrice)} VND</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Khách sạn</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {openedTravelDrafts.hotelOptions.map((hotel) => {
                  const selected = openedTravelDrafts.bookingRequest.hotel.id === hotel.id;
                  return (
                    <button
                      key={hotel.id}
                      type="button"
                      disabled={openedTravelDrafts.submitted || !hotel.policyCompliant}
                      onClick={() => selectTravelHotel(hotel)}
                      className={`rounded-md border p-3 text-left text-xs transition ${selected ? "border-violet-500 bg-white ring-2 ring-violet-200" : hotel.policyCompliant ? "border-slate-200 bg-white hover:border-violet-300" : "cursor-not-allowed border-rose-200 bg-rose-50 opacity-70"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-800">{hotel.name}</span>
                        {selected ? <span className="text-violet-700">Đã chọn</span> : !hotel.policyCompliant && <span className="text-rose-700">Vượt định mức</span>}
                      </div>
                      <div className="mt-1 text-slate-500">{hotel.area} · {hotel.distanceKm} km · ★ {hotel.rating}</div>
                      <div className="mt-1 text-slate-500">{hotel.refundable ? "Có hoàn huỷ" : "Không hoàn huỷ"}</div>
                      <div className="mt-2 font-semibold text-[#13253d]">{formatMoney(hotel.pricePerNight)} VND/đêm</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-[#13253d]">Đề nghị công tác</h3>
                  <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-blue-700">{openedTravelDrafts.travelRequest.id}</span>
                </div>
                <dl className="mt-3 divide-y divide-blue-100 text-sm">
                  <DraftRow label="Nhân viên" value={openedTravelDrafts.travelRequest.traveler.staffName} />
                  <DraftRow label="Phòng ban" value={openedTravelDrafts.travelRequest.traveler.department} />
                  <DraftRow label="Địa điểm" value={openedTravelDrafts.travelRequest.destination} />
                  <DraftRow label="Thời gian" value={`${formatDisplayDate(openedTravelDrafts.travelRequest.fromDate)} – ${formatDisplayDate(openedTravelDrafts.travelRequest.toDate)}`} />
                  <DraftRow label="Thời lượng" value={`${openedTravelDrafts.travelRequest.calendarDays} ngày · ${openedTravelDrafts.travelRequest.nights} đêm`} />
                </dl>
                <label htmlFor="travel-purpose" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mục đích công tác</label>
                <textarea
                  id="travel-purpose"
                  value={openedTravelDrafts.travelRequest.purpose}
                  disabled={openedTravelDrafts.submitted}
                  onChange={(event) => setOpenedTravelDrafts((current) => current ? {
                    ...current,
                    travelRequest: { ...current.travelRequest, purpose: event.target.value },
                  } : current)}
                  className="mt-2 min-h-24 w-full resize-y rounded-md border border-blue-200 bg-white px-3 py-2 text-sm leading-6 outline-none ring-[#8bb6f0] focus:ring-2 disabled:bg-slate-100"
                />
              </section>

              <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-[#13253d]">Đề nghị tạm ứng</h3>
                  <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-amber-700">{openedTravelDrafts.advanceRequest.id}</span>
                </div>
                <dl className="mt-3 divide-y divide-amber-100 text-sm">
                  <DraftRow label="Khách sạn" value={`${formatMoney(openedTravelDrafts.advanceRequest.breakdown.hotelTotal)} VND`} />
                  <DraftRow label="Phụ cấp" value={`${formatMoney(openedTravelDrafts.advanceRequest.breakdown.mealTotal)} VND`} />
                  <DraftRow label="Tổng tạm ứng" value={`${formatMoney(openedTravelDrafts.advanceRequest.amount)} VND`} />
                  <DraftRow label="Booking draft" value={openedTravelDrafts.bookingRequest.id} />
                  <DraftRow label="Liên kết" value={openedTravelDrafts.advanceRequest.linkedTravelRequestId} />
                </dl>
                <label htmlFor="advance-note" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú tạm ứng</label>
                <textarea
                  id="advance-note"
                  value={openedTravelDrafts.advanceRequest.note}
                  disabled={openedTravelDrafts.submitted}
                  onChange={(event) => setOpenedTravelDrafts((current) => current ? {
                    ...current,
                    advanceRequest: { ...current.advanceRequest, note: event.target.value },
                  } : current)}
                  className="mt-2 min-h-24 w-full resize-y rounded-md border border-amber-200 bg-white px-3 py-2 text-sm leading-6 outline-none ring-[#8bb6f0] focus:ring-2 disabled:bg-slate-100"
                />
              </section>
            </div>

            <div className="mt-4 rounded-md border border-violet-200 bg-violet-50/50 p-3 text-sm">
              <div className="font-semibold text-violet-700">Sếp phụ trách dự kiến</div>
              <div className="mt-1 text-slate-700">{openedTravelDrafts.approver.staffName} · {openedTravelDrafts.approver.title}</div>
              <div className="text-slate-500">{openedTravelDrafts.approver.email}</div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={openedTravelDrafts.submitted || !openedTravelDrafts.travelRequest.purpose.trim() || !openedTravelDrafts.advanceRequest.note.trim()}
                onClick={() => {
                  const submittedBundle = {
                    ...openedTravelDrafts,
                    submitted: true,
                    travelRequest: { ...openedTravelDrafts.travelRequest, status: "SUBMITTED" },
                    advanceRequest: { ...openedTravelDrafts.advanceRequest, status: "SUBMITTED" },
                  };
                  setOpenedTravelDrafts(submittedBundle);
                  setTravelDraftOverrides((current) => ({
                    ...current,
                    [submittedBundle.travelRequest.id]: submittedBundle,
                  }));
                  setSubmissionNotice("Đề nghị công tác và tạm ứng đã được chuyển tới sếp phụ trách.");
                }}
                className="rounded-md bg-[#1f5fbf] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#174c9c] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {openedTravelDrafts.submitted ? "Đã gửi duyệt" : "Gửi duyệt"}
              </button>
            </div>
          </section>
        </div>
      )}
      {submissionNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 p-4" role="alertdialog" aria-modal="true">
          <section className="w-full max-w-sm rounded-xl border border-emerald-200 bg-white p-5 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-3 text-lg font-semibold text-[#13253d]">Đã gửi yêu cầu lên hệ thống</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{submissionNotice}</p>
            <button
              type="button"
              onClick={() => setSubmissionNotice(null)}
              className="mt-4 rounded-md bg-[#1f5fbf] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#174c9c]"
            >
              Xác nhận
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function getLeaveDraft(toolResult: unknown) {
  if (!toolResult || typeof toolResult !== "object") return null;
  const result = toolResult as AgentToolResult;
  return result.name === "leave.agent" && result.draft ? result.draft : null;
}

function getTravelDrafts(toolResult: unknown) {
  if (!toolResult || typeof toolResult !== "object") return null;
  const result = toolResult as AgentToolResult;
  return result.name === "travel.agent" && result.travelDrafts ? result.travelDrafts : null;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function DraftRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-[#13253d]">{value}</dd>
    </div>
  );
}

function TraceGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "blue" | "amber" | "slate" | "violet";
  children: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/60 text-blue-700",
    amber: "border-amber-200 bg-amber-50/60 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    violet: "border-violet-200 bg-violet-50/60 text-violet-700",
  };
  return (
    <section className={`rounded-md border p-3 ${tones[tone]}`}>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider">{title}</div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-[#10233d]">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  icon,
  description,
  defaultCollapsed = false,
  className = "",
  expandedSignal,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description?: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
  expandedSignal?: unknown;
  children: React.ReactNode;
}) {
  const [showDescription, setShowDescription] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (expandedSignal) setIsCollapsed(false);
  }, [expandedSignal]);

  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className={isCollapsed ? "" : "mb-3"}>
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-[#13253d]">
            <span className="text-[#315f9a]">{icon}</span>
            {title}
          </div>
          <div className="flex items-center gap-1">
            {description && (
            <button
              type="button"
              onClick={() => setShowDescription((current) => !current)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#315f9a] focus:outline-none focus:ring-2 focus:ring-[#8bb6f0]"
              aria-label={`${showDescription ? "Close" : "Open"} explanation for ${title}`}
              aria-expanded={showDescription}
              title={`Explanation for ${title}`}
            >
              <Info className="h-4 w-4" />
            </button>
          )}
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#315f9a] transition hover:bg-[#edf5ff] focus:outline-none focus:ring-2 focus:ring-[#8bb6f0]"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${title}`}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
            </button>
            {description && showDescription && (
              <div className="absolute right-0 top-9 z-40 w-72 rounded-md border border-[#cbdcf3] bg-white p-3 text-xs font-normal leading-5 text-slate-600 shadow-xl">
                {description}
              </div>
            )}
          </div>
        </div>
      </div>
      {!isCollapsed && children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-250 bg-slate-50 p-4 text-sm text-slate-500">{text}</div>;
}
