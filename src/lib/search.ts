import { canAccess } from "./acl";
import { getChunks } from "./data";
import type { SearchHit, User } from "./types";

const stopWords = new Set([
  "la",
  "gi",
  "va",
  "cua",
  "cho",
  "toi",
  "duoc",
  "nhu",
  "the",
  "nao",
  "bao",
  "nhieu",
  "trong",
  "nam",
  "quy",
  "co",
  "khong",
  "mot",
  "cac",
  "can",
  "chinh",
  "sach",
  "yeu",
  "cau",
]);

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/thử/g, " probation ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function textTokens(value: string) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function scoreChunk(
  queryTokens: string[],
  chunk: ReturnType<typeof getChunks>[number],
  documentFrequency: Map<string, number>,
  totalChunks: number,
) {
  const titleTokens = textTokens(chunk.title);
  const body = normalizeText(`${chunk.tags} ${chunk.department} ${chunk.classification} ${chunk.content}`);
  const bodyTokens = textTokens(body);
  let score = 0;

  for (const token of queryTokens) {
    const rarity = 1 + Math.log((totalChunks + 1) / ((documentFrequency.get(token) || 0) + 1));
    if (bodyTokens.has(token)) score += rarity * (token.length > 4 ? 2 : 1);
    if (titleTokens.has(token)) score += rarity * 2.5;
  }

  for (let index = 0; index < queryTokens.length - 1; index += 1) {
    const phrase = `${queryTokens[index]} ${queryTokens[index + 1]}`;
    if (body.includes(phrase)) score += 3;
    if (normalizeText(chunk.title).includes(phrase)) score += 6;
  }

  for (const phraseLength of [3, 4]) {
    for (let index = 0; index <= queryTokens.length - phraseLength; index += 1) {
      const phrase = queryTokens.slice(index, index + phraseLength).join(" ");
      if (body.includes(phrase)) score += phraseLength === 3 ? 25 : 35;
      if (normalizeText(chunk.title).includes(phrase)) score += phraseLength === 3 ? 35 : 50;
    }
  }

  return Number(score.toFixed(3));
}

export function searchKnowledge(question: string, user: User, limit = 8): SearchHit[] {
  const queryTokens = tokens(question);
  if (!queryTokens.length) return [];

  const chunks = getChunks();
  const documentFrequency = new Map<string, number>();
  for (const token of queryTokens) {
    const count = chunks.reduce((total, chunk) => {
      const words = textTokens(`${chunk.title} ${chunk.tags} ${chunk.department} ${chunk.classification} ${chunk.content}`);
      return total + (words.has(token) ? 1 : 0);
    }, 0);
    documentFrequency.set(token, count);
  }

  const ranked = chunks
    .map((chunk) => {
      const score = scoreChunk(queryTokens, chunk, documentFrequency, chunks.length);
      const decision = canAccess(user, chunk);
      return { ...chunk, score, allowed: decision.allowed, reason: decision.reason };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);

  const documentCounts = new Map<string, number>();
  const diversified: SearchHit[] = [];
  for (const hit of ranked) {
    const count = documentCounts.get(hit.document_id) || 0;
    if (count >= 2) continue;
    diversified.push(hit);
    documentCounts.set(hit.document_id, count + 1);
    if (diversified.length >= limit) break;
  }

  return diversified;
}
