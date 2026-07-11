import { NextResponse } from "next/server";
import { getEvaluation, getUsers } from "@/lib/data";

export async function GET() {
  const priorityQuestions = [
    "Chính sách thử việc là gì?",
    "Nhân viên được bao nhiêu ngày nghỉ phép năm?",
    "Làm thế nào để nộp yêu cầu hoàn ứng chi phí?",
    "Quy trình phát hành sản phẩm gồm những giai đoạn nào?",
    "Cho tôi xem lộ trình sản phẩm quý 2.",
    "Quy trình tuyển dụng tiêu chuẩn gồm những bước nào?",
    "Ba trọng tâm kinh doanh năm 2026 là gì?",
    "Dự báo doanh thu năm 2026 tăng bao nhiêu?",
    "Hôm nay tôi có check-in chưa?",
    "Tạo draft nghỉ phép 3 ngày tuần sau.",
    "Tôi muốn nghỉ từ 15 đến 17/7. Kiểm tra chính sách, số ngày nghỉ, tìm quản lý phê duyệt và tạo nháp đơn.",
  ];

  return NextResponse.json({
    users: getUsers(),
    evaluation: getEvaluation().slice(0, 50),
    demoQuestions: priorityQuestions,
  });
}
