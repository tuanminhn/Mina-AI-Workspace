import { getUsers } from "./data";
import { normalizeText } from "./search";
import type { User } from "./types";

export function detectToolIntent(question: string) {
  const text = normalizeText(question);
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
