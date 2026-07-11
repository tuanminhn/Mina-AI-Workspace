import fs from "node:fs/promises";

const cases = JSON.parse(await fs.readFile(new URL("../data/evaluation.json", import.meta.url), "utf8"));
const results = [];

for (const [index, item] of cases.entries()) {
  const response = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: item.user_id, question: item.question_vi }),
  });

  if (!response.ok) {
    throw new Error(`Case ${item.question_id} failed: HTTP ${response.status}`);
  }

  const actual = await response.json();
  results.push({
    ...item,
    actual_answer: actual.answer || "",
    actual_intent: actual.intent || "",
    actual_document_ids: [...new Set((actual.citations || []).map((citation) => citation.document_id))].join("; "),
    latency_ms: actual.latencyMs ?? null,
  });
  process.stdout.write(`[${index + 1}/${cases.length}] ${item.question_id}\n`);
}

await fs.writeFile("/private/tmp/tasco-ai-workspace-batch-results.json", JSON.stringify(results, null, 2));
