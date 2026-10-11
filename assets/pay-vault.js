/* Ladenfluss Personalfluss – encrypted, device-local hourly pay vault.
 * Does NOT sync to Cloud Beta, PEP or generic backup.
 * A browser profile / an unlocked page is NOT an HR access-control system.
 * User must keep the passphrase. No reset/forgotten-password recovery.
 */
(function(root){
  'use strict';
  const KEY='ladenfluss.hr-pay-vault.v1';
  const ROUNDS=250000;
  const MAX_PEOPLE=5000;
  const MAX_RATE=250;
  let cryptoKey=null,values=null,cipherSnapshot=null;

  function cryptoAPI(){return root.crypto?.subtle&&root.crypto?.getRandomValues?root.crypto:null;}
  function supported(){return Boolean(cryptoAPI()&&typeof TextEncoder!=='undefined'&&typeof TextDecoder!=='undefined'&&typeof btoa==='function'&&typeof atob==='function');}
  function bytesToBase64(bytes){
    let binary='';
    for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToBytes(str){
    if(typeof str!=='string'||str.length>300000)return null;
    try{
      const binary=atob(str),out=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
      return out;
    }catch{return null;}
  }
  function validateRates(rates){
    if(!rates||typeof rates!=='object'||Array.isArray(rates)||Object.keys(rates).length>MAX_PEOPLE)
      throw new Error('Die Vergütungsdaten sind beschädigt.');
    for(const [id,rate] of Object.entries(rates)){
      if(!id||id.length>150||typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>MAX_RATE||
        Math.abs(Math.round(rate*100)-rate*100)>1e-6)throw new Error('Die Vergütungsdaten sind beschädigt.');
    }
    return rates;
  }
  function parseRecord(raw){
    let record;
    try{record=JSON.parse(raw);}catch{throw new Error('Der Vergütungstresor ist beschädigt.');}
    if(!record||record.version!==1||record.rounds!==ROUNDS||
      typeof record.salt!=='string'||typeof record.iv!=='string'||typeof record.ciphertext!=='string')
      throw new Error('Unbekanntes Vergütungstresor-Format. Es wurde nichts überschrieben.');
    const salt=base64ToBytes(record.salt),iv=base64ToBytes(record.iv),data=base64ToBytes(record.ciphertext);
    if(!salt||salt.length!==16||!iv||iv.length!==12||!data||data.length<17)
      throw new Error('Der Vergütungstresor ist beschädigt.');
    return {record,salt,iv,data};
  }
  function readRaw(){
    try{return localStorage.getItem(KEY);}catch{throw new Error('Der lokale Speicher ist nicht verfügbar.');}
  }
  function exists(){return readRaw()!==null;}
  async function derive(password,salt){
    if(!supported())throw new Error('Dieser Browser unterstützt keine sichere lokale Verschlüsselung.');
    if(typeof password!=='string'||password.length<12||password.length>256)
      throw new Error('Bitte mindestens 12 Zeichen als Tresor-Passphrase verwenden.');
    const c=cryptoAPI();
    const material=await c.subtle.importKey('raw',new TextEncoder().encode(password),
      'PBKDF2',false,['deriveKey']);
    return c.subtle.deriveKey({name:'PBKDF2',salt,iterations:ROUNDS,hash:'SHA-256'},
      material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(key,salt,data){
    const iv=cryptoAPI().getRandomValues(new Uint8Array(12));
    const text=new TextEncoder().encode(JSON.stringify(validateRates(data)));
    const encrypted=new Uint8Array(await cryptoAPI().subtle.encrypt({name:'AES-GCM',iv},key,text));
    return JSON.stringify({version:1,rounds:ROUNDS,salt:bytesToBase64(salt),
      iv:bytesToBase64(iv),ciphertext:bytesToBase64(encrypted)});
  }
  async function initialize(password){
    if(exists())throw new Error('Es existiert bereits ein Vergütungstresor. Bitte entsperren.');
    const salt=cryptoAPI()?.getRandomValues(new Uint8Array(16));
    if(!salt)throw new Error('Dieser Browser unterstützt keine sichere Verschlüsselung.');
    const key=await derive(password,salt);
    const raw=await encrypt(key,salt,{});
    // Recheck after async derivation. Never replace another tab's newly created vault.
    if(readRaw()!==null)throw new Error('Inzwischen wurde bereits ein Tresor angelegt. Bitte neu laden.');
    try{localStorage.setItem(KEY,raw);}catch{throw new Error('Der Tresor konnte nicht gespeichert werden.');}
    cryptoKey=key;values={};cipherSnapshot=raw;
    return true;
  }
  async function unlock(password){
    lock();
    const raw=readRaw();
    if(raw===null)throw new Error('Es wurde noch kein Vergütungstresor angelegt.');
    const {salt,iv,data}=parseRecord(raw);
    const key=await derive(password,salt);
    let parsed;
    try{
      const bytes=await cryptoAPI().subtle.decrypt({name:'AES-GCM',iv},key,data);
      parsed=validateRates(JSON.parse(new TextDecoder().decode(bytes)));
    }catch{
      throw new Error('Passphrase falsch oder Vergütungstresor beschädigt. Nichts wurde verändert.');
    }
    // Prevent stale cross-tab reads after PBKDF2.
    if(readRaw()!==raw)throw new Error('Der Tresor wurde in einem anderen Tab geändert. Bitte erneut entsperren.');
    cryptoKey=key;values={...parsed};cipherSnapshot=raw;
    return true;
  }
  function lock(){
    cryptoKey=null;values=null;cipherSnapshot=null;
  }
  function isUnlocked(){return Boolean(cryptoKey&&values);}
  function get(employeeId){
    if(!isUnlocked())return null;
    return Object.hasOwn(values,employeeId)?values[employeeId]:null;
  }
  async function set(employeeId,hourlyRate){
    if(!isUnlocked())throw new Error('Bitte den Vergütungstresor zuerst entsperren.');
    if(typeof employeeId!=='string'||employeeId.length<1||employeeId.length>150)
      throw new Error('Ungültige Mitarbeiterzuordnung.');
    if(hourlyRate!==null&&
      (typeof hourlyRate!=='number'||!Number.isFinite(hourlyRate)||
       hourlyRate<0||hourlyRate>MAX_RATE||Math.abs(Math.round(hourlyRate*100)-hourlyRate*100)>1e-6))
      throw new Error('Brutto-Stundenlohn muss zwischen 0 und 250 € liegen, mit maximal zwei Nachkommastellen.');
    if(readRaw()!==cipherSnapshot){
      lock();
      throw new Error('Der Tresor wurde in einem anderen Tab geändert. Bitte erneut entsperren.');
    }
    const candidate={...values};
    if(hourlyRate===null)delete candidate[employeeId];
    else candidate[employeeId]=hourlyRate;
    const {salt}=parseRecord(cipherSnapshot);
    const ciphertext=await encrypt(cryptoKey,salt,candidate);
    if(readRaw()!==cipherSnapshot){
      lock();
      throw new Error('Der Tresor wurde inzwischen geändert. Bitte erneut entsperren.');
    }
    try{localStorage.setItem(KEY,ciphertext);}
    catch{throw new Error('Der Stundenlohn konnte nicht gespeichert werden.');}
    values=candidate;cipherSnapshot=ciphertext;
    return true;
  }
  function exportEncrypted(){
    const raw=readRaw();
    if(!raw)return null;
    parseRecord(raw);
    return raw;
  }
  root.LadenflussPayVault=Object.freeze({
    key:KEY,supported,exists,initialize,unlock,lock,isUnlocked,get,set,exportEncrypted,
  });
})(window);
