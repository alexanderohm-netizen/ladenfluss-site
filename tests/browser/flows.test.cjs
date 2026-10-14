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
  await page.locator('#planningReference').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#planningReference').innerText(),/Donnerstag/);
  await page.locator('#nextWeek').click();
  assert.equal(await page.locator('#planningReference').isVisible(),false);
});

test('Gemeinsamer Rechner: Menü, Dezimaltastatur und Formelergebnisse', async t=>{
  const page=await session(t,{width:390,height:844});
  await page.goto(base+'/rechner');
  await page.locator('#chooseMode').click();
  await page.locator('[data-mode=margenrechner]').click();
  await page.locator('.pocket-calculator > summary').click();
  await page.locator('[data-field=m_cost]').click();
  for(const key of ['clear','1','2','.','5'])await page.locator('[data-key="'+key+'"]').click();
  assert.equal(await page.locator('#m_cost').inputValue(),'12.5');
  await page.locator('[data-key=calculate]').click();
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


for (const width of [1440, 768, 390, 320]) {
  test('Design v2 Startseite bleibt responsiv und die Produktnavigation funktioniert ('+width+'px)',async t=>{
    const page=await session(t,{width,height:900});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base+'/');
    assert.equal(response.status(),200);
    await page.locator('.ref-hero').waitFor({state:'visible'});
    assert.match((await page.locator('#home-title').innerText()).replace(/\s+/g,' '),/Dein Laden\. Klar organisiert\./);
    assert.equal(await page.locator('.ref-module-card').count(),6);
    assert.equal(await page.locator('.ref-module-soon').count(),2);
    assert.equal(await page.locator('.ref-module-card[href="/pep"]').count(),1);
    const styles=await page.evaluate(()=>({
      hero:getComputedStyle(document.querySelector('.ref-hero')).display,
      grid:getComputedStyle(document.querySelector('.ref-modules-grid')).gridTemplateColumns,
      wine:getComputedStyle(document.body).getPropertyValue('--wine').trim(),
      overflow:document.documentElement.scrollWidth-innerWidth,
      photo:getComputedStyle(document.querySelector('.ref-hero-photo')).backgroundImage,
    }));
    assert.equal(styles.hero,'block');
    assert.equal(styles.wine,'#7c101c');
    assert.match(styles.photo,/images\.pexels\.com/);
    assert.ok(styles.overflow<=2,'Homepage horizontal overflow '+styles.overflow);
    assert.deepEqual(errors,[]);
    const cols=styles.grid.split(' ').length;
    if(width>=1280)assert.equal(cols,6);
    if(width>=651&&width<=1200)assert.equal(cols,3);
    if(width<=390)assert.equal(cols,1);
    const link=page.locator('.ref-module-card[href="/pep"]');
    await link.click();
    assert.match(page.url(),/\/pep$/);
  });
}

for (const width of [1440, 390, 320]) {
  test('Design v2 Cockpit: neue Navigation behält alle Funktionen ('+width+'px)',async t=>{
    const page=await session(t,{width,height:960});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base+'/mein-laden');
    assert.equal(response.status(),200);
    assert.equal(await page.locator('.workspace-breadcrumb').count(),1);
    assert.equal(await page.locator('.ref-kpi-card').count(),6);
    assert.equal(await page.locator('.ref-panel').count(),6);
    assert.equal(await page.locator('.ref-pep-preview tbody tr').count(),3);
    assert.equal(await page.locator('#refKpiCloud').innerText(),'Beta');
    assert.equal(await page.locator('#refKpiSales').innerText(),'–');
    assert.equal(await page.locator('#refKpiStock').innerText(),'–');
    assert.equal(await page.locator('#refKpiApplicants').innerText(),'–');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,'Cockpit horizontal overflow '+overflow);
    if(width<=900)await page.locator('#refMobileMenu').click();
    await page.locator('[data-cockpit-tab="profile"]').click();
    assert.equal(await page.locator('[data-cockpit-panel="profile"]').isVisible(),true);
    assert.equal(await page.locator('[data-cockpit-panel="overview"]').isVisible(),false);
    if(width<=900)await page.locator('#refMobileMenu').click();
    await page.locator('[data-cockpit-tab="targets"]').click();
    assert.equal(await page.locator('[data-cockpit-panel="targets"]').isVisible(),true);
    if(width<=900)await page.locator('#refMobileMenu').click();
    await page.locator('[data-cockpit-tab="overview"]').click();
    assert.equal(await page.locator('[data-cockpit-panel="overview"]').isVisible(),true);
    assert.deepEqual(errors,[]);
  });
}


