import { NextResponse } from "next/server";
import { citationsFromHits, composeAnswer } from "@/lib/answer";
import { appendAuditLog, getUser } from "@/lib/data";
import { searchKnowledge } from "@/lib/search";
import { attendanceByStaff, createLeaveDraft, detectToolIntent, staffCount, staffSearch } from "@/lib/tools";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = await request.json();
  const question = String(body.question || "");
  const user = getUser(String(body.userId || "U001"));

  if (!question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const toolIntent = detectToolIntent(question);
  let toolResult = null;
  let answer = "";
  const retrieved = toolIntent ? [] : searchKnowledge(question, user, 8);
  const authorized = retrieved.filter((hit) => hit.allowed);
  let answerSources = authorized;
  const topHit = retrieved[0];
  const bestAllowed = authorized[0];
  const topDocumentCount = topHit
    ? retrieved.slice(0, 3).filter((hit) => hit.document_id === topHit.document_id).length
    : 0;
  const deniedDominates = Boolean(
    topHit &&
      !topHit.allowed &&
      topDocumentCount >= 2 &&
      (!bestAllowed || topHit.score > bestAllowed.score),
  );

  if (toolIntent === "staff.count") {
    const result = staffCount();
    answerSources = [];
    toolResult = { name: toolIntent, body: result };
    answer = `Theo Staff Directory hiện tại, công ty có ${result.total} nhân sự đang hoạt động.`;
  } else if (toolIntent === "staff.search") {
    const result = staffSearch(question);
    answerSources = [];
    toolResult = { name: toolIntent, body: { result, pageInfo: { pageSize: 8, currentPage: 0, totalRecord: result.length } } };
    answer = result.length
      ? `Em tìm thấy ${result.length} nhân sự phù hợp. Kết quả đầu tiên là ${result[0].staffName}, vai trò ${result[0].title}, thuộc ${result[0].listOrgUnit[0].orgUnitName}.`
      : "Em chưa tìm thấy nhân sự phù hợp trong mock Staff Directory.";
  } else if (toolIntent === "attendance.byStaff") {
    answerSources = [];
    toolResult = { name: toolIntent, body: attendanceByStaff(user) };
    answer = `${user.full_name} đã check-in lúc ${toolResult.body.result[0].checkIn} tại ${toolResult.body.result[0].location}. Tháng này có ${toolResult.body.summary.lateDays} ngày đi muộn.`;
  } else if (toolIntent === "request.createDraft") {
    answerSources = [];
    toolResult = { name: toolIntent, body: createLeaveDraft(user, question) };
    answer = `Em đã tạo draft yêu cầu nghỉ phép #${toolResult.body.id}, trạng thái ${toolResult.body.status}, từ ${toolResult.body.fromDate} đến ${toolResult.body.toDate}.`;
  } else if (deniedDominates || (!authorized.length && retrieved.length)) {
    const denied = topHit;
    answerSources = [];
    answer = `Bạn không có quyền truy cập nội dung phù hợp nhất. Tài liệu "${denied.title}" thuộc ${denied.department}, phân loại ${denied.classification}. Lý do: ${denied.reason}`;
  } else {
    answer = await composeAnswer(question, user, authorized.slice(0, 5));
  }

  const citations = citationsFromHits(answerSources);
  const response = {
    answer,
    user,
    intent: toolIntent || "knowledge.rag",
    toolResult,
    citations,
    retrieved: retrieved.map((hit) => ({
      chunk_id: hit.chunk_id,
      document_id: hit.document_id,
      title: hit.title,
      department: hit.department,
      classification: hit.classification,
      score: hit.score,
      allowed: hit.allowed,
      reason: hit.reason,
    })),
    latencyMs: Date.now() - startedAt,
  };

  appendAuditLog({
    ts: new Date().toISOString(),
    requestId: crypto.randomUUID(),
    userId: user.user_id,
    role: user.role,
    department: user.department,
    question,
    intent: response.intent,
    citations: citations.map((item) => item.document_id),
    retrieved: response.retrieved,
    latencyMs: response.latencyMs,
  });

  return NextResponse.json(response);
}
