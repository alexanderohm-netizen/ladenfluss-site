document.addEventListener('DOMContentLoaded',()=> {
  const employees=[
    {id:'e1',name:'Anna',role:'Verkauf',target:30,shifts:[['08:00','14:00',30],['08:00','14:00',30],null,['12:00','18:00',30],['08:00','14:00',30],null,null]},
    {id:'e2',name:'Ben',role:'Verkauf',target:35,shifts:[['11:00','19:00',30],null,['11:00','19:00',30],['11:00','19:00',30],null,['09:00','17:00',30],null]},
    {id:'e3',name:'Mira',role:'Aushilfe',target:20,shifts:[null,['14:00','19:00',15],null,null,['14:00','19:00',15],['10:00','16:00',30],null]}
  ];
  const body=document.getElementById('pepBody'), dlg=document.getElementById('shiftDialog');
  const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
  const hours=s=>!s?0:Math.max(0,(mins(s[1])-mins(s[0])-Number(s[2]||0))/60);
  function render(){
    body.innerHTML=employees.map(e=>{
      const total=e.shifts.reduce((a,s)=>a+hours(s),0);
      const cells=e.shifts.map((s,i)=>s?`<td><button class="shift-chip" data-e="${e.id}" data-d="${i}"><strong>${s[0]}–${s[1]}</strong><span>${hours(s).toLocaleString('de-DE',{maximumFractionDigits:1})} h</span></button></td>`:`<td><button class="empty-shift" data-e="${e.id}" data-d="${i}">+</button></td>`).join('');
      const state=total>e.target+5?'high':total<Math.max(0,e.target-8)?'low':'ok';
      return `<tr><th><strong>${e.name}</strong><span>${e.role} · Ziel ${e.target} h</span></th>${cells}<td class="week-total ${state}"><strong>${total.toLocaleString('de-DE',{maximumFractionDigits:1})} h</strong><span>${state==='ok'?'passt':state==='high'?'hoch':'niedrig'}</span></td></tr>`;
    }).join('');
    const total=employees.reduce((a,e)=>a+e.shifts.reduce((x,s)=>x+hours(s),0),0);
    const issues=employees.filter(e=>{const h=e.shifts.reduce((x,s)=>x+hours(s),0);return h>e.target+5||h<Math.max(0,e.target-8)}).length;
    document.getElementById('plannedHours').textContent=total.toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
    document.getElementById('employeeCount').textContent=employees.length;
    document.getElementById('issueCount').textContent=issues;
    document.getElementById('issueText').textContent=issues?issues===1?'1 Plan prüfen':issues+' Pläne prüfen':'Alles ruhig';
    const focus=document.getElementById('pepFocus');
    focus.querySelector('strong').textContent=issues?issues+' Stundenplan-Hinweis'+(issues>1?'e':''):'Der Plan sieht gut aus.';
    focus.querySelector('p').textContent=issues?'Mindestens ein Wochenpensum liegt deutlich über oder unter dem hinterlegten Ziel. Prüfe die markierten Summen.':'Keine auffälligen Wochenstunden in diesem Demo-Plan.';
    bindCells();
  }
  function openDialog(eid=null,day=null){
    const sel=document.getElementById('shiftEmployee');sel.innerHTML=employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    if(eid)sel.value=eid;if(day!==null)document.getElementById('shiftDay').value=String(day);
    dlg.showModal();
  }
  function bindCells(){document.querySelectorAll('.empty-shift,.shift-chip').forEach(b=>b.onclick=()=>openDialog(b.dataset.e,Number(b.dataset.d)))}
  document.getElementById('addShift').onclick=()=>openDialog();
  document.getElementById('printPlan').onclick=()=>window.print();
  document.getElementById('shiftForm').addEventListener('submit',e=>{
    e.preventDefault();
    const emp=employees.find(x=>x.id===document.getElementById('shiftEmployee').value);
    const day=Number(document.getElementById('shiftDay').value),start=document.getElementById('shiftStart').value,end=document.getElementById('shiftEnd').value,br=Number(document.getElementById('shiftBreak').value||0);
    if(!emp||!start||!end||mins(end)<=mins(start))return;
    emp.shifts[day]=[start,end,br];dlg.close();render();
  });
  render();
});