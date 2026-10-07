'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const KEY = 'ladenfluss.urlaubsplaner.v1';
async function load(file, initial = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(fs.readFileSync(path.join(root,file),'utf8'), {
    url:'https://ladenfluss.test/'+file, runScripts:'outside-only', virtualConsole:vc,
  });
  const w = dom.window;
  await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve, {once:true}));
  const RealDate = w.Date;
  w.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-10-06T12:00:00+02:00'])); }
    static now() { return new RealDate('2026-10-06T12:00:00+02:00').getTime(); }
  };
  w.confirm = () => true;
  w.prompt = () => null;
  w.Element.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  w.HTMLDialogElement.prototype.close = function() { this.open = false; };
  for (const [key,value] of Object.entries(initial)) w.localStorage.setItem(key,value);
  for (const script of w.document.querySelectorAll('script[src]')) {
    const src = path.join(root,script.getAttribute('src'));
    w.eval(fs.readFileSync(src,'utf8'));
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {
    w, errors, close:() => w.close(),
    $:id => w.document.getElementById(id),
    submit:id => w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),
    change:(id,value) => { const e=w.document.getElementById(id);e.value=value;e.dispatchEvent(new w.Event('change',{bubbles:true})); },
    saved:() => JSON.parse(w.localStorage.getItem(KEY)),
    storage:() => Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])),
  };
}

