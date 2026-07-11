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
      text: "Anh Nguyễn Văn Nam đi công tác Đà Nẵng từ ngày 20 đến 22/7/2026. Kiểm tra chính sách và định mức được phép; tìm các chuyến bay và khách sạn phù hợp; so sánh rồi đề xuất phương án tối ưu. Sau khi tôi chọn, hãy tạo nháp đặt vé, khách sạn, đề nghị công tác và tạm ứng để tôi kiểm tra trước khi gửi duyệt tới sếp phụ trách.",
      badge: "AI Agent",
      poweredBy: "Tinyfish",
      description: "Policy → search → compare → booking → duyệt",
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
  ];

  return NextResponse.json({
    users: getUsers(),
    evaluation: getEvaluation().slice(0, 50),
    demoQuestions: priorityQuestions,
  });
}
