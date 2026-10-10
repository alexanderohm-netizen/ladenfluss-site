'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const {createCloudSync,createSupabaseTransport}=require('../assets/cloud-sync-core.js');
const {createAuthCore}=require('../assets/auth-core.js');

const COMPANY='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER='11111111-1111-4111-8111-111111111111';
const defaultLocal={name:'Lokales Profil',days:6,hours:9};

async function makeUI({enabled=true,initialRemote=null}={}) {
  const html=[
    '<p id="cloudProfileStatus"></p>',
    '<button id="cloudProfileCheck" hidden>Prüfen</button>',
    '<button id="cloudProfileUpload" hidden>Hochladen</button>',
    '<button id="cloudProfileDownload" hidden>Übernehmen</button>',
    '<button id="cloudProfileRestore" hidden>Zurück</button>',
  ].join('');
  const dom=new JSDOM('<!doctype html><html><body>'+html+'</body></html>',{
    url:'https://ladenfluss.de/mein-laden',runScripts:'outside-only',
  });
  const w=dom.window;
  const calls=[];
  let remote=initialRemote && {revision:initialRemote.revision,payload:initialRemote.payload,updatedAt:'2026-10-10T00:00:00Z'};
  w.localStorage.setItem('ladenfluss.store.v1',JSON.stringify(defaultLocal));
  w.confirm=()=>true;
  w.LadenflussStoreSettings={
    read(){return JSON.parse(w.localStorage.getItem('ladenfluss.store.v1'));},
    validate(v){if(!v||typeof v.name!=='string')throw Error('invalid');return v;},
    save(v){w.localStorage.setItem('ladenfluss.store.v1',JSON.stringify(v));return v;},
  };
  const client={
    auth:{
      async getSession(){return {data:{session:{access_token:'fake'}},error:null};},
      async getUser(){return {data:{user:{id:USER,email:'alex@example.org',email_confirmed_at:'2026-10-10T09:00:00Z'}},error:null};},
      async signInWithPassword(){return {error:null};},
    },
    from(table) {
      if(table==='companies')return {
        select(){return this;},order(){return this;},limit(){return this;},
        async maybeSingle(){return {data:{id:COMPANY,name:'Testunternehmen'},error:null};},
      };
      assert.equal(table,'cloud_documents');
      return {
        select(){return this;},eq(){return this;},
        async maybeSingle(){calls.push('read');return {data:remote?{payload:remote.payload,revision:remote.revision,updated_at:remote.updatedAt}:null,error:null};},
      };
    },
    async rpc(name,args) {
      calls.push([name,args]);
      if(name==='create_cloud_document_if_absent') {
        if(remote)return {error:{code:'23505'}};
        remote={revision:1,payload:args.p_payload,updatedAt:'now'};
        return {data:[{saved_revision:1,saved_at:'now'}],error:null};
      }
      assert.equal(name,'save_cloud_document_if_revision');
      if(!remote||remote.revision!==args.p_expected_revision)return {error:{code:'40001'}};
      remote={revision:remote.revision+1,payload:args.p_payload,updatedAt:'now'};
      return {data:[{saved_revision:remote.revision,saved_at:'now'}],error:null};
    },
  };
  w.LadenflussSupabase={isEnabled:()=>enabled,getClient:async()=>client};
  w.LadenflussAuthCore={createAuthCore};
  w.LadenflussCloudSync={createCloudSync,createSupabaseTransport};
  w.eval(fs.readFileSync(path.resolve(__dirname,'../assets/cloud-profile.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const flush=async()=>{
    for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
  };
  await flush();
  return {w,client,calls,flush,remote:()=>remote,close:()=>dom.window.close()};
}

test('inactive cloud beta cannot inspect, upload or overwrite any data',async()=>{
  const t=await makeUI({enabled:false});
  assert.equal(t.w.document.getElementById('cloudProfileCheck').hidden,true);
  assert.equal(t.calls.length,0);
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  t.close();
});

test('manual profile check and explicit upload create a first cloud revision',async()=>{
  const t=await makeUI();
  assert.equal(t.calls.length,0);
  assert.equal(t.w.document.getElementById('cloudProfileCheck').hidden,false);
  t.w.document.getElementById('cloudProfileCheck').click();
  await t.flush();
  assert.equal(t.remote(),null);
  assert.equal(t.w.document.getElementById('cloudProfileUpload').hidden,false);
  t.w.document.getElementById('cloudProfileUpload').click();
  await t.flush();
  assert.equal(t.remote().revision,1);
  assert.equal(t.remote().payload.name,'Lokales Profil');
  assert.equal(t.calls.filter(x=>Array.isArray(x)&&x[0]==='create_cloud_document_if_absent').length,1);
  t.close();
});

test('cloud import protects previous profile via backup and can restore it',async()=>{
  const t=await makeUI({initialRemote:{revision:3,payload:{name:'Cloud Profil',days:5,hours:8}}});
  t.w.document.getElementById('cloudProfileCheck').click();
  await t.flush();
  assert.equal(t.w.document.getElementById('cloudProfileDownload').hidden,false);
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  t.w.document.getElementById('cloudProfileDownload').click();
  await t.flush();
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Cloud Profil');
  assert.equal(t.w.document.getElementById('cloudProfileRestore').hidden,false);
  const backup=t.w.localStorage.getItem('ladenfluss.cloud.profile-backup.v1.'+COMPANY);
  assert.equal(JSON.parse(backup).payload.name,'Lokales Profil');
  t.w.document.getElementById('cloudProfileRestore').click();
  await t.flush();
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  assert.equal(t.remote().payload.name,'Cloud Profil');
  t.close();
});

test('refused confirmation never uploads or overwrites a profile',async()=>{
  const t=await makeUI({initialRemote:{revision:2,payload:{name:'Cloud Profil',days:5,hours:8}}});
  t.w.confirm=()=>false;
  t.w.document.getElementById('cloudProfileCheck').click();
  await t.flush();
  t.w.document.getElementById('cloudProfileDownload').click();
  t.w.document.getElementById('cloudProfileUpload').click();
  await t.flush();
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  assert.equal(t.remote().payload.name,'Cloud Profil');
  assert.equal(t.calls.filter(x=>Array.isArray(x)).length,0);
  t.close();
});
