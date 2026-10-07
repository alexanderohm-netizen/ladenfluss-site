(function () {
  'use strict';
  const KEY='ladenfluss.store.v1';
  const defaults={name:'',type:'',days:6,hours:9,open:'09:00',close:'18:00',minStaff:2,state:'HE',productivity:185,labor:18,margin:40,lead:7,buffer:5,hourly:24};
  function validate(value) {
    if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Ungültiges Unternehmensprofil.');
    const result={...defaults,...value};
    const mins=window.LadenflussPlanning.minutes;
    const from=mins(result.open),to=mins(result.close);
    if(from===null||to===null||to<=from||!Number.isInteger(result.days)||result.days<1||result.days>7||
       !Number.isInteger(result.minStaff)||result.minStaff<1||result.minStaff>100||
       !Object.hasOwn(window.LadenflussHolidays.STATES,result.state)) throw new Error('Öffnungszeiten, Bundesland und Mindestbesetzung prüfen.');
    for (const [name,min,max] of [['productivity',1,1e9],['labor',0,100],['margin',0,99.99],['lead',0,365],['buffer',0,100],['hourly',0,1e6]]) {
      if (!Number.isFinite(result[name])||result[name]<min||result[name]>max) throw new Error('Bitte gültige Richtwerte eingeben.');
    }
    if(typeof result.name!=='string'||typeof result.type!=='string') throw new Error('Geschäftsname und Sortiment müssen Text sein.');
    result.hours=(to-from)/60;
    return result;
  }
  function read() { const raw=localStorage.getItem(KEY); return validate(raw===null?{}:JSON.parse(raw)); }
  function save(next) { const data=validate({...read(),...next});localStorage.setItem(KEY,JSON.stringify(data));return data; }
  window.LadenflussStoreSettings={KEY,defaults,read,save,validate};
})();
