/* Real browser + local Supabase + Mailpit journey.
 * This test is local-only. No hosted production credentials, email sending or writes.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const base='http://127.0.0.1:54330';
function localSupabase(){
  const raw=execFileSync('supabase',['status','-o','env'],{encoding:'utf8'});
  const vars={};
  for(const line of raw.split(/\r?\n/)){
    const match=line.match(/^(?:export )?([A-Z_][A-Z0-9_]*)=(.*)$/);
    if(match)vars[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');
  }
  const url=(vars.API_URL||'http://127.0.0.1:54321').replace(/\/$/,'');
  const key=vars.ANON_KEY||vars.PUBLISHABLE_KEY;
  if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(url)||!/^eyJ[A-Za-z0-9_.-]{100,}$/.test(key||''))
    throw Error('This test runs ONLY with a disposable local Supabase instance and anon JWT');
  return {url,key};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function mailLink(address,type){
  for(let i=0;i<36;i++){
    const reply=await fetch('http://127.0.0.1:54324/api/v1/messages?limit=100');
    if(!reply.ok)throw Error('Mailpit not reachable');
    const list=await reply.json();
    for(const message of list.messages||list.Messages||[]){
      if(!JSON.stringify(message).toLowerCase().includes(address.toLowerCase()))continue;
      const id=message.ID||message.Id||message.id;
      const response=await fetch('http://127.0.0.1:54324/api/v1/message/'+encodeURIComponent(id));
      if(!response.ok)continue;
      const mail=await response.json();
      const markup=[mail.HTML,mail.Text,mail.HTMLBody,mail.TextBody].filter(Boolean).join('\n');
      const urls=[...markup.matchAll(/https?:\/\/[^\s"'<>]+/g)]
        .map(hit=>hit[0].replaceAll('&amp;','&').replaceAll('&#38;','&'));
      for(const value of urls){
        try{
          const link=new URL(value);
          if(link.pathname.endsWith('/auth/v1/verify')&&link.searchParams.get('type')===type)
            return link;
        }catch(_){}
      }
    }
    await sleep(250);
  }
  throw Error('Missing '+type+' email for '+address+' from local Mailpit');
}
async function redirectFromEmail(link){
  assert.ok(['127.0.0.1','localhost','kong'].includes(link.hostname));
  assert.ok(link.pathname.endsWith('/auth/v1/verify'));
  const reply=await fetch(link,{redirect:'manual'});
  assert.ok([302,303].includes(reply.status),
    'Local email confirmation error HTTP '+reply.status);
  const location=new URL(reply.headers.get('location'),base);
  assert.equal(location.origin,base,'Auth email must redirect to loopback UI');
  return location.toString();
}
test('real Ladenfluss UI registers, confirms email, creates company and resets password', {timeout:180000},async()=>{
  const config=localSupabase();
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const errors=[];
  let page;
  let phase='Initialisierung';
  let secondPage=null;
  try {
    const ctx=await browser.newContext();
    page=await ctx.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('requestfailed',request=>{
      if(request.url().startsWith('https://esm.sh/'))
        errors.push('Pinned browser SDK failed to load: '+(request.failure()?.errorText||'network failure'));
    });
    // In CI only, replace the disabled production switch with disposable local credentials.
    await page.route('**/assets/cloud-config.js', async route=>{
      await route.fulfill({
        status:200,
        contentType:'application/javascript',
        body:'window.LadenflussCloudConfig=Object.freeze('+JSON.stringify({
          enabled:true,url:config.url,publishableKey:config.key,
        })+');',
      });
    });
    const email='lf-browser-'+Date.now().toString(36)+'@example.test';
    const password='Secure-browser-password-2026';
    phase='A: Registrierung';
    await page.goto(base+'/konto',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('authStatus')?.textContent.includes('Sicher anmelden'),null,{timeout:30000});
    await page.locator('[data-account-tab=register]').click();
    await page.locator('[data-auth-form=register] input[type=email]').fill(email);
    await page.locator('[data-auth-form=register] input[type=password]').fill(password);
    await page.locator('[data-auth-form=register] input[type=checkbox]').check();
    await page.locator('[data-auth-form=register] button[type=submit]').click();
    await page.waitForFunction(()=>document.getElementById('authStatus')?.textContent.includes('E-Mail prüfen'),
      {timeout:25000});
    assert.equal(await page.locator('#signedInPanel').isVisible(),false);
    const confirmLink=await mailLink(email,'signup');
    const confirmedUrl=await redirectFromEmail(confirmLink);
    phase='A: E-Mail-Bestätigung';
    await page.goto(confirmedUrl,{waitUntil:'domcontentloaded'});
    await page.locator('#signedInPanel').waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('#accountEmail').textContent(),email);
    phase='A: Unternehmen einrichten';
    await page.goto(base+'/onboarding',{waitUntil:'domcontentloaded'});
    await page.locator('#company_name').fill('Ladenfluss Browser Test');
    await page.locator('#company_type').selectOption('Lebensmittel');
    await page.locator('#branch_name').fill('Testfiliale');
    await page.locator('#branch_days').fill('6');
    await page.locator('#branch_hours').fill('9.5');
    await page.locator('#companyOnboarding button[type=submit]').click();
    await page.waitForFunction(()=>document.getElementById('onboardingStatus')?.textContent.includes('Unternehmen angelegt'),
      {timeout:20000});
    // DEVICE A: Save local Ladenprofil through the actual UI and RPC.
    phase='A: Ladenprofil in Cloud speichern';
    await page.goto(base+'/mein-laden',{waitUntil:'domcontentloaded'});
    page.on('dialog',dialog=>{void dialog.accept();});
    await page.locator('[data-cockpit-tab=backup]').click();
    await page.locator('#cloudProfileCheck').waitFor({state:'visible',timeout:20000});
    await page.evaluate(() => window.LadenflussStoreSettings.save({
      name:'Cloud Profil Filiale A',type:'Lebensmittel',
    }));
    await page.locator('#cloudProfileCheck').click();
    await page.locator('#cloudProfileUpload').waitFor({state:'visible',timeout:15000});
    await page.locator('#cloudProfileUpload').click();
    await page.waitForFunction(
      () => document.getElementById('cloudProfileStatus')?.textContent.includes('erfolgreich in der Cloud gespeichert'),
      null,{timeout:20000});

    // DEVICE B: Separate browser context, no shared localStorage/auth token.
    const otherContext=await browser.newContext();
    phase='B: Cloud-Profil herunterladen';
    const other=await otherContext.newPage();
    secondPage=other;
    other.on('pageerror',error=>errors.push('Device B: '+error.message));
    other.on('dialog',dialog=>{void dialog.accept();});
    await other.route('**/assets/cloud-config.js', async route=>{
      await route.fulfill({status:200,contentType:'application/javascript',
        body:'window.LadenflussCloudConfig=Object.freeze('+JSON.stringify({
          enabled:true,url:config.url,publishableKey:config.key,
        })+');'});
    });
    await other.goto(base+'/konto',{waitUntil:'domcontentloaded'});
    await other.waitForFunction(
      () => document.getElementById('authStatus')?.textContent.includes('Sicher anmelden'),
      null,{timeout:30000});
    await other.locator('[data-auth-form=login] input[type=email]').fill(email);
    await other.locator('[data-auth-form=login] input[type=password]').fill(password);
    await other.locator('[data-auth-form=login] button[type=submit]').click();
    await other.locator('#signedInPanel').waitFor({state:'visible',timeout:20000});
    await other.goto(base+'/mein-laden',{waitUntil:'domcontentloaded'});
    await other.locator('[data-cockpit-tab=backup]').click();
    await other.locator('#cloudProfileCheck').waitFor({state:'visible',timeout:20000});
    await other.locator('#cloudProfileCheck').click();
    await other.locator('#cloudProfileDownload').waitFor({state:'visible',timeout:15000});
    await other.locator('#cloudProfileDownload').click();
    await other.waitForFunction(
      () => window.LadenflussStoreSettings?.read().name==='Cloud Profil Filiale A',
      null,{timeout:15000});

    // Both devices read revision 1; B has an unsaved local change.
    await other.evaluate(() => window.LadenflussStoreSettings.save({
      name:'Browser B Entwurf',
    }));
    await other.locator('#cloudProfileCheck').click();
    await other.locator('#cloudProfileUpload').waitFor({state:'visible',timeout:15000});
    phase='A/B: parallele Profiländerungen';
    // A commits revision 2 first.
    await page.evaluate(() => window.LadenflussStoreSettings.save({
      name:'Browser A Neu',
    }));
    await page.locator('#cloudProfileCheck').click();
    await page.locator('#cloudProfileUpload').waitFor({state:'visible',timeout:15000});
    await page.locator('#cloudProfileUpload').click();
    await page.waitForFunction(
      () => document.getElementById('cloudProfileStatus')?.textContent.includes('Version 2'),
      null,{timeout:20000});
    // Stale B must fail without losing its local unsent draft.
    await other.locator('#cloudProfileUpload').click();
    await other.waitForFunction(
      () => document.getElementById('cloudProfileStatus')?.textContent.includes('Speicherkonflikt'),
      null,{timeout:15000});
    const draft=await other.evaluate(() => {
      const keys=Object.keys(localStorage).filter(key=>key.startsWith('ladenfluss.cloud-draft.v2.'));
      return keys.length===1 ? JSON.parse(localStorage.getItem(keys[0])) : null;
    });
    assert.equal(draft?.payload?.name,'Browser B Entwurf');
    assert.equal(await other.evaluate(() => window.LadenflussStoreSettings.read().name),'Browser B Entwurf');
    await otherContext.close();
    secondPage=null;
    phase='A: Logout und Passwort-Reset';

    await page.goto(base+'/konto',{waitUntil:'domcontentloaded'});
    await page.locator('#accountLogout').click();
    await page.waitForFunction(()=>document.getElementById('authStatus')?.textContent.includes('Abgemeldet'),
      {timeout:12000});
    await page.locator('[data-auth-form=login] input[type=email]').fill(email);
    await page.locator('[data-reset]').click();
    await page.waitForFunction(()=>document.getElementById('authStatus')?.textContent.includes('Posteingang prüfen'),
      {timeout:12000});
    const recoveryLink=await mailLink(email,'recovery');
    phase='A: Passwort-Wiederherstellung';
    await page.goto(await redirectFromEmail(recoveryLink),{waitUntil:'domcontentloaded'});
    await page.locator('#passwordResetForm').waitFor({state:'visible',timeout:30000});
    const changedPassword='Changed-browser-password-2026';
    await page.locator('#newPassword').fill(changedPassword);
    await page.locator('#confirmPassword').fill(changedPassword);
    await page.locator('#passwordResetForm button[type=submit]').click();
    await page.waitForFunction(()=>document.getElementById('passwordResetStatus')?.textContent.includes('Passwort geändert'),
      {timeout:20000});
    phase='A: Erneut mit neuem Passwort anmelden';
    await page.goto(base+'/konto',{waitUntil:'domcontentloaded'});
    await page.locator('[data-auth-form=login] input[type=email]').fill(email);
    await page.locator('[data-auth-form=login] input[type=password]').fill(changedPassword);
    await page.locator('[data-auth-form=login] button[type=submit]').click();
    await page.locator('#signedInPanel').waitFor({state:'visible',timeout:20000});
    assert.equal(await page.locator('#accountEmail').textContent(),email);
    assert.deepEqual(errors,[],'Browser runtime emitted JavaScript errors');
    await ctx.close();
  } catch(e){
    const inspect=async p=>{
      if(!p)return 'no page';
      let data={url:p.url(),status:{}};
      for(const id of ['authStatus','cloudProfileStatus','onboardingStatus','passwordResetStatus']){
        try{data.status[id]=(await p.locator('#'+id).count())?(await p.locator('#'+id).textContent()).slice(0,240):null;}
        catch(_){data.status[id]='unavailable';}
      }
      return JSON.stringify(data);
    };
    throw new Error(e.message+'\nPhase: '+phase+'\nPage A: '+await inspect(page)+
      '\nPage B: '+await inspect(secondPage)+'\nBrowser errors: '+errors.join('; ').slice(0,1400));
  } finally{await browser.close();}
});
