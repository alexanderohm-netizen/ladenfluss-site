const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,20));
const key='ladenfluss.urlaubsplaner.v1';
const sample=()=>({version:1,employees:[{id:'p1',name:'Alex',allowance:30}],entries:[{id:'v1',employeeId:'p1',start:'2026-10-12',end:'2026-10-13',status:'planned',note:''}],settings:{state:'HE',workdays:[1,2,3,4,5],maxAbsent:1}});
async function setup(options={}){
 const dom=new JSDOM(fs.readFileSync('urlaub-cloud.html','utf8'),{url:'https://www.ladenfluss.de/urlaub-cloud',runScripts:'outside-only'}),w=dom.window;
 await tick();w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;
 let user={id:'u1',email_confirmed_at:'2026-10-01'},listener;const calls=[];
 let remote=options.remote===undefined?{payload:sample(),revision:3,updated_at:'2026-10-10T08:00:00Z'}:options.remote;
 let history=options.history||[];
 if(options.local!==false)w.localStorage.setItem(key,JSON.stringify(sample()));
 const client={auth:{getUser:()=>options.getUser?options.getUser():Promise.resolve({data:{user}}),onAuthStateChange:fn=>{listener=fn;}},from(table){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle(){return q},abortSignal(){return Promise.resolve({data:table==='company_members'?[{company_id:'c1',role:options.role||'owner',status:'active'}]:table==='companies'?[{id:'c1',name:'Unser Laden'}]:table==='cloud_document_history'?history:remote});}};return q;},rpc(name,args){calls.push([name,args]);if(!options.rpcError){if(remote)history.unshift({payload:remote.payload,revision:remote.revision,saved_at:remote.updated_at});remote={payload:args.document,revision:args.expected_revision+1,updated_at:'2026-10-10T09:00:00Z'};}return {abortSignal:async()=>({data:options.saveReceipt||remote,error:options.rpcError})};}};
 w.LadenflussCloud={getClient:()=>client};
 for(const file of ['team-storage','urlaubsplaner-store','vacation-cloud-core','vacation-cloud'])w.eval(fs.readFileSync('assets/'+file+'.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 const $=id=>w.document.getElementById(id);
 return {dom,w,$,calls,client,setRemote(x){remote=x;},agree(){ $('cloudConsent').checked=true;$('cloudConsent').dispatchEvent(new w.Event('change'));},emit(event,u){user=u;listener(event,u?{user:u}:null);},async click(id){$(id).click();await tick();}};
}
test('Cloud preview reads without auto-upload; explicit upload uses expected revision',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());assert.equal(a.calls.length,0);assert.equal(a.$('cloudUpload').disabled,true);assert.match(a.$('cloudRemote').textContent,/Stand 3/);
 a.agree();await a.click('cloudUpload');assert.equal(a.calls.length,1);assert.equal(a.calls[0][1].expected_revision,3);assert.equal(a.calls[0][1].requested,'vacation');assert.match(a.$('cloudStatus').textContent,/gesichert/);assert.equal(a.$('cloudConsent').checked,false);
});
test('Second device restores vacation only and preserves other local data',async t=>{
 const a=await setup({local:false});t.after(()=>a.dom.window.close());a.w.localStorage.setItem('ladenfluss.zahlenfluss.v1','untouched');a.agree();await a.click('cloudApply');assert.equal(JSON.parse(a.w.localStorage.getItem(key)).employees[0].name,'Alex');assert.equal(a.w.localStorage.getItem('ladenfluss.zahlenfluss.v1'),'untouched');assert.equal(a.calls.length,0);assert.match(a.$('cloudStatus').textContent,/übernommen/);
});
test('Revision conflict invalidates preview and requires reload, never retries blind',async t=>{
 const a=await setup({rpcError:{code:'40001'}});t.after(()=>a.dom.window.close());a.agree();await a.click('cloudUpload');assert.match(a.$('cloudStatus').textContent,/anderen Gerät/);assert.equal(a.$('cloudWorkspace').hidden,true);assert.equal(a.calls.length,1);assert.equal(a.$('cloudReload').disabled,false);
});
test('Local edits after preview block both upload and replacement',async t=>{
 for(const action of ['cloudApply','cloudUpload']){const a=await setup();t.after(()=>a.dom.window.close());const changed=sample();changed.employees[0].name='Neuer Name';a.w.localStorage.setItem(key,JSON.stringify(changed));a.agree();await a.click(action);assert.match(a.$('cloudStatus').textContent,/Lokale Daten wurden geändert/);assert.equal(a.calls.length,0);assert.equal(JSON.parse(a.w.localStorage.getItem(key)).employees[0].name,'Neuer Name');}
});
test('Logout during authentication discards late response without write',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());let resolve;a.client.auth.getUser=()=>new Promise(r=>resolve=r);a.agree();a.$('cloudUpload').click();a.emit('SIGNED_OUT',null);resolve({data:{user:{id:'u1',email_confirmed_at:'yes'}}});await tick();assert.equal(a.calls.length,0);assert.equal(a.$('cloudWorkspace').hidden,true);assert.equal(a.$('cloudCompany').options.length,0);
});
test('Account switch without auth event cannot write previous company',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());a.client.auth.getUser=async()=>({data:{user:{id:'u2',email_confirmed_at:'yes'}}});a.agree();await a.click('cloudUpload');assert.equal(a.calls.length,0);assert.match(a.$('cloudStatus').textContent,/Konto wurde gewechselt/);
});
test('Employee role cannot open vacation cloud data',async t=>{
 const a=await setup({role:'employee'});t.after(()=>a.dom.window.close());assert.equal(a.$('cloudWorkspace').hidden,true);assert.match(a.$('cloudStatus').textContent,/Rolle/);
});
test('Missing cloud document starts at revision zero, empty device cannot upload',async t=>{
 const a=await setup({remote:null});t.after(()=>a.dom.window.close());a.agree();await a.click('cloudUpload');assert.equal(a.calls[0][1].expected_revision,0);
 const b=await setup({remote:null,local:false});t.after(()=>b.dom.window.close());b.agree();await b.click('cloudUpload');assert.equal(b.calls.length,0);assert.match(b.$('cloudStatus').textContent,/Erstelle zuerst/);
});
test('Restore checks same-ID people and leaves original data untouched',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());const store=a.w.LadenflussLocal;store.setItem('ladenfluss.team.v1',JSON.stringify([{id:'p1',name:'Andere Person'}]));await a.click('cloudReload');const before=store.getItem(key);a.agree();await a.click('cloudApply');assert.match(a.$('cloudStatus').textContent,/anderen Person/);assert.equal(store.getItem(key),before);
});
test('Restore writes through canonical team envelope, storage failure does not partially change data',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());const w=a.w,T=w.LadenflussTeamStorage;const records=Object.fromEntries(T.KEYS.map(k=>[k,null]));records[key]=JSON.stringify(sample());w.localStorage.setItem(T.KEY,JSON.stringify({version:1,records}));const incoming=sample();incoming.entries=[];const api=w.LadenflussVacationCloud,plan=api.prepare(incoming,w.LadenflussLocal);api.apply(plan,w.LadenflussLocal);assert.equal(JSON.parse(w.LadenflussLocal.getItem(key)).entries.length,0);assert.equal(JSON.parse(w.localStorage.getItem(key)).entries.length,1);
 const before=w.localStorage.getItem(T.KEY);const plan2=api.prepare(sample(),w.LadenflussLocal);assert.throws(()=>api.apply(plan2,{getItem:k=>w.LadenflussLocal.getItem(k),setItem(){throw Error('Quota');}}),/Quota/);assert.equal(w.localStorage.getItem(T.KEY),before);
});
test('Malformed remote payload never enables transfer; bounded validation strips extra fields',async t=>{
 const a=await setup({remote:{payload:{version:99},revision:2}});t.after(()=>a.dom.window.close());assert.equal(a.$('cloudWorkspace').hidden,true);const raw=sample();raw.secret='extra';assert.equal(a.w.LadenflussVacationCloud.clean(raw).secret,undefined);raw.employees[0].name='x'.repeat(121);assert.throws(()=>a.w.LadenflussVacationCloud.clean(raw));
});

