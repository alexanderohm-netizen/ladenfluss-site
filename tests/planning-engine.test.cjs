'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const window={};const context=vm.createContext({window,Date,Map,Set,URLSearchParams});
  for(const file of ['signals','planning-engine','business-signals','backup'])vm.runInContext(fs.readFileSync('assets/'+file+'.js','utf8'),context);
  return window;
}
const row=(shift)=>[shift,null,null,null,null,null,null];
const base=()=>({week:'2026-10-05',team:[{id:'a',name:'Anna',hours:3},{id:'b',name:'Ben',hours:3}],
  shifts:{a:row(['09:00','12:00',0]),b:row(['12:05','15:00',0])},absences:{},
  shop:{open:'09:00',close:'15:00',days:1,minStaff:1,state:'HE'}});

test('Fünfminütige Lücke wird exakt erkannt und mit fehlenden Personalminuten bewertet',()=>{
  const w=setup(),result=w.LadenflussPlanning.analyze(base());
  assert.equal(result.missingStaffMinutes,5);
  assert.match(result.signals.find(s=>s.id==='coverage:2026-10-05').message,/12:00–12:05/);
  assert.equal(result.days[0].gaps[0].from,720);
});

test('Keine pauschalen 30 Minuten über die Ladenschließung hinaus',()=>{
  const w=setup(),input=base();input.shop.close='15:10';input.shifts.b=row(['12:00','15:00',0]);
  assert.equal(w.LadenflussPlanning.analyze(input).missingStaffMinutes,10);
});

test('Fehlende Personen werden über die Dauer summiert',()=>{
  const w=setup(),input=base();input.shop.minStaff=2;
  const result=w.LadenflussPlanning.analyze(input);
  assert.equal(result.missingStaffMinutes,365);
});

test('Bestätigter Urlaub zählt nicht als verfügbare Besetzung; geplanter Urlaub schon',()=>{
  const w=setup(),input=base();input.shifts.b=row(['12:00','15:00',0]);
  input.vacations=[{employeeId:'a',start:'2026-10-05',end:'2026-10-05',status:'planned'}];
  assert.equal(w.LadenflussPlanning.analyze(input).missingStaffMinutes,0);
  input.vacations[0].status='approved';const result=w.LadenflussPlanning.analyze(input);
  assert.equal(result.missingStaffMinutes,180);assert.equal(result.plannedHours,6);assert.equal(result.availableHours,3);
  assert.ok(result.signals.some(s=>s.id==='absence-conflict:a:2026-10-05'));
});

test('Feiertage und geschlossene Tage erzeugen keine falschen Besetzungslücken',()=>{
  const w=setup(),input=base();input.holiday=()=> 'Feiertag';
  const result=w.LadenflussPlanning.analyze(input);assert.equal(result.missingStaffMinutes,0);
  assert.ok(result.days.every(d=>d.closed));
});

test('Unbekannte Pausenlage wird sichtbar; Urlaub erzeugt keinen unbegründeten Sollfehlalarm',()=>{
  const w=setup(),input=base();input.shifts.a=row(['09:00','12:00',15]);
  input.team[1].hours=40;input.absences={b:['Urlaub',null,null,null,null,null,null]};
  const result=w.LadenflussPlanning.analyze(input);
  assert.ok(result.signals.some(s=>s.id==='break-placement:2026-10-05'));
  assert.ok(!result.signals.some(s=>s.id==='hours-low:2026-10-05:b'));
});

test('Hinweise behalten interne Aktionslinks und weisen externe Links ab',()=>{
  const w=setup();const result=w.LadenflussSignals.sort([
    {id:'x',title:'Prüfen',priority:'critical',href:'/pep?week=2026-10-05',impact:'Wirkung',source:'Grundlage',evidence:['Fakt']},
    {id:'y',href:'javascript:alert(1)'},{id:'z',href:'//example.com'},
  ]);
  assert.equal(result[0].href,'/pep?week=2026-10-05');assert.equal(result[0].evidence[0],'Fakt');
  assert.equal(result[1].href,'/mein-laden');assert.equal(result[2].href,'/mein-laden');
});

test('Doppelte IDs werden zusammengeführt, verschiedene Hinweise bleiben erhalten',()=>{
  const w=setup();const result=w.LadenflussSignals.sort([{id:'a',priority:'info'},{id:'a',priority:'critical'},{id:'b',priority:'important'}]);
  assert.equal(result.length,2);assert.equal(result[0].priority,'critical');
});

test('Nur die neueste aktuelle Berechnung eines Werkzeugs löst einen Hinweis aus',()=>{
  const w=setup(),now=new Date('2026-10-06T12:00:00Z');
  const old={tool:'Lagerumschlag',at:'2026-10-05T12:00:00Z',data:{cogs:100,coverageGap:-4}};
  const fixed={...old,at:'2026-10-06T10:00:00Z',data:{cogs:100,coverageGap:2}};
  assert.equal(w.LadenflussBusinessSignals.fromHistory([old,fixed],now).length,0);
  assert.equal(w.LadenflussBusinessSignals.fromHistory([old],now).length,1);
  assert.equal(w.LadenflussBusinessSignals.fromHistory([{...old,at:'2026-09-01T12:00:00Z'}],now).length,0);
  assert.equal(w.LadenflussBusinessSignals.fromHistory([{...old,data:{cogs:0,coverageGap:null}}],now).length,0);
});

test('Sicherung erhält Originaldaten auch bei beschädigtem JSON und lässt fremde Schlüssel aus',()=>{
  const w=setup(),data=new Map([['ladenfluss.team.v1','{kaputt'],['ladenfluss.store.v1','{"name":"Test"}'],['access_token','secret'],['other.app','private']]);
  const backup=w.LadenflussBackup.capture({getItem:key=>data.get(key)??null},new Date('2026-10-06T12:00:00Z'));
  assert.equal(backup.records['ladenfluss.team.v1'],'{kaputt');
  assert.equal(Object.keys(backup.records).length,2);assert.equal(backup.version,1);
  assert.equal(data.size,4);
});
