(function () {
  'use strict';
  function fromHistory(history, now = new Date(), targets = {}) {
    const newest=new Map();
    for(const entry of history){
      if(!entry||typeof entry.tool!=='string'||!Number.isFinite(Date.parse(entry.at)))continue;
      const age=now.getTime()-Date.parse(entry.at);
      if(age<0||age>7*86400000)continue;
      if(!newest.has(entry.tool)||Date.parse(newest.get(entry.tool).at)<Date.parse(entry.at))newest.set(entry.tool,entry);
    }
    const out=[];
    for(const entry of newest.values()){
      const data=entry.data||{},asOf=new Date(entry.at).toLocaleDateString('de-DE');
      const base={id:'calculation:'+entry.tool,source:'Deine Berechnung vom '+asOf,module:'Zahlen',evidence:['Manuell eingegebene Kalkulation; keine laufenden Umsatz- oder Bestandsdaten.']};
      if(entry.tool==='Lagerumschlag'&&Number.isFinite(data.coverageGap)&&data.coverageGap<0&&data.cogs>0){
        out.push({...base,priority:'important',title:'Bestand reicht rechnerisch nicht bis zur Lieferung',
          message:'In deiner letzten Kalkulation fehlen '+Math.abs(data.coverageGap).toLocaleString('de-DE',{maximumFractionDigits:1})+' Tage Reichweite.',
          impact:'Prüfe, ob die Werte noch aktuell sind, bevor du nachbestellst.',action:'Bestandsrechnung öffnen',href:'/tools/lagerumschlag'});
      }
      if(entry.tool==='Marge & Verkaufspreis'&&data.gross>=0&&data.actualMargin>=0&&Number.isFinite(targets.margin)&&data.actualMargin<targets.margin-0.1){
        out.push({...base,priority:'info',title:'Handelsspanne unter deinem Richtwert',message:'Deine letzte Preiskalkulation lässt '+data.actualMargin.toLocaleString('de-DE',{maximumFractionDigits:1})+' % Handelsspanne.',
          impact:'Dein hinterlegter Richtwert liegt bei '+targets.margin.toLocaleString('de-DE')+' %. Prüfe die aktuelle Kalkulation.',action:'Kalkulation prüfen',href:'/tools/margenrechner'});
      }
    }
    return window.LadenflussSignals.sort(out);
  }
  window.LadenflussBusinessSignals={fromHistory};
})();
