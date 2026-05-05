/**
 * バリデーションエンジン
 */
const ValidationEngine = {
  validateAll(scheduleData, staffList, year, month) {
    const errors = [];
    const daysInMonth = getDaysInMonth(year, month);
    staffList.forEach(staff => {
      if (staff.role !== 'admin') {
        errors.push(...this.checkWeeklyHours(scheduleData, staff, year, month));
        errors.push(...this.checkWeeklyOvernights(scheduleData, staff, year, month));
        errors.push(...this.checkMonthlyDaysOff(scheduleData, staff, year, month, daysInMonth));
      }
    });
    errors.push(...this.checkBuildingCoverage(scheduleData, staffList, year, month, daysInMonth));
    return errors;
  },

  checkWeeklyHours(scheduleData, staff, year, month) {
    const errors = [];
    const daysInMonth = getDaysInMonth(year, month);
    const weekHoursMap = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${staff.id}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let entries = scheduleData[key] || [];
      if (!Array.isArray(entries)) entries = [entries];
      
      let workHours = 0;
      entries.forEach(entry => {
        if (!entry || !entry.shiftType) return;
        if (entry.shiftType === 'work') {
          workHours += this.calculateCustomHours(entry.startTime, entry.endTime, entry.breakStart, entry.breakEnd);
        } else if (entry.shiftType === 'workOvernight') {
          const calcMethod = entry.overnightCalculation || staff.overnightCalculation || 'deemed';
          if (calcMethod === 'actual') {
            workHours += this.calculateCustomHours(entry.startTime, entry.endTime, entry.breakStart, entry.breakEnd);
          } else {
            workHours += 8; // みなし時間
          }
        }
      });
      if (workHours === 0) continue;

      const weekRange = getWeekRange(year, month, d);
      const weekKey = weekRange.start.toISOString().slice(0, 10);
      if (!weekHoursMap[weekKey]) weekHoursMap[weekKey] = { hours: 0, days: [] };
      weekHoursMap[weekKey].hours += workHours;
      weekHoursMap[weekKey].days.push(d);
    }
    Object.entries(weekHoursMap).forEach(([weekKey, data]) => {
      if (data.hours > CONSTRAINTS.maxWeeklyHours) {
        errors.push({ type: 'weeklyHours', level: 'error', staffId: staff.id, staffName: staff.name, building: staff.building, message: `${staff.name}: 週${data.hours}h（上限${CONSTRAINTS.maxWeeklyHours}h超過）`, details: `週: ${weekKey}〜`, days: data.days, value: data.hours });
      }
    });
    return errors;
  },

  checkWeeklyOvernights(scheduleData, staff, year, month) {
    const errors = [];
    const daysInMonth = getDaysInMonth(year, month);
    const weekMap = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${staff.id}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let entries = scheduleData[key] || [];
      if (!Array.isArray(entries)) entries = [entries];
      const hasOvernight = entries.some(entry => entry && entry.shiftType && isOvernightShift(entry.shiftType));
      
      if (hasOvernight) {
        const weekRange = getWeekRange(year, month, d);
        const weekKey = weekRange.start.toISOString().slice(0, 10);
        if (!weekMap[weekKey]) weekMap[weekKey] = { count: 0, days: [] };
        weekMap[weekKey].count++;
        weekMap[weekKey].days.push(d);
      }
    }
    Object.entries(weekMap).forEach(([weekKey, data]) => {
      if (data.count > CONSTRAINTS.maxWeeklyOvernights) {
        errors.push({ type: 'weeklyOvernights', level: 'error', staffId: staff.id, staffName: staff.name, building: staff.building, message: `${staff.name}: 週${data.count}回宿泊（上限${CONSTRAINTS.maxWeeklyOvernights}回超過）`, details: `週: ${weekKey}〜`, days: data.days, value: data.count });
      }
    });
    return errors;
  },

  checkMonthlyDaysOff(scheduleData, staff, year, month, daysInMonth) {
    const errors = [];
    let daysOffCount = 0, filledCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${staff.id}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entry = scheduleData[key];
      if (entry && entry.shiftType) { filledCount++; if (entry.shiftType === 'dayOff') daysOffCount++; }
    }
    if (filledCount === daysInMonth && daysOffCount < CONSTRAINTS.minMonthlyDaysOff) {
      errors.push({ type: 'monthlyDaysOff', level: 'error', staffId: staff.id, staffName: staff.name, building: staff.building, message: `${staff.name}: 公休${daysOffCount}回（最低${CONSTRAINTS.minMonthlyDaysOff}回必要）`, value: daysOffCount });
    }
    return errors;
  },

  checkBuildingCoverage(scheduleData, staffList, year, month, daysInMonth) {
    const errors = [];
    
    // Helper to get start and end minutes from a shift
    const getShiftTimes = (entry) => {
      if (!entry.startTime || !entry.endTime || !entry.startTime.includes(':') || !entry.endTime.includes(':')) return null;
      const [sH, sM] = entry.startTime.split(':').map(Number);
      const [eH, eM] = entry.endTime.split(':').map(Number);
      if (isNaN(sH) || isNaN(eH)) return null;
      
      const startMin = sH * 60 + sM;
      const endMinRaw = eH * 60 + eM;
      // if end is smaller, or if shiftType is workOvernight
      const isOvernight = endMinRaw < startMin || entry.shiftType === 'workOvernight';
      return { startMin, endMin: endMinRaw, isOvernight };
    };

    ['A','B','C','D'].forEach(bid => {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        // Calculate previous date
        const dateObj = new Date(year, month - 1, d);
        dateObj.setDate(dateObj.getDate() - 1);
        const prevYear = dateObj.getFullYear();
        const prevMonth = dateObj.getMonth() + 1;
        const prevDay = dateObj.getDate();
        const prevDateStr = `${prevYear}-${String(prevMonth).padStart(2,'0')}-${String(prevDay).padStart(2,'0')}`;

        const intervals = [];

        staffList.forEach(s => {
          // Check previous day for overnight shifts
          const prevKey = `${s.id}_${prevDateStr}`;
          let prevEntries = scheduleData[prevKey] || [];
          if (!Array.isArray(prevEntries)) prevEntries = [prevEntries];
          
          prevEntries.forEach(prevEntry => {
            if (prevEntry && prevEntry.shiftType && isWorkShift(prevEntry.shiftType)) {
              if ((prevEntry.assignedBuilding || s.building) === bid) {
                const times = getShiftTimes(prevEntry);
                if (times && times.isOvernight) {
                  intervals.push({ start: 0, end: times.endMin });
                }
              }
            }
          });

          // Check current day
          const currKey = `${s.id}_${dateStr}`;
          let currEntries = scheduleData[currKey] || [];
          if (!Array.isArray(currEntries)) currEntries = [currEntries];
          
          currEntries.forEach(currEntry => {
            if (currEntry && currEntry.shiftType && isWorkShift(currEntry.shiftType)) {
              if ((currEntry.assignedBuilding || s.building) === bid) {
                const times = getShiftTimes(currEntry);
                if (times) {
                  if (times.isOvernight) {
                    intervals.push({ start: times.startMin, end: 1440 });
                  } else {
                    intervals.push({ start: times.startMin, end: times.endMin });
                  }
                }
              }
            }
          });
        });

        // Merge intervals
        intervals.sort((a, b) => a.start - b.start);
        const merged = [];
        if (intervals.length > 0) {
          let current = { start: intervals[0].start, end: intervals[0].end };
          for (let i = 1; i < intervals.length; i++) {
            if (intervals[i].start <= current.end) {
              current.end = Math.max(current.end, intervals[i].end);
            } else {
              merged.push(current);
              current = { start: intervals[i].start, end: intervals[i].end };
            }
          }
          merged.push(current);
        }

        // Check if [0, 1440] is fully covered
        let isCovered = false;
        if (merged.length >= 1) {
          for (const m of merged) {
            if (m.start <= 0 && m.end >= 1440) {
              isCovered = true;
              break;
            }
          }
        }

        if (!isCovered) {
          errors.push({ type: 'buildingCoverage', level: 'error', building: bid, message: `${BUILDINGS[bid].label}: ${d}日に空白の時間帯があります（24時間カバーされていません）`, days: [d] });
        }
      }
    });
    return errors;
  },

  getWeeklyHoursForStaff(scheduleData, staffId, year, month, day) {
    const weekRange = getWeekRange(year, month, day);
    let total = 0;
    for (let d = 1; d <= getDaysInMonth(year, month); d++) {
      const date = new Date(year, month - 1, d);
      if (date >= weekRange.start && date <= weekRange.end) {
        const key = `${staffId}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let entries = scheduleData[key] || [];
        if (!Array.isArray(entries)) entries = [entries];
        
        entries.forEach(entry => {
          if (entry && entry.shiftType) {
            if (entry.shiftType === 'work') {
              total += this.calculateCustomHours(entry.startTime, entry.endTime, entry.breakStart, entry.breakEnd);
            } else if (entry.shiftType === 'workOvernight') {
              const calcMethod = entry.overnightCalculation || 'deemed';
              if (calcMethod === 'actual') {
                total += this.calculateCustomHours(entry.startTime, entry.endTime, entry.breakStart, entry.breakEnd);
              } else {
                total += 8;
              }
            }
          }
        });
      }
    }
    return total;
  },

  getMonthlyDaysOffForStaff(scheduleData, staffId, year, month) {
    let count = 0;
    for (let d = 1; d <= getDaysInMonth(year, month); d++) {
      const key = `${staffId}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let entries = scheduleData[key] || [];
      if (!Array.isArray(entries)) entries = [entries];
      if (entries.some(e => e && e.shiftType === 'dayOff')) count++;
    }
    return count;
  },

  getMonthlyHoursForStaff(scheduleData, staffId, year, month, staffList) {
    let total = 0;
    const staff = staffList ? staffList.find(s => s.id === staffId) : null;
    for (let d = 1; d <= getDaysInMonth(year, month); d++) {
      const key = `${staffId}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let entries = scheduleData[key] || [];
      if (!Array.isArray(entries)) entries = [entries];
      
      entries.forEach(entry => {
        if (entry && entry.shiftType) {
          if (entry.shiftType === 'work') {
            total += this.calculateCustomHours(entry.startTime, entry.endTime, entry.breakStart, entry.breakEnd);
          } else if (entry.shiftType === 'workOvernight') {
            const calcMethod = entry.overnightCalculation || (staff && staff.overnightCalculation) || 'deemed';
            if (calcMethod === 'actual') {
              total += this.calculateCustomHours(entry.startTime, entry.endTime, entry.breakStart, entry.breakEnd);
            } else {
              total += 8; // みなし
            }
          }
        }
      });
    }
    return total;
  },

  calculateCustomHours(start, end, breakStart, breakEnd) {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
    const [sH, sM] = start.split(':').map(Number);
    let [eH, eM] = end.split(':').map(Number);
    if (isNaN(sH) || isNaN(eH)) return 0;
    
    // Overnight adjustment
    if (eH < sH || (eH === sH && eM < sM)) eH += 24;
    
    let totalMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (isNaN(totalMins)) return 0;
    
    // Deduct break time if provided
    if (breakStart && breakEnd && breakStart.includes(':') && breakEnd.includes(':')) {
      const [bsH, bsM] = breakStart.split(':').map(Number);
      let [beH, beM] = breakEnd.split(':').map(Number);
      if (!isNaN(bsH) && !isNaN(beH)) {
        if (beH < bsH || (beH === bsH && beM < bsM)) beH += 24;
        const breakMins = (beH * 60 + beM) - (bsH * 60 + bsM);
        if (!isNaN(breakMins)) totalMins -= breakMins;
      }
    }
    
    return Math.max(0, Math.round(totalMins / 60 * 10) / 10);
  }
};
