const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

test('Data Cloud: actual SDK + strict CSP, second-device profile, entitlement and stale revision',async t=>{
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  let p=path.join(root,new URL(req.url,'http://local').pathname);
  if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!path.extname(p))p+='.html';
  if(!fs.existsSync(p)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');
  res.end(fs.readFileSync(p));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await chromium.launch({headless:true});
 t.after(()=>browser.close());
 const base='http://127.0.0.1:'+server.address().port;
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',
  email:'cloud@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z',
  app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 const issued=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,exp:issued+3600,iat:issued,role:'authenticated'})+'.test';
 const session={access_token:token,refresh_token:'test-only',token_type:'bearer',expires_in:3600,expires_at:issued+3600,user};
 let remote=null;
 let history=[];
 const requests=[];
 async function openDevice(width,localProfile){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({session,localProfile})=>{
   localStorage.setItem('ladenfluss.auth.v1',JSON.stringify(session));
   if(localProfile)localStorage.setItem('ladenfluss.store.v1',JSON.stringify(localProfile));
  },{session,localProfile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://nzxtdrmdvqyvcbohplzt.supabase.co/**',async route=>{
   const req=route.request(),pathname=new URL(req.url()).pathname;
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'GET,POST,OPTIONS'};
   const send=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(pathname==='/auth/v1/user')return send(user);
   if(pathname==='/rest/v1/company_members')return send([{company_id:'c1',role:'owner',status:'active'}]);
   if(pathname==='/rest/v1/companies')return send([{id:'c1',name:'Testunternehmen'}]);
   if(pathname==='/rest/v1/module_access')return send(null); // paid products remain locked
   if(pathname==='/rest/v1/cloud_documents')return send(remote);
   if(pathname==='/rest/v1/cloud_document_history')return send(history);
   if(pathname==='/rest/v1/rpc/save_cloud_document'){
    const args=req.postDataJSON();requests.push(args);
    if(args.expected_revision!==(remote?.revision||0))return send({code:'40001',message:'revision_conflict_or_no_access'},409);
    if(remote)history.unshift({payload:remote.payload,revision:remote.revision,saved_at:remote.updated_at});
    remote={payload:args.document,revision:(remote?.revision||0)+1,updated_at:new Date().toISOString()};
    return send(remote);
   }
   return send({message:'Unexpected API request '+pathname},500);
  });
  await page.goto(base+'/daten-cloud');
  await page.locator('#dataCloudWorkspace').waitFor({state:'visible',timeout:6000}).catch(async error=>{
   throw Error(error.message+' STATUS: '+await page.locator('#dataCloudStatus').textContent());
  });
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width+'px');
  return {page,context,errors};
 }
 const first=await openDevice(390,{name:'Laden A',type:'Lebensmittel',state:'HE'});
 assert.equal(await first.page.locator('#dataCloudModule').inputValue(),'profile');
 assert.equal(requests.length,0,'No implicit upload');
 await first.page.locator('#dataCloudConsent').check();
 await first.page.locator('#dataCloudUpload').click();
 await first.page.getByText('Cloud-Sicherung gespeichert.',{exact:false}).waitFor();
 assert.equal(requests[0].requested,'profile');
 assert.equal(requests[0].expected_revision,0);
 assert.equal(remote.payload.name,'Laden A');
 assert.equal(await first.page.locator('#dataCloudConsent').isChecked(),false);
 // The paid module should neither read documents nor be unlocked by the browser.
 await first.page.locator('#dataCloudModule').selectOption('warenfluss');
 await first.page.getByText('noch nicht freigeschaltet',{exact:false}).waitFor();
 assert.equal(await first.page.locator('#dataCloudWorkspace').isHidden(),true);
 await first.page.locator('#dataCloudModule').selectOption('profile');
 await first.page.locator('#dataCloudWorkspace').waitFor({state:'visible'});
 // Show one historical revision; explicitly restoring it only changes this browser.
 history=[{payload:{name:'Altbestand',type:'Lebensmittel',state:'HE'},revision:1,saved_at:'2026-10-09T08:00:00Z'}];
 remote.revision=2;
 await first.page.locator('#dataCloudReload').click();
 await first.page.locator('#dataCloudHistorySection').waitFor({state:'visible'});
 await first.page.locator('#dataCloudConsent').check();
 await first.page.locator('[data-cloud-history-restore]').click();
 await first.page.getByText('Frühere Version 1 auf diesem Gerät übernommen.',{exact:false}).waitFor();
 assert.equal(await first.page.evaluate(()=>JSON.parse(localStorage.getItem('ladenfluss.store.v1')).name),'Altbestand');
 assert.equal(remote.payload.name,'Laden A','Restoring older revision must not change the Cloud');
 // Another device changes the cloud row while the first device has a preview.
 remote.revision++;
 await first.page.locator('#dataCloudConsent').check();
 await first.page.locator('#dataCloudUpload').click();
 await first.page.getByText('Eine andere Sitzung hat diesen Cloud-Stand verändert.',{exact:false}).waitFor();
 assert.equal(await first.page.locator('#dataCloudWorkspace').isHidden(),true);
 // A fresh second device sees the most recent cloud version and can restore.
 const second=await openDevice(1440,null);
 await second.page.locator('#dataCloudConsent').check();
 await second.page.locator('#dataCloudApply').click();
 await second.page.getByText('Cloud-Daten auf diesem Gerät übernommen.',{exact:false}).waitFor();
 assert.equal(await second.page.evaluate(()=>JSON.parse(localStorage.getItem('ladenfluss.store.v1')).name),'Laden A');
 assert.equal(await second.page.evaluate(()=>localStorage.getItem('ladenfluss.warenfluss.v1')),null);
 assert.deepEqual(first.errors,[]);
 assert.deepEqual(second.errors,[]);
 fs.mkdirSync('test-artifacts',{recursive:true});
 await first.page.screenshot({path:'test-artifacts/data-cloud-mobile.png',fullPage:true});
 await second.page.screenshot({path:'test-artifacts/data-cloud-desktop.png',fullPage:true});
 await first.context.close();await second.context.close();
});
