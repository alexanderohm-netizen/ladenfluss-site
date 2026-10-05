(function(){
function current(){
 const s=window.LadenflussTeamStore;if(!s)return[];
 const week=s.mondayKey(),team=s.getTeam(),sh=s.ensureEmployeeShiftRows(team,s.getShifts(week)),ab=s.ensureEmployeeAbsenceRows(team,s.getAbsences(week)),out=[];
 const mins=t=>{const x=t.split(':').map(Number);return x[0]*60+x[1]},hours=x=>!x?0:Math.max(0,(mins(x[1])-mins(x[0])-Number(x[2]||0))/60);
 const shop=(()=>{try{return Object.assign({open:'09:00',close:'18:00',minStaff:2,days:6,state:'HE'},JSON.parse(localStorage.getItem('ladenfluss.store.v1')||'{}'))}catch{return{open:'09:00',close:'18:00',minStaff:2,days:6,state:'HE'}}})();
 const weekDate=new Date(week+'T12:00:00'),dayNames=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
 for(let d=0;d<Math.min(7,Number(shop.days||6));d++){const date=new Date(weekDate);date.setDate(date.getDate()+d);if(window.LadenflussHolidays?.getHoliday(date,shop.state||'HE'))continue;const start=mins(shop.open),end=mins(shop.close),need=Number(shop.minStaff||2);let gap=null;for(let t=start;t<end;t+=30){const count=team.filter(p=>{const x=sh[p.id]?.[d];return x&&!ab[p.id]?.[d]&&mins(x[0])<=t&&mins(x[1])>t}).length;if(count<need){if(!gap)gap={from:t,to:t+30,min:count};else{gap.to=t+30;gap.min=Math.min(gap.min,count)}}else if(gap){out.push({module:'Personal',priority:'critical',title:'Unterbesetzung',message:dayNames[d]+' '+String(Math.floor(gap.from/60)).padStart(2,'0')+':'+String(gap.from%60).padStart(2,'0')+'–'+String(Math.floor(gap.to/60)).padStart(2,'0')+':'+String(gap.to%60).padStart(2,'0')+' nur '+gap.min+' von '+need+' Personen verfügbar.',action:'Besetzung prüfen',href:'/pep'});gap=null}}if(gap)out.push({module:'Personal',priority:'critical',title:'Unterbesetzung',message:dayNames[d]+' bis Ladenschluss nur '+gap.min+' von '+need+' Personen verfügbar.',action:'Besetzung prüfen',href:'/pep'})}
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