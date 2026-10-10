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
    '<button id="cloudProfileRecoverDraft" hidden>Entwurf wiederherstellen</button>',
  ].join('');
  const dom=new JSDOM('<!doctype html><html><body>'+html+'</body></html>',{
    url:'https://ladenfluss.de/mein-laden',runScripts:'outside-only',
  });
  const w=dom.window;
  const calls=[];
  let remote=initialRemote && {revision:initialRemote.revision,payload:initialRemote.payload,updatedAt:'2026-10-10T00:00:00Z'};
  let activeUserId=USER,failWrite=false;
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
      async getUser(){return {data:{user:{id:activeUserId,email:'alex@example.org',email_confirmed_at:'2026-10-10T09:00:00Z'}},error:null};},
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
      if(failWrite)return {error:{code:'NETWORK_ERROR',message:'offline'}};
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
  return {w,client,calls,flush,remote:()=>remote,setActiveUser(id){activeUserId=id;},setFailWrite(value){failWrite=value;},serverUpdate(payload){remote={revision:(remote?.revision||0)+1,payload,updatedAt:'later'};},close:()=>dom.window.close()};
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
  const backup=t.w.localStorage.getItem('ladenfluss.cloud.profile-backup.v2.'+USER+'.'+COMPANY);
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

test('cloud import refuses a version changed since the last inspection',async()=>{
  const t=await makeUI({initialRemote:{revision:2,payload:{name:'Cloud old',days:5,hours:8}}});
  t.w.document.getElementById('cloudProfileCheck').click();
  await t.flush();
  t.serverUpdate({name:'Cloud newer',days:6,hours:10});
  t.w.document.getElementById('cloudProfileDownload').click();
  await t.flush();
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  assert.match(t.w.document.getElementById('cloudProfileStatus').textContent,/seit der Prüfung geändert/);
  assert.equal(t.w.localStorage.getItem('ladenfluss.cloud.profile-backup.v2.'+USER+'.'+COMPANY),null);
  t.close();
});


test('an unsent draft is not overwritten when the local profile changes',async()=>{
  const t=await makeUI();
  const d=t.w.document;
  d.getElementById('cloudProfileCheck').click();await t.flush();
  t.setFailWrite(true);
  d.getElementById('cloudProfileUpload').click();await t.flush();
  const drafts=Object.keys(t.w.localStorage).filter(k=>k.startsWith('ladenfluss.cloud-draft.v2.'));
  assert.equal(drafts.length,1);
  assert.equal(JSON.parse(t.w.localStorage.getItem(drafts[0])).payload.name,'Lokales Profil');
  t.w.localStorage.setItem('ladenfluss.store.v1',JSON.stringify({name:'Neues Profil',days:5,hours:7}));
  d.getElementById('cloudProfileUpload').click();await t.flush();
  assert.equal(JSON.parse(t.w.localStorage.getItem(drafts[0])).payload.name,'Lokales Profil');
  assert.equal(t.remote(),null);
  assert.equal(d.getElementById('cloudProfileRecoverDraft').hidden,false);
  d.getElementById('cloudProfileRecoverDraft').click();await t.flush();
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  assert.equal(JSON.parse(t.w.localStorage.getItem('ladenfluss.cloud.profile-backup.v2.'+USER+'.'+COMPANY)).payload.name,'Neues Profil');
  t.close();
});

test('changing authenticated user revokes manual cloud actions without losing original draft',async()=>{
  const t=await makeUI();
  const d=t.w.document;
  d.getElementById('cloudProfileCheck').click();await t.flush();
  t.setActiveUser('22222222-2222-4222-8222-222222222222');
  d.getElementById('cloudProfileUpload').click();await t.flush();
  assert.equal(t.remote(),null);
  assert.equal(d.getElementById('cloudProfileUpload').hidden,true);
  assert.match(d.getElementById('cloudProfileStatus').textContent,/Anmeldung hat sich geändert/);
  t.close();
});

test('an older backup is not replaced when the user declines overwriting it',async()=>{
  const t=await makeUI({initialRemote:{revision:3,payload:{name:'Cloud Profil',days:5,hours:8}}});
  const d=t.w.document;
  const key='ladenfluss.cloud.profile-backup.v2.'+USER+'.'+COMPANY;
  t.w.localStorage.setItem(key,JSON.stringify({payload:{name:'Alte Sicherung'}}));
  let count=0;
  t.w.confirm=()=>++count===1;
  d.getElementById('cloudProfileCheck').click();await t.flush();
  d.getElementById('cloudProfileDownload').click();await t.flush();
  assert.equal(JSON.parse(t.w.localStorage.getItem(key)).payload.name,'Alte Sicherung');
  assert.equal(t.w.LadenflussStoreSettings.read().name,'Lokales Profil');
  assert.equal(t.remote().revision,3);
  t.close();
});


test('cross-tab storage event blocks stale upload until the other draft is checked',async()=>{
  const t=await makeUI({initialRemote:{revision:2,payload:{name:'Cloud A',days:5,hours:8}}});
  const d=t.w.document;
  d.getElementById('cloudProfileCheck').click();await t.flush();
  assert.equal(d.getElementById('cloudProfileUpload').hidden,false);
  const key='ladenfluss.cloud-draft.v2.'+USER+'.'+COMPANY+'.profile';
  const incoming={baseRevision:2,payload:{name:'Andere Registerkarte',days:6,hours:9}};
  t.w.localStorage.setItem(key,JSON.stringify(incoming));
  t.w.dispatchEvent(new t.w.StorageEvent('storage',{
    key,newValue:JSON.stringify(incoming),storageArea:t.w.localStorage,
  }));
  await t.flush();
  assert.equal(d.getElementById('cloudProfileUpload').hidden,true);
  assert.match(d.getElementById('cloudProfileStatus').textContent,/andere Ladenfluss-Registerkarte/);
  assert.equal(t.calls.filter(x=>Array.isArray(x)).length,0);
  d.getElementById('cloudProfileCheck').click();await t.flush();
  assert.equal(d.getElementById('cloudProfileRecoverDraft').hidden,false);
  assert.equal(JSON.parse(t.w.localStorage.getItem(key)).payload.name,'Andere Registerkarte');
  assert.equal(t.remote().revision,2);
  t.close();
});

test('silent cross-tab mutation is still detected synchronously before RPC upload',async()=>{
  const t=await makeUI({initialRemote:{revision:1,payload:{name:'Remote alt'}}});
  const d=t.w.document;
  d.getElementById('cloudProfileCheck').click();await t.flush();
  const key='ladenfluss.cloud-draft.v2.'+USER+'.'+COMPANY+'.profile';
  t.w.localStorage.setItem(key,JSON.stringify({baseRevision:1,payload:{name:'Fremder Entwurf'}}));
  d.getElementById('cloudProfileUpload').click();await t.flush();
  assert.equal(t.calls.filter(x=>Array.isArray(x)).length,0,'No RPC may fire');
  assert.equal(JSON.parse(t.w.localStorage.getItem(key)).payload.name,'Fremder Entwurf');
  assert.match(d.getElementById('cloudProfileStatus').textContent,/andere Registerkarte/);
  t.close();
});
