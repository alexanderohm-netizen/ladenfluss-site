document.addEventListener('DOMContentLoaded',()=> {
  const store=window.LadenflussTeamStore;
  const escape=store.escapeHtml;
  const team=store.getTeam();
  let weekStart=new Date();
  const day=weekStart.getDay()||7;
  weekStart.setDate(weekStart.getDate()-day+1);
  weekStart.setHours(12,0,0,0);
  let weekKey=store.mondayKey(weekStart);
  let shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
  let absences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(weekKey));

  let approvedVacations = [];
  let vacationError = false;
  function reloadVacations() {
    try {
      const saved = window.LadenflussVacation?.read();
      vacationError = false;
      approvedVacations = Array.isArray(saved?.entries)
        ? saved.entries.filter(entry => entry.status === 'approved') : [];
    } catch {
      approvedVacations = [];
      vacationError = true;
    }
  }
  function absenceAt(employee, index) {
    if (employee.absences[index]) return employee.absences[index];
    if (!window.LadenflussVacation?.iso) return null;
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const key = window.LadenflussVacation.iso(date);
    return approvedVacations.some(entry => entry.employeeId === employee.id &&
      entry.start <= key && entry.end >= key) ? 'Urlaub' : null;
  }

  const employees=team.map(p=>({
    id:p.id,
    name:p.name,
    role:p.role,
    target:Number(p.hours||0),
    shifts:shifts[p.id],
    absences:absences[p.id]
  }));

  const body=document.getElementById('pepBody');
  const dlg=document.getElementById('shiftDialog');
  const absenceDlg=document.getElementById('absenceDialog');
  const delBtn=document.getElementById('deleteShift');
  const publishBtn=document.getElementById('publishPlan');
  const planStatus=document.getElementById('planStatus');
  let editing=null;
  let editingAbsence=null;
  const deleteAbsence=document.getElementById('deleteAbsence');
  let published=store.getPlanStatus(weekKey)==='published';

  const mins=window.LadenflussPlanning.minutes;
  const hours=window.LadenflussPlanning.shiftHours;
  let shop;
  try { shop=window.LadenflussStoreSettings.read(); }
  catch (error) {
    document.getElementById('pepFocus').innerHTML='<strong>Profil prüfen</strong><p>'+escape(error.message)+'</p><a href="/mein-laden#profile">Unternehmensprofil öffnen</a>';
    document.querySelectorAll('.pep-actions button').forEach(button=>button.disabled=true);
    return;
  }
  function analysis() {
    return window.LadenflussPlanning.analyze({week:weekKey,team,
      shifts:Object.fromEntries(employees.map(e=>[e.id,e.shifts])),
      absences:Object.fromEntries(employees.map(e=>[e.id,e.absences])),
      vacations:approvedVacations,shop,holiday:window.LadenflussHolidays.getHoliday});
  }

  function persist(){
    const next={};
    employees.forEach(e=>next[e.id]=e.shifts);
    store.saveShifts(next,weekKey);
  }

  function getIssues(){
    const signals=analysis().signals;
    if(vacationError) signals.unshift({priority:'critical',message:'Urlaubsdaten konnten nicht gelesen werden.',impact:'Besetzungsprüfung unvollständig. Bitte Urlaubsplan prüfen.'});
    return signals.map(s=>({...s,text:s.message,detail:s.impact}));
  }

  function persistAbsences(){
    const next={};employees.forEach(e=>next[e.id]=e.absences);store.saveAbsences(next,weekKey);
  }

  function markDraft(){
    published=false;
    planStatus.classList.remove('published');
    planStatus.innerHTML='<i></i> Entwurf';
    publishBtn.textContent='Plan veröffentlichen';
    store.savePlanStatus('draft',weekKey);
  }

  function render(){
    reloadVacations();
    renderWeekHeader();
    renderDayCheck();
    renderPlanState();
    body.innerHTML=employees.map(e=>{
      const total=e.shifts.reduce((a,s)=>a+hours(s),0);
      const cells=e.shifts.map((s,i)=>{const a=absenceAt(e,i);return s
        ? `<td class="${a?'has-conflict':''}"><button class="shift-chip" data-e="${escape(e.id)}" data-d="${i}" title="Schicht bearbeiten"><strong>${escape(s[0])}–${escape(s[1])}</strong><span>${hours(s).toLocaleString('de-DE',{maximumFractionDigits:1})} h · ${escape(s[2])} Min Pause</span></button></td>`
        : a ? `<td><button class="absence-chip" data-ae="${escape(e.id)}" data-ad="${i}"><strong>${escape(a)}</strong><span>Abwesend</span></button></td>` : `<td><button class="empty-shift" data-e="${escape(e.id)}" data-d="${i}" aria-label="Schicht hinzufügen">+</button></td>`}).join('');
      const state=total>e.target+5?'high':total<Math.max(0,e.target-8)?'low':'ok';
      return `<tr><th><strong>${escape(e.name)}</strong><span>${escape(e.role)} · Ziel ${e.target} h</span></th>${cells}<td class="week-total ${state}"><strong>${total.toLocaleString('de-DE',{maximumFractionDigits:1})} h</strong><span>${state==='ok'?'passt':state==='high'?'zu hoch':'zu niedrig'}</span></td></tr>`;
    }).join('');

    const total=employees.reduce((a,e)=>a+e.shifts.reduce((x,s)=>x+hours(s),0),0);
    const issues=getIssues();

    document.getElementById('plannedHours').textContent=total.toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
    document.getElementById('employeeCount').textContent=employees.length;
    document.getElementById('issueCount').textContent=issues.length;
    document.getElementById('issueText').textContent=issues.length?issues.length===1?'1 Hinweis prüfen':issues.length+' Hinweise prüfen':'Alles ruhig';

    const focus=document.getElementById('pepFocus');
    focus.querySelector('strong').textContent=issues.length?issues[0].text:'Der Plan sieht gut aus.';
    focus.querySelector('p').textContent=issues[0]?.detail ? issues[0].detail : issues.length>1
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
    const state=shop.state||'HE';
    document.getElementById('weekTitle').textContent=fmt(dates[0])+'–'+fmt(dates[6]);
    document.getElementById('pepDays').innerHTML='<th>Mitarbeiter</th>'+dates.map((d,i)=>{const holiday=window.LadenflussHolidays?.getHoliday(d,state);return '<th class="'+(holiday?'holiday':'')+'">'+days[i]+' '+String(d.getDate()).padStart(2,'0')+'.'+(holiday?'<small>'+holiday+'</small>':'')+'</th>'}).join('')+'<th>Summe</th>';
  }

  function renderDayCheck(){
    const result=analysis();
    document.getElementById('dayCheck').innerHTML='<span>Besetzung</span>'+result.days.map(day=>{
      const name=day.name.slice(0,2);
      const state=day.closed?'holiday-check':day.gaps.length?'thin':day.pauseMinutes?'thin':'ok';
      const label=day.closed?(day.holiday||'Geschlossen'):day.gaps.length
        ? (day.missingMinutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' h Besetzung fehlen'
        : day.pauseMinutes?'Pausenlage prüfen':'Durchgehend besetzt';
      return '<div class="'+state+'"><small>'+name+'</small><strong>'+escape(label)+'</strong></div>';
    }).join('');
  }

  function changeWeek(offset){
    weekStart.setDate(weekStart.getDate()+offset*7);
    weekKey=store.mondayKey(weekStart);
    shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
    absences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(weekKey));
    employees.forEach(e=>{e.shifts=shifts[e.id];e.absences=absences[e.id]});
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
    sel.innerHTML=employees.map(e=>`<option value="${escape(e.id)}">${escape(e.name)}</option>`).join('');
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

  function openAbsence(eid=null,day=0){
    const sel=document.getElementById('absenceEmployee');sel.innerHTML=employees.map(e=>`<option value="${escape(e.id)}">${escape(e.name)}</option>`).join('');editingAbsence=null;deleteAbsence.hidden=true;
    if(eid){sel.value=eid;document.getElementById('absenceDay').value=String(day);const emp=employees.find(x=>x.id===eid);if(emp?.absences[day]){document.getElementById('absenceType').value=emp.absences[day];editingAbsence={eid,day};deleteAbsence.hidden=false;}}
    absenceDlg.showModal();
  }

  function bindCells(){
    document.querySelectorAll('.empty-shift,.shift-chip').forEach(b=>{b.onclick=()=>openDialog(b.dataset.e,Number(b.dataset.d));});
    document.querySelectorAll('.absence-chip').forEach(b=>{
      b.onclick=()=>{
        const emp=employees.find(e=>e.id===b.dataset.ae);
        const day=Number(b.dataset.ad);
        if(emp && !emp.absences[day] && absenceAt(emp,day)==='Urlaub'){
          window.location.href='/tools/urlaubsplaner';
          return;
        }
        openAbsence(b.dataset.ae,day);
      };
    });
  }

  document.getElementById('addShift').onclick=()=>openDialog();
  document.getElementById('addAbsence').onclick=()=>openAbsence();
  document.getElementById('printPlan').onclick=()=>window.print();

  publishBtn.onclick=()=>{
    reloadVacations();
    if(!published){
      const critical=getIssues().filter(issue=>issue.priority==='critical');
      if(critical.length){
        window.alert('Der Plan enthält '+critical.length+' dringende Hinweis(e), zum Beispiel Unterbesetzung oder eine Schicht trotz Abwesenheit. Bitte zuerst prüfen.');
        document.getElementById('pepFocus').scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
    }
    published=!published;
    store.savePlanStatus(published?'published':'draft',weekKey);
    renderPlanState();
  };

  document.getElementById('copyWeek').onclick=()=>{
    const previous=new Date(weekStart);previous.setDate(previous.getDate()-7);
    const previousKey=store.mondayKey(previous),source=store.ensureEmployeeShiftRows(team,store.getShifts(previousKey));
    const hasAny=employees.some(e=>e.shifts.some(Boolean));
    if(hasAny&&!window.confirm('In dieser Woche sind bereits Schichten geplant. Mit der Vorwoche ersetzen?'))return;
    employees.forEach(e=>e.shifts=JSON.parse(JSON.stringify(source[e.id]||[null,null,null,null,null,null,null])));
    persist();markDraft();render();
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
    absences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(weekKey));
    employees.forEach(e=>{e.shifts=shifts[e.id];e.absences=absences[e.id]});
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

  deleteAbsence.onclick=()=>{if(!editingAbsence)return;const emp=employees.find(x=>x.id===editingAbsence.eid);if(emp)emp.absences[editingAbsence.day]=null;persistAbsences();markDraft();absenceDlg.close();render();};

  document.getElementById('absenceForm').addEventListener('submit',e=>{
    e.preventDefault();const emp=employees.find(x=>x.id===document.getElementById('absenceEmployee').value);const day=Number(document.getElementById('absenceDay').value);if(!emp)return;emp.absences[day]=document.getElementById('absenceType').value;persistAbsences();markDraft();absenceDlg.close();render();
  });

  document.getElementById('shiftForm').addEventListener('submit',e=>{
    e.preventDefault();

    const emp=employees.find(x=>x.id===document.getElementById('shiftEmployee').value);
    const day=Number(document.getElementById('shiftDay').value);
    const start=document.getElementById('shiftStart').value;
    const end=document.getElementById('shiftEnd').value;
    const br=Number(document.getElementById('shiftBreak').value||0);

    if(!emp||!Number.isInteger(day)||day<0||day>6||mins(start)===null||mins(end)===null||mins(end)<=mins(start)){
      window.alert('Bitte gültige Start- und Endzeiten eingeben.');return;
    }
    const duration=mins(end)-mins(start);
    if(!Number.isFinite(br)||br<0||br>=duration){
      window.alert('Die Pause muss kürzer als die Schicht sein und darf nicht negativ sein.');return;
    }
    const minimumBreak=duration>540?45:duration>360?30:0;
    if(br<minimumBreak){
      window.alert('Für diese Schicht sind nach § 4 ArbZG mindestens '+minimumBreak+' Minuten Ruhepause einzuplanen.');return;
    }

    const destinationChanged=!editing||editing.eid!==emp.id||editing.day!==day;
    if(destinationChanged&&emp.shifts[day]&&!window.confirm('Für diese Person ist bereits eine Schicht eingetragen. Diese ersetzen?'))return;

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

  document.querySelectorAll('dialog button[value=cancel]').forEach(button=>{
    button.type='button';button.onclick=()=>button.closest('dialog').close();
  });
  const requested=new URLSearchParams(window.location.search).get('week');
  if(requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)){
    const date=new Date(requested+'T12:00:00');
    if(Number.isFinite(date.getTime())&&store.mondayKey(date)===requested){
      weekStart=date;weekKey=requested;
      shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
      absences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(weekKey));
      employees.forEach(e=>{e.shifts=shifts[e.id];e.absences=absences[e.id]});
    }
  }
  render();
});
