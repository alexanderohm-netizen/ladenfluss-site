/* PEP compact keyboard entry. No HTML injection; data is validated and formatted
 * before it reaches the existing per-week team store. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LadenflussPepInput=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const pad=n=>String(n).padStart(2,'0');
  const minutes=(h,m)=>h*60+m;
  function parse(raw){
    const text=String(raw??'').trim();
    if(!text)return {type:'noop'};
    const word=text.toLocaleLowerCase('de-DE');
    if(['-','löschen','loeschen','entfernen'].includes(word))return {type:'clear'};
    const absences={
      'frei':'Frei','f':'Frei','urlaub':'Urlaub','u':'Urlaub',
      'krank':'Krank','k':'Krank','schule':'Schule / Seminar',
      'seminar':'Schule / Seminar','sonstige':'Sonstige Abwesenheit'
    };
    if(Object.hasOwn(absences,word))return {type:'absence',reason:absences[word]};
    const match=/^(\d{1,2})(?::([0-5]\d))?\s*(?:-|–|—|bis|\s+)\s*(\d{1,2})(?::([0-5]\d))?\s*(?:(?:\/|p|pause:?|\s+)\s*(\d{1,3}))?$/i.exec(text);
    if(!match)throw new Error('Eingabe z. B. 9-17/30, Frei, Urlaub, Krank oder - zum Löschen.');
    const sh=Number(match[1]),sm=Number(match[2]||0);
    const eh=Number(match[3]),em=Number(match[4]||0);
    if(sh>23||eh>23)throw new Error('Uhrzeit zwischen 00:00 und 23:59 eingeben.');
    const duration=minutes(eh,em)-minutes(sh,sm);
    if(duration<=0)throw new Error('Schichtende muss nach dem Schichtbeginn liegen.');
    const required=duration>540?45:duration>360?30:0;
    const pause=match[5]===undefined?required:Number(match[5]);
    if(!Number.isInteger(pause)||pause<0||pause>=duration)
      throw new Error('Pausendauer ist ungültig.');
    if(pause<required)
      throw new Error('Bei dieser Schicht sind mindestens '+required+' Minuten Pause erforderlich.');
    return {type:'shift',shift:[pad(sh)+':'+pad(sm),pad(eh)+':'+pad(em),pause]};
  }
  function format(shift){
    if(!shift)return '';
    return String(shift[0])+'-'+String(shift[1])+'/'+String(shift[2]);
  }
  return Object.freeze({parse,format});
});
