'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuthCore,normalizeEmail,redirectUrl}=require('../assets/auth-core.js');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {JSDOM}=require('jsdom');
const root=resolve(__dirname,'..');

function fakeClient() {
  const calls=[];
  let current=null;
  const client={
    calls,
    changeUser(value){current=value;},
    auth:{
      async signUp(args){calls.push(['signUp',args]);return {data:{session:null},error:null};},
      async signInWithPassword(args){
        calls.push(['signIn',args]);
        current={id:'u1',email:args.email,email_confirmed_at:'2026-10-10T09:00:00Z'};
        return {data:{user:current},error:null};
      },
      async getSession(){calls.push(['getSession']);return {data:{session:current?{access_token:'fake'}:null},error:null};},
      async getUser(){calls.push(['getUser']);return {data:{user:current},error:null};},
      async resetPasswordForEmail(email,options){calls.push(['reset',email,options]);return {error:null};},
      async updateUser(args){calls.push(['updateUser',args]);return {error:null};},
      async signOut(){calls.push(['signOut']);current=null;return {error:null};},
    },
    from(table) {
      assert.equal(table,'companies');
      return {
        select(cols){calls.push(['select',cols]);return this;},
        order(){return this;},limit(){return this;},
        async maybeSingle(){return {data:null,error:null};},
      };
    },
  };
  return client;
}
const origin='https://ladenfluss.de';
test('sign-up requires email, strong password and uses same-origin confirmation redirect',async()=>{
  const client=fakeClient(),auth=createAuthCore(client,{origin});
  await assert.rejects(auth.signUp('invalid','goodpassword123'),{code:'INVALID_EMAIL'});
  await assert.rejects(auth.signUp('a@example.org','short'),{code:'INVALID_PASSWORD'});
  assert.deepEqual(await auth.signUp('  A@Example.org  ','goodpassword123'),{confirmationRequired:true});
  const call=client.calls.find(x=>x[0]==='signUp');
  assert.equal(call[1].email,'a@example.org');
  assert.equal(call[1].options.emailRedirectTo,'https://ladenfluss.de/konto');
  assert.equal(client.calls.filter(x=>x[0]==='signUp').length,1);
});

test('sign-in returns server-verified account, queries companies, and can sign out',async()=>{
  const c=fakeClient(),auth=createAuthCore(c,{origin});
  const user=await auth.signIn('USER@example.org','password');
  assert.deepEqual(user,{id:'u1',email:'user@example.org'});
  assert.ok(c.calls.some(x=>x[0]==='getUser'));
  assert.equal(await auth.firstCompany(),null);
  assert.ok(c.calls.some(x=>x[0]==='select'&&x[1]==='id,name'));
  await auth.signOut();
  assert.equal(await auth.validatedUser(),null);
});

test('unconfirmed email cannot become verified UI session',async()=>{
  const c=fakeClient();c.auth.signInWithPassword=async(args)=>{
    c.changeUser({id:'u1',email:args.email,email_confirmed_at:null});
    return {data:{},error:null};
  };
  const auth=createAuthCore(c,{origin});
  await assert.rejects(auth.signIn('a@example.org','valid'),{code:'EMAIL_UNVERIFIED'});
  assert.ok(c.calls.some(x=>x[0]==='signOut'));
});

test('recovery sends allowed URL and requires verified session for password update',async()=>{
  const c=fakeClient(),auth=createAuthCore(c,{origin});
  await auth.requestPasswordReset('A@example.org');
  assert.deepEqual(c.calls.find(x=>x[0]==='reset'),[
    'reset','a@example.org',{redirectTo:'https://ladenfluss.de/passwort-zuruecksetzen'},
  ]);
  await assert.rejects(auth.updatePassword('newstrongpassword'),{code:'AUTH_REQUIRED'});
  c.changeUser({id:'u1',email:'a@example.org',email_confirmed_at:'2026-10-10T00:00:00Z'});
  await assert.rejects(auth.updatePassword('short'),{code:'INVALID_PASSWORD'});
  await auth.updatePassword('newstrongpassword');
  assert.ok(c.calls.some(x=>x[0]==='updateUser'&&x[1].password==='newstrongpassword'));
  assert.ok(c.calls.some(x=>x[0]==='signOut'));
});

