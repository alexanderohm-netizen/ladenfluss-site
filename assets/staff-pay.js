/* Per-employee gross hourly wage editor.
 * Hidden unless encrypted vault is unlocked with a user-held passphrase.
 * Financial estimates are not tax/payroll calculations. */
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const api=window.LadenflussPayVault;
  const costs=window.LadenflussStaffCosts,teamStore=window.LadenflussTeamStore;
  const $=id=>document.getElementById(id);
  if(!api||!$('staffPaySection'))return;
  const access=$('staffPayAccessForm'),wageForm=$('staffPayWageForm'),
    secret=$('staffVaultPass'),confirm=$('staffVaultConfirm');
  const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
  let employee=null,busy=false,pendingImport=null;
  const budgetForm=$('staffBudgetForm'),restoreForm=$('staffPayRestoreForm');
  const budgetProgress=$('staffBudgetProgressArea');
  function loadTeam(){
    const raw=localStorage.getItem('ladenfluss.team.v1');
    if(raw!==null){
      let parsed;
      try{parsed=JSON.parse(raw);}catch{throw new Error('Teamdaten sind beschädigt. Kostenplanung gesperrt.');}
      if(!Array.isArray(parsed))throw new Error('Teamdaten sind nicht lesbar.');
    }
    return teamStore.getTeam();
  }
  function renderBudget(){
    const active=api.isUnlocked()&&Boolean(employee);
    if(!active)return;
    const options=api.getPlanning();
    $('staffOverhead').value=String(options.overheadPct);
    $('staffMonthlyBudget').value=options.monthlyBudget===null?'':String(options.monthlyBudget);
    try{
      const team=loadTeam(),week=teamStore.mondayKey(new Date()),shifts=teamStore.getShifts(week);
      const summary=costs.summarize({
        team,shifts,rates:api.getAllRates(),planning:options,
        shiftHours:window.LadenflussPlanning.shiftHours
      });
      const covered=summary.priced+' von '+summary.totalEmployees;
      $('staffTeamGrossMonth').textContent=summary.priced?money(summary.monthlyGross):'–';
      $('staffTeamEmployerMonth').textContent=summary.priced?money(summary.monthlyEmployer):'–';
      $('staffTeamPlannedCost').textContent=summary.priced?money(summary.plannedEmployer):'–';
      const diff=summary.budgetDifference;
      $('staffTeamBudgetDiff').textContent=diff===null?'–':(diff>=0?'Restbudget '+money(diff):'Über Budget '+money(-diff));
      $('staffTeamBudgetDiff').classList.toggle('staff-cost-alert',summary.budgetExceeded);
      const coverage=$('staffBudgetCoverage');
      if(!summary.complete){
        coverage.textContent='Unvollständig: '+covered+' Mitarbeitenden mit hinterlegtem Brutto-Stundenlohn. Die angezeigten Kosten sind Teilsummen – ein Budgetvergleich ist noch nicht möglich.';
        coverage.classList.add('staff-cost-incomplete');
      }else if(summary.budget===null){
        coverage.textContent='Alle '+covered+' Stundenlöhne vorhanden. Für einen Vergleich noch ein Monatsbudget hinterlegen.';
        coverage.classList.remove('staff-cost-incomplete');
      }else{
        coverage.textContent=summary.budgetExceeded
          ?'Budgetwarnung: Die kalkulierten Monatskosten überschreiten den eingegebenen Rahmen.'
          :'Monatsbudget nach den hinterlegten Sollstunden eingehalten.';
        coverage.classList.toggle('staff-cost-incomplete',summary.budgetExceeded);
      }
      if(summary.invalidShiftCount>0){
        coverage.textContent+=' '+summary.invalidShiftCount+' ungültige PEP-Schicht(en) wurden für die Wochenplanung nicht berechnet.';
      }
      budgetProgress.hidden=diff===null||summary.budget===0;
      if(!budgetProgress.hidden){
        const ratio=summary.monthlyEmployer/summary.budget*100;
        $('staffBudgetPercent').textContent=ratio.toLocaleString('de-DE',{maximumFractionDigits:1})+' %';
        $('staffBudgetProgress').value=Math.min(100,ratio);
      }
    }catch(err){
      $('staffTeamGrossMonth').textContent='–';
      $('staffTeamEmployerMonth').textContent='–';
      $('staffTeamPlannedCost').textContent='–';
      $('staffTeamBudgetDiff').textContent='–';
      $('staffBudgetCoverage').textContent=err.message;
      $('staffBudgetCoverage').classList.add('staff-cost-incomplete');
      budgetProgress.hidden=true;
    }
  }
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
    pendingImport=null;resetImport();
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
    renderBudget();
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
    if(!Number.isFinite(rate)||rate<0||rate>250||Math.abs(Math.round(rate*100)-rate*100)>1e-6){
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
  budgetForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!api.isUnlocked()||!budgetForm.reportValidity())return;
    const overhead=Number($('staffOverhead').value);
    const rawBudget=$('staffMonthlyBudget').value.trim();
    const monthlyBudget=rawBudget===''?null:Number(rawBudget);
    if(!Number.isFinite(overhead)||overhead<0||overhead>100||
       Math.abs(Math.round(overhead*100)-overhead*100)>1e-6||
       (monthlyBudget!==null&&(!Number.isFinite(monthlyBudget)||monthlyBudget<0||
        monthlyBudget>10000000||Math.abs(Math.round(monthlyBudget*100)-monthlyBudget*100)>1e-6))){
      status('Bitte Arbeitgeber-Aufschlag und Monatsbudget prüfen.',true);return;
    }
    busy=true;const submit=budgetForm.querySelector('button[type=submit]');
    submit.disabled=true;
    try{
      await api.setPlanning({overheadPct:overhead,monthlyBudget});
      status('Kostenrahmen verschlüsselt im Tresor gespeichert.');
      renderBudget();
    }catch(e){status(e.message,true);refresh();}
    finally{busy=false;submit.disabled=false;}
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
  function importStatus(message,problem=false){
    const p=$('staffRestoreMessage');p.textContent=message;
    p.classList.toggle('staff-pay-failure',problem);
  }
  function resetImport(){
    pendingImport=null;
    $('staffRestorePreview').hidden=true;
    $('staffRestoreConsent').checked=false;
    $('staffRestorePass').value='';
    $('staffRestoreFile').value='';
    importStatus('');
  }
  // A preview is only valid for the exact file and passphrase that were checked.
  // Changing either input cannot leave an old approval attached to a new file.
  function invalidatePreview(){
    pendingImport=null;
    $('staffRestorePreview').hidden=true;
    $('staffRestoreConsent').checked=false;
    importStatus('Eingaben geändert. Bitte die Sicherungsdatei erneut prüfen.');
  }
  $('staffRestoreFile').addEventListener('change',invalidatePreview);
  $('staffRestorePass').addEventListener('input',invalidatePreview);
  restoreForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!restoreForm.reportValidity()||!api.supported())return;
    const file=$('staffRestoreFile').files?.[0];
    if(!file||file.size>300000){
      importStatus('Bitte eine gültige verschlüsselte JSON-Datei bis 300 KB wählen.',true);return;
    }
    pendingImport=null;
    $('staffRestorePreview').hidden=true;
    const checkedPassword=$('staffRestorePass').value;
    busy=true;$('staffRestoreCheck').disabled=true;
    importStatus('Die verschlüsselte Sicherung wird geprüft …');
    try{
      const raw=await file.text();
      const preview=await api.previewImport(raw,checkedPassword);
      if($('staffRestoreFile').files?.[0]!==file||
        $('staffRestorePass').value!==checkedPassword)
        throw new Error('Die Datei oder Passphrase wurde während der Prüfung geändert. Bitte erneut prüfen.');
      pendingImport=raw;
      const hasVault=api.exists();
      $('staffRestoreDescription').textContent=preview.employeeCount+
        ' gesicherte Stundenlohn-Einträge erkannt. '+(hasVault
          ?'ACHTUNG: Der bestehende Tresor wird beim Import vollständig ersetzt. Zuerst den aktuellen Tresor entsperren und exportieren.'
          :'Beim Import wird ein neuer Tresor auf diesem Gerät eingerichtet.')+
        (preview.hasSettings?' Die Sicherung enthält auch Arbeitgeberkosten-Einstellungen.':'');
      $('staffRestorePreview').hidden=false;
      importStatus('Datei entschlüsselt und auf Gültigkeit geprüft. Noch wurden keine Daten verändert.');
    }catch(err){
      pendingImport=null;
      importStatus(err.message,true);
    }finally{busy=false;$('staffRestoreCheck').disabled=false;}
  });
  $('staffRestoreCancel').addEventListener('click',resetImport);
  $('staffRestoreApply').addEventListener('click',async()=>{
    if(busy||pendingImport===null)return;
    if(!$('staffRestoreConsent').checked){
      importStatus('Bitte zuerst die ausdrückliche Ersetzungs-Bestätigung ankreuzen.',true);return;
    }
    if(api.exists()&&!api.isUnlocked()){
      importStatus('Bitte den aktuellen Tresor erst entsperren und eine Sicherung herunterladen.',true);return;
    }
    if(!window.confirm('Bist du sicher? Alle bisherigen Stundenlöhne und Kostenrahmen werden durch die Importdatei ersetzt.')){
      return;
    }
    busy=true;$('staffRestoreApply').disabled=true;
    try{
      const result=await api.importEncrypted(pendingImport,$('staffRestorePass').value,
        {replaceExisting:api.exists()});
      lockUI();
      importStatus(result.employeeCount+' Einträge importiert. Tresor gesperrt: bitte mit der Passphrase der Sicherungsdatei erneut entsperren.');
    }catch(err){importStatus(err.message,true);}
    finally{
      busy=false;
      $('staffRestoreApply').disabled=false;
      // A successful import called lockUI() while busy=true, so the
      // passphrase form must be enabled after the import finishes.
      renderAccess();
    }
  });
  window.addEventListener('storage',event=>{
    if(event.key!==api.key&&event.key!==null)return;
    lockUI('Vergütungsdaten wurden in einem anderen Tab geändert. Bitte erneut entsperren.');
  });
  window.addEventListener('pagehide',()=>{
    api.lock();
    resetImport();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&api.isUnlocked()){
      lockUI('Tresor automatisch gesperrt, weil du das Fenster verlassen hast.');
    }
  });
  renderAccess();
});