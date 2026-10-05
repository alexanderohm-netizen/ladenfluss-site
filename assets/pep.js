document.addEventListener('DOMContentLoaded',()=> {
  const store=window.LadenflussTeamStore;
  const team=store.getTeam();
  const shifts=store.ensureEmployeeShiftRows(team,store.getShifts());

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
  let published=false;

  const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
  const hours=s=>!s?0:Math.max(0,(mins(s[1])-mins(s[0])-Number(s[2]||0))/60);

  function persist(){
    const next={};
    employees.forEach(e=>next[e.id]=e.shifts);
    store.saveShifts(next);
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
  }

  function render(){
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
    planStatus.classList.toggle('published',published);
    planStatus.innerHTML=published?'<i></i> Veröffentlicht':'<i></i> Entwurf';
    publishBtn.textContent=published?'Zurück auf Entwurf':'Plan veröffentlichen';
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