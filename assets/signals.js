(function(){
  const rank={critical:0,important:1,info:2};
  function normalize(issue){
    return {
      id:issue.id||[issue.module||'system',issue.type||'notice',issue.subject||''].join(':'),
      module:issue.module||'System',
      priority:issue.priority||'info',
      title:issue.title||'Hinweis prüfen',
      message:issue.message||'',
      action:issue.action||'Prüfen',
      impact:issue.impact||'',
      status:issue.status||'new'
    };
  }
  function sort(items){return items.map(normalize).sort((a,b)=>(rank[a.priority]??9)-(rank[b.priority]??9));}
  function top(items){return sort(items)[0]||null;}
  function counts(items){return sort(items).reduce((a,x)=>{a[x.priority]=(a[x.priority]||0)+1;return a},{critical:0,important:0,info:0});}
  window.LadenflussSignals={sort,top,counts};
})();