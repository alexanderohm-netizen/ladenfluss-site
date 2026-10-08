document.addEventListener('DOMContentLoaded', async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = $('authStatus');
  let client, user = null, company = null, recovery = false, generation = 0;
  function message(text) { status.textContent = text; }
  function panel(name) {
    document.querySelectorAll('[data-account-panel]').forEach(el => { el.hidden = el.dataset.accountPanel !== name; });
    document.querySelectorAll('[data-account-tab]').forEach(el => {
      el.classList.toggle('active', el.dataset.accountTab === name);
      el.setAttribute('aria-pressed', String(el.dataset.accountTab === name));
    });
  }
  document.querySelectorAll('[data-account-tab]').forEach(el => el.addEventListener('click', () => panel(el.dataset.accountTab)));
  function errorText(error) {
    if (error?.code === 'invalid_credentials') return 'Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.';
    if (error?.code === 'email_not_confirmed') return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
    if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') return 'Zu viele Versuche. Bitte versuche es später erneut.';
    if (error?.code === '23505') return 'Für dein Konto besteht bereits ein Unternehmen. Bitte lade die Seite neu.';
    return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte prüfe deine Verbindung und versuche es erneut.';
  }
  function bindForm(id, action) {
    const form = $(id);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!client || form.dataset.busy || !form.reportValidity()) return;
      form.dataset.busy = 'true';
      const buttons = [...form.querySelectorAll('button')];
      buttons.forEach(b => { b.disabled = true; });
      const data = new FormData(form);
      try { await action(data, form); }
      catch (error) { message(errorText(error)); }
      finally {
        form.querySelectorAll('input[type=password]').forEach(input => { input.value = ''; });
        delete form.dataset.busy;
        buttons.forEach(b => { b.disabled = false; });
      }
    });
  }
  async function refresh() {
    const current = ++generation;
    // Hide old account data before any async work, including account switches.
    $('signedIn').hidden = true; $('companyDetails').hidden = true;
    $('accountEmail').textContent = ''; $('moduleList').replaceChildren();
    $('companyForm').reset(); company = null; user = null;
    const { data, error } = await client.auth.getUser();
    if (current !== generation) return;
    user = error ? null : data.user;
    $('signedOut').hidden = !!user || recovery;
    $('recoveryPanel').hidden = !recovery || !user;
    if (!user) { recovery = false; $('signedOut').hidden = false; message('Melde dich an oder erstelle dein Konto.'); return; }
    if (recovery) { message('Wähle dein neues Passwort.'); return; }
    $('accountEmail').textContent = user.email || '';
    $('signedIn').hidden = false;
    // If loading fails, do not offer a potentially duplicate company creation.
    $('companyForm').hidden = true;
    const result = await client.from('companies').select('id,name').order('created_at').limit(1).maybeSingle();
    if (current !== generation) return;
    if (result.error) throw result.error;
    company = result.data;
    $('companyForm').hidden = false;
    $('companyForm').elements.company.value = company?.name || '';
    $('companySave').textContent = company ? 'Name speichern' : 'Unternehmen anlegen';
    $('companyDetails').hidden = !company;
    if (!company) { message('Angemeldet. Lege jetzt dein Unternehmen an.'); return; }
    $('cloudSaved').textContent = 'Dein Unternehmensprofil ist in der Cloud gespeichert.';
    const access = await client.from('module_access').select('module_key,status,valid_until').eq('company_id', company.id);
    if (current !== generation) return;
    if (access.error) throw access.error;
    for (const [key, title] of [['pep','Personalplanung'],['zahlenfluss','Zahlenfluss'],['warenfluss','Warenfluss']]) {
      const entry = access.data.find(row => row.module_key === key);
      const active = ['active','trial'].includes(entry?.status) && Date.parse(entry.valid_until) > Date.now();
      const li = document.createElement('li');
      li.textContent = title + ' · ' + (active ? (entry.status === 'trial' ? 'Testzugang' : 'Freigeschaltet') : 'Nicht freigeschaltet');
      $('moduleList').append(li);
    }
    message('Dein Unternehmensprofil wurde aus der Cloud geladen.');
  }
  bindForm('loginForm', async data => {
    const result = await client.auth.signInWithPassword({ email: data.get('email').trim(), password: data.get('password') });
    if (result.error) throw result.error;
    await refresh();
  });
  bindForm('registerForm', async data => {
    const result = await client.auth.signUp({ email: data.get('email').trim(), password: data.get('password'), options: { emailRedirectTo: location.origin + '/konto' } });
    if (result.error) throw result.error;
    if (result.data.session) await refresh();
    else message('Prüfe dein E-Mail-Postfach. Falls die Registrierung möglich ist, erhältst du einen Bestätigungslink.');
  });
  bindForm('resetForm', async data => {
    const result = await client.auth.resetPasswordForEmail(data.get('email').trim(), { redirectTo: location.origin + '/konto?recovery=1' });
    if (result.error) throw result.error;
    message('Wenn ein passendes Konto besteht, erhältst du einen Link zum Zurücksetzen. Öffne ihn in diesem Browser.');
  });
  bindForm('recoveryForm', async data => {
    const result = await client.auth.updateUser({ password: data.get('password') });
    if (result.error) throw result.error;
    recovery = false; history.replaceState({}, '', '/konto');
    await refresh(); message('Dein Passwort wurde geändert.');
  });
  bindForm('companyForm', async data => {
    if (!user) return;
    const name = data.get('company').trim();
    if (!name) { message('Bitte gib einen Unternehmensnamen ein.'); return; }
    const query = company ? client.from('companies').update({ name }).eq('id', company.id) : client.from('companies').insert({ name, created_by: user.id });
    const result = await query.select('id,name').single();
    if (result.error) throw result.error;
    await refresh();
  });
  $('signOut').addEventListener('click', async () => {
    $('signOut').disabled = true;
    try {
      const result = await client.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
      recovery = false; await refresh(); message('Du bist abgemeldet.');
    } catch (error) { message(errorText(error)); }
    finally { $('signOut').disabled = false; }
  });
  try {
    client = window.LadenflussCloud.getClient();
    client.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      if (['SIGNED_OUT','SIGNED_IN','PASSWORD_RECOVERY'].includes(event)) {
        // Never await Supabase calls inside this callback (SDK auth lock).
        setTimeout(() => refresh().catch(error => message(errorText(error))), 0);
      }
    });
    recovery = new URLSearchParams(location.search).get('recovery') === '1';
    await refresh();
  } catch (error) {
    message(error?.message === 'cloud_not_configured' ? 'Die Cloud-Anmeldung ist noch nicht eingerichtet.' : errorText(error));
  }
});
