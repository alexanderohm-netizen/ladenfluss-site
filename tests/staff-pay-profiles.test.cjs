'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function storage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>{values.set(key,String(value));},
    removeItem:key=>values.delete(key),
    snapshot:()=>Object.fromEntries(values)
  };
}
function script(name,store,crypto=webcrypto){
  const window={crypto};
  const context=vm.createContext({window,localStorage:store,
    TextEncoder,TextDecoder,Uint8Array,atob,btoa,console,Date,Math,JSON,Error,Number,Object});
  vm.runInContext(fs.readFileSync(path.join(root,'assets',name),'utf8'),context,{filename:name});
  return window;
}
test('Vergütungstresor: Einzelstundenlohn AES-GCM verschlüsselt, erst nach Passphrase lesbar',async()=>{
  const db=storage(),api=script('pay-vault.js',db).LadenflussPayVault;
  assert.equal(api.supported(),true);
  assert.equal(api.exists(),false);
  await api.initialize('ein wirklich langes gutes Kennwort');
  assert.equal(api.isUnlocked(),true);
  await api.set('e1',19.66);
  const raw=db.getItem(api.key);
  assert.ok(raw);
  assert.doesNotMatch(raw,/19\.66|e1|Anna/);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['ciphertext','iv','rounds','salt','version']);
  assert.equal(api.get('e1'),19.66);
  assert.equal(api.get('e2'),null);
  api.lock();
  assert.equal(api.isUnlocked(),false);
  assert.equal(api.get('e1'),null);
  await assert.rejects(api.unlock('eine falsch gewaehlte Passphrase'),/Passphrase falsch/);
  assert.equal(api.get('e1'),null);
  await api.unlock('ein wirklich langes gutes Kennwort');
  assert.equal(api.get('e1'),19.66);
  assert.equal(db.getItem(api.key),raw);
});
test('Vergütungstresor: alte Fassungen in anderen Tabs überschreiben keine neuen Beträge',async()=>{
  const db=storage();
  const a=script('pay-vault.js',db).LadenflussPayVault;
  await a.initialize('dies ist die private Tresor Passphrase');
  const b=script('pay-vault.js',db).LadenflussPayVault;
  await b.unlock('dies ist die private Tresor Passphrase');
  await a.set('e1',20.35);
  await assert.rejects(b.set('e2',25.0),/anderen Tab/);
  assert.equal(b.isUnlocked(),false);
  await b.unlock('dies ist die private Tresor Passphrase');
  assert.equal(b.get('e1'),20.35);
  await b.set('e2',25.0);
  assert.equal(b.get('e2'),25);
  assert.equal(db.getItem('ladenfluss.team.v1'),null);
});
test('Vergütungstresor: ungültige Beträge, Storagefehler und verlorene Passphrasen sind fail-closed',async()=>{
  const db=storage(),api=script('pay-vault.js',db).LadenflussPayVault;
  await assert.rejects(api.initialize('kurz'),/mindestens 12/);
  assert.equal(api.exists(),false);
  await api.initialize('sehr geheime Stundenlohn-Passphrase');
  await api.set('employee-9',23.45);
  const baseline=db.getItem(api.key);
  await assert.rejects(api.set('employee-9',-1),/Brutto-Stundenlohn/);
  await assert.rejects(api.set('employee-9',251),/Brutto-Stundenlohn/);
  await assert.rejects(api.set('employee-9',NaN),/Brutto-Stundenlohn/);
  assert.equal(db.getItem(api.key),baseline);
  assert.equal(api.exportEncrypted(),baseline);
  api.lock();
  await assert.rejects(api.set('employee-9',22),/entsperren/);
  await assert.rejects(api.initialize('noch eine andere lange Passphrase'),/bereits/);
  assert.equal(db.getItem(api.key),baseline);
});
test('Vergütungstresor: ohne WebCrypto keine unverschlüsselte Notlösung',async()=>{
  const db=storage(),api=script('pay-vault.js',db,{}).LadenflussPayVault;
  assert.equal(api.supported(),false);
  await assert.rejects(api.initialize('eine ausreichend lange Passphrase'),/sichere Verschlüsselung/);
  assert.deepEqual(db.snapshot(),{});
});
test('Stellenprofile: zehn Handelsvorlagen, Bearbeiten und neue Rolle, stabile IDs',()=>{
  const db=storage(),api=script('job-profiles.js',db).LadenflussJobProfiles;
  const original=api.read();
  assert.equal(original.length,10);
  assert.ok(api.byTitle('Filialleitung',original));
  const next=api.updateProfile(api.byTitle('Verkauf').id,{
    summary:'Kundenerlebnis und Warenfluss verantwortungsvoll begleiten.',
    tasks:['Kunden beraten','Waren ansprechend präsentieren'],
    requirements:['Freundlichkeit','Sorgfalt'],
    responsibility:'Verkauf und Team'
  });
  assert.equal(next.length,10);
  assert.equal(api.byTitle('Verkauf').title,'Verkauf');
  assert.match(api.byTitle('Verkauf').summary,/Kundenerlebnis/);
  const added=api.createProfile({title:'Warenverantwortliche',department:'Waren',
    responsibility:'Inventur und Kontrolle',summary:'Artikelflüsse nachvollziehen und pflegen.',
    tasks:['Wareneingang überprüfen'],requirements:['Sicherer Warenumgang']});
  assert.equal(added.length,11);
  assert.equal(api.byTitle('Warenverantwortliche').department,'Waren');
  assert.ok(db.getItem(api.key));
  assert.equal(db.getItem('ladenfluss.team.v1'),null);
  assert.throws(()=>api.createProfile({title:'Verkauf',department:'Team',summary:'Doppelt',
    responsibility:'Intern',tasks:['Bestände prüfen'],requirements:['Gute Planung']}),/bereits/);
});
test('Stellenprofile: beschädigte Vorlagen bleiben unangetastet',()=>{
  const db=storage(),key='ladenfluss.positions.v1',raw='{keine json daten';
  db.setItem(key,raw);
  const api=script('job-profiles.js',db).LadenflussJobProfiles;
  assert.throws(()=>api.read(),/beschädigt/);
  assert.equal(db.getItem(key),raw);
  db.setItem(key,JSON.stringify({version:1,profiles:[]}));
  assert.throws(()=>api.read(),/zugeordnete Stellenbezeichnung/);
});


