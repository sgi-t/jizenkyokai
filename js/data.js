/**
 * スタッフデータ・棟定義
 */

// 棟定義
const BUILDINGS = {
  admin: { id: 'admin', label: '管理', requiredStaff: 0, color: '#78909C' },
  A: { id: 'A', label: 'A棟', requiredStaff: 1, color: '#4FC3F7' },
  AB: { id: 'AB', label: 'A棟B棟', requiredStaff: 0, color: '#4DD0E1' },
  B: { id: 'B', label: 'B棟', requiredStaff: 1, color: '#81C784' },
  C: { id: 'C', label: 'C棟', requiredStaff: 1, color: '#FFB74D' },
  D: { id: 'D', label: 'D棟', requiredStaff: 1, color: '#CE93D8' },
  psy: { id: 'psy', label: '心理', requiredStaff: 0, color: '#F48FB1' },
};

const BUILDING_ORDER = ['admin', 'A', 'AB', 'B', 'C', 'D', 'psy'];

// 初期スタッフデータ
const DEFAULT_STAFF = [
  { id: 'S01', name: 'スタッフA', building: 'admin', role: 'admin', note: '事務局長', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S02', name: 'スタッフB', building: 'admin', role: 'admin', note: '事務', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S03', name: 'スタッフC', building: 'A', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S04', name: 'スタッフD', building: 'A', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S05', name: 'スタッフE', building: 'A', role: 'staff', note: '', annualLeaveTotal: 10, annualLeaveUsed: 0 },
  { id: 'S06', name: 'スタッフF', building: 'AB', role: 'staff', note: '', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S07', name: 'スタッフG', building: 'AB', role: 'staff', note: '', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S08', name: 'スタッフH', building: 'B', role: 'staff', note: '', annualLeaveTotal: 10, annualLeaveUsed: 0 },
  { id: 'S09', name: 'スタッフI', building: 'B', role: 'staff', note: '', annualLeaveTotal: 12, annualLeaveUsed: 0 },
  { id: 'S10', name: 'スタッフJ', building: 'B', role: 'staff', note: '', annualLeaveTotal: 12, annualLeaveUsed: 0 },
  { id: 'S11', name: 'スタッフK', building: 'C', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S12', name: 'スタッフL', building: 'C', role: 'staff', note: '', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S13', name: 'スタッフM', building: 'C', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S14', name: 'スタッフN', building: 'C', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S15', name: 'スタッフO', building: 'D', role: 'staff', note: '', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S16', name: 'スタッフP', building: 'D', role: 'staff', note: '', annualLeaveTotal: 10, annualLeaveUsed: 0 },
  { id: 'S17', name: 'スタッフQ', building: 'D', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S18', name: 'スタッフR', building: 'D', role: 'staff', note: '', annualLeaveTotal: 15, annualLeaveUsed: 0 },
  { id: 'S19', name: 'スタッフS', building: 'psy', role: 'staff', note: '心理士', annualLeaveTotal: 20, annualLeaveUsed: 0 },
  { id: 'S20', name: 'スタッフT', building: 'psy', role: 'staff', note: '心理士', annualLeaveTotal: 20, annualLeaveUsed: 0 },
];

// 制約定数
const CONSTRAINTS = {
  maxWeeklyHours: 40,
  maxWeeklyOvernights: 2,
  minMonthlyDaysOff: 9,
  maxWorkEndTime: '22:00',
  allowedWakeUpTimes: ['06:00', '07:00'],
};

// 曜日表示
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const DAY_NAMES_FULL = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

/**
 * 指定月の日数を取得
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * 指定日の曜日インデックスを取得 (0=日, 6=土)
 */
function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

/**
 * 指定月の全日付配列を生成
 */
function generateMonthDates(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = getDayOfWeek(year, month, d);
    dates.push({
      day: d,
      dayOfWeek: dow,
      dayName: DAY_NAMES[dow],
      isWeekend: dow === 0 || dow === 6,
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }
  return dates;
}

/**
 * 週番号を計算（月曜始まり）
 */
function getWeekNumber(year, month, day) {
  const date = new Date(year, month - 1, day);
  const firstDay = new Date(year, month - 1, 1);
  // 月曜始まりに調整
  const firstMonday = new Date(firstDay);
  const dayOfWeek = firstDay.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  firstMonday.setDate(firstDay.getDate() + diff);

  const diffDays = Math.floor((date - firstMonday) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

/**
 * 指定日が属する週の月曜〜日曜の日付範囲を取得
 */
function getWeekRange(year, month, day) {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return { start: monday, end: sunday };
}
