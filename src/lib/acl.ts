import type { Chunk, User } from "./types";

export function canAccess(user: User, item: Pick<Chunk, "classification" | "department" | "title">) {
  if (item.classification === "Public") {
    return { allowed: true, reason: "Public: mọi người dùng đều được truy cập." };
  }
  if (item.classification === "Internal") {
    return { allowed: true, reason: "Internal: mọi nhân viên nội bộ được truy cập." };
  }
  if (item.classification === "Restricted") {
    const allowed = user.role === "Executive";
    return {
      allowed,
      reason: allowed
        ? "Restricted: user là Executive."
        : `Restricted: chỉ Executive được truy cập, user hiện tại là ${user.role}.`,
    };
  }
  if (item.classification === "Confidential") {
    const allowed = user.role === "Executive" || user.department === item.department;
    return {
      allowed,
      reason: allowed
        ? `Confidential: ${user.role === "Executive" ? "Executive được truy cập mọi phòng ban" : "user cùng phòng ban sở hữu tài liệu"}.`
        : `Confidential: tài liệu thuộc ${item.department}, user thuộc ${user.department}.`,
    };
  }
  return { allowed: false, reason: "Không tìm thấy rule truy cập phù hợp." };
}
