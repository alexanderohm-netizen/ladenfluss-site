'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,format}=require('../assets/pep-input.js');
test('PEP keyboard: accepts hours, minutes, pause and common retail shorthand',()=>{
  assert.deepEqual(parse('9-17/30'),{type:'shift',shift:['09:00','17:00',30]});
  assert.deepEqual(parse('08:30 - 18:30'),{type:'shift',shift:['08:30','18:30',45]});
  assert.deepEqual(parse('09 14'),{type:'shift',shift:['09:00','14:00',0]});
  assert.equal(format(['09:00','17:00',30]),'09:00-17:00/30');
});
test('PEP keyboard: absences and deletion map to explicit operations',()=>{
  for(const [typed,reason] of [['U','Urlaub'],['f','Frei'],['krank','Krank'],['Seminar','Schule / Seminar']])assert.deepEqual(parse(typed),{type:'absence',reason});
  assert.deepEqual(parse('-'),{type:'clear'});
  assert.deepEqual(parse('  '),{type:'noop'});
});
test('PEP keyboard: invalid times, short breaks and unknown commands fail closed',()=>{
  for(const value of ['25-17','18-08','12-21/0','08:99-18:00','acht bis vier','09:00-19:30/30'])assert.throws(()=>parse(value),/./,value);
});
