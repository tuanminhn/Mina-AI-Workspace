import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const source =
  process.argv[2] ||
  "/Users/mike/Desktop/AABW_problemBrief/TascoPB1/ai_workspace_dataset_vietnamese_participants.xlsm";
const outDir = path.join(process.cwd(), "data");

function rows(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { range: 2, defval: "" });
}

function normalizeDepartment(department) {
  const map = {
    HR: "Human Resources",
    "Executive Office": "Executive Office",
  };
  return map[department] || department;
}

function chunkDocument(doc, metadata) {
  const text = String(doc.content_vi || "").replace(/\r/g, "").trim();
  const parts = text
    .split(/\n(?=##+ |\d+\.|### )/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks = parts.length ? parts : [text];
  return chunks.map((content, index) => ({
    chunk_id: `${doc.document_id}#${String(index + 1).padStart(2, "0")}`,
    document_id: doc.document_id,
    title: doc.title,
    department: normalizeDepartment(doc.department),
    source_department: doc.department,
    classification: doc.classification,
    allowed_access: metadata?.allowed_access || "",
    tags: metadata?.tags || "",
    last_updated: metadata?.last_updated || "",
    content,
  }));
}

const workbook = XLSX.readFile(source, { cellDates: true });
const documents = rows("Documents").map((row) => ({
  document_id: String(row.document_id),
  title: String(row.title),
  department: normalizeDepartment(String(row.department)),
  source_department: String(row.department),
  classification: String(row.classification),
  content_vi: String(row.content_vi),
}));

const metadata = rows("Document_Metadata").map((row) => ({
  document_id: String(row.document_id),
  title: String(row.title),
  department: normalizeDepartment(String(row.department)),
  source_department: String(row.department),
  classification: String(row.classification),
  owner: String(row.owner),
  allowed_access: String(row.allowed_access),
  last_updated: row.last_updated instanceof Date ? row.last_updated.toISOString().slice(0, 10) : String(row.last_updated),
  tags: String(row.tags),
  language: String(row.language),
  word_count: Number(row.word_count || 0),
}));

const metadataById = Object.fromEntries(metadata.map((row) => [row.document_id, row]));
const chunks = documents.flatMap((doc) => chunkDocument(doc, metadataById[doc.document_id]));

const users = rows("Users").map((row) => ({
  user_id: String(row.user_id),
  full_name: String(row.full_name),
  department: normalizeDepartment(String(row.department)),
  role: String(row.role),
  email: String(row.email),
  status: String(row.status),
}));

const departments = rows("Departments").map((row) => ({
  department_id: String(row.department_id),
  department_en: normalizeDepartment(String(row.department_en)),
  department_vi: String(row.department_vi),
  knowledge_space: String(row.knowledge_space),
}));

const permissions = rows("Permissions").map((row) => ({
  classification: String(row.classification),
  employee: String(row.employee),
  manager: String(row.manager),
  director: String(row.director),
  executive: String(row.executive),
  rule_description_vi: String(row.rule_description_vi),
}));

const evaluation = rows("Public_Evaluation").map((row) => ({
  question_id: String(row.question_id),
  category: String(row.category),
  user_id: String(row.user_id),
  user_role: String(row.user_role),
  user_department: normalizeDepartment(String(row.user_department)),
  question_vi: String(row.question_vi),
  expected_permission: String(row.expected_permission),
  expected_document_id: String(row.expected_document_id),
  answer_type: String(row.answer_type),
  difficulty: String(row.difficulty),
}));

fs.mkdirSync(outDir, { recursive: true });
for (const [name, value] of Object.entries({
  documents,
  document_metadata: metadata,
  users,
  departments,
  permissions,
  evaluation,
  chunks,
})) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

fs.writeFileSync(
  path.join(outDir, "audit_logs.jsonl"),
  "",
  { flag: fs.existsSync(path.join(outDir, "audit_logs.jsonl")) ? "a" : "w" },
);

console.log(
  `Ingested ${documents.length} documents, ${chunks.length} chunks, ${users.length} users, ${evaluation.length} eval cases.`,
);
