(function () {
  'use strict';
  const messages = {
    billing_not_configured:'Die Buchung wird noch eingerichtet.',
    billing_forbidden:'Die Abo-Verwaltung ist für Inhaber und Administratoren verfügbar.',
    sign_in_required:'Bitte melde dich erneut an, um dein Abo zu verwalten.',
    subscription_exists:'Es besteht bereits ein Abo oder eine laufende Zahlung. Öffne die Abo-Verwaltung.',
    checkout_pending:'Es gibt bereits eine offene Buchung. Bitte versuche es später erneut.',
    billing_busy:'Deine Buchung wird gerade verarbeitet. Bitte warte kurz und versuche es erneut.',
    no_subscription:'Für dieses Unternehmen gibt es noch kein Abo.'
  };
  const text = (tag, value, className) => {
    const element = document.createElement(tag); element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  async function invoke(client, action, companyId) {
    const result = await client.functions.invoke('billing',{body:{action,companyId}});
    if (result.error) {
      let code;
      try { code = (await result.error.context?.clone().json())?.error; } catch {}
      throw new Error(messages[code] || 'Die Abo-Verwaltung ist gerade nicht erreichbar. Bitte versuche es erneut.');
    }
    if (result.data?.sandbox !== true) throw new Error('Die Buchung ist noch nicht verfügbar.');
    return result.data;
  }
  window.LadenflussBilling = {
    async render({client, companyId, element, isCurrent, onRefresh, access,
      navigate = url => location.assign(url)}) {
      element.replaceChildren(); element.hidden = false;
      const title = text('h3','Dein PEP-Abo');
      const note = text('p','Paket wird geladen …','billing-note');
      note.setAttribute('role','status'); note.setAttribute('aria-live','polite');
      element.append(title,note);
      function button(label, action, className = 'btn') {
        const control = text('button',label,className); control.type = 'button';
        control.addEventListener('click',async () => {
          if (!isCurrent() || control.disabled) return;
          control.disabled = true;
          try { await action(); }
          catch (error) { if (isCurrent()) note.textContent = error.message; }
          finally { if (isCurrent()) control.disabled = false; }
        });
        element.append(control); return control;
      }
      async function open(action) {
        const data = await invoke(client,action,companyId);
        if (!isCurrent()) return;
        const url = new URL(data.url);
        if (url.protocol !== 'https:' || url.hostname !== (action === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com')) {
          throw new Error('Die Buchung konnte nicht geöffnet werden. Bitte versuche es erneut.');
        }
        navigate(url.href);
      }
      try {
        const data = await invoke(client,'status',companyId);
        if (!isCurrent()) return;
        const active = ['active','trial'].includes(access?.status) && Date.parse(access.valid_until) > Date.now();
        const returned = new URLSearchParams(location.search).get('billing');
        if (returned) {
          const url = new URL(location.href); url.searchParams.delete('billing');
          history.replaceState(history.state,'',url.pathname+url.search+url.hash);
        }
        note.textContent = active ? 'Dein PEP-Zugang ist freigeschaltet.' :
          returned === 'returned' ? 'Die Rückkehr von Stripe bestätigt noch keine Freischaltung. Prüfe hier den aktuellen Zugangsstatus.' :
          returned === 'cancelled' ? 'Du hast die Buchung verlassen. Dein Zugang wurde dadurch nicht verändert.' :
          data.available ? 'Testumgebung: Hier werden keine echten Beträge abgebucht.' : 'Die Buchung wird noch eingerichtet. Dein lokaler Dienstplan bleibt verfügbar.';
        if (data.available && data.price) {
          const price = data.price;
          const amount = new Intl.NumberFormat('de-DE',{style:'currency',currency:price.currency}).format(price.amount/100);
          element.append(text('p',amount + ' / Monat · Testpreis','billing-price'));
          if (!active) button('Checkout testen',()=>open('checkout'),'btn btn-primary');
        }
        if (data.canManage) button('Abo verwalten',()=>open('portal'));
        if (returned || active) button('Zugangsstatus aktualisieren',onRefresh,'text-button');
      } catch (error) {
        if (!isCurrent()) return;
        note.textContent = error.message;
        button('Erneut prüfen',onRefresh,'text-button');
      }
    }
  };
})();
