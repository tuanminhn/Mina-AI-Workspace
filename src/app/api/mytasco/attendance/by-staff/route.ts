import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { attendanceByStaff } from "@/lib/tools";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = getUser(url.searchParams.get("userId") || "U001");
  return NextResponse.json({
    status: "success",
    message: "SUCCESS",
    body: attendanceByStaff(user),
    requestId: crypto.randomUUID(),
  });
}
