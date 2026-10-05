(function(){
  const STATES={
    BW:'Baden-Württemberg',BY:'Bayern',BE:'Berlin',BB:'Brandenburg',HB:'Bremen',HH:'Hamburg',
    HE:'Hessen',MV:'Mecklenburg-Vorpommern',NI:'Niedersachsen',NW:'Nordrhein-Westfalen',
    RP:'Rheinland-Pfalz',SL:'Saarland',SN:'Sachsen',ST:'Sachsen-Anhalt',SH:'Schleswig-Holstein',TH:'Thüringen'
  };
  const add=(map,date,name,states=null)=>map[date]={name,states};
  const iso=d=>d.toISOString().slice(0,10);
  function easter(year){
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
    return new Date(Date.UTC(year,month-1,day,12));
  }
  function offset(date,days){const d=new Date(date);d.setUTCDate(d.getUTCDate()+days);return iso(d)}
  function holidays(year){
    const h={},e=easter(year);
    add(h,`${year}-01-01`,'Neujahr');
    add(h,`${year}-05-01`,'Tag der Arbeit');
    add(h,`${year}-10-03`,'Tag der Deutschen Einheit');
    add(h,`${year}-12-25`,'1. Weihnachtstag');
    add(h,`${year}-12-26`,'2. Weihnachtstag');
    add(h,offset(e,-2),'Karfreitag');add(h,offset(e,1),'Ostermontag');add(h,offset(e,39),'Christi Himmelfahrt');add(h,offset(e,50),'Pfingstmontag');
    add(h,`${year}-01-06`,'Heilige Drei Könige',['BW','BY','ST']);
    add(h,`${year}-03-08`,'Internationaler Frauentag',['BE','MV']);
    add(h,offset(e,60),'Fronleichnam',['BW','BY','HE','NW','RP','SL']);
    add(h,`${year}-08-15`,'Mariä Himmelfahrt',['SL']);
    add(h,`${year}-09-20`,'Weltkindertag',['TH']);
    add(h,`${year}-10-31`,'Reformationstag',['BB','HB','HH','MV','NI','SN','ST','SH','TH']);
    add(h,`${year}-11-01`,'Allerheiligen',['BW','BY','NW','RP','SL']);
    return h;
  }
  function getHoliday(date,state){
    const d=typeof date==='string'?new Date(date+'T12:00:00'):date;
    const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    const item=holidays(d.getFullYear())[key];
    if(!item)return null;
    if(item.states&&!item.states.includes(state))return null;
    return item.name;
  }
  window.LadenflussHolidays={STATES,getHoliday};
})();