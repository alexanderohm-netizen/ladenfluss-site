document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const $=id=>document.getElementById(id), api=window.LadenflussVacationCloud, storage=window.LadenflussLocal;
let client, generation=0, state=null, busy=false, authUserId=null;
const message=text=>{$('cloudStatus').textContent=text;};
function reset(){++generation;state=null;$('cloudWorkspace').hidden=true;$('cloudCompany').replaceChildren();$('cloudLocal').textContent='';$('cloudRemote').textContent='';$('cloudConsent').checked=false;$('cloudHistory').replaceChildren();$('cloudHistorySection').hidden=true;}
function controls(){
 for(const id of ['cloudUpload','cloudApply'])$(id).disabled=busy||!state||!$('cloudConsent').checked||(id==='cloudApply'&&!state.remote);
 $('cloudDownload').disabled=busy||!state?.remote;$('localDownload').disabled=busy||!state?.local;
 for(const button of document.querySelectorAll('[data-vacation-history-restore]'))button.disabled=busy||!state||!$('cloudConsent').checked;
 for(const button of document.querySelectorAll('[data-vacation-history-download]'))button.disabled=busy||!state;
 $('cloudCompany').disabled=busy;$('cloudReload').disabled=busy;
}
function deadline(work){let timer;return Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Die Verbindung dauert zu lange. Bitte neu laden.')),15000);})]).finally(()=>clearTimeout(timer));}
async function result(query){const r=await query.abortSignal(AbortSignal.timeout(15000));if(r.error)throw r.error;return r.data;}
async function user(){const r=await deadline(client.auth.getUser());if(r.error||!r.data.user||r.data.user.is_anonymous||!r.data.user.email_confirmed_at)throw Error('Bitte zuerst mit einem bestätigten Konto anmelden.');return r.data.user;}
function fail(error){message(error?.code==='40001'?'Der Cloud-Stand wurde auf einem anderen Gerät geändert. Bitte neu laden und die beiden Stände erneut prüfen.':error instanceof Error?error.message:'Die Anfrage ist fehlgeschlagen. Bitte neu laden.');}
async function load(companyId){
 reset();const current=generation;busy=true;controls();message('Cloud-Stand wird geladen …');
 try{
  const u=await user();if(current!==generation)return;if(authUserId&&u.id!==authUserId)throw Error('Das Konto wurde gewechselt. Bitte neu laden.');authUserId=u.id;
  const memberships=await result(client.from('company_members').select('company_id,role,status').eq('user_id',u.id).eq('status','active'));
  if(current!==generation)return;
  const allowed=new Set(memberships.filter(m=>['owner','admin','manager'].includes(m.role)).map(m=>m.company_id));
  const companies=(await result(client.from('companies').select('id,name').order('created_at'))).filter(c=>allowed.has(c.id));
  if(current!==generation)return;
  if(!companies.length)throw Error('Lege im Kundenkonto ein Unternehmen an. Für Cloud-Sicherungen brauchst du die Rolle Inhaber, Admin oder Leitung.');
  const company=companies.find(c=>c.id===companyId)||companies[0];
  const remote=await result(client.from('cloud_documents').select('payload,revision,updated_at').eq('company_id',company.id).eq('module_key','vacation').maybeSingle());
  if(current!==generation)return;
  if(remote&&(!Number.isSafeInteger(remote.revision)||remote.revision<1))throw Error('Ungültiger Cloud-Stand.');
  if(remote)remote.payload=api.clean(remote.payload);
  let history=[];
  if(remote){
   const entries=await result(client.from('cloud_document_history').select('revision,payload,saved_at').eq('company_id',company.id).eq('module_key','vacation').order('revision',{ascending:false}).limit(5));
   if(current!==generation)return;
   if(!Array.isArray(entries))throw Error('Der Sicherungsverlauf ist nicht lesbar.');
   history=entries.map(entry=>{
    if(!Number.isSafeInteger(entry.revision)||entry.revision<1||entry.revision>=remote.revision)throw Error('Ungültige Revision im Sicherungsverlauf.');
    return {revision:entry.revision,payload:api.clean(entry.payload),saved_at:entry.saved_at};
   });
  }
  const raw=storage.getItem(api.KEY),local=raw===null?null:api.clean(JSON.parse(raw));
  state={userId:u.id,companyId:company.id,remote,history,local,baseline:api.baseline(storage)};
  $('cloudHistory').replaceChildren();$('cloudHistorySection').hidden=!history.length;
  for(const prior of history){
   const item=document.createElement('li'),label=document.createElement('span'),get=document.createElement('button'),apply=document.createElement('button');
   label.textContent='Version '+prior.revision+' · '+new Date(prior.saved_at).toLocaleString('de-DE')+' ';
   get.type='button';get.className='text-button';get.dataset.vacationHistoryDownload='1';get.textContent='Herunterladen';
   get.addEventListener('click',()=>{if(!busy&&state?.companyId===company.id)download(prior.payload,'ladenfluss-urlaub-version-'+prior.revision+'.json');});
   apply.type='button';apply.className='text-button';apply.dataset.vacationHistoryRestore='1';apply.textContent='Auf Gerät übernehmen';
   apply.addEventListener('click',()=>act('apply',prior));
   item.append(label,get,document.createTextNode(' · '),apply);$('cloudHistory').append(item);
  }
  for(const c of companies){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;$('cloudCompany').append(option);}
  $('cloudCompany').value=company.id;
  $('cloudLocal').textContent=local?api.summary(local):'Auf diesem Gerät ist noch kein Urlaubsplan gespeichert.';
  $('cloudRemote').textContent=remote?api.summary(remote.payload)+' · Stand '+remote.revision+' · '+new Date(remote.updated_at).toLocaleString('de-DE'):'Noch keine Cloud-Sicherung für dieses Unternehmen.';
  $('cloudWorkspace').hidden=false;message('Vergleiche die beiden Stände und wähle eine Richtung. Es wird nichts automatisch übertragen.');
 }catch(e){if(current===generation)fail(e);}finally{if(current===generation){busy=false;controls();}}
}
async function act(direction,older=null){
 if(busy||!state||!$('cloudConsent').checked)return;
 const captured=state,current=generation;busy=true;controls();
 try{
  const u=await user();if(current!==generation)return;if(u.id!==captured.userId)throw Error('Das Konto wurde gewechselt. Bitte neu laden.');
  if(api.baseline(storage)!==captured.baseline)throw Error('Lokale Daten wurden geändert. Bitte neu laden und erneut prüfen.');
  if(direction==='upload'){
   if(!captured.local)throw Error('Erstelle zuerst einen Urlaubsplan auf diesem Gerät.');
   const expected=captured.remote?.revision||0;
   const saved=await result(client.rpc('save_cloud_document',{target:captured.companyId,requested:'vacation',document:api.clean(captured.local),expected_revision:expected}));
   if(current!==generation)return;
   if(!saved||saved.revision!==expected+1)throw Error('Die Cloud hat keine gültige Speicherbestätigung geliefert. Bitte vor einem weiteren Versuch neu laden.');
   await load(captured.companyId);
   if(state)message('Dein Urlaubsplan wurde in der Cloud gesichert. Weitere Änderungen bleiben lokal, bis du erneut sicherst.');
   else message('Die Cloud hat Revision '+saved.revision+' gespeichert. Der anschließende Abruf war nicht möglich. Bitte erneut laden, bevor du weiterarbeitest.');
  }else{
   if(!captured.remote)throw Error('Es gibt noch keine Cloud-Sicherung.');
   if(older&&!captured.history.includes(older))throw Error('Die ausgewählte ältere Version ist nicht mehr aktuell. Bitte neu laden.');
   const latest=await result(client.from('cloud_documents').select('revision').eq('company_id',captured.companyId).eq('module_key','vacation').maybeSingle());
   if(current!==generation)return;
   if(latest?.revision!==captured.remote.revision)throw Error('Die Cloud wurde auf einem anderen Gerät verändert. Bitte Stände neu laden.');
   const chosen=older||captured.remote;
   api.apply({data:chosen.payload,baseline:captured.baseline},storage);
   await load(captured.companyId);
   if(state)message(older?'Frühere Version '+older.revision+' auf diesem Gerät übernommen. Die Cloud blieb unverändert.':'Der geprüfte Cloud-Stand wurde auf diesem Gerät übernommen. Öffne den Urlaubsplaner neu.');
   else message('Die Daten wurden lokal übernommen. Der anschließende Cloud-Abruf war nicht möglich. Bitte neu laden.');
  }
 }catch(e){if(current===generation){reset();fail(e);busy=false;controls();}}
 finally{if(current===generation){busy=false;controls();}}
}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('cloudConsent').addEventListener('change',controls);
$('cloudReload').addEventListener('click',()=>load(state?.companyId));
$('cloudCompany').addEventListener('change',()=>load($('cloudCompany').value));
$('cloudUpload').addEventListener('click',()=>act('upload'));
$('cloudApply').addEventListener('click',()=>act('apply'));
$('cloudDownload').addEventListener('click',()=>{if(!busy&&state?.remote)download(state.remote.payload,'ladenfluss-urlaub-cloud.json');});
$('localDownload').addEventListener('click',()=>{if(!busy&&state?.local)download(state.local,'ladenfluss-urlaub-vorher.json');});
try{
 client=window.LadenflussCloud.getClient();
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'||event==='SIGNED_IN'&&authUserId&&session?.user?.id!==authUserId){reset();busy=false;controls();message('Der Kontozugang hat sich geändert. Bitte anmelden und neu laden.');}
  if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))authUserId=session?.user?.id||null;
 });
 load();
}catch{message('Die Cloud ist derzeit nicht erreichbar. Dein lokaler Urlaubsplan bleibt erhalten.');}
});
