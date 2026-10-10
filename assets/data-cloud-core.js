(function(root){
'use strict';
// Shared, explicit cloud snapshots. Never auto-sync local modules.
const MODULES=Object.freeze({
 profile:{key:'ladenfluss.store.v1',label:'Mein Laden'},
 zahlenfluss:{key:'ladenfluss.zahlenfluss.v1',label:'Zahlenfluss'},
 warenfluss:{key:'ladenfluss.warenfluss.v1',label:'Warenfluss'}
});
const MAX_BYTES=512000;
function definition(module){if(!Object.hasOwn(MODULES,module))throw Error('Unbekannter Cloud-Bereich.');return MODULES[module];}
function bytes(text){return new TextEncoder().encode(text).length;}
function clean(module,input){
 definition(module);
 const raw=JSON.stringify(input);
 if(!raw||bytes(raw)>MAX_BYTES)throw Error('Diese Sicherung ist zu groß (maximal 500 KB).');
 // Free profile uses the existing company settings validator. Only allowlisted fields survive.
 let result;
 if(module==='profile'){
  const settings=root.LadenflussStoreSettings;
  if(!settings||!input||typeof input!=='object'||Array.isArray(input))throw Error('Ungültiges Ladenprofil.');
  const allowed=Object.fromEntries(Object.keys(settings.defaults).filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]]));
  result=settings.validate(allowed);
 }else result=root.LadenflussRestore.parse(module,raw);
 if(bytes(JSON.stringify(result))>MAX_BYTES)throw Error('Diese Sicherung ist zu groß (maximal 500 KB).');
 return result;
}
function local(module,storage){
 const key=definition(module).key,raw=storage.getItem(key);
 if(raw===null)return null;
 if(bytes(raw)>MAX_BYTES)throw Error('Lokale Daten überschreiten 500 KB. Bitte zuerst eine lokale Sicherung erstellen.');
 return clean(module,JSON.parse(raw));
}
function baseline(module,storage){return storage.getItem(definition(module).key);}
function apply(module,incoming,expected,storage){
 const data=clean(module,incoming);
 if(storage.getItem(definition(module).key)!==expected)throw Error('Lokale Daten wurden nach der Vorschau geändert. Bitte neu laden.');
 if(module==='profile'){storage.setItem(definition(module).key,JSON.stringify(data));return;}
 // Existing restore-core also checks the exact original value before writing.
 const plan=root.LadenflussRestore.prepare(module,JSON.stringify(data),storage);
 root.LadenflussRestore.apply(plan,storage);
}
function summary(module,data){const value=clean(module,data);return module==='profile'?(value.name||'Ladenprofil')+' · '+(value.type||'Sortiment nicht angegeben')+' · '+value.days+' Öffnungstage':root.LadenflussRestore.summary(module,value);}
root.LadenflussDataCloud={MODULES,MAX_BYTES,clean,local,baseline,apply,summary};
})(typeof window==='undefined'?globalThis:window);
