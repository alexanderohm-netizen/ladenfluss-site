/* Real local Supabase Auth + Mailpit E2E.
 * Runs ONLY after "supabase start" in an isolated CI runner.
 * No network calls to the hosted Ladenfluss project; no production credentials.
 */
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

function localConfig() {
  const raw = execFileSync('supabase',['status','-o','env'],{encoding:'utf8'});
  const vars = {};
  for (const line of raw.split(/\r?\n/)) {
    const match=line.match(/^(?:export )?([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) vars[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');
  }
  const key=vars.ANON_KEY || vars.PUBLISHABLE_KEY;
  if (!key) throw new Error('No local Supabase publishable/anon key found');
  const url = vars.API_URL || 'http://127.0.0.1:54321';
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d{2,5}\/?$/.test(url))
    throw new Error('Refusing to run Auth E2E against a non-local API endpoint');
  return {key,url:url.replace(/\/$/,'')};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function authRequest(conf,path,{method='POST',token=conf.key,payload}={}) {
  const res=await fetch(conf.url+'/auth/v1'+path,{
    method,
    headers:{apikey:conf.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:payload===undefined?undefined:JSON.stringify(payload),
    redirect:'manual',
  });
  let data;
  try {data=await res.json();} catch (_) {data=null;}
  return {status:res.status,data,headers:res.headers};
}
async function findMail(to, expectedType) {
  for (let attempt=0;attempt<35;attempt++) {
    const res=await fetch('http://127.0.0.1:54324/api/v1/messages?limit=50');
    if (!res.ok) throw new Error('Local Mailpit is unavailable: '+res.status);
    const index=await res.json();
    const messages=index.messages||index.Messages||[];
    for (const item of messages) {
      if (!JSON.stringify(item).toLowerCase().includes(to.toLowerCase())) continue;
      const id=item.ID||item.Id||item.id;
      const detailRes=await fetch('http://127.0.0.1:54324/api/v1/message/'+encodeURIComponent(id));
      if (!detailRes.ok) continue;
      const mail=await detailRes.json();
      const contents=[mail.HTML,mail.Text,mail.HTMLBody,mail.TextBody].filter(Boolean).join('\n');
      const hrefs=[...contents.matchAll(/https?:\/\/[^\s"'<>]+/g)]
        .map(match=>match[0].replaceAll('&amp;','&').replaceAll('&#38;','&'));
      const found=hrefs.find(raw=>{
        try {
          const u=new URL(raw);
          return u.pathname.endsWith('/auth/v1/verify') &&
                 u.searchParams.get('type')===expectedType;
        } catch (_) {return false;}
      });
      if (found) return found;
    }
    await sleep(250);
  }
  throw new Error('No '+expectedType+' confirmation URL in local Mailpit mailbox');
}
async function followLocalAuthLink(rawUrl) {
  const target=new URL(rawUrl);
  if (!['127.0.0.1','localhost','kong'].includes(target.hostname) ||
      !target.pathname.endsWith('/auth/v1/verify'))
    throw new Error('Refusing to open an untrusted confirmation URL');
  const res=await fetch(target,{redirect:'manual'});
  assert.ok([302,303].includes(res.status),'Expected successful local Auth redirect, got '+res.status);
  const redirect=res.headers.get('location');
  assert.ok(redirect,'Auth confirmation has no redirect URL');
  return new URL(redirect,'http://127.0.0.1:54321');
}

test('real local GoTrue rejects unconfirmed email, confirms user, and allows verified sign-in', {timeout:90000},async()=>{
  const conf=localConfig();
  const unique='lf-e2e-'+Date.now().toString(36);
  const email=unique+'@example.test';
  const password='A-long-test-password-12345';
  const created=await authRequest(conf,'/signup',{payload:{email,password}});
  assert.ok(created.status>=200 && created.status<300,'Signup request rejected: '+created.status);
  assert.equal(created.data?.access_token,undefined,'Unconfirmed signup must not issue access token');

  const denied=await authRequest(conf,'/token?grant_type=password',{payload:{email,password}});
  assert.notEqual(denied.status,200,'Unconfirmed account should not obtain a session');

  const confirmation=await findMail(email,'signup');
  await followLocalAuthLink(confirmation);

  const login=await authRequest(conf,'/token?grant_type=password',{payload:{email,password}});
  assert.equal(login.status,200,'Verified login was refused: '+login.status);
  assert.ok(login.data?.access_token,'Verified login missing access token');
  assert.ok(login.data?.user?.id,'Verified login missing user');
  assert.ok(login.data.user.email_confirmed_at,'Login user must be confirmed');

  const me=await authRequest(conf,'/user',{method:'GET',token:login.data.access_token});
  assert.equal(me.status,200,'Authenticated /user lookup failed: '+me.status);
  assert.equal(me.data.email,email);

  // Recovery email is captured by LOCAL Mailpit, never delivered to real addresses.
  const recovery=await authRequest(conf,'/recover',{payload:{email}});
  assert.equal(recovery.status,200,'Recovery request was refused: '+recovery.status);
  const resetLink=await findMail(email,'recovery');
  const resetRedirect=await followLocalAuthLink(resetLink);
  let resetToken=new URLSearchParams(resetRedirect.hash.replace(/^#/,'')).get('access_token');
  if (!resetToken) resetToken=resetRedirect.searchParams.get('access_token');
  assert.ok(resetToken,'Recovery redirect must provide a recovery session token');

  const newPassword='A-second-long-password-12345';
  const updated=await authRequest(conf,'/user',{
    method:'PUT',token:resetToken,payload:{password:newPassword},
  });
  assert.equal(updated.status,200,'Password update through recovery session failed: '+updated.status);

  const newLogin=await authRequest(conf,'/token?grant_type=password',{payload:{email,password:newPassword}});
  assert.equal(newLogin.status,200,'New password should sign in: '+newLogin.status);
  assert.equal(newLogin.data.user.id,login.data.user.id);

  const otherEmail=unique+'-other@example.test';
  const createdSecond=await authRequest(conf,'/signup',{payload:{email:otherEmail,password}});
  assert.ok(createdSecond.status>=200 && createdSecond.status<300);
  await followLocalAuthLink(await findMail(otherEmail,'signup'));
  const second=await authRequest(conf,'/token?grant_type=password',{payload:{email:otherEmail,password}});
  assert.equal(second.status,200);
  assert.notEqual(second.data.user.id,login.data.user.id);
  assert.notEqual(second.data.access_token,login.data.access_token);
});
