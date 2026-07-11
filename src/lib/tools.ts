import { getUsers } from "./data";
import { normalizeText } from "./search";
import type { User } from "./types";

export type LeavePeriod = {
  fromDate: string;
  toDate: string;
  workingDays: number;
};

export function detectToolIntent(question: string) {
  const text = normalizeText(question);
  const isLeaveRequest = /(nghi phep|don nghi|ngay nghi)/.test(text);
  const leaveAgentSignals = [
    /(chinh sach|quy dinh)/.test(text),
    /(so ngay|con bao nhieu|kiem tra.*ngay nghi)/.test(text),
    /(quan ly|phe duyet|approver)/.test(text),
    /(tao|lap).*(nhap|draft|don)/.test(text),
  ].filter(Boolean).length;
  if (isLeaveRequest && leaveAgentSignals >= 2) return "leave.agent";
  const asksForStaffCount =
    /(bao nhieu|tong so)/.test(text) &&
    /(nguoi|nhan vien|nhan su)/.test(text) &&
    /(cong ty|toan cong ty|tasco)/.test(text);
  if (asksForStaffCount) return "staff.count";
  const asksForStaff = /(tim|tra cuu|cho biet|ai la)/.test(text) && /(nhan vien|staff|email|so dien thoai|lien he)/.test(text);
  if (asksForStaff) return "staff.search";
  if (/(cham cong|check in|checkin|di muon|attendance)/.test(text)) return "attendance.byStaff";
  const asksForLeaveInformation = /(chinh sach|quy dinh|quy trinh|huong dan|bao nhieu|la gi|nhu the nao|gom nhung)/.test(text);
  const asksToCreateLeave =
    !asksForLeaveInformation &&
    /(tao|lap|draft|gui|dang ky|xin)/.test(text) &&
    /(don nghi|nghi phep|request)/.test(text);
  if (asksToCreateLeave) return "request.createDraft";
  return null;
}

export function staffCount() {
  const users = getUsers();
  const active = users.filter((user) => user.status === "Active");
  return {
    total: active.length,
    byDepartment: Object.entries(
      active.reduce<Record<string, number>>((counts, user) => {
        counts[user.department] = (counts[user.department] || 0) + 1;
        return counts;
      }, {}),
    ).map(([department, count]) => ({ department, count })),
  };
}

export function staffSearch(keyword: string) {
  const needle = normalizeText(keyword);
  return getUsers()
    .filter((user) => normalizeText(`${user.full_name} ${user.email} ${user.department} ${user.role}`).includes(needle))
    .slice(0, 8)
    .map((user, index) => ({
      staffId: 10000 + index + 1,
      staffCode: user.user_id,
      staffName: user.full_name,
      title: user.role,
      email: user.email,
      phoneNumber: `09${String(10000000 + index).slice(0, 8)}`,
      status: 1,
      listOrgUnit: [{ orgUnitId: index + 10, orgUnitName: user.department }],
    }));
}

export function attendanceByStaff(user: User) {
  return {
    result: [
      {
        date: "2026-07-11",
        checkIn: "08:04",
        checkOut: "",
        workingHours: 3.8,
        status: "on_time",
        location: "HQ Ha Noi",
      },
    ],
    summary: { workingDays: 9, lateDays: 1, absentDays: 0 },
    user: { userId: user.user_id, name: user.full_name },
  };
}

export function createLeaveDraft(user: User, question: string) {
  return {
    id: 9001,
    requestType: "LEAVE",
    status: "DRAFT",
    staffId: user.user_id,
    fromDate: "2026-07-14",
    toDate: "2026-07-16",
    reason: question,
    currentApprover: "manager-demo",
  };
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function countWorkingDays(fromDate: string, toDate: string) {
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  let count = 0;
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function parseLeavePeriod(question: string, now = new Date()): LeavePeriod | null {
  const text = normalizeText(question);
  const range = text.match(/(?:tu\s+)?(\d{1,2})\s*(?:den|toi|-)\s*(\d{1,2})\s*[\/]?\s*(\d{1,2})(?:\s*[\/]\s*(\d{4}))?/);
  if (!range) return null;
  const fromDay = Number(range[1]);
  const toDay = Number(range[2]);
  const month = Number(range[3]);
  const year = range[4] ? Number(range[4]) : now.getFullYear();
  const fromDate = formatIsoDate(year, month, fromDay);
  const toDate = formatIsoDate(year, month, toDay);
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from > to) return null;
  return { fromDate, toDate, workingDays: countWorkingDays(fromDate, toDate) };
}

export function leaveBalance(user: User) {
  const numericId = Number(user.user_id.replace(/\D/g, "")) || 1;
  const annualAllowance = 15;
  const used = 3 + (numericId % 4);
  return { annualAllowance, used, remaining: annualAllowance - used, unit: "working_day" };
}

const departmentApprovers: Record<string, { staffCode: string; staffName: string; title: string; email: string }> = {
  Engineering: { staffCode: "MGR-ENG-01", staffName: "Nguyễn Minh Hoàng", title: "Engineering Manager", email: "hoang.nguyen@synthetic.local" },
  Product: { staffCode: "MGR-PROD-01", staffName: "Lê Minh Châu", title: "Product Director", email: "user003@synthetic.local" },
  Finance: { staffCode: "MGR-FIN-01", staffName: "Trần Thị Bình", title: "Finance Manager", email: "user002@synthetic.local" },
  Operations: { staffCode: "MGR-OPS-01", staffName: "Hoàng Thu Hà", title: "Operations Manager", email: "user005@synthetic.local" },
  "Human Resources": { staffCode: "MGR-HR-01", staffName: "Phạm Mai Phương", title: "HR Manager", email: "phuong.pham@synthetic.local" },
};

export function findLeaveApprover(user: User) {
  return departmentApprovers[user.department] || {
    staffCode: "MGR-COMPANY-01",
    staffName: "Quản lý trực tiếp",
    title: `${user.department} Manager`,
    email: "manager@synthetic.local",
  };
}

export function createAgentLeaveDraft(
  user: User,
  question: string,
  period: LeavePeriod,
  approver: ReturnType<typeof findLeaveApprover>,
) {
  return {
    id: `LR-${Date.now().toString().slice(-8)}`,
    requestType: "ANNUAL_LEAVE",
    status: "DRAFT",
    staffId: user.user_id,
    staffName: user.full_name,
    fromDate: period.fromDate,
    toDate: period.toDate,
    workingDays: period.workingDays,
    reason: question,
    currentApprover: approver,
    submitted: false,
  };
}
