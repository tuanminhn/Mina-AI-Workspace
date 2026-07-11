import { NextResponse } from "next/server";
import { detectToolIntent } from "@/lib/tools";

const cases = [
  ["Nhân viên được bao nhiêu ngày nghỉ phép năm?", "knowledge.rag"],
  ["Chính sách nghỉ phép của nhân viên là gì?", "knowledge.rag"],
  ["Quy trình xin nghỉ phép gồm những bước nào?", "knowledge.rag"],
  ["Tìm nhân viên Nguyễn Văn An", "staff.search"],
  ["Tra cứu email nhân viên Nguyễn Văn An", "staff.search"],
  ["Ai là nhân viên phòng Nhân sự?", "staff.search"],
  ["Công ty có bao nhiêu người?", "staff.count"],
  ["Tổng số nhân viên toàn công ty là bao nhiêu?", "staff.count"],
  ["Tôi đã check-in lúc mấy giờ?", "attendance.byStaff"],
  ["Tháng này tôi có bao nhiêu ngày đi muộn?", "attendance.byStaff"],
  ["Tạo đơn nghỉ phép cho tôi", "request.createDraft"],
  ["Đăng ký nghỉ phép từ ngày 14 đến 16", "request.createDraft"],
] as const;

export async function GET() {
  const results = cases.map(([question, expected]) => {
    const actual = detectToolIntent(question) || "knowledge.rag";
    return { question, expected, actual, pass: actual === expected };
  });

  return NextResponse.json({
    suite: "intent-routing",
    total: results.length,
    passed: results.filter((item) => item.pass).length,
    results,
  });
}
