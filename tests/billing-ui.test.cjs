const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const tick = () => new Promise(resolve=>setImmediate(resolve));
async function page({url='https://www.ladenfluss.de/konto',invoke}={}) {
  const dom = new JSDOM('<section id="billing"></section>',{url,runScripts:'outside-only'});
  const calls=[],navigation=[];let current=true;
  dom.window.eval(fs.readFileSync('assets/billing.js','utf8'));
  const element=dom.window.document.getElementById('billing');
  await dom.window.LadenflussBilling.render({element,companyId:'company-a',isCurrent:()=>current,
    client:{functions:{invoke:async(name,options)=>{calls.push(JSON.parse(JSON.stringify(options.body)));return invoke?invoke(options.body):{data:{sandbox:true,available:false,canManage:false},error:null};}}},
    onRefresh:()=>calls.push('refresh'),navigate:url=>navigation.push(url)});
  return {dom,element,calls,navigation,invalidate:()=>{current=false;element.replaceChildren();}};
}
test('Abo-Ansicht: ohne eingerichteten Preis wird kein Kauf angeboten',async()=>{
  const p=await page();assert.match(p.element.textContent,/Buchung wird noch eingerichtet/);
  assert.equal(p.element.querySelectorAll('button').length,0);assert.equal(p.calls.length,1);p.dom.window.close();
});
test('Abo-Ansicht: eine manipulierte Erfolgs-URL schaltet nichts frei',async()=>{
  const p=await page({url:'https://www.ladenfluss.de/konto?billing=returned&keep=1'});
  assert.match(p.element.textContent,/bestätigt noch keine Freischaltung/);
  assert.doesNotMatch(p.element.textContent,/ist freigeschaltet/);
  assert.deepEqual(p.calls,[{action:'status',companyId:'company-a'}]);
  assert.equal(p.dom.window.location.search,'?keep=1');p.dom.window.close();
});
test('Abo-Ansicht: Doppelklick und verspätete Antwort nach Kontowechsel öffnen keinen fremden Checkout',async()=>{
  let complete;
  const p=await page({invoke:async body=>body.action==='status'?{data:{sandbox:true,available:true,price:{amount:1234,currency:'eur'},canManage:false}}:
    new Promise(resolve=>{complete=resolve;})});
  assert.match(p.element.textContent,/12,34/);
  const button=p.element.querySelector('button');button.click();button.click();
  assert.equal(p.calls.filter(call=>call.action==='checkout').length,1);
  assert.deepEqual(p.calls[1],{action:'checkout',companyId:'company-a'});
  p.invalidate();complete({data:{sandbox:true,url:'https://checkout.stripe.com/c/pay/test'}});await tick();
  assert.deepEqual(p.navigation,[]);assert.equal(p.element.children.length,0);p.dom.window.close();
});
test('Abo-Ansicht: fremde Redirect-Adressen werden abgewiesen',async()=>{
  const p=await page({invoke:async body=>({data:body.action==='status'?{sandbox:true,available:true,price:{amount:1234,currency:'eur'}}:
    {sandbox:true,url:'https://checkout.stripe.com.attacker.invalid/'}})});
  p.element.querySelector('button').click();await tick();
  assert.deepEqual(p.navigation,[]);assert.match(p.element.textContent,/konnte nicht geöffnet/);p.dom.window.close();
});
