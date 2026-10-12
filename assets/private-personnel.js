/* Personalfluss: encrypted, browser-local personnel private details.
 * Sensitive fields are NEVER added to the shared team store or cloud sync.
 * AES-GCM 256, per-record random salt and IV, PBKDF2 SHA-256.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LadenflussPrivatePersonnel=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const PREFIX='ladenfluss.personalfluss.private.v1.';
  const ITERATIONS=310000;
  const enc=new TextEncoder(),dec=new TextDecoder();
  function available(){return !!root.crypto?.subtle&&!!root.crypto?.getRandomValues&&!!root.localStorage;}
  function keyFor(id){
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw Error('Ungültige Mitarbeiter-ID.');
    return PREFIX+id;
  }
  function b64(bytes){return btoa(String.fromCharCode(...bytes));}
  function unb64(str){return Uint8Array.from(atob(str),c=>c.charCodeAt(0));}
  async function derive(password,salt){
    if(typeof password!=='string'||password.length<12)throw Error('Passphrase muss mindestens 12 Zeichen enthalten.');
    const material=await root.crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
    return root.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,
      {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function validate(details){
    const values={address:String(details.address||'').trim(),iban:String(details.iban||'').replace(/\s/g,'').toUpperCase(),
      nationality:String(details.nationality||'').trim(),residenceStatus:String(details.residenceStatus||'').trim(),
      residenceUntil:String(details.residenceUntil||'').trim()};
    if(values.address.length>320||values.nationality.length>100||values.residenceStatus.length>100)throw Error('Eine Angabe ist zu lang.');
    if(values.iban&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(values.iban))throw Error('Bitte eine gültig formatierte IBAN eingeben.');
    if(values.iban){
      const rearranged=values.iban.slice(4)+values.iban.slice(0,4);
      let rem=0;
      for(const c of rearranged){
        const code=c>='A'&&c<='Z'?String(c.charCodeAt(0)-55):c;
        for(const digit of code)rem=(rem*10+Number(digit))%97;
      }
      if(rem!==1)throw Error('Die IBAN-Prüfziffer ist ungültig.');
    }
    if(values.residenceUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(values.residenceUntil))throw Error('Bitte ein gültiges Ablaufdatum eingeben.');
    return values;
  }
  function exists(id){return !!root.localStorage?.getItem(keyFor(id));}
  async function save(id,password,details){
    if(!available())throw Error('Verschlüsselung ist in diesem Browser nicht verfügbar.');
    const record=validate(details),salt=root.crypto.getRandomValues(new Uint8Array(16)),iv=root.crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(password,salt);
    // Never overwrite an existing record with an unverified passphrase.
    if(exists(id))await read(id,password);
    const ciphertext=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(id)},key,enc.encode(JSON.stringify(record)));
    root.localStorage.setItem(keyFor(id),JSON.stringify({v:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(ciphertext))}));
    return true;
  }
  async function read(id,password){
    if(!available())throw Error('Verschlüsselung ist in diesem Browser nicht verfügbar.');
    const raw=root.localStorage.getItem(keyFor(id));
    if(!raw)return null;
    try{
      const record=JSON.parse(raw);
      if(record.v!==1||record.iterations!==ITERATIONS)throw Error('Unknown version');
      const key=await derive(password,unb64(record.salt));
      const clear=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(record.iv),additionalData:enc.encode(id)},key,unb64(record.data));
      return validate(JSON.parse(dec.decode(clear)));
    }catch(_){throw Error('Passphrase falsch oder verschlüsselte Angaben nicht lesbar. Daten wurden nicht verändert.');}
  }
  return {available,exists,read,save,validate,PREFIX};
});