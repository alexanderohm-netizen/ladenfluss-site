
const $ = (s, scope=document) => scope.querySelector(s);
const $$ = (s, scope=document) => [...scope.querySelectorAll(s)];

function euro(n){ return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number.isFinite(n)?n:0); }
function de(n,d=1){ return new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(Number.isFinite(n)?n:0); }
function pct(n){ return `${de(n,1)} %`; }
function val(id){ return Number(document.getElementById(id)?.value || 0); }
function error(id,text=''){ const el=document.getElementById(id); if(el) el.textContent=text; }

async function copyResult(el,button){
  const rows=[...el.querySelectorAll('.metric,.kpi')].map(row=>{
    const label=row.querySelector('span,small')?.textContent?.trim()||'';
    const value=row.querySelector('strong,b')?.textContent?.trim()||'';
    return label&&value?`${label}: ${value}`:'';
  }).filter(Boolean);
  if(!rows.length) return;
  try{
    await navigator.clipboard.writeText(rows.join('\n'));
    const old=button.textContent; button.textContent='Kopiert'; setTimeout(()=>button.textContent=old,1400);
  }catch{ button.textContent='Kopieren nicht möglich'; }
}
function addResultMeta(el,insight=''){
  let toolbar=el.nextElementSibling;
  if(!toolbar || !toolbar.classList.contains('result-toolbar')){
    toolbar=document.createElement('div'); toolbar.className='result-toolbar';
    const button=document.createElement('button'); button.type='button'; button.className='result-copy'; button.textContent='Ergebnis kopieren';
    button.addEventListener('click',()=>copyResult(el,button)); toolbar.append(button);
    el.insertAdjacentElement('afterend',toolbar);
  }
  let info=toolbar.nextElementSibling;
  if(!info || !info.classList.contains('result-insight')){
    info=document.createElement('div'); info.className='result-insight'; toolbar.insertAdjacentElement('afterend',info);
  }
  info.innerHTML=insight; info.hidden=!insight;
}
function renderRows(id,rows,insight=''){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML=rows.map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
  el.hidden=false; addResultMeta(el,insight);
}


const LF_STORE_KEY='ladenfluss.store.v1', LF_HISTORY_KEY='ladenfluss.history.v1';
function lfStore(){ try{return JSON.parse(localStorage.getItem(LF_STORE_KEY)||'{}')}catch{return{}} }
function lfSetIf(id,value){ const el=document.getElementById(id); if(el&&value!==undefined&&value!==null&&value!=='') el.value=value; }
function lfApplyStoreDefaults(){ const s=lfStore(); if(!Object.keys(s).length)return;
  lfSetIf('p_productivity',s.productivity); lfSetIf('p_open',s.hours); lfSetIf('p_buffer',s.buffer);
  lfSetIf('m_margin',s.margin); lfSetIf('b_buffer',s.buffer); lfSetIf('st_lead',s.lead);
  lfSetIf('lb_ratio',s.labor); lfSetIf('lb_hourly',s.hourly); lfSetIf('lb_days',s.days?Math.round(s.days*4.33):undefined);
  const calc=document.querySelector('.calculator'); if(calc&&!document.querySelector('.store-default-note')){const n=document.createElement('div');n.className='store-default-note';n.innerHTML='<strong>Mein Laden aktiv</strong><span>Gespeicherte Zielwerte wurden für diesen Rechner übernommen.</span><a href="/mein-laden">Werte ändern</a>';calc.prepend(n);}
}
function lfSaveHistory(tool,summary,data){ try{const h=JSON.parse(localStorage.getItem(LF_HISTORY_KEY)||'[]');h.unshift({id:Date.now(),tool,summary,data,at:new Date().toISOString()});localStorage.setItem(LF_HISTORY_KEY,JSON.stringify(h.slice(0,12)));}catch{} }

const menuBtn=$('.menu-toggle'), mobileNav=$('.mobile-nav');
if(menuBtn&&mobileNav) menuBtn.addEventListener('click',()=>{ const o=mobileNav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded',String(o)); });

$$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  const f=btn.dataset.filter; $$('.tool-card').forEach(card=>card.hidden=f!=='all'&&card.dataset.category!==f);
}));

