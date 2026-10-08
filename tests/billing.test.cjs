const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const Stripe = require('stripe');
const corePromise = import('../supabase/functions/_shared/billing-core.mjs');
const companyId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://www.ladenfluss.de';
const now = Math.floor(Date.now()/1000);
// Intentionally fake fixture values, not issued credentials.
const webhookSecret = 'whsec_fixture_only_not_a_real_secret';
const verifier = new Stripe('rk_test_fixture_only_not_a_real_key');
async function fixture() {
  const core = await corePromise;
  const calls = [], events = new Set();
  let customer = {company_id:companyId,stripe_customer_id:'cus_test',checkout_request:null};
  let locked = false, session = null, deny = false;
  let subscriptions = [];
  const price = {id:'price_test',product:{id:core.PEP_PRODUCT,active:true},livemode:false,active:true,currency:'eur',
    type:'recurring',recurring:{interval:'month',interval_count:1},billing_scheme:'per_unit',unit_amount:1234,tax_behavior:'inclusive'};
  const stripe = {
    prices:{retrieve:async()=>price},
    customers:{create:async()=>{calls.push('customer');return {id:'cus_test',livemode:false};}},
    subscriptions:{list:async()=>{calls.push('subscriptions');return {data:subscriptions,has_more:false};}},
    checkout:{sessions:{
      retrieve:async()=>session,
      create:async(params,options)=>{calls.push({checkout:params,key:options.idempotencyKey});session={id:'cs_test',customer:'cus_test',livemode:false,status:'open',url:'https://checkout.stripe.com/c/pay/test'};return session;}
    }},
    billingPortal:{sessions:{create:async params=>{calls.push({portal:params});return {url:'https://billing.stripe.com/p/session/test'};}}}
  };
  const db = {
    customer:async()=>customer,
    customerByStripeId:async id=>customer?.stripe_customer_id === id ? customer : null,
    saveCustomer:async(company,id)=>customer={company_id:company,stripe_customer_id:id},
    lock:async()=>{if(locked)return false;locked=true;return true;},
    release:async()=>{locked=false;},
    saveCheckout:async(company,lease,request)=>{customer.checkout_request=request;},
    hasEvent:async id=>events.has(id),
    finishEvent:async(company,lease,id,snapshot)=>{calls.push({snapshot});events.add(id);}
  };
  const runtime = {config:{enabled:true,stripeKey:'rk_test_fixture_only',webhookSecret,priceId:'price_test',portalConfiguration:'bpc_test',appOrigin:origin},
    stripe:()=>stripe,db,now:()=>now,uuid:randomUUID,
    authorize:async(token,company)=>{calls.push('authorize');if(deny||company!==companyId)throw new core.BillingError('billing_forbidden',403);},
    verifyEvent:(body,signature)=>verifier.webhooks.constructEventAsync(body,signature,webhookSecret,300)
  };
  const bill = core.createBillingHandler(()=>runtime), hook = core.createWebhookHandler(()=>runtime);
  const request = (action,extra={},headers={})=>new Request(origin,{method:'POST',headers:{origin,authorization:'Bearer fixture-token','content-type':'application/json',...headers},body:JSON.stringify({action,companyId,...extra})});
  async function event(type='customer.subscription.updated',options={}) {
    const body=JSON.stringify({id:options.id||'evt_test',type,livemode:options.livemode??false,
      ...(options.account?{account:options.account}:{}),data:{object:{customer:options.customer||'cus_test',payment_status:options.payment_status||'paid'}}});
    const signature=verifier.webhooks.generateTestHeaderString({payload:body,secret:webhookSecret,timestamp:options.timestamp||now});
    return hook(new Request(origin,{method:'POST',headers:{'stripe-signature':signature},body:options.tampered?body+' ':body}));
  }
  const paid = (status='active')=>({id:'sub_test',customer:'cus_test',livemode:false,status,
    items:{data:[{price:{product:core.PEP_PRODUCT},current_period_end:now+3600}],has_more:false},latest_invoice:{status:'paid'},cancel_at_period_end:false});
  return {core,calls,runtime,stripe,price,db,request,bill,hook,event,paid,
    setSubscriptions:value=>{subscriptions=value;},setDenied:value=>{deny=value;},setCustomer:value=>{customer=value;},setLocked:value=>{locked=value;},getCustomer:()=>customer};
}