for (const width of [1440, 768, 390, 320]) {
  test('PEP v2: Teamfilter und Wochenplan bleiben bedienbar ('+width+'px)',async t=>{
    const page=await session(t,{width,height:900});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(base+'/pep');
    assert.equal(response.status(),200);
    assert.equal(await page.locator('.pep-daycheck>div').count(),7);
    assert.equal(await page.locator('#pepEmployeeFilter option').count(),(await page.locator('#pepBody tr').count())+1);
    const all=await page.locator('#pepBody tr').count();
    assert.ok(all>=1,'At least one employee should be displayed');
    if(all>=2){
      const id=await page.locator('#pepEmployeeFilter option').nth(1).getAttribute('value');
      await page.locator('#pepEmployeeFilter').selectOption(id);
      assert.equal(await page.locator('#pepBody tr:visible').count(),1);
      assert.equal(await page.locator('#pepBody tr:visible').first().getAttribute('data-employee-id'),id);
      await page.locator('#nextWeek').click();
      assert.equal(await page.locator('#pepBody tr:visible').count(),1);
      await page.locator('#pepEmployeeFilter').selectOption('all');
      assert.equal(await page.locator('#pepBody tr:visible').count(),all);
    }
    await page.locator('#addShift').click();
    assert.equal(await page.locator('#shiftDialog').evaluate(el=>el.open),true);
    await page.locator('#shiftDialog button[value=cancel]').first().click();
    assert.equal(await page.locator('#shiftDialog').evaluate(el=>el.open),false);
    const layout=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      table:document.querySelector('.pep-table-wrap').scrollWidth,
      viewport:document.querySelector('.pep-table-wrap').clientWidth,
    }));
    assert.ok(layout.overflow<=2,'Unexpected PEP full-page horizontal overflow: '+layout.overflow);
    if(width<=390)assert.ok(layout.table>layout.viewport,'Weekly grid must scroll inside its own container on phones');
    assert.deepEqual(errors,[]);
  });
}

for(const width of [1440,390,320]){
  test('Urlaubsplaner v2: Schnellzugriff, Anträge und Resturlaub ('+width+'px)',async t=>{
    const page=await session(t,{width,height:950});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(base+'/tools/urlaubsplaner');
    assert.equal(response.status(),200);
    assert.equal(await page.locator('.vac-app-nav button').count(),4);
    await page.locator('[data-vac-view=team]').click();
    assert.equal(await page.locator('[data-vac-panel=team]').first().isVisible(),true);
    assert.equal(await page.locator('[data-vac-panel=calendar]').first().isVisible(),false);
    await page.locator('#vacEmployeeName').fill('Design Test');
    await page.locator('#vacAllowance').fill('30');
    await page.locator('#vacEmployeeForm button[type=submit]').click();
    assert.match(await page.locator('#vacEmployees').innerText(),/Design Test/);
    await page.locator('[data-vac-view=entry]').click();
    assert.equal(await page.locator('[data-vac-panel=entry]').isVisible(),true);
    await page.locator('#vacPerson').selectOption({label:'Design Test'});
    await page.locator('#vacFrom').fill('2026-11-02');
    await page.locator('#vacTo').fill('2026-11-06');
    await page.locator('#vacStatus').selectOption('approved');
    assert.match(await page.locator('#vacPreview').innerText(),/5/);
    await page.locator('#vacSaveEntry').click();
    await page.locator('[data-vac-view=calendar]').click();
    assert.equal(await page.locator('[data-vac-panel=calendar]').first().isVisible(),true);
    assert.match(await page.locator('#vacEntries').innerText(),/Design Test/);
    await page.reload();
    assert.match(await page.locator('#vacEntries').innerText(),/Design Test/);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,'Unexpected vacation full-page horizontal overflow: '+overflow);
    assert.deepEqual(errors,[]);
  });
}


