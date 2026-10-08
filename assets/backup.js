(function () {
  'use strict';
  // Explicit allowlist: never include credentials or unrelated application data.
  const keys=['ladenfluss.store.v1','ladenfluss.history.v1','ladenfluss.team.v1',
    'ladenfluss.pep.weeks.v2','ladenfluss.pep.shifts.v1','ladenfluss.pep.plan-status.v1',
    'ladenfluss.pep.absences.v1','ladenfluss.urlaubsplaner.v1','ladenfluss.zahlenfluss.v1','ladenfluss.warenfluss.v1'];
  function capture(storage=localStorage,now=new Date()) {
    const records={};
    for(const key of keys){const raw=storage.getItem(key);if(raw!==null)records[key]=raw;}
    return {format:'ladenfluss-local-backup',version:1,createdAt:now.toISOString(),records};
  }
  function download() {
    const snapshot=capture();
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='ladenfluss-sicherung-'+snapshot.createdAt.slice(0,10)+'.json';
    document.body.append(link);
    try { link.click(); } finally { link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
    return Object.keys(snapshot.records).length;
  }
  window.LadenflussBackup={capture,download};
})();
