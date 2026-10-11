/* Personalfluss simple wages – optional device-local, browser-readable estimates.
 * Deliberately NOT written to the PEP team store, generic team export or Cloud Beta.
 * This is NOT a secure personnel or payroll system; never enter sensitive pay
 * information on shared/public devices. Legacy encrypted vault is left untouched.
 */
(function(root){
  'use strict';
  const KEY='ladenfluss.hr-wages-simple.v1';
  const MAX_PEOPLE=5000;
  const MAX_RATE=250;
  const VALID_ID=/^[a-zA-Z0-9_-]{1,150}$/;
  function parse(raw){
    if(raw===null)return Object.create(null);
    if(typeof raw!=='string'||raw.length>300000)throw new Error('Stundenlohndaten sind zu groß oder beschädigt.');
    let data;
    try{data=JSON.parse(raw);}catch{throw new Error('Stundenlohndaten sind beschädigt. Bitte zuerst sichern.');}
    if(!data||data.version!==1||!data.rates||typeof data.rates!=='object'||Array.isArray(data.rates))
      throw new Error('Unbekanntes Stundenlohnformat. Nichts wurde überschrieben.');
    const entries=Object.entries(data.rates);
    if(entries.length>MAX_PEOPLE)throw new Error('Zu viele Stundenlohneinträge.');
    const rates=Object.create(null);
    for(const [id,rate] of entries){
      if(!VALID_ID.test(id)||!Number.isFinite(rate)||rate<0||rate>MAX_RATE||Math.abs(rate*100-Math.round(rate*100))>1e-7)
        throw new Error('Ungültige Stundenlohndaten. Nichts wurde überschrieben.');
      rates[id]=rate;
    }
    return rates;
  }
  function load(){
    let raw;
    try{raw=root.localStorage.getItem(KEY);}catch{throw new Error('Der lokale Speicher ist nicht erreichbar.');}
    return parse(raw);
  }
  function get(id){
    const rates=load();
    return Object.hasOwn(rates,id)?rates[id]:null;
  }
  function persist(rates){
    if(!rates||typeof rates!=='object'||Array.isArray(rates))throw new Error('Ungültige Stundenlöhne.');
    const normalized=Object.create(null);
    for(const [id,rate] of Object.entries(rates)){
      if(!VALID_ID.test(id)||!Number.isFinite(rate)||rate<0||rate>MAX_RATE||Math.abs(rate*100-Math.round(rate*100))>1e-7)
        throw new Error('Stundenlohn muss zwischen 0 und 250 € liegen (max. zwei Nachkommastellen).');
      normalized[id]=rate;
    }
    if(Object.keys(normalized).length>MAX_PEOPLE)throw new Error('Zu viele Stundenlohneinträge.');
    const raw=JSON.stringify({version:1,rates:normalized});
    try{root.localStorage.setItem(KEY,raw);}
    catch{throw new Error('Stundenlohn wurde nicht gespeichert. Bitte Speicherplatz prüfen.');}
    return normalized;
  }
  function set(id,rate){
    if(!VALID_ID.test(id))throw new Error('Mitarbeiter-ID ungültig.');
    const rates=load();
    if(rate===null)delete rates[id];
    else rates[id]=rate;
    return persist(rates);
  }
  function mergeMissing(incoming){
    const saved=load();
    for(const [id,rate] of Object.entries(incoming)){
      if(!Object.hasOwn(saved,id))saved[id]=rate;
    }
    return persist(saved);
  }
  root.LadenflussHourlyRates=Object.freeze({KEY,load,get,set,mergeMissing,parse,MAX_RATE});
})(window);
