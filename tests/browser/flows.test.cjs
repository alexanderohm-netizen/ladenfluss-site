'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const key = 'ladenfluss.urlaubsplaner.v1';
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const route = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    let file = path.join(root, route);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = fs.existsSync(file+'.html') ? file+'.html' : path.join(file, 'index.html');
    if (!fs.existsSync(file)) file += '.html';
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    const mime = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml'};
    res.setHeader('Content-Type', (mime[path.extname(file)] || 'text/plain') + '; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
async function session(t, viewport = {width:1440, height:1000}) {
  const context = await browser.newContext({viewport});
  t.after(() => context.close());
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+02:00'));
  page.on('dialog', dialog => dialog.accept());
  return page;
}
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);

// Use the shipped Supabase SDK. Only the HTTP service is replaced, so these
// checks exercise PKCE storage, callback events and the real account page.
async function accountService(page, {expired = false} = {}) {
  const calls = {recover: null, exchange: [], passwordUpdates: 0};
  const user = {id:'00000000-0000-4000-8000-000000000001', aud:'authenticated', role:'authenticated',
    email:'test@example.invalid', email_confirmed_at:'2026-10-01T00:00:00Z',
    app_metadata:{provider:'email',providers:['email']}, user_metadata:{}, created_at:'2026-10-01T00:00:00Z'};
  const issued = Date.parse('2026-10-06T12:00:00+02:00') / 1000;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = encode({alg:'HS256',typ:'JWT'}) + '.' + encode({sub:user.id,exp:issued+3600,iat:issued,role:'authenticated'}) + '.test-signature';
  await page.route('https://nzxtdrmdvqyvcbohplzt.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
    const send = (data, status = 200) => route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
    if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers});
    if (url.pathname === '/auth/v1/recover') {
      calls.recover = {body:request.postDataJSON(),redirect:new URL(url.searchParams.get('redirect_to'))};
      return send({});
    }
    if (url.pathname === '/auth/v1/token') {
      calls.exchange.push(request.postDataJSON());
      if (expired) return send({error:'invalid_grant',code:'flow_state_expired',message:'Flow expired'},400);
      return send({access_token:token,refresh_token:'test-only-refresh',token_type:'bearer',expires_in:3600,expires_at:issued+3600,user});
    }
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') calls.passwordUpdates++;
      return send(user);
    }
    if (url.pathname === '/rest/v1/companies') return send(null);
    return send({message:'Unexpected test request'},500);
  });
  return calls;
}

async function requestPasswordLink(page) {
  await page.goto(base+'/konto');
  await page.locator('[data-account-tab=reset]').click();
  await page.locator('#resetForm input[name=email]').fill('test@example.invalid');
  await page.locator('#resetForm button[type=submit], #resetForm button:not([type])').click();
  await page.getByText('Wenn ein passendes Konto besteht, erhältst du einen Link zum Zurücksetzen. Öffne ihn in diesem Browser.', {exact:true}).waitFor();
}

test('Konto: echtes SDK führt PKCE-Passwortwechsel unter der Content Security Policy aus', async t => {
  const page = await session(t);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const service = await accountService(page);
  await requestPasswordLink(page);
  assert.equal(service.recover.body.code_challenge_method,'s256');
  const callback = service.recover.redirect;
  callback.searchParams.set('code','test-recovery-code');
  await page.goto(callback.toString());
  await page.locator('#recoveryPanel').waitFor({state:'visible'});
  assert.equal(service.exchange.length,1);
  assert.equal(service.exchange[0].auth_code,'test-recovery-code');
  assert.equal(createHash('sha256').update(service.exchange[0].code_verifier).digest('base64url'),service.recover.body.code_challenge);
  assert.equal(new URL(page.url()).search,'');
  await page.locator('#recoveryForm input[name=password]').fill('a-test-only-new-password');
  await page.locator('#recoveryForm button:not([type])').click();
  await page.getByText('Dein Passwort wurde geändert.', {exact:true}).waitFor();
  assert.equal(service.passwordUpdates,1);
  assert.equal(await page.locator('#recoveryPanel').isHidden(),true);
  assert.equal(await page.locator('#recoveryForm input').inputValue(),'');
  assert.deepEqual(errors,[]);
});

