document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (window.__ladenflussResetInitialized) return;
  window.__ladenflussResetInitialized = true;
  const form = document.getElementById('passwordResetForm');
  const status = document.getElementById('passwordResetStatus');
  const pass = document.getElementById('newPassword');
  const confirm = document.getElementById('confirmPassword');
  let core = null, busy = false, recoveryAuthorized = false;
  const api = window.LadenflussSupabase;

  const message = (heading, description) => {
    const title = document.createElement('strong'), text = document.createElement('span');
    title.textContent = heading;
    text.textContent = description;
    status.replaceChildren(title,text);
  };
  function lock() {
    recoveryAuthorized = false;
    if (form) form.hidden = true;
  }
  async function checkRecoveryLink() {
    // A regular login/session is NOT a password recovery grant.
    const expectedUserId = api?.getRecoveryUserId?.();
    if (!expectedUserId || !core) {
      lock();
      message('Wiederherstellungslink erforderlich','Öffne den Link aus deiner Passwort-Reset-E-Mail. Eine normale Anmeldung reicht hier nicht aus.');
      return;
    }
    try {
      const user = await core.validatedUser();
      if (!user || user.id !== expectedUserId || expectedUserId !== api.getRecoveryUserId()) {
        lock();
        message('Kein gültiger Reset-Link','Dieser Wiederherstellungslink konnte nicht bestätigt werden. Fordere über die Konto-Seite einen neuen Link an.');
        return;
      }
      recoveryAuthorized = true;
      form.hidden = false;
      message('Neues Passwort wählen','Dein Wiederherstellungslink wurde erkannt. Du kannst jetzt ein neues Passwort mit mindestens 12 Zeichen vergeben.');
    } catch (_) {
      lock();
      message('Zugang nicht verfügbar','Der Wiederherstellungslink konnte nicht bestätigt werden. Bitte versuche es erneut.');
    }
  }
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const expectedUserId = api?.getRecoveryUserId?.();
    if (!core || !recoveryAuthorized || !expectedUserId) {
      lock();
      message('Reset-Link erforderlich','Bitte öffne zuerst einen gültigen Wiederherstellungslink aus deiner E-Mail.');
      return;
    }
    if (!pass.value || pass.value.length < 12 || pass.value !== confirm.value) {
      message('Passwörter prüfen','Bitte ein Passwort mit mindestens 12 Zeichen wählen und identisch wiederholen.');
      return;
    }
    busy = true;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      // Re-check server verified identity immediately before modifying password.
      const user = await core.validatedUser();
      if (!user || user.id !== expectedUserId || expectedUserId !== api.getRecoveryUserId())
        throw new Error('Recovery session invalid or changed');
      await core.updatePassword(pass.value);
      api.clearRecovery?.();
      lock();
      message('Passwort geändert','Dein Passwort wurde aktualisiert. Melde dich jetzt mit dem neuen Passwort an.');
    } catch (_) {
      lock();
      message('Änderung fehlgeschlagen','Der Wiederherstellungslink könnte abgelaufen sein. Bitte fordere bei Bedarf einen neuen Link über die Anmeldung an.');
    } finally {
      pass.value = '';
      confirm.value = '';
      button.disabled = false;
      busy = false;
    }
  });

  async function initialize() {
    try {
      if (!api?.isEnabled()) {
        lock();
        message('Cloud-Beta in Vorbereitung','Die Passwort-Wiederherstellung ist noch nicht für Kunden freigeschaltet.');
        return;
      }
      const client = await api.getClient();
      core = window.LadenflussAuthCore.createAuthCore(client,{origin:window.location.origin});
      // Supabase emits PASSWORD_RECOVERY asynchronously after parsing the URL.
      // Do not call getUser() from inside its synchronous auth callback.
      api.subscribeRecovery?.(() => {
        if (!api.getRecoveryUserId?.()) lock();
        else setTimeout(() => { void checkRecoveryLink(); }, 0);
      });
      await checkRecoveryLink();
    } catch (_) {
      lock();
      message('Zugang nicht verfügbar','Die Wiederherstellung konnte nicht geprüft werden. Bitte versuche es später erneut.');
    }
  }
  void initialize();
});