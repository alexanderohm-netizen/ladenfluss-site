/* Ladenfluss reference dashboard widgets.
   READ-ONLY visual summaries of existing local modules. No fake business metrics,
   no service-role keys, no cloud requests and no modification to the PEP/leave stores. */
(function(){
'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  if(!document.body.classList.contains('lf-reference-dashboard'))return;
  const $=id=>document.getElementById(id);
  const store=window.LadenflussTeamStore;
  const create=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  };
  const append=(el,...children)=>{for(const c of children)el.append(c);return el;};
  const days=['Mo','Di','Mi','Do','Fr','Sa','So'];
  const number=value=>Number(value||0).toLocaleString('de-DE',{maximumFractionDigits:1});
  const iso=value=>[value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
  const initials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  function loadTeam(){
    try{const t=store.getTeam();return Array.isArray(t)?t:[];}
    catch{return [];}
  }
  function loadWeek(){
    try{
      const monday=store.mondayKey(new Date());
      const shifts=store.getShifts(monday),absences=store.getAbsences(monday);
      return {monday,shifts:shifts&&typeof shifts==='object'?shifts:{},
        absences:absences&&typeof absences==='object'?absences:{}};
    }catch{return {monday:store.mondayKey(new Date()),shifts:{},absences:{}};}
  }
  function loadVacation(){
    try{const x=window.LadenflussVacation?.read();return x&&Array.isArray(x.entries)?x:null;}
    catch{return null;}
  }
  function datesOfWeek(monday){
    const d=new Date(monday+'T12:00:00');
    return days.map((_,i)=>{
      const value=new Date(d);value.setDate(d.getDate()+i);return value;
    });
  }
  function shiftHours(shift){
    try{
      const hours=window.LadenflussPlanning.shiftHours(shift);
      return Number.isFinite(hours)?Math.max(0,hours):0;
    }catch{return 0;}
  }
  function renderKpi(team,week,vacation){
    const today=new Date(),monday=datesOfWeek(week.monday);
    const currentIndex=monday.findIndex(d=>iso(d)===iso(today));
    const dailyScheduled=currentIndex<0?[]:team.filter(p=>shiftHours(week.shifts[p.id]?.[currentIndex])>0);
    $('refKpiTeam').textContent=dailyScheduled.length+' / '+team.length;
    $('refKpiVacation').textContent=vacation?String(vacation.entries.length):'–';
    $('refKpiSales').textContent='–';
    $('refKpiStock').textContent='–';
    $('refKpiApplicants').textContent='–';
    $('refKpiCloud').textContent='Lokal';
    let attention=0;
    for(const key of ['countCritical','countImportant'])attention+=Number($(key)?.textContent||0);
    $('refAlertCount').textContent=attention>9?'9+':String(attention);
    const profile=window.LadenflussStoreSettings?.read();
    const storeName=profile?.name||'Mein Laden';
    $('refSidebarShop').textContent=storeName;
    $('refTopShop').textContent=storeName;
    const hour=new Date().getHours();
    $('refGreeting').textContent=hour<11?'Guten Morgen,':hour<18?'Guten Tag,':'Guten Abend,';
  }
  function renderHourChart(team,week){
    const host=$('refHoursChart');host.replaceChildren();
    const dates=datesOfWeek(week.monday);
    const hours=dates.map((date,i)=>team.reduce((sum,p)=>sum+shiftHours(week.shifts[p.id]?.[i]),0));
    const max=Math.max(...hours,1);
    const today=iso(new Date());
    hours.forEach((value,i)=>{
      const col=create('div','ref-hour-col'+(iso(dates[i])===today?' is-today':''));
      const area=create('div','ref-hour-bars');
      const bar=create('div','ref-hour-bar');
      bar.style.setProperty('--bar-height',Math.max(3,(value/max)*140)+'px');
      bar.title=days[i]+': '+number(value)+' Personalstunden';
      append(area,bar);
      append(col,create('strong','',number(value)+' h'),area,create('small','',days[i]));
      host.append(col);
    });
  }
  function shiftLabel(s,absence){
    if(absence)return {text:'Abwesend',type:'away',title:String(absence)};
    if(!Array.isArray(s))return {text:'Frei',type:'off'};
    const start=String(s[0]||'');
    const hour=Number(start.split(':')[0]);
    if(!Number.isFinite(hour))return {text:'Schicht',type:'mid'};
    return {text:hour<10?'Früh':hour>=12?'Spät':'Mitte',
      type:hour<10?'early':hour>=12?'late':'mid',title:start+'–'+String(s[1]||'')};
  }
  function renderPep(team,week){
    const header=$('refPepHead'),body=$('refPepBody');
    header.replaceChildren();body.replaceChildren();
    const tr=create('tr');tr.append(create('th','','Team'));
    const dates=datesOfWeek(week.monday);
    days.forEach((day,i)=>{
      const th=create('th','',day);th.title=dates[i].toLocaleDateString('de-DE');tr.append(th);
    });
    header.append(tr);
    for(const p of team.slice(0,6)){
      const row=create('tr');row.append(create('th','',p.name));
      for(let i=0;i<7;i++){
        const s=shiftLabel(week.shifts[p.id]?.[i],week.absences[p.id]?.[i]);
        const cell=create('td');
        const a=create('a','ref-shift '+(s.type||''),s.text);
        a.href='/pep?week='+encodeURIComponent(week.monday);
        a.title=s.title||s.text;
        cell.append(a);row.append(cell);
      }
      body.append(row);
    }
    if(!team.length){
      const row=create('tr'),cell=create('td','','Noch keine Mitarbeiter angelegt');
      cell.colSpan=8;row.append(cell);body.append(row);
    }
  }
  function renderInsights(){
    const host=$('refInsightList');host.replaceChildren();
    const signals=[...document.querySelectorAll('#storeSignals .signal-card')].slice(0,3);
    if(!signals.length){
      const article=create('article','ref-insight info');
      append(article,create('span','ref-insight-icon','✓'));
      const desc=create('div');
      append(desc,create('strong','','Keine aktuellen Planungswarnungen'),
        create('p','','Umsatz, Warenbestand und Bewerbungen sind noch nicht automatisch angebunden.'));
      article.append(desc);host.append(article);return;
    }
    for(const signal of signals){
      const kind=['critical','important','info'].find(k=>signal.classList.contains(k))||'info';
      const card=create('article','ref-insight '+kind);
      card.append(create('span','ref-insight-icon',kind==='critical'?'!':kind==='important'?'!':'✓'));
      const text=create('div');
      append(text,create('strong','',signal.querySelector('h3')?.textContent||'Planungshinweis'),
        create('p','',signal.querySelector('p')?.textContent||''));
      card.append(text);host.append(card);
    }
  }
  function renderTeam(team){
    const host=$('refTeamMembers');host.replaceChildren();
    if(!team.length){host.append(create('p','empty-state','Noch kein Team angelegt.'));return;}
    for(const p of team.slice(0,4)){
      const a=create('a','ref-team-member');a.href='/mitarbeiter';
      append(a,create('span','',initials(p.name)||'–'),
        create('strong','',p.name),create('small','',p.role||'Team'));
      host.append(a);
    }
    if(team.length>4){
      const a=create('a','ref-team-member');a.href='/mitarbeiter';
      append(a,create('span','', '+'+(team.length-4)),create('strong','','Mehr ansehen'));
      host.append(a);
    }
  }
  function vacationDate(v){
    const d=new Date(v+'T12:00:00');
    return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):'Datum unbekannt';
  }
  function renderVacation(vac){
    const host=$('refVacationList');host.replaceChildren();
    if(!vac||!vac.entries.length){
      host.append(create('p','empty-state',vac?'Noch kein Urlaub eingetragen.':'Urlaubsdaten sind nicht lesbar.'));return;
    }
    const names=new Map((vac.employees||[]).map(e=>[e.id,e.name]));
    const sorted=vac.entries.slice().sort((a,b)=>String(b.start).localeCompare(String(a.start))).slice(0,4);
    for(const e of sorted){
      const item=create('div','ref-vacation-item');
      item.append(create('span','ref-vac-avatar',initials(names.get(e.employeeId)||'?')||'?'));
      const middle=create('span');
      append(middle,create('strong','',names.get(e.employeeId)||'Mitarbeiter'),
        create('small','',vacationDate(e.start)+' – '+vacationDate(e.end)));
      const status=create('em',e.status==='approved'?'approved':'',e.status==='approved'?'Bestätigt':'Geplant');
      append(item,middle,status);host.append(item);
    }
  }
  const lookup=[
    ['Personalfluss · Mitarbeiterprofile','/mitarbeiter','Team & Stammdaten'],
    ['PEP · Dienstplan','/pep','Schichten und Besetzung'],
    ['Urlaubsplaner','/tools/urlaubsplaner','Urlaubsanträge, Kalender'],
    ['Handelsrechner','/rechner','Preise, Marge, Umsatz'],
    ['Ladenprofil','/mein-laden#profile','Filiale und Öffnungszeiten'],
    ['Richtwerte','/mein-laden#targets','Stundenleistung, Personalkosten'],
    ['Datensicherung','/mein-laden#backup','Lokale Daten exportieren']
  ];
  function setupSearch(){
    const form=$('refDashboardSearch'),input=$('refDashboardQuery'),results=$('refDashboardResults');
    const show=()=>{
      const query=input.value.trim().toLocaleLowerCase('de');
      results.replaceChildren();
      if(!query){results.hidden=true;return;}
      const found=lookup.filter(([title,,detail])=>(title+' '+detail).toLocaleLowerCase('de').includes(query)).slice(0,6);
      if(!found.length)results.append(create('p','','Keine passenden Module gefunden.'));
      else for(const [title,url,desc] of found){
        const a=create('a');a.href=url;
        append(a,create('strong','',title),create('small','',desc));results.append(a);
      }
      results.hidden=false;
    };
    input.addEventListener('input',show);
    input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';results.hidden=true;}});
    form.addEventListener('submit',e=>{
      e.preventDefault();const a=results.querySelector('a');if(a)a.click();
    });
    document.addEventListener('click',e=>{if(!form.contains(e.target))results.hidden=true;});
  }
  function setupMobile(){
    const button=$('refMobileMenu');
    const sidebar=document.querySelector('.workspace-nav');
    sidebar.id='refSidebar';
    button.setAttribute('aria-controls','refSidebar');
    const close=()=>{document.body.classList.remove('ref-sidebar-open');button.setAttribute('aria-expanded','false');};
    button.addEventListener('click',()=>{
      const open=document.body.classList.toggle('ref-sidebar-open');
      button.setAttribute('aria-expanded',String(open));
    });
    sidebar.addEventListener('click',e=>{
      if(e.target.closest('button,a')&&matchMedia('(max-width:900px)').matches)close();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    window.addEventListener('resize',()=>{
      if(window.innerWidth>900)close();
    });
  }
  function redraw(){
    const team=loadTeam(),week=loadWeek(),vac=loadVacation();
    try{renderKpi(team,week,vac);}catch(_){
      $('refKpiTeam').textContent='–';
      $('refKpiVacation').textContent='–';
    }
    renderHourChart(team,week);
    renderPep(team,week);
    renderInsights();
    renderTeam(team);
    renderVacation(vac);
  }
  setupSearch();setupMobile();
  $('refDetailedSignals').addEventListener('click',()=>{},false);
  document.querySelector('.ref-all-insights')?.addEventListener('click',()=>{
    $('refDetailedSignals').open=true;
  });
  window.addEventListener('storage',e=>{
    if(e.key===null||e.key.startsWith('ladenfluss.'))redraw();
  });
  document.querySelectorAll('[data-cockpit-tab],[data-open-panel]').forEach(button=>{
    button.addEventListener('click',()=>{if(button.dataset.cockpitTab==='overview'||button.dataset.openPanel==='overview')redraw();});
  });
  redraw();
});
})();