test('Alle HTML-Seiten initialisieren ihre echten Skripte fehlerfrei', async () => {
  const files = fs.readdirSync(root).filter(f=>f.endsWith('.html'))
    .concat(['tools','produkte'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.html')).map(f=>dir+'/'+f)));
  for (const file of files) {
    const p=await load(file);
    try { assert.deepEqual(p.errors,[],file); } finally { p.close(); }
  }
});

test('Urlaubsplanung: Teamimport, Samstag, Speichern, Neustart, PEP und Löschen', async () => {
  let p=await load('tools/urlaubsplaner.html');
  p.$('vacImportPep').click();
  p.change('vacWorkweek','6');
  p.$('vacPerson').value='e1';
  p.$('vacFrom').value='2026-10-05';p.$('vacTo').value='2026-10-10';
  p.$('vacStatus').value='approved';
  p.submit('vacEntryForm');
  assert.equal(p.saved().employees.length,3);
  assert.equal(p.saved().entries.length,1);
  assert.match(p.$('vacBalances').textContent,/24 frei \/ 30/);
  let saved=p.storage();p.close();
  p=await load('pep.html',saved);
  assert.ok(p.w.document.querySelectorAll('.has-conflict').length>0);
  assert.match(p.$('pepBody').textContent,/Urlaub/);
  assert.deepEqual(p.errors,[]);p.close();
  p=await load('tools/urlaubsplaner.html',saved);
  assert.match(p.$('vacEntries').textContent,/6 Arbeitstage/);
  p.$('vacEntries').querySelector('button').click();
  p.$('vacTo').value='2026-10-09';p.submit('vacEntryForm');
  assert.match(p.$('vacBalances').textContent,/25 frei \/ 30/);
  p.$('vacEntries').querySelectorAll('button')[1].click();
  assert.equal(p.saved().entries.length,0);
  assert.deepEqual(p.errors,[]);p.close();
});

test('Speicherfehler rollt Mitarbeiteranlage und Einstellungen vollständig zurück', async () => {
  const p=await load('tools/urlaubsplaner.html');
  const proto=p.w.Storage.prototype, original=proto.setItem;
  proto.setItem=function(key,value) { if(key===KEY) throw new Error('Speicher voll'); original.call(this,key,value); };
  p.$('vacEmployeeName').value='Verworfen';p.submit('vacEmployeeForm');
  assert.equal(p.$('vacTeamCount').textContent,'0');
  assert.match(p.$('vacError').textContent,/nicht gespeichert/);
  p.change('vacWorkweek','6');
  assert.equal(p.$('vacWorkweek').value,'5');
  proto.setItem=original;
  p.$('vacEmployeeName').value='Anna';p.submit('vacEmployeeForm');
  assert.deepEqual(p.saved().employees.map(e=>e.name),['Anna']);
  assert.deepEqual(p.errors,[]);p.close();
});

test('Beschädigte Daten werden vor dem Rendern erkannt und nicht überschrieben', async () => {
  const raw=JSON.stringify({version:1,employees:[],entries:[],settings:{}});
  const p=await load('tools/urlaubsplaner.html',{[KEY]:raw});
  assert.match(p.$('vacError').textContent,/Bearbeitung gesperrt/);
  assert.equal(p.w.document.querySelectorAll('.vac-app button:enabled').length,0);
  assert.equal(p.w.localStorage.getItem(KEY),raw);
  assert.deepEqual(p.errors,[]);p.close();
});

test('Mitarbeiterdialog bricht ohne Anlage ab und rendert Namen nur als Text', async () => {
  let p=await load('mitarbeiter.html');
  p.$('employeeName').value='Nicht anlegen';
  p.$('employeeDialog').querySelector('button[value=cancel]').click();
  assert.equal(JSON.parse(p.w.localStorage.getItem('ladenfluss.team.v1')).length,3);
  p.$('employeeName').value='<b>Alex & Team</b>';p.submit('employeeForm');
  assert.equal(p.$('staffList').querySelectorAll('b').length,0);
  assert.match(p.$('staffList').textContent,/<b>Alex & Team<\/b>/);
  const saved=p.storage();assert.deepEqual(p.errors,[]);p.close();
  p=await load('pep.html',saved);
  assert.equal(p.$('pepBody').querySelectorAll('b').length,0);
  assert.match(p.$('pepBody').textContent,/<b>Alex & Team<\/b>/);
  assert.deepEqual(p.errors,[]);p.close();
});

test('Dashboard berücksichtigt bestätigten Urlaub und schützt Verlaufsdarstellung', async () => {
  const data={version:1,settings:{state:'HE',workdays:[1,2,3,4,5],maxAbsent:1},
    employees:[{id:'e1',name:'Anna',allowance:30}],
    entries:[{id:'v1',employeeId:'e1',start:'2026-10-05',end:'2026-10-09',status:'approved'}]};
  const p=await load('mein-laden.html',{
    [KEY]:JSON.stringify(data),
    'ladenfluss.history.v1':JSON.stringify([{tool:'<b>Test</b>',summary:'<b>Ergebnis</b>',at:'2026-10-06T10:00:00Z'}]),
  });
  assert.ok(p.w.LadenflussPepSignals.current().some(s=>s.title==='Planungskonflikt'&&s.message.includes('Urlaub')));
  assert.equal(p.$('recentCalculations').querySelectorAll('b b, strong b').length,0);
  assert.match(p.$('recentCalculations').textContent,/<b>Test<\/b>/);
  assert.equal(typeof p.w.history.back,'function');
  assert.deepEqual(p.errors,[]);p.close();
});

for(const [file,prefix,calculate,invalidField] of [
  ['personalbedarf','p','calcPersonnel','p_productivity'],
  ['margenrechner','m','calcMargin','m_cost'],
  ['rabattrechner','d','calcDiscount','d_price'],
  ['break-even','b','calcBreakEven','b_fixed'],
  ['kpi-dashboard','k','calcKpi','k_revenue'],
  ['personalkosten-budget','lb','calcLaborBudget','lb_revenue'],
  ['rohertrag-wareneinsatz','gp','calcGrossProfit','gp_revenue'],
  ['lagerumschlag','st','calcStockTurn','st_stock'],
]) {
  test('Rechner verbirgt alte Ergebnisse bei negativen und leeren Eingaben: '+file, async()=>{
    const p=await load('tools/'+file+'.html');
    assert.equal(p.$(prefix+'_result').hidden,false);
    assert.doesNotMatch(p.$(prefix+'_result').textContent,/NaN|Infinity|undefined/);
    const original=p.$(invalidField).value;
    p.$(invalidField).value='-1';p.w[calculate]();
    assert.ok(p.$(prefix+'_error').textContent.trim().length>0);
    assert.equal(p.$(prefix+'_result').hidden,true);
    assert.equal(p.$(prefix+'_result').nextElementSibling.hidden,true);
    p.$(invalidField).value='';p.w[calculate]();
    assert.equal(p.$(prefix+'_result').hidden,true);
    p.$(invalidField).value=original;p.w[calculate]();
    assert.equal(p.$(prefix+'_error').textContent,'');
    assert.equal(p.$(prefix+'_result').hidden,false);
    assert.equal(p.$(prefix+'_result').nextElementSibling.hidden,false);
    assert.deepEqual(p.errors,[]);p.close();
  });
}

test('Ladenprofil wirkt auf Dienstplan und Rechner; ungültige Änderung bleibt ungespeichert', async()=>{
  let p=await load('mein-laden.html');
  p.$('store_name').value='Alex Laden';p.$('store_open').value='10:00';p.$('store_close').value='16:00';
  p.$('store_days').value='5';p.$('store_min_staff').value='3';p.$('store_state').value='BE';
  p.submit('storeProfile');
  const raw=p.w.localStorage.getItem('ladenfluss.store.v1');
  assert.equal(JSON.parse(raw).hours,6);
  assert.equal(p.$('storeGreeting').textContent,'Alex Laden');
  p.$('store_close').value='09:00';p.submit('storeProfile');
  assert.match(p.$('profileState').textContent,/Nicht gespeichert/);
  assert.equal(p.w.localStorage.getItem('ladenfluss.store.v1'),raw);
  p.$('target_labor').value='';p.submit('storeTargets');
  assert.match(p.$('targetState').textContent,/Nicht gespeichert/);
  assert.equal(p.w.localStorage.getItem('ladenfluss.store.v1'),raw);
  const saved=p.storage();p.close();
  p=await load('pep.html',saved);
  assert.equal(p.$('dayCheck').querySelectorAll('.holiday-check').length,2);
  assert.match(p.$('dayCheck').textContent,/Besetzung fehlen/);
  assert.deepEqual(p.errors,[]);p.close();
  p=await load('tools/personalbedarf.html',saved);
  assert.equal(p.$('p_open').value,'6');
  assert.deepEqual(p.errors,[]);p.close();
});

test('Cockpit priorisiert Besetzung, erklärt Hinweise und filtert Kategorien', async()=>{
  const p=await load('mein-laden.html',{
    'ladenfluss.store.v1':JSON.stringify({name:'Alex Laden'}),
    'ladenfluss.history.v1':JSON.stringify([{tool:'Lagerumschlag',summary:'1 Tag',at:'2026-10-06T10:00:00Z',data:{coverageGap:-4,cogs:100}}]),
  });
  assert.ok(p.$('decisionCard').classList.contains('critical'));
  assert.match(p.$('decisionCard').querySelector('a').getAttribute('href'),/^\/pep\?week=/);
  assert.ok(p.$('storeSignals').querySelector('details li'));
  p.change('signalFilter','important');
  assert.equal(p.$('storeSignals').querySelectorAll('.signal-card').length,1);
  assert.match(p.$('storeSignals').textContent,/Manuell eingegebene Kalkulation/);
  assert.equal(p.$('storeSignals').querySelector('a').getAttribute('href'),'/tools/lagerumschlag');
  assert.deepEqual(p.errors,[]);p.close();
});

test('Nullverbrauch erzeugt keine erfundene Reichweite und keinen Nachbestellalarm', async()=>{
  let p=await load('tools/lagerumschlag.html');
  p.$('st_cogs').value='0';p.w.calcStockTurn();
  assert.match(p.$('st_result').textContent,/Ohne Verbrauch nicht bestimmbar/);
  const entry=JSON.parse(p.w.localStorage.getItem('ladenfluss.history.v1'))[0];
  assert.equal(entry.data.coverage,null);assert.equal(entry.data.coverageGap,null);
  const saved=p.storage();p.close();
  p=await load('mein-laden.html',saved);
  assert.equal(p.w.LadenflussBusinessSignals.fromHistory([entry]).length,0);
  assert.deepEqual(p.errors,[]);p.close();
});

test('Beschädigtes Profil bleibt erhalten und verhindert irreführende Planung', async()=>{
  const raw='null';
  let p=await load('mein-laden.html',{'ladenfluss.store.v1':raw});
  assert.equal(p.$('cockpitError').hidden,false);
  p.submit('storeProfile');
  assert.match(p.$('profileState').textContent,/Nicht gespeichert/);
  assert.equal(p.w.localStorage.getItem('ladenfluss.store.v1'),raw);
  const saved=p.storage();p.close();
  p=await load('pep.html',saved);
  assert.match(p.$('pepFocus').textContent,/Profil prüfen/);
  assert.deepEqual(p.errors,[]);p.close();
  p=await load('tools/lagerumschlag.html',saved);
  assert.deepEqual(p.errors,[]);p.close();
});

test('PEP: Abbrechen aller Dialoge verändert keine gespeicherten Daten', async()=>{
  const p=await load('pep.html');const before=p.storage();
  for(const button of p.w.document.querySelectorAll('dialog button[value=cancel]')){
    assert.equal(button.type,'button');button.click();
  }
  assert.deepEqual(p.storage(),before);assert.deepEqual(p.errors,[]);p.close();
});

test('Personalbedarf übergibt einen datierten Richtwert und PEP vergleicht verfügbare Stunden', async()=>{
  let p=await load('tools/personalbedarf.html');
  for(const [id,value] of Object.entries({p_date:'2026-10-06',p_revenue:'1000',p_productivity:'100',p_open:'8',p_min:'1',p_extra:'0',p_break:'0',p_buffer:'0'}))p.$(id).value=value;
  p.w.calcPersonnel();
  const link=p.w.document.querySelector('.planning-transfer');
  assert.equal(link.getAttribute('href'),'/pep?week=2026-10-05&day=2026-10-06');
  link.dispatchEvent(new p.w.MouseEvent('click',{bubbles:true,cancelable:true}));
  const saved=p.storage();
  assert.equal(JSON.parse(saved['ladenfluss.history.v1'])[0].data.total,10);
  p.$('p_revenue').dispatchEvent(new p.w.Event('input',{bubbles:true}));
  assert.equal(p.$('p_result').hidden,true);p.close();
  saved['ladenfluss.team.v1']=JSON.stringify([{id:'e1',name:'Anna',role:'Verkauf',hours:8}]);
  saved['ladenfluss.pep.weeks.v2']=JSON.stringify({'2026-10-05':{e1:[null,['09:00','17:00',0],null,null,null,null,null]}});
  p=await load('pep.html',saved);
  assert.match(p.$('planningReference').textContent,/10 h Richtwert · 8 h verfügbar geplant · 2 h unter/);
  assert.deepEqual(p.errors,[]);p.close();
  saved['ladenfluss.pep.absences.v1']=JSON.stringify({'2026-10-05':{e1:[null,'Krank',null,null,null,null,null]}});
  p=await load('pep.html',saved);
  assert.match(p.$('planningReference').textContent,/0 h verfügbar geplant · 10 h unter/);
  assert.deepEqual(p.errors,[]);p.close();
});

test('Bedarfsübergabe stoppt bei Speicherfehler und überschreibt beschädigten Verlauf nicht', async()=>{
  const p=await load('tools/personalbedarf.html',{'ladenfluss.history.v1':'{kaputt'});
  const link=p.w.document.querySelector('.planning-transfer');
  const click=new p.w.MouseEvent('click',{cancelable:true});
  link.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);
  assert.match(p.$('p_error').textContent,/nicht gespeichert/);
  assert.equal(p.w.localStorage.getItem('ladenfluss.history.v1'),'{kaputt');
  p.close();
});

test('Gemeinsamer Rechner wechselt alle acht Formeln und behält Eingaben je Rechenart', async()=>{
  const p=await load('rechner.html');
  const modes=[['margenrechner','m'],['rabattrechner','d'],['break-even','b'],['kpi-dashboard','k'],['personalkosten-budget','lb'],['rohertrag-wareneinsatz','gp'],['lagerumschlag','st'],['personalbedarf','p']];
  for(const [mode,prefix] of modes){
    p.w.location.hash=mode;p.w.dispatchEvent(new p.w.Event('hashchange'));
    assert.equal(p.$(prefix+'_result').hidden,false,mode);
    assert.doesNotMatch(p.$('screenValue').textContent,/NaN|Infinity|undefined/);
  }
  p.w.location.hash='margenrechner';p.w.dispatchEvent(new p.w.Event('hashchange'));
  p.$('m_cost').focus();
  for(const key of ['clear','1','2','.','5'])p.w.document.querySelector('[data-key="'+key+'"]').click();
  assert.equal(p.$('m_cost').value,'12.5');
  p.w.document.querySelector('[data-key=calculate]').click();
  assert.equal(p.$('m_result').hidden,false);
  p.w.location.hash='rabattrechner';p.w.dispatchEvent(new p.w.Event('hashchange'));
  p.w.location.hash='margenrechner';p.w.dispatchEvent(new p.w.Event('hashchange'));
  assert.equal(p.$('m_cost').value,'12.5');
  assert.deepEqual(p.errors,[]);p.close();
});

test('Urlaubsansichten zeigen nur die benötigten Bereiche und öffnen Bearbeitung', async()=>{
  const p=await load('tools/urlaubsplaner.html');
  assert.equal(p.$('vacEntryForm').closest('section').hidden,true);
  p.w.document.querySelector('[data-vac-view=team]').click();
  assert.equal(p.$('vacCalendar').closest('section').hidden,true);
  assert.equal(p.$('vacEmployeeForm').closest('section').hidden,false);
  p.w.document.querySelector('[data-vac-view=entry]').click();
  assert.equal(p.$('vacEntryForm').closest('section').hidden,false);
  assert.deepEqual(p.errors,[]);p.close();
});
