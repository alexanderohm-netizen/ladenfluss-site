const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('konto.html','utf8');
const source=fs.readFileSync('assets/account.js','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function setup(overrides={}) {
 const dom=new JSDOM(html,{url:'https://www.ladenfluss.de/konto',runScripts:'outside-only'});
 const calls=[];let currentUser=null;let company=null;
 const auth={
  getUser:async()=>({data:{user:currentUser},error:null}),
  onAuthStateChange:()=>({}),
  signInWithPassword:async value=>{calls.push(['login',value.email]);currentUser={id:'user-a',email:value.email};return {data:{},error:null};},
  signUp:async value=>{calls.push(['register',value.options.emailRedirectTo]);return {data:{session:null},error:null};},
  resetPasswordForEmail:async(email,options)=>{calls.push(['reset',options.redirectTo]);return {error:null};},
  updateUser:async()=>({error:null}),signOut:async()=>{currentUser=null;return {error:null};},...overrides
 };
 const client={auth,from(table){let update=null;const q={
  select(){return q},order(){return q},limit(){return q},
  eq(){return table==='module_access'?Promise.resolve({data:[],error:null}):q},
  maybeSingle:async()=>({data:company,error:null}),
  insert(value){update=value;return q},update(value){update=value;return q},
  single:async()=>{company={id:'company-a',name:update.name};return {data:company,error:null}}
 };return q;}};
 await tick();
 dom.window.LadenflussCloud={getClient:()=>client};
 dom.window.eval(source);
 dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 await tick();
 async function submit(id,values){const form=dom.window.document.getElementById(id);Object.entries(values).forEach(([key,value])=>form.elements[key].value=value);form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();}
 return {dom,calls,submit,$:id=>dom.window.document.getElementById(id)};
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
