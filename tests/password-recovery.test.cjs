'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {JSDOM}=require('jsdom');

const root=resolve(__dirname,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const USER_ID='11111111-1111-4111-8111-111111111111';
const OTHER_ID='22222222-2222-4222-8222-222222222222';
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(done=>setImmediate(done));};

async function createPage({enabled=true, userId=USER_ID, recoveryUserId=null}={}) {
  const dom=new JSDOM(read('passwort-zuruecksetzen.html'),{
    url:'https://ladenfluss.de/passwort-zuruecksetzen',runScripts:'outside-only',
  });
  const win=dom.window, calls=[];
  let verifiedId=userId, recoveryId=recoveryUserId;
  const callbacks=[];
  const client={auth:{}};
  win.LadenflussSupabase={
    isEnabled:()=>enabled,
    getClient:async()=>client,
    getRecoveryUserId:()=>recoveryId,
    clearRecovery:()=>{recoveryId=null;callbacks.forEach(fn=>fn(null));},
    subscribeRecovery:fn=>{callbacks.push(fn);return ()=>{};},
  };
  win.LadenflussAuthCore={createAuthCore:()=>({
    async validatedUser(){
      calls.push('getUser');
      return verifiedId?{id:verifiedId,email:'test@example.org'}:null;
    },
    async updatePassword(password){calls.push(['updatePassword',password]);return {updated:true};},
  })};
  win.eval(read('assets/password-reset.js'));
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  await flush();
  return {
    dom,win,calls,
    setVerifiedId:id=>{verifiedId=id;},
    emitRecovery(id){recoveryId=id;callbacks.forEach(fn=>fn(recoveryId));},
    flush:async()=>{await new Promise(done=>setTimeout(done,8));await flush();},
    close:()=>dom.window.close(),
  };
}

test('ordinary authenticated users cannot reset password without recovery link',async()=>{
  const x=await createPage();
  assert.equal(x.win.document.getElementById('passwordResetForm').hidden,true);
  assert.match(x.win.document.getElementById('passwordResetStatus').textContent,/Wiederherstellungslink erforderlich/);
  x.win.document.getElementById('passwordResetForm')
    .dispatchEvent(new x.win.Event('submit',{cancelable:true,bubbles:true}));
  await x.flush();
  assert.equal(x.calls.some(c=>Array.isArray(c)&&c[0]==='updatePassword'),false);
  x.close();
});

test('actual recovery event unlocks form, verifies user and signs out after change',async()=>{
  const x=await createPage();
  x.emitRecovery(USER_ID);
  await x.flush();
  const doc=x.win.document,form=doc.getElementById('passwordResetForm');
  assert.equal(form.hidden,false);
  doc.getElementById('newPassword').value='a-very-strong-password';
  doc.getElementById('confirmPassword').value='a-very-strong-password';
  form.dispatchEvent(new x.win.Event('submit',{cancelable:true,bubbles:true}));
  await x.flush();
  assert.ok(x.calls.some(c=>Array.isArray(c)&&c[0]==='updatePassword'&&c[1]==='a-very-strong-password'));
  assert.equal(form.hidden,true);
  assert.match(doc.getElementById('passwordResetStatus').textContent,/Passwort geändert/);
  x.close();
});

test('recovery grant from a different user does not unlock the form',async()=>{
  const x=await createPage({userId:USER_ID,recoveryUserId:OTHER_ID});
  assert.equal(x.win.document.getElementById('passwordResetForm').hidden,true);
  assert.match(x.win.document.getElementById('passwordResetStatus').textContent,/Kein gültiger Reset-Link/);
  x.close();
});

test('session switching after verification blocks password change',async()=>{
  const x=await createPage({recoveryUserId:USER_ID});
  const doc=x.win.document,form=doc.getElementById('passwordResetForm');
  assert.equal(form.hidden,false);
  doc.getElementById('newPassword').value='another-strong-password';
  doc.getElementById('confirmPassword').value='another-strong-password';
  x.setVerifiedId(OTHER_ID);
  form.dispatchEvent(new x.win.Event('submit',{cancelable:true,bubbles:true}));
  await x.flush();
  assert.equal(x.calls.some(c=>Array.isArray(c)&&c[0]==='updatePassword'),false);
  assert.equal(form.hidden,true);
  x.close();
});

test('loss of recovery session hides form again',async()=>{
  const x=await createPage({recoveryUserId:USER_ID});
  assert.equal(x.win.document.getElementById('passwordResetForm').hidden,false);
  x.emitRecovery(null);
  await x.flush();
  assert.equal(x.win.document.getElementById('passwordResetForm').hidden,true);
  x.close();
});

test('a disabled beta cannot accept reset submissions',async()=>{
  const x=await createPage({enabled:false,recoveryUserId:USER_ID});
  assert.equal(x.win.document.getElementById('passwordResetForm').hidden,true);
  assert.match(x.win.document.getElementById('passwordResetStatus').textContent,/Beta/);
  x.close();
});

test('browser bootstrap caches PASSWORD_RECOVERY and invalidates it on new login',async()=>{
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{
    url:'https://ladenfluss.de/passwort-zuruecksetzen',runScripts:'outside-only',
  });
  const win=dom.window;
  win.LadenflussCloudConfig={
    enabled:true,
    url:'https://test-project.supabase.co',
    publishableKey:'sb_publishable_local_test_123456',
  };
  const listeners=[];
  win.__loadSdk=async()=>({
    createClient:()=>({auth:{
      onAuthStateChange:handler=>{
        listeners.push(handler);
        return {data:{subscription:{unsubscribe:()=>{}}}};
      },
    }}),
  });
  // Replace *only* the module loader with a deterministic SDK stub.
  // This exercises the production event-capture code without a live auth server.
  const script=read('assets/supabase-browser.js').replace(
    'import(SDK_URL)','root.__loadSdk(SDK_URL)'
  );
  assert.match(script,/__loadSdk/);
  win.eval(script);
  await win.LadenflussSupabase.getClient();
  assert.equal(listeners.length,1);
  const notifications=[];
  win.LadenflussSupabase.subscribeRecovery(id=>notifications.push(id));
  listeners[0]('PASSWORD_RECOVERY',{user:{id:USER_ID}});
  assert.equal(win.LadenflussSupabase.getRecoveryUserId(),USER_ID);
  listeners[0]('SIGNED_IN',{user:{id:OTHER_ID}});
  assert.equal(win.LadenflussSupabase.getRecoveryUserId(),null);
  listeners[0]('PASSWORD_RECOVERY',{user:{id:USER_ID}});
  listeners[0]('SIGNED_OUT',null);
  assert.deepEqual(notifications,[USER_ID,null,USER_ID,null]);
  dom.window.close();
});
