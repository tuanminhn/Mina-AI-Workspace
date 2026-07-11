import { NextResponse } from "next/server";
import { citationsFromHits, composeAnswer, composeLeaveAgentAnswer } from "@/lib/answer";
import { appendAuditLog, getUser } from "@/lib/data";
import { searchKnowledge } from "@/lib/search";
import {
  attendanceByStaff,
  createAgentLeaveDraft,
  createLeaveDraft,
  detectToolIntent,
  findLeaveApprover,
  leaveBalance,
  parseLeavePeriod,
  staffCount,
  staffSearch,
} from "@/lib/tools";

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
  const retrieved = toolIntent === "leave.agent"
    ? searchKnowledge("chính sách nghỉ phép số ngày nghỉ phép năm", user, 8)
    : toolIntent ? [] : searchKnowledge(question, user, 8);
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

  if (toolIntent === "leave.agent") {
    const period = parseLeavePeriod(question);
    const balance = leaveBalance(user);
    const approver = findLeaveApprover(user);
    const policyHit = authorized.find((hit) => hit.document_id === "DOC002");
    if (!period) {
      answerSources = policyHit ? [policyHit] : [];
      toolResult = {
        name: toolIntent,
        status: "needs_input",
        steps: [{ name: "parse.leave_period", status: "needs_input", summary: "Chưa xác định được khoảng ngày nghỉ." }],
      };
      answer = "Em chưa xác định được khoảng ngày nghỉ. Anh nhập theo mẫu: “Tôi muốn nghỉ từ 15 đến 17/7”.";
    } else if (!policyHit) {
      answerSources = [];
      toolResult = {
        name: toolIntent,
        status: "blocked",
        steps: [{ name: "knowledge.search_policy", status: "blocked", summary: "Không có quyền đọc chính sách nghỉ phép." }],
      };
      answer = "Em không thể tiếp tục tạo nháp vì chưa tìm được chính sách nghỉ phép mà user này được cấp quyền truy cập.";
    } else {
      const eligible = period.workingDays > 0 && period.workingDays <= balance.remaining;
      const draft = eligible ? createAgentLeaveDraft(user, question, period, approver) : null;
      const fallbackAnswer = eligible
        ? `Đã hoàn tất luồng nghỉ phép:\n1. Chính sách: nhân viên chính thức có 15 ngày nghỉ phép năm có lương sau thử việc [DOC002].\n2. Khoảng nghỉ ${period.fromDate} đến ${period.toDate} gồm ${period.workingDays} ngày làm việc. Số dư hiện tại: ${balance.remaining}/${balance.annualAllowance} ngày.\n3. Người phê duyệt: ${approver.staffName} — ${approver.title}.\n4. Đã tạo nháp ${draft?.id}, trạng thái DRAFT. Nháp chưa được gửi để phê duyệt.`
        : `Không thể tạo nháp: yêu cầu ${period.workingDays} ngày làm việc nhưng số dư chỉ còn ${balance.remaining} ngày.`;
      const agentResult = {
        name: toolIntent,
        status: eligible ? "completed" : "blocked",
        period,
        balance,
        approver,
        draft,
        fallbackAnswer,
        steps: [
          { name: "knowledge.search_policy", status: "completed", summary: `Đã đọc DOC002 theo ACL: ${policyHit.reason}` },
          { name: "leave.calculate_days", status: "completed", summary: `${period.workingDays} ngày làm việc (${period.fromDate} → ${period.toDate}).` },
          { name: "leave.check_balance", status: eligible ? "completed" : "blocked", summary: `Còn ${balance.remaining}/${balance.annualAllowance} ngày phép.` },
          { name: "staff.find_manager", status: "completed", summary: `${approver.staffName} — ${approver.title}.` },
          { name: "request.create_draft", status: eligible ? "completed" : "skipped", summary: draft ? `Đã tạo ${draft.id}; chưa gửi.` : "Không tạo do không đủ số dư." },
        ],
      };
      answerSources = [policyHit];
      toolResult = agentResult;
      answer = await composeLeaveAgentAnswer(question, user, [policyHit], agentResult);
    }
  } else if (toolIntent === "staff.count") {
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
