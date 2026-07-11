import { NextResponse } from "next/server";
import { staffSearch } from "@/lib/tools";

export async function POST(request: Request) {
  const body = await request.json();
  const keyword = String(body?.example?.keyword || "");
  const result = staffSearch(keyword);
  return NextResponse.json({
    status: "success",
    message: "SUCCESS",
    body: { result, pageInfo: { pageSize: body?.pageInfo?.pageSize || 20, currentPage: body?.pageInfo?.currentPage || 0, totalRecord: result.length } },
    requestId: crypto.randomUUID(),
  });
}
