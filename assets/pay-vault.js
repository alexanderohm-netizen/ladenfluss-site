/* Personalfluss: encrypted, device-local hourly pay and cost planning.
 * Not part of generic backups, PEP, customer accounts or Cloud Beta.
 * v2 preserves the ability to read v1 encrypted hourly-rate vaults.
 * The passphrase never persists: no recovery without it.
 */
(function(root){
  'use strict';
  const KEY='ladenfluss.hr-pay-vault.v1';
  const ROUNDS=250000, MAX_PEOPLE=5000, MAX_RATE=250, MAX_BYTES=300000;
  const DEFAULT_PLANNING=Object.freeze({overheadPct:0,monthlyBudget:null});
  let cryptoKey=null,rates=null,planning=null,cipherSnapshot=null;

  const cryptoAPI=()=>root.crypto?.subtle&&root.crypto?.getRandomValues?root.crypto:null;
  function supported(){
    return Boolean(cryptoAPI()&&typeof TextEncoder!=='undefined'&&
      typeof TextDecoder!=='undefined'&&typeof btoa==='function'&&typeof atob==='function');
  }
  function bytesToBase64(bytes){
    let binary='';
    for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToBytes(value){
    if(typeof value!=='string'||value.length>MAX_BYTES)return null;
    try{
      const binary=atob(value),data=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)data[i]=binary.charCodeAt(i);
      return data;
    }catch{return null;}
  }
  function money(value,min,max){
    return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max&&
      Math.abs(Math.round(value*100)-value*100)<1e-6;
  }
  function validateRates(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||
      Object.keys(value).length>MAX_PEOPLE)throw new Error('Die Vergütungsdaten sind beschädigt.');
    const result=Object.create(null);
    for(const [id,rate] of Object.entries(value)){
      if(!id||id.length>150||['__proto__','constructor','prototype'].includes(id)||
        !money(rate,0,MAX_RATE))throw new Error('Die Vergütungsdaten sind beschädigt.');
      result[id]=rate;
    }
    return result;
  }
  function validatePlanning(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||
      !money(value.overheadPct,0,100)||
      (value.monthlyBudget!==null&&!money(value.monthlyBudget,0,10000000)))
      throw new Error('Arbeitgeberkosten und Monatsbudget sind ungültig.');
    return {overheadPct:value.overheadPct,monthlyBudget:value.monthlyBudget};
  }
  function parseRecord(raw){
    if(typeof raw!=='string'||raw.length>MAX_BYTES)
      throw new Error('Die Vergütungsdatei ist zu groß oder ungültig.');
    let record;
    try{record=JSON.parse(raw);}catch{throw new Error('Der Vergütungstresor ist beschädigt.');}
    if(!record||![1,2].includes(record.version)||record.rounds!==ROUNDS||
      typeof record.salt!=='string'||typeof record.iv!=='string'||
      typeof record.ciphertext!=='string')
      throw new Error('Unbekanntes Tresorformat. Vorhandene Daten wurden nicht verändert.');
    const salt=base64ToBytes(record.salt);
    const iv=base64ToBytes(record.iv);
    const data=base64ToBytes(record.ciphertext);
    if(!salt||salt.length!==16||!iv||iv.length!==12||!data||data.length<17)
      throw new Error('Der Vergütungstresor ist beschädigt.');
    return {record,salt,iv,data};
  }
  function readRaw(){
    try{return localStorage.getItem(KEY);}catch{throw new Error('Der lokale Speicher ist nicht verfügbar.');}
  }
  function exists(){return readRaw()!==null;}
  async function derive(password,salt){
    if(!supported())throw new Error('Dieser Browser unterstützt keine sichere Verschlüsselung.');
    if(typeof password!=='string'||password.length<12||password.length>256)
      throw new Error('Bitte eine Tresor-Passphrase mit mindestens 12 Zeichen verwenden.');
    const c=cryptoAPI();
    const material=await c.subtle.importKey('raw',new TextEncoder().encode(password),
      'PBKDF2',false,['deriveKey']);
    return c.subtle.deriveKey({name:'PBKDF2',salt,iterations:ROUNDS,hash:'SHA-256'},
      material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function unpack(record,value){
    if(record.version===1)return {
      rates:validateRates(value),planning:{...DEFAULT_PLANNING}
    };
    if(!value||typeof value!=='object'||Array.isArray(value)||
      !Object.hasOwn(value,'rates')||!Object.hasOwn(value,'planning'))
      throw new Error('Das Tresorformat ist ungültig.');
    return {
      rates:validateRates(value.rates),planning:validatePlanning(value.planning)
    };
  }
  async function decrypt(raw,password){
    const {record,salt,iv,data}=parseRecord(raw);
    const key=await derive(password,salt);
    let result;
    try{
      const clear=await cryptoAPI().subtle.decrypt({name:'AES-GCM',iv},key,data);
      result=unpack(record,JSON.parse(new TextDecoder().decode(clear)));
    }catch{
      throw new Error('Passphrase falsch oder Vergütungstresor beschädigt. Nichts wurde verändert.');
    }
    return {key,rates:result.rates,planning:result.planning};
  }
  async function encrypt(key,data,salt){
    const iv=cryptoAPI().getRandomValues(new Uint8Array(12));
    const clear=new TextEncoder().encode(JSON.stringify({
      rates:validateRates(data.rates),planning:validatePlanning(data.planning)
    }));
    const encrypted=new Uint8Array(await cryptoAPI().subtle.encrypt({name:'AES-GCM',iv},key,clear));
    const raw=JSON.stringify({version:2,rounds:ROUNDS,salt:bytesToBase64(salt),
      iv:bytesToBase64(iv),ciphertext:bytesToBase64(encrypted)});
    if(raw.length>MAX_BYTES)throw new Error('Der Tresor überschreitet die zulässige Größe.');
    return raw;
  }
  function lock(){
    cryptoKey=null;rates=null;planning=null;cipherSnapshot=null;
  }
  function isUnlocked(){return Boolean(cryptoKey&&rates&&planning);}
  async function initialize(password){
    if(exists())throw new Error('Es existiert bereits ein Vergütungstresor. Bitte entsperren.');
    const salt=cryptoAPI()?.getRandomValues(new Uint8Array(16));
    if(!salt)throw new Error('Dieser Browser unterstützt keine sichere Verschlüsselung.');
    const key=await derive(password,salt);
    const blank={rates:Object.create(null),planning:{...DEFAULT_PLANNING}};
    const raw=await encrypt(key,blank,salt);
    if(readRaw()!==null)throw new Error('Inzwischen wurde bereits ein Tresor angelegt. Bitte neu laden.');
    try{localStorage.setItem(KEY,raw);}catch{throw new Error('Der Tresor konnte nicht gespeichert werden.');}
    cryptoKey=key;rates=blank.rates;planning=blank.planning;cipherSnapshot=raw;
    return true;
  }
  async function unlock(password){
    lock();
    const raw=readRaw();
    if(raw===null)throw new Error('Es wurde noch kein Vergütungstresor angelegt.');
    const result=await decrypt(raw,password);
    if(readRaw()!==raw)throw new Error('Der Tresor wurde in einem anderen Tab geändert. Bitte neu entsperren.');
    cryptoKey=result.key;rates=result.rates;planning=result.planning;cipherSnapshot=raw;
    return true;
  }
  function get(employeeId){
    if(!isUnlocked())return null;
    return Object.hasOwn(rates,employeeId)?rates[employeeId]:null;
  }
  function getAllRates(){
    return isUnlocked()?{...rates}:null;
  }
  function getPlanning(){
    return isUnlocked()?{...planning}:null;
  }
  async function persist(nextRates,nextPlanning){
    if(!isUnlocked())throw new Error('Bitte den Vergütungstresor zuerst entsperren.');
    if(readRaw()!==cipherSnapshot){
      lock();
      throw new Error('Der Tresor wurde in einem anderen Tab geändert. Bitte erneut entsperren.');
    }
    const previous=cipherSnapshot;
    const {salt}=parseRecord(previous);
    const cleanRates=validateRates(nextRates),cleanPlanning=validatePlanning(nextPlanning);
    const raw=await encrypt(cryptoKey,{rates:cleanRates,planning:cleanPlanning},salt);
    if(readRaw()!==previous){
      lock();
      throw new Error('Der Tresor wurde inzwischen geändert. Bitte erneut entsperren.');
    }
    try{localStorage.setItem(KEY,raw);}
    catch{throw new Error('Der Tresor konnte nicht gespeichert werden. Bestehende Daten bleiben erhalten.');}
    rates=cleanRates;planning=cleanPlanning;cipherSnapshot=raw;
    return true;
  }
  async function set(employeeId,hourlyRate){
    if(!isUnlocked())throw new Error('Bitte den Vergütungstresor zuerst entsperren.');
    if(typeof employeeId!=='string'||employeeId.length<1||employeeId.length>150||
      ['__proto__','constructor','prototype'].includes(employeeId))
      throw new Error('Ungültige Mitarbeiterzuordnung.');
    if(hourlyRate!==null&&!money(hourlyRate,0,MAX_RATE))
      throw new Error('Brutto-Stundenlohn muss zwischen 0 und 250 € liegen, mit maximal zwei Nachkommastellen.');
    const next={...rates};
    if(hourlyRate===null)delete next[employeeId];
    else next[employeeId]=hourlyRate;
    return persist(next,planning);
  }
  async function setPlanning(next){
    if(!isUnlocked())throw new Error('Bitte den Vergütungstresor zuerst entsperren.');
    return persist(rates,validatePlanning(next));
  }
  function exportEncrypted(){
    const raw=readRaw();
    if(raw===null)return null;
    parseRecord(raw);
    return raw;
  }
  async function previewImport(raw,password){
    const decoded=await decrypt(raw,password);
    return {employeeCount:Object.keys(decoded.rates).length,
      hasSettings:decoded.planning.monthlyBudget!==null||decoded.planning.overheadPct!==0};
  }
  async function importEncrypted(raw,password,{replaceExisting=false}={}){
    const original=readRaw();
    if(original!==null&&(!isUnlocked()||!replaceExisting))
      throw new Error('Bestehenden Tresor zunächst entsperren und die Ersetzung ausdrücklich bestätigen.');
    if(original!==null&&cipherSnapshot!==original){
      lock();
      throw new Error('Der bestehende Tresor wurde in einem anderen Tab geändert.');
    }
    const decoded=await decrypt(raw,password);
    if(readRaw()!==original){
      lock();
      throw new Error('Die Tresordaten wurden inzwischen geändert. Erneut prüfen.');
    }
    try{localStorage.setItem(KEY,raw);}
    catch{throw new Error('Die Importdatei konnte nicht gespeichert werden. Vorhandener Tresor bleibt erhalten.');}
    // After import always return to the locked state; never expose restored wages automatically.
    lock();
    return {employeeCount:Object.keys(decoded.rates).length};
  }
  root.LadenflussPayVault=Object.freeze({
    key:KEY,supported,exists,initialize,unlock,lock,isUnlocked,get,getAllRates,
    getPlanning,setPlanning,set,exportEncrypted,previewImport,importEncrypted
  });
})(window);
