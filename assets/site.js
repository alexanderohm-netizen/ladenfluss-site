
const $ = (s, scope=document) => scope.querySelector(s);
const $$ = (s, scope=document) => [...scope.querySelectorAll(s)];

function euro(n){ return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number.isFinite(n)?n:0); }
function de(n, digits=1){ return new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits}).format(Number.isFinite(n)?n:0); }
function pct(n){ return `${de(n,1)} %`; }
function val(id){ return Number(document.getElementById(id)?.value || 0); }
function error(id, text=''){ const el=document.getElementById(id); if(el) el.textContent=text; }
function renderRows(id, rows){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML=rows.map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
  el.hidden=false;
}

const menuBtn = $('.menu-toggle');
const mobileNav = $('.mobile-nav');
if(menuBtn && mobileNav){
  menuBtn.addEventListener('click',()=>{
    const isOpen=mobileNav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded',String(isOpen));
  });
}

$$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const filter=btn.dataset.filter;
  $$('.tool-card').forEach(card=>card.classList.toggle('hidden', filter!=='all' && card.dataset.category!==filter));
}));

function calcPersonnel(){
  error('p_error');
  const revenue=val('p_revenue'), productivity=val('p_productivity'), open=val('p_open'), extra=val('p_extra');
  if(revenue<0 || productivity<=0 || open<=0 || extra<0){ error('p_error','Bitte prüfe deine Eingaben. Umsatz und Zusatzaufwand dürfen nicht negativ sein; Stundenleistung und Öffnungsdauer müssen größer als 0 sein.'); return; }
  const salesHours=revenue/productivity, extraHours=extra/60, total=salesHours+extraHours, concurrent=total/open;
  renderRows('p_result',[
    ['Personalstunden für den Umsatz',`${de(salesHours)} h`],
    ['Zusatzaufwand',`${de(extraHours)} h`],
    ['Gesamter Orientierungsbedarf',`${de(total)} h`],
    ['Ø gleichzeitige Besetzung',`${de(concurrent)} Personen`]
  ]);
}

function calcMargin(){
  error('m_error');
  const cost=val('m_cost'), margin=val('m_margin'), vat=val('m_vat');
  if(cost<0 || margin<0 || margin>=100 || vat<0){ error('m_error','Bitte gültige Werte eingeben. Die Ziel-Handelsspanne muss zwischen 0 und unter 100 % liegen.'); return; }
  const marginDec=margin/100, vatDec=vat/100, net=cost/(1-marginDec), gross=net*(1+vatDec), profit=net-cost, markup=cost>0?profit/cost*100:0;
  renderRows('m_result',[
    ['Verkaufspreis netto',euro(net)],
    ['Verkaufspreis brutto',euro(gross)],
    ['Rohertrag pro Stück',euro(profit)],
    ['Aufschlag auf den EK',pct(markup)]
  ]);
}

function calcDiscount(){
  error('d_error');
  const gross=val('d_price'), cost=val('d_cost'), discount=val('d_discount'), vat=val('d_vat');
  if(gross<0 || cost<0 || discount<0 || discount>100 || vat<0){ error('d_error','Bitte gültige Werte eingeben. Der Rabatt muss zwischen 0 und 100 % liegen.'); return; }
  const newGross=gross*(1-discount/100), oldNet=gross/(1+vat/100), newNet=newGross/(1+vat/100), oldProfit=oldNet-cost, newProfit=newNet-cost, margin=newNet?newProfit/newNet*100:0;
  renderRows('d_result',[
    ['Neuer Verkaufspreis brutto',euro(newGross)],
    ['Neuer Verkaufspreis netto',euro(newNet)],
    ['Rohertrag nach Rabatt',euro(newProfit)],
    ['Handelsspanne nach Rabatt',pct(margin)],
    ['Rohertragsverlust je Stück',euro(oldProfit-newProfit)]
  ]);
}

function calcBreakEven(){
  error('b_error');
  const fixed=val('b_fixed'), rate=val('b_rate'), days=val('b_days');
  if(fixed<0 || rate<=0 || rate>100 || days<=0){ error('b_error','Bitte gültige Werte eingeben. Die Deckungsbeitragsquote muss größer als 0 und höchstens 100 % sein.'); return; }
  const monthly=fixed/(rate/100), daily=monthly/days;
  renderRows('b_result',[
    ['Break-even-Umsatz pro Monat',euro(monthly)],
    ['Break-even-Umsatz je Öffnungstag',euro(daily)],
    ['Deckungsbeitrag am Break-even',euro(monthly*(rate/100))]
  ]);
}

function calcKpi(){
  error('k_error');
  const revenue=val('k_revenue'), hours=val('k_hours'), labor=val('k_labor'), tx=val('k_tx'), visitors=val('k_visitors'), waste=val('k_waste');
  if([revenue,hours,labor,tx,visitors,waste].some(n=>n<0)){ error('k_error','Bitte keine negativen Werte eingeben.'); return; }
  const values=[
    ['Stundenleistung',hours?`${euro(revenue/hours)}/h`:'–'],
    ['Ø Bon',tx?euro(revenue/tx):'–'],
    ['Conversion',visitors?pct(tx/visitors*100):'–'],
    ['Personalkostenquote',revenue?pct(labor/revenue*100):'–'],
    ['Abschriftenquote',revenue?pct(waste/revenue*100):'–'],
    ['Umsatz je Besucher',visitors?euro(revenue/visitors):'–']
  ];
  const el=document.getElementById('k_result'); if(!el) return;
  el.innerHTML=values.map(([label,value])=>`<div class="kpi-box"><small>${label}</small><strong>${value}</strong></div>`).join('');
  el.hidden=false;
}

window.calcPersonnel=calcPersonnel; window.calcMargin=calcMargin; window.calcDiscount=calcDiscount; window.calcBreakEven=calcBreakEven; window.calcKpi=calcKpi;

document.addEventListener('DOMContentLoaded',()=>{
  if($('#p_result')) calcPersonnel();
  if($('#m_result')) calcMargin();
  if($('#d_result')) calcDiscount();
  if($('#b_result')) calcBreakEven();
  if($('#k_result')) calcKpi();
});
