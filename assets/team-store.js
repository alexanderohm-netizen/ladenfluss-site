(function(){
  const TEAM_KEY='ladenfluss.team.v1';
  const SHIFTS_KEY='ladenfluss.pep.shifts.v1';

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
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'null');
      return parsed ?? fallback;
    }catch{return fallback}
  }

  function getTeam(){
    const team=read(TEAM_KEY,null);
    if(Array.isArray(team)&&team.length) return team;
    localStorage.setItem(TEAM_KEY,JSON.stringify(defaultTeam));
    return defaultTeam.map(x=>({...x}));
  }

  function saveTeam(team){
    localStorage.setItem(TEAM_KEY,JSON.stringify(team));
  }

  function getShifts(){
    const shifts=read(SHIFTS_KEY,null);
    if(shifts&&typeof shifts==='object') return shifts;
    localStorage.setItem(SHIFTS_KEY,JSON.stringify(defaultShifts));
    return JSON.parse(JSON.stringify(defaultShifts));
  }

  function saveShifts(shifts){
    localStorage.setItem(SHIFTS_KEY,JSON.stringify(shifts));
  }

  function ensureEmployeeShiftRows(team,shifts){
    team.forEach(p=>{if(!Array.isArray(shifts[p.id])) shifts[p.id]=[null,null,null,null,null,null,null]});
    Object.keys(shifts).forEach(id=>{if(!team.some(p=>p.id===id)) delete shifts[id]});
    return shifts;
  }

  window.LadenflussTeamStore={getTeam,saveTeam,getShifts,saveShifts,ensureEmployeeShiftRows};
})();