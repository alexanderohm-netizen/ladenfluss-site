(function () {
  'use strict';
  const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  const number = (n, digits = 1) => n.toLocaleString('de-DE', {maximumFractionDigits: digits});
  const time = n => String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
  const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function minutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [h,m] = value.split(':').map(Number); return h*60+m;
  }
  function shiftHours(shift) {
    if (!shift) return 0;
    const start=minutes(shift[0]), end=minutes(shift[1]), pause=Number(shift[2]);
    return start !== null && end !== null && end > start && Number.isFinite(pause) && pause >= 0 && pause < end-start
      ? (end-start-pause)/60 : 0;
  }
  function analyze({week, team, shifts, absences, vacations = [], shop, holiday = () => null}) {
    const monday = new Date(week+'T12:00:00');
    if (!Number.isFinite(monday.getTime()) || iso(monday)!==week || monday.getDay()!==1) throw new Error('Ungültige Planungswoche.');
    const open=minutes(shop.open), close=minutes(shop.close), need=Number(shop.minStaff), workingDays=Number(shop.days);
    if (open===null || close===null || close<=open || !Number.isInteger(need) || need<1 || need>100 ||
        !Number.isInteger(workingDays) || workingDays<1 || workingDays>7) throw new Error('Öffnungszeiten und Mindestbesetzung prüfen.');
    const signals=[], daily=[], totals=new Map(team.map(p=>[p.id,{planned:0,available:0,away:false}]));
    const link='/pep?week='+encodeURIComponent(week);
    const add = signal => signals.push({module:'Personal',source:'Dienstplan '+week,href:link,action:'Dienstplan prüfen',...signal});
    for (let day=0;day<7;day++) {
      const date=new Date(monday);date.setDate(date.getDate()+day);
      const key=iso(date), holidayName=holiday(date,shop.state), closed=day>=workingDays || !!holidayName;
      const present=[];
      let pauseMinutes=0;
      for (const person of team) {
        const shift=shifts[person.id]?.[day];
        const leave=absences[person.id]?.[day] || (vacations.some(e=>e.status==='approved' && e.employeeId===person.id && e.start<=key && e.end>=key) ? 'Urlaub' : null);
        const total=totals.get(person.id);
        if (leave && !closed) total.away=true;
        if (!shift) continue;
        const duration=shiftHours(shift);
        if (!duration) {
          add({id:'invalid-shift:'+person.id+':'+key,date:key,priority:'critical',title:'Schichtdaten prüfen',message:person.name+' · '+days[day]+': ungültige Zeiten oder Pause.',impact:'Besetzung für diese Schicht nicht berechenbar.'});
          continue;
        }
        total.planned+=duration;
        if (leave) {
          add({id:'absence-conflict:'+person.id+':'+key,date:key,priority:'critical',title:'Planungskonflikt',
            message:person.name+' ist am '+days[day]+' '+leave+' und gleichzeitig '+shift[0]+'–'+shift[1]+' eingeplant.',
            impact:number(duration)+' geplante Stunden stehen nicht zur Verfügung.',action:'Schicht oder Abwesenheit klären',
            evidence:['Schicht: '+shift[0]+'–'+shift[1], 'Abwesenheit: '+leave]});
        } else {
          total.available+=duration;
          present.push({start:minutes(shift[0]),end:minutes(shift[1])});
          if (!closed) pauseMinutes+=Number(shift[2]);
        }
      }
      const gaps=[];
      let missingMinutes=0, minPresent=null;
      if (!closed) {
        // Every shift boundary matters, including a five-minute gap between shifts.
        const boundaries=[...new Set([open,close,...present.flatMap(s=>[s.start,s.end]).filter(t=>t>open&&t<close)])].sort((a,b)=>a-b);
        for (let i=0;i<boundaries.length-1;i++) {
          const from=boundaries[i],to=boundaries[i+1];
          const count=present.filter(s=>s.start<=from&&s.end>=to).length;
          minPresent=minPresent===null ? count : Math.min(minPresent,count);
          if (count>=need) continue;
          missingMinutes+=(need-count)*(to-from);
          const last=gaps[gaps.length-1];
          if (last && last.to===from && last.count===count) last.to=to;
          else gaps.push({from,to,count,missing:need-count});
        }
        if (gaps.length) add({id:'coverage:'+key,date:key,priority:'critical',title:'Unterbesetzung · '+days[day],
          message:gaps.map(g=>time(g.from)+'–'+time(g.to)+': '+g.count+' von '+need+' Personen').join('; '),
          impact:number(missingMinutes/60)+' Personalstunden fehlen während der Öffnung.',
          action:'Besetzung ergänzen',evidence:['Öffnung: '+shop.open+'–'+shop.close,'Mindestbesetzung: '+need,'Abwesenheiten ausgeschlossen; Pausenlage noch offen.'],missingStaffMinutes:missingMinutes});
      }
      daily.push({day,date:key,name:days[day],closed,holiday:holidayName || null,gaps,missingMinutes,minPresent,need,pauseMinutes,headcount:present.length});
    }
    let plannedHours=0,availableHours=0;
    for (const person of team) {
      const total=totals.get(person.id),target=Number(person.hours);
      plannedHours+=total.planned; availableHours+=total.available;
      if (!Number.isFinite(target) || target<0) continue;
      if (total.planned>target+5) add({id:'hours-high:'+week+':'+person.id,priority:'important',title:'Sollstunden überschritten',
        message:person.name+': '+number(total.planned)+' h geplant bei '+number(target)+' h Soll.',
        impact:number(total.planned-target)+' h über dem hinterlegten Wochenziel.',action:'Wochenstunden prüfen'});
      else if (!total.away && total.planned<Math.max(0,target-8)) add({id:'hours-low:'+week+':'+person.id,priority:'info',title:'Weniger Stunden geplant',
        message:person.name+': '+number(total.planned)+' h geplant bei '+number(target)+' h Soll.',
        impact:number(target-total.planned)+' h bis zum hinterlegten Wochenziel.',action:'Wochenplanung prüfen'});
    }
    const pauseMinutes=daily.reduce((sum,d)=>sum+d.pauseMinutes,0);
    if (pauseMinutes) add({id:'break-placement:'+week,priority:'info',title:'Pausenvertretung noch prüfen',
      message:number(pauseMinutes)+' Minuten Pause sind erfasst, ihre Uhrzeiten noch nicht.',
      impact:'Der Besetzungscheck zählt Schichtanwesenheit und kann Pausenlücken noch nicht erkennen.',action:'Pausen abstimmen'});
    return {signals:window.LadenflussSignals.sort(signals),days:daily,plannedHours,availableHours,
      missingStaffMinutes:daily.reduce((sum,d)=>sum+d.missingMinutes,0),pauseMinutes};
  }
  window.LadenflussPlanning={analyze,minutes,shiftHours,iso};
})();
