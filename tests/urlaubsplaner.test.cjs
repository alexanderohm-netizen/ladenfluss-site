'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const storage = new Map();
  const window = {LadenflussHolidays: {
    getHoliday: (d, state) =>
      state === 'HE' && d.getFullYear() === 2026 &&
      d.getMonth() === 9 && d.getDate() === 6 ? 'Testfeiertag' : null,
  }};
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  vm.runInNewContext(
    fs.readFileSync('assets/urlaubsplaner-store.js', 'utf8'),
    {window, localStorage, Date, Error},
  );
  return {api: window.LadenflussVacation, storage};
}
const config = (state = 'HE', workdays = [1,2,3,4,5], maxAbsent = 1) =>
  ({state, workdays, maxAbsent});
const vacation = (id, employeeId, start, end) =>
  ({id, employeeId, start, end, status: 'planned'});

test('Urlaubstage berücksichtigen Wochenende und Bundeslandfeiertage', () => {
  const {api} = setup();
  const v = vacation('1','a','2026-10-05','2026-10-11');
  assert.equal(api.countDays(v, config()), 4);
  assert.equal(api.countDays(v, config('NW')), 5);
  assert.equal(api.countDays(v, config('NW', [1,2,3,4,5,6])), 6);
});

test('Jahresübergreifender Urlaub wird je Kalenderjahr berechnet', () => {
  const {api} = setup();
  const v = vacation('1','a','2026-12-28','2027-01-05');
  assert.equal(api.countDays(v, config(), 2026), 4);
  assert.equal(api.countDays(v, config(), 2027), 3);
  assert.equal(api.tally('a', 2027, [v], config()), 3);
});

test('Gleiche Person darf nicht im selben Zeitraum doppelt gebucht werden', () => {
  const {api} = setup();
  const old = vacation('1','a','2026-11-02','2026-11-06');
  assert.equal(api.conflictForEmployee(vacation('2','a','2026-11-06','2026-11-10'), [old]).id, '1');
  assert.equal(api.conflictForEmployee(vacation('2','b','2026-11-06','2026-11-10'), [old]), undefined);
});

test('Personalengpass wird als Vorschlag sichtbar, nicht als Genehmigungssperre', () => {
  const {api} = setup();
  const first = vacation('1','a','2026-11-02','2026-11-06');
  const second = vacation('2','b','2026-11-04','2026-11-06');
  assert.equal(api.overCapacity(second, [first], config('HE')).length, 3);
});

test('Ungültige und zu lange Zeiträume werden abgelehnt', () => {
  const {api} = setup();
  assert.throws(() => api.countDays(vacation('1','a','2026-02-30','2026-03-01'), config()));
  assert.throws(() => api.countDays(vacation('1','a','2026-10-10','2026-10-02'), config()));
  assert.throws(() => api.countDays(vacation('1','a','2026-01-01','2028-01-01'), config()));
});

test('Browserdaten erhalten Team und Urlaubseinträge', () => {
  const {api} = setup();
  const data = api.empty();
  data.employees.push({id:'a',name:'Anna',allowance:30});
  data.entries.push(vacation('1','a','2026-11-02','2026-11-06'));
  api.save(data);
  assert.equal(api.read().employees[0].name, 'Anna');
  assert.equal(api.read().entries.length, 1);
});

for (const [title, breakData] of [
  ['fehlende Arbeitstage', d => { delete d.settings.workdays; }],
  ['unbekanntes Bundesland', d => { d.settings.state = 'XX'; }],
  ['ungültiges Budget', d => { d.employees[0].allowance = -1; }],
  ['doppelte Mitarbeiter-ID', d => { d.employees.push({...d.employees[0]}); }],
  ['verwaister Urlaub', d => { d.entries[0].employeeId = 'missing'; }],
  ['unbekannter Status', d => { d.entries[0].status = 'other'; }],
  ['ungültiges Datum', d => { d.entries[0].start = '2026-02-30'; }],
  ['überlappender Urlaub', d => { d.entries.push({...d.entries[0], id: 'second'}); }],
]) {
  test('Beschädigte Daten bleiben geschützt: ' + title, () => {
    const {api, storage} = setup();
    const data = api.empty();
    data.employees.push({id:'a', name:'Anna', allowance:30});
    data.entries.push(vacation('1','a','2026-11-02','2026-11-06'));
    breakData(data);
    const raw = JSON.stringify(data);
    storage.set(api.KEY, raw);
    assert.throws(() => api.read());
    assert.throws(() => api.save(data));
    assert.equal(storage.get(api.KEY), raw);
  });
}

test('Ein ausdrücklich leeres Team wird nicht mit Demopersonen aufgefüllt', () => {
  const storage = new Map([['ladenfluss.team.v1', '[]']]);
  const window = {};
  vm.runInNewContext(fs.readFileSync('assets/team-store.js', 'utf8'), {
    window, localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k,v) => storage.set(k,v),
    },
  });
  assert.equal(window.LadenflussTeamStore.getTeam().length, 0);
  assert.equal(storage.get('ladenfluss.team.v1'), '[]');
});
