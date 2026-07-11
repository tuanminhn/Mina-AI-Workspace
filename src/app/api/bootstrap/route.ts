import { NextResponse } from "next/server";
import { getEvaluation, getUsers } from "@/lib/data";

export async function GET() {
  const priorityQuestions = [
    { text: "Chính sách thử việc là gì?" },
    {
      text: "Tôi muốn nghỉ từ 15 đến 17/7. Kiểm tra chính sách, số ngày nghỉ, tìm quản lý phê duyệt và tạo nháp đơn.",
      badge: "AI Agent",
      description: "5 bước: policy → ngày phép → quản lý → nháp",
    },
    {
      text: "Tôi đang thử việc, tôi có được hoàn ứng chi phí công tác không?",
      badge: "Multi-doc",
    },
    { text: "Cho tôi xem lộ trình sản phẩm quý 2.", badge: "ACL" },
    { text: "Dự báo doanh thu năm 2026 tăng bao nhiêu?", badge: "Restricted" },
    { text: "Sự cố P1 cần phản hồi trong bao lâu?" },
    { text: "Dữ liệu cá nhân chỉ được xử lý khi nào?" },
    { text: "Mua sắm trên 100 triệu cần bao nhiêu báo giá?" },
    { text: "Các chỉ số trọng tâm trong chiến lược sản phẩm là gì?" },
  ];

  return NextResponse.json({
    users: getUsers(),
    evaluation: getEvaluation().slice(0, 50),
    demoQuestions: priorityQuestions,
  });
}
