(function(){
  const TEAM_KEY='ladenfluss.team.v1';
  const SHIFTS_KEY='ladenfluss.pep.weeks.v2';
  const LEGACY_SHIFTS_KEY='ladenfluss.pep.shifts.v1';
  const PLAN_KEY='ladenfluss.pep.plan-status.v1';
  const ABSENCE_KEY='ladenfluss.pep.absences.v1';

  const defaultTeam=[
    {id:'e1',name:'Anna Müller',role:'Verkauf',hours:30,branch:'Hauptfiliale',docs:true},
    {id:'e2',name:'Ben Weber',role:'Verkauf',hours:35,branch:'Hauptfiliale',docs:true},
    {id:'e3',name:'Mira Klein',role:'Aushilfe',hours:20,branch:'Hauptfiliale',docs:false}
  ];

  const defaultShifts={
    e1:[['08:00','14:00',30],['08:00','14:00',30],null,['12:00','18:00',30],['08:00','14:00',30],null,null],
    e2:[['11:00','19:00',30],null,['11:00','19:00',30],['11:00','19:00',30],null,['09:00','17:00',30],null],
    e3:[null,['14:00','19:00',15],null,null,['14:00','19:00',15],['10:00','16:00',30],null]
  };

  function read(key,fallback){
    try{const parsed=JSON.parse((window.LadenflussLocal||localStorage).getItem(key)||'null');return parsed??fallback}catch(error){if(window.LadenflussTeamStorage&&localStorage.getItem(window.LadenflussTeamStorage.KEY)!==null)throw error;return fallback}
  }
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function getTeam(){
    const team=read(TEAM_KEY,null);
    if(Array.isArray(team))return team;
    (window.LadenflussLocal||localStorage).setItem(TEAM_KEY,JSON.stringify(defaultTeam));
    return clone(defaultTeam);
  }
  function saveTeam(team){(window.LadenflussLocal||localStorage).setItem(TEAM_KEY,JSON.stringify(team))}
  function mondayKey(date=new Date()){
    const d=new Date(date);d.setHours(12,0,0,0);
    const day=d.getDay()||7;d.setDate(d.getDate()-day+1);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function getAllWeeks(){
    let weeks=read(SHIFTS_KEY,null);
    if(weeks&&typeof weeks==='object')return weeks;
    weeks={};
    const legacy=read(LEGACY_SHIFTS_KEY,null);
    weeks[mondayKey()]=legacy&&typeof legacy==='object'?legacy:clone(defaultShifts);
    (window.LadenflussLocal||localStorage).setItem(SHIFTS_KEY,JSON.stringify(weeks));
    return weeks;
  }
  function getShifts(week=mondayKey()){
    const weeks=getAllWeeks();
    return clone(weeks[week]||{});
  }
  function saveShifts(shifts,week=mondayKey()){
    const weeks=getAllWeeks();weeks[week]=shifts;
    (window.LadenflussLocal||localStorage).setItem(SHIFTS_KEY,JSON.stringify(weeks));
  }
  function getPlanStatus(week=mondayKey()){
    const states=read(PLAN_KEY,{});
    return states[week]||'draft';
  }
  function savePlanStatus(status,week=mondayKey()){
    const states=read(PLAN_KEY,{});states[week]=status;
    (window.LadenflussLocal||localStorage).setItem(PLAN_KEY,JSON.stringify(states));
  }
  function getAbsences(week=mondayKey()){
    const weeks=read(ABSENCE_KEY,{});
    return clone(weeks[week]||{});
  }
  function saveAbsences(absences,week=mondayKey()){
    const weeks=read(ABSENCE_KEY,{});
    weeks[week]=absences;
    (window.LadenflussLocal||localStorage).setItem(ABSENCE_KEY,JSON.stringify(weeks));
  }
  function ensureEmployeeAbsenceRows(team,absences){
    team.forEach(p=>{if(!Array.isArray(absences[p.id]))absences[p.id]=[null,null,null,null,null,null,null]});
    Object.keys(absences).forEach(id=>{if(!team.some(p=>p.id===id))delete absences[id]});
    return absences;
  }
  function ensureEmployeeShiftRows(team,shifts){
    team.forEach(p=>{if(!Array.isArray(shifts[p.id]))shifts[p.id]=[null,null,null,null,null,null,null]});
    Object.keys(shifts).forEach(id=>{if(!team.some(p=>p.id===id))delete shifts[id]});
    return shifts;
  }
  // Only use escaped text when interpolating local user input into HTML.
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  window.LadenflussTeamStore={getTeam,saveTeam,getShifts,saveShifts,getPlanStatus,savePlanStatus,getAbsences,saveAbsences,ensureEmployeeAbsenceRows,ensureEmployeeShiftRows,mondayKey,escapeHtml};
})();
