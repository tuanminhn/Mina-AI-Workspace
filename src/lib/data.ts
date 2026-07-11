import fs from "node:fs";
import path from "node:path";
import type { Chunk, DocumentRecord, EvaluationCase, User } from "./types";

const dataDir = path.join(process.cwd(), "data");

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function getUsers() {
  return readJson<User[]>("users.json", []);
}

export function getChunks() {
  return readJson<Chunk[]>("chunks.json", []);
}

export function getDocuments() {
  return readJson<DocumentRecord[]>("documents.json", []);
}

export function getEvaluation() {
  return readJson<EvaluationCase[]>("evaluation.json", []);
}

export function getUser(userId: string) {
  return getUsers().find((user) => user.user_id === userId) || getUsers()[0];
}

export function appendAuditLog(entry: unknown) {
  const filePath = path.join(dataDir, "audit_logs.jsonl");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
}
