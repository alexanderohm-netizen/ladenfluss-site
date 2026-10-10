document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const $=id=>document.getElementById(id), api=window.LadenflussDataCloud, storage=window.localStorage;
let client, generation=0, snapshot=null, busy=false, userId=null;
const tell=text=>{$('dataCloudStatus').textContent=text;};
function invalidate(){++generation;snapshot=null;$('dataCloudWorkspace').hidden=true;$('dataCloudConsent').checked=false;}
function controls(){
 $('dataCloudUpload').disabled=busy||!snapshot||!snapshot.local||!$('dataCloudConsent').checked;
 $('dataCloudApply').disabled=busy||!snapshot||!snapshot.remote||!$('dataCloudConsent').checked;
 $('dataCloudDownload').disabled=busy||!snapshot?.remote;
 $('dataLocalDownload').disabled=busy||!snapshot?.local;
 $('dataCloudCompany').disabled=busy;$('dataCloudModule').disabled=busy;$('dataCloudReload').disabled=busy;
}
function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Die Cloud antwortet nicht. Bitte erneut laden.')),15000);})]).finally(()=>clearTimeout(timer));}
async function result(query){const response=await query.abortSignal(AbortSignal.timeout(15000));if(response.error)throw response.error;return response.data;}
async function authenticated(){
 const response=await deadline(client.auth.getUser());
 if(response.error||!response.data?.user||response.data.user.is_anonymous||!response.data.user.email_confirmed_at)throw Error('Bitte zuerst mit einem bestätigten Kundenkonto anmelden.');
 return response.data.user;
}
function fail(error){
 tell(error?.code==='40001'?'Eine andere Sitzung hat diesen Cloud-Stand verändert. Bitte die Stände neu laden.':
 error instanceof Error?error.message:'Die Cloud-Anfrage ist fehlgeschlagen. Bitte neu laden.');
}
function choose(select,rows,selected){
 select.replaceChildren();
 for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.name;select.append(option);}
 if(rows.some(row=>row.id===selected))select.value=selected;
}
function allowed(access){return !!access&&['active','trial'].includes(access.status)&&access.valid_until&&Date.parse(access.valid_until)>Date.now();}
async function load(companyId){
 invalidate();const current=generation;busy=true;controls();tell('Unternehmen und Cloud-Zugriff werden geprüft …');
 try{
  const user=await authenticated();if(current!==generation)return false;
  if(userId&&userId!==user.id)throw Error('Das Konto wurde gewechselt. Bitte neu laden.');
  userId=user.id;
  const memberships=await result(client.from('company_members').select('company_id,role,status').eq('user_id',user.id).eq('status','active'));
  if(current!==generation)return false;
  const permitted=new Set(memberships.filter(m=>['owner','admin','manager'].includes(m.role)).map(m=>m.company_id));
  const companies=(await result(client.from('companies').select('id,name').order('created_at'))).filter(c=>permitted.has(c.id));
  if(current!==generation)return false;
  if(!companies.length)throw Error('Bitte zuerst ein Unternehmen im Kundenkonto anlegen. Nur Inhaber, Admins und Leitungen können Daten sichern.');
  choose($('dataCloudCompany'),companies,companyId);
  const company=$('dataCloudCompany').value,module=$('dataCloudModule').value;
  const access=await result(client.from('module_access').select('module_key,status,valid_until').eq('company_id',company).eq('module_key',module).maybeSingle());
  if(current!==generation)return false;
  if(!allowed(access)){tell('Die Cloud für '+api.MODULES[module].label+' ist noch nicht freigeschaltet. Deine lokalen Daten bleiben erhalten.');return false;}
  const remote=await result(client.from('cloud_documents').select('payload,revision,updated_at').eq('company_id',company).eq('module_key',module).maybeSingle());
  if(current!==generation)return false;
  if(remote&&(!Number.isSafeInteger(remote.revision)||remote.revision<1))throw Error('Der Cloud-Stand hat eine ungültige Revision.');
  if(remote)remote.payload=api.clean(module,remote.payload);
  const local=api.local(module,storage);
  snapshot={userId:user.id,companyId:company,module,remote,local,baseline:api.baseline(module,storage)};
  $('dataCloudLocal').textContent=local?api.summary(module,local):'Noch keine Daten auf diesem Gerät gespeichert.';
  $('dataCloudRemote').textContent=remote?api.summary(module,remote.payload)+' · Revision '+remote.revision+' · '+new Date(remote.updated_at).toLocaleString('de-DE'):'Für diesen Bereich ist noch keine Cloud-Sicherung vorhanden.';
  $('dataCloudWorkspace').hidden=false;
  tell('Bereich, Unternehmen und beide Stände prüfen. Erst nach Zustimmung wird übertragen.');
  return true;
 }catch(e){if(current===generation)fail(e);return false;}
 finally{if(current===generation){busy=false;controls();}}
}
async function action(direction){
 if(busy||!snapshot||!$('dataCloudConsent').checked)return;
 const current=generation,s=snapshot;busy=true;controls();
 try{
  const user=await authenticated();if(current!==generation)return;
  if(user.id!==s.userId)throw Error('Das Konto wurde gewechselt. Bitte neu laden.');
  if(api.baseline(s.module,storage)!==s.baseline)throw Error('Lokale Daten wurden nach der Vorschau verändert. Bitte neu laden.');
  if(direction==='upload'){
   if(!s.local)throw Error('Keine Daten auf diesem Gerät zum Hochladen.');
   await result(client.rpc('save_cloud_document',{target:s.companyId,requested:s.module,document:api.clean(s.module,s.local),expected_revision:s.remote?.revision||0}));
   if(current!==generation)return;
   if(await load(s.companyId))tell('Cloud-Sicherung gespeichert. Änderungen werden nicht automatisch synchronisiert.');
  }else{
   if(!s.remote)throw Error('Noch kein Cloud-Stand vorhanden.');
   const latest=await result(client.from('cloud_documents').select('revision').eq('company_id',s.companyId).eq('module_key',s.module).maybeSingle());
   if(current!==generation)return;
   if(latest?.revision!==s.remote.revision)throw Error('Der Cloud-Stand wurde inzwischen verändert. Bitte zuerst neu laden.');
   api.apply(s.module,s.remote.payload,s.baseline,storage);
   if(await load(s.companyId))tell('Cloud-Daten auf diesem Gerät übernommen. Öffne den Bereich erneut.');
  }
 }catch(e){if(current===generation){invalidate();busy=false;controls();fail(e);}}
 finally{if(current===generation){busy=false;controls();}}
}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('dataCloudConsent').addEventListener('change',controls);
$('dataCloudCompany').addEventListener('change',()=>load($('dataCloudCompany').value));
$('dataCloudModule').addEventListener('change',()=>load($('dataCloudCompany').value));
$('dataCloudReload').addEventListener('click',()=>load($('dataCloudCompany').value));
$('dataCloudUpload').addEventListener('click',()=>action('upload'));
$('dataCloudApply').addEventListener('click',()=>action('apply'));
$('dataCloudDownload').addEventListener('click',()=>{if(!busy&&snapshot?.remote)download(snapshot.remote.payload,'ladenfluss-'+snapshot.module+'-cloud.json');});
$('dataLocalDownload').addEventListener('click',()=>{if(!busy&&snapshot?.local)download(snapshot.local,'ladenfluss-'+snapshot.module+'-lokal.json');});
try{
 client=window.LadenflussCloud.getClient();
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'||(event==='SIGNED_IN'&&userId&&session?.user?.id!==userId)){
   invalidate();busy=false;controls();tell('Der Kontozugang hat sich geändert. Bitte erneut anmelden und laden.');
  }
  if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))userId=session?.user?.id||null;
 });
 load();
}catch{tell('Cloud nicht erreichbar. Deine lokalen Daten bleiben erhalten.');}
});
