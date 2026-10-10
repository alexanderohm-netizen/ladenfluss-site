'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createCloudSync, createSupabaseTransport} = require('../assets/cloud-sync-core.js');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
function memoryStorage() {
  const data=new Map();
  return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>data.delete(k),dump:()=>new Map(data)};
}
function mockCloud() {
  const data=new Map([[A+'/vacation',{revision:1,payload:{days:2},updatedAt:'2026-10-10T00:00:00Z'}]]);
  const log=[];
  return {data, log,
    async create({companyId,moduleKey,payload}) {
      const key=companyId+'/'+moduleKey;
      if(companyId!==A) throw Object.assign(new Error('forbidden'),{code:'42501'});
      if(data.has(key)) throw Object.assign(new Error('duplicate'),{code:'23505'});
      data.set(key,{revision:1,payload,updatedAt:'2026-10-10T01:00:00Z'});
      return {revision:1,updatedAt:'2026-10-10T01:00:00Z'};
    },
    async read({companyId,moduleKey}) {return data.get(companyId+'/'+moduleKey)||null;},
    async write({companyId,moduleKey,expectedRevision,payload}) {
      log.push({companyId,moduleKey,expectedRevision,payload});
      if(companyId!==A) throw Object.assign(new Error('forbidden'),{code:'42501'});
      const key=companyId+'/'+moduleKey, cur=data.get(key);
      if(!cur||cur.revision!==expectedRevision) throw Object.assign(new Error('conflict'),{code:'40001'});
      const next={revision:cur.revision+1,updatedAt:'2026-10-10T01:00:00Z',payload};
      data.set(key,next);
      return {revision:next.revision,updatedAt:next.updatedAt};
    },
  };
}
const open=(transport,storage=memoryStorage(),companyId=A)=>createCloudSync({transport,storage,userId:A,companyId,moduleKey:'vacation'});

test('successful save increments revision, removes draft, and sends expected revision',async()=>{
  const api=mockCloud(),store=memoryStorage(),s=open(api,store);
  assert.equal((await s.load()).status,'synced');
  s.edit({days:5});assert.equal(s.state().status,'dirty');
  const result=await s.save();assert.equal(result.status,'synced');
  assert.equal(result.remote.revision,2);assert.equal(result.remote.payload.days,5);
  assert.equal(store.getItem(s.draftKey),null);assert.equal(api.log[0].expectedRevision,1);
});

test('two editors: stale revision enters conflict and NEVER discards local draft',async()=>{
  const api=mockCloud(),store2=memoryStorage(),one=open(api),two=open(api,store2);
  await Promise.all([one.load(),two.load()]);one.edit({days:10});two.edit({days:20});
  await one.save();await assert.rejects(two.save(),{code:'40001'});
  assert.equal(two.state().status,'conflict');assert.equal(two.state().draft.payload.days,20);
  assert.equal(api.data.get(A+'/vacation').payload.days,10);
  assert.ok(store2.getItem(two.draftKey));
  await assert.rejects(two.save(),{code:'REVISION_CONFLICT'});
  two.resolveConflict('keep-local');assert.equal(two.state().status,'dirty');
  await two.save();assert.equal(api.data.get(A+'/vacation').payload.days,20);
  assert.equal(api.data.get(A+'/vacation').revision,3);
});

test('explicit use-remote throws away local draft but never auto-resolves',async()=>{
  const api=mockCloud(),a=open(api),b=open(api);await a.load();await b.load();
  a.edit({days:3});b.edit({days:4});await a.save();await assert.rejects(b.save());
  b.resolveConflict('use-remote');assert.equal(b.state().draft,null);
  assert.equal(b.state().remote.payload.days,3);
});

test('offline network error preserves draft across app restart',async()=>{
  const api=mockCloud(),storage=memoryStorage(),s=open(api,storage);await s.load();s.edit({days:99});
  const offline={read:async()=>{throw new Error('offline');},write:async()=>{throw new Error('offline');}};
  const revived=open(offline,storage);
  await assert.rejects(revived.load(),/offline/);
  assert.equal(revived.state().status,'offline-draft');
  assert.deepEqual(revived.state().draft.payload,{days:99});
});

test('new edit while first save is in flight is never lost',async()=>{
  const api=mockCloud(),s=open(api);await s.load();s.edit({days:2});
  let release;
  const baseWrite=api.write.bind(api);
  api.write=async(args)=>{await new Promise(r=>{release=r;});return baseWrite(args);};
  const save=s.save();s.edit({days:3});release();await save;
  assert.equal(s.state().status,'dirty');
  assert.deepEqual(s.state().draft.payload,{days:3});
  assert.equal(s.state().draft.baseRevision,2);
});

