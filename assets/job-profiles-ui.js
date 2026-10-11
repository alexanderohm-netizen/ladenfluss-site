document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const api=window.LadenflussJobProfiles;
  const store=window.LadenflussTeamStore;
  const $=id=>document.getElementById(id);
  if(!api||!$('staffPositionList'))return;
  const root=$('staffPositionList'),detail=$('staffPositionDetail'),
    dialog=$('staffPositionDialog'),form=$('staffPositionForm');
  let profiles=[],currentId=null,editingId=null,loadError=false;
  function el(tag,className,text){
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=String(text);
    return n;
  }
  function add(parent,...nodes){for(const node of nodes)parent.append(node);return parent;}
  function warn(text){$('staffPositionError').textContent=text;$('staffPositionError').hidden=false;}
  function clearWarn(){$('staffPositionError').hidden=true;$('staffPositionError').textContent='';}
  function fieldLines(value){
    const lines=String(value||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(lines.length<1||lines.length>10||lines.some(line=>line.length<3||line.length>180))
      throw new Error('Bitte 1–10 kurze Zeilen für Aufgaben und Anforderungen eintragen (max. 180 Zeichen je Zeile).');
    return lines;
  }
  function readTeam(){
    try{return store.getTeam()||[];}catch{return [];}
  }
  function assigned(title){
    return readTeam().filter(p=>p.role?.toLocaleLowerCase('de')===title.toLocaleLowerCase('de')).length;
  }
  function openProfile(id){
    const p=profiles.find(x=>x.id===id);
    detail.replaceChildren();
    currentId=p?.id||null;
    if(!p){detail.hidden=true;return;}
    detail.hidden=false;
    const top=el('div','staff-position-detail-top');
    const head=el('div');
    add(head,el('span','eyebrow',p.department),
      el('h3','',p.title),el('p','',p.summary));
    const edit=el('button','btn btn-primary','Profil bearbeiten');
    edit.type='button';edit.id='staffPositionEdit';
    edit.addEventListener('click',()=>openDialog(p));
    add(top,head,edit);
    const columns=el('div','staff-position-detail-grid');
    const responsibility=el('div','staff-position-responsibility');
    add(responsibility,el('small','','VERANTWORTUNG'),el('strong','',p.responsibility),
      el('p','',assigned(p.title)+' Teammitglieder mit dieser Stellenbezeichnung'));
    columns.append(responsibility);
    for(const [label,entries] of [['Typische Aufgaben',p.tasks],['Anforderungen',p.requirements]]){
      const card=el('div','staff-position-detail-list');
      card.append(el('h4','',label));
      const list=el('ul');
      for(const item of entries)list.append(el('li','',item));
      card.append(list);columns.append(card);
    }
    add(detail,top,columns);
  }
  function render(){
    const query=$('staffPositionSearch').value.trim().toLocaleLowerCase('de');
    root.replaceChildren();
    const visible=profiles.filter(p=>
      [p.title,p.department,p.summary,p.responsibility].some(value=>
        value.toLocaleLowerCase('de').includes(query)));
    $('staffPositionCount').textContent=visible.length+' von '+profiles.length+' Stellenprofile';
    if(!visible.length){
      root.append(el('p','staff-empty','Keine passende Stelle gefunden.'));return;
    }
    for(const p of visible){
      const card=el('article','staff-position-card'+(p.id===currentId?' selected':''));
      const top=el('div','staff-position-card-top');
      const avatar=el('div','staff-position-symbol',p.title[0]?.toUpperCase()||'S');
      const count=el('span','staff-position-assigned',assigned(p.title)+' im Team');
      add(top,avatar,count);
      const tag=el('span','staff-position-category',p.department);
      const button=el('button','staff-position-view','Profil ansehen →');
      button.type='button';button.dataset.positionId=p.id;
      add(card,top,tag,el('h3','',p.title),el('p','',p.summary),button);
      root.append(card);
    }
  }
  function openDialog(p){
    if(loadError)return;
    editingId=p?.id||null;
    form.reset();$('staffPositionFormError').hidden=true;
    $('staffPositionDialogTitle').textContent=p?'Stellenprofil bearbeiten':'Eigene Stelle definieren';
    $('staffPositionSubmit').textContent=p?'Änderungen speichern':'Stelle anlegen';
    const title=$('staffPositionTitleInput');
    title.value=p?.title||'';
    // A title is a stable PEP role reference; changing it could orphan staff assignments.
    title.readOnly=Boolean(p);
    title.title=p?'Stellenbezeichnungen bleiben für die Team-Zuordnung stabil.':'';
    $('staffPositionDepartment').value=p?.department||'';
    $('staffPositionResponsibility').value=p?.responsibility||'';
    $('staffPositionSummary').value=p?.summary||'';
    $('staffPositionTasks').value=p?.tasks?.join('\n')||'';
    $('staffPositionRequirements').value=p?.requirements?.join('\n')||'';
    dialog.showModal();(p?$('staffPositionSummary'):title).focus();
  }
  function syncJobSelect(){
    const select=$('employeeRole');
    if(!select)return;
    const value=select.value;
    const names=profiles.map(p=>p.title);
    // Existing custom historic team roles are valid even when not in a template.
    for(const p of readTeam())if(!names.includes(p.role))names.push(p.role);
    select.replaceChildren();
    for(const name of names){
      const opt=el('option','',name);opt.value=name;select.append(opt);
    }
    select.value=names.includes(value)?value:'Verkauf';
  }
  function reload(){
    try{profiles=api.read();loadError=false;clearWarn();}
    catch(e){
      profiles=[];loadError=true;warn(e.message);
      $('staffAddPosition').disabled=true;detail.hidden=true;
    }
    syncJobSelect();
    render();
  }
  $('staffPositionSearch').addEventListener('input',render);
  root.addEventListener('click',event=>{
    const btn=event.target.closest('[data-position-id]');
    if(!btn)return;
    currentId=btn.dataset.positionId;
    render();openProfile(currentId);
    detail.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('staffAddPosition').addEventListener('click',()=>openDialog(null));
  $('staffPositionClose').addEventListener('click',()=>dialog.close());
  $('staffPositionCancel').addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(loadError||!form.reportValidity())return;
    const formErr=$('staffPositionFormError');
    formErr.hidden=true;
    try{
      const payload={
        title:$('staffPositionTitleInput').value,
        department:$('staffPositionDepartment').value,
        responsibility:$('staffPositionResponsibility').value,
        summary:$('staffPositionSummary').value,
        tasks:fieldLines($('staffPositionTasks').value),
        requirements:fieldLines($('staffPositionRequirements').value)
      };
      profiles=editingId?api.updateProfile(editingId,payload,profiles):api.createProfile(payload,profiles);
      currentId=editingId||profiles.at(-1).id;
      dialog.close();reload();openProfile(currentId);
      window.dispatchEvent(new CustomEvent('ladenfluss:positions-updated'));
    }catch(err){
      formErr.textContent=err.message;formErr.hidden=false;
    }
  });
  // Freshly added roles are immediately available in the employee editor.
  window.addEventListener('storage',event=>{
    if(event.key===api.key||event.key===null)reload();
  });
  reload();
});