test('redirect target origin rejects plain HTTP and remote redirects',()=>{
  assert.equal(redirectUrl('http://localhost:5173','/konto'),'http://localhost:5173/konto');
  assert.throws(()=>redirectUrl('http://example.org','/konto'),{code:'INVALID_ORIGIN'});
  assert.equal(normalizeEmail('Test@EXAMPLE.DE '),'test@example.de');
});

async function renderAccount({enabled=true,client=fakeClient(),isSignedIn=false}={}) {
  if (isSignedIn) client.changeUser({id:'u1',email:'test@example.de',email_confirmed_at:'2026-10-10T00:00:00Z'});
  const dom=new JSDOM(readFileSync(resolve(root,'konto.html'),'utf8'),{
    url:'https://ladenfluss.de/konto',runScripts:'outside-only',
  });
  const w=dom.window;
  w.LadenflussAuthCore=require('../assets/auth-core.js');
  w.LadenflussSupabase={isEnabled:()=>enabled,getClient:async()=>client};
  w.LadenflussLocalPrivacy=require('../assets/local-privacy.js');
  w.confirm=()=>true;
  w.eval(readFileSync(resolve(root,'assets/account.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
  await flush();
  return {dom,w,client,flush,close:()=>dom.window.close()};
}
test('account UI shows disabled beta without sending credentials',async()=>{
  const t=await renderAccount({enabled:false});
  const login=t.w.document.querySelector('[data-auth-form=login]');
  login.querySelector('input[type=email]').value='someone@example.org';
  login.querySelector('input[type=password]').value='not-sent';
  login.dispatchEvent(new t.w.Event('submit',{cancelable:true,bubbles:true}));
  await t.flush();
  assert.match(t.w.document.getElementById('authStatus').textContent,/noch nicht freigeschaltet/i);
  assert.equal(t.client.calls.length,0);
  t.close();
});

test('account UI registers without reflecting HTML and clears password field',async()=>{
  const t=await renderAccount();
  const w=t.w,form=w.document.querySelector('[data-auth-form=register]');
  form.querySelector('input[type=email]').value='a@example.org';
  form.querySelector('input[type=password]').value='securelongpassword';
  form.querySelector('input[type=checkbox]').checked=true;
  form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
  await t.flush();
  assert.equal(t.client.calls.filter(x=>x[0]==='signUp').length,1);
  assert.equal(form.querySelector('input[type=password]').value,'');
  assert.match(w.document.getElementById('authStatus').textContent,/E-Mail prüfen/);
  t.close();
});

test('signed-in account UI shows logout and verified email as plain text',async()=>{
  const t=await renderAccount({isSignedIn:true});
  assert.equal(t.w.document.getElementById('signedInPanel').hidden,false);
  assert.equal(t.w.document.getElementById('accountEmail').textContent,'test@example.de');
  assert.equal(t.w.document.getElementById('accountNext').getAttribute('href'),'/onboarding');
  t.w.document.getElementById('accountLogout').click();
  await t.flush();
  assert.equal(t.w.document.getElementById('signedInPanel').hidden,true);
  assert.ok(t.client.calls.some(x=>x[0]==='signOut'));
  t.close();
});

test('password reset UI remains disabled without cloud and displays no form',async()=>{
  const dom=new JSDOM(readFileSync(resolve(root,'passwort-zuruecksetzen.html'),'utf8'),{
    url:'https://ladenfluss.de/passwort-zuruecksetzen',runScripts:'outside-only',
  });
  const w=dom.window;
  w.LadenflussSupabase={isEnabled:()=>false};
  w.eval(readFileSync(resolve(root,'assets/password-reset.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.getElementById('passwordResetForm').hidden,true);
  assert.match(w.document.getElementById('passwordResetStatus').textContent,/Beta/);
  dom.window.close();
});

async function renderOnboarding({enabled=true,verified=true}={}) {
  const dom=new JSDOM(readFileSync(resolve(root,'onboarding.html'),'utf8'),{
    url:'https://ladenfluss.de/onboarding',runScripts:'outside-only',
  });
  const w=dom.window,client=fakeClient();
  const user=verified
    ? {id:'u1',email:'test@example.de',email_confirmed_at:'2026-10-10T00:00:00Z'}
    : null;
  client.changeUser(user);
  client.rpc=async(fn,args)=>{
    client.calls.push(['rpc',fn,args]);
    return {data:[{company_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      branch_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}],error:null};
  };
  w.LadenflussAuthCore=require('../assets/auth-core.js');
  w.LadenflussSupabase={isEnabled:()=>enabled,getClient:async()=>client};
  w.eval(readFileSync(resolve(root,'assets/onboarding.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
  await flush();
  return {dom,w,client,flush,close:()=>dom.window.close()};
}

test('onboarding is read-only when cloud beta is disabled',async()=>{
  const t=await renderOnboarding({enabled:false});
  t.w.document.getElementById('companyOnboarding')
    .dispatchEvent(new t.w.Event('submit',{cancelable:true,bubbles:true}));
  await t.flush();
  assert.equal(t.client.calls.length,0);
  assert.match(t.w.document.getElementById('onboardingStatus').textContent,/noch geschlossen|Vorbereitung/);
  t.close();
});

test('verified user creates company and branch with one atomic RPC',async()=>{
  const t=await renderOnboarding();
  const w=t.w;
  w.document.getElementById('company_name').value='Testunternehmen';
  w.document.getElementById('company_type').value='Lebensmittel';
  w.document.getElementById('branch_name').value='Innenstadt';
  w.document.getElementById('branch_days').value='6';
  w.document.getElementById('branch_hours').value='9.5';
  w.document.getElementById('companyOnboarding')
    .dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
  await t.flush();
  const r=t.client.calls.filter(x=>x[0]==='rpc');
  assert.equal(r.length,1);
  assert.equal(r[0][1],'create_company_onboarding');
  assert.deepEqual(JSON.parse(JSON.stringify(r[0][2])),{
    p_company_name:'Testunternehmen',p_retail_type:'Lebensmittel',p_branch_name:'Innenstadt',
    p_opening_days:6,p_opening_hours:9.5,
  });
  assert.equal(w.document.getElementById('companyOnboarding').hidden,true);
  assert.match(w.document.getElementById('onboardingStatus').textContent,/gemeinsam gespeichert/);
  t.close();
});

test('invalid hours and unverified sessions never invoke company RPC',async()=>{
  const t=await renderOnboarding();
  const w=t.w;
  w.document.getElementById('company_name').value='Testunternehmen';
  w.document.getElementById('company_type').value='Lebensmittel';
  w.document.getElementById('branch_name').value='Innenstadt';
  w.document.getElementById('branch_days').value='9';
  w.document.getElementById('companyOnboarding')
    .dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
  await t.flush();
  assert.equal(t.client.calls.filter(x=>x[0]==='rpc').length,0);
  t.close();

  const unverified=await renderOnboarding({verified:false});
  const uw=unverified.w;
  uw.document.getElementById('company_name').value='Testunternehmen';
  uw.document.getElementById('company_type').value='Lebensmittel';
  uw.document.getElementById('branch_name').value='Innenstadt';
  uw.document.getElementById('companyOnboarding')
    .dispatchEvent(new uw.Event('submit',{cancelable:true,bubbles:true}));
  await unverified.flush();
  assert.equal(unverified.client.calls.filter(x=>x[0]==='rpc').length,0);
  unverified.close();
});

test('Supabase bootstrap refuses disabled and secret-key configurations',()=>{
  const dom=new JSDOM('<body></body>',{url:'https://ladenfluss.de/konto',runScripts:'outside-only'});
  const w=dom.window;
  w.LadenflussCloudConfig={enabled:false,url:'',publishableKey:''};
  w.eval(readFileSync(resolve(root,'assets/supabase-browser.js'),'utf8'));
  assert.equal(w.LadenflussSupabase.isEnabled(),false);
  w.LadenflussCloudConfig={enabled:true,url:'https://nzxtdrmdvqyvcbohplzt.supabase.co',publishableKey:'sb_secret_NOT_ALLOWED'};
  assert.throws(()=>w.LadenflussSupabase.isEnabled(),/konfiguriert/);
  dom.window.close();
});


test('logout with explicit device cleanup removes only Ladenfluss data after confirmation',async()=>{
  const t=await renderAccount({isSignedIn:true});
  const w=t.w;
  w.localStorage.setItem('ladenfluss.store.v1','{"name":"Shared device"}');
  w.localStorage.setItem('ladenfluss.cloud-draft.v2.user.company.profile','{"payload":1}');
  w.localStorage.setItem('other.application','keep');
  w.document.getElementById('accountLogoutClear').click();
  await t.flush();
  assert.equal(w.localStorage.getItem('ladenfluss.store.v1'),null);
  assert.equal(w.localStorage.getItem('ladenfluss.cloud-draft.v2.user.company.profile'),null);
  assert.equal(w.localStorage.getItem('other.application'),'keep');
  assert.equal(w.document.getElementById('signedInPanel').hidden,true);
  assert.ok(t.client.calls.some(x=>x[0]==='signOut'));
  assert.match(w.document.getElementById('authStatus').textContent,/bereinigt/);
  t.close();
});

test('declining device cleanup preserves data and authenticated account',async()=>{
  const t=await renderAccount({isSignedIn:true});
  t.w.localStorage.setItem('ladenfluss.team.v1','private-data');
  t.w.confirm=()=>false;
  t.w.document.getElementById('accountLogoutClear').click();
  await t.flush();
  assert.equal(t.w.localStorage.getItem('ladenfluss.team.v1'),'private-data');
  assert.equal(t.w.document.getElementById('signedInPanel').hidden,false);
  assert.equal(t.client.calls.filter(x=>x[0]==='signOut').length,0);
  t.close();
});


test('loopback Supabase Auth config is accepted only on loopback websites, never hosted domains',()=>{
  const sdk=readFileSync(resolve(root,'assets/supabase-browser.js'),'utf8');
  const localKey='eyJ'+('A'.repeat(140));
  function browser(origin,config){
    const dom=new JSDOM('<!doctype html><title>Beta</title>',{url:origin,runScripts:'outside-only'});
    const w=dom.window;
    w.LadenflussCloudConfig={enabled:true,...config};
    w.eval(sdk);
    let passed,reason;
    try{passed=w.LadenflussSupabase.isEnabled();}catch(error){reason=error.message;}
    dom.window.close();
    return {passed,reason};
  }
  const local={url:'http://127.0.0.1:54321',publishableKey:localKey};
  assert.equal(browser('http://127.0.0.1:54330/konto',local).passed,true);
  assert.match(browser('https://ladenfluss.de/konto',local).reason,/konfiguriert/);
  assert.match(browser('https://staging.ladenfluss.de/konto',local).reason,/konfiguriert/);
  assert.match(browser('http://example.com/konto',local).reason,/konfiguriert/);
  assert.match(browser('http://127.0.0.1:54330/konto',{...local,url:'http://api.example.com:54321'}).reason,/konfiguriert/);
  assert.match(browser('https://ladenfluss.de/konto',{url:'http://nzxtdrmdvqyvcbohplzt.supabase.co',publishableKey:'sb_publishable_demo'}).reason,/konfiguriert/);
  assert.equal(browser('https://ladenfluss.de/konto',{url:'https://nzxtdrmdvqyvcbohplzt.supabase.co',publishableKey:'sb_publishable_demo'}).passed,true);
});


test('account blocks form submissions until asynchronous Supabase SDK initialization is finished',async()=>{
  const dom=new JSDOM(readFileSync(resolve(root,'konto.html'),'utf8'),{
    url:'https://ladenfluss.de/konto',runScripts:'outside-only',
  });
  const w=dom.window;
  const client=fakeClient();
  let releaseClient;
  w.LadenflussAuthCore=require('../assets/auth-core.js');
  w.LadenflussSupabase={
    isEnabled:()=>true,
    getClient:()=>new Promise(resolve=>{releaseClient=()=>resolve(client);}),
  };
  w.eval(readFileSync(resolve(root,'assets/account.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const form=w.document.querySelector('[data-auth-form=login]');
  assert.equal(form.querySelector('button[type=submit]').disabled,true);
  form.querySelector('input[type=email]').value='user@example.org';
  form.querySelector('input[type=password]').value='secure-password';
  form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
  assert.equal(client.calls.length,0);
  releaseClient();
  for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(form.querySelector('button[type=submit]').disabled,false);
  assert.match(w.document.getElementById('authStatus').textContent,/Sicher anmelden/);
  dom.window.close();
});
