const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
const NUMBERS={version:1,target:100000,entries:[{date:'2026-10-07',revenue:50000,goods:null,labor:null,other:null,hours:null,receipts:null}]};
const STOCK={version:1,articles:[{id:'a1',name:'Artikel',sku:'123',minimum:2,archived:false}],movements:[]};
async function setup(options={}){
 const dom=new JSDOM(fs.readFileSync('daten-cloud.html','utf8'),{url:'https://www.ladenfluss.de/daten-cloud',runScripts:'outside-only'}),w=dom.window;
 await tick();w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;
 let user={id:'u1',email_confirmed_at:'2026-10-10'},listener,revision=3;
 const calls=[],reads=[];
 let remote=options.remote===undefined?{payload:options.module==='profile'?{name:'Cloud-Shop',type:'Lebensmittel',state:'HE'}:NUMBERS,revision,updated_at:'2026-10-10T08:00:00Z'}:options.remote;
 if(options.local!==false){w.localStorage.setItem('ladenfluss.zahlenfluss.v1',JSON.stringify(NUMBERS));if(options.module==='profile')w.localStorage.setItem('ladenfluss.store.v1',JSON.stringify({name:'Lokal-Shop',type:'Lebensmittel',state:'HE'}));}
 w.document.getElementById('dataCloudModule').value=options.module||'zahlenfluss';
 const client={
  auth:{getUser:()=>Promise.resolve({data:{user}}),onAuthStateChange:fn=>{listener=fn;}},
  from(table){
   reads.push(table);let module='zahlenfluss';
   const query={select(){return query},order(){return query},limit(){return query},eq(column,value){if(column==='module_key')module=value;return query;},maybeSingle(){return query},abortSignal(){let data=null;
    if(table==='company_members')data=[{company_id:'c1',role:options.role||'owner',status:'active'}];
    if(table==='companies')data=[{id:'c1',name:'Unser Laden'}];
    if(table==='module_access')data=options.unpaid?null:{module_key:module,status:'trial',valid_until:'2030-01-01T00:00:00Z'};
    if(table==='cloud_document_history')data=options.history||[];
    if(table==='cloud_documents')data=options.latestRevision&&query.revisionOnly?{revision:options.latestRevision}:remote;
    return Promise.resolve({data});
   }};
   query.select=function(fields){query.revisionOnly=fields==='revision';return query;};
   return query;
  },
  rpc(name,args){calls.push({name,args});if(!options.rpcError)remote={payload:args.document,revision:args.expected_revision+1,updated_at:'2026-10-10T09:00:00Z'};
   return {abortSignal:async()=>({data:options.badReceipt?{revision:args.expected_revision}:remote,error:options.rpcError||null})};
  }
 };
 w.LadenflussCloud={getClient:()=>client};
 for(const file of ['planning-engine','de-holidays','store-settings','zahlenfluss-store','warenfluss-store','restore-core','data-cloud-core','data-cloud'])w.eval(fs.readFileSync('assets/'+file+'.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 const $=id=>w.document.getElementById(id);
 return {w,dom,$,calls,reads,agree(){ $('dataCloudConsent').checked=true;$('dataCloudConsent').dispatchEvent(new w.Event('change'));},
 async click(id){$(id).click();await tick();},signout(){listener('SIGNED_OUT',null);}};
}
test('Cloud backup does not upload automatically and honors compare-and-swap revision',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());
 assert.equal(a.calls.length,0);assert.equal(a.$('dataCloudUpload').disabled,true);
 a.agree();await a.click('dataCloudUpload');
 assert.equal(a.calls.length,1);
 assert.equal(a.calls[0].args.requested,'zahlenfluss');assert.equal(a.calls[0].args.expected_revision,3);
 assert.match(a.$('dataCloudStatus').textContent,/gespeichert/);
 assert.equal(a.$('dataCloudConsent').checked,false);
});
test('Restore changes only its target module, never Warenfluss',async t=>{
 const a=await setup({local:false});t.after(()=>a.dom.window.close());
 a.w.localStorage.setItem('ladenfluss.warenfluss.v1',JSON.stringify(STOCK));
 a.agree();await a.click('dataCloudApply');
 assert.equal(JSON.parse(a.w.localStorage.getItem('ladenfluss.zahlenfluss.v1')).entries.length,1);
 assert.deepEqual(JSON.parse(a.w.localStorage.getItem('ladenfluss.warenfluss.v1')),STOCK);
 assert.equal(a.calls.length,0);
});
test('Local changes after preview prohibit both directions',async t=>{
 for(const button of ['dataCloudUpload','dataCloudApply']){
  const a=await setup();t.after(()=>a.dom.window.close());
  a.w.localStorage.setItem('ladenfluss.zahlenfluss.v1',JSON.stringify({...NUMBERS,target:150000}));
  a.agree();await a.click(button);
  assert.equal(a.calls.length,0);assert.match(a.$('dataCloudStatus').textContent,/Lokale Daten/);
  assert.equal(a.$('dataCloudWorkspace').hidden,true);
 }
});
test('Cloud revision changed before restore blocks stale download application',async t=>{
 const a=await setup({latestRevision:4});t.after(()=>a.dom.window.close());
 a.agree();await a.click('dataCloudApply');
 assert.equal(a.w.localStorage.getItem('ladenfluss.zahlenfluss.v1'),JSON.stringify(NUMBERS));
 assert.match(a.$('dataCloudStatus').textContent,/inzwischen verändert/);
});
test('Expired module and employee permissions prohibit cloud data access',async t=>{
 for(const options of [{unpaid:true},{role:'employee'}]){
  const a=await setup(options);t.after(()=>a.dom.window.close());
  assert.equal(a.$('dataCloudWorkspace').hidden,true);
  assert.equal(a.calls.length,0);
  assert.equal(a.reads.includes('cloud_documents'),false);
 }
});
test('Cloud error disables unverified preview instead of silently retrying',async t=>{
 const a=await setup({rpcError:{code:'40001'}});t.after(()=>a.dom.window.close());
 a.agree();await a.click('dataCloudUpload');
 assert.equal(a.calls.length,1);assert.equal(a.$('dataCloudWorkspace').hidden,true);
 assert.match(a.$('dataCloudStatus').textContent,/andere Sitzung/);
});
test('The core allowlists saved fields and forbids oversize or unknown modules',async t=>{
 const a=await setup();t.after(()=>a.dom.window.close());
 const api=a.w.LadenflussDataCloud;
 assert.throws(()=>api.clean('pep',NUMBERS),/Unbekannter/);
 assert.equal(api.clean('zahlenfluss',{...NUMBERS,privateField:'skip'}).privateField,undefined);
 assert.throws(()=>api.clean('warenfluss',{...STOCK,extra:'x'.repeat(600000)}),/500 KB/);
});