for(const width of [1440,768,390,320]){
  test('Personalfluss v2 – Profile, Filter und lokale Teamansicht ('+width+'px)',async t=>{
    const page=await session(t,{width,height:920});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(base+'/mitarbeiter');
    assert.equal(response.status(),200);
    assert.equal(await page.locator('#activeEmployees').innerText(),'3');
    assert.equal(await page.locator('.staff-card').count(),3);
    await page.locator('#staffSearch').fill('Ben');
    assert.equal(await page.locator('.staff-card').count(),1);
    assert.match(await page.locator('.staff-card').innerText(),/Ben Weber/);
    await page.locator('#staffSearch').fill('');
    await page.locator('#staffSearch').fill('Aushilfe');
    assert.equal(await page.locator('.staff-card').count(),1);
    await page.locator('#staffSearch').fill('');
    await page.locator('[data-profile-id="e1"]').click();
    assert.equal(await page.locator('#staffProfileTitle').innerText(),'Anna Müller');
    await page.locator('.staff-planning-details summary').click();
    assert.match(await page.locator('#staffProfileContent').innerText(),/Schichten & Anwesenheit/);
    assert.match(await page.locator('#staffProfileContent').innerText(),/Geplante Stunden/);
    assert.equal(await page.locator('#staffProfile').isVisible(),true);
    await page.locator('#editStaffProfile').click();
    await page.locator('#employeeName').fill('Anna Neu');
    await page.locator('#employeeHours').fill('32.5');
    await page.locator('#employeeForm button[type=submit]').click();
    assert.equal(await page.locator('#staffProfileTitle').innerText(),'Anna Neu');
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ladenfluss.team.v1')));
    assert.equal(stored.find(p=>p.id==='e1').name,'Anna Neu');
    assert.equal(stored.find(p=>p.id==='e1').hours,32.5);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,'Personalfluss horizontal overflow '+overflow);
    assert.equal(await page.locator('#staffRecruiting input, #staffRecruiting textarea, #staffRecruiting form').count(),0);
    assert.deepEqual(errors,[]);
    await page.goto(base+'/pep');
    assert.match(await page.locator('#pepBody').innerText(),/Anna Neu/);
  });
}

test('Personalfluss v2 – genehmigte Urlaubszeiträume sind im selben Teamprofil sichtbar',async t=>{
  const page=await session(t,{width:390,height:900});
  await page.goto(base+'/tools/urlaubsplaner');
  await page.locator('[data-vac-view=team]').click();
  await page.locator('#vacImportPep').click();
  await page.locator('[data-vac-view=entry]').click();
  await page.locator('#vacPerson').selectOption('e1');
  await page.locator('#vacFrom').fill('2026-11-02');
  await page.locator('#vacTo').fill('2026-11-06');
  await page.locator('#vacStatus').selectOption('approved');
  await page.locator('#vacSaveEntry').click();
  await page.goto(base+'/mitarbeiter');
  await page.locator('[data-profile-id=e1]').click();
  await page.locator('.staff-planning-details summary').click();
  const labels=await page.locator('.staff-profile-metrics').innerText();
  assert.match(labels,/Bestätigte Urlaubszeiträume\s*1/);
  assert.equal(await page.locator('#staffProfile').isVisible(),true);
});


