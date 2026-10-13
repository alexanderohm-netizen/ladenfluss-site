'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function setup(){
  const storage=new Map(),keys=new Map();
  const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const objectStore={get(k){const req={};queueMicrotask(()=>{req.result=keys.get(k);req.onsuccess?.();});return req;},put(v,k){const req={};queueMicrotask(()=>{keys.set(k,v);req.onsuccess?.();});return req;}};
  const db={objectStoreNames:{contains:()=>true},transaction:()=>({objectStore:()=>objectStore}),close(){}};
  const indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}};
  const ctx={crypto:webcrypto,indexedDB,localStorage,TextEncoder,TextDecoder,btoa,atob,Uint8Array,JSON,String,Error};
  ctx.globalThis=ctx;
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/personnel-local.js'),'utf8'),ctx);
  return {api:ctx.LadenflussPersonnelLocal,storage,keys};
}
test('Passwordless personnel records encrypt contact and IBAN without a passphrase',async()=>{
  const {api,storage}=setup();assert.equal(api.available(),true);
  await api.save('p1',{email:'test@example.de',phone:'+49 151 1234',address:'Musterweg 7',iban:'DE89370400440532013000',nationality:'Deutsch'});
  const raw=storage.get(api.PREFIX+'p1');assert.ok(raw);assert.doesNotMatch(raw,/Musterweg|test@example|DE8937/);
  const record=await api.read('p1');assert.equal(record.email,'test@example.de');assert.equal(record.iban,'DE89370400440532013000');
});
test('Older password-protected data is preserved, not overwritten',async()=>{
  const {api,storage}=setup();storage.set('ladenfluss.personalfluss.private.v1.p2','legacy ciphertext');
  assert.equal(api.legacyExists('p2'),true);
  await api.save('p2',{phone:'12345'});
  assert.equal(storage.get('ladenfluss.personalfluss.private.v1.p2'),'legacy ciphertext');
  assert.equal((await api.read('p2')).phone,'12345');
});
test('Missing browser key cannot silently overwrite existing encrypted record',async()=>{
  const {api,storage,keys}=setup();await api.save('p3',{address:'First'});const original=storage.get(api.PREFIX+'p3');keys.clear();
  await assert.rejects(api.read('p3'),/nicht geöffnet/);
  await assert.rejects(api.save('p3',{address:'Second'}),/nicht geöffnet/);
  assert.equal(storage.get(api.PREFIX+'p3'),original);
});
test('IBAN check and email validation reject invalid inputs',()=>{
  const {api}=setup();assert.throws(()=>api.validate({iban:'DE00370400440532013000'}),/Prüfziffer/);
  assert.throws(()=>api.validate({email:'not-an-email'}),/E-Mail/);
});
