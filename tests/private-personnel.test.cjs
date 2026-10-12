const test=require('node:test');const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const storage=new Map();
globalThis.crypto=webcrypto;
globalThis.localStorage={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,val)=>storage.set(key,String(val)),
  removeItem:key=>storage.delete(key)
};
const vault=require('../assets/private-personnel.js');
const employee='e-test-42',passphrase='Ein-lang-genuges-Testpasswort-2026!';
test('private personnel encrypts sensitive details separately from shared team storage',async()=>{
  assert.equal(vault.exists(employee),false);
  await vault.save(employee,passphrase,{address:'Musterstraße 3, 12345 Musterstadt',iban:'DE89370400440532013000',nationality:'',residenceStatus:'',residenceUntil:''});
  const encrypted=storage.get(vault.PREFIX+employee);
  assert.ok(encrypted);assert.doesNotMatch(encrypted,/Musterstra|DE8937/);
  assert.equal(storage.has('ladenfluss.team.v1'),false);
  const data=await vault.read(employee,passphrase);
  assert.equal(data.iban,'DE89370400440532013000');
  assert.equal(data.address,'Musterstraße 3, 12345 Musterstadt');
});
test('wrong passphrase cannot read or overwrite encrypted record',async()=>{
  const before=storage.get(vault.PREFIX+employee);
  await assert.rejects(vault.read(employee,'Falsche-passphrase-2026'),/Passphrase/);
  await assert.rejects(vault.save(employee,'Falsche-passphrase-2026',{address:'Falsch'}),/Passphrase/);
  assert.equal(storage.get(vault.PREFIX+employee),before);
});
test('invalid IBAN and overlong sensitive values are rejected',()=>{
  assert.throws(()=>vault.validate({iban:'DE00370400440532013000'}),/Prüfziffer/);
  assert.throws(()=>vault.validate({address:'x'.repeat(321)}),/zu lang/);
});
test('verified passphrase can update a record without exposing plaintext',async()=>{
  await vault.save(employee,passphrase,{address:'Neue Anschrift',iban:'DE89370400440532013000'});
  assert.equal((await vault.read(employee,passphrase)).address,'Neue Anschrift');
  assert.doesNotMatch(storage.get(vault.PREFIX+employee),/Neue Anschrift/);
});