function calcPersonnel(save=true){
  error('p_error');
  const revenue=val('p_revenue'), productivity=val('p_productivity'), open=val('p_open'), extra=val('p_extra'), minStaff=val('p_min')||1, breakMin=val('p_break'), buffer=val('p_buffer');
  if(revenue<0||productivity<=0||open<=0||extra<0||minStaff<1||breakMin<0||buffer<0||buffer>100){ error('p_error','Bitte prüfe deine Eingaben. Stundenleistung und Öffnungsdauer müssen größer als 0 sein.'); return; }
  const salesHours=revenue/productivity, extraHours=(extra+breakMin)/60, base=salesHours+extraHours, minimumHours=open*minStaff, total=Math.max(base,minimumHours)*(1+buffer/100), concurrent=total/open;
  if(save) lfSaveHistory('Personalbedarf',de(total)+' h Personalbedarf',{revenue,total,productivity});
  renderRows('p_result',[
    ['Meine Empfehlung',`${de(total)} Personalstunden`],['Im Schnitt gleichzeitig',`${de(concurrent)} Personen`],
    ['Davon für den geplanten Umsatz',`${de(salesHours)} h`],['Für Zusatzaufgaben & Pausen',`${de(extraHours)} h`],['Minimum durch deine Besetzung',`${de(minimumHours)} h`]
  ],`<strong>Dein nächster Schritt:</strong> Plane zunächst mit rund ${de(total)} Stunden. Prüfe danach nur noch, wann deine Stoßzeiten liegen und welche Qualifikationen du zu diesen Zeiten brauchst.`);
}
function calcMargin(save=true){
  error('m_error');
  const cost=val('m_cost'), margin=val('m_margin'), vat=val('m_vat'), waste=val('m_waste'); const rounding=document.getElementById('m_round')?.value||'none';
  if(cost<0||margin<0||margin>=100||vat<0||waste<0||waste>=100){ error('m_error','Bitte gültige Werte eingeben. Die Ziel-Handelsspanne muss unter 100 % liegen.'); return; }
  const effectiveCost=cost*(1+waste/100), net=effectiveCost/(1-margin/100); let gross=net*(1+vat/100); if(rounding!=='none'){ const cents=Number(rounding)/100; gross=Math.floor(gross)+cents; if(gross+1e-9<net*(1+vat/100)) gross+=1; } const roundedNet=gross/(1+vat/100), profit=roundedNet-effectiveCost, markup=effectiveCost>0?profit/effectiveCost*100:0, actualMargin=roundedNet>0?profit/roundedNet*100:0;
  if(save) lfSaveHistory('Marge & Verkaufspreis',euro(gross)+' Brutto-VK',{cost,gross,actualMargin});
  renderRows('m_result',[
    ['Preisvorschlag für deine Kunden',euro(gross)],['Davon bleiben vor weiteren Kosten',euro(profit)],['Preis ohne Umsatzsteuer',euro(roundedNet)],['Anteil, der nach dem Einkauf bleibt',pct(actualMargin)],['Aufschlag auf deinen Einkaufspreis',pct(markup)]
  ],`<strong>Dein nächster Schritt:</strong> Prüfe, ob ${euro(gross)} zu Markt, Kundschaft und Preisbild passt. Die Detailwerte darunter erklären dir, wie der Vorschlag zustande kommt.`);
}
function calcDiscount(){
  error('d_error');
  const gross=val('d_price'), cost=val('d_cost'), discount=val('d_discount'), vat=val('d_vat');
  if(gross<0||cost<0||discount<0||discount>100||vat<0){ error('d_error','Bitte gültige Werte eingeben. Der Rabatt muss zwischen 0 und 100 % liegen.'); return; }
  const newGross=gross*(1-discount/100), oldNet=gross/(1+vat/100), newNet=newGross/(1+vat/100), oldProfit=oldNet-cost, newProfit=newNet-cost, margin=newNet?newProfit/newNet*100:0, loss=oldProfit-newProfit;
  renderRows('d_result',[
    ['Neuer Preis für deine Kunden',euro(newGross)],['Dir bleiben nach dem Wareneinkauf',euro(newProfit)],['So viel kostet dich der Rabatt je Stück',euro(loss)],
    ['Anteil, der dir danach bleibt',pct(margin)],['Preis ohne Umsatzsteuer',euro(newNet)]
  ],newProfit<0?`<strong>Achtung:</strong> Mit diesem Rabatt verkaufst du rechnerisch unter deinem Einkaufspreis. Ändere Rabatt oder Verkaufspreis, bevor du die Aktion startest.`:`<strong>Dein nächster Schritt:</strong> Nach dem Rabatt bleiben ${euro(newProfit)} je Stück vor weiteren Kosten. Entscheide, ob dir das für die Aktion reicht.`);
}
function calcBreakEven(save=true){
  error('b_error');
  const fixed=val('b_fixed'), rate=val('b_rate'), days=val('b_days'), targetProfit=val('b_profit'), buffer=val('b_buffer');
  if(fixed<0||rate<=0||rate>100||days<=0||targetProfit<0||buffer<0||buffer>100){ error('b_error','Bitte gültige Werte eingeben.'); return; }
  const baseMonthly=fixed/(rate/100), targetMonthly=(fixed+targetProfit)/(rate/100), monthly=targetMonthly*(1+buffer/100), daily=monthly/days;
  if(save) lfSaveHistory('Break-even',euro(monthly)+' Zielumsatz',{fixed,monthly,daily});
  renderRows('b_result',[
    ['Das solltest du pro Öffnungstag erreichen',euro(daily)],['Dein Ziel für den Monat',euro(monthly)],['Nur um die laufenden Kosten zu decken',euro(baseMonthly)],['Laufende Kosten in deiner Rechnung',euro(fixed)]
  ],`<strong>Dein nächster Schritt:</strong> Nutze ${euro(daily)} als einfache Tagesmarke. Liegt dein Umsatz öfter darunter, lohnt sich ein Blick auf Kosten, Preise und Warenmix.`);
}
function calcKpi(){
  error('k_error');
  const revenue=val('k_revenue'), hours=val('k_hours'), labor=val('k_labor'), tx=val('k_tx'), visitors=val('k_visitors'), waste=val('k_waste');
  if([revenue,hours,labor,tx,visitors,waste].some(n=>n<0)){ error('k_error','Bitte keine negativen Werte eingeben.'); return; }
  const values=[
    ['Stundenleistung',hours?`${euro(revenue/hours)}/h`:'–'],['Ø Bon',tx?euro(revenue/tx):'–'],['Conversion',visitors?pct(tx/visitors*100):'–'],
    ['Personalkostenquote',revenue?pct(labor/revenue*100):'–'],['Abschriftenquote',revenue?pct(waste/revenue*100):'–'],['Umsatz je Besucher',visitors?euro(revenue/visitors):'–']
  ];
  const el=document.getElementById('k_result'); if(!el) return;
  el.innerHTML=values.map(([label,value])=>`<div class="kpi"><small>${label}</small><strong>${value}</strong></div>`).join('');
  el.hidden=false; addResultMeta(el,'<strong>Einordnung:</strong> Einzelne KPIs sind selten allein aussagekräftig. Vergleiche sie mit Zielwert, Vorperiode und Vorjahr – genau daraus soll später Zahlenfluss entstehen.');
}
function calcLaborBudget(){
  error('lb_error');
  const revenue=val('lb_revenue'), ratio=val('lb_ratio'), hourly=val('lb_hourly'), days=val('lb_days');
  if(revenue<0||ratio<=0||ratio>100||hourly<=0||days<=0){ error('lb_error','Bitte gültige Werte eingeben.'); return; }
  const budget=revenue*ratio/100, hours=budget/hourly, perDay=hours/days, productivity=hours?revenue/hours:0;
  renderRows('lb_result',[
    ['Dieses Budget hast du für dein Team',euro(budget)],['Damit kannst du ungefähr planen',`${de(hours)} Stunden`],['Im Schnitt pro Öffnungstag',`${de(perDay)} Stunden`],['Dafür brauchst du je Arbeitsstunde',`${euro(productivity)} Umsatz`]
  ],`<strong>Dein nächster Schritt:</strong> Verteile die rund ${de(hours)} Stunden zuerst auf Öffnung, Mindestbesetzung und Stoßzeiten. Danach planst du Aufgaben wie Lieferung und Warenpflege ein.`);
}
function calcGrossProfit(){
  error('gp_error');
  const revenue=val('gp_revenue'), cogs=val('gp_cogs');
  if(revenue<=0||cogs<0){ error('gp_error','Umsatz muss größer als 0 sein; Wareneinsatz darf nicht negativ sein.'); return; }
  const grossProfit=revenue-cogs, margin=grossProfit/revenue*100, cogsRatio=cogs/revenue*100, factor=cogs>0?revenue/cogs:0;
  renderRows('gp_result',[
    ['Das bleibt nach dem Wareneinkauf',euro(grossProfit)],['Anteil, der übrig bleibt',pct(margin)],['Anteil deines Umsatzes für Ware',pct(cogsRatio)],['Umsatz je 1 € Warenkosten',factor?`${de(factor,2)} €`:'–']
  ],grossProfit<0?'<strong>Achtung:</strong> Deine Warenkosten liegen über deinem Umsatz. Prüfe Zeitraum und Eingaben.':`<strong>Dein nächster Schritt:</strong> Von ${euro(revenue)} Umsatz bleiben ${euro(grossProfit)} für Personal, Miete und alle weiteren Kosten. Vergleiche diesen Wert regelmäßig mit früheren Zeiträumen.`);
}
function calcStockTurn(save=true){
  error('st_error');
  const cogs=val('st_cogs'), avgStock=val('st_stock'), period=val('st_period'), lead=val('st_lead'), safety=val('st_safety');
  if(cogs<0||avgStock<=0||period<=0||lead<0||safety<0){ error('st_error','Durchschnittsbestand und Zeitraum müssen größer als 0 sein.'); return; }
  const turns=cogs/avgStock, days=turns?period/turns:0, avgDaily=cogs/period, coverage=avgDaily?avgStock/avgDaily:0, reorderNeed=avgDaily*lead+safety, coverageGap=coverage-lead;
  if(save) lfSaveHistory('Lagerumschlag',de(coverage)+' Tage Reichweite',{cogs,avgStock,coverage,coverageGap});
  renderRows('st_result',[
    ['Dein Bestand reicht rechnerisch',`${de(coverage)} Tage`],['Nach der Lieferzeit bleiben',`${de(coverageGap)} Tage`],['Warenwert pro Tag',euro(avgDaily)],['Bedarf bis zur nächsten Lieferung inkl. Reserve',euro(reorderNeed)],['So oft bewegt sich dein Bestand im Zeitraum',`${de(turns,2)} ×`]
  ],coverageGap<0?`<strong>Handlungsbedarf:</strong> Dein Bestand reicht rechnerisch nicht bis zur nächsten Lieferung. Prüfe jetzt Nachbestellung, Liefertermin und Reserve.`:`<strong>Dein nächster Schritt:</strong> Nach der Lieferzeit bleiben rechnerisch ${de(coverageGap)} Tage Reserve. Beobachte besonders Artikel, die deutlich schneller laufen als dieser Durchschnitt.`);
}

Object.assign(window,{calcPersonnel,calcMargin,calcDiscount,calcBreakEven,calcKpi,calcLaborBudget,calcGrossProfit,calcStockTurn});
document.addEventListener('DOMContentLoaded',()=>{
  lfApplyStoreDefaults();
  if($('#p_result')) calcPersonnel(false); if($('#m_result')) calcMargin(false); if($('#d_result')) calcDiscount(); if($('#b_result')) calcBreakEven(false);
  if($('#k_result')) calcKpi(); if($('#lb_result')) calcLaborBudget(); if($('#gp_result')) calcGrossProfit(); if($('#st_result')) calcStockTurn(false);
});
