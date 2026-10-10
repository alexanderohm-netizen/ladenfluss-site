'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
for(const file of ['confirm-signup.html','reset-password.html']){
  test(file+' preserves Supabase confirmation URL and uses brand-safe HTML',()=>{
    const html=fs.readFileSync(path.join(root,'email/templates',file),'utf8');
    assert.match(html,/<html lang="de">/);
    assert.match(html,/href="\{\{ \.ConfirmationURL \}\}"/);
    assert.match(html,/>Ladenfluss</);
    assert.match(html,/>Ladenfluss · Eine Lösung von AO-Shop/);
    assert.doesNotMatch(html,/<script\b|<iframe\b|<form\b|<img\b/i);
    assert.doesNotMatch(html,/https?:\/\/[A-Za-z0-9./?=_&-]+/i);
    const dom=new JSDOM(html);
    assert.equal(dom.window.document.querySelectorAll('a[href]').length,1);
    assert.ok(dom.window.document.querySelector('h1'));
    dom.window.close();
  });
}
