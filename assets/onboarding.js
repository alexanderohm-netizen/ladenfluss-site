document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (window.__ladenflussOnboardingInitialized) return;
  window.__ladenflussOnboardingInitialized = true;
  const form = document.getElementById('companyOnboarding');
  const status = document.getElementById('onboardingStatus');
  let core = null, client = null, busy = false;
  const message = (heading, description, link) => {
    const title = document.createElement('strong'), text = document.createElement('span');
    title.textContent = heading; text.textContent = description;
    status.replaceChildren(title,text);
    if (link) {
      const a = document.createElement('a');
      a.href = '/mein-laden'; a.textContent = 'Zum Laden-Dashboard →';
      status.append(a);
    }
  };

  form?.addEventListener('submit',async event => {
    event.preventDefault();
    if (busy) return;
    if (!core || !client) {
      message('Cloud-Beta noch geschlossen','Unternehmensdaten werden vor der Freigabe nicht an die Cloud übertragen.');
      return;
    }
    const name = document.getElementById('company_name')?.value.trim() || '';
    const retail = document.getElementById('company_type')?.value || '';
    const branch = document.getElementById('branch_name')?.value.trim() || '';
    const days = Number(document.getElementById('branch_days')?.value);
    const hours = Number(document.getElementById('branch_hours')?.value);
    if (name.length < 2 || branch.length < 2 || !retail ||
        !Number.isInteger(days) || days < 1 || days > 7 ||
        !Number.isFinite(hours) || hours <= 0 || hours > 24 || hours * 2 !== Math.trunc(hours * 2)) {
      message('Eingaben prüfen','Bitte kontrolliere Unternehmen, Standort und die gültigen Öffnungszeiten.');
      return;
    }
    const submit = form.querySelector('button[type=submit]');
    busy = true; submit.disabled = true;
    try {
      const user = await core.validatedUser();
      if (!user) {
        message('Anmeldung erforderlich','Bitte melde dich zuerst mit deiner bestätigten E-Mail-Adresse an.');
        return;
      }
      if (await core.firstCompany()) {
        form.hidden = true;
        message('Unternehmen bereits vorhanden','Dein Konto ist bereits einem Unternehmen zugeordnet.',true);
        return;
      }
      const {data,error} = await client.rpc('create_company_onboarding',{
        p_company_name:name, p_retail_type:retail, p_branch_name:branch,
        p_opening_days:days, p_opening_hours:hours,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.company_id || !row?.branch_id)
        throw new Error('Onboarding returned no company or branch');
      form.hidden = true;
      message('Unternehmen angelegt','Dein Unternehmen und deine erste Filiale wurden gemeinsam gespeichert. Weitere Standorte können später ergänzt werden.',true);
    } catch (error) {
      if (error?.code === '23505') {
        form.hidden = true;
        message('Bereits eingerichtet','Für dieses Konto wurde bereits ein Unternehmen angelegt.',true);
      } else {
        message('Nicht gespeichert','Die Einrichtung konnte nicht abgeschlossen werden. Bitte prüfe deine Verbindung und versuche es erneut.');
      }
    } finally {submit.disabled = false;busy = false;}
  });
  async function initialize() {
    try {
      if (!window.LadenflussSupabase?.isEnabled()) {
        message('Cloud-Beta in Vorbereitung','Die Unternehmensanlage wird erst nach erfolgreicher Sicherheitsprüfung freigeschaltet. Es werden noch keine Daten übertragen.');
        return;
      }
      client = await window.LadenflussSupabase.getClient();
      core = window.LadenflussAuthCore.createAuthCore(client,{origin:window.location.origin});
      const user = await core.validatedUser();
      if (!user) {
        message('Bitte zuerst anmelden','Erstelle dein Konto und bestätige deine E-Mail-Adresse, bevor du ein Unternehmen einrichtest.');
        return;
      }
      const existing = await core.firstCompany();
      if (existing) {
        form.hidden = true;
        message('Unternehmen vorhanden','Du hast bereits ein Unternehmen eingerichtet.',true);
      } else {
        message('Bereit zur Einrichtung','Dein Konto wurde bestätigt. Unternehmen und erste Filiale werden gemeinsam und sicher angelegt.');
      }
    } catch (_) {
      core = null; client = null;
      message('Verbindung nicht verfügbar','Bitte versuche es später erneut. Es wurden keine Unternehmensdaten gespeichert.');
    }
  }
  void initialize();
});