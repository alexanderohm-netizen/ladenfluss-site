(function () {
  'use strict';
  function current() {
    try {
      const store=window.LadenflussTeamStore, week=store.mondayKey(), team=store.getTeam();
      const shop=window.LadenflussStoreSettings.read();
      let vacations=[], warning=[];
      try { vacations=window.LadenflussVacation.read().entries; }
      catch { warning=[{id:'unreadable-vacations',module:'Personal',priority:'critical',title:'Urlaubsplan prüfen',
        message:'Gespeicherte Urlaubsdaten konnten nicht gelesen werden.',impact:'Die Besetzungsprüfung ist unvollständig.',
        action:'Urlaubsplan öffnen',href:'/tools/urlaubsplaner'}]; }
      const result=window.LadenflussPlanning.analyze({week,team,shifts:store.getShifts(week),absences:store.getAbsences(week),vacations,shop,holiday:window.LadenflussHolidays.getHoliday});
      const today=window.LadenflussPlanning.iso(new Date());
      return window.LadenflussSignals.sort(warning.concat(result.signals.filter(s=>!s.date||s.date>=today)));
    } catch (error) {
      return window.LadenflussSignals.sort([{id:'planning-data-error',module:'Personal',priority:'critical',
        title:'Planungsgrundlage prüfen',message:error.message,impact:'Aktuell keine verlässliche Besetzungsbewertung möglich.',
        action:'Profil und Dienstplan prüfen',href:'/mein-laden#profile'}]);
    }
  }
  window.LadenflussPepSignals={current};
})();
