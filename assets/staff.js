document.addEventListener('DOMContentLoaded',()=>{
  const store=window.LadenflussTeamStore;
  const escape=store.escapeHtml;
  const people=store.getTeam();
  const list=document.getElementById('staffList');
  const dlg=document.getElementById('employeeDialog');

  function persist(){
    store.saveTeam(people);
    const shifts=store.ensureEmployeeShiftRows(people,store.getShifts());
    store.saveShifts(shifts);
  }

  function render(){
    list.innerHTML=people.map(p=>`<article class="staff-card">
      <div class="staff-avatar">${escape(p.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</div>
      <div class="staff-main"><strong>${escape(p.name)}</strong><span>${escape(p.role)} · ${escape(p.branch)}</span></div>
      <div class="staff-hours"><small>Soll</small><strong>${Number(p.hours||0).toLocaleString('de-DE')} h</strong></div>
      <div class="staff-docs ${p.docs?'ok':'open'}"><small>Unterlagen</small><strong>${p.docs?'Vollständig':'Prüfen'}</strong></div>
      <button class="staff-more" type="button" aria-label="Mitarbeiterdetails">→</button>
    </article>`).join('');

    const total=people.reduce((a,p)=>a+Number(p.hours||0),0);
    const missing=people.filter(p=>!p.docs).length;
    document.getElementById('activeEmployees').textContent=people.length;
    document.getElementById('targetHours').textContent=total.toLocaleString('de-DE')+' h';
    document.getElementById('missingDocs').textContent=missing;
    document.getElementById('staffFocusTitle').textContent=missing?missing+' Mitarbeiter-Unterlage'+(missing>1?'n':'')+' prüfen':'Alles vollständig.';
    document.getElementById('staffFocusText').textContent=missing
      ? 'Mindestens bei einer Person fehlt noch die Kennzeichnung „Unterlagen vollständig“.'
      : 'Für dein Team liegen aktuell keine Hinweise vor.';
  }

  document.getElementById('addEmployee').onclick=()=>dlg.showModal();
  dlg.querySelectorAll('button[value=cancel]').forEach(button => {
    button.type='button';
    button.onclick=()=>dlg.close();
  });

  document.getElementById('employeeForm').addEventListener('submit',e=>{
    e.preventDefault();
    const name=document.getElementById('employeeName').value.trim();
    if(!name) return;

    people.push({
      id:'p'+Date.now(),
      name,
      role:document.getElementById('employeeRole').value,
      hours:Number(document.getElementById('employeeHours').value||0),
      branch:document.getElementById('employeeBranch').value,
      docs:document.getElementById('employeeDocs').checked
    });

    persist();
    e.target.reset();
    dlg.close();
    render();
  });

  persist();
  render();
});