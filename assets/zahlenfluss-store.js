(function(root){
'use strict';
const KEY='ladenfluss.zahlenfluss.v1';
const fields=['revenue','goods','labor','other','hours','receipts'];
function dateOK(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number(s.slice(0,4))>=2000&&Number(s.slice(0,4))<=2100&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function day(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function monday(s){if(!dateOK(s))throw Error('Ungültiges Datum.');return day(s,-((new Date(s+'T12:00:00Z').getUTCDay()+6)%7));}
function number(value,optional=false,integer=false){
 if(value===''||value===null||value===undefined){if(optional)return null;throw Error('Bitte den Umsatz eingeben.');}
 const s=String(value).trim().replace(',','.');
 if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Bitte positive Zahlen mit höchstens zwei Nachkommastellen eingeben.');
 const n=Number(s);if(!Number.isFinite(n)||n>100000000||(integer&&!Number.isInteger(n)))throw Error('Zahl zu groß oder keine ganze Bonanzahl.');
 return Math.round(n*100);
}
function entry(raw){if(!dateOK(raw.date))throw Error('Bitte ein gültiges Datum eingeben.');const out={date:raw.date};for(const f of fields)out[f]=number(raw[f],f!=='revenue',f==='receipts');return out;}
function validate(data){if(!data||data.version!==1||!Array.isArray(data.entries)||data.entries.length>40000)throw Error('Die gespeicherten Daten können nicht gelesen werden.');
 const seen=new Set();for(const r of data.entries){if(!dateOK(r.date)||seen.has(r.date))throw Error('Ungültige oder doppelte Tagesdaten.');seen.add(r.date);for(const f of fields)if(!(r[f]===null&&f!=='revenue')&&(!Number.isSafeInteger(r[f])||r[f]<0||r[f]>10000000000||(f==='receipts'&&r[f]%100!==0)))throw Error('Ungültige Tageszahlen.');}
 if(data.target!==null&&(!Number.isSafeInteger(data.target)||data.target<=0||data.target>10000000000))throw Error('Ungültiges Wochenziel.');return data;}
function load(storage){const s=storage.getItem(KEY);return s===null?{version:1,entries:[],target:null}:validate(JSON.parse(s));}
function save(storage,data){validate(data);storage.setItem(KEY,JSON.stringify(data));}
function aggregate(rows){const revenue=rows.reduce((s,r)=>s+r.revenue,0);const complete=rows.length>0&&rows.every(r=>['goods','labor','other'].every(f=>r[f]!==null));
 const costs=rows.reduce((s,r)=>s+(r.goods||0)+(r.labor||0)+(r.other||0),0);
 function ratio(field){const covered=rows.filter(r=>r[field]!==null),den=covered.reduce((s,r)=>s+r[field],0),rev=covered.reduce((s,r)=>s+r.revenue,0);return {value:den>0?rev/den:null,days:covered.length};}
 return {revenue,costs,contribution:complete?revenue-costs:null,days:rows.length,hourly:ratio('hours'),basket:ratio('receipts')};}
function week(data,start){const end=day(start,6),rows=data.entries.filter(r=>r.date>=start&&r.date<=end).sort((a,b)=>a.date.localeCompare(b.date));const pairs=rows.map(r=>[r,data.entries.find(p=>p.date===day(r.date,-7))]).filter(p=>p[1]);const now=pairs.reduce((s,p)=>s+p[0].revenue,0),previous=pairs.reduce((s,p)=>s+p[1].revenue,0);
 return {...aggregate(rows),rows,pairs:pairs.length,change:previous>0?(now-previous)/previous*100:null};}
function csv(data){return '\ufeffDatum;Nettoumsatz EUR;Wareneinsatz EUR;Personalkosten EUR;Sonstige Kosten EUR;Personalstunden;Bons\r\n'+[...data.entries].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>[r.date,...fields.map(f=>r[f]===null?'':(r[f]/100).toFixed(f==='receipts'?0:2).replace('.',','))].join(';')).join('\r\n');}
const api={KEY,fields,dateOK,day,monday,number,entry,validate,load,save,aggregate,week,csv};if(typeof module!=='undefined')module.exports=api;root.Zahlenfluss=api;
})(typeof window==='undefined'?globalThis:window);
