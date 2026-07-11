import { getUsers } from "./data";
import { normalizeText } from "./search";
import type { User } from "./types";

export type LeavePeriod = {
  fromDate: string;
  toDate: string;
  workingDays: number;
};

export type TravelPeriod = LeavePeriod & {
  calendarDays: number;
  nights: number;
};

export function detectToolIntent(question: string) {
  const text = normalizeText(question);
  const isTravelAgent = /(cong tac)/.test(text) && /(tao|lap).*(nhap|de nghi)/.test(text) && /(tam ung)/.test(text);
  if (isTravelAgent) return "travel.agent";
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
  const range = text.match(/(?:tu\s+)?(?:ngay\s+)?(\d{1,2})\s*(?:den|toi|-)\s*(?:ngay\s+)?(\d{1,2})\s*[\/]?\s*(\d{1,2})(?:\s*[\/]\s*(\d{4}))?/);
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

export function parseTravelPeriod(question: string, now = new Date()): TravelPeriod | null {
  const period = parseLeavePeriod(question, now);
  if (!period) return null;
  const from = new Date(`${period.fromDate}T00:00:00Z`);
  const to = new Date(`${period.toDate}T00:00:00Z`);
  const calendarDays = Math.floor((to.valueOf() - from.valueOf()) / 86_400_000) + 1;
  return { ...period, calendarDays, nights: Math.max(0, calendarDays - 1) };
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

export function findTravelEmployee(question: string) {
  const text = normalizeText(question);
  if (!text.includes("nguyen van nam")) return null;
  return {
    staffId: "NVN-021",
    staffName: "Nguyễn Văn Nam",
    title: "Senior Business Development Executive",
    department: "Business Development",
    email: "nam.nguyen@synthetic.local",
    status: "Active",
  };
}

export function calculateTravelAllowance(destination: string, period: TravelPeriod) {
  const largeCity = normalizeText(destination).includes("da nang");
  const hotelPerNight = largeCity ? 1_500_000 : 1_000_000;
  const mealPerDay = 300_000;
  const hotelTotal = hotelPerNight * period.nights;
  const mealTotal = mealPerDay * period.calendarDays;
  return {
    currency: "VND",
    destination,
    cityTier: largeCity ? "major_city" : "other_location",
    hotelPerNight,
    nights: period.nights,
    hotelTotal,
    mealPerDay,
    days: period.calendarDays,
    mealTotal,
    requestedAdvance: hotelTotal + mealTotal,
    excludes: ["vé máy bay", "di chuyển nội thành"],
  };
}

export function searchFlightOptions(period: TravelPeriod) {
  return [
    { id: "FL-VN-01", airline: "Vietnam Airlines", outbound: `${period.fromDate} 08:10`, return: `${period.toDate} 18:30`, route: "HAN ↔ DAD", totalPrice: 2_450_000, baggage: "23kg", refundable: true },
    { id: "FL-VJ-02", airline: "Vietjet Air", outbound: `${period.fromDate} 06:20`, return: `${period.toDate} 20:10`, route: "HAN ↔ DAD", totalPrice: 1_850_000, baggage: "7kg", refundable: false },
    { id: "FL-QH-03", airline: "Bamboo Airways", outbound: `${period.fromDate} 09:00`, return: `${period.toDate} 17:45`, route: "HAN ↔ DAD", totalPrice: 2_150_000, baggage: "20kg", refundable: true },
  ];
}

export function searchHotelOptions(period: TravelPeriod, hotelLimit: number) {
  return [
    { id: "HT-DN-01", name: "Tasco Riverside Hotel", area: "Hải Châu", pricePerNight: 1_250_000, totalPrice: 1_250_000 * period.nights, distanceKm: 1.2, rating: 4.4, refundable: true, policyCompliant: true },
    { id: "HT-DN-02", name: "Han River Business Hotel", area: "Sơn Trà", pricePerNight: 1_450_000, totalPrice: 1_450_000 * period.nights, distanceKm: 2.1, rating: 4.7, refundable: true, policyCompliant: true },
    { id: "HT-DN-03", name: "Ocean Premier Đà Nẵng", area: "Ngũ Hành Sơn", pricePerNight: 1_750_000, totalPrice: 1_750_000 * period.nights, distanceKm: 6.8, rating: 4.8, refundable: false, policyCompliant: 1_750_000 <= hotelLimit },
  ];
}

export function recommendTravelOptions(
  flights: ReturnType<typeof searchFlightOptions>,
  hotels: ReturnType<typeof searchHotelOptions>,
) {
  const flight = flights.find((item) => item.id === "FL-QH-03") || flights[0];
  const compliantHotels = hotels.filter((item) => item.policyCompliant);
  const hotel = compliantHotels.sort((a, b) => a.distanceKm - b.distanceKm)[0];
  return {
    flightId: flight.id,
    hotelId: hotel.id,
    reason: "Cân bằng giờ bay thuận tiện, hành lý ký gửi, khả năng hoàn huỷ, khách sạn đúng định mức và gần khu vực làm việc.",
  };
}

export function createTravelDraftBundle(
  traveler: NonNullable<ReturnType<typeof findTravelEmployee>>,
  period: TravelPeriod,
  allowance: ReturnType<typeof calculateTravelAllowance>,
  flight: ReturnType<typeof searchFlightOptions>[number],
  hotel: ReturnType<typeof searchHotelOptions>[number],
) {
  const suffix = Date.now().toString().slice(-8);
  const approver = {
    staffCode: "MGR-BD-01",
    staffName: "Trần Quốc Khánh",
    title: "Business Development Director",
    email: "khanh.tran@synthetic.local",
  };
  const travelRequest = {
    id: `TR-${suffix}`,
    type: "BUSINESS_TRIP",
    status: "DRAFT",
    traveler,
    destination: allowance.destination,
    fromDate: period.fromDate,
    toDate: period.toDate,
    calendarDays: period.calendarDays,
    nights: period.nights,
    purpose: "Công tác và làm việc với đối tác tại Đà Nẵng.",
    approver,
  };
  const advanceRequest = {
    id: `ADV-${suffix}`,
    type: "TRAVEL_ADVANCE",
    status: "DRAFT",
    linkedTravelRequestId: travelRequest.id,
    amount: flight.totalPrice + hotel.totalPrice + allowance.mealTotal,
    currency: allowance.currency,
    breakdown: allowance,
    note: "Tạm ứng vé máy bay, khách sạn và phụ cấp ăn uống theo phương án đã chọn.",
    approver,
  };
  const bookingRequest = {
    id: `BKG-${suffix}`,
    type: "TRAVEL_BOOKING",
    status: "DRAFT",
    flight,
    hotel,
    totalPrice: flight.totalPrice + hotel.totalPrice,
    currency: allowance.currency,
    confirmed: false,
  };
  return { travelRequest, advanceRequest, bookingRequest, approver, submitted: false };
}