test('invalid identifier or payload is rejected before writing',async()=>{
  const api=mockCloud();assert.throws(()=>open(api,memoryStorage(),'not-uuid'),TypeError);
  const s=open(api);await s.load();
  assert.throws(()=>s.edit([1,2]),TypeError);
  assert.throws(()=>s.edit({veryLarge:'ä'.repeat(600000)}),RangeError);
  assert.equal(api.log.length,0);
});

test('storage quota errors do not mutate state or claim persistence',async()=>{
  const api=mockCloud(),storage=memoryStorage();
  const original=storage.setItem;storage.setItem=()=>{throw new Error('quota');};
  const s=open(api,storage);await s.load();
  assert.throws(()=>s.edit({days:100}),{code:'DRAFT_PERSISTENCE_FAILED'});
  assert.equal(s.state().status,'synced');assert.equal(s.state().draft,null);
  storage.setItem=original;
});

test('corrupt local draft raises error without overwriting it',async()=>{
  const api=mockCloud(),storage=memoryStorage(),s=open(api,storage);
  storage.setItem(s.draftKey,'{corrupt');
  await assert.rejects(s.load(),{code:'INVALID_LOCAL_DRAFT'});
  assert.equal(storage.getItem(s.draftKey),'{corrupt');
});

test('foreign tenant cannot write when transport rejects permission',async()=>{
  const api=mockCloud();api.data.set(B+'/vacation',{revision:1,payload:{secret:true}});
  const s=open(api,memoryStorage(),B);await s.load();s.edit({secret:false});
  await assert.rejects(s.save(),{code:'42501'});
  assert.equal(api.data.get(B+'/vacation').payload.secret,true);
  assert.equal(s.state().hasUnsavedChanges,true);
});

test('Supabase adapter binds company, module, version and payload, maps response',async()=>{
  const calls=[];
  const stub={from(table){assert.equal(table,'cloud_documents');return {select(cols){calls.push(cols);return this;},eq(k,v){calls.push([k,v]);return this;},async maybeSingle(){return {data:{payload:{x:1},revision:4,updated_at:'now'},error:null};}};},async rpc(fn,args){calls.push([fn,args]);return {data:[{saved_revision:5,saved_at:'later'}],error:null};}};
  const api=createSupabaseTransport(stub);
  assert.equal((await api.read({companyId:A,moduleKey:'vacation'})).revision,4);
  assert.deepEqual(await api.write({companyId:A,moduleKey:'vacation',expectedRevision:4,payload:{x:2}}),{revision:5,updatedAt:'later'});
  assert.equal(calls.at(-1)[1].p_expected_revision,4);
});
test('initial cloud document create uses revision 1 and does not overwrite existing data',async()=>{
  const api=mockCloud(),storage=memoryStorage();
  const s=createCloudSync({transport:api,storage,userId:A,companyId:A,moduleKey:'profile'});
  assert.equal((await s.load()).status,'missing');
  s.edit({name:'First'});assert.equal(s.state().status,'dirty');
  await s.save();assert.equal(s.state().remote.revision,1);
  assert.equal(api.data.get(A+'/profile').payload.name,'First');
});

test('concurrent first create conflict preserves the other local draft',async()=>{
  const api=mockCloud(),one=createCloudSync({transport:api,storage:memoryStorage(),userId:A,companyId:A,moduleKey:'profile'}),
  two=createCloudSync({transport:api,storage:memoryStorage(),userId:A,companyId:A,moduleKey:'profile'});
  await one.load();await two.load();one.edit({name:'One'});two.edit({name:'Two'});
  await one.save();await assert.rejects(two.save(),{code:'23505'});
  assert.equal(two.state().status,'conflict');assert.equal(two.state().draft.payload.name,'Two');
  two.resolveConflict('keep-local');await two.save();
  assert.equal(api.data.get(A+'/profile').payload.name,'Two');
  assert.equal(api.data.get(A+'/profile').revision,2);
});

test('explicit draft discard keeps confirmed remote revision and removes unsent content',async()=>{
  const api=mockCloud(),storage=memoryStorage(),sync=open(api,storage);
  await sync.load();
  sync.edit({days:22});
  assert.ok(storage.getItem(sync.draftKey));
  const result=sync.discardDraft();
  assert.equal(result.status,'synced');
  assert.equal(result.draft,null);
  assert.equal(result.remote.payload.days,2);
  assert.equal(storage.getItem(sync.draftKey),null);
  assert.equal(api.log.length,0);
});

test('drafts from different signed-in accounts are never automatically reused',async()=>{
  const transport=mockCloud(),storage=memoryStorage();
  const first=createCloudSync({transport,storage,userId:A,companyId:A,moduleKey:'vacation'});
  await first.load();first.edit({days:42});
  const second=createCloudSync({transport,storage,userId:B,companyId:A,moduleKey:'vacation'});
  assert.notEqual(first.draftKey,second.draftKey);
  await second.load();
  assert.equal(second.state().draft,null);
  assert.equal(second.state().remote.payload.days,2);
  assert.ok(storage.getItem(first.draftKey));
});
