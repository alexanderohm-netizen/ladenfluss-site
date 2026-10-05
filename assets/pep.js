document.addEventListener('DOMContentLoaded',()=> {
  const store=window.LadenflussTeamStore;
  const team=store.getTeam();
  let weekStart=new Date();
  const day=weekStart.getDay()||7;
  weekStart.setDate(weekStart.getDate()-day+1);
  weekStart.setHours(12,0,0,0);
  let weekKey=store.mondayKey(weekStart);
  let shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));

  const employees=team.map(p=>({
    id:p.id,
    name:p.name,
    role:p.role,
    target:Number(p.hours||0),
    shifts:shifts[p.id]
  }));

  const body=document.getElementById('pepBody');
  const dlg=document.getElementById('shiftDialog');
  const delBtn=document.getElementById('deleteShift');
  const publishBtn=document.getElementById('publishPlan');
  const planStatus=document.getElementById('planStatus');
  let editing=null;
  let published=store.getPlanStatus(weekKey)==='published';

  const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
  const hours=s=>!s?0:Math.max(0,(mins(s[1])-mins(s[0])-Number(s[2]||0))/60);

  function persist(){
    const next={};
    employees.forEach(e=>next[e.id]=e.shifts);
    store.saveShifts(next,weekKey);
  }

  function getIssues(){
    return employees.map(e=>{
      const total=e.shifts.reduce((a,s)=>a+hours(s),0);
      if(total>e.target+5) return {name:e.name,type:'high',text:`${e.name} liegt deutlich über den Sollstunden.`};
      if(total<Math.max(0,e.target-8)) return {name:e.name,type:'low',text:`${e.name} liegt deutlich unter den Sollstunden.`};
      return null;
    }).filter(Boolean);
  }

  function markDraft(){
    published=false;
    planStatus.classList.remove('published');
    planStatus.innerHTML='<i></i> Entwurf';
    publishBtn.textContent='Plan veröffentlichen';
    store.savePlanStatus('draft',weekKey);
  }

  function render(){
    renderWeekHeader();
    renderDayCheck();
    renderPlanState();
    body.innerHTML=employees.map(e=>{
      const total=e.shifts.reduce((a,s)=>a+hours(s),0);
      const cells=e.shifts.map((s,i)=>s
        ? `<td><button class="shift-chip" data-e="${e.id}" data-d="${i}" title="Schicht bearbeiten"><strong>${s[0]}–${s[1]}</strong><span>${hours(s).toLocaleString('de-DE',{maximumFractionDigits:1})} h · ${s[2]} Min Pause</span></button></td>`
        : `<td><button class="empty-shift" data-e="${e.id}" data-d="${i}" aria-label="Schicht hinzufügen">+</button></td>`).join('');
      const state=total>e.target+5?'high':total<Math.max(0,e.target-8)?'low':'ok';
      return `<tr><th><strong>${e.name}</strong><span>${e.role} · Ziel ${e.target} h</span></th>${cells}<td class="week-total ${state}"><strong>${total.toLocaleString('de-DE',{maximumFractionDigits:1})} h</strong><span>${state==='ok'?'passt':state==='high'?'zu hoch':'zu niedrig'}</span></td></tr>`;
    }).join('');

    const total=employees.reduce((a,e)=>a+e.shifts.reduce((x,s)=>x+hours(s),0),0);
    const issues=getIssues();

    document.getElementById('plannedHours').textContent=total.toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
    document.getElementById('employeeCount').textContent=employees.length;
    document.getElementById('issueCount').textContent=issues.length;
    document.getElementById('issueText').textContent=issues.length?issues.length===1?'1 Hinweis prüfen':issues.length+' Hinweise prüfen':'Alles ruhig';

    const focus=document.getElementById('pepFocus');
    focus.querySelector('strong').textContent=issues.length?issues[0].text:'Der Plan sieht gut aus.';
    focus.querySelector('p').textContent=issues.length>1
      ? `Zusätzlich gibt es ${issues.length-1} weitere Auffälligkeit${issues.length-1===1?'':'en'}. Prüfe die markierten Wochensummen.`
      : issues.length===1
        ? 'Die markierte Wochensumme weicht deutlich vom hinterlegten Soll ab.'
        : 'Keine auffälligen Wochenstunden in diesem Plan.';

    bindCells();
  }

  function renderPlanState(){
    published=store.getPlanStatus(weekKey)==='published';
    planStatus.classList.toggle('published',published);
    planStatus.innerHTML=published?'<i></i> Veröffentlicht':'<i></i> Entwurf';
    publishBtn.textContent=published?'Zurück auf Entwurf':'Plan veröffentlichen';
  }

  function renderWeekHeader(){
    const days=['Mo','Di','Mi','Do','Fr','Sa','So'];
    const dates=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d});
    const fmt=d=>d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const state='HE';
    document.getElementById('weekTitle').textContent=fmt(dates[0])+'–'+fmt(dates[6]);
    document.getElementById('pepDays').innerHTML='<th>Mitarbeiter</th>'+dates.map((d,i)=>{const holiday=window.LadenflussHolidays?.getHoliday(d,state);return '<th class="'+(holiday?'holiday':'')+'">'+days[i]+' '+String(d.getDate()).padStart(2,'0')+'.'+(holiday?'<small>'+holiday+'</small>':'')+'</th>'}).join('')+'<th>Summe</th>';
  }

  function renderDayCheck(){
    const names=['Mo','Di','Mi','Do','Fr','Sa','So'];
    const html=names.map((name,i)=>{
      const working=employees.filter(e=>e.shifts[i]).length;
      const state=working===0?'empty':working===1?'thin':'ok';
      const label=working===0?'Niemand geplant':working===1?'Nur 1 Person':working+' Personen';
      return '<div class="'+state+'"><small>'+name+'</small><strong>'+label+'</strong></div>';
    }).join('');
    document.getElementById('dayCheck').innerHTML='<span>Besetzung</span>'+html;
  }

  function changeWeek(offset){
    weekStart.setDate(weekStart.getDate()+offset*7);
    weekKey=store.mondayKey(weekStart);
    shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
    employees.forEach(e=>e.shifts=shifts[e.id]);
    render();
  }

  function resetDialog(){
    document.getElementById('shiftDialogEyebrow').textContent='Neue Schicht';
    document.getElementById('shiftDialogTitle').textContent='Schicht eintragen';
    document.getElementById('shiftDay').value='0';
    document.getElementById('shiftStart').value='09:00';
    document.getElementById('shiftEnd').value='17:00';
    document.getElementById('shiftBreak').value='30';
    delBtn.hidden=true;
  }

  function openDialog(eid=null,day=null){
    const sel=document.getElementById('shiftEmployee');
    sel.innerHTML=employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    editing=null;
    resetDialog();

    if(eid!==null && day!==null){
      sel.value=eid;
      document.getElementById('shiftDay').value=String(day);
      const emp=employees.find(x=>x.id===eid);
      const shift=emp?.shifts[day];

      if(shift){
        editing={eid,day};
        document.getElementById('shiftStart').value=shift[0];
        document.getElementById('shiftEnd').value=shift[1];
        document.getElementById('shiftBreak').value=shift[2];
        document.getElementById('shiftDialogEyebrow').textContent='Schicht bearbeiten';
        document.getElementById('shiftDialogTitle').textContent=emp.name+' · Schicht';
        delBtn.hidden=false;
      }
    }
    dlg.showModal();
  }

  function bindCells(){
    document.querySelectorAll('.empty-shift,.shift-chip').forEach(b=>{
      b.onclick=()=>openDialog(b.dataset.e,Number(b.dataset.d));
    });
  }

  document.getElementById('addShift').onclick=()=>openDialog();
  document.getElementById('printPlan').onclick=()=>window.print();

  publishBtn.onclick=()=>{
    published=!published;
    store.savePlanStatus(published?'published':'draft',weekKey);
    renderPlanState();
  };

  document.getElementById('prevWeek').onclick=()=>changeWeek(-1);
  document.getElementById('nextWeek').onclick=()=>changeWeek(1);
  document.getElementById('todayWeek').onclick=()=>{
    weekStart=new Date();
    const d=weekStart.getDay()||7;
    weekStart.setDate(weekStart.getDate()-d+1);
    weekStart.setHours(12,0,0,0);
    weekKey=store.mondayKey(weekStart);
    shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
    employees.forEach(e=>e.shifts=shifts[e.id]);
    render();
  };

  delBtn.onclick=()=>{
    if(!editing) return;
    const emp=employees.find(x=>x.id===editing.eid);
    if(emp) emp.shifts[editing.day]=null;
    persist();
    markDraft();
    dlg.close();
    render();
  };

  document.getElementById('shiftForm').addEventListener('submit',e=>{
    e.preventDefault();

    const emp=employees.find(x=>x.id===document.getElementById('shiftEmployee').value);
    const day=Number(document.getElementById('shiftDay').value);
    const start=document.getElementById('shiftStart').value;
    const end=document.getElementById('shiftEnd').value;
    const br=Number(document.getElementById('shiftBreak').value||0);

    if(!emp||!start||!end||mins(end)<=mins(start)) return;

    if(editing && (editing.eid!==emp.id || editing.day!==day)){
      const oldEmp=employees.find(x=>x.id===editing.eid);
      if(oldEmp) oldEmp.shifts[editing.day]=null;
    }

    emp.shifts[day]=[start,end,br];
    persist();
    markDraft();
    dlg.close();
    render();
  });

  persist();
  render();
});