import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { createLeaveDraft } from "@/lib/tools";

export async function POST(request: Request) {
  const body = await request.json();
  const user = getUser(String(body.userId || "U001"));
  return NextResponse.json({
    status: "success",
    message: "SUCCESS",
    body: createLeaveDraft(user, String(body.reason || "Annual leave")),
    requestId: crypto.randomUUID(),
  });
}
