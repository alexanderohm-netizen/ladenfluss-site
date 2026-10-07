(function(){'use strict';
const modes=[
['personalbedarf','Personalbedarf','Team','Wie viele Personalstunden brauchst du?','p','calcPersonnel'],
['margenrechner','Verkaufspreis','Preise','Vom Einkauf zur gewünschten Handelsspanne.','m','calcMargin'],
['rabattrechner','Rabattwirkung','Preise','Was bleibt nach deiner Preisaktion?','d','calcDiscount'],
['break-even','Break-even','Zahlen','Welcher Umsatz deckt deine Kosten?','b','calcBreakEven'],
['kpi-dashboard','Kennzahlen','Zahlen','Stundenleistung, Bon und Kosten einordnen.','k','calcKpi'],
['personalkosten-budget','Personalbudget','Team','Wie viele Stunden kannst du finanzieren?','lb','calcLaborBudget'],
['rohertrag-wareneinsatz','Rohertrag','Zahlen','Was bleibt nach dem Wareneinkauf?','gp','calcGrossProfit'],
['lagerumschlag','Lagerreichweite','Bestand','Wie lange reicht dein Warenbestand?','st','calcStockTurn']];
document.addEventListener('DOMContentLoaded',()=>{
const $=id=>document.getElementById(id),host=$('calculatorFields'),dialog=$('modeDialog');let current=null,active=null,fresh=true,buffer='';const drafts=new Map();
function numeric(){return [...host.querySelectorAll('input[type=number]')];}
function display(label,value,hint){$('screenLabel').textContent=label;$('screenValue').textContent=value;$('screenHint').textContent=hint;}
function focus(input){active=input;fresh=true;buffer=input.value;display(host.querySelector('label[for="'+input.id+'"]')?.textContent||'Eingabe',input.value.replace('.',',')||'0','Deine Eingabe · = berechnen');}
function calculate(save=true){window[current[5]](save);const result=$(current[4]+'_result'),error=$(current[4]+'_error');if(result.hidden){display('Bitte prüfen','—',error.textContent);return;}const row=result.querySelector('.metric,.kpi');display(row.querySelector('span,small').textContent,row.querySelector('strong,b').textContent,'Details und Einordnung bei deinen Angaben.');fresh=true;}
function changeMode(key){const next=modes.find(m=>m[0]===key)||modes[0];if(current)drafts.set(current[0],[...host.querySelectorAll('input,select')].map(e=>[e.id,e.value]));current=next;host.replaceChildren($('mode-'+next[0]).content.cloneNode(true));$('modeGroup').textContent=next[2];$('modeTitle').textContent=next[1];$('modeHelp').textContent=next[3];$('chooseMode').textContent=next[1]+' ▦';
window.lfApplyStoreDefaults();const date=$('p_date');if(date){const n=new Date();date.value=[n.getFullYear(),String(n.getMonth()+1).padStart(2,'0'),String(n.getDate()).padStart(2,'0')].join('-');}
for(const [id,value] of drafts.get(key)||[])if($(id))$(id).value=value;
for(const input of numeric())input.addEventListener('focus',()=>focus(input));
for(const input of host.querySelectorAll('input,select'))input.addEventListener('input',()=>{window.error(current[4]+'_error','Eingaben geändert. Bitte neu berechnen.');if(input.type==='number'){active=input;buffer=input.value;display(host.querySelector('label[for="'+input.id+'"]')?.textContent||'Eingabe',buffer.replace('.',',')||'0','= berechnen');}});
host.addEventListener('keydown',onEnter);active=numeric()[0];calculate(false);fresh=true;
for(const button of $('modeOptions').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.mode===next[0]));
}
function onEnter(event){if(event.key==='Enter'&&event.target.matches('input,select')){event.preventDefault();calculate();}}
for(const mode of modes){const b=document.createElement('button');b.dataset.mode=mode[0];const group=document.createElement('small'),name=document.createElement('strong'),help=document.createElement('span');group.textContent=mode[2];name.textContent=mode[1];help.textContent=mode[3];b.append(group,name,help);b.onclick=()=>{location.hash=mode[0];if(current?.[0]===mode[0])changeMode(mode[0]);dialog.close();$('chooseMode').focus();};$('modeOptions').append(b);}
$('chooseMode').onclick=()=>dialog.showModal();$('closeModes').onclick=()=>dialog.close();
$('keypad').addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
$('keypad').addEventListener('click',event=>{const key=event.target.closest('[data-key]')?.dataset.key;if(!key)return;if(key==='calculate'){calculate();return;}if(key==='next'){const inputs=numeric();const i=inputs.indexOf(active);active=inputs[(i+1)%inputs.length];active.closest('details')?.setAttribute('open','');active.focus();focus(active);return;}if(!active)return;
if(key==='clear')buffer='';else if(key==='back')buffer=active.value.slice(0,-1);else{if(fresh)buffer='';if(key==='.'&&buffer.includes('.'))return;buffer+=(key==='.'&&!buffer?'0.':key);}
fresh=false;active.value=buffer;const pending=buffer;active.dispatchEvent(new Event('input',{bubbles:true}));buffer=pending;display(host.querySelector('label[for="'+active.id+'"]')?.textContent||'Eingabe',buffer.replace('.',',')||'0','= berechnen');});
window.addEventListener('hashchange',()=>changeMode(location.hash.slice(1)));changeMode(location.hash.slice(1));
});})();