test('Vacation Cloud: history can restore a former local version without overwriting current cloud',async t=>{
 const prior=sample();prior.entries[0].note='Älterer genehmigter Stand';
 const a=await setup({history:[{revision:2,payload:prior,saved_at:'2026-10-09T08:00:00Z'}]});
 t.after(()=>a.dom.window.close());
 assert.equal(a.$('cloudHistorySection').hidden,false);
 assert.equal(a.w.document.querySelectorAll('[data-vacation-history-restore]').length,1);
 assert.equal(a.w.document.querySelector('[data-vacation-history-restore]').disabled,true);
 const beforeCalls=a.calls.length;
 a.agree();a.w.document.querySelector('[data-vacation-history-restore]').click();await tick();
 assert.equal(a.calls.length,beforeCalls,'History restore must never write to server');
 assert.equal(JSON.parse(a.w.LadenflussLocal.getItem(key)).entries[0].note,'Älterer genehmigter Stand');
 assert.match(a.$('cloudStatus').textContent,/Cloud blieb unverändert/);
 assert.equal(a.$('cloudConsent').checked,false);
});
test('Vacation Cloud: remote version change blocks current and historical local restoration',async t=>{
 for(const restoreOld of [false,true]){
  const prior={revision:2,payload:sample(),saved_at:'2026-10-09T08:00:00Z'};
  const a=await setup({history:[prior]});t.after(()=>a.dom.window.close());
  const original=a.w.LadenflussLocal.getItem(key);
  a.setRemote({payload:sample(),revision:4,updated_at:'2026-10-10T09:00:00Z'});
  a.agree();
  if(restoreOld)a.w.document.querySelector('[data-vacation-history-restore]').click();
  else await a.click('cloudApply');
  await tick();
  assert.equal(a.w.LadenflussLocal.getItem(key),original,'Stale cloud must not replace local data');
  assert.equal(a.$('cloudWorkspace').hidden,true);
  assert.match(a.$('cloudStatus').textContent,/Cloud wurde auf einem anderen Gerät verändert/);
 }
});
test('Vacation Cloud: malformed server save receipt is not reported as successful',async t=>{
 const a=await setup({saveReceipt:{revision:77}});
 t.after(()=>a.dom.window.close());a.agree();await a.click('cloudUpload');
 assert.equal(a.calls.length,1);assert.equal(a.$('cloudWorkspace').hidden,true);
 assert.match(a.$('cloudStatus').textContent,/keine gültige Speicherbestätigung/);
});
test('Vacation Cloud: invalid historical data fails closed without enabling overwrite',async t=>{
 const a=await setup({history:[{revision:4,payload:sample(),saved_at:'2026-10-09T08:00:00Z'}]});
 t.after(()=>a.dom.window.close());
 assert.equal(a.$('cloudWorkspace').hidden,true);
 assert.match(a.$('cloudStatus').textContent,/Ungültige Revision im Sicherungsverlauf/);
});
