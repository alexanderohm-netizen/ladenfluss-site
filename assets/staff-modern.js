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
  let selectedId=null,unlocked=false,busy=false,revealed=null;
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
    for(const p of team){if(!p||typeof p!=='object')return;const role=String(p.role||'Unbekannt').trim();counts.set(role,(counts.get(role)||0)+1);}
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

  function formatDate(value){
    if(!value||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return 'Nicht hinterlegt';
    const d=new Date(value+'T12:00:00');
    return Number.isNaN(d.getTime())?'Nicht hinterlegt':new Intl.DateTimeFormat('de-DE').format(d);
  }
  function tenure(value){
    if(!value||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return 'Noch nicht hinterlegt';
    const start=new Date(value+'T12:00:00'),now=new Date();
    if(Number.isNaN(start.getTime())||start>now)return 'Noch nicht begonnen';
    let years=now.getFullYear()-start.getFullYear(),months=now.getMonth()-start.getMonth();
    if(now.getDate()<start.getDate())months--;
    if(months<0){years--;months+=12;}
    return years>0?years+' '+(years===1?'Jahr':'Jahre')+(months?', '+months+' Mon.':''):months>0?months+' Monate':'Unter 1 Monat';
  }
  function detailCard(icon,title,rows,protectedCard){
    const card=element('section','lf-detail-card'+(protectedCard?' lf-detail-protected':''));
    const head=element('div','lf-detail-card-head');
    head.append(element('span','lf-detail-card-icon',icon),element('h3','',title));
    if(protectedCard)head.append(element('span','lf-detail-lock',revealed?'ENTSPERRT':'GESCHÜTZT'));
    card.append(head);
    const list=element('dl','lf-detail-facts');
    for(const [label,value] of rows){
      const wrap=element('div','lf-detail-fact');
      wrap.append(element('dt','',label),element('dd','',value||'Nicht hinterlegt'));
      list.append(wrap);
    }
    card.append(list);return card;
  }
  function renderDetails(){
    const target=$('staffDetailSections');
    if(!target||!store)return;
    target.replaceChildren();
    if(!selectedId)return;
    let p;
    try{p=store.getTeam().find(person=>person?.id===selectedId);}catch(_){return;}
    if(!p)return;
    const locked='Zum Anzeigen entsperren';
    const v=revealed;
    target.append(
      detailCard('◈','Beschäftigung',[
        ['Position / Tätigkeit',p.role||'Nicht hinterlegt'],
        ['Eintrittsdatum',formatDate(p.startDate)],
        ['Im Unternehmen seit',tenure(p.startDate)],
        ['Filiale / Einsatzort',p.branch||'Nicht hinterlegt'],
        ['Vertragsstunden',String(p.hours||0).replace('.',',')+' h / Woche']
      ],false),
      detailCard('✉','Kontakt & Anschrift',[
        ['E-Mail',v?(v.email||'Nicht hinterlegt'):locked],
        ['Telefon',v?(v.phone||'Nicht hinterlegt'):locked],
        ['Anschrift',v?(v.address||'Nicht hinterlegt'):locked]
      ],true),
      detailCard('▣','Bankverbindung',[
        ['IBAN',v?(v.iban?('•••• •••• •••• '+v.iban.slice(-4)):'Nicht hinterlegt'):locked],
        ['Speicherung','Lokal · verschlüsselt']
      ],true),
      detailCard('◇','Persönliche Angaben',[
        ['Staatsangehörigkeit',v?(v.nationality||'Nicht hinterlegt'):locked],
        ['Aufenthalts-/Arbeitserlaubnis',v?(v.residenceStatus||'Nicht hinterlegt'):locked],
        ['Gültig bis',v?formatDate(v.residenceUntil):locked]
      ],true)
    );
  }
  function showPrivateState(){
    const badge=$('staffPrivateState'),button=$('openPrivateProfile');
    if(!badge||!button)return;
    if(!selectedId){badge.textContent='Nicht ausgewählt';button.disabled=true;return;}
    button.disabled=!privateStore?.available();
    button.textContent=revealed?'Angaben ausblenden':'Vertrauliche Angaben öffnen →';
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
    if(id!==selectedId){closePrivate();revealed=null;selectedId=id;}
    showPrivateState();renderRoles();renderDetails();
  });
  window.addEventListener('storage',event=>{
    if(event.key==='ladenfluss.team.v1'){renderRoles();showPrivateState();renderDetails();}
    if(event.key?.startsWith(privateStore?.PREFIX||'__never__')){revealed=null;showPrivateState();renderDetails();}
  });
  $('openPrivateProfile')?.addEventListener('click',()=>{
    if(!selectedId||!privateStore?.available())return;
    if(revealed){revealed=null;showPrivateState();renderDetails();return;}
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
      $('privateEmail').value=data?.email||'';
      $('privatePhone').value=data?.phone||'';
      $('privateAddress').value=data?.address||'';
      $('privateIban').value=data?.iban||'';
      $('privateNationality').value=data?.nationality||'';
      $('privateResidence').value=data?.residenceStatus||'';
      $('privateResidenceUntil').value=data?.residenceUntil||'';
      fields.hidden=false;unlocked=true;
      revealed=data||null;renderDetails();showPrivateState();
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
        email:$('privateEmail').value,phone:$('privatePhone').value,
        address:$('privateAddress').value,iban:$('privateIban').value,
        nationality:$('privateNationality').value,residenceStatus:$('privateResidence').value,
        residenceUntil:$('privateResidenceUntil').value
      };
      await privateStore.save(selectedId,pass.value,details);
      closePrivate();revealed=null;showPrivateState();renderDetails();
      const mainStatus=$('staffStatus');
      if(mainStatus)mainStatus.textContent='Vertrauliche Angaben verschlüsselt gespeichert – nur auf diesem Gerät.';
    }catch(e){status.textContent=e.message;}
    finally{busy=false;$('savePrivateDetails').disabled=false;}
  });
  renderRoles();showPrivateState();renderDetails();
});