const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('Vacation cloud: actual SDK, CSP, revision conflict and second device at mobile/desktop sizes',async t=>{
 const root=process.cwd();
 const server=http.createServer((req,res)=>{let p=path.join(root,new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(!path.extname(p))p+='.html';if(!fs.existsSync(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');res.end(fs.readFileSync(p));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const base='http://127.0.0.1:'+server.address().port;
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'test@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 const issued=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,exp:issued+3600,iat:issued,role:'authenticated'})+'.test';
 const session={access_token:token,refresh_token:'test-only',token_type:'bearer',expires_in:3600,expires_at:issued+3600,user};
 const vacation={version:1,employees:[{id:'p1',name:'Alex',allowance:30}],entries:[],settings:{state:'HE',workdays:[1,2,3,4,5],maxAbsent:1}};
 let remote=null;let history=[];const requests=[];
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(({session,vacation,width})=>{localStorage.setItem('ladenfluss.auth.v1',JSON.stringify(session));if(width===390)localStorage.setItem('ladenfluss.urlaubsplaner.v1',JSON.stringify(vacation));},{session,vacation,width});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://nzxtdrmdvqyvcbohplzt.supabase.co/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
   const send=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(p==='/auth/v1/user')return send(user);
   if(p==='/rest/v1/company_members')return send([{company_id:'c1',role:'owner',status:'active'}]);
   if(p==='/rest/v1/companies')return send([{id:'c1',name:'Unser Laden'}]);
   if(p==='/rest/v1/cloud_documents')return send(remote);
   if(p==='/rest/v1/cloud_document_history')return send(history);
   if(p==='/rest/v1/rpc/save_cloud_document'){
    const args=req.postDataJSON();requests.push(args);
    if(args.expected_revision!==(remote?.revision||0))return send({code:'40001',message:'revision_conflict_or_no_access'},409);
    if(remote)history.unshift({revision:remote.revision,payload:remote.payload,saved_at:remote.updated_at});
    remote={payload:args.document,revision:(remote?.revision||0)+1,updated_at:new Date().toISOString()};return send(remote);
   }
   return send({message:'Unexpected request'},500);
  });
  await page.goto(base+'/urlaub-cloud');await page.locator('#cloudWorkspace').waitFor({state:'visible',timeout:5000}).catch(async e=>{throw Error(e.message+' STATUS: '+await page.locator('#cloudStatus').textContent());});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#cloudConsent').check();
  if(width===390){
   await page.locator('#cloudUpload').click();await page.getByText('Dein Urlaubsplan wurde in der Cloud gesichert.',{exact:false}).waitFor();assert.equal(requests[0].expected_revision,0);
   history=[{revision:1,payload:vacation,saved_at:'2026-10-10T08:00:00Z'}];
   remote.revision++;await page.locator('#cloudConsent').check();await page.locator('#cloudUpload').click();await page.getByText('Der Cloud-Stand wurde auf einem anderen Gerät geändert.',{exact:false}).waitFor();await page.locator('#cloudReload').click();await page.locator('#cloudWorkspace').waitFor({state:'visible',timeout:5000}).catch(async e=>{throw Error(e.message+' STATUS: '+await page.locator('#cloudStatus').textContent());});
   await page.locator('#cloudHistorySection').waitFor({state:'visible'});
   await page.locator('#cloudConsent').check();
   const before=remote.revision;
   await page.locator('[data-vacation-history-restore]').click();
   await page.getByText('Frühere Version 1 auf diesem Gerät übernommen.',{exact:false}).waitFor();
   assert.equal(remote.revision,before,'Restoring an older vacation must never rewrite cloud');
  }else{
   await page.locator('#cloudApply').click();await page.getByText('Der geprüfte Cloud-Stand wurde auf diesem Gerät übernommen.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ladenfluss.urlaubsplaner.v1')).employees[0].name),'Alex');
  }
  fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/vacation-cloud-'+width+'.png',fullPage:true});assert.deepEqual(errors,[]);
 }
});
