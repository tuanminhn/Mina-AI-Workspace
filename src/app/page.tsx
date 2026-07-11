"use client";

import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Info,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

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
  const [users, setUsers] = useState<User[]>([]);
  const [demoQuestions, setDemoQuestions] = useState<string[]>([]);
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.user_id === selectedUserId) || users[0],
    [selectedUserId, users],
  );

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");

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
          <details className="group relative shrink-0">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-[#315f9a] shadow-sm transition hover:border-[#75a9eb] hover:bg-[#edf5ff] focus:outline-none focus:ring-2 focus:ring-[#8bb6f0] [&::-webkit-details-marker]:hidden"
              aria-label="Thông tin hệ thống"
              title="Thông tin hệ thống"
            >
              <Info className="h-4.5 w-4.5" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
              <div className="mb-2 text-sm font-semibold text-[#13253d]">Thông tin hệ thống</div>
              <dl className="divide-y divide-slate-100 text-sm">
                <InfoRow label="Documents" value="40" />
                <InfoRow label="Demo users" value="32" />
                <InfoRow label="Access rules" value="RBAC + ABAC" />
                <InfoRow label="My Tasco tools" value="3 mock APIs" />
              </dl>
            </div>
          </details>
        </header>

        <section className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Panel title="Demo User" icon={<UserRound className="h-4 w-4" />}>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="user">
                Acting as
              </label>
              <select
                id="user"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-250 bg-white px-3 py-2 text-sm outline-none ring-[#8bb6f0] focus:ring-2"
              >
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_id} - {user.full_name} - {user.role} - {user.department}
                  </option>
                ))}
              </select>
              {selectedUser && (
                <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold">{selectedUser.full_name}</div>
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

            <Panel title="Fast Scenarios" icon={<Search className="h-4 w-4" />}>
              <div className="flex flex-col gap-2">
                {demoQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => ask(item)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#75a9eb] hover:bg-[#edf5ff]"
                  >
                    {item}
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
              {messages.map((message) => (
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
              ))}
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
              title="Citations"
              icon={<ClipboardCheck className="h-4 w-4" />}
              description={
                <>
                  <p>
                    Các tài liệu nguồn được cấp quyền và dùng làm context cho lượt trả lời mới nhất.
                    Mỗi nguồn hiển thị mã tài liệu, mức phân loại, phòng ban sở hữu và đoạn trích liên quan.
                  </p>
                  <p className="mt-2">
                    Tài liệu bị ACL từ chối sẽ không xuất hiện tại đây và không được gửi nội dung cho LLM.
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
              description={
                <>
                  <p>
                    Dấu vết kiểm quyền của các kết quả retrieval. <strong>Allow</strong> là nguồn user được
                    phép xem; <strong>Deny</strong> là nguồn bị chặn theo role, department hoặc classification.
                  </p>
                  <p className="mt-2">
                    <strong>Score</strong> thể hiện độ liên quan với câu hỏi, không phải mức độ bảo mật.
                    Dòng cuối giải thích chính xác lý do hệ thống Allow hoặc Deny tài liệu đó.
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
      </div>
    </main>
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
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showDescription, setShowDescription] = useState(false);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="flex items-center gap-2 font-semibold text-[#13253d]">
          <span className="text-[#315f9a]">{icon}</span>
          {title}
          {description && (
            <button
              type="button"
              onClick={() => setShowDescription((current) => !current)}
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#315f9a] focus:outline-none focus:ring-2 focus:ring-[#8bb6f0]"
              aria-label={`${showDescription ? "Đóng" : "Mở"} giải thích ${title}`}
              aria-expanded={showDescription}
              title={`Giải thích ${title}`}
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
        {description && showDescription && (
          <div className="mt-3 w-full rounded-md border border-[#cbdcf3] bg-[#f4f8fd] p-3 text-xs font-normal leading-5 text-slate-600">
            {description}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-250 bg-slate-50 p-4 text-sm text-slate-500">{text}</div>;
}
