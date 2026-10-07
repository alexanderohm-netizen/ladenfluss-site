(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const api = window.LadenflussVacation;
    const $ = id => document.getElementById(id);
    const error = $('vacError');
    let data;
    let savedSnapshot;
    let editId = null;
    let month = new Date();
    month = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const currentYear = () => month.getFullYear();
    const format = value => api.dateOf(value)?.toLocaleDateString('de-DE') || value;
    const node = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text != null) element.textContent = text;
      return element;
    };
    const fail = message => { error.textContent = message; error.hidden = false; };
    const clearError = () => { error.hidden = true; error.textContent = ''; };
    function persist() {
      try { api.save(data); savedSnapshot = JSON.stringify(data); clearError(); return true; }
      catch (e) {
        data = JSON.parse(savedSnapshot);
        $('vacState').value = data.settings.state;
        $('vacWorkweek').value = String(data.settings.workdays.length);
        $('vacMaxAbsent').value = data.settings.maxAbsent;
        render();
        fail('Die Änderung wurde nicht gespeichert. Bitte Speicherplatz und Browser-Einstellungen prüfen und erneut versuchen: ' + e.message);
        return false;
      }
    }
    try { data = api.read(); savedSnapshot = JSON.stringify(data); }
    catch (e) {
      fail('Gespeicherte Daten konnten nicht gelesen werden. Zum Schutz vor Datenverlust ist die Bearbeitung gesperrt. ' + e.message);
      document.querySelectorAll('.vac-app input,.vac-app select,.vac-app button').forEach(control => { control.disabled = true; });
      return;
    }
    const states = window.LadenflussHolidays?.STATES || {HE: 'Hessen'};
    Object.entries(states).forEach(([key, title]) => {
      const option = node('option', '', title); option.value = key; $('vacState').append(option);
    });
    $('vacState').value = data.settings.state || 'HE';
    $('vacWorkweek').value = data.settings.workdays.includes(6) ? '6' : '5';
    $('vacMaxAbsent').value = data.settings.maxAbsent;
    function employeeName(id) { return data.employees.find(e => e.id === id)?.name || 'Entfernter Mitarbeiter'; }
    function rangeTouchesYear(entry, year) { return entry.start <= year + '-12-31' && entry.end >= year + '-01-01'; }
    function renderTeam() {
      const select = $('vacPerson'); const chosen = select.value;
      select.replaceChildren(node('option', '', 'Bitte wählen'));
      select.firstChild.value = '';
      const list = $('vacEmployees'); list.replaceChildren();
      data.employees.forEach(employee => {
        const option = node('option', '', employee.name); option.value = employee.id; select.append(option);
        const row = node('div', 'vac-person');
        const label = node('div'); label.append(node('strong', '', employee.name), node('small', '', employee.allowance + ' Urlaubstage / Jahr'));
        const actions = node('div', 'vac-entry-actions');
        const change = node('button', 'vac-icon-btn', 'Budget');
        change.type = 'button';
        change.title = 'Jahresurlaub ändern';
        change.addEventListener('click', () => {
          const requested = prompt('Urlaubstage pro Jahr für ' + employee.name, String(employee.allowance));
          if (requested == null) return;
          const amount = Number(requested);
          if (!Number.isInteger(amount) || amount < 0 || amount > 366) return fail('Bitte eine ganze Zahl zwischen 0 und 366 eingeben.');
          employee.allowance = amount; if (persist()) render();
        });
        const remove = node('button', 'vac-icon-btn', 'Löschen'); remove.type = 'button';
        remove.addEventListener('click', () => {
          if (data.entries.some(e => e.employeeId === employee.id)) {
            return fail('Bitte zuerst die Urlaubseinträge dieser Person entfernen.');
          }
          if (!confirm(employee.name + ' aus der Planung entfernen?')) return;
          data.employees = data.employees.filter(e => e.id !== employee.id);
          if (persist()) render();
        });
        actions.append(change, remove); row.append(label, actions); list.append(row);
      });
      if (!list.children.length) list.append(node('p', 'vac-empty', 'Noch kein Team angelegt.'));
      if (data.employees.some(e => e.id === chosen)) select.value = chosen;
      $('vacTeamCount').textContent = String(data.employees.length);
    }
    function conflicts(entry) {
      try { return api.overCapacity(entry, data.entries, data.settings).length; }
      catch { return 0; }
    }
    function renderBalance() {
      const balances = $('vacBalances'); balances.replaceChildren();
      for (const employee of data.employees) {
        const used = api.tally(employee.id, currentYear(), data.entries, data.settings);
        const remaining = employee.allowance - used;
        const item = node('div', 'vac-balance' + (remaining < 0 ? ' over' : ''));
        const heading = node('div', 'vac-balance-head');
        heading.append(node('strong', '', employee.name), node('span', '', remaining + ' frei / ' + employee.allowance));
        const bar = node('div', 'vac-balance-bar');
        const fill = node('div', 'vac-balance-fill');
        fill.style.width = (employee.allowance ? Math.min(100, 100 * used / employee.allowance) : used ? 100 : 0) + '%';
        bar.append(fill); item.append(heading, bar, node('small', '', used + ' Tage für ' + currentYear() + ' eingeplant')); balances.append(item);
      }
      if (!data.employees.length) balances.append(node('p', 'vac-empty', 'Mitarbeiter anlegen, um Urlaubstage zu sehen.'));
    }
    function renderEntries() {
      $('vacYearTitle').textContent = 'Urlaub im Jahr ' + currentYear();
      const rows = $('vacEntries'); rows.replaceChildren();
      const entries = data.entries.filter(e => rangeTouchesYear(e, currentYear())).sort((a, b) => a.start.localeCompare(b.start));
      $('vacEntryCount').textContent = String(entries.length);
      $('vacConflictCount').textContent = String(entries.filter(e => conflicts(e) > 0).length);
      for (const entry of entries) {
        const row = node('div', 'vac-entry'); const left = node('div');
        const total = api.countDays(entry, data.settings, currentYear());
        left.append(node('strong', '', employeeName(entry.employeeId)), node('small', '', format(entry.start) + ' – ' + format(entry.end) + ' · ' + total + ' Arbeitstage'));
        const status = node('span', 'vac-entry-state' + (entry.status === 'approved' ? ' approved' : ''), entry.status === 'approved' ? 'Bestätigt' : 'Geplant');
        left.append(status);
        if (entry.note) left.append(node('small', '', entry.note));
        if (conflicts(entry)) left.append(node('small', '', '⚠ Mehr Personen gleichzeitig abwesend als geplant.'));
        const buttons = node('div', 'vac-entry-actions');
        const edit = node('button', 'vac-icon-btn', 'Bearbeiten'); edit.type = 'button';
        edit.addEventListener('click', () => {
          editId = entry.id;
          $('vacPerson').value = entry.employeeId;
          $('vacFrom').value = entry.start; $('vacTo').value = entry.end;
          $('vacStatus').value = entry.status; $('vacNote').value = entry.note || '';
          $('vacEntryTitle').textContent = 'Urlaub bearbeiten';
          $('vacSaveEntry').textContent = 'Änderungen speichern';
          $('vacCancelEdit').hidden = false; preview();
          $('vacEntryForm').scrollIntoView({behavior: 'smooth', block: 'center'});
        });
        const remove = node('button', 'vac-icon-btn', 'Löschen'); remove.type = 'button';
        remove.addEventListener('click', () => {
          if (!confirm('Diesen Urlaubseintrag löschen?')) return;
          data.entries = data.entries.filter(e => e.id !== entry.id);
          if (editId === entry.id) resetEdit();
          if (persist()) render();
        });
        buttons.append(edit, remove); row.append(left, buttons); rows.append(row);
      }
      if (!entries.length) rows.append(node('p', 'vac-empty', 'Für dieses Jahr ist noch kein Urlaub eingetragen.'));
    }
    function renderCalendar() {
      $('vacMonthLabel').textContent = month.toLocaleDateString('de-DE', {month: 'long', year: 'numeric'});
      const calendar = $('vacCalendar'); calendar.replaceChildren();
      ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(w => calendar.append(node('div', 'vac-weekday', w)));
      const start = new Date(month);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const today = api.iso(new Date());
      for (let i = 0; i < 42; i++) {
        const day = new Date(start); day.setDate(start.getDate() + i);
        const iso = api.iso(day);
        const vacationEntries = data.entries.filter(e => e.start <= iso && e.end >= iso);
        const holiday = window.LadenflussHolidays?.getHoliday(day, data.settings.state);
        const count = api.absencesOn(iso, vacationEntries).length;
        const collision = api.isWorkday(day, data.settings) && count > data.settings.maxAbsent;
        let classes = 'vac-day';
        if (day.getMonth() !== month.getMonth()) classes += ' outside';
        if ([0,6].includes(day.getDay())) classes += ' weekend';
        if (holiday) classes += ' holiday';
        if (collision) classes += ' alert';
        if (iso === today) classes += ' today';
        const cell = node('div', classes);
        cell.append(node('span', 'vac-day-num', String(day.getDate())));
        if (holiday) cell.append(node('small', 'vac-holiday', holiday));
        vacationEntries.slice(0, 3).forEach(entry => {
          const tag = node('span', 'vac-tag' + (entry.status === 'approved' ? ' approved' : ''), employeeName(entry.employeeId));
          tag.title = employeeName(entry.employeeId) + ' · ' + (entry.status === 'approved' ? 'Bestätigt' : 'Geplant');
          cell.append(tag);
        });
        if (vacationEntries.length > 3) cell.append(node('span', 'vac-holiday', '+' + (vacationEntries.length - 3) + ' weitere'));
        calendar.append(cell);
      }
    }
    function render() { renderTeam(); renderEntries(); renderCalendar(); renderBalance(); }
    function resetEdit() {
      editId = null; $('vacEntryForm').reset();
      $('vacEntryTitle').textContent = 'Urlaub eintragen';
      $('vacSaveEntry').textContent = 'Urlaub eintragen';
      $('vacCancelEdit').hidden = true; preview();
    }
    function preview() {
      const person = $('vacPerson').value;
      const from = $('vacFrom').value; const to = $('vacTo').value;
      const target = $('vacPreview');
      if (!person || !from || !to) return target.textContent = 'Mitarbeiter und Zeitraum auswählen.';
      try {
        const candidate = {id: editId || '', employeeId: person, start: from, end: to};
        const same = api.conflictForEmployee(candidate, data.entries);
        const days = api.countDays(candidate, data.settings);
        const clashes = api.overCapacity(candidate, data.entries, data.settings);
        target.textContent = days + ' geplante Arbeitstage' +
          (same ? ' · Achtung: überschneidet sich mit einem bestehenden Eintrag dieser Person!' : '') +
          (clashes.length ? ' · Achtung: an ' + clashes.length + ' Arbeitstagen fehlen zu viele Personen.' : '');
      } catch (e) { target.textContent = e.message; }
    }
    $('vacImportPep').addEventListener('click', () => {
      if (!window.LadenflussTeamStore?.getTeam) {
        return fail('Die Personalplanung konnte nicht geladen werden.');
      }
      if (!confirm('Mitarbeiter aus der Personalplanung auf diesem Browser übernehmen? Wenn noch kein Team gespeichert ist, werden die Demo-Mitarbeiter übernommen.')) return;
      let source;
      try { source = window.LadenflussTeamStore.getTeam(); }
      catch (e) { return fail('Team konnte nicht übernommen werden: ' + e.message); }
      let added = 0;
      for (const member of source) {
        if (!member.id || !member.name ||
            data.employees.some(e => e.id === member.id ||
              e.name.trim().toLowerCase() === member.name.trim().toLowerCase())) continue;
        data.employees.push({id: member.id, name: member.name.trim(), allowance: 30});
        added++;
      }
      if (persist()) {
        render();
        if (!added) fail('Keine neuen Mitarbeiter übernommen. Bestehende Namen wurden nicht doppelt angelegt.');
      }
    });
    $('vacEmployeeForm').addEventListener('submit', event => {
      event.preventDefault();
      const name = $('vacEmployeeName').value.trim();
      const allowance = Number($('vacAllowance').value);
      if (!name || !Number.isInteger(allowance) || allowance < 0 || allowance > 366) return fail('Bitte Namen und gültiges Jahresbudget eingeben.');
      const id = window.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2);
      data.employees.push({id, name, allowance});
      if (persist()) { $('vacEmployeeForm').reset(); $('vacAllowance').value = '30'; render(); $('vacPerson').value = id; }
    });
    $('vacEntryForm').addEventListener('submit', event => {
      event.preventDefault();
      const candidate = {
        id: editId || window.crypto?.randomUUID?.() || String(Date.now()),
        employeeId: $('vacPerson').value, start: $('vacFrom').value, end: $('vacTo').value,
        status: $('vacStatus').value, note: $('vacNote').value.trim(),
      };
      if (!data.employees.some(e => e.id === candidate.employeeId)) return fail('Bitte Mitarbeiter auswählen.');
      try {
        api.eachDate(candidate.start, candidate.end, () => {});
        if (api.conflictForEmployee(candidate, data.entries)) return fail('Für diesen Mitarbeiter gibt es in diesem Zeitraum schon Urlaub. Bitte Einträge prüfen.');
        const clashes = api.overCapacity(candidate, data.entries, data.settings);
        if (clashes.length && !confirm('Warnung: An ' + clashes.length + ' Arbeitstagen sind mehr Personen im Urlaub als eingestellt. Trotzdem speichern?')) return;
      } catch (e) { return fail(e.message); }
      if (editId) data.entries = data.entries.map(e => e.id === editId ? candidate : e);
      else data.entries.push(candidate);
      if (persist()) {
        month = new Date(Number(candidate.start.slice(0, 4)), Number(candidate.start.slice(5, 7)) - 1, 1, 12);
        resetEdit(); render();
      }
    });
    $('vacCancelEdit').addEventListener('click', resetEdit);
    for (const id of ['vacFrom', 'vacTo', 'vacPerson']) $(id).addEventListener('change', preview);
    const saveSettings = () => {
      const max = Number($('vacMaxAbsent').value);
      if (!Number.isInteger(max) || max < 1 || max > 100) return fail('Maximal gleichzeitig abwesend muss zwischen 1 und 100 liegen.');
      data.settings = {
        state: $('vacState').value,
        workdays: $('vacWorkweek').value === '6' ? [1,2,3,4,5,6] : [1,2,3,4,5],
        maxAbsent: max,
      };
      if (persist()) { preview(); render(); }
    };
    ['vacState', 'vacWorkweek', 'vacMaxAbsent'].forEach(id => $(id).addEventListener('change', saveSettings));
    $('vacPrevMonth').addEventListener('click', () => { month.setMonth(month.getMonth() - 1); render(); });
    $('vacNextMonth').addEventListener('click', () => { month.setMonth(month.getMonth() + 1); render(); });
    $('vacToday').addEventListener('click', () => { const now = new Date(); month = new Date(now.getFullYear(), now.getMonth(), 1, 12); render(); });
    $('vacPrint').addEventListener('click', () => window.print());
    render();
  });
})();
