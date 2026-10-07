(function(){'use strict';document.addEventListener('DOMContentLoaded',()=>{
const buttons=[...document.querySelectorAll('[data-vac-view]')];
function show(view){document.querySelectorAll('[data-vac-panel]').forEach(p=>p.hidden=p.dataset.vacPanel!==view);buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vacView===view)));}
buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.vacView)));
document.getElementById('vacEntries').addEventListener('click',event=>{if(event.target.closest('button')?.textContent==='Bearbeiten')show('entry');},true);
document.getElementById('vacCancelEdit').addEventListener('click',()=>show('calendar'));
document.getElementById('vacEntryForm').addEventListener('submit',()=>{if(document.getElementById('vacError').hidden&&document.getElementById('vacFrom').value==='')show('calendar');});
});})();
