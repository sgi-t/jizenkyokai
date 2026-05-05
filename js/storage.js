/**
 * LocalStorage永続化
 */
const Storage = {
  KEYS: { SCHEDULE: 'shift_schedule_', STAFF: 'shift_staff', SETTINGS: 'shift_settings' },

  saveSchedule(year, month, data) {
    const key = `${this.KEYS.SCHEDULE}${year}_${month}`;
    localStorage.setItem(key, JSON.stringify(data));
  },

  loadSchedule(year, month) {
    const key = `${this.KEYS.SCHEDULE}${year}_${month}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  },

  saveStaff(staffList) {
    localStorage.setItem(this.KEYS.STAFF, JSON.stringify(staffList));
  },

  loadStaff() {
    const raw = localStorage.getItem(this.KEYS.STAFF);
    return raw ? JSON.parse(raw) : null;
  },

  clearSchedule(year, month) {
    localStorage.removeItem(`${this.KEYS.SCHEDULE}${year}_${month}`);
  },

  saveEvents(year, month, data) {
    localStorage.setItem(`shift_events_${year}_${month}`, JSON.stringify(data));
  },

  loadEvents(year, month) {
    const raw = localStorage.getItem(`shift_events_${year}_${month}`);
    return raw ? JSON.parse(raw) : {};
  }
};