test('Referenz-Cockpit zeigt echte PEP-, Urlaubs- und Teamdaten statt fiktiver Geschäftszahlen',async t=>{
  const page=await session(t,{width:1440,height:920});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/mein-laden');
  assert.equal(await page.locator('#refKpiTeam').innerText(),'2 / 3');
  assert.equal(await page.locator('#refKpiSales').innerText(),'–');
  assert.equal(await page.locator('#refKpiStock').innerText(),'–');
  assert.equal(await page.locator('#refKpiApplicants').innerText(),'–');
  assert.equal(await page.locator('#refKpiCloud').innerText(),'Beta');
  assert.match(await page.locator('#refPepBody').innerText(),/Anna Müller/);
  assert.equal(await page.locator('.ref-hour-col').count(),7);
  await page.locator('#refDashboardQuery').fill('Urlaub');
  assert.ok(await page.locator('#refDashboardResults a').count()>=1);
  assert.equal(await page.locator('#refDashboardResults').isVisible(),true);
  await page.locator('#refDashboardQuery').fill('');
  assert.equal(await page.locator('#refDashboardResults').isVisible(),false);
  await page.evaluate(()=>{
    const profile=window.LadenflussStoreSettings.read();
    window.LadenflussStoreSettings.save({...profile,name:'Blütenzauber'});
  });
  await page.reload();
  assert.equal(await page.locator('#refSidebarShop').innerText(),'Blütenzauber');
  assert.equal(await page.locator('#refTopShop').innerText(),'Blütenzauber');
  await page.goto(base+'/tools/urlaubsplaner');
  await page.locator('[data-vac-view=team]').click();
  await page.locator('#vacImportPep').click();
  await page.locator('[data-vac-view=entry]').click();
  await page.locator('#vacPerson').selectOption('e1');
  await page.locator('#vacFrom').fill('2026-10-12');
  await page.locator('#vacTo').fill('2026-10-13');
  await page.locator('#vacStatus').selectOption('approved');
  await page.locator('#vacSaveEntry').click();
  await page.goto(base+'/mein-laden');
  assert.equal(await page.locator('#refKpiVacation').innerText(),'1');
  assert.equal(await page.locator('.ref-vacation-item').count(),1);
  assert.match(await page.locator('#refVacationList').innerText(),/Anna Müller/);
  assert.match(await page.locator('#refVacationList').innerText(),/Bestätigt/);
  assert.deepEqual(errors,[]);
});

test('Referenz-Cockpit Suche öffnet echte Module und mobile Menü-Tabs bleiben nutzbar',async t=>{
  const page=await session(t,{width:390,height:820});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/mein-laden');
  assert.equal(await page.locator('#refMobileMenu').isVisible(),true);
  await page.locator('#refMobileMenu').click();
  assert.equal(await page.locator('.workspace-nav').isVisible(),true);
  await page.locator('[data-cockpit-tab=profile]').click();
  assert.equal(await page.locator('[data-cockpit-panel=profile]').isVisible(),true);
  assert.equal(await page.locator('.workspace-nav').isVisible(),false);
  await page.locator('#refDashboardQuery').fill('Personalfluss');
  await page.locator('#refDashboardResults a[href="/mitarbeiter"]').click();
  assert.match(page.url(),/\/mitarbeiter$/);
  assert.deepEqual(errors,[]);
});


for(const width of [1440,768,390,320]){
  test('Einheitliches Ladenfluss-Design: Rechner, Fachtools und Navigation ('+width+'px)',async t=>{
    const page=await session(t,{width,height:960});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const routes=['/tools','/tools/rabattrechner','/tools/margenrechner','/tools/kpi-dashboard','/rechner','/produkte','/ueber-uns'];
    for(const route of routes){
      const resp=await page.goto(base+route);
      assert.equal(resp.status(),200,route);
      const style=await page.evaluate(()=>({
        wine:getComputedStyle(document.documentElement).getPropertyValue('--lf-brand').trim(),
        overflow:document.documentElement.scrollWidth-innerWidth,
        body:getComputedStyle(document.body).backgroundColor,
        header:document.querySelector('.site-header, .calc-topbar')?.tagName||'',
      }));
      assert.equal(style.wine,'#7c101c',route+': palette');
      assert.ok(style.overflow<=2,route+': horizontal overflow '+style.overflow);
      assert.equal(style.header,'HEADER',route+': persistent branded navigation');
      if(route.startsWith('/tools/')&&route!=='/tools/urlaubsplaner'){
        assert.equal(await page.locator('link[href="/assets/reference-calculator.css"]').count(),1,route);
        assert.match(await page.locator('.tool-page .calculator').evaluate(el=>getComputedStyle(el).backgroundColor),/rgb\(255, 253, 250\)/,route);
      }
    }
    await page.goto(base+'/tools');
    assert.equal(await page.locator('.ref-tool-choice').count(),8);
    const href=await page.locator('.ref-tool-choice').first().getAttribute('href');
    assert.equal(href,'/tools/personalbedarf');
    await page.locator('.ref-tool-choice[href="/tools/margenrechner"]').click();
    assert.match(page.url(),/\/tools\/margenrechner$/);
    assert.deepEqual(errors,[]);
  });
}

