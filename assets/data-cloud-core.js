(function(root){
'use strict';
// Shared, explicit cloud snapshots. Never auto-sync local modules.
const MODULES=Object.freeze({
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
 // Reuse the existing strict domain validation and allowlist serialization.
 const result=root.LadenflussRestore.parse(module,raw);
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
 // Existing restore-core checks the exact original value before writing.
 const plan=root.LadenflussRestore.prepare(module,JSON.stringify(data),storage);
 if(plan.before!==expected)throw Error('Lokale Daten wurden nach der Vorschau geändert. Bitte neu laden.');
 root.LadenflussRestore.apply(plan,storage);
}
function summary(module,data){return root.LadenflussRestore.summary(module,clean(module,data));}
root.LadenflussDataCloud={MODULES,MAX_BYTES,clean,local,baseline,apply,summary};
})(typeof window==='undefined'?globalThis:window);
