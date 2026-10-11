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