test('Konto: abgelaufener PKCE-Link zeigt Hilfe und keinen Passwortwechsel', async t => {
  const page = await session(t);
  const service = await accountService(page,{expired:true});
  await requestPasswordLink(page);
  const callback = service.recover.redirect;
  callback.searchParams.set('code','test-expired-code');
  await page.goto(callback.toString());
  await page.getByText(/Der Link konnte nicht bestätigt werden/).waitFor();
  assert.equal(await page.locator('#recoveryPanel').isHidden(),true);
  assert.equal(await page.locator('#resetForm').isVisible(),true);
  assert.equal(service.passwordUpdates,0);
  assert.equal(new URL(page.url()).search,'');
});

test('Konto: Link aus anderem Browser scheitert ohne PKCE-Verifier sicher', async t => {
  const page = await session(t);
  const service = await accountService(page);
  await page.goto(base+'/konto?recovery=1&code=test-foreign-code');
  await page.getByText(/Der Link konnte nicht bestätigt werden/).waitFor();
  assert.equal(await page.locator('#recoveryPanel').isHidden(),true);
  assert.equal(service.exchange.length,0);
  assert.equal(service.passwordUpdates,0);
});

for (const width of [1440, 390]) {
  test('Alle öffentlichen Seiten laden ohne JavaScriptfehler (' + width + ' px)', async t => {
    const page = await session(t, {width, height:1000});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const files = fs.readdirSync(root).filter(x => x.endsWith('.html') && x !== '404.html')
      .concat(fs.readdirSync(path.join(root,'tools')).filter(x => x.endsWith('.html')).map(x => 'tools/'+x))
      .concat(fs.readdirSync(path.join(root,'produkte')).filter(x => x.endsWith('.html')).map(x => 'produkte/'+x));
    for (const file of files) {
      const response = await page.goto(base+'/'+file.replace(/index\.html$/, '').replace(/\.html$/, ''));
      assert.equal(response.status(), 200, file);
      assert.equal(await page.locator('h1').count(), 1, file + ': Hauptüberschrift');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 2, file + ': horizontaler Überlauf ' + overflow);
    }
    assert.deepEqual(errors, []);
  });
}

test('Team übernehmen, Urlaub bearbeiten, speichern und in PEP erkennen', async t => {
  const page = await session(t);
  await page.goto(base+'/tools/urlaubsplaner');
  await page.locator('[data-vac-view=team]').click();
  await page.locator('#vacImportPep').click();
  assert.equal((await snapshot(page)).employees.length, 3);
  await page.locator('[data-vac-view=settings]').click();
  await page.locator('#vacWorkweek').selectOption('6');
  await page.locator('[data-vac-view=entry]').click();
  await page.locator('#vacPerson').selectOption('e1');
  await page.locator('#vacFrom').fill('2026-10-05');
  await page.locator('#vacTo').fill('2026-10-10');
  await page.locator('#vacStatus').selectOption('approved');
  await page.locator('#vacSaveEntry').click();
  assert.equal((await snapshot(page)).entries[0].status, 'approved');
  await page.locator('[data-vac-view=team]').click();
  assert.match(await page.locator('#vacBalances').innerText(), /24 frei \/ 30/);
  await page.reload();
  assert.match(await page.locator('#vacEntries').innerText(), /6 Arbeitstage/);
  await page.goto(base+'/pep');
  assert.ok(await page.locator('.has-conflict').count() > 0);
  assert.match(await page.locator('#pepBody').innerText(), /Urlaub/);
  await page.goto(base+'/tools/urlaubsplaner');
  await page.getByRole('button', {name:'Bearbeiten', exact:true}).click();
  await page.locator('#vacTo').fill('2026-10-09');
  await page.locator('#vacSaveEntry').click();
  await page.locator('[data-vac-view=team]').click();
  assert.match(await page.locator('#vacBalances').innerText(), /25 frei \/ 30/);
  await page.locator('[data-vac-view=calendar]').click();
  await page.locator('#vacEntries').getByRole('button', {name:'Löschen', exact:true}).click();
  await page.reload();
  assert.equal((await snapshot(page)).entries.length, 0);
});

