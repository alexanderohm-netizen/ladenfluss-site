/* Passwordless, browser-local personnel records. Non-extractable AES key in IndexedDB.
 * Protects data at rest from casual inspection, NOT from same-origin scripts or users of this device.
 * Legacy password-protected records are never modified or overwritten.
 */
(function(root){
 'use strict';
 const PREFIX='ladenfluss.personalfluss.local.v2.';
 const DB='ladenfluss-personnel-keys-v1',STORE='keys',KEY='personal-v2';
 const enc=()=>new TextEncoder(),dec=()=>new TextDecoder();
 const b64=b=>btoa(String.fromCharCode(...b));
 const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 function available(){return !!(root.crypto?.subtle&&root.crypto?.getRandomValues&&root.indexedDB&&root.localStorage);}
 function path(id){if(!/^[a-zA-Z0-9_-]{1,120}$/.test(String(id)))throw Error('Ungültige Mitarbeiter-ID.');return PREFIX+id;}
 function exists(id){return !!root.localStorage?.getItem(path(id));}
 function legacyExists(id){return !!root.localStorage?.getItem('ladenfluss.personalfluss.private.v1.'+id);}
 function dbOpen(){return new Promise((resolve,reject)=>{const req=root.indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Lokaler Schlüsselspeicher nicht verfügbar.'));});}
 async function keyFor(create){
   const db=await dbOpen();
   try{
     const current=await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
     if(current)return current;
     if(!create)throw Error('Der lokale Sicherheitsschlüssel fehlt. Vorhandene Daten können nicht entschlüsselt werden.');
     const key=await root.crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
     return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readwrite').objectStore(STORE).put(key,KEY);req.onsuccess=()=>resolve(key);req.onerror=()=>reject(Error('Sicherheitsschlüssel konnte nicht gespeichert werden.'));});
   }finally{db.close();}
 }
 function validate(d){
   const v={email:String(d?.email||'').trim(),phone:String(d?.phone||'').trim(),address:String(d?.address||'').trim(),iban:String(d?.iban||'').replace(/\s/g,'').toUpperCase(),nationality:String(d?.nationality||'').trim(),residenceStatus:String(d?.residenceStatus||'').trim(),residenceUntil:String(d?.residenceUntil||'').trim()};
   if(v.email.length>160||v.phone.length>50||v.address.length>320||v.nationality.length>100||v.residenceStatus.length>100)throw Error('Eine Angabe ist zu lang.');
   if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw Error('Bitte eine gültige E-Mail-Adresse eingeben.');
   if(v.iban&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v.iban))throw Error('Bitte eine gültig formatierte IBAN eingeben.');
   if(v.iban){let rem=0;for(const c of v.iban.slice(4)+v.iban.slice(0,4)){const digits=c>='A'&&c<='Z'?String(c.charCodeAt(0)-55):c;for(const digit of digits)rem=(rem*10+Number(digit))%97;}if(rem!==1)throw Error('Die IBAN-Prüfziffer ist ungültig.');}
   if(v.residenceUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(v.residenceUntil))throw Error('Ungültiges Ablaufdatum.');
   return v;
 }
 async function read(id){
   if(!available())throw Error('Lokaler Browser-Speicher ist nicht verfügbar.');
   const raw=root.localStorage.getItem(path(id));if(!raw)return null;
   try{
     const rec=JSON.parse(raw);if(rec.v!==2)throw Error('version');
     const key=await keyFor(false);
     const clear=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(rec.iv),additionalData:enc().encode(String(id))},key,unb64(rec.data));
     return validate(JSON.parse(dec().decode(clear)));
   }catch(_){throw Error('Die lokal gespeicherte Personalakte konnte nicht geöffnet werden. Daten bleiben unverändert.');}
 }
 async function save(id,details){
   if(!available())throw Error('Lokale Verschlüsselung ist nicht verfügbar. Angaben wurden nicht gespeichert.');
   const values=validate(details);
   if(exists(id))await read(id); // never overwrite data whose key is missing
   const key=await keyFor(true),iv=root.crypto.getRandomValues(new Uint8Array(12));
   const data=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc().encode(String(id))},key,enc().encode(JSON.stringify(values)));
   root.localStorage.setItem(path(id),JSON.stringify({v:2,iv:b64(iv),data:b64(new Uint8Array(data))}));
   return true;
 }
 root.LadenflussPersonnelLocal=Object.freeze({PREFIX,available,exists,legacyExists,read,save,validate});
})(globalThis);
