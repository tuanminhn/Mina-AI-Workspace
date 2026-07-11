export type Role = "Employee" | "Manager" | "Director" | "Executive";
export type Classification = "Public" | "Internal" | "Confidential" | "Restricted";

export type User = {
  user_id: string;
  full_name: string;
  department: string;
  role: Role;
  email: string;
  status: string;
};

export type DocumentRecord = {
  document_id: string;
  title: string;
  department: string;
  source_department?: string;
  classification: Classification;
  content_vi: string;
};

export type Chunk = {
  chunk_id: string;
  document_id: string;
  title: string;
  department: string;
  source_department?: string;
  classification: Classification;
  allowed_access: string;
  tags: string;
  last_updated: string;
  content: string;
};

export type EvaluationCase = {
  question_id: string;
  category: string;
  user_id: string;
  user_role: Role;
  user_department: string;
  question_vi: string;
  expected_permission: "Allow" | "Deny";
  expected_document_id: string;
  answer_type: string;
  difficulty: string;
};

export type SearchHit = Chunk & {
  score: number;
  allowed: boolean;
  reason: string;
};

export type Citation = {
  chunk_id: string;
  document_id: string;
  title: string;
  department: string;
  classification: Classification;
  quote: string;
};
