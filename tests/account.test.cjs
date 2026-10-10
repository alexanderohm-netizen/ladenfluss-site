const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('konto.html','utf8');
const source=fs.readFileSync('assets/account.js','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function setup(overrides={},options={}) {
 const dom=new JSDOM(html,{url:options.url||'https://www.ladenfluss.de/konto',runScripts:'outside-only'});
 const calls=[];let currentUser=options.user||null;let company=options.company||null;let authListener;
 const auth={
  getUser:async()=>({data:{user:currentUser},error:null}),
  onAuthStateChange:fn=>{authListener=fn;return {};},
  exchangeCodeForSession:async(code,flow)=>{
   calls.push(['exchange',code,flow?.flowId]);
   currentUser={id:'user-a',email:'test@example.invalid'};
   authListener(options.callbackEvent||'PASSWORD_RECOVERY',{user:currentUser});
   return {data:{user:currentUser},error:null};
  },
  signInWithPassword:async value=>{calls.push(['login',value.email]);currentUser={id:'user-a',email:value.email};return {data:{},error:null};},
  signUp:async value=>{calls.push(['register',value.options.emailRedirectTo]);return {data:{session:null},error:null};},
  resetPasswordForEmail:async(email,options)=>{calls.push(['reset',options.redirectTo]);return {error:null};},
  updateUser:async()=>{calls.push(['password-updated']);return {error:null};},
  signOut:async()=>{currentUser=null;authListener('SIGNED_OUT',null);return {error:null};},...overrides
 };
 const client={auth,from(table){let update=null;const q={
  select(){return q},order(){return q},limit(){return q},
  eq(){return table==='module_access'?Promise.resolve({data:[],error:null}):q},
  maybeSingle:options.loadCompany||(async()=>({data:company,error:null})),
  insert(value){update=value;return q},update(value){update=value;return q},
  single:async()=>{company={id:'company-a',name:update.name};return {data:company,error:null}}
 };return q;}};
 await tick();
 dom.window.LadenflussCloud={getClient:()=>client};
 dom.window.eval(source);
 dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 await tick();
 async function submit(id,values){const form=dom.window.document.getElementById(id);Object.entries(values).forEach(([key,value])=>form.elements[key].value=value);form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();}
 return {dom,calls,submit,emit:(event,session)=>{currentUser=session?.user||null;authListener(event,session);},$:id=>dom.window.document.getElementById(id)};
}
test('Login, Cloud-Unternehmen und Logout löschen sichtbare Kontodaten',async()=>{
 const app=await setup();await app.submit('loginForm',{email:'test@example.invalid',password:'testpassword12'});
 assert.equal(app.$('signedIn').hidden,false);
 assert.equal(app.$('loginForm').elements.password.value,'');
 await app.submit('companyForm',{company:'Testladen'});
 assert.match(app.$('authStatus').textContent,/Cloud geladen/);
 assert.equal(app.$('moduleList').children.length,3);
 assert.match(app.$('moduleList').textContent,/Nicht freigeschaltet/);
 app.$('signOut').click();await tick();assert.equal(app.$('signedIn').hidden,true);assert.equal(app.$('accountEmail').textContent,'');app.dom.window.close();
});
test('Fehlerhafte Anmeldung zeigt keinen Kundenbereich und behält kein Passwort',async()=>{
 const app=await setup({signInWithPassword:async()=>({error:{code:'invalid_credentials'}})});
 await app.submit('loginForm',{email:'test@example.invalid',password:'wrongpassword'});
 assert.equal(app.$('signedIn').hidden,true);assert.match(app.$('authStatus').textContent,/Anmeldung fehlgeschlagen/);assert.equal(app.$('loginForm').elements.password.value,'');app.dom.window.close();
});
test('Registrierung wartet auf Bestätigung statt Cloud-Zugang vorzutäuschen',async()=>{
 const app=await setup();await app.submit('registerForm',{email:'test@example.invalid',password:'testpassword12'});
 assert.match(app.$('authStatus').textContent,/Bestätigungslink/);assert.equal(app.$('signedIn').hidden,true);assert.deepEqual(app.calls,[['register','https://www.ladenfluss.de/konto']]);app.dom.window.close();
});
test('Passwort-Reset nutzt feste Konto-Route und antwortet ohne Kontoauskunft',async()=>{
 const app=await setup();await app.submit('resetForm',{email:'test@example.invalid'});
 assert.deepEqual(app.calls,[['reset','https://www.ladenfluss.de/konto?recovery=1']]);assert.match(app.$('authStatus').textContent,/Wenn ein passendes Konto/);app.dom.window.close();
});

