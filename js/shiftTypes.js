/**
 * シフト種別定義
 * 各シフトタイプの名称、時間帯、勤務時間数、表示色などを管理
 */

const SHIFT_TYPES = {
  work: {
    id: 'work',
    label: '勤',
    fullLabel: '勤務',
    startTime: '09:00',
    endTime: '17:00',
    workHours: 8,
    color: '#81C784',
    bgColor: 'rgba(129, 199, 132, 0.15)',
    borderColor: 'rgba(129, 199, 132, 0.5)',
    isOvernight: false,
  },
  workOvernight: {
    id: 'workOvernight',
    label: '泊',
    fullLabel: '宿泊勤務',
    startTime: '15:00',
    endTime: '翌06:00',
    workHours: 8,
    color: '#CE93D8',
    bgColor: 'rgba(206, 147, 216, 0.15)',
    borderColor: 'rgba(206, 147, 216, 0.5)',
    isOvernight: true,
  },
  dayOff: {
    id: 'dayOff',
    label: '公休',
    fullLabel: '公休',
    startTime: null,
    endTime: null,
    workHours: 0,
    color: '#90A4AE',
    bgColor: 'rgba(144, 164, 174, 0.1)',
    borderColor: 'rgba(144, 164, 174, 0.3)',
    isOvernight: false,
  },
  paidLeave: {
    id: 'paidLeave',
    label: '有休',
    fullLabel: '有休',
    startTime: null,
    endTime: null,
    workHours: 0,
    color: '#F48FB1',
    bgColor: 'rgba(244, 143, 177, 0.12)',
    borderColor: 'rgba(244, 143, 177, 0.4)',
    isOvernight: false,
  },
  annualLeave: {
    id: 'annualLeave',
    label: '年休',
    fullLabel: '年休',
    startTime: null,
    endTime: null,
    workHours: 0,
    color: '#EF9A9A',
    bgColor: 'rgba(239, 154, 154, 0.12)',
    borderColor: 'rgba(239, 154, 154, 0.4)',
    isOvernight: false,
  },
  custom: {
    id: 'custom',
    label: '他',
    fullLabel: 'カスタム',
    startTime: null,
    endTime: null,
    workHours: 0,
    color: '#A1887F',
    bgColor: 'rgba(161, 136, 127, 0.12)',
    borderColor: 'rgba(161, 136, 127, 0.4)',
    isOvernight: false,
  },
};

const SHIFT_TYPE_ORDER = [
  'work', 'workOvernight', 'dayOff', 'paidLeave', 'annualLeave'
];

const LEAVE_TYPES = ['dayOff', 'paidLeave', 'annualLeave'];
const OVERNIGHT_TYPES = ['workOvernight'];

function getShiftType(id) {
  return SHIFT_TYPES[id] || null;
}

function isWorkShift(shiftTypeId) {
  return shiftTypeId && !LEAVE_TYPES.includes(shiftTypeId);
}

function isOvernightShift(shiftTypeId) {
  return OVERNIGHT_TYPES.includes(shiftTypeId);
}