test('Billing: fremde Firmen, fehlende Anmeldung und fremde Herkunft lösen keine Stripe-Aktion aus',async()=>{
  const f=await fixture();
  for(const request of [f.request('checkout',{}, {authorization:''}),f.request('checkout',{}, {origin:'https://attacker.invalid'}),
    f.request('checkout',{companyId:'22222222-2222-4222-8222-222222222222'})]) {
    assert.ok([401,403].includes((await f.bill(request)).status));
  }
  f.setDenied(true);assert.equal((await f.bill(f.request('portal'))).status,403);
  assert.equal(f.calls.some(call=>typeof call==='object'),false);
});
test('Billing: Preis, Kunden-ID und Redirect können nicht vom Browser überschrieben werden',async()=>{
  const f=await fixture();
  for(const extra of [{priceId:'price_free'},{customer:'cus_foreign'},{return_url:'https://attacker.invalid'}]) {
    assert.equal((await f.bill(f.request('checkout',extra))).status,400);
  }
  assert.deepEqual(f.calls,[]);
});
test('Billing: fehlende Konfiguration und Live-Schlüssel bleiben gesperrt',async()=>{
  const f=await fixture();f.runtime.config.enabled=false;
  assert.equal((await (await f.bill(f.request('status'))).json()).available,false);
  assert.equal((await f.bill(f.request('checkout'))).status,503);
  f.runtime.config.enabled=true;f.runtime.config.stripeKey='not-a-test-restricted-key';
  assert.equal((await f.bill(f.request('checkout'))).status,503);
  assert.equal(f.calls.includes('subscriptions'),false);
});
test('Billing: aktiver Preis muss zum freigegebenen Sandbox-Produkt gehören',async()=>{
  const f=await fixture();f.price.product.id='prod_foreign';
  assert.equal((await f.bill(f.request('checkout'))).status,503);
  f.price.product.id=f.core.PEP_PRODUCT;f.price.livemode=true;
  assert.equal((await f.bill(f.request('checkout'))).status,503);
});
test('Billing: Checkout kommt vom Server und doppelte Klicks verwenden dieselbe Sitzung',async()=>{
  const f=await fixture();
  const first=await f.bill(f.request('checkout')), second=await f.bill(f.request('checkout'));
  assert.equal(first.status,200);assert.deepEqual(await first.json(),await second.json());
  const created=f.calls.filter(call=>call.checkout);assert.equal(created.length,1);
  assert.deepEqual(created[0].checkout.line_items,[{price:'price_test',quantity:1}]);
  assert.equal(created[0].checkout.customer,'cus_test');
  assert.equal(created[0].checkout.success_url,origin+'/konto?billing=returned');
  assert.equal(created[0].checkout.payment_method_types,undefined);
  assert.equal(created[0].checkout.automatic_tax,undefined);
  assert.equal(created[0].checkout.subscription_data.billing_mode.type,'flexible');
  assert.match(created[0].checkout.integration_identifier,/_[a-z]{8}$/);
  assert.equal(f.calls.some(call=>call.snapshot),false);
});
test('Billing: bestehendes oder noch unvollständiges Abo verhindert einen zweiten Kauf',async()=>{
  for(const status of ['active','trialing','past_due','incomplete','unpaid','paused']) {
    const f=await fixture();f.setSubscriptions([f.paid(status)]);
    assert.equal((await f.bill(f.request('checkout'))).status,409,status);
    assert.equal(f.calls.some(call=>call.checkout),false);
  }
});
test('Billing: nach einem Speicherfehler wird der gleiche idempotente Checkout-Auftrag wiederholt',async()=>{
  const f=await fixture();const save=f.db.saveCheckout;
  f.db.saveCheckout=async(...args)=>{if(args[2].session_id)throw Error('connection failed');return save(...args);};
  assert.equal((await f.bill(f.request('checkout'))).status,503);
  f.db.saveCheckout=save;
  assert.equal((await f.bill(f.request('checkout'))).status,200);
  const attempts=f.calls.filter(call=>call.checkout);
  assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);
});
test('Billing: laufender Firmenauftrag wird nicht parallel überschrieben',async()=>{
  const f=await fixture();f.setLocked(true);
  assert.equal((await f.bill(f.request('checkout'))).status,409);
  assert.equal((await f.event()).status,409);
  assert.equal(f.calls.includes('subscriptions'),false);
});
test('Billing: Portal nutzt ausschließlich den gespeicherten Stripe-Kunden',async()=>{
  const f=await fixture();assert.equal((await f.bill(f.request('portal'))).status,200);
  assert.deepEqual(f.calls.find(call=>call.portal).portal,{customer:'cus_test',configuration:'bpc_test',return_url:origin+'/konto'});
});
test('Webhook: echte Stripe-Signaturprüfung lehnt Manipulation, alte Signaturen und Live-Ereignisse ab',async()=>{
  const f=await fixture();
  for(const options of [{tampered:true},{timestamp:now-600},{livemode:true},{account:'acct_foreign'}]) {
    assert.equal((await f.event('invoice.paid',options)).status,400);
  }
  assert.equal(f.calls.includes('subscriptions'),false);
});
test('Webhook: bezahltes Abo schaltet befristet frei; doppelte Zustellung bleibt wirkungslos',async()=>{
  const f=await fixture();f.setSubscriptions([f.paid()]);
  assert.equal((await f.event('invoice.paid')).status,200);
  assert.equal((await (await f.event('invoice.paid')).json()).duplicate,true);
  const updates=f.calls.filter(call=>call.snapshot);assert.equal(updates.length,1);
  assert.equal(updates[0].snapshot[0].access_status,'active');
  assert.equal(updates[0].snapshot[0].valid_until,new Date((now+3600)*1000).toISOString());
});
test('Webhook: ein verspätetes invoice.paid hebt eine bereits erfolgte Kündigung nicht auf',async()=>{
  const f=await fixture();f.setSubscriptions([f.paid('canceled')]);
  assert.equal((await f.event('invoice.paid')).status,200);
  assert.equal(f.calls.find(call=>call.snapshot).snapshot[0].access_status,'inactive');
});
test('Webhook: unbezahlter Checkout und fremder Kunde erteilen keine Rechte',async()=>{
  const f=await fixture();f.setSubscriptions([f.paid()]);
  assert.equal((await (await f.event('checkout.session.completed',{payment_status:'unpaid'})).json()).waiting,true);
  assert.equal((await (await f.event('invoice.paid',{customer:'cus_foreign'})).json()).ignored,true);
  assert.equal(f.calls.includes('subscriptions'),false);
});
test('Webhook: Zahlungsausfall und asynchron fehlgeschlagene Zahlung entfernen den Zugang',async()=>{
  for(const type of ['invoice.payment_failed','checkout.session.async_payment_failed']) {
    const f=await fixture();f.setSubscriptions([f.paid('past_due')]);
    assert.equal((await f.event(type,{payment_status:'unpaid'})).status,200);
    assert.equal(f.calls.find(call=>call.snapshot).snapshot[0].access_status,'inactive');
  }
});
test('Freischaltung: offene Rechnung, Pause und abgelaufene Zeit gewähren keinen Zugang',async()=>{
  const f=await fixture();
  const unpaid=f.paid();unpaid.latest_invoice={status:'open'};
  const paused=f.paid();paused.pause_collection={behavior:'void'};
  const expired=f.paid();expired.items.data[0].current_period_end=now-1;
  for(const subscription of [unpaid,paused,expired,f.paid('incomplete'),f.paid('unpaid')]) {
    assert.equal(f.core.subscriptionSnapshot([subscription],now)[0].access_status,'inactive');
  }
  const trial=f.paid('trialing');trial.trial_end=now+120;
  const result=f.core.subscriptionSnapshot([trial],now)[0];
  assert.equal(result.access_status,'trial');assert.equal(result.valid_until,new Date((now+120)*1000).toISOString());
  const ending=f.paid();ending.cancel_at_period_end=true;
  assert.equal(f.core.subscriptionSnapshot([ending],now)[0].access_status,'active');
});
test('Webhook: Datenbankfehler wird nicht quittiert und kann von Stripe erneut zugestellt werden',async()=>{
  const f=await fixture();f.setSubscriptions([f.paid()]);
  f.db.finishEvent=async()=>{throw Error('sensitive provider details');};
  const response=await f.event();assert.equal(response.status,503);
  assert.doesNotMatch(await response.text(),/sensitive|secret|provider/);
});