test('Nur ein bestätigter PKCE-Rückruf öffnet den Passwortwechsel und bereinigt die URL',async()=>{
 const app=await setup({}, {url:'https://www.ladenfluss.de/konto?recovery=1&code=one-time-code&sb_flow_id=flow-id'});
 assert.equal(app.$('recoveryPanel').hidden,false);
 assert.equal(app.$('signedIn').hidden,true);
 assert.equal(app.dom.window.location.href,'https://www.ladenfluss.de/konto');
 assert.deepEqual(app.calls,[['exchange','one-time-code','flow-id']]);
 await app.submit('recoveryForm',{password:'a-new-password-2026'});
 assert.match(app.$('authStatus').textContent,/Passwort wurde geändert/);
 assert.equal(app.$('recoveryPanel').hidden,true);
 assert.equal(app.$('signedIn').hidden,false);
 assert.equal(app.$('recoveryForm').elements.password.value,'');
 app.dom.window.close();
});

test('Abgelaufener Rückruf nutzt keine bestehende Sitzung zum Passwortwechsel',async()=>{
 const app=await setup({exchangeCodeForSession:async()=>({error:{code:'flow_state_expired'}})}, {
  url:'https://www.ladenfluss.de/konto?code=expired&recovery=1',user:{id:'user-a',email:'test@example.invalid'}
 });
 assert.equal(app.$('recoveryPanel').hidden,true);
 assert.match(app.$('authStatus').textContent,/Link konnte nicht bestätigt/);
 assert.equal(app.dom.window.location.search,'');
 await app.submit('recoveryForm',{password:'a-new-password-2026'});
 assert.deepEqual(app.calls,[]);
 app.dom.window.close();
});

test('Recovery-Query allein und Provider-Fehler öffnen keinen Passwortwechsel',async()=>{
 for(const suffix of ['?recovery=1','?recovery=1#error=access_denied&error_description=%3Cscript%3Eunsafe%3C/script%3E']){
  const app=await setup({}, {url:'https://www.ladenfluss.de/konto'+suffix,user:{id:'user-a',email:'test@example.invalid'}});
  assert.equal(app.$('recoveryPanel').hidden,true);
  assert.match(app.$('authStatus').textContent,/Link konnte nicht bestätigt/);
  assert.doesNotMatch(app.$('authStatus').textContent,/unsafe/);
  assert.equal(app.dom.window.location.hash,'');
  assert.deepEqual(app.calls,[]);
  app.dom.window.close();
 }
});

test('Verbindungsfehler lassen sich erneut prüfen und erscheinen nicht als Logout',async()=>{
 let offline=true;
 const app=await setup({getUser:async()=>offline?{data:{user:null},error:new Error('network')}:{data:{user:{id:'user-a',email:'test@example.invalid'}},error:null}});
 assert.equal(app.$('signedIn').hidden,true);
 assert.match(app.$('authStatus').textContent,/Verbindung/);
 assert.equal(app.$('authRetry').hidden,false);
 offline=false;app.$('authRetry').click();await tick();
 assert.equal(app.$('signedIn').hidden,false);
 assert.equal(app.$('authRetry').hidden,true);
 app.dom.window.close();
});

test('Abmeldung in einem anderen Tab verwirft verspätete Unternehmensdaten',async()=>{
 let complete;
 const app=await setup({}, {user:{id:'user-a',email:'test@example.invalid'},loadCompany:()=>new Promise(resolve=>{complete=resolve;})});
 assert.equal(app.$('signedIn').hidden,false);
 app.emit('SIGNED_OUT',null);
 assert.equal(app.$('signedIn').hidden,true);
 assert.equal(app.$('accountEmail').textContent,'');
 complete({data:{id:'company-a',name:'Nicht mehr anzeigen'},error:null});await tick();
 assert.equal(app.$('companyForm').elements.company.value,'');
 assert.equal(app.$('companyDetails').hidden,true);
 assert.equal(app.$('moduleList').children.length,0);
 app.dom.window.close();
});
