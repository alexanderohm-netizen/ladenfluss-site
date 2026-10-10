document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const tabs = [...document.querySelectorAll('[data-account-tab]')];
  const panels = [...document.querySelectorAll('[data-account-panel]')];
  const forms = [...document.querySelectorAll('[data-auth-form]')];
  const status = document.getElementById('authStatus');
  const signedIn = document.getElementById('signedInPanel');
  const accountEmail = document.getElementById('accountEmail');
  const accountNext = document.getElementById('accountNext');
  const logout = document.getElementById('accountLogout');
  let core = null;
  let busy = false;

  function message(title, detail) {
    if (!status) return;
    const head = document.createElement('strong');
    const description = document.createElement('span');
    head.textContent = title;
    description.textContent = detail;
    status.replaceChildren(head, description);
  }
  function open(name) {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.accountTab === name));
    panels.forEach(p => { p.hidden = p.dataset.accountPanel !== name; });
    if (signedIn) signedIn.hidden = true;
  }
  function setBusy(value) {
    busy = value;
    forms.forEach(form => {
      const button = form.querySelector('button[type=submit]');
      if (button) button.disabled = value;
    });
    const reset = document.querySelector('[data-reset]');
    if (reset) reset.disabled = value;
    if (logout) logout.disabled = value;
  }
  function showUser(user, company) {
    tabs.forEach(b => { b.hidden = true; });
    panels.forEach(p => { p.hidden = true; });
    if (!signedIn) return;
    signedIn.hidden = false;
    if (accountEmail) accountEmail.textContent = user.email || 'Verifiziertes Konto';
    if (accountNext) {
      accountNext.href = company ? '/mein-laden' : '/onboarding';
      accountNext.textContent = company ? 'Zum Laden-Dashboard →' : 'Unternehmen einrichten →';
    }
    message('Angemeldet', 'Deine E-Mail-Adresse ist bestätigt. Dein Zugang ist aktiv.');
  }
  function showGuest() {
    tabs.forEach(b => { b.hidden = false; });
    open('login');
  }
  function explain(error, action) {
    if (error && ['INVALID_EMAIL','INVALID_PASSWORD','EMAIL_UNVERIFIED','INVALID_ORIGIN'].includes(error.code))
      return error.message;
    if (action === 'login') return 'Anmeldung fehlgeschlagen. Prüfe deine E-Mail-Adresse und dein Passwort.';
    if (action === 'register') return 'Das Konto konnte noch nicht erstellt werden. Versuche es später erneut.';
    if (action === 'reset') return 'Die Anfrage konnte gerade nicht verarbeitet werden. Versuche es später erneut.';
    return 'Es gab ein Verbindungsproblem. Deine Anmeldung wurde nicht bestätigt.';
  }

  tabs.forEach(b => b.addEventListener('click', () => open(b.dataset.accountTab)));
  forms.forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!core) {
      message('Noch nicht freigeschaltet', 'Die sichere Cloud-Anmeldung ist vorbereitet, aber für die Beta noch deaktiviert.');
      return;
    }
    const kind = form.dataset.authForm;
    const email = form.querySelector('input[type=email]')?.value || '';
    const passwordField = form.querySelector('input[type=password]');
    const password = passwordField?.value || '';
    if (kind === 'register' && !form.querySelector('input[type=checkbox]')?.checked) {
      message('Datenschutz bestätigen', 'Bitte lies und akzeptiere die Datenschutzbestimmungen.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'register') {
        await core.signUp(email, password);
        message('E-Mail prüfen', 'Falls die Registrierung angenommen wurde, erhältst du eine Bestätigungs-E-Mail. Bitte öffne den Link.');
      } else {
        const user = await core.signIn(email, password);
        const company = await core.firstCompany();
        showUser(user, company);
      }
    } catch (error) {
      message('Bitte prüfen', explain(error, kind));
    } finally {
      if (passwordField) passwordField.value = '';
      setBusy(false);
    }
  }));
  document.querySelector('[data-reset]')?.addEventListener('click', async () => {
    if (busy) return;
    if (!core) {
      message('Noch nicht freigeschaltet', 'Der Passwort-Reset wird zusammen mit der Cloud-Beta freigeschaltet.');
      return;
    }
    const email = document.querySelector('[data-account-panel=login] input[type=email]')?.value || '';
    if (!email.trim()) {
      message('E-Mail-Adresse erforderlich', 'Trage bitte zuerst die E-Mail-Adresse in das Anmeldeformular ein.');
      return;
    }
    setBusy(true);
    try {
      await core.requestPasswordReset(email);
      message('Posteingang prüfen', 'Falls ein passendes Konto existiert, erhältst du eine E-Mail mit weiteren Schritten.');
    } catch (error) {
      message('Zurzeit nicht möglich', explain(error, 'reset'));
    } finally { setBusy(false); }
  });
  logout?.addEventListener('click', async () => {
    if (busy || !core) return;
    setBusy(true);
    try {
      await core.signOut();
      showGuest();
      message('Abgemeldet', 'Deine Sitzung wurde beendet. Lokale Entwürfe werden nicht automatisch gelöscht.');
    } catch (error) {
      message('Abmeldung fehlgeschlagen', explain(error, 'logout'));
    } finally { setBusy(false); }
  });

  async function initialize() {
    try {
      if (!window.LadenflussSupabase?.isEnabled()) {
        message('Cloud-Beta in Vorbereitung', 'Die sichere Registrierung ist implementiert, aber für Kunden noch nicht aktiviert. Kostenlose Werkzeuge funktionieren weiterhin ohne Anmeldung.');
        return;
      }
      message('Sicherer Zugang', 'Die Verbindung zu deinem Ladenfluss-Konto wird geprüft.');
      const client = await window.LadenflussSupabase.getClient();
      core = window.LadenflussAuthCore.createAuthCore(client, {origin:window.location.origin});
      const user = await core.validatedUser();
      if (user) showUser(user, await core.firstCompany());
      else message('Sicher anmelden', 'Melde dich an oder erstelle ein Konto. Neue Konten benötigen eine bestätigte E-Mail-Adresse.');
    } catch (_) {
      core = null;
      message('Verbindung nicht verfügbar', 'Die sichere Kontoanmeldung ist momentan nicht erreichbar. Bitte versuche es später erneut.');
    }
  }
  void initialize();
});