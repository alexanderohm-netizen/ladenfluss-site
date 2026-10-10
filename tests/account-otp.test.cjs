const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
async function fixture(){
 const dom=new JSDOM(fs.readFileSync('konto.html','utf8'),{url:'https://www.ladenfluss.de/konto',runScripts:'outside-only'});
 const w=dom.window,calls=[];let user=null;
 const client={auth:{
  getUser:async()=>({data:{user},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signUp:async value=>{calls.push({kind:'signup',redirect:value.options.emailRedirectTo});return {data:{session:null,user:null},error:null};},
  resend:async value=>{calls.push({kind:'resend',...value});return {data:{},error:null};},
  verifyOtp:async value=>{calls.push({kind:'verify',...value});user={id:'confirmed-user',email:value.email,email_confirmed_at:'2026-10-01T00:00:00Z'};return {data:{user,session:{user}},error:null};}
 },from(table){
   const q={select(){return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:null,error:null})};return q;
 }};
 await tick();
 w.LadenflussCloud={getClient:()=>client};
 w.eval(fs.readFileSync('assets/account.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 const $=id=>w.document.getElementById(id);
 async function submit(id,fields){const form=$(id);for(const [key,val] of Object.entries(fields))form.elements[key].value=val;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();}
 return {dom,w,$,calls,submit};
}
test('New signup opens verification; OTP validates and signs in a confirmed account',async t=>{
 const a=await fixture();t.after(()=>a.dom.window.close());
 const samplePassword='x'.repeat(16);
 await a.submit('registerForm',{email:'demo@example.invalid',password:samplePassword});
 assert.equal(a.$('signedIn').hidden,true);
 assert.equal(a.$('verifyForm').closest('[data-account-panel]').hidden,false);
 assert.equal(a.$('verifyForm').elements.email.value,'demo@example.invalid');
 await a.submit('verifyForm',{email:'demo@example.invalid',token:'123456'});
 assert.deepEqual(a.calls[1],{kind:'verify',email:'demo@example.invalid',token:'123456',type:'email'});
 assert.equal(a.$('signedIn').hidden,false);
 assert.equal(a.$('verifyForm').elements.token.value,'');
 assert.match(a.$('authStatus').textContent,/bestätigt/);
});
test('Resend confirmation uses the correct Supabase API and an exact return URL',async t=>{
 const a=await fixture();t.after(()=>a.dom.window.close());
 await a.submit('resendForm',{email:'demo@example.invalid'});
 assert.equal(a.calls[0].kind,'resend');
 assert.equal(a.calls[0].type,'signup');
 assert.equal(a.calls[0].email,'demo@example.invalid');
 assert.equal(a.calls[0].options.emailRedirectTo,'https://www.ladenfluss.de/konto');
});
test('An explicitly unconfirmed server user cannot access its company area',async t=>{
 const a=await fixture();t.after(()=>a.dom.window.close());
 assert.equal(a.$('signedIn').hidden,true);
 assert.equal(a.$('companyDetails').hidden,true);
});
