(function(){
function current(){
 const s=window.LadenflussTeamStore;if(!s)return[];
 const week=s.mondayKey(),team=s.getTeam(),sh=s.ensureEmployeeShiftRows(team,s.getShifts(week)),ab=s.ensureEmployeeAbsenceRows(team,s.getAbsences(week)),out=[];
 const mins=t=>{const x=t.split(':').map(Number);return x[0]*60+x[1]},hours=x=>!x?0:Math.max(0,(mins(x[1])-mins(x[0])-Number(x[2]||0))/60);
 team.forEach(p=>{
  const row=sh[p.id]||[],away=ab[p.id]||[];
  row.forEach((x,i)=>{if(x&&away[i])out.push({module:'Personal',priority:'critical',title:'Planungskonflikt',message:p.name+' ist '+away[i]+' und gleichzeitig eingeplant.',action:'Dienstplan öffnen',href:'/pep'})});
  const total=row.reduce((a,x)=>a+hours(x),0),target=Number(p.hours||0);
  if(total>target+5)out.push({module:'Personal',priority:'important',title:'Zu viele Stunden geplant',message:p.name+' liegt deutlich über den Sollstunden.',action:'Stunden prüfen',href:'/pep'});
  else if(total<Math.max(0,target-8))out.push({module:'Personal',priority:'info',title:'Weniger Stunden geplant',message:p.name+' liegt deutlich unter den Sollstunden.',action:'Plan prüfen',href:'/pep'});
 });
 return window.LadenflussSignals?window.LadenflussSignals.sort(out):out;
}
window.LadenflussPepSignals={current};
})();