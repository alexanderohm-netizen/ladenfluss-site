document.addEventListener('DOMContentLoaded',()=> {
  const store=window.LadenflussTeamStore;
  const escape=store.escapeHtml;
  let team=store.getTeam();
  let weekStart=new Date();
  const day=weekStart.getDay()||7;
  weekStart.setDate(weekStart.getDate()-day+1);
  weekStart.setHours(12,0,0,0);
  let weekKey=store.mondayKey(weekStart);
  let shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
  let absences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(weekKey));
  const typed=window.LadenflussPepInput;
  const periodSelect=document.getElementById('pepPeriod');
  const searchInput=document.getElementById('pepSearch');
  const gridMessage=document.getElementById('pepGridMessage');
  const copyAction=document.getElementById('pepCopyMode');
  const copyStep=document.getElementById('pepCopyModeStep');
  const copyHint=document.getElementById('pepCopyModeHint');
  const copyLabel=document.getElementById('pepClipboardLabel');
  const gridRegion=document.querySelector('.pep-table-wrap');
  let copyMode=false;
  let copiedShift=null;
  let secondWeekKey='',secondShifts={},secondAbsences={};
  function refreshSecond(){
    const following=new Date(weekStart);following.setDate(following.getDate()+7);
    secondWeekKey=store.mondayKey(following);
    secondShifts=store.ensureEmployeeShiftRows(team,store.getShifts(secondWeekKey));
    secondAbsences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(secondWeekKey));
  }
  function dayCount(){return periodSelect.value==='14'?14:7;}
  function rowShift(employee,index){
    return index<7?employee.shifts[index]:secondShifts[employee.id]?.[index-7]??null;
  }
  function rowManualAbsence(employee,index){
    return index<7?employee.absences[index]:secondAbsences[employee.id]?.[index-7]??null;
  }
  function weekFor(index){return index<7?weekKey:secondWeekKey;}
  function gridNotice(text='',problem=false){
    gridMessage.textContent=text;
    gridMessage.classList.toggle('error',Boolean(text&&problem));
  }
  function updateClipboardBar(){
    copyAction.setAttribute('aria-pressed',String(copyMode));
    copyAction.classList.toggle('is-active',copyMode);
    gridRegion.classList.toggle('pep-crosshair-mode',copyMode);
    gridRegion.dataset.mode=copyMode?(copiedShift?'paste':'pick'):'normal';
    copyLabel.hidden=!copyMode||!copiedShift;
    copyLabel.textContent=copiedShift
      ? 'Kopiert: '+typed.format(copiedShift).replace('-', '–').replace('/',' · ')+' Min Pause':'';
    copyStep.textContent=!copyMode?'Direktbearbeitung aktiv':copiedShift?'Schritt 2 · Zielfeld wählen':'Schritt 1 · Quellschicht wählen';
    copyHint.textContent=!copyMode
      ? 'Aktion einschalten → Quellschicht anklicken → freies Feld anklicken. Erneut klicken zum Beenden.'
      :copiedShift
        ? 'Jetzt mit dem Fadenkreuz freie Tagesfelder anklicken. Mehrfaches Einfügen möglich. Aktion zum Beenden erneut anklicken.'
        :'Fadenkreuz aktiv: Klicke auf eine vorhandene Schicht, die du kopieren möchtest.';
  }
  copyAction.addEventListener('click',()=>{
    copyMode=!copyMode;
    copiedShift=null;
    gridNotice(copyMode?'Kopiermodus aktiv: Bitte eine Schicht auswählen.':'Kopiermodus beendet.');
    render();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&copyMode&&!event.target.closest('.pep-inline-editor')){
      copyMode=false;copiedShift=null;gridNotice('Kopiermodus beendet.');render();
    }
  });


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
    const manual=rowManualAbsence(employee,index);
    if (manual) return manual;
    if (!window.LadenflussVacation?.iso) return null;
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const key = window.LadenflussVacation.iso(date);
    return approvedVacations.some(entry => entry.employeeId === employee.id &&
      entry.start <= key && entry.end >= key) ? 'Urlaub' : null;
  }

  let employees=team.map(p=>({
    id:p.id,
    name:p.name,
    role:p.role,
    target:Number(p.hours||0),
    shifts:shifts[p.id],
    absences:absences[p.id]
  }));

  const body=document.getElementById('pepBody');
  const employeeFilter=document.getElementById('pepEmployeeFilter');
  if (employeeFilter) {
    for (const person of team) {
      const option=document.createElement('option');
      option.value=person.id;
      option.textContent=person.name;
      employeeFilter.append(option);
    }
    employeeFilter.addEventListener('change',applyEmployeeFilter);
  }
  function applyEmployeeFilter(){
    if (!employeeFilter) return;
    const selected=employeeFilter.value;
    const query=(searchInput?.value||'').trim().toLocaleLowerCase('de');
    body.querySelectorAll('tr[data-employee-id]').forEach(row=>{
      const person=team.find(e=>e.id===row.dataset.employeeId);
      const matches=!query||[person?.name,person?.role,person?.branch].some(value=>
        String(value||'').toLocaleLowerCase('de').includes(query));
      row.hidden=(selected!=='all'&&row.dataset.employeeId!==selected)||!matches;
    });
  }
  searchInput?.addEventListener('input',applyEmployeeFilter);
  periodSelect?.addEventListener('change',()=>{gridNotice();render()});
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
    if(dayCount()===14)refreshSecond();
    updateClipboardBar();
    renderWeekHeader();
    renderDayCheck();
    renderPlanState();
    body.innerHTML=employees.map(e=>{
      const count=dayCount();
      const total=Array.from({length:count},(_,i)=>hours(rowShift(e,i))).reduce((a,b)=>a+b,0);
      const target=e.target*(count/7);
      const difference=total-target;
      const fmt=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1});
      const cells=Array.from({length:count},(_,i)=>{
        const shift=rowShift(e,i),absence=absenceAt(e,i);
        const vacation=absence==='Urlaub'&&!rowManualAbsence(e,i);
        const title=escape(e.name+', '+String(i+1)+'. Tag: ');
        if(shift){
          const startMinutes=mins(shift[0]),endMinutes=mins(shift[1]);
          const left=startMinutes===null?0:Math.max(0,Math.min(100,((startMinutes-360)/960)*100));
          const right=endMinutes===null?left:Math.max(left,Math.min(100,((endMinutes-360)/960)*100));
          const phase=startMinutes<720?'early':'late';
          const phaseLabel=phase==='early'?'Früh':'Spät';
          const timeline='<span class="pep-diagram-track" aria-hidden="true"><i class="pep-diagram-bar" style="left:'+left.toFixed(2)+'%;width:'+Math.max(0,right-left).toFixed(2)+'%"></i></span>';
          return `<td class="pep-grid-slot ${absence?'has-conflict':''}"><button type="button" class="shift-chip pep-grid-trigger pep-shift-${phase}" data-grid-e="${escape(e.id)}" data-grid-d="${i}" aria-label="${title}${phaseLabel}schicht ${escape(shift[0])} bis ${escape(shift[1])}, ${fmt(hours(shift))} Stunden; klicken zum Bearbeiten"><span class="pep-shift-heading"><strong>${escape(shift[0])}–${escape(shift[1])}</strong><em class="pep-shift-phase">${phaseLabel}</em></span>${timeline}<span class="pep-diagram-scale" aria-hidden="true"><i>06</i><i>10</i><i>14</i><i>18</i><i>22</i></span><span class="pep-shift-meta">${fmt(hours(shift))} h · ${escape(String(shift[2]))} Min Pause</span></button></td>`;
        }
        if(absence){
          const before=i>0&&absenceAt(e,i-1)===absence;
          const after=i<count-1&&absenceAt(e,i+1)===absence;
          const group=absence==='Urlaub'?(' pep-vacation '+(before?'run-mid':'run-first')+(after?' run-cont':' run-last')):'';
          return `<td class="pep-grid-slot pep-absence-slot"><button type="button" class="absence-chip${group}${vacation?' pep-approved-vacation':' pep-grid-trigger'}" ${vacation?`data-ae="${escape(e.id)}" data-ad="${i}"`:`data-grid-e="${escape(e.id)}" data-grid-d="${i}"`} aria-label="${title}${escape(absence)}${vacation?', im Urlaubsplaner ändern':', direkt bearbeiten'}"><strong>${escape(absence)}</strong><span>${vacation?'Genehmigt':'Abwesend'}</span></button></td>`;
        }
        return `<td class="pep-grid-slot"><button type="button" class="empty-shift pep-grid-trigger" data-grid-e="${escape(e.id)}" data-grid-d="${i}" aria-label="${title}Schicht eingeben"><span aria-hidden="true">+</span><small>Eintragen</small></button></td>`;
      }).join('');
      const deltaClass=difference>5?'high':difference< -8?'low':'ok';
      const signed=(difference>0?'+':'')+fmt(difference)+' h';
      return `<tr data-employee-id="${escape(e.id)}"><th scope="row" class="pep-employee"><strong>${escape(e.name)}</strong><span>${escape(e.role)}</span></th><td class="pep-compare pep-target">${fmt(target)} h</td><td class="pep-compare pep-planned">${fmt(total)} h</td><td class="pep-compare pep-delta ${deltaClass}">${signed}</td>${cells}</tr>`;
    }).join('');
    const totals=document.getElementById('pepTotals');
    if(totals){
      const count=dayCount();
      const sums=Array.from({length:count},(_,i)=>employees.reduce((sum,e)=>
        sum+(absenceAt(e,i)?0:hours(rowShift(e,i))),0));
      const fmt=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1});
      totals.innerHTML=`<tr class="pep-totals-row"><th scope="row">Besetzte Stunden</th><td class="pep-compare">–</td><td class="pep-compare">${fmt(sums.reduce((a,b)=>a+b,0))} h</td><td class="pep-compare">–</td>${sums.map((v,i)=>`<td aria-label="Tag ${i+1}: ${fmt(v)} Stunden besetzt">${fmt(v)} h</td>`).join('')}</tr>`;
    }

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

    renderNeed();
    bindCells();
    applyEmployeeFilter();
  }

  function renderNeed(){
    const box=document.getElementById('planningReference');
    box.replaceChildren();box.hidden=true;
    let history;
    try{history=JSON.parse(localStorage.getItem('ladenfluss.history.v1')||'[]');}catch{return;}
    if(!Array.isArray(history))return;
    const selected=new URLSearchParams(location.search).get('day');
    const records=history.filter(e=>e?.tool==='Personalbedarf'&&Number.isFinite(e.data?.total)&&e.data.total>=0&&/^\d{4}-\d{2}-\d{2}$/.test(e.data.date)&&Number.isFinite(Date.parse(e.at)))
      .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    const used=new Set();
    for(const e of records){
      const date=new Date(e.data.date+'T12:00:00');
      if(!Number.isFinite(date.getTime())||window.LadenflussPlanning.iso(date)!==e.data.date||store.mondayKey(date)!==weekKey||used.has(e.data.date))continue;
      if(selected&&store.mondayKey(new Date(selected+'T12:00:00'))===weekKey&&selected!==e.data.date)continue;
      used.add(e.data.date);
      const index=(date.getDay()||7)-1;
      const available=employees.reduce((sum,person)=>sum+(absenceAt(person,index)?0:hours(person.shifts[index])),0);
      const diff=e.data.total-available;
      const title=document.createElement('strong');
      title.textContent=date.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'})+' · Dein berechneter Personalbedarf';
      const detail=document.createElement('p');
      const num=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1});
      detail.textContent=num(e.data.total)+' h Richtwert · '+num(available)+' h verfügbar geplant · '+num(Math.abs(diff))+' h '+(diff>0?'unter':'über')+' dem Richtwert.';
      const source=document.createElement('p');
      source.textContent='Quelle: deine Personalbedarfsrechnung vom '+new Date(e.at).toLocaleDateString('de-DE')+'. Nettoschichtstunden ohne Abwesenheiten; zeitliche Besetzung und Pausen separat prüfen.';
      if(Date.now()-Date.parse(e.at)>7*86400000)source.textContent+=' Älter als sieben Tage – Eingaben vor Verwendung aktualisieren.';
      box.append(title,detail,source);box.hidden=false;
    }
    if(!box.hidden){const a=document.createElement('a');a.href='/tools/personalbedarf';a.textContent='Bedarf neu berechnen →';box.append(a);}
  }

  function renderPlanState(){
    published=store.getPlanStatus(weekKey)==='published';
    planStatus.classList.toggle('published',published);
    planStatus.innerHTML=published?'<i></i> Veröffentlicht':'<i></i> Entwurf';
    publishBtn.textContent=published?'Zurück auf Entwurf':'Plan veröffentlichen';
  }

  function renderWeekHeader(){
    const days=['Mo','Di','Mi','Do','Fr','Sa','So'];
    const dates=Array.from({length:dayCount()},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d});
    const fmt=d=>d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const state=shop.state||'HE';
    document.getElementById('weekTitle').textContent=fmt(dates[0])+'–'+fmt(dates[dates.length-1])+(dayCount()===14?' · zwei Wochen':' · eine Woche');
    document.getElementById('pepDays').innerHTML='<th scope="col" class="pep-sticky-employee">Mitarbeitende</th><th scope="col" class="pep-sticky-metric">Soll</th><th scope="col" class="pep-sticky-metric">Geplant</th><th scope="col" class="pep-sticky-metric">+ / −</th>'+
      dates.map((d,i)=>{
        const holiday=window.LadenflussHolidays?.getHoliday(d,state);
        const today=window.LadenflussPlanning.iso(d)===window.LadenflussPlanning.iso(new Date());
        return '<th scope="col" class="'+(holiday?'holiday ':'')+(today?'pep-today ':'')+(i===7?'pep-second-week':'')+'"><span class="pep-week-label">'+(i===0||i===7?'Woche '+(i===0?'1':'2'):'&nbsp;')+'</span><span class="pep-day-label">'+days[i%7]+' '+fmt(d)+'</span>'+(holiday?'<small>'+escape(holiday)+'</small>':'')+'</th>';
      }).join('');
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

  function saveGridEntry(eid,day,text){
    const employee=employees.find(person=>person.id===eid);
    if(!employee||!Number.isInteger(day)||day<0||day>=dayCount())
      throw new Error('Das ausgewählte Mitarbeiterfeld ist nicht mehr verfügbar.');
    const op=typed.parse(text);
    if(op.type==='noop')return false;
    const week=weekFor(day),slot=day%7;
    const existingShift=rowShift(employee,day);
    const manual=rowManualAbsence(employee,day);
    const vacation=absenceAt(employee,day)==='Urlaub'&&!manual;
    if(vacation&&!(op.type==='clear'&&existingShift))
      throw new Error('Genehmigter Urlaub wird im Urlaubsplaner bearbeitet. Keine Schicht darüber speichern.');
    if(op.type==='shift'&&manual)
      throw new Error('Hier ist eine Abwesenheit eingetragen. Bitte zuerst mit - entfernen.');
    if(op.type==='absence'&&existingShift)
      throw new Error('Hier steht eine Schicht. Bitte zuerst mit - entfernen.');
    const sourceShifts=store.ensureEmployeeShiftRows(team,store.getShifts(week));
    const sourceAbsences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(week));
    let change='';
    if(op.type==='shift'){
      sourceShifts[eid][slot]=op.shift;
      store.saveShifts(sourceShifts,week);
      change='Schicht gespeichert';
    }else if(op.type==='absence'){
      sourceAbsences[eid][slot]=op.reason;
      store.saveAbsences(sourceAbsences,week);
      change='Abwesenheit gespeichert';
    }else if(op.type==='clear'){
      if(existingShift){
        sourceShifts[eid][slot]=null;
        store.saveShifts(sourceShifts,week);
        change='Schicht entfernt';
      }else if(manual){
        sourceAbsences[eid][slot]=null;
        store.saveAbsences(sourceAbsences,week);
        change='Abwesenheit entfernt';
      }else return false;
    }
    if(day<7){employee.shifts=sourceShifts[eid];employee.absences=sourceAbsences[eid];}
    else{secondShifts=sourceShifts;secondAbsences=sourceAbsences;}
    store.savePlanStatus('draft',week);
    if(day<7)published=false;
    render();
    const weekday=['Mo','Di','Mi','Do','Fr','Sa','So'][day%7];
    gridNotice(change+' · '+weekday+' · '+employee.name+(day>=7?' · Woche 2':'')+'.');
    return true;
  }
  function copyGridShift(eid,day){
    const employee=employees.find(p=>p.id===eid);
    const shift=employee&&rowShift(employee,day);
    if(!shift){
      gridNotice('Zuerst eine vorhandene Schicht anklicken, nicht ein leeres Feld.',true);
      return;
    }
    try{
      copiedShift=typed.parse(typed.format(shift)).shift;
      render();
      gridNotice('Schicht übernommen: '+typed.format(copiedShift)+'. Jetzt ein freies Tagesfeld anklicken.');
    }catch(error){gridNotice('Schicht konnte nicht kopiert werden: '+error.message,true);}
  }
  function pasteGridShift(eid,day){
    const employee=employees.find(p=>p.id===eid);
    if(!copyMode||!copiedShift||!employee||!Number.isInteger(day)||day<0||day>=dayCount())return;
    if(rowShift(employee,day)){
      gridNotice('Dieses Tagesfeld ist bereits belegt. Zum Bearbeiten Kopiermodus ausschalten.',true);
      return;
    }
    if(absenceAt(employee,day)){
      gridNotice('Hier ist bereits eine Abwesenheit eingetragen. Einfügen ist nur in freie Felder möglich.',true);
      return;
    }
    try{
      saveGridEntry(eid,day,typed.format(copiedShift));
      gridNotice('Schicht eingefügt · '+employee.name+' · Tag '+(day+1)+'. Für weitere freie Felder bleibt das Fadenkreuz aktiv.');
    }catch(error){gridNotice(error.message,true);}
  }
  function activateCell(button,firstKey=null){
    const eid=button.dataset.gridE,day=Number(button.dataset.gridD);
    const employee=employees.find(p=>p.id===eid);
    if(!employee||!Number.isInteger(day)||day<0||day>=dayCount())return;
    const td=button.closest('td');
    if(!td||td.querySelector('.pep-inline-input'))return;
    const current=rowShift(employee,day);
    const absence=rowManualAbsence(employee,day);
    const input=document.createElement('input');
    input.className='pep-inline-input';
    input.type='text';
    input.inputMode='text';
    input.autocomplete='off';
    input.spellcheck=false;
    input.maxLength=32;
    input.placeholder='9-17/30, Frei, Urlaub';
    input.setAttribute('aria-label','Dienstplan direkt bearbeiten: '+employee.name+', Tag '+(day+1));
    const status=document.createElement('small');
    status.className='pep-inline-status';
    status.textContent='Enter: speichern · Esc: abbrechen';
    const previous=current?typed.format(current):absence||'';
    input.value=firstKey===null?previous:firstKey;
    const editor=document.createElement('div');editor.className='pep-inline-editor';
    editor.append(input,status);
    td.replaceChildren(editor);
    let finished=false,saving=false;
    const cancel=()=>{if(finished)return;finished=true;render();};
    const commit=()=>{
      if(finished||saving)return;
      saving=true;
      try{
        const didSave=saveGridEntry(eid,day,input.value);
        finished=true;
        if(!didSave){render();gridNotice('Keine Änderung vorgenommen.');}
      }catch(error){
        status.textContent=error.message;
        status.classList.add('error');
        gridNotice(error.message,true);
        input.setAttribute('aria-invalid','true');
        input.focus();
      }finally{saving=false;}
    };
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();commit();}
      else if(event.key==='Escape'){event.preventDefault();cancel();}
    });
    input.addEventListener('blur',()=>{if(!finished)commit();});
    input.focus();
    if(firstKey===null)input.select();
  }
  function bindCells(){
    body.querySelectorAll('.pep-grid-trigger').forEach(button=>{
      const select=()=>{
        if(copyMode){
          const eid=button.dataset.gridE,day=Number(button.dataset.gridD);
          if(!copiedShift)copyGridShift(eid,day);
          else pasteGridShift(eid,day);
          return;
        }
        activateCell(button);
      };
      button.addEventListener('click',select);
      button.addEventListener('keydown',event=>{
        if(copyMode)return;
        if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
          event.preventDefault();activateCell(button,event.key);
        }
      });
    });
    body.querySelectorAll('.pep-approved-vacation').forEach(button=>{
      button.addEventListener('click',()=>{
        if(copyMode){
          gridNotice('Genehmigten Urlaub bitte nicht als Ziel wählen. Nutze ein freies Feld.',true);
          return;
        }
        window.location.href='/tools/urlaubsplaner';
      });
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
  // A Personalfluss change in another tab updates names, roles, hours and roster rows.
  // Keep shifts in the week store, never duplicate or overwrite personnel records.
  function refreshSharedTeam(){
    try{
      const next=store.getTeam();
      if(!Array.isArray(next))throw Error('Ungültige Teamdaten');
      const selected=employeeFilter?.value||'all';
      team=next;
      shifts=store.ensureEmployeeShiftRows(team,store.getShifts(weekKey));
      absences=store.ensureEmployeeAbsenceRows(team,store.getAbsences(weekKey));
      employees=team.map(p=>({
        id:p.id,name:p.name,role:p.role,target:Number(p.hours||0),
        shifts:shifts[p.id],absences:absences[p.id]
      }));
      refreshSecond();
      if(employeeFilter){
        employeeFilter.replaceChildren();
        const all=document.createElement('option');all.value='all';all.textContent='Alle Mitarbeitenden';employeeFilter.append(all);
        for(const person of team){
          const option=document.createElement('option');option.value=person.id;option.textContent=person.name;employeeFilter.append(option);
        }
        employeeFilter.value=team.some(p=>p.id===selected)?selected:'all';
      }
      gridNotice('Personalfluss aktualisiert: Mitarbeiter, Positionen und Sollstunden sind abgeglichen.');
      render();
    }catch(e){gridNotice('Personalfluss konnte nicht aktualisiert werden: '+e.message,true);}
  }
  window.addEventListener('storage',event=>{
    if(event.key==='ladenfluss.team.v1')refreshSharedTeam();
    if(event.key===window.LadenflussVacation?.KEY)render();
  });
  render();
});
