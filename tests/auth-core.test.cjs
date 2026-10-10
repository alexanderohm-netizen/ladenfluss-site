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
