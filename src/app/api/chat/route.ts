import { NextResponse } from "next/server";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { citationsFromHits, composeAnswer, composeLeaveAgentAnswer, composeTravelAgentAnswer } from "@/lib/answer";
import { appendAuditLog, getUser } from "@/lib/data";
import { searchKnowledge } from "@/lib/search";
import { searchLiveTravelOptions, type LiveTravelSearch } from "@/lib/tinyfish";
import {
  attendanceByStaff,
  calculateTravelAllowance,
  createAgentLeaveDraft,
  createLeaveDraft,
  createTravelDraftBundle,
  detectToolIntent,
  findLeaveApprover,
  findTravelEmployee,
  leaveBalance,
  parseLeavePeriod,
  parseTravelPeriod,
  recommendTravelOptions,
  searchFlightOptions,
  searchHotelOptions,
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
  return propagateAttributes(
    {
      traceName: "mina-workspace-chat-turn",
      userId: user.user_id,
      metadata: {
        department: user.department,
        role: user.role,
        intent: toolIntent || "knowledge.rag",
      },
      tags: ["mina-workspace", toolIntent ? "agent" : "rag"],
    },
    () => startActiveObservation("mina-workspace-chat-turn", async (chatSpan) => {
      chatSpan.update({ input: { question } });
  let toolResult = null;
  let answer = "";
  const retrieved = await startActiveObservation("knowledge.retrieve", async (retrievalSpan) => {
    const searchQuery = toolIntent === "leave.agent"
      ? "chính sách nghỉ phép số ngày nghỉ phép năm"
      : toolIntent === "travel.agent"
        ? "chính sách công tác khách sạn phụ cấp ăn uống phê duyệt"
        : question;
    const results = toolIntent ? (toolIntent === "leave.agent" || toolIntent === "travel.agent" ? searchKnowledge(searchQuery, user, 8) : []) : searchKnowledge(searchQuery, user, 8);
    retrievalSpan.update({
      input: { query: searchQuery },
      output: results.map((hit) => ({ documentId: hit.document_id, allowed: hit.allowed, score: hit.score })),
    });
    return results;
  }, { asType: "retriever" });
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

  if (toolIntent === "travel.agent") {
    const period = parseTravelPeriod(question);
    const traveler = findTravelEmployee(question);
    const destination = "Đà Nẵng";
    const policyHit = authorized.find((hit) => hit.document_id === "DOC003");
    if (!period || !traveler) {
      answerSources = policyHit ? [policyHit] : [];
      toolResult = {
        name: toolIntent,
        status: "needs_input",
        steps: [{ name: "travel.parse_request", status: "needs_input", summary: "Thiếu nhân viên hoặc khoảng ngày công tác hợp lệ." }],
      };
      answer = "Em chưa xác định đủ nhân viên và khoảng ngày công tác. Anh vui lòng nhập họ tên cùng ngày bắt đầu và kết thúc cụ thể.";
    } else if (!policyHit) {
      answerSources = [];
      toolResult = {
        name: toolIntent,
        status: "blocked",
        steps: [{ name: "knowledge.search_policy", status: "blocked", summary: "Không có quyền đọc chính sách công tác." }],
      };
      answer = "Em chưa thể tạo nháp vì không tìm thấy chính sách công tác mà user hiện tại được phép truy cập.";
    } else {
      const allowance = calculateTravelAllowance(destination, period);
      let flightOptions = searchFlightOptions(period);
      let hotelOptions = searchHotelOptions(period, allowance.hotelPerNight);
      let liveSearch: LiveTravelSearch = { provider: "demo", status: "unavailable", message: "Using demo options." };
      try {
        liveSearch = await startActiveObservation("tinyfish.travel_search", async (tinyfishSpan) => {
          tinyfishSpan.update({ input: { destination, fromDate: period.fromDate, toDate: period.toDate } });
          const result = await searchLiveTravelOptions(destination, period);
          tinyfishSpan.update({ output: { provider: result.provider, status: result.status, sourceCount: result.sources?.length || 0 } });
          return result;
        }, { asType: "tool" });
      } catch (error) {
        liveSearch = { provider: "demo", status: "failed", message: error instanceof Error ? `Tinyfish live search unavailable: ${error.message}` : "Tinyfish live search unavailable; using demo options." };
      }
      if (liveSearch.status === "live" && liveSearch.sources?.length) {
        const liveFlights = liveSearch.sources.filter((source) => source.kind === "flight").slice(0, 3);
        const liveHotels = liveSearch.sources.filter((source) => source.kind === "hotel").slice(0, 3);
        if (liveFlights.length) {
          flightOptions = liveFlights.map((source, index) => ({
            id: `TF-PENDING-FL-${index + 1}`,
            airline: source.siteName,
            outbound: period.fromDate,
            return: period.toDate,
            route: "HAN ↔ DAD",
            totalPrice: 0,
            baggage: "Đang lấy thông tin",
            refundable: false,
            sourceUrl: source.url,
            summary: source.snippet,
          }));
        }
        if (liveHotels.length) {
          hotelOptions = liveHotels.map((source, index) => ({
            id: `TF-PENDING-HT-${index + 1}`,
            name: source.title,
            area: source.siteName,
            pricePerNight: 0,
            totalPrice: 0,
            distanceKm: 0,
            rating: 0,
            refundable: false,
            policyCompliant: true,
            sourceUrl: source.url,
            summary: source.snippet,
          }));
        }
      }
      const recommendation = liveSearch.status === "live"
        ? { flightId: flightOptions[0].id, hotelId: hotelOptions[0].id, reason: "Đang lấy giá và điều kiện chi tiết từ các nguồn web. Giá chỉ được dùng sau khi Tinyfish Fetch xác nhận." }
        : recommendTravelOptions(flightOptions, hotelOptions);
      const selectedFlight = flightOptions.find((item) => item.id === recommendation.flightId) || flightOptions[0];
      const selectedHotel = hotelOptions.find((item) => item.id === recommendation.hotelId) || hotelOptions[0];
      const drafts = createTravelDraftBundle(traveler, period, allowance, selectedFlight, selectedHotel);
      const money = new Intl.NumberFormat("vi-VN").format(drafts.advanceRequest.amount);
      const fallbackAnswer = `Đã kiểm tra dữ liệu hệ thống cho ${traveler.staffName}:\n1. Lịch công tác: ${period.fromDate} đến ${period.toDate} (${period.calendarDays} ngày, ${period.nights} đêm).\n2. Chính sách áp dụng: DOC003; định mức khách sạn ${new Intl.NumberFormat("vi-VN").format(allowance.hotelPerNight)} VND/đêm và phụ cấp ăn uống ${new Intl.NumberFormat("vi-VN").format(allowance.mealPerDay)} VND/ngày.\n3. Tuyến duyệt dự kiến: ${drafts.approver.staffName} — ${drafts.approver.title}.\n4. Đang lấy thông tin từ internet, anh chị vui lòng chờ... Giá vé/khách sạn và tổng tạm ứng sẽ được điền vào bộ nháp ngay khi Tinyfish Fetch xác nhận.\n5. Chưa đặt dịch vụ và chưa gửi duyệt.`;
      const agentResult = {
        name: toolIntent,
        status: "completed",
        traveler,
        period,
        allowance,
        liveSearch,
        flightOptions,
        hotelOptions,
        recommendation,
        travelDrafts: { ...drafts, flightOptions, hotelOptions, recommendation, liveSearch },
        fallbackAnswer,
        plan: [
          "Tra cứu chính sách công tác theo quyền truy cập.",
          "Xác định nhân viên, địa điểm, số ngày và số đêm.",
          "Tìm chuyến bay và khách sạn, lọc theo định mức rồi so sánh phương án.",
          "Chuẩn bị booking, đề nghị công tác và tạm ứng; chờ user chọn trước khi gửi duyệt.",
        ],
        decisions: [
          { label: "Policy & access", summary: `Dùng DOC003 làm căn cứ: ${policyHit.reason}` },
          { label: "Trip calculation", summary: `${period.calendarDays} ngày, ${period.nights} đêm tại ${destination}; áp dụng định mức thành phố lớn.` },
          { label: "Advance scope", summary: "Đang chờ Tinyfish Fetch xác nhận giá vé và khách sạn trước khi tính tổng tạm ứng." },
          { label: "Recommended option", summary: recommendation.reason },
          { label: "Approval routing", summary: `Tuyến duyệt dự kiến: ${drafts.approver.staffName} — ${drafts.approver.title}.` },
        ],
        approval: {
          status: "awaiting_user_confirmation",
          summary: `Đã chuẩn bị ${drafts.bookingRequest.id}, ${drafts.travelRequest.id} và ${drafts.advanceRequest.id}; chưa đặt/chưa gửi duyệt.`,
          nextAction: "User chọn chuyến bay, khách sạn, kiểm tra bộ nháp rồi xác nhận gửi duyệt.",
        },
        steps: [
          { name: "knowledge.search_travel_policy", status: "completed", summary: `Đã đọc DOC003 theo ACL: ${policyHit.reason}` },
          { name: "staff.resolve_traveler", status: "completed", summary: `${traveler.staffName} — ${traveler.department}.` },
          { name: "travel.calculate_allowance", status: "completed", summary: `${period.calendarDays} ngày/${period.nights} đêm; đã áp dụng định mức chính sách.` },
          { name: "tinyfish.travel_search", status: liveSearch.status === "live" ? "completed" : "skipped", summary: liveSearch.message },
          { name: "flight.search", status: "completed", summary: `Tìm thấy ${flightOptions.length} phương án chuyến bay (${liveSearch.status === "live" ? "live" : "demo"}).` },
          { name: "hotel.search", status: "completed", summary: `Tìm thấy ${hotelOptions.length} khách sạn; ${hotelOptions.filter((item) => item.policyCompliant).length} đúng định mức (${liveSearch.status === "live" ? "live" : "demo"}).` },
          { name: "travel.compare_options", status: "completed", summary: "Đang chờ giá thực tế để so sánh và đề xuất phương án." },
          { name: "booking.create_draft", status: "completed", summary: `Đã chuẩn bị ${drafts.bookingRequest.id}; chưa đặt dịch vụ.` },
          { name: "travel.create_draft", status: "completed", summary: `Đã tạo ${drafts.travelRequest.id}.` },
          { name: "advance.create_draft", status: "completed", summary: `Đã tạo ${drafts.advanceRequest.id}, liên kết ${drafts.travelRequest.id}.` },
          { name: "approval.prepare_route", status: "completed", summary: `Đã chuẩn bị tuyến duyệt tới ${drafts.approver.staffName}; chưa gửi.` },
        ],
      };
      answerSources = [policyHit];
      toolResult = agentResult;
      answer = await composeTravelAgentAnswer(question, user, [policyHit], agentResult);
    }
  } else if (toolIntent === "leave.agent") {
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
        plan: [
          "Tra cứu chính sách nghỉ phép theo quyền của user.",
          "Chuẩn hóa khoảng ngày và tính số ngày làm việc.",
          "Kiểm tra số dư phép và xác định người phê duyệt.",
          "Tạo nháp đơn nếu đủ điều kiện; chờ user xác nhận trước khi gửi.",
        ],
        decisions: [
          {
            label: "Policy & access",
            summary: `Được phép dùng DOC002 làm căn cứ: ${policyHit.reason}`,
          },
          {
            label: "Eligibility",
            summary: eligible
              ? `Đủ điều kiện: cần ${period.workingDays} ngày, còn ${balance.remaining} ngày phép.`
              : `Không đủ điều kiện: cần ${period.workingDays} ngày, chỉ còn ${balance.remaining} ngày phép.`,
          },
          {
            label: "Approver routing",
            summary: `Chuyển theo tuyến quản lý tới ${approver.staffName} — ${approver.title}.`,
          },
        ],
        approval: {
          status: eligible ? "awaiting_user_confirmation" : "blocked",
          summary: draft
            ? `Đã tạo nháp ${draft.id}; chưa gửi ra hệ thống.`
            : "Chưa tạo nháp vì điều kiện số dư không đạt.",
          nextAction: draft
            ? "User mở đơn nháp, kiểm tra nội dung và bấm Gửi yêu cầu."
            : "Điều chỉnh khoảng nghỉ hoặc bổ sung phê duyệt ngoại lệ.",
        },
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

  chatSpan.update({
    output: {
      intent: response.intent,
      answer,
      citationDocumentIds: citations.map((item) => item.document_id),
      latencyMs: response.latencyMs,
    },
  });
  return NextResponse.json(response);
    }),
  );
}
