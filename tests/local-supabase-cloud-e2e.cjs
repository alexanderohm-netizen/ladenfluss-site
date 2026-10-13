/* Real local Supabase Auth JWT + PostgREST + RLS + CAS tests.
 * Only 127.0.0.1 / localhost endpoints; entirely fake test accounts.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');

function localConfig() {
  const output=execFileSync('supabase',['status','-o','env'],{encoding:'utf8'});
  const vars={};
  for(const line of output.split(/\r?\n/)){
    const m=line.match(/^(?:export )?([A-Z_][A-Z0-9_]*)=(.*)$/);
    if(m)vars[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');
  }
  const url=(vars.API_URL||'http://127.0.0.1:54321').replace(/\/$/,'');
  const key=vars.ANON_KEY||vars.PUBLISHABLE_KEY;
  if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url)||!key)
    throw new Error('Only a running local Supabase stack is allowed.');
  return {url,key};
}
async function jsonCall(cfg,endpoint,{method='GET',token=cfg.key,body}={}){
  const res=await fetch(cfg.url+endpoint,{method,headers:{
    apikey:cfg.key,Authorization:'Bearer '+token,'Content-Type':'application/json',
    Prefer:'return=representation',
  },body:body===undefined?undefined:JSON.stringify(body)});
  let data;try{data=await res.json();}catch(_){data=null;}
  return {status:res.status,data};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function confirmViaMailpit(email){
  for(let retry=0;retry<28;retry++){
    const list=await fetch('http://127.0.0.1:54324/api/v1/messages?limit=60').then(r=>r.json());
    for(const m of list.messages||list.Messages||[]){
      if(!JSON.stringify(m).toLowerCase().includes(email.toLowerCase()))continue;
      const id=m.ID||m.Id||m.id;
      const data=await fetch('http://127.0.0.1:54324/api/v1/message/'+encodeURIComponent(id)).then(r=>r.json());
      const html=[data.HTML,data.Text,data.HTMLBody,data.TextBody].filter(Boolean).join('\n');
      const link=[...html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(x=>x[0].replaceAll('&amp;','&'))
        .find(u=>{try{return new URL(u).searchParams.get('type')==='signup';}catch(_){return false;}});
      if(!link)continue;
      const url=new URL(link);
      if(!['127.0.0.1','localhost','kong'].includes(url.hostname) ||
        !url.pathname.endsWith('/auth/v1/verify'))throw Error('Unexpected confirmation host');
      const response=await fetch(url,{redirect:'manual'});
      assert.ok([302,303].includes(response.status),'Email confirmation failed: '+response.status);
      return;
    }
    await sleep(300);
  }
  throw new Error('Local confirmation email not received in Mailpit');
}
async function createVerifiedUser(cfg,tag){
  const email='lf-cloud-'+tag+'-'+Date.now().toString(36)+'@example.test';
  const password='Strong-local-test-password-2026';
  const created=await jsonCall(cfg,'/auth/v1/signup',{method:'POST',body:{email,password}});
  assert.ok(created.status>=200&&created.status<300,'Signup denied: '+created.status);
  await confirmViaMailpit(email);
  const login=await jsonCall(cfg,'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  assert.equal(login.status,200,'Verified login denied: '+login.status);
  assert.ok(login.data.access_token);
  return {token:login.data.access_token,id:login.data.user.id};
}
const companyBody=(name)=>({
  p_company_name:name,
  p_retail_type:'Lebensmittel',
  p_branch_name:'Innenstadt',
  p_opening_days:6,
  p_opening_hours:9.5,
});
const rpc=(cfg,fn,token,body)=>jsonCall(cfg,'/rest/v1/rpc/'+fn,{method:'POST',token,body});

test('real local JWTs enforce tenants, module entitlements, and CAS history', {timeout:120000},async()=>{
  const cfg=localConfig();
  const a=await createVerifiedUser(cfg,'owner-a');
  const b=await createVerifiedUser(cfg,'owner-b');
  assert.notEqual(a.id,b.id);

  const createdA=await rpc(cfg,'create_company_onboarding',a.token,companyBody('Shop A'));
  assert.equal(createdA.status,200,'Create company A failed '+createdA.status+' '+createdA.data?.message);
  const rowA=createdA.data?.[0];
  assert.ok(rowA?.company_id&&rowA?.branch_id);
  const companyA=rowA.company_id;
  const branchesA=await jsonCall(cfg,'/rest/v1/branches?select=name,opening_days,opening_hours&company_id=eq.'+companyA,{token:a.token});
  assert.equal(branchesA.status,200);
  assert.equal(branchesA.data?.[0]?.name,'Innenstadt');
  assert.equal(branchesA.data?.[0]?.opening_days,6);

  const createdB=await rpc(cfg,'create_company_onboarding',b.token,companyBody('Shop B'));
  assert.equal(createdB.status,200,'Create company B failed '+createdB.status);
  const companyB=createdB.data[0].company_id;
  assert.notEqual(companyA,companyB);

  const cannotReadA=await jsonCall(cfg,'/rest/v1/companies?select=id&created_by=eq.'+a.id,{token:b.token});
  assert.equal(cannotReadA.status,200);
  assert.deepEqual(cannotReadA.data,[],'Tenant B can read tenant A!');

  const deniedAnon=await rpc(cfg,'create_cloud_document_if_absent',cfg.key,{
    p_company_id:companyA,p_module_key:'profile',p_payload:{secret:'anon'},
  });
  assert.ok(deniedAnon.status>=400,'Anonymous user wrote cloud data');

  const deniedOther=await rpc(cfg,'create_cloud_document_if_absent',b.token,{
    p_company_id:companyA,p_module_key:'profile',p_payload:{secret:'cross-tenant'},
  });
  assert.equal(deniedOther.data?.code,'42501','Other tenant was allowed to write');

  const deniedPep=await rpc(cfg,'create_cloud_document_if_absent',a.token,{
    p_company_id:companyA,p_module_key:'pep',p_payload:{secret:'unpaid'},
  });
  assert.equal(deniedPep.data?.code,'42501','Unsubscribed module was allowed to write');

  const first=await rpc(cfg,'create_cloud_document_if_absent',a.token,{
    p_company_id:companyA,p_module_key:'profile',p_payload:{name:'Original'},
  });
  assert.equal(first.status,200,'Cloud first write failed '+first.status+' '+first.data?.message);
  assert.equal(first.data?.[0]?.saved_revision,1);

  const duplicate=await rpc(cfg,'create_cloud_document_if_absent',a.token,{
    p_company_id:companyA,p_module_key:'profile',p_payload:{name:'Do not overwrite'},
  });
  assert.equal(duplicate.data?.code,'23505','Duplicate initial save was accepted');

  const payloadOf=name=>({
    p_company_id:companyA,p_module_key:'profile',p_expected_revision:1,p_payload:{name},
  });
  const [firstWriter,secondWriter]=await Promise.all([
    rpc(cfg,'save_cloud_document_if_revision',a.token,payloadOf('Editor 1')),
    rpc(cfg,'save_cloud_document_if_revision',a.token,payloadOf('Editor 2')),
  ]);
  const successes=[firstWriter,secondWriter].filter(r=>r.status===200);
  const conflicts=[firstWriter,secondWriter].filter(r=>r.data?.code==='40001');
  assert.equal(successes.length,1,'Both concurrent stale writes were accepted');
  assert.equal(conflicts.length,1,'One concurrent stale write must conflict');
  assert.equal(successes[0].data[0].saved_revision,2);

  const readA=await jsonCall(cfg,
    '/rest/v1/cloud_documents?select=revision,payload&company_id=eq.'+companyA+'&module_key=eq.profile',
    {token:a.token});
  assert.equal(readA.status,200);
  assert.equal(readA.data.length,1);
  assert.equal(readA.data[0].revision,2);

  const historyA=await jsonCall(cfg,
    '/rest/v1/cloud_document_history?select=revision,payload&company_id=eq.'+companyA+'&module_key=eq.profile',
    {token:a.token});
  assert.equal(historyA.status,200);
  assert.equal(historyA.data.length,1);
  assert.equal(historyA.data[0].revision,1);
  assert.equal(historyA.data[0].payload.name,'Original');

  const readB=await jsonCall(cfg,'/rest/v1/cloud_documents?select=revision,payload&company_id=eq.'+companyA,{token:b.token});
  assert.equal(readB.status,200);
  assert.deepEqual(readB.data,[]);
  const historyB=await jsonCall(cfg,'/rest/v1/cloud_document_history?select=revision&company_id=eq.'+companyA,{token:b.token});
  assert.equal(historyB.status,200);
  assert.deepEqual(historyB.data,[]);

  const directUpdate=await jsonCall(cfg,
    '/rest/v1/cloud_documents?company_id=eq.'+companyA+'&module_key=eq.profile',
    {method:'PATCH',token:a.token,body:{revision:999,payload:{name:'bypass'}}});
  assert.ok(directUpdate.status>=400,'Direct table UPDATE unexpectedly granted');
  const after=await jsonCall(cfg,
    '/rest/v1/cloud_documents?select=revision,payload&company_id=eq.'+companyA+'&module_key=eq.profile',
    {token:a.token});
  assert.equal(after.data?.[0]?.revision,2);
  assert.notEqual(after.data?.[0]?.payload?.name,'bypass');

  const createdOwnDoc=await rpc(cfg,'create_cloud_document_if_absent',b.token,{
    p_company_id:companyB,p_module_key:'profile',p_payload:{name:'B only'},
  });
  assert.equal(createdOwnDoc.status,200,'Tenant B cannot save its own document');
});
