/* Per-employee gross hourly wage editor.
 * Hidden unless encrypted vault is unlocked with a user-held passphrase.
 * Financial estimates are not tax/payroll calculations. */
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const api=window.LadenflussPayVault;
  const $=id=>document.getElementById(id);
  if(!api||!$('staffPaySection'))return;
  const access=$('staffPayAccessForm'),wageForm=$('staffPayWageForm'),
    secret=$('staffVaultPass'),confirm=$('staffVaultConfirm');
  const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
  let employee=null,busy=false;
  function status(msg,problem=false){
    const p=$('staffPayMessage');p.textContent=msg;
    p.classList.toggle('staff-pay-failure',problem);
  }
  function lockUI(msg=''){
    api.lock();
    $('staffPayUnlocked').hidden=true;
    wageForm.reset();
    secret.value='';confirm.value='';
    renderAccess();
    if(msg)status(msg);
  }
  function renderAccess(){
    if(!api.supported()){
      access.hidden=false;
      $('staffVaultAccessBtn').disabled=true;
      $('staffVaultConfirmRow').hidden=true;
      $('staffVaultAccessBtn').textContent='Sichere Verschlüsselung nicht verfügbar';
      status('Vergütungsdaten benötigen einen aktuellen Browser mit WebCrypto über HTTPS. Auf diesem Gerät nicht nutzbar.',true);
      return;
    }
    let stored=false;
    try{stored=api.exists();}
    catch(e){
      status(e.message,true);access.hidden=true;return;
    }
    access.hidden=api.isUnlocked();
    $('staffVaultConfirmRow').hidden=stored;
    confirm.required=!stored;
    $('staffVaultAccessBtn').disabled=busy;
    $('staffVaultAccessBtn').textContent=stored?'Tresor entsperren':'Verschlüsselten Tresor einrichten';
    $('staffPayExport').hidden=!stored;
  }
  function renderWage(){
    const ready=api.isUnlocked()&&employee;
    $('staffPayUnlocked').hidden=!ready;
    if(!ready)return;
    const rate=api.get(employee.id);
    $('staffPayRate').textContent=rate===null?'Nicht hinterlegt':money(rate)+' / h';
    $('staffPayTarget').textContent=rate===null?'–':money(rate*employee.hours);
    $('staffPayMonth').textContent=rate===null?'–':money(rate*employee.hours*52/12);
    $('staffPayPlanned').textContent=rate===null?'–':money(rate*employee.plannedHours);
    $('staffHourlyGross').value=rate===null?'':String(rate);
    $('staffPayRemove').disabled=rate===null;
  }
  function refresh(){
    renderAccess();
    renderWage();
  }
  window.addEventListener('ladenfluss:employee-selected',event=>{
    employee=event.detail||null;
    if(!employee){$('staffPayUnlocked').hidden=true;return;}
    refresh();
  });
  access.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!employee||!access.reportValidity()||!api.supported())return;
    const password=secret.value;
    let hasVault;
    try{hasVault=api.exists();}
    catch(e){status(e.message,true);return;}
    if(!hasVault&&password!==confirm.value){
      status('Die beiden Passphrasen stimmen nicht überein. Es wurde nichts gespeichert.',true);return;
    }
    busy=true;$('staffVaultAccessBtn').disabled=true;status('Tresor wird geprüft …');
    try{
      if(hasVault)await api.unlock(password);
      else await api.initialize(password);
      secret.value='';confirm.value='';
      status('Vergütungstresor entsperrt. Vergütungsdaten sind nur während dieser Sitzung sichtbar.');
      refresh();
    }catch(e){
      status(e.message,true);
      refresh();
    }finally{
      busy=false;$('staffVaultAccessBtn').disabled=false;
    }
  });
  wageForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!employee||!api.isUnlocked()||!wageForm.reportValidity())return;
    const raw=$('staffHourlyGross').value.trim();
    if(!raw){status('Für einen neuen Stundenlohn bitte einen Betrag eingeben. Zum Löschen „Betrag entfernen“ verwenden.',true);return;}
    const rate=Number(raw);
    if(!Number.isFinite(rate)||rate<0||rate>250||Math.round(rate*100)!==rate*100){
      status('Stundenlohn bitte mit maximal zwei Nachkommastellen zwischen 0 und 250 € eingeben.',true);return;
    }
    busy=true;wageForm.querySelector('button[type=submit]').disabled=true;
    // Freeze the selected person ID to avoid storing under a different profile
    // if another event fires while encryption is in progress.
    const targetId=employee.id;
    try{
      await api.set(targetId,rate);
      status('Brutto-Stundenlohn verschlüsselt gespeichert.');
      renderWage();
    }catch(e){
      status(e.message,true);refresh();
    }finally{
      busy=false;wageForm.querySelector('button[type=submit]').disabled=false;
    }
  });
  $('staffPayRemove').addEventListener('click',async()=>{
    if(busy||!employee||!api.isUnlocked())return;
    if(!window.confirm('Gespeicherten Stundenlohn dieser Person aus dem Tresor entfernen?'))return;
    const targetId=employee.id;
    busy=true;
    try{await api.set(targetId,null);status('Stundenlohn entfernt.');refresh();}
    catch(e){status(e.message,true);refresh();}
    finally{busy=false;}
  });
  $('staffPayLock').addEventListener('click',()=>lockUI('Tresor gesperrt. Vergütungsdaten sind wieder ausgeblendet.'));
  $('staffPayExport').addEventListener('click',()=>{
    try{
      const encrypted=api.exportEncrypted();
      if(!encrypted)throw new Error('Kein Tresor zum Sichern vorhanden.');
      const blob=new Blob([encrypted],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='ladenfluss-verguetung-verschluesselt.json';
      document.body.append(a);
      try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
      status('Verschlüsselte Datei heruntergeladen. Passphrase separat sicher aufbewahren.');
    }catch(e){status(e.message,true);}
  });
  window.addEventListener('storage',event=>{
    if(event.key!==api.key&&event.key!==null)return;
    lockUI('Vergütungsdaten wurden in einem anderen Tab geändert. Bitte erneut entsperren.');
  });
  window.addEventListener('pagehide',()=>api.lock());
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&api.isUnlocked()){
      lockUI('Tresor automatisch gesperrt, weil du das Fenster verlassen hast.');
    }
  });
  renderAccess();
});