test('Free Ladenprofil Cloud works without paid entitlement and preserves other modules',async t=>{
 const a=await setup({module:'profile',unpaid:true});t.after(()=>a.dom.window.close());
 assert.equal(a.$('dataCloudWorkspace').hidden,false);
 assert.equal(a.reads.includes('module_access'),false);
 const before=a.w.localStorage.getItem('ladenfluss.zahlenfluss.v1');
 a.agree();await a.click('dataCloudApply');
 assert.equal(JSON.parse(a.w.localStorage.getItem('ladenfluss.store.v1')).name,'Cloud-Shop');
 assert.equal(a.w.localStorage.getItem('ladenfluss.zahlenfluss.v1'),before);
 assert.equal(a.calls.length,0);
});
test('Profile cloud drops unknown keys and rejects invalid values',async t=>{
 const a=await setup({module:'profile',unpaid:true});t.after(()=>a.dom.window.close());
 const c=a.w.LadenflussDataCloud;
 assert.equal(c.clean('profile',{name:'Mein Laden',mystery:'nope'}).mystery,undefined);
 assert.throws(()=>c.clean('profile',{name:'Mein Laden',days:999}),/Öffnungszeiten/);
});

test('Missing or stale server receipt never reports a confirmed cloud save',async t=>{
 const a=await setup({badReceipt:true});t.after(()=>a.dom.window.close());
 a.agree();await a.click('dataCloudUpload');
 assert.equal(a.calls.length,1);
 assert.match(a.$('dataCloudStatus').textContent,/keine gültige Speicherbestätigung/);
 assert.equal(a.$('dataCloudWorkspace').hidden,true);
});

test('Earlier Cloud snapshot can be restored locally without overwriting the Cloud',async t=>{
 const oldProfile={name:'Altes Ladenprofil',type:'Lebensmittel',state:'HE'};
 const a=await setup({module:'profile',unpaid:true,history:[{revision:2,payload:oldProfile,saved_at:'2026-10-09T08:00:00Z'}]});
 t.after(()=>a.dom.window.close());
 assert.equal(a.$('dataCloudHistorySection').hidden,false);
 assert.match(a.$('dataCloudHistory').textContent,/Version 2/);
 const restore=a.$('dataCloudHistory').querySelector('[data-cloud-history-restore]');
 assert.equal(restore.disabled,true,'History cannot be restored without consent');
 a.agree();restore.click();await tick();
 assert.equal(JSON.parse(a.w.localStorage.getItem('ladenfluss.store.v1')).name,'Altes Ladenprofil');
 assert.equal(a.calls.length,0,'Historical restore does not write to cloud');
 assert.match(a.$('dataCloudStatus').textContent,/Frühere Version 2/);
});
test('Cloud history refuses malformed or newer-than-current revisions',async t=>{
 const a=await setup({history:[{revision:4,payload:NUMBERS,saved_at:'2026-10-09T08:00:00Z'}]});
 t.after(()=>a.dom.window.close());
 assert.equal(a.$('dataCloudWorkspace').hidden,true);
 assert.match(a.$('dataCloudStatus').textContent,/Ungültige Version/);
});