test('Vergütungstresor v2: Aufschlag und Personalbudget sind verschlüsselt und alte Löhne bleiben erhalten',async()=>{
  const db=storage(),api=script('pay-vault.js',db).LadenflussPayVault;
  await api.initialize('dies ist ein sehr langes sicheres Budgetpasswort');
  await api.set('e1',19.66);
  await api.setPlanning({overheadPct:23.5,monthlyBudget:7500.75});
  const raw=db.getItem(api.key);
  assert.equal(JSON.parse(raw).version,2);
  assert.doesNotMatch(raw,/19\.66|7500\.75|23\.5|e1/);
  assert.equal(api.getPlanning().overheadPct,23.5);
  assert.equal(api.getPlanning().monthlyBudget,7500.75);
  assert.equal(api.get('e1'),19.66);
  const detached=api.getAllRates();detached.e1=99;
  assert.equal(api.get('e1'),19.66);
  api.lock();assert.equal(api.getPlanning(),null);
  assert.equal(api.getAllRates(),null);
  await api.unlock('dies ist ein sehr langes sicheres Budgetpasswort');
  assert.equal(api.getPlanning().monthlyBudget,7500.75);
  assert.equal(api.get('e1'),19.66);
  await assert.rejects(api.setPlanning({overheadPct:100.001,monthlyBudget:5000}),/ungültig/);
  assert.equal(db.getItem(api.key),raw);
});

