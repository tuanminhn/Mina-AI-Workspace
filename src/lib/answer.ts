import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import type { Citation, SearchHit, User } from "./types";

function extractSnippet(content: string) {
  return content
    .replace(/#+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 460);
}

export function citationsFromHits(hits: SearchHit[]): Citation[] {
  return hits.slice(0, 4).map((hit) => ({
    chunk_id: hit.chunk_id,
    document_id: hit.document_id,
    title: hit.title,
    department: hit.department,
    classification: hit.classification,
    quote: extractSnippet(hit.content),
  }));
}

export function fallbackAnswer(question: string, hits: SearchHit[]) {
  if (!hits.length) {
    return `Em chưa tìm thấy nguồn phù hợp cho câu hỏi: "${question}". Anh thử hỏi cụ thể hơn hoặc chọn user khác để kiểm tra quyền truy cập.`;
  }
  const bullets = hits.slice(0, 3).map((hit) => `- ${extractSnippet(hit.content)}`).join("\n");
  return `Dựa trên các tài liệu được cấp quyền, câu trả lời tóm tắt là:\n${bullets}`;
}

export async function composeAnswer(question: string, user: User, hits: SearchHit[]) {
  if (!process.env.OPENAI_API_KEY) return fallbackAnswer(question, hits);

  const client = observeOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  const context = hits
    .slice(0, 5)
    .map(
      (hit) =>
        `[${hit.document_id} | ${hit.title} | ${hit.classification} | ${hit.department}]\n${hit.content}`,
    )
    .join("\n\n---\n\n");

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Bạn là Mina Workspace, trợ lý tri thức nội bộ. Chỉ trả lời dựa trên context đã được cấp quyền. Trả lời tiếng Việt, rõ ràng, ngắn gọn, có nhắc mã tài liệu khi phù hợp. Không bịa thông tin ngoài context.",
      },
      {
        role: "user",
        content: `User: ${user.full_name} | Role: ${user.role} | Department: ${user.department}\nQuestion: ${question}\n\nAuthorized context:\n${context}`,
      },
    ],
  });

  return response.choices[0]?.message.content || fallbackAnswer(question, hits);
}

export async function composeLeaveAgentAnswer(
  question: string,
  user: User,
  hits: SearchHit[],
  result: Record<string, unknown>,
) {
  const fallback = String(result.fallbackAnswer || "Đã hoàn tất luồng xử lý nghỉ phép.");
  if (!process.env.OPENAI_API_KEY) return fallback;

  const client = observeOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  const policyContext = hits.slice(0, 3).map((hit) => `[${hit.document_id}] ${hit.content}`).join("\n\n");
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Bạn là Mina Leave Agent. Hãy báo cáo ngắn gọn bằng tiếng Việt theo 4 bước: chính sách, số ngày/số dư, người phê duyệt, nháp đơn. Chỉ dùng dữ liệu tool và policy context được cung cấp. Nêu rõ nháp chưa được gửi. Không tự thêm dữ liệu.",
      },
      {
        role: "user",
        content: `User: ${user.full_name}\nYêu cầu: ${question}\n\nPolicy context:\n${policyContext}\n\nTool results:\n${JSON.stringify(result)}`,
      },
    ],
  });
  return response.choices[0]?.message.content || fallback;
}

export async function composeTravelAgentAnswer(
  question: string,
  user: User,
  hits: SearchHit[],
  result: Record<string, unknown>,
) {
  const fallback = String(result.fallbackAnswer || "Đã hoàn tất luồng chuẩn bị công tác và tạm ứng.");
  if (!process.env.OPENAI_API_KEY) return fallback;

  const client = observeOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  const policyContext = hits.slice(0, 3).map((hit) => `[${hit.document_id}] ${hit.content}`).join("\n\n");
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Bạn là Mina Travel Agent. Báo cáo ngắn gọn bằng tiếng Việt chỉ các dữ liệu hệ thống đã xác nhận: chính sách, lịch công tác, định mức, người duyệt và trạng thái nháp. TUYỆT ĐỐI không nêu giá vé/khách sạn, phương án đề xuất hay tổng tạm ứng khi web data chưa được Fetch xác nhận; thay bằng đúng câu: “Đang lấy thông tin từ internet, anh chị vui lòng chờ...”. Luôn nêu rõ chưa đặt dịch vụ, chưa gửi duyệt.",
      },
      {
        role: "user",
        content: `Operator: ${user.full_name}\nYêu cầu: ${question}\n\nPolicy context:\n${policyContext}\n\nTool results:\n${JSON.stringify(result)}`,
      },
    ],
  });
  return response.choices[0]?.message.content || fallback;
}
