(function () {
  'use strict';
  const KEY = 'ladenfluss.urlaubsplaner.v1';
  const pad = n => String(n).padStart(2, '0');
  const iso = date => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  function dateOf(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const [year, month, day] = value.split('-').map(Number);
    const d = new Date(year, month - 1, day, 12);
    return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day ? d : null;
  }
  function eachDate(start, end, visit) {
    const first = dateOf(start), last = dateOf(end);
    if (!first || !last || first > last) throw new Error('Bitte einen gültigen Zeitraum auswählen.');
    const limit = Math.round((last - first) / 86400000);
    if (limit > 370) throw new Error('Ein Eintrag darf höchstens etwa ein Jahr umfassen.');
    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) visit(d);
  }
  function empty() {
    return {version: 1, employees: [], entries: [], settings: {state: 'HE', workdays: [1, 2, 3, 4, 5], maxAbsent: 1}};
  }
  function read() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.employees) || !Array.isArray(parsed.entries) || !parsed.settings) {
      throw new Error('Das gespeicherte Urlaubsformat ist beschädigt. Daten werden nicht überschrieben.');
    }
    return parsed;
  }
  function save(data) {
    if (!data || data.version !== 1) throw new Error('Ungültige Daten');
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function isWorkday(d, settings) {
    const day = d.getDay();
    const holiday = window.LadenflussHolidays?.getHoliday(d, settings.state);
    return settings.workdays.includes(day) && !holiday;
  }
  function countDays(entry, settings, year) {
    let count = 0;
    eachDate(entry.start, entry.end, d => {
      if ((year == null || d.getFullYear() === year) && isWorkday(d, settings)) count++;
    });
    return count;
  }
  function intervalOverlap(a, b) {
    return a.start <= b.end && b.start <= a.end;
  }
  function conflictForEmployee(candidate, entries) {
    return entries.find(e => e.id !== candidate.id &&
      e.employeeId === candidate.employeeId && intervalOverlap(e, candidate));
  }
  function absencesOn(dateKey, entries) {
    return [...new Set(entries.filter(e => e.start <= dateKey && e.end >= dateKey)
      .map(e => e.employeeId))];
  }
  // All planning statuses count toward the capacity warning; they are not approval decisions.
  function overCapacity(candidate, entries, settings) {
    const all = entries.filter(e => e.id !== candidate.id).concat(candidate);
    const conflictDays = [];
    eachDate(candidate.start, candidate.end, d => {
      if (!isWorkday(d, settings)) return;
      const date = iso(d);
      if (absencesOn(date, all).length > settings.maxAbsent) conflictDays.push(date);
    });
    return conflictDays;
  }
  function tally(employeeId, year, entries, settings) {
    return entries.filter(e => e.employeeId === employeeId)
      .reduce((total, entry) => total + countDays(entry, settings, year), 0);
  }
  window.LadenflussVacation = {
    KEY, read, save, empty, dateOf, iso, eachDate, countDays, isWorkday,
    conflictForEmployee, overCapacity, tally, absencesOn,
  };
})();
