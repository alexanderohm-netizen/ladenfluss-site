'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Cloud beta remains disabled until the real Supabase release gates pass',()=>{
  const context={window:{}};
  vm.runInNewContext(read('assets/cloud-config.js'),context,{filename:'assets/cloud-config.js'});
  assert.equal(context.window.LadenflussCloudConfig.enabled,false,
    'Do not activate Cloud Beta before Supabase Auth/SMTP/RLS E2E and an approved release');
  assert.equal(context.window.LadenflussCloudConfig.url,'');
  assert.equal(context.window.LadenflussCloudConfig.publishableKey,'');
});

test('public browser source contains no Supabase secret or service-role key',()=>{
  const files=fs.readdirSync(path.join(root,'assets')).filter(f=>f.endsWith('.js'));
  files.push('konto.html','onboarding.html','mein-laden.html','passwort-zuruecksetzen.html');
  for(const file of files){
    const source=read(file.startsWith('assets/')||file.endsWith('.html')?file:'assets/'+file);
    assert.doesNotMatch(source,/\bsb_secret_[A-Za-z0-9_-]{12,}\b/,file);
    assert.doesNotMatch(source,/eyJ[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{20,}/,file);
  }
});

test('all account/onboarding/cloud scripts are linked in the appropriate pages',()=>{
  const expected={
    'konto.html':['assets/cloud-config.js','assets/supabase-browser.js','assets/auth-core.js','assets/local-privacy.js','assets/account.js'],
    'onboarding.html':['assets/cloud-config.js','assets/supabase-browser.js','assets/auth-core.js','assets/onboarding.js'],
    'mein-laden.html':['assets/cloud-config.js','assets/supabase-browser.js','assets/auth-core.js','assets/cloud-sync-core.js','assets/cloud-profile.js'],
    'passwort-zuruecksetzen.html':['assets/cloud-config.js','assets/supabase-browser.js','assets/auth-core.js','assets/password-reset.js'],
  };
  for(const [page,scripts] of Object.entries(expected)){
    const body=read(page);
    for(const script of scripts){
      assert.ok(body.includes('src="/'+script+'"'),page+' must load '+script);
      assert.ok(fs.existsSync(path.join(root,script)),script+' must exist');
    }
  }
});

test('local privacy removal is opt-in, preserves unrelated storage and never wipes whole origin',()=>{
  const {listLocalKeys,clearLadenflussData}=require('../assets/local-privacy.js');
  const data=new Map([
    ['ladenfluss.store.v1','profile'],['ladenfluss.cloud-draft.v2.user.company.profile','draft'],
    ['sb-example-auth-token','session'],['other.app','unrelated'],
  ]);
  const storage={
    get length(){return data.size;},
    key:index=>[...data.keys()][index]??null,
    removeItem:key=>{data.delete(key);},
  };
  assert.deepEqual(listLocalKeys(storage).sort(),[
    'ladenfluss.cloud-draft.v2.user.company.profile','ladenfluss.store.v1',
  ]);
  assert.equal(clearLadenflussData(storage),2);
  assert.equal(data.get('sb-example-auth-token'),'session');
  assert.equal(data.get('other.app'),'unrelated');
});

test('logout cleanup requires a successful sign-out; failed sign-out retains local data',async()=>{
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM(read('konto.html'),{url:'https://ladenfluss.de/konto',runScripts:'outside-only'});
  const w=dom.window;
  const user={id:'11111111-1111-4111-8111-111111111111',email:'user@example.org',email_confirmed_at:'2026-10-10T09:00:00Z'};
  const client={
    auth:{
      async getSession(){return {data:{session:{access_token:'fake'}},error:null};},
      async getUser(){return {data:{user},error:null};},
      async signInWithPassword(){return {error:null};},
      async signOut(){return {error:{message:'network down'}};},
    },
    from(){return {select(){return this;},order(){return this;},limit(){return this;},async maybeSingle(){return {data:{id:'company'},error:null};}};},
  };
  w.localStorage.setItem('ladenfluss.store.v1','must-survive');
  w.confirm=()=>true;
  w.LadenflussLocalPrivacy=require('../assets/local-privacy.js');
  w.LadenflussAuthCore=require('../assets/auth-core.js');
  w.LadenflussSupabase={isEnabled:()=>true,getClient:async()=>client};
  w.eval(read('assets/account.js'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise(resolve=>setImmediate(resolve));
  await new Promise(resolve=>setImmediate(resolve));
  w.document.getElementById('accountLogoutClear').click();
  await new Promise(resolve=>setImmediate(resolve));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.localStorage.getItem('ladenfluss.store.v1'),'must-survive');
  assert.match(w.document.getElementById('authStatus').textContent,/nicht vollständig/);
  dom.window.close();
});