test('Beschädigte Browserdaten sperren alle Änderungen und bleiben erhalten', async t => {
  const page = await session(t);
  await page.goto(base+'/tools/urlaubsplaner');
  const raw = JSON.stringify({version:1, employees:[], entries:[], settings:{state:'HE'}});
  await page.evaluate(({key, raw}) => localStorage.setItem(key, raw), {key,raw});
  await page.reload();
  assert.match(await page.locator('#vacError').innerText(), /Bearbeitung gesperrt/);
  assert.equal(await page.locator('.vac-app button:enabled').count(), 0);
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), raw);
});

test('Speicherfehler erzeugt keine versteckten oder doppelten Mitarbeiter', async t => {
  const page = await session(t);
  await page.goto(base+'/tools/urlaubsplaner');
  await page.evaluate(k => {
    const original = Storage.prototype.setItem;
    window.restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(name,value) {
      if (name === k) throw new DOMException('Test: Speicher voll', 'QuotaExceededError');
      return original.call(this,name,value);
    };
  }, key);
  await page.locator('[data-vac-view=team]').click();
  await page.locator('#vacEmployeeName').fill('Nicht gespeichert');
  await page.locator('#vacEmployeeForm button').click();
  assert.match(await page.locator('#vacError').innerText(), /nicht gespeichert/);
  assert.equal(await page.locator('#vacTeamCount').innerText(), '0');
  await page.evaluate(() => window.restoreStorage());
  await page.locator('#vacEmployeeName').fill('Anna gespeichert');
  await page.locator('#vacEmployeeForm button').click();
  await page.reload();
  assert.deepEqual((await snapshot(page)).employees.map(e=>e.name), ['Anna gespeichert']);
});

test('Mitarbeiternamen bleiben Text in Mitarbeiterliste und Dienstplan', async t => {
  const page = await session(t);
  await page.goto(base+'/mitarbeiter');
  await page.locator('#addEmployee').click();
  await page.locator('#employeeName').fill('<b>Alex & Team</b>');
  await page.locator('#employeeForm button[type=submit]').click();
  assert.equal(await page.locator('#staffList b').count(), 0);
  assert.match(await page.locator('#staffList').innerText(), /<b>Alex & Team<\/b>/);
  await page.goto(base+'/pep');
  assert.equal(await page.locator('#pepBody b').count(), 0);
  assert.match(await page.locator('#pepBody').innerText(), /<b>Alex & Team<\/b>/);
});

test('Ungültige Rechnung blendet Ergebnis und Kopieren sichtbar aus', async t => {
  const page=await session(t);
  await page.goto(base+'/tools/lagerumschlag');
  assert.equal(await page.locator('.result-toolbar').isVisible(),true);
  await page.locator('#st_stock').fill('');
  await page.evaluate(()=>window.calcStockTurn());
  assert.equal(await page.locator('#st_result').isVisible(),false);
  assert.equal(await page.locator('.result-toolbar').isVisible(),false);
  assert.equal(await page.locator('.result-insight').isVisible(),false);
  await page.locator('#st_stock').fill('1000');
  await page.evaluate(()=>window.calcStockTurn());
  assert.equal(await page.locator('#st_result').isVisible(),true);
  assert.equal(await page.locator('.result-toolbar').isVisible(),true);
});

test('Personalbedarf führt zum gewählten Tag und zeigt den gespeicherten Vergleich', async t=>{
  const page=await session(t);
  await page.goto(base+'/tools/personalbedarf');
  await page.locator('#p_date').fill('2026-10-08');
  await page.getByRole('button',{name:'Team-Bedarf anzeigen'}).click();
  await page.locator('.planning-transfer').click();
  assert.match(page.url(),/week=2026-10-05&day=2026-10-08/);
  assert.equal(await page.locator('#planningReference').isVisible(),true);
  assert.match(await page.locator('#planningReference').innerText(),/Donnerstag/);
  await page.locator('#nextWeek').click();
  assert.equal(await page.locator('#planningReference').isVisible(),false);
});

