
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

const menuBtn=$('.menu-toggle'), mobileNav=$('.mobile-nav');
if(menuBtn&&mobileNav) menuBtn.addEventListener('click',()=>{ const o=mobileNav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded',String(o)); });

$$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  const f=btn.dataset.filter; $$('.tool-card').forEach(card=>card.hidden=f!=='all'&&card.dataset.category!==f);
}));

function calcPersonnel(){
  error('p_error');
  const revenue=val('p_revenue'), productivity=val('p_productivity'), open=val('p_open'), extra=val('p_extra'), minStaff=val('p_min')||1, breakMin=val('p_break'), buffer=val('p_buffer');
  if(revenue<0||productivity<=0||open<=0||extra<0||minStaff<1||breakMin<0||buffer<0){ error('p_error','Bitte prüfe deine Eingaben. Stundenleistung und Öffnungsdauer müssen größer als 0 sein.'); return; }
  const salesHours=revenue/productivity, extraHours=(extra+breakMin)/60, base=salesHours+extraHours, minimumHours=open*minStaff, total=Math.max(base,minimumHours)*(1+buffer/100), concurrent=total/open;
  renderRows('p_result',[
    ['Personalstunden für den Umsatz',`${de(salesHours)} h`],['Zusatzaufwand',`${de(extraHours)} h`],
    ['Mindestbesetzung erfordert',`${de(minimumHours)} h`],['Gesamter Orientierungsbedarf',`${de(total)} h`],['Ø gleichzeitige Besetzung',`${de(concurrent)} Personen`]
  ],`<strong>Einordnung:</strong> Bei diesen Annahmen ergeben sich rund ${de(total)} Personalstunden. Pausen, Mindestbesetzung, Qualifikation und Stoßzeiten solltest du zusätzlich einplanen.`);
}
function calcMargin(){
  error('m_error');
  const cost=val('m_cost'), margin=val('m_margin'), vat=val('m_vat'), waste=val('m_waste'); const rounding=document.getElementById('m_round')?.value||'none';
  if(cost<0||margin<0||margin>=100||vat<0){ error('m_error','Bitte gültige Werte eingeben. Die Ziel-Handelsspanne muss unter 100 % liegen.'); return; }
  const effectiveCost=cost*(1+waste/100), net=effectiveCost/(1-margin/100); let gross=net*(1+vat/100); if(rounding!=='none'){ const cents=Number(rounding)/100; gross=Math.floor(gross)+cents; if(gross<net*(1+vat/100)) gross+=1; } const roundedNet=gross/(1+vat/100), profit=roundedNet-effectiveCost, markup=effectiveCost>0?profit/effectiveCost*100:0;
  renderRows('m_result',[
    ['Verkaufspreis netto',euro(roundedNet)],['Verkaufspreis brutto',euro(gross)],['Rohertrag pro Stück',euro(profit)],['Aufschlag auf den EK',pct(markup)]
  ],`<strong>Einordnung:</strong> Für eine Ziel-Handelsspanne von ${pct(margin)} brauchst du rechnerisch einen Brutto-VK von ${euro(gross)}.`);
}
function calcDiscount(){
  error('d_error');
  const gross=val('d_price'), cost=val('d_cost'), discount=val('d_discount'), vat=val('d_vat');
  if(gross<0||cost<0||discount<0||discount>100||vat<0){ error('d_error','Bitte gültige Werte eingeben. Der Rabatt muss zwischen 0 und 100 % liegen.'); return; }
  const newGross=gross*(1-discount/100), oldNet=gross/(1+vat/100), newNet=newGross/(1+vat/100), oldProfit=oldNet-cost, newProfit=newNet-cost, margin=newNet?newProfit/newNet*100:0, loss=oldProfit-newProfit;
  renderRows('d_result',[
    ['Neuer Verkaufspreis brutto',euro(newGross)],['Neuer Verkaufspreis netto',euro(newNet)],['Rohertrag nach Rabatt',euro(newProfit)],
    ['Handelsspanne nach Rabatt',pct(margin)],['Rohertragsverlust je Stück',euro(loss)]
  ],newProfit<0?`<strong>Achtung:</strong> Nach dem Rabatt liegt der Rohertrag rechnerisch bei ${euro(newProfit)} je Stück. Der Artikel wird auf dieser Basis unter Einstand verkauft.`:`<strong>Einordnung:</strong> Der Rabatt kostet ${euro(loss)} Rohertrag je Stück; die verbleibende Handelsspanne beträgt ${pct(margin)}.`);
}
function calcBreakEven(){
  error('b_error');
  const fixed=val('b_fixed'), rate=val('b_rate'), days=val('b_days'), targetProfit=val('b_profit'), buffer=val('b_buffer');
  if(fixed<0||rate<=0||rate>100||days<=0){ error('b_error','Bitte gültige Werte eingeben.'); return; }
  const baseMonthly=fixed/(rate/100), targetMonthly=(fixed+targetProfit)/(rate/100), monthly=targetMonthly*(1+buffer/100), daily=monthly/days;
  renderRows('b_result',[
    ['Reiner Break-even-Umsatz',euro(baseMonthly)],['Zielumsatz inkl. Gewinn/Puffer',euro(monthly)],['Break-even-Umsatz je Öffnungstag',euro(daily)],['Deckungsbeitrag am Break-even',euro(fixed)]
  ],`<strong>Einordnung:</strong> Bei unveränderter Deckungsbeitragsquote brauchst du im Schnitt ${euro(daily)} Umsatz je Öffnungstag, um die angegebenen Fixkosten zu decken.`);
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
    ['Max. Personalkostenbudget',euro(budget)],['Finanzierbare Personalstunden',`${de(hours)} h`],['Ø Stunden je Öffnungstag',`${de(perDay)} h`],['Notwendige Stundenleistung',`${euro(productivity)}/h`]
  ],`<strong>Einordnung:</strong> Bei einer Ziel-Personalkostenquote von ${pct(ratio)} stehen rechnerisch ${euro(budget)} für Personal zur Verfügung. Bei ${euro(hourly)} Kosten je Stunde entspricht das rund ${de(hours)} Stunden.`);
}
function calcGrossProfit(){
  error('gp_error');
  const revenue=val('gp_revenue'), cogs=val('gp_cogs');
  if(revenue<=0||cogs<0){ error('gp_error','Umsatz muss größer als 0 sein; Wareneinsatz darf nicht negativ sein.'); return; }
  const grossProfit=revenue-cogs, margin=grossProfit/revenue*100, cogsRatio=cogs/revenue*100, factor=cogs>0?revenue/cogs:0;
  renderRows('gp_result',[
    ['Rohertrag',euro(grossProfit)],['Rohertragsquote',pct(margin)],['Wareneinsatzquote',pct(cogsRatio)],['Umsatz / Wareneinsatz',factor?`${de(factor,2)} ×`:'–']
  ],grossProfit<0?'<strong>Achtung:</strong> Der Wareneinsatz liegt über dem Umsatz. Prüfe Zeitraum, Netto-/Bruttowerte und Datengrundlage.':`<strong>Einordnung:</strong> Von ${euro(revenue)} Umsatz bleiben vor Personal-, Raum- und weiteren Kosten ${euro(grossProfit)} Rohertrag.`);
}
function calcStockTurn(){
  error('st_error');
  const cogs=val('st_cogs'), avgStock=val('st_stock'), period=val('st_period'), lead=val('st_lead'), safety=val('st_safety');
  if(cogs<0||avgStock<=0||period<=0){ error('st_error','Durchschnittsbestand und Zeitraum müssen größer als 0 sein.'); return; }
  const turns=cogs/avgStock, days=turns?period/turns:0, avgDaily=cogs/period, coverage=avgDaily?avgStock/avgDaily:0, reorderNeed=avgDaily*lead+safety, coverageGap=coverage-lead;
  renderRows('st_result',[
    ['Lagerumschlag im Zeitraum',`${de(turns,2)} ×`],['Ø Lagerdauer',`${de(days)} Tage`],['Bestandsreichweite',`${de(coverage)} Tage`],['Ø Wareneinsatz je Tag',euro(avgDaily)],['Bedarf bis nächste Lieferung + Sicherheit',euro(reorderNeed)],['Reichweite nach Lieferzeit',`${de(coverageGap)} Tage`]
  ],`<strong>Einordnung:</strong> Dein durchschnittlicher Bestand schlägt sich im gewählten Zeitraum etwa ${de(turns,2)}-mal um. Höher ist nicht automatisch besser: Verfügbarkeit, Lieferzeit und Saison müssen dazu passen.`);
}

Object.assign(window,{calcPersonnel,calcMargin,calcDiscount,calcBreakEven,calcKpi,calcLaborBudget,calcGrossProfit,calcStockTurn});
document.addEventListener('DOMContentLoaded',()=>{
  if($('#p_result')) calcPersonnel(); if($('#m_result')) calcMargin(); if($('#d_result')) calcDiscount(); if($('#b_result')) calcBreakEven();
  if($('#k_result')) calcKpi(); if($('#lb_result')) calcLaborBudget(); if($('#gp_result')) calcGrossProfit(); if($('#st_result')) calcStockTurn();
});
