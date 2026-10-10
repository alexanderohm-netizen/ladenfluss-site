/* Ladenfluss manual Cloud-Beta sync for the store profile only.
 * No automatic upload or import. This module is inert when Cloud Beta is disabled.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (window.__ladenflussCloudProfileInitialized) return;
  window.__ladenflussCloudProfileInitialized = true;

  const node = id => document.getElementById(id);
  const status = node('cloudProfileStatus');
  const comparison = node('cloudProfileDiff');
  const check = node('cloudProfileCheck');
  const upload = node('cloudProfileUpload');
  const download = node('cloudProfileDownload');
  const restore = node('cloudProfileRestore');
  const recoverDraft = node('cloudProfileRecoverDraft');
  const settings = window.LadenflussStoreSettings;
  if (!status || !check || !upload || !download || !settings) return;

  let sync = null, company = null, user = null, busy = false;
  let remoteProfile = null;
  let client = null;
  let staleDraftInOtherTab = false;
  const BACKUP_PREFIX = 'ladenfluss.cloud.profile-backup.v2.';
  function backupKey() { return BACKUP_PREFIX + user.id.toLowerCase() + '.' + company.id.toLowerCase(); }
  async function verifyCurrentUser() {
    if (!user || !client) return false;
    try {
      const auth = window.LadenflussAuthCore.createAuthCore(client,{origin:window.location.origin});
      const verified = await auth.validatedUser();
      if (verified?.id === user.id) return true;
    } catch (_) { /* Authentication unavailable: fail closed. */ }
    sync = null;
    company = null;
    user = null;
    remoteProfile = null;
    controls({checkVisible:false});
    setStatus('Die Anmeldung hat sich geändert oder ist abgelaufen. Melde dich erneut an; lokale Daten bleiben unverändert.');
    return false;
  }
  const setStatus = text => { status.textContent = text; };
  function controls({checkVisible=true,uploadVisible=false,downloadVisible=false}={}) {
    check.hidden = !checkVisible;
    upload.hidden = !uploadVisible;
    download.hidden = !downloadVisible;
    if (recoverDraft) recoverDraft.hidden = !(sync && !!sync.state().draft);
    for (const button of [check, upload, download, restore, recoverDraft]) if (button) button.disabled = busy;
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    controls({checkVisible:!check.hidden,uploadVisible:!upload.hidden,downloadVisible:!download.hidden});
    try { await task(); }
    finally {
      busy = false;
      for (const button of [check,upload,download,restore,recoverDraft]) if (button) button.disabled = false;
    }
  }
  function localProfile() { return settings.read(); }
  function same(left,right) { return JSON.stringify(left) === JSON.stringify(right); }
  const PROFILE_FIELDS = Object.freeze([
    ['name','Ladenname'],['type','Sortiment'],['days','Öffnungstage/Woche'],
    ['open','Öffnet'],['close','Schließt'],['minStaff','Mindestbesetzung'],
    ['state','Bundesland'],['productivity','Ziel-Stundenleistung'],
    ['labor','Personalkostenquote'],['margin','Handelsspanne'],
    ['lead','Lieferzeit'],['buffer','Planungspuffer'],['hourly','Personalkosten/Stunde'],
  ]);
  function displayValue(value) {
    if (value === null || value === undefined || value === '') return '–';
    return String(value).slice(0,140);
  }
  function clearComparison() {
    if (comparison) {
      comparison.hidden = true;
      comparison.replaceChildren();
    }
  }
  function displayDifferences(local,cloud,revision) {
    if (!comparison) return;
    clearComparison();
    const rows=PROFILE_FIELDS.filter(([key])=>!same(local[key],cloud[key]));
    if (!rows.length) return;
    const header=document.createElement('h4');
    header.textContent='Profilvergleich · Cloud-Version '+revision;
    const summary=document.createElement('p');
    summary.textContent=rows.length+' abweichende '+(rows.length===1?'Angabe':'Angaben')+
      '. Vergleiche beide Fassungen, bevor du Daten übernimmst oder hochlädst.';
    const table=document.createElement('table');
    const thead=document.createElement('thead');
    const tr=document.createElement('tr');
    for(const label of ['Angabe','Auf diesem Gerät','In der Cloud']){
      const th=document.createElement('th');th.textContent=label;tr.append(th);
    }
    thead.append(tr);table.append(thead);
    const tbody=document.createElement('tbody');
    for(const [key,label] of rows){
      const line=document.createElement('tr');
      for(const value of [label,displayValue(local[key]),displayValue(cloud[key])]){
        const cell=document.createElement('td');cell.textContent=value;line.append(cell);
      }
      tbody.append(line);
    }
    table.append(tbody);
    comparison.append(header,summary,table);
    comparison.hidden=false;
  }
  function displayComparison(state) {
    remoteProfile = null;
    clearComparison();
    let local;
    try { local=localProfile(); }
    catch (_) {
      controls();
      setStatus('Deine lokalen Profildaten sind beschädigt. Sichere zuerst deine Daten; es wurde nichts überschrieben.');
      return;
    }
    if (state.remote) {
      try { remoteProfile=settings.validate(state.remote.payload); }
      catch (_) {
        controls();
        setStatus('Das Cloud-Profil ist nicht lesbar. Es wurde nichts überschrieben.');
        return;
      }
    }
    if (remoteProfile) displayDifferences(local,remoteProfile,state.remote.revision);
    if (state.status === 'conflict') {
      controls({uploadVisible:true,downloadVisible:!!remoteProfile});
      setStatus('Änderungskonflikt erkannt: In Cloud und Browser liegen unterschiedliche Fassungen. Entscheide ausdrücklich, welche Version übernommen wird.');
    } else if (!remoteProfile) {
      controls({uploadVisible:true});
      setStatus('Für "'+company.name+'" liegt noch kein Ladenprofil in der Cloud. Du kannst dein lokales Profil bewusst hochladen.');
    } else if (same(local,remoteProfile) && !state.hasUnsavedChanges) {
      controls();
      setStatus('Dein lokales Ladenprofil entspricht der Cloud-Version '+state.remote.revision+'. Keine Übertragung nötig.');
    } else {
      controls({uploadVisible:true,downloadVisible:true});
      setStatus('Ladenprofil und Cloud-Version '+state.remote.revision+' unterscheiden sich. Ein Abgleich findet nur nach deiner ausdrücklichen Bestätigung statt.');
    }
  }

  async function inspect() {
    await run(async () => {
      if (!client || !company || !await verifyCurrentUser()) return;
      setStatus('Die aktuelle Cloud-Version wird gelesen. Lokale Daten bleiben unverändert.');
      try {
        sync = window.LadenflussCloudSync.createCloudSync({
          transport:window.LadenflussCloudSync.createSupabaseTransport(client),
          storage:window.localStorage,
          userId:user.id,
          companyId:company.id,
          moduleKey:'profile',
        });
        const result=await sync.load();
        staleDraftInOtherTab = false;
        displayComparison(result);
      } catch (_) {
        controls();
        setStatus('Die Cloud ist gerade nicht erreichbar oder deine lokalen Entwürfe sind nicht lesbar. Deine Daten wurden nicht verändert.');
      }
    });
  }

  window.addEventListener('storage', event => {
    // Another tab in the same browser changed this account's pending cloud draft.
    // Disable stale actions, retain both copies, require a fresh manual check.
    if (sync && event.key === sync.draftKey) {
      staleDraftInOtherTab = true;
      controls({checkVisible:true,uploadVisible:false,downloadVisible:false});
      clearComparison();
      setStatus('Eine andere Ladenfluss-Registerkarte hat den ungespeicherten Cloud-Entwurf verändert. Bitte „Cloud-Profil prüfen“ wählen. Es wurde nichts automatisch überschrieben.');
    }
  });

  check.addEventListener('click', () => {void inspect();});

  upload.addEventListener('click', () => {void run(async () => {
    if (!sync || !company || !await verifyCurrentUser()) return;
    if (staleDraftInOtherTab) {
      setStatus('Der Cloud-Entwurf wurde in einer anderen Registerkarte geändert. Bitte erst neu prüfen.');
      return;
    }
    let current;
    try { current=localProfile(); }
    catch (_) { setStatus('Das Ladenprofil konnte nicht gelesen werden. Keine Daten übertragen.');return; }
    const persisted = sync.state().draft;
    if (persisted && JSON.stringify(persisted.payload) !== JSON.stringify(current)) {
      controls({uploadVisible:false,downloadVisible:!!remoteProfile});
      setStatus('Ein noch nicht übertragener Cloud-Entwurf unterscheidet sich von deinem Ladenprofil. Er wurde NICHT überschrieben. Nutze „Gespeicherten Entwurf lokal übernehmen“ oder überprüfe ihn zuerst.');
      return;
    }
    if (!window.confirm('Lokales Profil "'+(current.name||'Mein Laden')+
      '" in die Cloud von "'+company.name+'" übertragen? Die dortige Version wird geändert.')) return;
    try {
      if (sync.state().status === 'conflict') sync.resolveConflict('keep-local');
      sync.edit(current);
      const result=await sync.save();
      displayComparison(result);
      setStatus('Ladenprofil erfolgreich in der Cloud gespeichert (Version '+result.remote.revision+').');
    } catch (error) {
      if (error?.code === 'DRAFT_CHANGED_EXTERNALLY') {
        staleDraftInOtherTab = true;
        controls({checkVisible:true,uploadVisible:false,downloadVisible:false});
        setStatus('Eine andere Registerkarte hat deinen Cloud-Entwurf verändert. Falls bereits ein Cloud-Schreibvorgang erfolgreich war, bleibt die neue Version bestehen. Bitte neu prüfen; der fremde Entwurf wurde nicht gelöscht.');
      } else if (error?.code === '40001' || error?.code === '23505' ||
          sync.state().status === 'conflict') {
        displayComparison(sync.state());
        setStatus('Speicherkonflikt: Eine andere Version liegt in der Cloud. Deine lokale Änderung bleibt erhalten; bitte den Abgleich erneut prüfen.');
      } else {
        setStatus('Cloud-Speicherung fehlgeschlagen. Deine lokalen Daten und ein vorhandener Entwurf bleiben erhalten.');
      }
    }
  });});

  download.addEventListener('click', () => {void run(async () => {
    if (!sync || !company || !remoteProfile || !await verifyCurrentUser() || staleDraftInOtherTab) return;
    if (!window.confirm('Cloud-Profil von "'+company.name+
      '" lokal übernehmen? Zuvor wird eine Kopie des bisherigen Profils in diesem Browser angelegt.')) return;
    try {
      const previous=localProfile();
      const current=sync.state();
      // Never import a stale cloud revision when someone else edited it after inspection.
      const latest=await window.LadenflussCloudSync.createSupabaseTransport(client)
        .read({companyId:company.id,moduleKey:'profile'});
      if (!latest || !current.remote || latest.revision !== current.remote.revision) {
        controls();
        setStatus('Die Cloud-Version hat sich seit der Prüfung geändert. Bitte zunächst den Cloud-Abgleich erneut starten.');
        return;
      }
      const draft=current.draft && current.draft.payload;
      if (draft && !same(draft,previous)) {
        setStatus('Ein gespeicherter Cloud-Entwurf weicht vom aktuellen lokalen Profil ab. Bitte löse diesen Konflikt zuerst, um keine Änderungen zu verlieren.');
        return;
      }
      const key=backupKey();
      if (window.localStorage.getItem(key) !== null &&
          !window.confirm('Eine frühere lokale Sicherheitskopie ist vorhanden. Soll sie durch die aktuelle Fassung ersetzt werden?')) {
        setStatus('Die frühere Sicherheitskopie bleibt erhalten. Die Cloud wurde nicht übernommen.');
        return;
      }
      const backup={at:new Date().toISOString(),payload:previous};
      window.localStorage.setItem(key,JSON.stringify(backup));
      settings.save(remoteProfile);
      try {
        sync.discardDraft();
      } catch (error) {
        // A second tab can change the draft between the backup and import.
        // Undo the local import instead of leaving a half-committed UI state.
        try { settings.save(previous); } catch (_) { /* Safety backup remains available. */ }
        throw error;
      }
      if (restore) restore.hidden = false;
      controls();
      setStatus('Cloud-Profil lokal übernommen. Das vorherige Ladenprofil wurde als Sicherheitskopie gesichert.');
      window.dispatchEvent(new Event('ladenfluss:profile-updated'));
    } catch (error) {
      if (error?.code === 'DRAFT_CHANGED_EXTERNALLY') {
        staleDraftInOtherTab = true;
        controls({checkVisible:true,uploadVisible:false,downloadVisible:false});
        setStatus('Eine andere Registerkarte hat während der Übernahme den Cloud-Entwurf verändert. Die lokalen Werte wurden soweit möglich wiederhergestellt; die Sicherheitskopie bleibt erhalten. Bitte neu prüfen.');
      } else {
        setStatus('Übernahme nicht abgeschlossen. Prüfe deinen Browserspeicher; die Cloud-Version wurde nicht geändert.');
      }
    }
  });});

  restore?.addEventListener('click', () => {void run(async () => {
    if (!company || !await verifyCurrentUser()) return;
    const key=backupKey();
    try {
      const raw=window.localStorage.getItem(key);
      if (!raw) return;
      const backup=JSON.parse(raw);
      const restored=settings.validate(backup.payload);
      if (!window.confirm('Lokales Ladenprofil aus der Sicherheitskopie wiederherstellen? Die Cloud bleibt unverändert.')) return;
      settings.save(restored);
      window.localStorage.removeItem(key);
      restore.hidden = true;
      setStatus('Vorheriges lokales Ladenprofil wiederhergestellt. Die Cloud-Version blieb unverändert.');
      window.dispatchEvent(new Event('ladenfluss:profile-updated'));
    } catch (_) {
      setStatus('Die Sicherheitskopie konnte nicht gelesen werden. Sie wurde nicht gelöscht.');
    }
  });});

  recoverDraft?.addEventListener('click', () => {void run(async () => {
    if (!sync || !company || !await verifyCurrentUser() || staleDraftInOtherTab) return;
    const draft=sync.state().draft;
    if (!draft) return;
    let validated;
    try { validated=settings.validate(draft.payload); }
    catch (_) { setStatus('Der gespeicherte Entwurf ist ungültig. Er wurde nicht überschrieben.'); return; }
    if (!window.confirm('Gespeicherten Cloud-Entwurf lokal übernehmen? Zuvor wird das bestehende Profil gesichert. Es erfolgt kein Cloud-Upload.')) return;
    try {
      const current=localProfile();
      const key=backupKey();
      if (window.localStorage.getItem(key)!==null &&
          !window.confirm('Vorhandene lokale Sicherheitskopie mit dem aktuellen Profil ersetzen?')) {
        setStatus('Die vorhandene Sicherheitskopie bleibt unverändert.');
        return;
      }
      window.localStorage.setItem(key,JSON.stringify({at:new Date().toISOString(),payload:current}));
      settings.save(validated);
      if (restore) restore.hidden=false;
      setStatus('Gespeicherter Cloud-Entwurf lokal übernommen. Prüfe die Werte und bestätige den Cloud-Upload separat.');
      window.dispatchEvent(new Event('ladenfluss:profile-updated'));
      controls({uploadVisible:true,downloadVisible:!!remoteProfile});
    } catch (_) {
      setStatus('Entwurf konnte nicht lokal übernommen werden. Die Cloud wurde nicht verändert.');
    }
  });});
  
  async function initialize() {
    try {
      if (!window.LadenflussSupabase?.isEnabled()) {
        setStatus('Cloud-Beta noch nicht aktiv. Dein Ladenprofil bleibt ausschließlich auf diesem Gerät.');
        return;
      }
      client=await window.LadenflussSupabase.getClient();
      const auth=window.LadenflussAuthCore.createAuthCore(client,{origin:window.location.origin});
      const verifiedUser=await auth.validatedUser();
      if (!verifiedUser) {
        setStatus('Für den Cloud-Abgleich bitte mit einer bestätigten E-Mail-Adresse anmelden.');
        return;
      }
      user=verifiedUser;
      company=await auth.firstCompany();
      if (!company) {
        setStatus('Für den Cloud-Abgleich muss zuerst dein Unternehmen eingerichtet sein.');
        return;
      }
      if (restore && window.localStorage.getItem(backupKey())) restore.hidden=false;
      controls();
      setStatus('Angemeldet für "'+company.name+'". Klicke auf "Cloud-Profil prüfen", um den manuellen Abgleich zu starten.');
    } catch (_) {
      setStatus('Cloud-Zugang zurzeit nicht verfügbar. Dein lokales Ladenprofil bleibt erhalten.');
    }
  }
  void initialize();
});