test('Vergütungstresor: Import prüft Passphrase und ersetzt nur nach expliziter Freigabe',async()=>{
  const sourceDb=storage(),source=script('pay-vault.js',sourceDb).LadenflussPayVault;
  const phrase='mein sehr langes privates export passwort';
  await source.initialize(phrase);
  await source.set('e1',19.66);
  await source.set('e2',21.15);
  await source.setPlanning({overheadPct:20,monthlyBudget:8000});
  const backup=source.exportEncrypted();
  const targetDb=storage(),target=script('pay-vault.js',targetDb).LadenflussPayVault;
  const preview=await target.previewImport(backup,phrase);
  assert.equal(preview.employeeCount,2);
  assert.equal(preview.hasSettings,true);
  await assert.rejects(target.previewImport(backup,'falsche lange import passphrase'),/Passphrase falsch/);
  assert.equal(target.exists(),false);
  const outcome=await target.importEncrypted(backup,phrase);
  assert.equal(outcome.employeeCount,2);
  assert.equal(target.isUnlocked(),false);
  await target.unlock(phrase);
  assert.equal(target.get('e1'),19.66);
  assert.equal(target.get('e2'),21.15);
  assert.equal(target.getPlanning().monthlyBudget,8000);

  await target.set('e1',22.5);
  const before=target.exportEncrypted();
  await assert.rejects(target.importEncrypted(backup,phrase),/ausdrücklich bestätigen/);
  assert.equal(target.exportEncrypted(),before);
  await assert.rejects(target.importEncrypted(backup,'falsche lange import passphrase',{replaceExisting:true}),/Passphrase falsch/);
  assert.equal(target.exportEncrypted(),before);
  const again=await target.importEncrypted(backup,phrase,{replaceExisting:true});
  assert.equal(again.employeeCount,2);
  assert.equal(target.isUnlocked(),false);
  assert.notEqual(target.exportEncrypted(),before);
  await target.unlock(phrase);
  assert.equal(target.get('e1'),19.66);
});
test('Vergütungstresor: Import überschreibt keinen gesperrten oder von anderem Tab geänderten Tresor',async()=>{
  const db=storage(),a=script('pay-vault.js',db).LadenflussPayVault;
  const phrase='eine ausreichend sichere lange Passphrase';
  await a.initialize(phrase);
  await a.set('e1',17.5);
  const backup=a.exportEncrypted();
  a.lock();
  await assert.rejects(a.importEncrypted(backup,phrase,{replaceExisting:true}),/entsperren/);
  assert.equal(a.exportEncrypted(),backup);
  await a.unlock(phrase);
  const b=script('pay-vault.js',db).LadenflussPayVault;
  await b.unlock(phrase);
  await b.set('e1',23.5);
  const changed=b.exportEncrypted();
  await assert.rejects(a.importEncrypted(backup,phrase,{replaceExisting:true}),/anderen Tab/);
  assert.equal(a.isUnlocked(),false);
  assert.equal(db.getItem(a.key),changed);
  await assert.rejects(b.previewImport('{"version":2}',phrase),/Tresorformat/);
  assert.equal(db.getItem(b.key),changed);
});
test('Vergütungstresor: historische AES-GCM-v1-Stundenlöhne bleiben entsperrbar und werden ohne Datenverlust migriert',async()=>{
  const db=storage(),phrase='altes verschluesseltes sicherungspasswort';
  const salt=webcrypto.getRandomValues(new Uint8Array(16));
  const iv=webcrypto.getRandomValues(new Uint8Array(12));
  const secret=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(phrase),
    'PBKDF2',false,['deriveKey']);
  const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},
    secret,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const cipher=new Uint8Array(await webcrypto.subtle.encrypt({name:'AES-GCM',iv},
    key,new TextEncoder().encode(JSON.stringify({e1:19.66,e2:20.35}))));
  const b64=bytes=>Buffer.from(bytes).toString('base64');
  const legacy=JSON.stringify({version:1,rounds:250000,salt:b64(salt),
    iv:b64(iv),ciphertext:b64(cipher)});
  db.setItem('ladenfluss.hr-pay-vault.v1',legacy);
  const api=script('pay-vault.js',db).LadenflussPayVault;
  await api.unlock(phrase);
  assert.equal(api.get('e1'),19.66);
  assert.equal(api.get('e2'),20.35);
  assert.equal(api.getPlanning().overheadPct,0);
  assert.equal(api.getPlanning().monthlyBudget,null);
  await api.setPlanning({overheadPct:25,monthlyBudget:6000});
  assert.equal(JSON.parse(api.exportEncrypted()).version,2);
  assert.equal(api.get('e2'),20.35);
  api.lock();
  await api.unlock(phrase);
  assert.equal(api.get('e1'),19.66);
  assert.equal(api.getPlanning().monthlyBudget,6000);
});
test('Personalkosten: Team-Budgetvergleich nur mit vollständigen Stundenlöhnen',()=>{
  const db=storage(),api=script('staff-costs.js',db).LadenflussStaffCosts;
  const team=[
    {id:'e1',name:'Anna',hours:30},
    {id:'e2',name:'Ben',hours:35},
  ];
  const shifts={e1:[['08:00','14:00',30]],e2:[['10:00','16:00',30]]};
  const shiftHours=shift=>(Number(shift[1].slice(0,2))-Number(shift[0].slice(0,2)))*1-Number(shift[2])/60;
  const partial=api.summarize({team,shifts,rates:{e1:19.66},planning:{overheadPct:20,monthlyBudget:6500},shiftHours});
  assert.equal(partial.complete,false);
  assert.equal(partial.priced,1);
  assert.equal(partial.missing.length,1);
  assert.equal(partial.budgetDifference,null);
  assert.ok(Math.abs(partial.monthlyEmployer-3066.96)<.001);
  const full=api.summarize({team,shifts,rates:{e1:19.66,e2:21.25},planning:{overheadPct:20,monthlyBudget:6500},shiftHours});
  assert.equal(full.complete,true);
  assert.ok(full.monthlyEmployer>full.monthlyGross);
  assert.equal(full.budgetExceeded,true);
  assert.ok(full.budgetDifference<0);
  const safe=api.summarize({team,shifts,rates:{e1:19.66,e2:21.25},planning:{overheadPct:20,monthlyBudget:10000},shiftHours});
  assert.equal(safe.budgetExceeded,false);
  assert.ok(safe.budgetDifference>0);
  assert.equal(safe.invalidShiftCount,0);
  const invalid=api.summarize({team,shifts:{e1:[['oops','bad',99]]},rates:{e1:19.66,e2:21.25},
    planning:{overheadPct:20,monthlyBudget:null},shiftHours:()=>0});
  assert.equal(invalid.invalidShiftCount,1);
});
