(function () {
  'use strict';
  const rank={critical:0,important:1,info:2};
  function normalize(issue) {
    const priority=Object.hasOwn(rank,issue.priority) ? issue.priority : 'info';
    const href=typeof issue.href==='string' && /^\/(?!\/)[a-z0-9/?=&_%#.-]*$/i.test(issue.href) ? issue.href : '/mein-laden';
    return {
      id:String(issue.id || [issue.module||'system',issue.type||issue.title||'notice',issue.subject||issue.message||''].join(':')),
      module:issue.module||'System',priority,title:issue.title||'Hinweis prüfen',message:issue.message||'',
      href,action:issue.action||'Prüfen',impact:issue.impact||'',source:issue.source||'Lokale Angaben',
      date:issue.date||null,evidence:Array.isArray(issue.evidence)?issue.evidence:[],
      missingStaffMinutes:Number(issue.missingStaffMinutes)||0,
    };
  }
  function sort(items) {
    const unique=new Map();
    for (const item of items) { const signal=normalize(item); const old=unique.get(signal.id); if (!old || rank[signal.priority]<rank[old.priority]) unique.set(signal.id,signal); }
    return [...unique.values()].sort((a,b)=>rank[a.priority]-rank[b.priority] || (a.date||'9999').localeCompare(b.date||'9999') || a.id.localeCompare(b.id));
  }
  const counts=items=>sort(items).reduce((a,x)=>{a[x.priority]++;return a;},{critical:0,important:0,info:0});
  window.LadenflussSignals={sort,counts,top:items=>sort(items)[0]||null};
})();
