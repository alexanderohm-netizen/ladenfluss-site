const fs=require('node:fs');const {JSDOM}=require('jsdom');
const modes=['personalbedarf','margenrechner','rabattrechner','break-even','kpi-dashboard','personalkosten-budget','rohertrag-wareneinsatz','lagerumschlag'];
const templates=modes.map(mode=>{const d=new JSDOM(fs.readFileSync('tools/'+mode+'.html','utf8')).window.document;const box=d.querySelector('.calculator');box.querySelector('.calc-actions').remove();return `<template id="mode-${mode}">${box.innerHTML}</template>`;}).join('\n');
const shell=fs.readFileSync('scripts/calculator-shell.html','utf8');fs.writeFileSync('rechner.html',shell.replace('<!-- FORMS -->',templates));
