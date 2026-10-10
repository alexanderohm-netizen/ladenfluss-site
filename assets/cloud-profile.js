/* Ladenfluss manual Cloud-Beta sync for the store profile only.
 * No automatic upload or import. This module is inert when Cloud Beta is disabled.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (window.__ladenflussCloudProfileInitialized) return;
  window.__ladenflussCloudProfileInitialized = true;

  const node = id => document.getElementById(id);
  const status = node('cloudProfileStatus');
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
  function displayComparison(state) {
    remoteProfile = null;
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
        displayComparison(result);
      } catch (_) {
        controls();
        setStatus('Die Cloud ist gerade nicht erreichbar oder deine lokalen Entwürfe sind nicht lesbar. Deine Daten wurden nicht verändert.');
      }
    });
  }

  check.addEventListener('click', () => {void inspect();});

  upload.addEventListener('click', () => {void run(async () => {
    if (!sync || !company || !await verifyCurrentUser()) return;
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
      if (error?.code === '40001' || error?.code === '23505' ||
          sync.state().status === 'conflict') {
        displayComparison(sync.state());
        setStatus('Speicherkonflikt: Eine andere Version liegt in der Cloud. Deine lokale Änderung bleibt erhalten; bitte den Abgleich erneut prüfen.');
      } else {
        setStatus('Cloud-Speicherung fehlgeschlagen. Deine lokalen Daten und ein vorhandener Entwurf bleiben erhalten.');
      }
    }
  });});

  download.addEventListener('click', () => {void run(async () => {
    if (!sync || !company || !remoteProfile || !await verifyCurrentUser()) return;
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
      sync.discardDraft();
      if (restore) restore.hidden = false;
      controls();
      setStatus('Cloud-Profil lokal übernommen. Das vorherige Ladenprofil wurde als Sicherheitskopie gesichert.');
      window.dispatchEvent(new Event('ladenfluss:profile-updated'));
    } catch (_) {
      setStatus('Übernahme nicht abgeschlossen. Prüfe deinen Browserspeicher; die Cloud-Version wurde nicht geändert.');
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
    if (!sync || !company || !await verifyCurrentUser()) return;
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