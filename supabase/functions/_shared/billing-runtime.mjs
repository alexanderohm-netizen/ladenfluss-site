import Stripe from 'npm:stripe@23.0.0';
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {BillingError} from './billing-core.mjs';

const checked = async query => { const {data,error} = await query; if (error) throw new BillingError('billing_unavailable'); return data; };
export function getRuntime() {
  const env = name => Deno.env.get(name);
  const url = env('SUPABASE_URL');
  const publishable = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}').default;
  const secret = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}').default;
  if (!url || !publishable || !secret) throw new BillingError('billing_not_configured');
  const authOptions = {persistSession:false,autoRefreshToken:false,detectSessionInUrl:false};
  const admin = createClient(url,secret,{auth:authOptions});
  const appOrigin = env('BILLING_APP_ORIGIN') || 'https://www.ladenfluss.de';
  if (!['https://www.ladenfluss.de','https://ladenfluss-site-git-feature-cloud-foundation-warenfluss.vercel.app'].includes(appOrigin)) {
    throw new BillingError('billing_not_configured');
  }
  const config = {appOrigin,enabled:env('BILLING_CHECKOUT_ENABLED') === 'true',
    stripeKey:env('STRIPE_RESTRICTED_KEY'),webhookSecret:env('STRIPE_WEBHOOK_SIGNING_SECRET'),
    priceId:env('STRIPE_PEP_PRICE_ID'),portalConfiguration:env('STRIPE_PORTAL_CONFIGURATION_ID')};
  let stripeClient;
  const stripe = () => {
    if (!/^rk_test_/.test(config.stripeKey || '')) throw new BillingError('billing_not_configured');
    return stripeClient ||= new Stripe(config.stripeKey,{httpClient:Stripe.createFetchHttpClient(),timeout:10000,maxNetworkRetries:1});
  };
  const rpc = (name,args) => checked(admin.rpc(name,args));
  return {config,stripe,now:() => Math.floor(Date.now()/1000),uuid:() => crypto.randomUUID(),
    async authorize(token,companyId) {
      const client = createClient(url,publishable,{auth:authOptions,global:{headers:{Authorization:'Bearer '+token}}});
      const {data,error} = await client.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) throw new BillingError('sign_in_required',401);
      const membership = await checked(client.from('company_members').select('role,status').eq('company_id',companyId).eq('user_id',data.user.id).maybeSingle());
      if (membership?.status !== 'active' || !['owner','admin'].includes(membership.role)) throw new BillingError('billing_forbidden',403);
    },
    verifyEvent:(body,signature) => stripe().webhooks.constructEventAsync(body,signature,config.webhookSecret,300,Stripe.createSubtleCryptoProvider()),
    db:{
      customer:company => checked(admin.from('billing_customers').select('company_id,stripe_customer_id,checkout_request').eq('company_id',company).maybeSingle()),
      customerByStripeId:customer => checked(admin.from('billing_customers').select('company_id,stripe_customer_id').eq('stripe_customer_id',customer).maybeSingle()),
      async saveCustomer(company,customer) {
        const result = await admin.from('billing_customers').insert({company_id:company,stripe_customer_id:customer});
        if (result.error && result.error.code !== '23505') throw new BillingError('billing_unavailable');
        const saved = await checked(admin.from('billing_customers').select('company_id,stripe_customer_id,checkout_request').eq('company_id',company).single());
        if (saved.stripe_customer_id !== customer) throw new BillingError('billing_unavailable');
        return saved;
      },
      lock:(company,token) => rpc('billing_acquire_lock',{target:company,lease:token}),
      release:(company,token) => rpc('billing_release_lock',{target:company,lease:token}),
      saveCheckout:(company,token,request) => rpc('billing_save_checkout',{target:company,lease:token,request}),
      hasEvent:async event => !!await checked(admin.from('billing_events').select('event_id').eq('event_id',event).maybeSingle()),
      finishEvent:(company,token,event,snapshot) => rpc('billing_finish_event',{target:company,lease:token,event_id:event,snapshot})
    }
  };
}
