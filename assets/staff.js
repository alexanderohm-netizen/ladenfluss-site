document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const store=window.LadenflussTeamStore;
  const wages=window.LadenflussHourlyRates;
  const legacy=window.LadenflussPayVault;
  const $=id=>document.getElementById(id);
  const list=$('staffList'), dialog=$('employeeDialog'), form=$('employeeForm');
  const days=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  let people=[],selectedId=null,editingId=null,loadError=false,wageError=false;
  let hourlyRates=Object.create(null);

  function node(tag,className,text){
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(text!==undefined)e.textContent=String(text);
    return e;
  }
  function append(parent,...children){for(const c of children)parent.append(c);return parent;}
  function warn(text){$('staffError').textContent=text;$('staffError').hidden=false;$('staffStatus').textContent='';}
  function clearWarn(){$('staffError').textContent='';$('staffError').hidden=true;}
  function announce(text){$('staffStatus').textContent=text;}
  function number(n){return Number(n||0).toLocaleString('de-DE',{maximumFractionDigits:1});}
  function money(value){return Number(value).toLocaleString('de-DE',{style:'currency',currency:'EUR'});}
  function hourly(id){return Object.hasOwn(hourlyRates,id)?hourlyRates[id]:null;}
  function grossMonth(p){const rate=hourly(p.id);return rate===null?null:rate*Number(p.hours)*52/12;}
  function initials(name){return String(name||'').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
  function personById(id){return people.find(p=>p.id===id);}
  function isDemo(p){return ['e1','e2','e3'].includes(p.id)&&['Anna Müller','Ben Weber','Mira Klein'].includes(p.name);}
  function currentWeek(){return store.mondayKey(new Date());}
  function validate(person){
    const name=String(person.name||'').trim().replace(/\s+/g,' ');
    const role=String(person.role||'').trim();
    const branch=String(person.branch||'').trim();
    const hours=Number(person.hours);
    if(name.length<2||name.length>80||role.length<1||role.length>70||
       branch.length<1||branch.length>80||!Number.isFinite(hours)||
       hours<0||hours>60||Math.round(hours*2)!==hours*2)
      throw new Error('Bitte Name, Rolle, Einsatzort und Sollstunden zwischen 0 und 60 (in halben Stunden) prüfen.');
    return {...person,name,role,branch,hours,docs:Boolean(person.docs)};
  }
  function save(next){
    try{
      store.saveTeam(next);
      people=next;clearWarn();return true;
    }catch(_){
      warn('Die Teamänderung wurde nicht gespeichert. Die bisherigen Teamdaten bleiben erhalten. Prüfe Browserspeicher und Berechtigungen.');
      return false;
    }
  }
  function matches(p){
    const q=$('staffSearch').value.trim().toLocaleLowerCase('de');
    return !q||[p.name,p.role,p.branch].some(value=>
      String(value||'').toLocaleLowerCase('de').includes(q));
  }
  function getPlanning(p){
    const week=currentWeek(),empty=Array(7).fill(null);
    let shifts=empty,absences=empty,warnShifts='';
    try{
      const a=store.getShifts(week),b=store.getAbsences(week);
      shifts=Array.isArray(a[p.id])?a[p.id]:empty;
      absences=Array.isArray(b[p.id])?b[p.id]:empty;
    }catch(_){warnShifts='Schichtdaten konnten nicht vollständig gelesen werden.';}
    let hours=0,count=0;
    const schedule=days.map((day,i)=>{
      const shift=shifts[i],away=absences[i];
      if(!Array.isArray(shift))return {day,detail:away||'Keine Schicht',kind:away?'away':'empty'};
      const h=window.LadenflussPlanning?.shiftHours(shift)||0;
      if(h>0){hours+=h;count++;}
      return {day,detail:String(shift[0]||'')+'–'+String(shift[1]||'')+' · '+number(h)+' h',
        kind:away?'conflict':'shift',away};
    });
    let leaveCount=0,matched=false,warnVacation='';
    try{
      const vac=window.LadenflussVacation?.read();
      matched=Boolean(vac?.employees?.some(x=>x.id===p.id));
      leaveCount=(vac?.entries||[]).filter(x=>x.employeeId===p.id&&x.status==='approved').length;
    }catch(_){warnVacation='Urlaubsdaten sind nicht lesbar und wurden nicht verändert.';}
    return {week,hours,count,schedule,leaveCount,matched,warnShifts,warnVacation};
  }
  function renderProfile(){
    const p=personById(selectedId);
    const panel=$('staffProfile'),content=$('staffProfileContent');
    content.replaceChildren();
    if(!p){
      panel.hidden=true;
      window.dispatchEvent(new CustomEvent('ladenfluss:employee-selected',{detail:null}));
      return;
    }
    panel.hidden=false;
    $('staffProfileTitle').textContent=p.name;
    const info=getPlanning(p);
    const grid=node('div','staff-profile-grid');
    const person=node('div','staff-profile-person');
    person.append(node('div','staff-profile-avatar',initials(p.name)));
    const identity=node('div','staff-profile-identity');
    append(identity,node('strong','',p.name),node('span','',p.role),node('small','',p.branch));
    person.append(identity);
    if(isDemo(p))person.append(node('p','staff-sample-note','Beispielprofil – ersetze die Demodaten vor der eigenen Planung.'));
    const facts=node('dl','staff-profile-facts');
    for(const [label,value] of [
      ['Wochenstunden',number(p.hours)+' h'],['Einsatzort',p.branch]
    ]){
      const div=node('div');append(div,node('dt','',label),node('dd','',value));facts.append(div);
    }
    person.append(facts);
    const planning=node('div','staff-profile-planning');
    const head=node('div','staff-profile-planning-head');
    const heading=node('div');append(heading,node('span','eyebrow','AKTUELLE WOCHE'),node('h3','','Schichten & Anwesenheit'));
    append(head,heading,node('span','',info.week));
    planning.append(head);
    const metrics=node('div','staff-profile-metrics');
    for(const [label,value] of [
      ['Geplante Stunden',number(info.hours)+' h'],['Geplante Schichten',info.count],
      ['Bestätigte Urlaubszeiträume',info.leaveCount]
    ]){
      const metric=node('div');append(metric,node('small','',label),node('strong','',value));metrics.append(metric);
    }
    planning.append(metrics);
    const schedule=node('div','staff-profile-schedule');
    for(const item of info.schedule){
      const row=node('div','staff-schedule-row '+item.kind);
      append(row,node('span','',item.day),node('strong','',item.detail));
      if(item.away)row.append(node('small','','Abwesenheit: '+item.away));
      schedule.append(row);
    }
    planning.append(schedule);
    if(info.warnShifts)planning.append(node('p','staff-read-warning',info.warnShifts));
    if(info.warnVacation)planning.append(node('p','staff-read-warning',info.warnVacation));
    if(!info.matched&&!info.warnVacation)
      planning.append(node('p','staff-profile-hint','Noch nicht mit der Urlaubsplanung verknüpft. Dort kannst du das Team über „Team aus Personalplanung übernehmen“ hinzufügen.'));
    grid.append(person);
    content.append(grid);
    const weekDetails=node('details','staff-planning-details');
    weekDetails.append(node('summary','','Dienstplan dieser Woche ansehen'),planning);
    content.append(weekDetails);

    const rate=hourly(p.id),month=grossMonth(p);
    $('staffHourlyDisplay').textContent=rate===null?'Nicht hinterlegt':money(rate)+' / h';
    $('staffMonthlyDisplay').textContent=month===null?'–':money(month);
    window.dispatchEvent(new CustomEvent('ladenfluss:employee-selected',
      {detail:{id:p.id,name:p.name,hours:Number(p.hours),week:info.week,plannedHours:info.hours}}));
  }
  function render(){
    const visible=people.filter(matches);
    $('staffListCount').textContent=visible.length+' von '+people.length+' Personen';
    list.replaceChildren();
    for(const p of visible){
      const card=node('article','staff-card'+(selectedId===p.id?' selected':''));
      card.append(node('div','staff-avatar',initials(p.name)));
      const main=node('div','staff-main');
      append(main,node('strong','',p.name),node('span','',p.role+' · '+p.branch));
      if(isDemo(p))main.append(node('small','','Beispiel'));
      const h=node('div','staff-hours');append(h,node('small','','Sollstunden'),node('strong','',number(p.hours)+' h'));
      const wage=node('div','staff-wage-cell');
      const rate=hourly(p.id);
      append(wage,node('small','','Brutto / Stunde'),node('strong','',rate===null?'Noch offen':money(rate)));
      const button=node('button','staff-more','Profil öffnen →');
      button.type='button';button.dataset.profileId=p.id;
      button.setAttribute('aria-label','Profil von '+p.name+' öffnen');
      append(card,main,h,wage,button);
      list.append(card);
    }
    if(!visible.length)list.append(node('p','staff-empty','Keine passenden Mitarbeiter gefunden. Bitte Suche oder Rollenfilter prüfen.'));
    $('activeEmployees').textContent=String(people.length);
    $('targetHours').textContent=number(people.reduce((a,p)=>a+Number(p.hours||0),0))+' h';
    const missing=people.filter(p=>hourly(p.id)===null).length;
    const gross=people.reduce((sum,p)=>sum+(grossMonth(p)||0),0);
    $('teamGrossOverview').textContent=!people.length||missing?'–':money(gross);
    $('teamGrossCoverage').textContent=!people.length
      ? 'Mitarbeiter anlegen, um zu starten'
      : missing ? 'Noch '+missing+' Stundenlohn'+(missing===1?'':'angaben')+' fehlt'+(missing===1?'':'en')
        : 'Geschätzt aus Wochenstunden · brutto';
    renderProfile();
  }
  function openDialog(p){
    clearWarn();editingId=p?.id||null;form.reset();
    $('employeeDialogEyebrow').textContent=p?'PROFIL BEARBEITEN':'MITARBEITER HINZUFÜGEN';
    $('employeeDialogTitle').textContent=p?'Profil bearbeiten':'Mitarbeiter hinzufügen';
    $('saveEmployee').textContent=p?'Profil speichern':'Mitarbeiter hinzufügen';
    $('employeeName').value=p?.name||'';
    const role=$('employeeRole');
    if(p&&![...role.options].some(opt=>opt.value===p.role)){
      const opt=node('option','',p.role);opt.value=p.role;role.append(opt);
    }
    role.value=p?.role||'Verkauf';
    $('employeeHours').value=p?String(p.hours):'20';
    $('employeeBranch').value=p?.branch||'Hauptfiliale';
    $('employeeHourlyGross').value=p&&hourly(p.id)!==null?String(hourly(p.id)):'';
    dialog.showModal();$('employeeName').focus();
  }
  try{
    // Fail closed on corrupt existing data; never replace it with demo values.
    const raw=localStorage.getItem('ladenfluss.team.v1');
    if(raw!==null){
      const previous=JSON.parse(raw);
      if(!Array.isArray(previous)||
        previous.some(p=>!p||typeof p.id!=='string'||!p.id||
          typeof p.name!=='string'||typeof p.role!=='string'||
          (p.branch!=null&&typeof p.branch!=='string')||
          !Number.isFinite(Number(p.hours)))||
        new Set(previous.map(p=>p.id)).size!==previous.length)
        throw new Error('Invalid or duplicated team records');
    }
    people=store.getTeam();
    if(!wages)throw new Error('Hourly wage storage missing');
    hourlyRates=wages.load();
  }catch(_){
    loadError=true;people=[];
    warn('Teamdaten sind beschädigt oder der Browserspeicher ist nicht erreichbar. Die Daten wurden nicht überschrieben. Vor weiteren Änderungen bitte den Browserspeicher sichern.');
    $('addEmployee').disabled=true;
    list.append(node('p','staff-empty','Teamdaten konnten nicht sicher geladen werden.'));
  }
  // Simple search only: role catalog/filter is no longer part of this workflow.
  if(!loadError)render();
  $('staffSearch').addEventListener('input',()=>{if(!loadError)render();});

  list.addEventListener('click',event=>{
    const b=event.target.closest('[data-profile-id]');
    if(!b)return;
    const p=personById(b.dataset.profileId);
    if(!p)return;
    selectedId=p.id;render();
    $('staffProfileTitle').tabIndex=-1;$('staffProfileTitle').focus({preventScroll:true});
    $('staffProfile').scrollIntoView({block:'start',behavior:'smooth'});
  });
  $('closeStaffProfile').addEventListener('click',()=>{selectedId=null;render();});
  $('editStaffProfile').addEventListener('click',()=>{
    const p=personById(selectedId);if(p)openDialog(p);
  });
  $('addEmployee').addEventListener('click',()=>{if(!loadError)openDialog(null);});
  $('closeEmployeeDialog').addEventListener('click',()=>dialog.close());
  $('cancelEmployeeDialog').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(loadError||!form.reportValidity())return;
    let candidate;
    try{
      const id=editingId||window.crypto?.randomUUID?.()||
        ('p'+Date.now().toString(36)+Math.random().toString(36).slice(2));
      candidate=validate({
        id,name:$('employeeName').value,role:$('employeeRole').value,
        hours:$('employeeHours').value,branch:$('employeeBranch').value,
        docs:editingId?Boolean(personById(editingId)?.docs):false
      });
    }catch(e){warn(e.message);return;}
    let next;
    if(editingId){
      if(!personById(editingId)){warn('Mitarbeiterprofil nicht gefunden.');return;}
      next=people.map(p=>p.id===editingId?candidate:p);
    }else{
      if(people.some(p=>p.id===candidate.id)){warn('Diese Mitarbeiter-ID ist bereits vergeben.');return;}
      next=[...people,candidate];
    }
    // Keep hourly pay outside the shared PEP/team storage. Store pay first,
    // then team, and restore the previous pay blob if saving the team fails.
    const input=$('employeeHourlyGross').value.trim();
    const rate=input===''?null:Number(input);
    if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>250||
        Math.round(rate*100)!==rate*100)){
      warn('Brutto-Stundenlohn zwischen 0 und 250 € mit maximal zwei Nachkommastellen eingeben.');
      return;
    }
    let previous;
    try{
      previous=localStorage.getItem(wages.KEY);
      wages.set(candidate.id,rate);
    }catch(_){
      warn('Stundenlohn konnte nicht gespeichert werden. Das Profil wurde nicht geändert.');
      return;
    }
    if(!save(next)){
      try{
        if(previous===null)localStorage.removeItem(wages.KEY);
        else localStorage.setItem(wages.KEY,previous);
      }catch(_){warn('Team konnte nicht gespeichert werden. Prüfe die Stundenlohndaten vor erneutem Versuch.');}
      return;
    }
    hourlyRates=wages.load();
    selectedId=candidate.id;render();
    announce('Profil von '+candidate.name+' gespeichert. Name, Wochenstunden und Einsatzort bleiben mit dem Dienstplan verbunden.');
    dialog.close();form.reset();
  });
  $('legacyWageForm')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const message=$('legacyWageMessage'),pass=$('legacyWagePassword');
    const button=event.currentTarget.querySelector('button[type=submit]');
    if(!legacy||!pass?.value)return;
    button.disabled=true;
    try{
      await legacy.unlock(pass.value);
      const prior=legacy.getAllRates();
      const teamIds=new Set(people.map(person=>person.id));
      const matching=Object.fromEntries(Object.entries(prior).filter(([id])=>teamIds.has(id)));
      hourlyRates=wages.mergeMissing(matching);
      message.textContent='Vorhandene Stundenlöhne übernommen. Bereits neu eingetragene Werte bleiben erhalten.';
      $('legacyWageTransfer').hidden=true;
      render();
    }catch(_){
      message.textContent='Übernahme nicht möglich. Bitte die bisherige Passphrase prüfen. Die alten Daten bleiben erhalten.';
    }finally{
      pass.value='';legacy?.lock();button.disabled=false;
    }
  });
  try{$('legacyWageTransfer').hidden=!legacy?.exists();}catch(_){
    $('legacyWageTransfer').hidden=true;
  }
  window.addEventListener('storage',event=>{
    if(event.key!==wages?.KEY)return;
    try{hourlyRates=wages.load();if(!loadError)render();}
    catch(_){warn('Stundenlohndaten wurden in einem anderen Tab beschädigt. Bitte die Daten zuerst sichern.');}
  });

});