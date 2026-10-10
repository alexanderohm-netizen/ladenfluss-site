(function(root){
'use strict';
const KEY='ladenfluss.urlaubsplaner.v1', TEAM='ladenfluss.team.v1';
function clean(input){
 if(!input||!Array.isArray(input.employees)||!Array.isArray(input.entries)||input.employees.length>2000||input.entries.length>10000)throw Error('Die Urlaubssicherung ist ungültig oder zu groß.');
 if(new TextEncoder().encode(JSON.stringify(input)).length>512000)throw Error('Die Urlaubssicherung darf höchstens 500 KB groß sein.');
 root.LadenflussVacation.validate(input);
 const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
 const id=s=>text(s,128)&&!['__proto__','constructor','prototype'].includes(s);
 return {version:1,settings:{state:input.settings.state,workdays:[...input.settings.workdays],maxAbsent:input.settings.maxAbsent},employees:input.employees.map(p=>{
  if(!id(p.id)||!text(p.name,120))throw Error('Ungültige Person in der Sicherung.');return {id:p.id,name:p.name,allowance:p.allowance};
 }),entries:input.entries.map(e=>{
  if(!id(e.id)||(e.note!=null&&(typeof e.note!=='string'||e.note.length>2000)))throw Error('Ungültiger Urlaubseintrag.');
  return {id:e.id,employeeId:e.employeeId,start:e.start,end:e.end,status:e.status,note:e.note||''};
 })};
}
function summary(data){return data.employees.length+(data.employees.length===1?' Person · ':' Personen · ')+data.entries.length+(data.entries.length===1?' Urlaubseintrag':' Urlaubseinträge');}
function baseline(storage){return JSON.stringify([storage.getItem(KEY),storage.getItem(TEAM)]);}
function checkTeam(data,storage){
 const raw=storage.getItem(TEAM);if(raw===null)return;const team=JSON.parse(raw);
 if(!Array.isArray(team))throw Error('Die vorhandenen Teamdaten sind nicht lesbar.');
 const norm=s=>s.trim().normalize('NFKC').toLocaleLowerCase('de');
 for(const p of data.employees){const other=team.find(t=>t.id===p.id);if(other&&(typeof other.name!=='string'||norm(other.name)!==norm(p.name)))throw Error('Eine Mitarbeiter-ID gehört hier zu einer anderen Person. Bitte zuerst die Team-Zuordnung prüfen.');}
}
function prepare(input,storage){const data=clean(input);checkTeam(data,storage);return {data,baseline:baseline(storage)};}
function apply(plan,storage){const data=clean(plan.data);checkTeam(data,storage);if(baseline(storage)!==plan.baseline)throw Error('Lokale Daten wurden geändert. Bitte die Vorschau neu laden.');storage.setItem(KEY,JSON.stringify(data));}
root.LadenflussVacationCloud={KEY,clean,summary,baseline,prepare,apply};
})(typeof window==='undefined'?globalThis:window);
