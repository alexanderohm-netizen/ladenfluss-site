document.addEventListener('DOMContentLoaded', async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = $('authStatus');
  let client, user = null, company = null, recovery = false, generation = 0, starting = true;
  function message(text) { status.textContent = text; $('authRetry').hidden = true; }
  function failed(error) { message(errorText(error)); $('authRetry').hidden = !client; }
  function panel(name) {
    document.querySelectorAll('[data-account-panel]').forEach(el => { el.hidden = el.dataset.accountPanel !== name; });
    document.querySelectorAll('[data-account-tab]').forEach(el => {
      el.classList.toggle('active', el.dataset.accountTab === name);
      el.setAttribute('aria-pressed', String(el.dataset.accountTab === name));
    });
  }
  document.querySelectorAll('[data-account-tab]').forEach(el => el.addEventListener('click', () => {
    panel(el.dataset.accountTab);
    document.querySelectorAll('#signedOut input[type=password]').forEach(input => { input.value = ''; });
  }));
  function errorText(error) {
    if (error?.code === 'invalid_credentials') return 'Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.';
    if (error?.code === 'email_not_confirmed') return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
    if (error?.code === 'weak_password') return 'Bitte wähle ein stärkeres Passwort mit mindestens 12 Zeichen.';
    if (error?.code === 'same_password') return 'Bitte wähle ein anderes Passwort als dein bisheriges.';
    if (error?.code === 'recovery_required') return 'Fordere bitte einen neuen Link zum Zurücksetzen an.';
    if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') return 'Zu viele Versuche. Bitte versuche es später erneut.';
    if (error?.code === '23505') return 'Für dein Konto besteht bereits ein Unternehmen. Bitte lade die Seite neu.';
    return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte prüfe deine Verbindung und versuche es erneut.';
  }
  function bindForm(id, action) {
    const form = $(id);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!client || starting || form.dataset.busy || !form.reportValidity()) return;
      form.dataset.busy = 'true';
      const buttons = [...form.querySelectorAll('button')];
      buttons.forEach(b => { b.disabled = true; });
      const data = new FormData(form);
      try { await action(data, form); }
      catch (error) { failed(error); }
      finally {
        form.querySelectorAll('input[type=password]').forEach(input => { input.value = ''; });
        delete form.dataset.busy;
        buttons.forEach(b => { b.disabled = false; });
      }
    });
  }
  function clearAccount() {
    ++generation;
    $('signedIn').hidden = true; $('companyDetails').hidden = true; $('recoveryPanel').hidden = true;
    $('accountEmail').textContent = ''; $('moduleList').replaceChildren();
    $('billingCard').replaceChildren(); $('billingCard').hidden = true;
    $('companyForm').reset(); company = null; user = null;
  }
  async function refresh() {
    // Hide old account data before any async work, including account switches.
    clearAccount();
    const current = generation;
    $('signedOut').hidden = true;
    const { data, error } = await client.auth.getUser();
    if (current !== generation) return;
    if (error && error.name !== 'AuthSessionMissingError') {
      $('signedOut').hidden = false;
      throw error;
    }
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
    if (window.LadenflussBilling) {
      await window.LadenflussBilling.render({client,companyId:company.id,element:$('billingCard'),
        isCurrent:() => current === generation,onRefresh:() => refresh().catch(failed),access:access.data.find(row => row.module_key === 'pep')});
    }
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
    else message('Prüfe dein E-Mail-Postfach. Falls die Registrierung möglich ist, erhältst du einen Bestätigungslink. Öffne ihn in diesem Browser.');
  });
  bindForm('resetForm', async data => {
    const result = await client.auth.resetPasswordForEmail(data.get('email').trim(), { redirectTo: location.origin + '/konto?recovery=1' });
    if (result.error) throw result.error;
    message('Wenn ein passendes Konto besteht, erhältst du einen Link zum Zurücksetzen. Öffne ihn in diesem Browser.');
  });
  bindForm('recoveryForm', async data => {
    if (!user || !recovery) throw { code: 'recovery_required' };
    const result = await client.auth.updateUser({ password: data.get('password') });
    if (result.error) throw result.error;
    recovery = false;
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
    } catch (error) { failed(error); }
    finally { $('signOut').disabled = false; }
  });
  $('authRetry').addEventListener('click', async () => {
    $('authRetry').disabled = true;
    try { await refresh(); } catch (error) { failed(error); }
    finally { $('authRetry').disabled = false; }
  });
  $('cancelRecovery').addEventListener('click', () => {
    recovery = false;
    $('recoveryForm').reset();
    refresh().catch(failed);
  });
  async function handleCallback() {
    const url = new URL(location.href);
    const params = url.searchParams, hash = new URLSearchParams(url.hash.slice(1));
    const hasError = ['error','error_code','error_description'].some(key => params.has(key) || hash.has(key));
    const code = params.get('code');
    if (!code && !hasError && !params.has('recovery')) return null;
    let callbackError = hasError || !code;
    try {
      if (code && !hasError) {
        const flowId = params.get('sb_flow_id');
        const result = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
        callbackError = !!result.error;
      }
    } catch { callbackError = true; }
    finally {
      // Do not leave one-time codes or provider error text in browser history.
      history.replaceState(history.state, '', '/konto');
    }
    if (callbackError) {
      recovery = false;
      const forRecovery = params.get('recovery') === '1';
      panel(forRecovery ? 'reset' : 'register');
      return 'Der Link konnte nicht bestätigt werden. Er ist möglicherweise abgelaufen, bereits verwendet oder in einem anderen Browser geöffnet. ' +
        (forRecovery ? 'Fordere einen neuen Link an und öffne ihn hier.' : 'Melde dich mit einem bereits bestätigten Konto an oder wiederhole die Registrierung in diesem Browser.');
    }
    return null;
  }
  try {
    client = window.LadenflussCloud.getClient();
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      if (event === 'SIGNED_OUT') {
        recovery = false;
        clearAccount();
        $('recoveryForm').reset();
      }
      if (starting || (event === 'SIGNED_IN' && session?.user?.id === user?.id)) return;
      if (['SIGNED_OUT','SIGNED_IN','PASSWORD_RECOVERY'].includes(event)) {
        // Never await Supabase calls inside this callback (SDK auth lock).
        setTimeout(() => refresh().catch(failed), 0);
      }
    });
    const callbackMessage = await handleCallback();
    await refresh();
    if (callbackMessage) message(callbackMessage);
  } catch (error) {
    $('signedOut').hidden = false;
    message(error?.message === 'cloud_not_configured' ? 'Die Cloud-Anmeldung ist noch nicht eingerichtet.' : errorText(error));
    $('authRetry').hidden = !client;
  } finally { starting = false; }
});
