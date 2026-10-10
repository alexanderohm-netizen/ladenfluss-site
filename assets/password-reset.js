document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const form = document.getElementById('passwordResetForm');
  const status = document.getElementById('passwordResetStatus');
  const pass = document.getElementById('newPassword');
  const confirm = document.getElementById('confirmPassword');
  let core = null, busy = false;
  const message = (heading, description) => {
    const title = document.createElement('strong'), text = document.createElement('span');
    title.textContent = heading;
    text.textContent = description;
    status.replaceChildren(title,text);
  };
  form?.addEventListener('submit',async e => {
    e.preventDefault();
    if (!core || busy) return;
    if (!pass.value || pass.value.length < 12 || pass.value !== confirm.value) {
      message('Passwörter prüfen','Bitte ein Passwort mit mindestens 12 Zeichen wählen und identisch wiederholen.');
      return;
    }
    busy = true;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await core.updatePassword(pass.value);
      form.hidden = true;
      message('Passwort geändert','Dein Passwort wurde aktualisiert. Melde dich jetzt mit dem neuen Passwort an.');
    } catch (_) {
      message('Änderung fehlgeschlagen','Der Link ist möglicherweise abgelaufen oder die Änderung ist gerade nicht möglich. Fordere bei Bedarf einen neuen Link über die Anmeldung an.');
    } finally {
      pass.value = '';
      confirm.value = '';
      button.disabled = false;
      busy = false;
    }
  });
  async function initialize() {
    try {
      if (!window.LadenflussSupabase?.isEnabled()) {
        message('Cloud-Beta in Vorbereitung','Die Passwort-Wiederherstellung ist noch nicht für Kunden freigeschaltet.');
        return;
      }
      const client = await window.LadenflussSupabase.getClient();
      core = window.LadenflussAuthCore.createAuthCore(client,{origin:window.location.origin});
      const user = await core.validatedUser();
      if (!user) {
        message('Kein gültiger Zugang','Bitte fordere über die Konto-Seite einen neuen Wiederherstellungslink an.');
        return;
      }
      form.hidden = false;
      message('Neues Passwort wählen','Du kannst jetzt ein neues Passwort mit mindestens 12 Zeichen festlegen.');
    } catch (_) {
      message('Zugang nicht verfügbar','Die Wiederherstellung konnte nicht geprüft werden. Bitte versuche es später erneut.');
    }
  }
  void initialize();
});