test('Rechner-Vorlage behält korrekte Euro-Ergebnisse für Marge, Rabatt und Break-even',async t=>{
  const page=await session(t,{width:390,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/tools/margenrechner');
  await page.locator('#m_cost').fill('10');
  await page.locator('#m_margin').fill('50');
  await page.locator('#m_vat').fill('19');
  await page.evaluate(()=>window.calcMargin(false));
  assert.match(await page.locator('#m_result').innerText(),/23,80/);
  assert.equal(await page.locator('#m_result').isVisible(),true);
  await page.goto(base+'/tools/rabattrechner');
  await page.locator('#d_price').fill('100');
  await page.locator('#d_discount').fill('20');
  await page.evaluate(()=>window.calcDiscount(false));
  assert.match(await page.locator('#d_result').innerText(),/80,00/);
  await page.goto(base+'/tools/break-even');
  await page.locator('#b_fixed').fill('12000');
  await page.locator('#b_rate').fill('40');
  await page.locator('#b_days').fill('24');
  await page.locator('.advanced-options summary').click();
  await page.locator('#b_profit').fill('0');
  await page.locator('#b_buffer').fill('0');
  await page.evaluate(()=>window.calcBreakEven(false));
  assert.match(await page.locator('#b_result').innerText(),/30.000/);
  assert.match(await page.locator('#b_result').innerText(),/1.250/);
  assert.deepEqual(errors,[]);
});

test('Kombi-Rechner: alle acht Kategorien zugänglich, aktive Auswahl hervorgehoben',async t=>{
 const page=await session(t,{width:390,height:880});
 await page.goto(base+'/rechner');
 assert.equal(await page.locator('[data-ref-calc-mode]').count(),8);
 assert.equal(await page.locator('[data-ref-calc-mode][aria-current=true]').count(),1);
 await page.locator('[data-ref-calc-mode="rabattrechner"]').click();
 await page.waitForFunction(()=>document.getElementById('modeTitle')?.textContent==='Rabattwirkung');
 assert.equal(await page.locator('[data-ref-calc-mode="rabattrechner"]').getAttribute('aria-current'),'true');
 await page.locator('[data-ref-calc-mode="margenrechner"]').click();
 await page.waitForFunction(()=>document.getElementById('modeTitle')?.textContent==='Verkaufspreis');
 assert.equal(await page.locator('[data-ref-calc-mode="margenrechner"]').getAttribute('aria-current'),'true');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=2,'Kombi-Rechner: unexpected horizontal overflow '+overflow);
});

test('Neue Kopfzeile: auf dem iPhone Tools und Mein Laden erreichbar',async t=>{
 const page=await session(t,{width:375,height:820});
 await page.goto(base+'/tools/rabattrechner');
 const button=page.locator('.site-header .menu-toggle');
 assert.equal(await button.isVisible(),true);
 await button.click();
 assert.equal(await page.locator('#mobile-nav').isVisible(),true);
 await page.locator('#mobile-nav a[href="/mein-laden"]').click();
 assert.match(page.url(),/\/mein-laden$/);
});



for(const width of [1440,768,390,320]){
  test('Personalfluss einfach: Profil und Brutto-Lohn ohne Schlüssel ('+width+'px)',async t=>{
    const page=await session(t,{width,height:960});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base+'/mitarbeiter');
    assert.equal(response.status(),200);
    assert.equal(await page.locator('.staff-position-card').count(),0);
    assert.equal(await page.locator('#staffAddPosition').count(),0);
    assert.equal(await page.locator('#staffVaultPass').count(),0);
    await page.locator('[data-profile-id=e1]').click();
    assert.match(await page.locator('#staffHourlyDisplay').innerText(),/Nicht hinterlegt/);
    await page.locator('#editStaffProfile').click();
    await page.locator('#employeeHourlyGross').fill('19.66');
    await page.locator('#employeeName').fill('Anna Einfach');
    await page.locator('#saveEmployee').click();
    await page.waitForFunction(()=>document.getElementById('staffHourlyDisplay')?.textContent.includes('19,66'));
    assert.match(await page.locator('#staffMonthlyDisplay').innerText(),/2.555,80/);
    const saved=await page.evaluate(()=>({
      team:JSON.parse(localStorage.getItem('ladenfluss.team.v1')),
      wages:JSON.parse(localStorage.getItem('ladenfluss.hr-wages-simple.v1'))
    }));
    assert.equal(saved.team.find(p=>p.id==='e1').name,'Anna Einfach');
    assert.equal(saved.team.find(p=>p.id==='e1').hourlyGross,undefined,
      'Wages must not appear in the shared team data');
    assert.equal(saved.wages.rates.e1,19.66);
    assert.equal(await page.locator('#teamGrossOverview').innerText(),'–',
      'Do not show partial team gross as a complete sum');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,'Personalfluss horizontal overflow '+width+'px: '+overflow);
    assert.deepEqual(errors,[]);
    await page.goto(base+'/pep');
    assert.match(await page.locator('#pepBody').innerText(),/Anna Einfach/);
  });
}