test('Gemeinsamer Rechner: Menü, Dezimaltastatur und Formelergebnisse', async t=>{
  const page=await session(t,{width:390,height:844});
  await page.goto(base+'/rechner');
  await page.locator('#chooseMode').click();
  await page.locator('[data-mode=margenrechner]').click();
  await page.locator('[data-field=m_cost]').click();
  for(const key of ['clear','1','2','.','5'])await page.locator('[data-key="'+key+'"]').click();
  assert.equal(await page.locator('#m_cost').inputValue(),'12.5');
  await page.locator('[data-key=calculate]').click();
  await page.locator('#fullInputs > summary').click();
  assert.equal(await page.locator('#m_result').isVisible(),true);
  for(const mode of ['rabattrechner','break-even','kpi-dashboard','personalkosten-budget','rohertrag-wareneinsatz','lagerumschlag','personalbedarf']){
    await page.locator('#chooseMode').click();await page.locator('[data-mode='+mode+']').click();
    assert.doesNotMatch(await page.locator('#screenValue').innerText(),/NaN|Infinity|undefined/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=2,mode);
  }
});

for(const width of [390,1440])test('App-Ansichten als Bild prüfen ('+width+' px)',async t=>{
  const page=await session(t,{width,height:1000});
  const folder=path.join(root,'test-artifacts');fs.mkdirSync(folder,{recursive:true});
  await page.goto(base+'/rechner#margenrechner');
  await page.screenshot({path:path.join(folder,'calculator-'+width+'.png'),fullPage:true});
  await page.locator('#chooseMode').click();
  await page.screenshot({path:path.join(folder,'menu-'+width+'.png'),fullPage:true});
  await page.goto(base+'/tools/urlaubsplaner');
  await page.screenshot({path:path.join(folder,'vacation-'+width+'.png'),fullPage:true});
});

