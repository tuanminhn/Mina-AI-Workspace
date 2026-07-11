import { NextResponse } from "next/server";
import { getEvaluation, getUser } from "@/lib/data";
import { searchKnowledge } from "@/lib/search";

export async function GET() {
  const cases = getEvaluation().slice(0, 10);
  const results = cases.map((item) => {
    const user = getUser(item.user_id);
    const retrieved = searchKnowledge(item.question_vi, user, 8);
    const authorized = retrieved.filter((hit) => hit.allowed);
    const topAuthorized = authorized[0];
    const deniedTop = retrieved.find((hit) => hit.document_id === item.expected_document_id && !hit.allowed);
    const permission = topAuthorized?.document_id === item.expected_document_id ? "Allow" : deniedTop ? "Deny" : authorized.length ? "Allow" : "Deny";
    const documentMatch =
      item.expected_permission === "Deny"
        ? Boolean(deniedTop || retrieved.find((hit) => hit.document_id === item.expected_document_id))
        : topAuthorized?.document_id === item.expected_document_id;

    return {
      question_id: item.question_id,
      question_vi: item.question_vi,
      user_id: item.user_id,
      expected_permission: item.expected_permission,
      actual_permission: permission,
      expected_document_id: item.expected_document_id,
      actual_document_id:
        permission === "Deny"
          ? deniedTop?.document_id || retrieved[0]?.document_id || ""
          : topAuthorized?.document_id || retrieved[0]?.document_id || "",
      pass: permission === item.expected_permission && documentMatch,
    };
  });

  return NextResponse.json({
    total: results.length,
    passed: results.filter((item) => item.pass).length,
    results,
  });
}
