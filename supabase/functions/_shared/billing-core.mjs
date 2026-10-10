// Shared, runtime-independent billing logic. No browser credentials or prices are trusted.
export const PEP_PRODUCT = 'prod_VP6NVdxlEdG1Hv';
export const BILLING_ORIGINS = [
  'https://www.ladenfluss.de', 'https://ladenfluss.de',
  'https://ladenfluss-site-git-feature-cloud-foundation-warenfluss.vercel.app'
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set(['canceled', 'incomplete_expired']);
const EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'invoice.paid', 'invoice.payment_failed',
  'invoice.payment_action_required', 'invoice.voided', 'invoice.marked_uncollectible']);
export class BillingError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
const idOf = value => typeof value === 'string' ? value : value?.id;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json', 'cache-control':'no-store', ...headers}
});
const failure = (error, headers) => json({error:error instanceof BillingError ? error.code : 'billing_unavailable'},
  error instanceof BillingError ? error.status : 503, headers);
export async function readBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new BillingError('request_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new BillingError('request_too_large', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
function stripeURL(value, host) {
  try { const url = new URL(value); if (url.protocol === 'https:' && url.hostname === host) return url.href; } catch {}
  throw new BillingError('billing_unavailable');
}
function stripeReady(config) {
  return /^rk_test_/.test(config.stripeKey || '') && /^whsec_/.test(config.webhookSecret || '');
}
function checkoutReady(config) {
  return config.enabled && stripeReady(config) && /^price_/.test(config.priceId || '') &&
    /^bpc_/.test(config.portalConfiguration || '');
}
async function getPrice(runtime) {
  const price = await runtime.stripe().prices.retrieve(runtime.config.priceId, {expand:['product']});
  if (price.livemode !== false || !price.active || idOf(price.product) !== PEP_PRODUCT || !price.product.active ||
      price.currency !== 'eur' || price.type !== 'recurring' || price.recurring?.interval !== 'month' ||
      price.recurring?.interval_count !== 1 || price.billing_scheme !== 'per_unit' ||
      !Number.isSafeInteger(price.unit_amount) || price.unit_amount <= 0) throw new BillingError('billing_not_configured');
  return price;
}
async function allSubscriptions(stripe, customer) {
  const records = []; let cursor;
  do {
    const page = await stripe.subscriptions.list({customer, status:'all', limit:100,
      expand:['data.latest_invoice'], ...(cursor ? {starting_after:cursor} : {})});
    if (!Array.isArray(page.data)) throw new BillingError('billing_unavailable');
    for (const subscription of page.data) {
      if (subscription.livemode !== false || idOf(subscription.customer) !== customer || subscription.items?.has_more) {
        throw new BillingError('billing_unavailable');
      }
      records.push(subscription);
    }
    if (!page.has_more) break;
    // Fail closed rather than silently granting access from an incomplete snapshot.
    if (!page.data.length || records.length >= 1000) throw new BillingError('billing_unavailable');
    cursor = page.data.at(-1).id;
  } while (true);
  return records;
}
const isPep = subscription => subscription.items?.data?.some(item => idOf(item.price?.product) === PEP_PRODUCT);

// Stripe's current item periods are authoritative. Unpaid/paused/expired states never grant access.
export function subscriptionSnapshot(subscriptions, now) {
  return subscriptions.filter(isPep).map(subscription => {
    const items = subscription.items.data.filter(item => idOf(item.price?.product) === PEP_PRODUCT);
    const periodEnd = Math.min(...items.map(item => item.current_period_end));
    let access = 'inactive', until = null;
    const paid = subscription.status === 'active' && subscription.latest_invoice?.status === 'paid';
    const trial = subscription.status === 'trialing' && Number.isFinite(subscription.trial_end);
    if (!subscription.pause_collection && (paid || trial) && Number.isFinite(periodEnd)) {
      const end = Math.min(periodEnd, trial ? subscription.trial_end : Infinity,
        subscription.cancel_at || Infinity);
      if (end > now) { access = trial ? 'trial' : 'active'; until = new Date(end * 1000).toISOString(); }
    }
    return {subscription_id:subscription.id, status:subscription.status, access_status:access,
      valid_until:until, cancel_at_period_end:!!subscription.cancel_at_period_end};
  });
}
async function customerFor(runtime, companyId) {
  const existing = await runtime.db.customer(companyId);
  if (existing) return existing;
  // Stable parameters make concurrent requests share one idempotent customer creation.
  const customer = await runtime.stripe().customers.create({description:'Ladenfluss Unternehmenskonto'},
    {idempotencyKey:'ladenfluss:customer:' + companyId});
  if (customer.livemode !== false) throw new BillingError('billing_not_configured');
  return runtime.db.saveCustomer(companyId, customer.id);
}
async function checkout(runtime, companyId) {
  if (!checkoutReady(runtime.config)) throw new BillingError('billing_not_configured');
  const price = await getPrice(runtime);
  const customer = await customerFor(runtime, companyId), lease = runtime.uuid();
  if (!await runtime.db.lock(companyId, lease)) throw new BillingError('billing_busy', 409);
  try {
    const stripe = runtime.stripe(), latest = await runtime.db.customer(companyId);
    const subscriptions = await allSubscriptions(stripe, customer.stripe_customer_id);
    if (subscriptions.some(sub => isPep(sub) && !TERMINAL.has(sub.status))) {
      throw new BillingError('subscription_exists', 409);
    }
    let attempt = latest.checkout_request;
    if (attempt?.session_id) {
      const session = await stripe.checkout.sessions.retrieve(attempt.session_id);
      if (idOf(session.customer) !== customer.stripe_customer_id || session.livemode !== false) throw new BillingError('billing_unavailable');
      if (session.status === 'open') {
        if (attempt.params.line_items[0].price !== price.id) throw new BillingError('checkout_pending', 409);
        return {url:stripeURL(session.url, 'checkout.stripe.com'), sandbox:true};
      }
      attempt = null;
    }
    // A crashed request is retried with the exact same Stripe parameters and key.
    // After 25 hours any unknown default-lifetime session has already expired.
    if (attempt && runtime.now() - attempt.created_at > 25 * 3600) attempt = null;
    if (attempt && attempt.params.line_items[0].price !== price.id) throw new BillingError('checkout_pending', 409);
    if (!attempt) {
      const nonce = runtime.uuid();
      const suffix = nonce.replace(/-/g, '').slice(0, 8).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
      attempt = {key:'ladenfluss:checkout:' + nonce, created_at:runtime.now(), params:{
        mode:'subscription', customer:customer.stripe_customer_id,
        line_items:[{price:price.id,quantity:1}], subscription_data:{billing_mode:{type:'flexible'}},
        integration_identifier:'ladenfluss_pep_' + suffix,
        success_url:runtime.config.appOrigin + '/konto?billing=returned',
        cancel_url:runtime.config.appOrigin + '/konto?billing=cancelled'
      }};
      await runtime.db.saveCheckout(companyId, lease, attempt);
    }
    const session = await stripe.checkout.sessions.create(attempt.params, {idempotencyKey:attempt.key});
    if (session.livemode !== false || idOf(session.customer) !== customer.stripe_customer_id || session.status !== 'open') {
      throw new BillingError('billing_unavailable');
    }
    await runtime.db.saveCheckout(companyId, lease, {...attempt,session_id:session.id});
    return {url:stripeURL(session.url, 'checkout.stripe.com'), sandbox:true};
  } finally { await runtime.db.release(companyId, lease).catch(() => {}); }
}
export function createBillingHandler(getRuntime, origins = BILLING_ORIGINS) {
  return async request => {
    const origin = request.headers.get('origin');
    const headers = {'vary':'Origin', 'access-control-allow-origin':origins.includes(origin) ? origin : 'null',
      'access-control-allow-headers':'authorization, apikey, content-type, x-client-info',
      'access-control-allow-methods':'POST, OPTIONS'};
    if (!origins.includes(origin)) return json({error:'origin_not_allowed'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return json({error:'method_not_allowed'},405,headers);
    try {
      const bearer = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/i)?.[1];
      if (!bearer) throw new BillingError('sign_in_required',401);
      let body;
      try { body = JSON.parse(await readBody(request,4096)); } catch (error) {
        if (error instanceof BillingError) throw error;
        throw new BillingError('invalid_request',400);
      }
      if (!body || !UUID.test(body.companyId) || !['status','checkout','portal'].includes(body.action) ||
          Object.keys(body).some(key => !['action','companyId'].includes(key))) throw new BillingError('invalid_request',400);
      const runtime = getRuntime();
      // This verifies a real user with Auth and reads current membership under their RLS context.
      await runtime.authorize(bearer, body.companyId);
      if (body.action === 'status') {
        const customer = await runtime.db.customer(body.companyId);
        const ready = checkoutReady(runtime.config);
        const price = ready ? await getPrice(runtime) : null;
        return json({available:!!price, sandbox:true, canManage:!!customer && stripeReady(runtime.config) && !!runtime.config.portalConfiguration,
          price:price ? {amount:price.unit_amount,currency:price.currency,interval:'month',taxBehavior:price.tax_behavior} : null},200,headers);
      }
      if (body.action === 'checkout') return json(await checkout(runtime,body.companyId),200,headers);
      if (!stripeReady(runtime.config) || !runtime.config.portalConfiguration) throw new BillingError('billing_not_configured');
      const customer = await runtime.db.customer(body.companyId);
      if (!customer) throw new BillingError('no_subscription',409);
      const session = await runtime.stripe().billingPortal.sessions.create({customer:customer.stripe_customer_id,
        configuration:runtime.config.portalConfiguration,return_url:runtime.config.appOrigin + '/konto'});
      return json({url:stripeURL(session.url, 'billing.stripe.com'),sandbox:true},200,headers);
    } catch (error) { return failure(error,headers); }
  };
}
export function createWebhookHandler(getRuntime) {
  return async request => {
    if (request.method !== 'POST') return json({error:'method_not_allowed'},405);
    try {
      const signature = request.headers.get('stripe-signature');
      if (!signature) throw new BillingError('invalid_signature',400);
      const body = await readBody(request,262144), runtime = getRuntime();
      if (!stripeReady(runtime.config)) throw new BillingError('billing_not_configured');
      let event;
      try { event = await runtime.verifyEvent(body,signature); }
      catch { throw new BillingError('invalid_signature',400); }
      if (event.livemode !== false || event.account) throw new BillingError('wrong_stripe_environment',400);
      if (!/^evt_/.test(event.id || '')) throw new BillingError('invalid_event',400);
      if (!EVENTS.has(event.type) && !event.type.startsWith('customer.subscription.')) return json({received:true,ignored:true});
      const object = event.data?.object;
      // A completed asynchronous checkout is not proof of payment.
      if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type) &&
          object?.payment_status !== 'paid' && object?.payment_status !== 'no_payment_required') {
        return json({received:true,waiting:true});
      }
      const customerId = idOf(object?.customer);
      if (!/^cus_/.test(customerId || '')) throw new BillingError('invalid_event',400);
      const customer = await runtime.db.customerByStripeId(customerId);
      if (!customer) return json({received:true,ignored:true});
      const lease = runtime.uuid();
      if (!await runtime.db.lock(customer.company_id,lease)) throw new BillingError('billing_busy',409);
      try {
        if (await runtime.db.hasEvent(event.id)) return json({received:true,duplicate:true});
        // Re-fetch current Stripe state after acquiring the lease: delivery order cannot undo a cancellation.
        const subscriptions = await allSubscriptions(runtime.stripe(),customerId);
        const snapshot = subscriptionSnapshot(subscriptions,runtime.now());
        await runtime.db.finishEvent(customer.company_id,lease,event.id,snapshot);
        return json({received:true});
      } finally { await runtime.db.release(customer.company_id,lease).catch(() => {}); }
    } catch (error) { return failure(error); }
  };
}
