'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../assets/hourly-rates.js'),'utf8');
function createStore(seed={}){
  const data=new Map(Object.entries(seed));
  const localStorage={
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key),
  };
  const window={localStorage};
  vm.runInNewContext(source,{window,Object,Number,Math,JSON,Error});
  return {api:window.LadenflussHourlyRates,localStorage,data};
}
test('Stundenlohn in einem Profil direkt speichern und für Monate hochrechnen',()=>{
  const {api,data}=createStore({'ladenfluss.team.v1':'TEAM_UNCHANGED'});
  const paid=api.set('e1',19.66);
  assert.equal(paid.e1,19.66);
  assert.equal(api.get('e1'),19.66);
  assert.equal(api.get('e2'),null);
  assert.equal(data.get('ladenfluss.team.v1'),'TEAM_UNCHANGED');
  assert.equal(JSON.parse(data.get(api.KEY)).rates.e1,19.66);
  assert.ok(Math.abs(api.get('e1')*30*52/12-2555.8)<1e-8);
});
test('Wage input can be blank, zero or decimal but not negative or oversized',()=>{
  const {api}=createStore();
  api.set('e1',0);
  api.set('e2',19.67);
  assert.equal(api.get('e2'),19.67);
  assert.throws(()=>api.set('e3',250.001),/Stundenlohn/);
  assert.throws(()=>api.set('e3',251),/Stundenlohn/);
  assert.throws(()=>api.set('e3',-1),/Stundenlohn/);
  api.set('e1',null);
  assert.equal(api.get('e1'),null);
});
test('Old encrypted vault is untouched and previously entered plain wages win on migration',()=>{
  const {api,data}=createStore({'ladenfluss.hr-pay-vault.v1':'ENCRYPTED_KEEP'});
  api.set('e1',20);
  api.mergeMissing({e1:12,e2:18.5});
  assert.equal(api.get('e1'),20);
  assert.equal(api.get('e2'),18.5);
  assert.equal(data.get('ladenfluss.hr-pay-vault.v1'),'ENCRYPTED_KEEP');
});
test('Malformed stored wages fail closed and are never overwritten',()=>{
  const bad='{"version":1,"rates":{"e1":"unsafe"}}';
  const {api,data}=createStore({'ladenfluss.hr-wages-simple.v1':bad});
  assert.throws(()=>api.load(),/ungültig|Ungültig/);
  assert.throws(()=>api.set('e1',21));
  assert.equal(data.get(api.KEY),bad);
});
