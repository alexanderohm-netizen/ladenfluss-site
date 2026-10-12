/* Personalfluss modern role board + confidential employee profile UI.
 * No sensitive data is added to the shared team/PEP/vacation store.
 */
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const store=window.LadenflussTeamStore,privateStore=window.LadenflussPrivatePersonnel;
  const board=$('staffRoleGrid'),roleCount=$('staffRoleCount'),search=$('staffSearch');
  const dialog=$('privateEmployeeDialog'),form=$('privateEmployeeForm'),fields=$('privateFields');
  const status=$('privateStatus'),pass=$('privatePassphrase');
  let selectedId=null,unlocked=false,busy=false;
  const roles={
    'Filialleitung':{icon:'◆',tag:'Führung',desc:'Filialorganisation, Teamsteuerung und wirtschaftliche Kennzahlen'},
    'Verkauf':{icon:'▦',tag:'Verkaufsfläche',desc:'Kundenservice, Warenpräsentation und operative Abläufe'},
    'Aushilfe':{icon:'◫',tag:'Unterstützung',desc:'Flexible Unterstützung im Tagesgeschäft'},
    'Lager':{icon:'▤',tag:'Logistik',desc:'Warenannahme, Lagerorganisation und Warenfluss'},
    'Service':{icon:'✦',tag:'Kundenkontakt',desc:'Servicequalität und direkte Kundenbetreuung'},
    'Küche':{icon:'◈',tag:'Betrieb',desc:'Vorbereitung, Qualität und tägliche Arbeitsabläufe'}
  };
  function element(tag,cls,value){
    const e=document.createElement(tag);if(cls)e.className=cls;
    if(value!==undefined)e.textContent=String(value);
    return e;
  }
  function renderRoles(){
    if(!board||!store)return;
    let team;try{team=store.getTeam();}catch(_){return;}
    const counts=new Map();
    for(const p of team){const role=String(p.role||'Unbekannt').trim();counts.set(role,(counts.get(role)||0)+1);}
    board.replaceChildren();
    for(const [role,count] of [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'))){
      const meta=roles[role]||{icon:'◇',tag:'Individuelle Rolle',desc:'Individuell hinterlegtes Stellenprofil'};
      const card=element('button','staff-role-card');card.type='button';card.setAttribute('aria-label',role+' · '+count+' Mitarbeitende filtern');
      const top=element('div','staff-role-card-top');
      top.append(element('span','staff-role-symbol',meta.icon),element('span','staff-role-pill',meta.tag));
      const title=element('h3','',role),description=element('p','',meta.desc);
      const foot=element('div','staff-role-foot');
      foot.append(element('strong','',count+' '+(count===1?'Person':'Personen')),element('span','','Team ansehen ↗'));
      card.append(top,title,description,foot);
      card.addEventListener('click',()=>{
        if(!search)return;
        search.value=role;search.dispatchEvent(new Event('input',{bubbles:true}));
        $('staffListTitle')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
      board.append(card);
    }
    if(!counts.size)board.append(element('p','staff-empty','Lege deinen ersten Mitarbeiter an, um Stellenprofile zu sehen.'));
    if(roleCount)roleCount.textContent=counts.size+' '+(counts.size===1?'Stellenprofil':'Stellenprofile');
  }
  function showPrivateState(){
    const badge=$('staffPrivateState'),button=$('openPrivateProfile');
    if(!badge||!button)return;
    if(!selectedId){badge.textContent='Nicht ausgewählt';button.disabled=true;return;}
    button.disabled=!privateStore?.available();
    try{badge.textContent=privateStore?.exists(selectedId)?'Verschlüsselt hinterlegt':'Noch keine Angaben';}
    catch(_){badge.textContent='Nicht verfügbar';}
  }
  function clearPrivate(){
    unlocked=false;busy=false;
    if(form)form.reset();
    if(fields)fields.hidden=true;
    if(status)status.textContent='';
    if($('unlockPrivate'))$('unlockPrivate').disabled=false;
    if($('savePrivateDetails'))$('savePrivateDetails').disabled=false;
  }
  function closePrivate(){if(dialog?.open)dialog.close();clearPrivate();}
  window.addEventListener('ladenfluss:employee-selected',event=>{
    const id=event.detail?.id||null;
    if(id!==selectedId){closePrivate();selectedId=id;}
    showPrivateState();renderRoles();
  });
  window.addEventListener('storage',event=>{
    if(event.key==='ladenfluss.team.v1'){renderRoles();showPrivateState();}
    if(event.key?.startsWith(privateStore?.PREFIX||'__never__'))showPrivateState();
  });
  $('openPrivateProfile')?.addEventListener('click',()=>{
    if(!selectedId||!privateStore?.available())return;
    clearPrivate();
    const person=store.getTeam().find(p=>p.id===selectedId);
    $('privateEmployeeName').textContent=person?.name||'Mitarbeiter';
    status.textContent=privateStore.exists(selectedId)
      ? 'Passphrase eingeben, um die verschlüsselten Angaben zu öffnen.'
      : 'Noch keine private Akte. Lege eine Passphrase fest, um Angaben verschlüsselt zu speichern.';
    dialog.showModal();pass.focus();
  });
  $('closePrivateDialog')?.addEventListener('click',closePrivate);
  $('cancelPrivateDialog')?.addEventListener('click',closePrivate);
  dialog?.addEventListener('close',clearPrivate);
  async function unlock(){
    if(busy||!selectedId||!privateStore)return;
    if(pass.value.length<12){status.textContent='Bitte eine Passphrase mit mindestens 12 Zeichen eingeben.';return;}
    busy=true;$('unlockPrivate').disabled=true;
    try{
      const data=await privateStore.read(selectedId,pass.value);
      $('privateAddress').value=data?.address||'';
      $('privateIban').value=data?.iban||'';
      $('privateNationality').value=data?.nationality||'';
      $('privateResidence').value=data?.residenceStatus||'';
      $('privateResidenceUntil').value=data?.residenceUntil||'';
      fields.hidden=false;unlocked=true;
      status.textContent=data?'Verschlüsselte Angaben geöffnet. Änderungen werden erst mit „Verschlüsselt speichern“ übernommen.':'Neue private Akte. Angaben eingeben und verschlüsselt speichern.';
    }catch(e){status.textContent=e.message;fields.hidden=true;unlocked=false;}
    finally{busy=false;$('unlockPrivate').disabled=false;}
  }
  $('unlockPrivate')?.addEventListener('click',unlock);
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!unlocked||!selectedId)return;
    busy=true;$('savePrivateDetails').disabled=true;
    try{
      const details={
        address:$('privateAddress').value,iban:$('privateIban').value,
        nationality:$('privateNationality').value,residenceStatus:$('privateResidence').value,
        residenceUntil:$('privateResidenceUntil').value
      };
      await privateStore.save(selectedId,pass.value,details);
      closePrivate();showPrivateState();
      const mainStatus=$('staffStatus');
      if(mainStatus)mainStatus.textContent='Vertrauliche Angaben verschlüsselt gespeichert – nur auf diesem Gerät.';
    }catch(e){status.textContent=e.message;}
    finally{busy=false;$('savePrivateDetails').disabled=false;}
  });
  renderRoles();showPrivateState();
});