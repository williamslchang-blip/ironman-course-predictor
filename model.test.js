'use strict';
const assert=require('node:assert/strict');
const {predict,parseTime,formatTime,distances}=require('./model.js');
const base={referenceDistance:'226',targetDistance:'226',times:{swim:4800,bike:22200,run:16200,t1:480,t2:300},reference:{bikeClimb:1000,runClimb:150,wind:10,temperature:24,waves:0},target:{bikeClimb:1000,runClimb:150,wind:10,temperature:24,waves:0},lengths:{...distances[226]},spread:5};
const clone=()=>JSON.parse(JSON.stringify(base));
assert.equal(parseTime('01:20:30'),4830);assert.equal(parseTime('80:30'),4830);assert.equal(parseTime('00:00'),0);assert.ok(Number.isNaN(parseTime('1:60:00')));assert.ok(Number.isNaN(parseTime('2')));assert.equal(formatTime(3599.9),'01:00:00');
const r=predict(base);for(const k of Object.keys(base.times))assert.equal(r.scenarios.neutral[k],base.times[k]);assert.equal(r.scenarios.neutral.total,43980);
for(const [key,value,sport] of [['bikeClimb',2000,'bike'],['runClimb',500,'run'],['wind',25,'bike'],['temperature',32,'run'],['waves',2,'swim']]){const d=clone();d.target[key]=value;assert.ok(predict(d).scenarios.neutral[sport]>r.scenarios.neutral[sport],key+' should increase time');}
for(const s of Object.values(r.scenarios))assert.equal(s.total,['swim','bike','run','t1','t2'].reduce((sum,k)=>sum+s[k],0));assert.ok(r.scenarios.optimistic.total<r.scenarios.neutral.total);assert.ok(r.scenarios.conservative.total>r.scenarios.neutral.total);
const half=clone();half.targetDistance='113';half.lengths={...distances[113]};const h=predict(half);assert.ok(h.warnings.some(s=>s.includes('113')));assert.ok(h.scenarios.neutral.total<r.scenarios.neutral.total);
const bad=clone();bad.times.run=NaN;assert.throws(()=>predict(bad));const extreme=clone();extreme.target.bikeClimb=10000;assert.ok(predict(extreme).scenarios.neutral.bike>0);const invalid=clone();invalid.target.wind=100;assert.throws(()=>predict(invalid));
const more=clone();more.spread=10;const m=predict(more);assert.ok(m.scenarios.optimistic.total<r.scenarios.optimistic.total);assert.ok(m.scenarios.conservative.total>r.scenarios.conservative.total);assert.equal(m.scenarios.neutral.total,r.scenarios.neutral.total);
console.log('PASS: time validation, neutral identity, environmental monotonicity, scenario ordering, rounded totals, cross-distance warning, bounds and spread invariants.');
