(function(){
'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  const buttons=[...document.querySelectorAll('[data-vac-view]')];
  const panels=[...document.querySelectorAll('[data-vac-panel]')];
  const views=new Set(['calendar','team','entry','settings']);
  function show(view,{focus=false}={}){
    if(!views.has(view))return;
    panels.forEach(panel=>{panel.hidden=panel.dataset.vacPanel!==view;});
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.vacView===view)));
    if(focus){
      const panel=panels.find(item=>item.dataset.vacPanel===view);
      const heading=panel?.querySelector('h2');
      if(heading){
        heading.tabIndex=-1;
        heading.focus({preventScroll:true});
        panel.scrollIntoView({block:'start',behavior:'auto'});
      }
    }
  }
  buttons.forEach(button=>button.addEventListener('click',()=>show(button.dataset.vacView)));
  // Guided cards reuse the existing four planner views instead of
  // introducing competing state or separate employee/absence stores.
  document.querySelectorAll('[data-vac-shortcut]').forEach(button=>{
    button.addEventListener('click',()=>show(button.dataset.vacShortcut,{focus:true}));
  });
  document.getElementById('vacEntries').addEventListener('click',event=>{
    if(event.target.closest('button')?.textContent==='Bearbeiten')show('entry');
  },true);
  document.getElementById('vacCancelEdit').addEventListener('click',()=>show('calendar'));
  document.getElementById('vacEntryForm').addEventListener('submit',()=>{
    if(document.getElementById('vacError').hidden&&document.getElementById('vacFrom').value==='')show('calendar');
  });
});
})();
