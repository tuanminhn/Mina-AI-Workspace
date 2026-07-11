# Mina Workspace MVP

Secure enterprise knowledge and My Tasco operations AI demo for the AI Workspace problem statement.

## What This MVP Demonstrates

- Vietnamese enterprise knowledge search over the provided Excel dataset.
- RBAC/ABAC filtering before answer generation.
- Grounded answers with document citations and ACL trace.
- User switcher for Employee, Manager, Director, and Executive scenarios.
- Mock My Tasco tool calling for staff search, attendance, and leave request draft.
- Evaluation runner for 10 public test cases.

## Setup

```bash
npm install
npm run ingest
npm run dev
```

Optional LLM answer generation:

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY=...
```

Without `OPENAI_API_KEY`, the app still runs with extractive answers from authorized chunks.

## Demo Flow

1. Select `U004 - Phạm Quốc Dũng`, Engineering Employee.
2. Ask `Cho tôi xem lộ trình sản phẩm quý 2.`.
3. Mina should deny access to Product Confidential knowledge.
4. Switch to a Product user or Executive and ask again.
5. Inspect Citations and ACL Trace panels.
6. Ask `Hôm nay tôi có check-in chưa?` to trigger Attendance mock tool.
7. Ask `Tạo draft nghỉ phép 3 ngày tuần sau.` to trigger request draft.
8. Run Evaluation to show pass/fail cases.

## Access Rules

| Classification | Rule |
| --- | --- |
| Public | Allow all users |
| Internal | Allow all internal employees |
| Confidential | Allow same department or Executive |
| Restricted | Allow Executive only |

## Key Files

- `scripts/ingest.mjs`: reads the Excel dataset and creates JSON data.
- `src/lib/acl.ts`: authorization decision logic.
- `src/lib/search.ts`: local hybrid search over chunks.
- `src/lib/answer.ts`: OpenAI composer with local fallback.
- `src/lib/tools.ts`: My Tasco mock tool adapters.
- `src/app/api/chat/route.ts`: main ask/answer endpoint.
- `src/app/page.tsx`: one-screen demo UI.

## Mock API Examples

```bash
curl -X POST http://localhost:3000/api/mytasco/staff/search \
  -H "Content-Type: application/json" \
  -d '{"example":{"keyword":"Nguyễn"},"pageInfo":{"pageSize":5,"currentPage":0}}'
```

```bash
curl "http://localhost:3000/api/mytasco/attendance/by-staff?userId=U004"
```
