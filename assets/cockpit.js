(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const $=id=>document.getElementById(id), settings=window.LadenflussStoreSettings;
    let allSignals=[],showAll=false;
    const priorities={critical:'Dringend prüfen',important:'Im Blick behalten',info:'Zur Einordnung'};
    const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el;};
    const link=(href,label,className)=>{const a=node('a',className,label);a.href=href;return a;};
    const number=value=>value.toLocaleString('de-DE',{maximumFractionDigits:1});
    function report(message){$('cockpitError').textContent=message;$('cockpitError').hidden=!message;}
    function switchPanel(name,updateHash=true){
      if(!['overview','profile','targets','backup','modules'].includes(name))name='overview';
      document.querySelectorAll('[data-cockpit-panel]').forEach(p=>p.hidden=p.dataset.cockpitPanel!==name);
      document.querySelectorAll('[data-cockpit-tab]').forEach(b=>{const active=b.dataset.cockpitTab===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      if(updateHash)history.replaceState(null,'',name==='overview'?location.pathname:'#'+name);
    }
    function calculationHistory(){
      const raw=localStorage.getItem('ladenfluss.history.v1');
      if(raw===null)return [];
      const data=JSON.parse(raw);
      if(!Array.isArray(data))throw new Error('Der Rechenverlauf ist nicht lesbar. Sichere deinen Arbeitsstand.');
      return data.filter(x=>x&&typeof x.tool==='string'&&typeof x.summary==='string');
    }
    function renderSignals(){
      const filter=$('signalFilter').value;
      const filtered=allSignals.filter(s=>filter==='all'||s.priority===filter);
      const list=$('storeSignals');list.replaceChildren();
      for(const signal of filtered.slice(0,showAll?undefined:5)){
        const card=node('article','signal-card '+signal.priority);
        const top=node('div','signal-card-top');top.append(node('span','signal-priority',priorities[signal.priority]),node('span','signal-module',signal.module));
        card.append(top,node('h3','',signal.title),node('p','',signal.message));
        if(signal.impact)card.append(node('p','signal-impact',signal.impact));
        const footer=node('div','signal-card-footer');footer.append(node('small','',signal.source),link(signal.href,signal.action+' →','signal-action'));card.append(footer);
        if(signal.evidence.length){const details=node('details','signal-evidence');details.append(node('summary','','Wie kommt dieser Hinweis zustande?'));const ul=node('ul');signal.evidence.forEach(e=>ul.append(node('li','',String(e))));details.append(ul);card.append(details);}
        list.append(card);
      }
      if(!filtered.length)list.append(node('p','empty-state',filter==='all'?'Keine Hinweise aus den verfügbaren Planungsdaten. Nicht angebundene Bereiche werden noch nicht geprüft.':'Keine Hinweise in dieser Kategorie.'));
      $('showAllSignals').hidden=showAll||filtered.length<=5;
      $('showAllSignals').textContent='Weitere '+Math.max(0,filtered.length-5)+' Hinweise zeigen';
    }
    function renderFocus(profile,demo){
      const card=$('decisionCard');card.replaceChildren();
      let signal=allSignals[0];
      if(!profile.name&&demo)signal={title:'Mach aus dem Beispiel deinen Laden.',message:'Hinterlege Öffnungszeiten und Mindestbesetzung. Die Beispielhinweise unten zeigen dir, wie Ladenfluss arbeitet.',action:'Ladenprofil einrichten',href:'#profile',source:'Erster Schritt',priority:'info'};
      if(!signal)signal={title:'Deine Planung hat aktuell keine erkannten Auffälligkeiten.',message:'Prüfe als Nächstes deinen Dienstplan. Umsatz, Warenbestand und MHD sind noch nicht automatisch angebunden.',action:'Dienstplan öffnen',href:'/pep',source:'Vorhandene lokale Planungsdaten',priority:'info'};
      card.className='focus-card '+signal.priority;
      card.append(node('span','focus-kicker',signal.source),node('h2','',signal.title),node('p','',signal.message));
      if(signal.impact)card.append(node('p','focus-impact',signal.impact));
      const action=link(signal.href,signal.action+' →','btn btn-primary');
      if(signal.href.startsWith('#'))action.addEventListener('click',e=>{e.preventDefault();switchPanel(signal.href.slice(1));});
      card.append(action);
    }
    function renderHistory(history){
      const list=$('recentCalculations');list.replaceChildren();
      for(const entry of history.slice().sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)).slice(0,5)){
        const row=node('div','calculation-row'),left=node('div');
        const at=Date.parse(entry.at),old=!Number.isFinite(at)||Date.now()-at>7*86400000;
        left.append(node('strong','',entry.tool),node('small','',Number.isFinite(at)?new Date(at).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})+(old?' · nur Verlauf':''):'Datum unbekannt · nur Verlauf'));
        row.append(left,node('span','',entry.summary));list.append(row);
      }
      if(!history.length)list.append(node('p','empty-state','Noch keine Berechnungen gespeichert. Beginne mit einer konkreten Frage in den kostenlosen Werkzeugen.'));
    }
    function render(){
      report('');
      let profile;
      try{profile=settings.read();}catch(error){profile=settings.defaults;report(error.message+' Vorhandene Daten werden beim Speichern nicht ersetzt.');}
      $('storeGreeting').textContent=profile.name||'Mein Laden';
      const historyErrors=[];let history=[];
      try{history=calculationHistory();}catch(error){historyErrors.push(error.message);}
      if(historyErrors.length)report(historyErrors.join(' '));
      allSignals=window.LadenflussSignals.sort([...window.LadenflussPepSignals.current(),...window.LadenflussBusinessSignals.fromHistory(history,new Date(),profile)]);
      const counts=window.LadenflussSignals.counts(allSignals);
      for(const [key,id] of [['critical','countCritical'],['important','countImportant'],['info','countInfo']])$(id).textContent=String(counts[key]);
      let demo=false;
      try{const team=window.LadenflussTeamStore.getTeam();demo=team.length===3&&team.every(p=>({e1:'Anna Müller',e2:'Ben Weber',e3:'Mira Klein'}[p.id]===p.name));}catch{}
      $('demoNotice').hidden=!demo;
      $('analysisTime').textContent='Stand '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      $('dashProductivity').textContent=number(profile.productivity)+' €/h';
      $('dashLabor').textContent=number(profile.labor)+' %';$('dashMargin').textContent=number(profile.margin)+' %';$('dashLead').textContent=number(profile.lead)+' Tage';
      renderFocus(profile,demo);renderSignals();renderHistory(history);
    }
    function fillForms(){
      let p;try{p=settings.read();}catch{p=settings.defaults;}
      for(const [id,key] of Object.entries({store_name:'name',store_type:'type',store_days:'days',store_open:'open',store_close:'close',store_min_staff:'minStaff',store_state:'state',target_productivity:'productivity',target_labor:'labor',target_margin:'margin',target_lead:'lead',target_buffer:'buffer',target_hourly:'hourly'}))$(id).value=p[key];
    }
    for(const [key,name] of Object.entries(window.LadenflussHolidays.STATES)){const option=node('option','',name);option.value=key;$('store_state').append(option);}
    $('cockpitDate').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
    document.querySelectorAll('[data-cockpit-tab],[data-open-panel]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();switchPanel(button.dataset.cockpitTab||button.dataset.openPanel);}));
    window.addEventListener('hashchange',()=>switchPanel(location.hash.slice(1),false));
    $('signalFilter').addEventListener('change',()=>{showAll=false;renderSignals();});
    $('showAllSignals').addEventListener('click',()=>{showAll=true;renderSignals();});
    const save=(data,status)=>{
      try{settings.save(data);render();status.textContent='Gespeichert. Hinweise wurden neu berechnet.';}
      catch(error){status.textContent='Nicht gespeichert: '+error.message;}
    };
    const n=id=>$(id).value.trim()===''?NaN:Number($(id).value);
    $('storeProfile').addEventListener('submit',event=>{event.preventDefault();save({name:$('store_name').value.trim(),type:$('store_type').value.trim(),days:n('store_days'),open:$('store_open').value,close:$('store_close').value,minStaff:n('store_min_staff'),state:$('store_state').value},$('profileState'));});
    $('storeTargets').addEventListener('submit',event=>{event.preventDefault();save({productivity:n('target_productivity'),labor:n('target_labor'),margin:n('target_margin'),lead:n('target_lead'),buffer:n('target_buffer'),hourly:n('target_hourly')},$('targetState'));});
    $('downloadBackup').addEventListener('click',()=>{
      try{const count=window.LadenflussBackup.download();$('backupStatus').textContent='Download für '+count+' Datenbereiche gestartet. Bitte prüfe die Datei in deinen Downloads.';}
      catch(error){$('backupStatus').textContent='Sicherung nicht möglich: '+error.message;}
    });
    window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith('ladenfluss.'))render();});
    fillForms();render();switchPanel(location.hash.slice(1),false);
  });
})();