test('Zahlenfluss: mobile entry, edit, reload, target and duplicate protection', async t => {
 const page=await session(t,{width:390,height:844});
 await page.goto(base+'/zahlenfluss');
 await page.getByRole('button',{name:'Tageszahlen',exact:true}).click();
 await page.locator('[name=date]').fill('2026-10-06');
 await page.locator('[name=revenue]').fill('1234,56');
 await page.locator('[name=goods]').fill('400');
 await page.locator('[name=labor]').fill('300');
 await page.locator('[name=other]').fill('100');
 await page.getByRole('button',{name:'Tag speichern',exact:true}).click();
 assert.match(await page.locator('#revenue').textContent(),/1\.234,56/);
 assert.match(await page.locator('#contribution').textContent(),/434,56/);
 await page.reload();
 assert.match(await page.locator('#revenue').textContent(),/1\.234,56/);
 await page.getByRole('button',{name:'Bearbeiten 06.10.'}).click();
 await page.locator('[name=revenue]').fill('1500');
 await page.getByRole('button',{name:'Tag speichern',exact:true}).click();
 assert.match(await page.locator('#revenue').textContent(),/1\.500,00/);
 await page.getByRole('button',{name:'Tageszahlen',exact:true}).click();
 await page.locator('[name=date]').fill('2026-10-06');await page.locator('[name=revenue]').fill('99');
 await page.getByRole('button',{name:'Tag speichern',exact:true}).click();
 assert.match(await page.locator('#zf-error').textContent(),/bereits erfasst/);
 await page.getByRole('button',{name:'Ziel & Export',exact:true}).click();
 await page.locator('#target').fill('3000');await page.getByRole('button',{name:'Ziel speichern',exact:true}).click();
 await page.getByRole('button',{name:'Überblick',exact:true}).click();
 assert.match(await page.locator('#goal-label').textContent(),/50 %/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts/zahlenfluss-mobile.png'),fullPage:true});
});

test('Warenfluss: mobile article, receipt, oversell protection and persistent history', async t=>{
 const page=await session(t,{width:390,height:844});await page.goto(base+'/warenfluss');
 await page.getByRole('button',{name:'Artikel',exact:true}).click();await page.getByRole('button',{name:'Artikel anlegen',exact:true}).click();
 await page.locator('#article-form [name=name]').fill('Kaffee');await page.locator('[name=sku]').fill('K01');await page.locator('[name=minimum]').fill('5');await page.getByRole('button',{name:'Artikel speichern',exact:true}).click();
 await page.getByRole('button',{name:'Buchen',exact:true}).click();await page.locator('[name=quantity]').fill('10');await page.locator('[name=note]').fill('Anfangsbestand');await page.locator('#book').click();
 assert.match(await page.locator('#movement-list').textContent(),/\+10 Stk/);
 await page.getByRole('button',{name:'Buchen',exact:true}).click();await page.locator('#movement-type').selectOption('issue');await page.locator('[name=quantity]').fill('11');await page.locator('[name=note]').fill('Verkauf');await page.locator('#book').click();assert.match(await page.locator('#wf-error').textContent(),/Nicht genügend Bestand/);
 await page.locator('[name=quantity]').fill('6');await page.locator('#book').click();await page.reload();
 assert.equal(await page.locator('#stock-count').textContent(),'4');assert.equal(await page.locator('#low-count').textContent(),'1');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts/warenfluss-mobile.png'),fullPage:true});
});

test('Teamfluss: shared mobile navigation, read-only overview and dated plan link',async t=>{
 const page=await session(t,{width:390,height:844});await page.goto(base+'/teamfluss');
 assert.equal(await page.evaluate(()=>localStorage.length),0);
 await page.evaluate(()=>{localStorage.setItem('ladenfluss.team.v1',JSON.stringify([{id:'a',name:'Alex',role:'Verkauf',hours:30}]));localStorage.setItem('ladenfluss.pep.weeks.v2',JSON.stringify({'2026-10-05':{a:[null,['09:00','17:00',30],null,null,null,null,null]}}));localStorage.setItem('ladenfluss.pep.absences.v1',JSON.stringify({'2026-10-05':{a:[null,'Krank',null,null,null,null,null]}}));});
 await page.reload();assert.equal(await page.locator('#tf-count').textContent(),'1');assert.equal(await page.locator('#tf-planned').textContent(),'0');assert.equal(await page.locator('#tf-away').textContent(),'1');assert.match(await page.locator('#tf-roster').textContent(),/Konflikt/);
 assert.equal(await page.locator('#tf-plan-link').getAttribute('href'),'/pep?week=2026-10-05&day=2026-10-06');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('navigation',{name:'Hauptnavigation',exact:true}).getByRole('link',{name:'Warenfluss',exact:true}).click();assert.match(page.url(),/warenfluss$/);
 await page.getByRole('navigation',{name:'Hauptnavigation',exact:true}).getByRole('link',{name:'Teamfluss',exact:true}).click();
 fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts/teamfluss-mobile.png'),fullPage:true});
});

test('Restore: preview, cancel, confirmation and reload preserve unrelated data',async t=>{
 const page=await session(t,{width:390,height:844});await page.goto(base+'/zahlenfluss');
 await page.evaluate(()=>localStorage.setItem('unrelated','keep'));
 await page.locator('.restore-box summary').click();
 const data={version:1,target:300000,entries:[{date:'2026-10-06',revenue:150000,goods:null,labor:null,other:null,hours:null,receipts:null}]};
 const upload=()=>page.locator('#restore-file').setInputFiles({name:'sicherung.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await upload();await page.locator('#restore-preview').waitFor({state:'visible'});
 assert.equal(await page.locator('#restore-apply').isDisabled(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('ladenfluss.zahlenfluss.v1')),null);
 await page.locator('#restore-cancel').click();assert.equal(await page.locator('#restore-preview').isVisible(),false);
 await upload();await page.locator('#restore-preview').waitFor({state:'visible'});await page.locator('#restore-confirm').check();
 fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.locator('.restore-box').screenshot({path:path.join(root,'test-artifacts/restore-mobile.png')});
 await Promise.all([page.waitForEvent('load'),page.locator('#restore-apply').click()]);
 assert.match(await page.locator('#revenue').textContent(),/1\.500,00/);
 assert.match(await page.locator('#restore-status').textContent(),/wiederhergestellt/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated')),'keep');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

test('Restore: corrupt Warenfluss can be recovered and hostile text stays text',async t=>{
 const page=await session(t);await page.goto(base+'/warenfluss');await page.evaluate(()=>localStorage.setItem('ladenfluss.warenfluss.v1','{broken'));await page.reload();
 await page.locator('.restore-box summary').click();
 const data={version:1,articles:[{id:'a',name:'<img src=x onerror=alert(1)>',sku:'A',minimum:2,archived:false}],movements:[{id:'m',articleId:'a',type:'receipt',delta:4,note:'Start',at:'2026-10-08T12:00:00Z'}]};
 await page.locator('#restore-file').setInputFiles({name:'waren.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('#restore-preview').waitFor({state:'visible'});await page.locator('#restore-confirm').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#restore-apply').click()]);
 assert.equal(await page.locator('#stock-count').textContent(),'4');await page.getByRole('button',{name:'Artikel',exact:true}).click();assert.match(await page.locator('#article-list').textContent(),/<img/);assert.equal(await page.locator('#article-list img').count(),0);
});

test('Team restore: one package drives team, roster and vacation after reload',async t=>{
 const page=await session(t,{width:390,height:844});await page.goto(base+'/teamfluss');
 await page.evaluate(()=>{localStorage.setItem('ladenfluss.zahlenfluss.v1','untouched');localStorage.setItem('ladenfluss.store.v1',JSON.stringify({name:'Mein Geschäft'}));});
 const data={format:'ladenfluss-local-backup',version:1,records:{'ladenfluss.team.v1':JSON.stringify([{id:'restore-a',name:'Lena',role:'Verkauf',branch:'Hauptfiliale',hours:30,docs:true}]),'ladenfluss.pep.weeks.v2':JSON.stringify({'2026-10-05':{'restore-a':[null,['09:00','17:00',30],null,null,null,null,null]}}),'ladenfluss.urlaubsplaner.v1':JSON.stringify({version:1,employees:[{id:'restore-a',name:'Lena',allowance:30}],entries:[{id:'v',employeeId:'restore-a',start:'2026-10-06',end:'2026-10-06',status:'approved',note:''}],settings:{state:'HE',workdays:[1,2,3,4,5],maxAbsent:1}})}};
 await page.locator('.restore-box summary').click();await page.locator('#restore-file').setInputFiles({name:'ladenfluss.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('#restore-preview').waitFor({state:'visible'});await page.locator('#restore-confirm').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#restore-apply').click()]);
 fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.locator('.restore-box').screenshot({path:path.join(root,'test-artifacts/team-restore-mobile.png')});
 assert.match(await page.locator('#tf-roster').textContent(),/Konflikt: Urlaub/);assert.equal(await page.locator('#tf-away').textContent(),'1');assert.equal(await page.evaluate(()=>localStorage.getItem('ladenfluss.zahlenfluss.v1')),'untouched');
 await page.goto(base+'/mitarbeiter');assert.match(await page.locator('#staffList').textContent(),/Lena/);await page.evaluate(()=>{const s=window.LadenflussTeamStore,t=s.getTeam();t[0].hours=32;s.saveTeam(t);});await page.reload();assert.match(await page.locator('#targetHours').textContent(),/32/);
 await page.goto(base+'/pep?week=2026-10-05');assert.match(await page.locator('#pepBody').textContent(),/Lena/);
 await page.goto(base+'/tools/urlaubsplaner');assert.equal(await page.evaluate(()=>window.LadenflussVacation.read().entries[0].employeeId),'restore-a');
 await page.goto(base+'/mein-laden');const backup=await page.evaluate(()=>window.LadenflussBackup.capture());assert.equal(JSON.parse(backup.records['ladenfluss.team.v1'])[0].hours,32);assert.equal(JSON.parse(backup.records['ladenfluss.urlaubsplaner.v1']).entries.length,1);
});
