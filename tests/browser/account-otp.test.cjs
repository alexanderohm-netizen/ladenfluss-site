const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('Customer signup and code confirmation: shipped Supabase SDK with browser PKCE session',async t=>{
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');
  let file=path.join(root,url.pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!path.extname(file))file+='.html';
  if(!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await chromium.launch({headless:true});
 t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:900}});
 const page=await context.newPage(),errors=[],calls=[];
 page.on('pageerror',error=>errors.push(error.message));
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'demo@example.invalid',
  email_confirmed_at:'2026-10-10T10:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-10T09:00:00Z'};
 const issued=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const accessToken=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,role:'authenticated',iat:issued,exp:issued+3600})+'.test';
 const session={access_token:accessToken,token_type:'bearer',expires_in:3600,expires_at:issued+3600,refresh_token:'test-session-only',user};
 await page.route('https://nzxtdrmdvqyvcbohplzt.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),uri=url.pathname;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  const send=(value,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(value)});
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(uri==='/auth/v1/signup'){
   calls.push({kind:'signup'});
   return send({user:{...user,email_confirmed_at:null},session:null});
  }
  if(uri==='/auth/v1/resend'){calls.push({kind:'resend'});return send({});}
  if(uri==='/auth/v1/verify'){
   const input=request.postDataJSON();calls.push({kind:'verify',type:input.type,token:input.token});
   if(input.type!=='email'||input.token!=='123456')return send({code:'otp_expired',message:'Invalid OTP'},422);
   return send(session);
  }
  if(uri==='/auth/v1/user')return send(user);
  if(uri==='/rest/v1/companies')return send([]);
  return send({message:'Unexpected request '+uri},500);
 });
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/konto');
 await page.getByRole('button',{name:'Konto erstellen',exact:true}).first().click();
 await page.locator('#registerForm input[name=email]').fill('demo@example.invalid');
 await page.locator('#registerForm input[name=password]').fill('a'.repeat(16));
 await page.locator('#registerForm button.btn-primary').click();
 await page.locator('[data-account-panel=verify]').waitFor({state:'visible',timeout:6000});
 assert.equal(calls.filter(x=>x.kind==='signup').length,1);
 assert.equal(await page.locator('#signedIn').isHidden(),true);
 await page.locator('#verifyForm input[name=token]').fill('123456');
 await page.locator('#verifyForm button.btn-primary').click();
 await page.locator('#signedIn').waitFor({state:'visible',timeout:6000});
 assert.equal(calls.filter(x=>x.kind==='verify').length,1);
 assert.equal(calls.find(x=>x.kind==='verify').type,'email');
 assert.equal(await page.locator('#verifyForm input[name=token]').inputValue(),'');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);
 await context.close();
});
