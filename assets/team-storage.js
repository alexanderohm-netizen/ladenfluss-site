(function(root){
'use strict';
const KEY='ladenfluss.team-bundle.v1';
const KEYS=['ladenfluss.team.v1','ladenfluss.pep.weeks.v2','ladenfluss.pep.shifts.v1','ladenfluss.pep.plan-status.v1','ladenfluss.pep.absences.v1','ladenfluss.urlaubsplaner.v1'];
function bundle(storage){const raw=storage.getItem(KEY);if(raw===null)return null;const data=JSON.parse(raw);if(!data||data.version!==1||!data.records||typeof data.records!=='object'||Array.isArray(data.records)||KEYS.some(k=>!Object.hasOwn(data.records,k)||(data.records[k]!==null&&typeof data.records[k]!=='string')))throw Error('Das gemeinsame Teampaket ist beschädigt. Bitte eine Sicherung wiederherstellen.');return data;}
function create(storage){return {getItem(key){const data=KEYS.includes(key)?bundle(storage):null;return data?data.records[key]:storage.getItem(key);},setItem(key,value){const data=KEYS.includes(key)?bundle(storage):null;if(data){data.records[key]=String(value);storage.setItem(KEY,JSON.stringify(data));}else storage.setItem(key,value);},removeItem(key){const data=KEYS.includes(key)?bundle(storage):null;if(data){data.records[key]=null;storage.setItem(KEY,JSON.stringify(data));}else storage.removeItem(key);}};}
root.LadenflussTeamStorage={KEY,KEYS,create,bundle};
// Access to localStorage is deferred so pages can still show storage-access errors.
root.LadenflussLocal={getItem:k=>create(root.localStorage).getItem(k),setItem:(k,v)=>create(root.localStorage).setItem(k,v),removeItem:k=>create(root.localStorage).removeItem(k)};
})(typeof window==='undefined'?globalThis:window);