test('Personalfluss: verschiedene Stundenlöhne, klare Monatsbrutto-Summe und direkte Bearbeitung',async t=>{
  const page=await session(t,{width:390,height:930});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/mitarbeiter');
  for(const [id,rate] of [['e1','19.66'],['e2','21.25'],['e3','20']]){
    await page.locator('[data-profile-id='+id+']').click();
    await page.locator('#editStaffProfile').click();
    await page.locator('#employeeHourlyGross').fill(rate);
    await page.locator('#saveEmployee').click();
  }
  assert.match(await page.locator('#teamGrossOverview').innerText(),/7.512,05/);
  await page.locator('#closeStaffProfile').click();
  await page.locator('[data-profile-id=e1]').click();
  assert.match(await page.locator('#staffMonthlyDisplay').innerText(),/2.555,80/);
  await page.locator('#editStaffProfile').click();
  await page.locator('#employeeHours').fill('35');
  await page.locator('#saveEmployee').click();
  assert.match(await page.locator('#staffMonthlyDisplay').innerText(),/2.981,77/);
  assert.match(await page.locator('#staffHourlyDisplay').innerText(),/19,66/);
  await page.reload();
  await page.locator('[data-profile-id=e2]').click();
  assert.match(await page.locator('#staffHourlyDisplay').innerText(),/21,25/);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ladenfluss.team.v1')));
  assert.equal(stored.find(p=>p.id==='e1').hours,35);
  assert.ok(stored.every(p=>!Object.hasOwn(p,'hourlyGross')));
  assert.deepEqual(errors,[]);
});

test('Personalfluss: alte verschlüsselte Löhne bleiben erhalten und sind einmalig übernehmbar',async t=>{
  const page=await session(t,{width:390,height:920});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/mitarbeiter');
  const phrase='Eine bestehende sehr lange private Passphrase';
  await page.evaluate(async phrase=>{
    const api=window.LadenflussPayVault;
    await api.initialize(phrase);
    await api.set('e1',19.66);
    api.lock();
  },phrase);
  const oldVault=await page.evaluate(()=>localStorage.getItem('ladenfluss.hr-pay-vault.v1'));
  await page.reload();
  await page.locator('[data-profile-id=e1]').click();
  assert.equal(await page.locator('#legacyWageTransfer').isVisible(),true);
  await page.locator('#legacyWageTransfer summary').click();
  await page.locator('#legacyWagePassword').fill(phrase);
  await page.locator('#legacyWageForm button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('staffHourlyDisplay')?.textContent.includes('19,66'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('ladenfluss.hr-pay-vault.v1')),oldVault);
  assert.equal(await page.evaluate(()=>window.LadenflussPayVault.isUnlocked()),false);
  assert.deepEqual(errors,[]);
});
