'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
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
