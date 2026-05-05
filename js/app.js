/**
 * メインアプリケーション
 */
const App = {
  currentYear: 2026,
  currentMonth: 5,
  staffList: [],
  scheduleData: {},
  eventsData: {},
  errors: [],
  selectedCell: null,

  init() {
    this.staffList = Storage.loadStaff() || [...DEFAULT_STAFF];
    this.scheduleData = Storage.loadSchedule(this.currentYear, this.currentMonth);
    this.eventsData = Storage.loadEvents ? Storage.loadEvents(this.currentYear, this.currentMonth) : {};
    this.render();
    this.bindEvents();
    this.runValidation();
  },

  render() {
    this.renderHeader();
    this.renderTable();
  },

  renderHeader() {
    document.getElementById('currentMonth').textContent =
      `令和${this.currentYear - 2018}年 ${this.currentMonth}月`;
      
    // Populate event day select
    const dates = generateMonthDates(this.currentYear, this.currentMonth);
    const daySelect = document.getElementById('eventDaySelect');
    if (daySelect) {
      daySelect.innerHTML = '<option value="">-- 日付 --</option>' + dates.map(d => `<option value="${d.dateStr}">${d.day}日 (${d.dayName})</option>`).join('');
    }
  },

  renderTable() {
    try {
      this.doRenderTable();
    } catch (e) {
      console.error(e);
      const tbody = document.getElementById('scheduleBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="35" style="color:red; font-weight:bold; padding:20px;">表の描画中にエラーが発生しました:<br>${e.message}</td></tr>`;
      }
    }
  },

  doRenderTable() {
    const dates = generateMonthDates(this.currentYear, this.currentMonth);
    const tbody = document.getElementById('scheduleBody');
    const thead = document.getElementById('scheduleHead');

    let headHtml = '<tr><th class="staff-name-cell" style="position:sticky;left:0;z-index:15;">氏名</th>';
    dates.forEach(d => {
      let cls = '';
      if (d.dayOfWeek === 0) cls = 'sunday';
      else if (d.dayOfWeek === 6) cls = 'saturday';
      
      headHtml += `<th class="${cls}">
        ${d.day}<br>${d.dayName}
        <button class="no-print" onclick="App.clearDayShifts(${d.day})" title="この日を全消去" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:0.7rem;">✕</button>
      </th>`;
    });
    headHtml += '<th class="stats-cell">月時間</th><th class="stats-cell">公休</th><th class="stats-cell">有休残</th></tr>';
    
    // Events Row
    headHtml += `<tr class="building-header"><td class="staff-name-cell" style="font-size:0.8rem; text-align:center;">行事</td>`;
    dates.forEach(d => {
      const val = this.eventsData[d.dateStr] || '';
      headHtml += `<td style="vertical-align:top; padding:0;"><textarea data-eventdate="${d.dateStr}" class="event-inline-input" style="width:100%; height:40px; border:none; background:transparent; color:var(--warning); text-align:center; font-size:0.65rem; padding: 2px; resize:none; overflow:hidden; white-space:pre-wrap;" placeholder="行事">${val}</textarea></td>`;
    });
    headHtml += `<td colspan="3"></td></tr>`;
    
    thead.innerHTML = headHtml;

    // Body rows grouped by building
    let bodyHtml = '';
    const buildingsOrder = ['admin', 'A', 'AB', 'B', 'C', 'D', 'psy'];
    buildingsOrder.forEach(bid => {
      const bStaff = this.staffList.filter(s => s.building === bid);
      if (bStaff.length === 0) return;

      bodyHtml += `<tr class="building-header"><td colspan="${dates.length + 4}">● ${BUILDINGS[bid].label}</td></tr>`;

      bStaff.forEach(staff => {
        const monthlyHours = ValidationEngine.getMonthlyHoursForStaff(this.scheduleData, staff.id, this.currentYear, this.currentMonth, this.staffList);
        const monthlyOff = ValidationEngine.getMonthlyDaysOffForStaff(this.scheduleData, staff.id, this.currentYear, this.currentMonth);
        const hasStaffError = this.errors.some(e => e.staffId === staff.id);

        const annualLeaveUsed = this.calculateAnnualLeaveUsed(staff.id);
        const leaveRemaining = (staff.annualLeaveTotal || 0) - annualLeaveUsed;

        bodyHtml += `<tr data-staff="${staff.id}">`;
        bodyHtml += `<td class="staff-name-cell ${hasStaffError ? 'has-error' : ''}" style="cursor:pointer;" onclick="App.openStaffModal('${staff.id}')" title="設定を開く">${staff.name}</td>`;

        dates.forEach(d => {
          const key = `${staff.id}_${d.dateStr}`;
          let entries = this.scheduleData[key] || [];
          if (!Array.isArray(entries)) entries = [entries];
          
          let badgeHtml = '<div style="display:flex; flex-direction:column; gap:2px; width:100%; height:100%;">';
          entries.forEach(entry => {
            if (entry && entry.shiftType) {
              const shiftType = getShiftType(entry.shiftType);
              if (shiftType) {
                let bgColor = shiftType.bgColor;
                let color = shiftType.color;
                let borderColor = shiftType.borderColor;
                if (entry.shiftType === 'workOvernight') {
                  const calcMethod = entry.overnightCalculation || (staff && staff.overnightCalculation) || 'deemed';
                  if (calcMethod === 'actual') {
                    bgColor = 'rgba(255, 0, 0, 0.1)';
                    color = '#D32F2F';
                    borderColor = 'rgba(211, 47, 47, 0.4)';
                  }
                }
                
                let assigned = entry.assignedBuilding && entry.assignedBuilding !== staff.building && entry.assignedBuilding !== 'admin' ? `[${entry.assignedBuilding}]` : '';
                let labelHtml = (entry.shiftType === 'work' || entry.shiftType === 'workOvernight') ? '' : `<span style="font-weight:bold;">${shiftType.label}</span>`;
                let timeStr = (entry.shiftType === 'work' || entry.shiftType === 'workOvernight') ? `<span style="font-size:0.55rem; line-height:1.2;">${entry.startTime || ''}<br>~${entry.endTime || ''}</span>` : '';
                badgeHtml += `<div class="shift-badge" style="background:${bgColor};color:${color};border:1px solid ${borderColor};display:flex;flex-direction:column;align-items:center;justify-content:center; padding:1px;">
                  ${labelHtml}
                  ${timeStr}
                  <span style="font-size:0.5rem;">${assigned}</span>
                </div>`;
              }
            }
          });
          badgeHtml += '</div>';
          
          const cellError = this.errors.some(e => e.staffId === staff.id && e.days && e.days.includes(d.day));

          bodyHtml += `<td class="shift-cell ${cellError ? 'has-error' : ''}" data-key="${key}" data-staff="${staff.id}" data-date="${d.dateStr}" data-day="${d.day}" onclick="App.openPicker('${key}','${staff.id}','${d.dateStr}','${staff.name}',${d.day})">`;
          bodyHtml += badgeHtml;
          bodyHtml += '</td>';
        });

        const hoursClass = monthlyHours > 160 ? 'over-limit' : 'ok';
        const offClass = monthlyOff < CONSTRAINTS.minMonthlyDaysOff ? 'over-limit' : 'ok';
        bodyHtml += `<td class="stats-cell ${hoursClass}">${monthlyHours}h</td>`;
        bodyHtml += `<td class="stats-cell ${offClass}">${monthlyOff}回</td>`;
        bodyHtml += `<td class="stats-cell">${leaveRemaining}日</td>`;
        bodyHtml += '</tr>';
      });
    });
    tbody.innerHTML = bodyHtml;

    // Render Print Tables
    this.renderPrintTables(dates);
  },

  renderPrintTables(dates) {
    const container = document.getElementById('printContainer');
    if (!container) return;
    
    // Split dates into two arrays: 1-15, 16-end
    const dates1 = dates.filter(d => d.day <= 15);
    const dates2 = dates.filter(d => d.day > 15);
    
    container.innerHTML = '';
    [dates1, dates2].forEach((partDates, idx) => {
      if (partDates.length === 0) return;
      
      let html = `<div class="print-page"><table class="print-schedule-table">`;
      // Header
      html += `<thead><tr><th class="staff-name-cell" style="width:40px;">氏名</th>`;
      partDates.forEach(d => {
        let cls = '';
        if (d.dayOfWeek === 0) cls = 'sunday';
        else if (d.dayOfWeek === 6) cls = 'saturday';
        html += `<th class="${cls}" style="width:25px;">${d.day}<br>${d.dayName}</th>`;
      });
      html += `<th style="width:30px;">時間</th><th style="width:25px;">公休</th><th style="width:25px;">有休</th></tr>`;
      
      // Events
      html += `<tr class="building-header"><td class="staff-name-cell">行事</td>`;
      partDates.forEach(d => {
        const val = this.eventsData[d.dateStr] || '';
        const formattedVal = val.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        html += `<td style="vertical-align:top; padding:2px;"><div style="font-size:7px; line-height:1.1; white-space:normal; overflow:hidden;">${formattedVal}</div></td>`;
      });
      html += `<td colspan="3"></td></tr></thead><tbody>`;
      
      // Body
      const buildingsOrder = ['admin', 'A', 'AB', 'B', 'C', 'D', 'psy'];
      buildingsOrder.forEach(bid => {
        const bStaff = this.staffList.filter(s => s.building === bid);
        if (bStaff.length === 0) return;
        html += `<tr class="building-header"><td colspan="${partDates.length + 4}">● ${BUILDINGS[bid].label}</td></tr>`;
        
        bStaff.forEach(staff => {
          const monthlyHours = ValidationEngine.getMonthlyHoursForStaff(this.scheduleData, staff.id, this.currentYear, this.currentMonth, this.staffList);
          const monthlyOff = ValidationEngine.getMonthlyDaysOffForStaff(this.scheduleData, staff.id, this.currentYear, this.currentMonth);
          const annualLeaveUsed = this.calculateAnnualLeaveUsed(staff.id);
          const leaveRemaining = (staff.annualLeaveTotal || 0) - annualLeaveUsed;

          html += `<tr><td class="staff-name-cell">${staff.name}</td>`;
          partDates.forEach(d => {
            const key = `${staff.id}_${d.dateStr}`;
            let entries = this.scheduleData[key] || [];
            if (!Array.isArray(entries)) entries = [entries];
            
            let badgeHtml = '<div style="display:flex; flex-direction:column; gap:1px; width:100%;">';
            entries.forEach(entry => {
              if (entry && entry.shiftType) {
                const shiftType = getShiftType(entry.shiftType);
                if (shiftType) {
                  let inlineStyle = '';
                  if (entry.shiftType === 'workOvernight') {
                    const calcMethod = entry.overnightCalculation || (staff && staff.overnightCalculation) || 'deemed';
                    if (calcMethod === 'actual') {
                      inlineStyle = 'color: #D32F2F; border: 1px solid #D32F2F;';
                    }
                  }
                  
                  let assigned = entry.assignedBuilding && entry.assignedBuilding !== staff.building && entry.assignedBuilding !== 'admin' ? `[${entry.assignedBuilding}]` : '';
                  let labelHtml = (entry.shiftType === 'work' || entry.shiftType === 'workOvernight') ? '' : `<span style="font-size:8px; font-weight:bold;">${shiftType.label}</span>`;
                  let timeStr = (entry.shiftType === 'work' || entry.shiftType === 'workOvernight') ? `<div style="font-size:6px;">${entry.startTime || ''}<br>~${entry.endTime || ''}</div>` : '';
                  badgeHtml += `<div class="print-shift-badge" style="${inlineStyle}">
                    ${labelHtml}
                    ${timeStr}
                    <span style="font-size:6px;">${assigned}</span>
                  </div>`;
                }
              }
            });
            badgeHtml += '</div>';
            html += `<td>${badgeHtml}</td>`;
          });
          html += `<td>${monthlyHours}h</td><td>${monthlyOff}</td><td>${leaveRemaining}</td></tr>`;
        });
      });
      
      html += `</tbody></table></div>`;
      container.innerHTML += html;
    });
  },

  bindEvents() {
    document.getElementById('prevMonth').onclick = () => this.changeMonth(-1);
    document.getElementById('nextMonth').onclick = () => this.changeMonth(1);
    document.getElementById('saveBtn').onclick = () => this.save();
    document.getElementById('errorToggle').onclick = () => this.toggleErrorPanel();
    document.getElementById('closeErrorPanel').onclick = () => this.toggleErrorPanel();
    
    // Bind inline event inputs
    document.querySelectorAll('.event-inline-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const date = e.target.dataset.eventdate;
        const val = e.target.value.trim();
        if (val) {
          this.eventsData[date] = val;
        } else {
          delete this.eventsData[date];
        }
        if (Storage.saveEvents) Storage.saveEvents(this.currentYear, this.currentMonth, this.eventsData);
      });
    });
  },

  calculateAnnualLeaveUsed(staffId) {
    let used = 0;
    const daysInMonth = getDaysInMonth(this.currentYear, this.currentMonth);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${staffId}_${this.currentYear}-${String(this.currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let entries = this.scheduleData[key] || [];
      if (!Array.isArray(entries)) entries = [entries];
      entries.forEach(entry => {
        if (entry && entry.shiftType === 'annualLeave') used++;
      });
    }
    return used;
  },

  changeMonth(delta) {
    this.currentMonth += delta;
    if (this.currentMonth > 12) { this.currentMonth = 1; this.currentYear++; }
    if (this.currentMonth < 1) { this.currentMonth = 12; this.currentYear--; }
    this.scheduleData = Storage.loadSchedule(this.currentYear, this.currentMonth);
    this.render();
    this.runValidation();
  },

  openPicker(key, staffId, dateStr, staffName, day) {
    this.selectedCell = { key, staffId, dateStr, staffName, day };
    const picker = document.getElementById('pickerOverlay');
    document.getElementById('pickerTitle').textContent = `${staffName} - ${this.currentMonth}/${day}`;

    let currentShifts = this.scheduleData[key];
    if (!currentShifts) {
      currentShifts = [{}, {}, {}];
    } else if (!Array.isArray(currentShifts)) {
      currentShifts = [currentShifts, {}, {}];
    } else {
      while (currentShifts.length < 3) currentShifts.push({});
    }
    
    // Deep copy for temp editing
    this.tempShifts = JSON.parse(JSON.stringify(currentShifts));
    this.activeShiftIndex = undefined;
    this.switchShiftTab(0);

    const weekHours = ValidationEngine.getWeeklyHoursForStaff(this.scheduleData, staffId, this.currentYear, this.currentMonth, day);
    document.getElementById('pickerWeekInfo').textContent = `この週の勤務: ${weekHours}h / ${CONSTRAINTS.maxWeeklyHours}h`;

    picker.classList.add('active');
  },

  switchShiftTab(index) {
    if (this.activeShiftIndex !== undefined && this.tempShifts && this.tempShifts[this.activeShiftIndex]) {
      const currentShift = this.tempShifts[this.activeShiftIndex];
      currentShift.startTime = document.getElementById('pickerStart').value;
      currentShift.endTime = document.getElementById('pickerEnd').value;
      currentShift.breakStart = document.getElementById('pickerBreakStart').value;
      currentShift.breakEnd = document.getElementById('pickerBreakEnd').value;
      currentShift.assignedBuilding = document.getElementById('pickerBuilding').value;
      currentShift.overnightCalculation = document.getElementById('pickerOvernightCalc').value;
      
      if (!currentShift.shiftType && (currentShift.startTime || currentShift.endTime)) {
        currentShift.shiftType = 'work';
      }
    }

    this.activeShiftIndex = index;
    const shift = this.tempShifts[index];
    
    document.getElementById('tabShift0').className = index === 0 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    document.getElementById('tabShift1').className = index === 1 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    document.getElementById('tabShift2').className = index === 2 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

    document.querySelectorAll('.shift-picker-btn').forEach(btn => {
      btn.classList.toggle('selected', shift.shiftType && btn.dataset.shift === shift.shiftType);
    });
    
    const staff = this.staffList.find(s => s.id === this.selectedCell.staffId);
    document.getElementById('pickerStart').value = shift.startTime || '';
    document.getElementById('pickerEnd').value = shift.endTime || '';
    document.getElementById('pickerBreakStart').value = shift.breakStart || '';
    document.getElementById('pickerBreakEnd').value = shift.breakEnd || '';
    document.getElementById('pickerBuilding').value = shift.assignedBuilding || staff.building;
    document.getElementById('pickerOvernightCalc').value = shift.overnightCalculation || staff.overnightCalculation || 'deemed';
  },

  applyPreset(shiftTypeId) {
    const shift = this.tempShifts[this.activeShiftIndex];
    shift.shiftType = shiftTypeId;
    if (shiftTypeId === 'dayOff' || shiftTypeId === 'paidLeave' || shiftTypeId === 'annualLeave') {
      document.getElementById('pickerStart').value = '';
      document.getElementById('pickerEnd').value = '';
    } else {
      const shiftType = getShiftType(shiftTypeId);
      if (shiftType) {
        document.getElementById('pickerStart').value = shiftType.startTime ? shiftType.startTime.replace('翌', '') : '';
        document.getElementById('pickerEnd').value = shiftType.endTime ? shiftType.endTime.replace('翌', '') : '';
      }
    }
    document.querySelectorAll('.shift-picker-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.shift === shiftTypeId);
    });
  },

  clearCurrentShiftTab() {
    this.tempShifts[this.activeShiftIndex] = {};
    document.getElementById('pickerStart').value = '';
    document.getElementById('pickerEnd').value = '';
    document.getElementById('pickerBreakStart').value = '';
    document.getElementById('pickerBreakEnd').value = '';
    document.getElementById('pickerOvernightCalc').value = 'deemed';
    document.querySelectorAll('.shift-picker-btn').forEach(btn => btn.classList.remove('selected'));
  },

  saveCustomShift() {
    if (!this.selectedCell) return;
    
    // update current tab data from form
    const shift = this.tempShifts[this.activeShiftIndex];
    shift.startTime = document.getElementById('pickerStart').value;
    shift.endTime = document.getElementById('pickerEnd').value;
    shift.breakStart = document.getElementById('pickerBreakStart').value;
    shift.breakEnd = document.getElementById('pickerBreakEnd').value;
    shift.assignedBuilding = document.getElementById('pickerBuilding').value;
    shift.overnightCalculation = document.getElementById('pickerOvernightCalc').value;
    
    if (!shift.shiftType && (shift.startTime || shift.endTime)) {
      shift.shiftType = 'work';
    }

    // Filter out empty shifts
    const finalShifts = this.tempShifts.filter(s => s.shiftType);

    if (finalShifts.length > 0) {
      this.scheduleData[this.selectedCell.key] = finalShifts;
    } else {
      delete this.scheduleData[this.selectedCell.key];
    }

    this.closePicker();
    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    this.runValidation();
    this.renderTable();
  },

  closePicker() {
    document.getElementById('pickerOverlay').classList.remove('active');
    this.selectedCell = null;
    this.tempShifts = null;
  },

  setShift(shiftTypeId) {
    // Only used conceptually, but UI now uses tempShifts and saveCustomShift
  },

  runValidation() {
    try {
      this.errors = ValidationEngine.validateAll(this.scheduleData, this.staffList, this.currentYear, this.currentMonth);
    } catch (e) {
      console.error(e);
      this.errors = [{ level: 'error', message: '検証中にエラーが発生しました: ' + e.message }];
    }
    this.renderErrors();
  },

  renderErrors() {
    const errorCount = this.errors.filter(e => e.level === 'error').length;
    const warnCount = this.errors.filter(e => e.level === 'warning').length;
    const bar = document.getElementById('errorBar');

    let html = '';
    if (errorCount > 0) {
      html += `<span class="error-badge errors">🔴 ${errorCount}件のエラー</span>`;
    }
    if (warnCount > 0) {
      html += `<span class="error-badge warnings">🟡 ${warnCount}件の警告</span>`;
    }
    if (errorCount === 0 && warnCount === 0) {
      html += `<span class="error-badge ok">✅ エラーなし</span>`;
    }
    html += `<button class="btn btn-sm btn-secondary" id="errorToggle" onclick="App.toggleErrorPanel()">詳細</button>`;
    bar.innerHTML = html;

    // Error panel content
    const panel = document.getElementById('errorList');
    if (this.errors.length === 0) {
      panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">エラーはありません 🎉</p>';
    } else {
      panel.innerHTML = this.errors.map(e => `
        <div class="error-item ${e.level}-level">
          <div class="error-msg">${e.message}</div>
          ${e.details ? `<div class="error-detail">${e.details}</div>` : ''}
        </div>
      `).join('');
    }
  },

  toggleErrorPanel() {
    document.getElementById('errorPanel').classList.toggle('active');
  },

  save() {
    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    Storage.saveStaff(this.staffList);
    this.showToast('保存しました', 'success');
  },

  showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  openStaffModal(staffId) {
    this.selectedStaffId = staffId;
    const staff = this.staffList.find(s => s.id === staffId);
    if (!staff) return;

    document.getElementById('staffModalTitle').textContent = `スタッフ設定`;
    document.getElementById('staffNameInput').value = staff.name || '';
    document.getElementById('staffLeaveInput').value = staff.annualLeaveTotal || 0;
    document.getElementById('staffOvernightCalc').value = staff.overnightCalculation || 'deemed';
    
    // Clear pattern dropdowns
    const wp = staff.weeklyPattern || {};
    for(let i=0; i<7; i++) {
      document.getElementById('pat_'+i).value = wp[`pat_${i}`] || '';
      document.getElementById('patStart_'+i).value = wp[`start_${i}`] || '';
      document.getElementById('patEnd_'+i).value = wp[`end_${i}`] || '';
    }

    document.getElementById('staffModalOverlay').classList.add('active');
  },

  closeStaffModal() {
    document.getElementById('staffModalOverlay').classList.remove('active');
    this.selectedStaffId = null;
  },

  saveStaffModal() {
    if (!this.selectedStaffId) return;
    const staff = this.staffList.find(s => s.id === this.selectedStaffId);
    const newName = document.getElementById('staffNameInput').value.trim();
    if (newName) staff.name = newName;
    const totalLeaves = parseInt(document.getElementById('staffLeaveInput').value) || 0;
    staff.annualLeaveTotal = totalLeaves;
    staff.overnightCalculation = document.getElementById('staffOvernightCalc').value;
    
    const wp = {};
    for(let i=0; i<7; i++) {
      wp[`pat_${i}`] = document.getElementById('pat_'+i).value;
      wp[`start_${i}`] = document.getElementById('patStart_'+i).value;
      wp[`end_${i}`] = document.getElementById('patEnd_'+i).value;
    }
    staff.weeklyPattern = wp;
    
    Storage.saveStaff(this.staffList);
    this.renderTable();
    this.closeStaffModal();
  },

  clearStaffShifts() {
    if (!this.selectedStaffId || !confirm('この担当者の今月のシフトを全消去しますか？')) return;
    const staffId = this.selectedStaffId;
    const daysInMonth = getDaysInMonth(this.currentYear, this.currentMonth);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${staffId}_${this.currentYear}-${String(this.currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      delete this.scheduleData[key];
    }
    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    this.runValidation();
    this.renderTable();
    this.closeStaffModal();
  },

  applyWeeklyPattern() {
    if (!this.selectedStaffId) return;
    const staffId = this.selectedStaffId;
    const staff = this.staffList.find(s => s.id === staffId);
    const daysInMonth = getDaysInMonth(this.currentYear, this.currentMonth);
    
    // get pattern for 0-6
    const patterns = {};
    for(let i=0; i<7; i++) {
      patterns[i] = document.getElementById('pat_'+i).value;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = getDayOfWeek(this.currentYear, this.currentMonth, d);
      const shiftType = patterns[dow];
      if (shiftType) {
        const key = `${staffId}_${this.currentYear}-${String(this.currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        let startTime = '';
        let endTime = '';
        
        if (shiftType === 'work' || shiftType === 'workOvernight') {
          startTime = document.getElementById('patStart_'+dow).value;
          endTime = document.getElementById('patEnd_'+dow).value;
        }

        this.scheduleData[key] = [{ 
          shiftType: shiftType, 
          assignedBuilding: staff.building,
          startTime: startTime,
          endTime: endTime
        }];
      }
    }
    
    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    this.runValidation();
    this.renderTable();
    this.closeStaffModal();
  },

  clearAllShifts() {
    this.scheduleData = {};
    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    this.runValidation();
    this.renderTable();
    this.showToast('全てのシフトを消去しました', 'info');
  },

  clearDayShifts(day) {
    if (!confirm(`${this.currentMonth}/${day} のシフトを全消去しますか？`)) return;
    const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    this.staffList.forEach(s => {
      delete this.scheduleData[`${s.id}_${dateStr}`];
    });
    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    this.runValidation();
    this.renderTable();
  },

  copyPreviousMonth() {
    const prevDate = new Date(this.currentYear, this.currentMonth - 2, 1);
    const pYear = prevDate.getFullYear();
    const pMonth = prevDate.getMonth() + 1;
    const pDays = getDaysInMonth(pYear, pMonth);
    const cDays = getDaysInMonth(this.currentYear, this.currentMonth);
    const maxDays = Math.min(pDays, cDays);

    let copied = 0;
    // Load prev month data from local storage
    const storageKey = `shiftManager_schedule_${pYear}_${String(pMonth).padStart(2, '0')}`;
    const prevDataRaw = localStorage.getItem(storageKey);
    let prevData = {};
    if (prevDataRaw) {
      try {
        prevData = JSON.parse(prevDataRaw);
      } catch (e) {
        console.error(e);
      }
    }

    if (Object.keys(prevData).length === 0) {
      this.showToast('前月のデータがありません', 'error');
      return;
    }

    for (let d = 1; d <= maxDays; d++) {
      this.staffList.forEach(s => {
        const pKey = `${s.id}_${pYear}-${String(pMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cKey = `${s.id}_${this.currentYear}-${String(this.currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (prevData[pKey]) {
          this.scheduleData[cKey] = JSON.parse(JSON.stringify(prevData[pKey]));
          copied++;
        }
      });
    }

    Storage.saveSchedule(this.currentYear, this.currentMonth, this.scheduleData);
    this.runValidation();
    this.renderTable();
    this.showToast('前月のシフトをコピーしました', 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
