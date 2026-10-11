/* Structured role descriptions for the independent merchant's local job catalog.
 * Position profiles are not published vacancies and carry no applicant data.
 * Stored separately from PEP/team data to keep employee IDs and shifts stable.
 */
(function(root){
  'use strict';
  const KEY='ladenfluss.positions.v1';
  const examples=[
    ['Verkauf','Verkauf & Beratung','Kunden betreuen und den Verkaufsraum organisieren.',
      ['Kunden beraten und passende Produkte anbieten','Ware einräumen und ansprechend präsentieren','Preisauszeichnung und Bestand prüfen'],
      ['Freundlicher Umgang mit Kunden','Sorgfältige Warenkenntnis','Team- und Serviceorientierung']],
    ['Aushilfe','Verkauf & Beratung','Das Team flexibel in Verkauf und Warenpflege unterstützen.',
      ['Bei Kundenanfragen helfen','Warenannahme und Regalpflege unterstützen','Verkaufsfläche ordentlich halten'],
      ['Zuverlässigkeit und Pünktlichkeit','Bereitschaft zur Einarbeitung','Teamfähigkeit']],
    ['Kasse','Kasse & Service','Kassenabläufe sicher und kundenfreundlich begleiten.',
      ['Kassieren und Belege bearbeiten','Kassenbereich vorbereiten und abschließen','Rückfragen und Reklamationen freundlich aufnehmen'],
      ['Sorgfalt im Umgang mit Zahlungsmitteln','Freundliche Kommunikation','Gewissenhaftes Arbeiten']],
    ['Schichtleitung','Führung & Organisation','Den Tagesablauf einer Schicht koordinieren.',
      ['Mitarbeitende in der Schicht einteilen','Verkaufsfläche und Prioritäten steuern','Anliegen eskalieren und Schichtübergabe dokumentieren'],
      ['Organisationsvermögen','Verantwortungsbewusstsein','Klare Kommunikation']],
    ['Stellvertretende Filialleitung','Führung & Organisation','Die Filialleitung bei Team, Planung und Kennzahlen unterstützen.',
      ['Schichten und Aufgaben koordinieren','Warendisposition und Warenpräsentation begleiten','Abläufe und Kennzahlen nachvollziehbar prüfen'],
      ['Erfahrung im Einzelhandel','Strukturiertes Arbeiten','Verantwortung in der Teamführung']],
    ['Filialleitung','Führung & Organisation','Den Laden operativ führen und das Team entwickeln.',
      ['Personaleinsatz und Abläufe planen','Warenbestand, Kosten und Ziele steuern','Mitarbeitende einarbeiten und entwickeln'],
      ['Führung und Zusammenarbeit','Kaufmännisches Verständnis','Verantwortungsvolle Entscheidungen']],
    ['Lager','Waren & Logistik','Warenbewegungen und Lagerorganisation sicherstellen.',
      ['Lieferungen kontrollieren und einlagern','Bestandsdifferenzen dokumentieren','Waren für die Fläche bereitstellen'],
      ['Sorgfalt und Ordnung','Sicheres Arbeiten','Belastbarkeit im Lageralltag']],
    ['Service','Service & Kundenkontakt','Anliegen von Kunden aufnehmen und Lösungen unterstützen.',
      ['Serviceanfragen beantworten','Reklamationen strukturiert aufnehmen','Abstimmung mit dem Verkaufsbereich'],
      ['Kommunikationsfähigkeit','Geduld und Lösungsorientierung','Verlässliche Dokumentation']],
    ['Küche','Produktion & Service','Zubereitung und Küchenabläufe organisieren.',
      ['Vorbereitung und Ausgabe unterstützen','Arbeitsbereiche hygienisch halten','Bestände und Bedarf melden'],
      ['Hygienebewusstsein','Teamfähigkeit','Strukturierte Abläufe']],
    ['Ausbildung','Ausbildung & Entwicklung','Neue Mitarbeitende im Ausbildungsalltag unterstützen.',
      ['Lernaufgaben in der Praxis übernehmen','Kundenkontakt und Warenabläufe üben','Ausbildungsfortschritt mit Ausbildenden besprechen'],
      ['Lernbereitschaft','Zuverlässigkeit','Offener Umgang mit Feedback']]
  ];
  function idFor(name){return 'builtin-'+name.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,45);}
  const templates=examples.map(([title,department,summary,tasks,requirements])=>({
    id:idFor(title),title,department,summary,tasks,requirements,
    responsibility:['Schichtleitung','Stellvertretende Filialleitung','Filialleitung'].includes(title)
      ? 'Koordination & Verantwortung' : 'Operativer Einsatz'
  }));
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function validate(p){
    if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Ungültiges Stellenprofil.');
    const required=(key,max)=>{
      const x=p[key];
      if(typeof x!=='string'||x.trim().length<1||x.trim().length>max)
        throw new Error('Bitte alle Pflichtfelder des Stellenprofils prüfen.');
      return x.trim();
    };
    const list=key=>{
      if(!Array.isArray(p[key])||p[key].length>10||p[key].some(x=>typeof x!=='string'||x.trim().length<3||x.trim().length>180))
        throw new Error('Bitte Aufgaben und Anforderungen mit jeweils höchstens zehn Zeilen angeben.');
      return p[key].map(x=>x.trim());
    };
    return {id:required('id',100),title:required('title',70),department:required('department',70),
      summary:required('summary',400),responsibility:required('responsibility',100),
      tasks:list('tasks'),requirements:list('requirements')};
  }
  function read(){
    let raw;
    try{raw=localStorage.getItem(KEY);}catch{throw new Error('Stellenprofile sind im Browser nicht erreichbar.');}
    if(raw===null)return clone(templates);
    let data;
    try{data=JSON.parse(raw);}catch{throw new Error('Stellenprofile sind beschädigt und wurden nicht überschrieben.');}
    if(!data||data.version!==1||!Array.isArray(data.profiles)||data.profiles.length>100)
      throw new Error('Stellenprofile sind beschädigt und wurden nicht überschrieben.');
    const profiles=data.profiles.map(validate);
    if(new Set(profiles.map(p=>p.id)).size!==profiles.length||
      new Set(profiles.map(p=>p.title.toLocaleLowerCase('de'))).size!==profiles.length)
      throw new Error('Stellenprofile enthalten doppelte IDs oder Bezeichnungen.');
    for(const template of templates){
      const stored=profiles.find(x=>x.id===template.id);
      if(!stored||stored.title!==template.title)
        throw new Error('Eine fest zugeordnete Stellenbezeichnung wurde geändert. Daten nicht überschrieben.');
    }
    return profiles;
  }
  function save(list){
    if(!Array.isArray(list)||list.length>100||list.length<templates.length)
      throw new Error('Zu viele oder unvollständige Stellenprofile.');
    const profiles=list.map(validate);
    if(new Set(profiles.map(p=>p.id)).size!==profiles.length||
       new Set(profiles.map(p=>p.title.toLocaleLowerCase('de'))).size!==profiles.length)
       throw new Error('Stellenbezeichnungen müssen eindeutig sein.');
    for(const t of templates){
      const old=profiles.find(p=>p.id===t.id);
      if(!old||old.title!==t.title)throw new Error('Standard-Stellenbezeichnungen dürfen nicht verändert werden.');
    }
    try{localStorage.setItem(KEY,JSON.stringify({version:1,profiles}));}
    catch{throw new Error('Stellenprofile konnten nicht gespeichert werden. Vorhandene Daten wurden nicht geändert.');}
    return profiles;
  }
  function byTitle(title,items){
    return (items||read()).find(p=>p.title.toLocaleLowerCase('de')===String(title||'').toLocaleLowerCase('de'))||null;
  }
  function createProfile(data,items=read()){
    if(!Array.isArray(items))throw new Error('Stellenprofile sind nicht lesbar.');
    const uuid=root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const next=validate({...data,id:data.id||('custom-'+uuid)});
    if(byTitle(next.title,items))throw new Error('Diese Stellenbezeichnung existiert bereits.');
    return save([...items,next]);
  }
  function updateProfile(id,data,items=read()){
    const original=items.find(p=>p.id===id);
    if(!original)throw new Error('Das Stellenprofil wurde nicht gefunden.');
    const next=validate({...original,...data,id,title:original.title});
    return save(items.map(p=>p.id===id?next:p));
  }
  root.LadenflussJobProfiles=Object.freeze({
    key:KEY,templates:()=>clone(templates),read,save,byTitle,createProfile,updateProfile
  });
})(window);