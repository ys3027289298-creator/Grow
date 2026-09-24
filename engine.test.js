import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.js';
test('member stats grow and fatigue changes',()=>{const s=E.createInitialState(),before=E.getMember(s,'lin').acting,r=E.completeTraining(s,'lines',['lin'],.95,()=>0);assert.equal(r.ok,true);assert.ok(E.getMember(s,'lin').acting>before);assert.ok(E.getMember(s,'lin').fatigue>14);});
test('fatigue stress trust and relationships change',()=>{const s=E.createInitialState(),before=E.getRelationship(s,'lin','qing');E.completeTraining(s,'ensemble',['lin','qing'],.2,()=>0);assert.ok(E.getRelationship(s,'lin','qing')<before);assert.ok(E.getMember(s,'lin').stress>22);assert.ok(E.getMember(s,'lin').trust<56);});
test('resources gate and are consumed by training',()=>{const s=E.createInitialState();s.resources.energy=1;assert.equal(E.canTrain(s,'lines',['lin']).ok,false);s.resources.energy=68;const e=s.resources.energy;E.completeTraining(s,'lines',['lin'],.8,()=>0);assert.equal(s.resources.energy,e-7);});
test('failed technical training damages equipment',()=>{const s=E.createInitialState();s.locations.lighting.unlocked=true;const b=s.devices.lights.status;E.completeTraining(s,'lighting',['mika'],.1,()=>0);assert.ok(s.devices.lights.status<b);assert.ok(s.log.some(x=>x.kind==='danger'));});
test('map locks and device state are linked',()=>{const s=E.createInitialState();s.devices.power.status=20;E.adjustDevice(s,'power',0);assert.equal(s.locations.lighting.closed,true);s.devices.power.status=70;E.adjustDevice(s,'power',0);E.unlockChecks(s);assert.equal(s.locations.lighting.unlocked,true);});
test('all ten events have distinct usable branches',()=>{for(const id of Object.keys(E.EVENT_DEFS)){const a=E.createInitialState(),b=E.createInitialState();for(const x of [a,b]){x.resources.credits=300;x.resources.parts=5;x.resources.energy=100;x.resources.expectation=80;x.members.forEach(m=>Object.assign(m,{acting:90,reaction:90,tech:90,trust:90}));Object.keys(x.relationships).forEach(k=>x.relationships[k]=90);}a.activeEvent={id,...E.EVENT_DEFS[id]};b.activeEvent={id,...E.EVENT_DEFS[id]};assert.ok(E.EVENT_DEFS[id].options.length>=2);E.resolveEvent(a,E.EVENT_DEFS[id].options[0].id);const second=[...E.EVENT_DEFS[id].options].reverse().find(o=>!o.need||o.need(b));assert.ok(second);E.resolveEvent(b,second.id);const snap=x=>JSON.stringify({r:x.resources,f:x.flags,d:x.devices,m:x.members,c:x.eventLog.at(-1)?.choice});assert.notEqual(snap(a),snap(b));}});
function strongState(){const s=E.createInitialState();s.members.forEach(m=>Object.assign(m,{acting:95,rhythm:90,focus:90,stamina:85,tech:92,reaction:92,trust:95,fatigue:15,stress:12}));Object.keys(s.relationships).forEach(k=>s.relationships[k]=90);Object.values(s.devices).forEach(d=>d.status=95);Object.assign(s.resources,{energy:100,parts:9,credits:300,rehearsalTime:20,props:100,expectation:95});s.flags.rewrite='accept';return s;}
function runEnding(s,scores){E.startPerformance(s);E.confirmPerformanceSetup(s,{lead:'lin',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});for(const score of scores){const cue=E.performanceCueInfo(s),option=cue.options.find(o=>!o.need||o.need(s,s.performance))||cue.options[0];E.resolvePerformanceCue(s,option.id,score);}return s.ending;}
test('perfect ending is reachable',()=>assert.equal(runEnding(strongState(),[1,1,1,1]),'perfect'));
test('closed ending is reachable',()=>{const s=strongState();s.members.forEach(m=>Object.assign(m,{acting:62,rhythm:62,focus:62,tech:62,reaction:62,trust:62,fatigue:45}));Object.values(s.devices).forEach(d=>d.status=55);Object.keys(s.relationships).forEach(k=>s.relationships[k]=45);s.resources.expectation=40;E.startPerformance(s);const r=E.confirmPerformanceSetup(s,{lead:'qing',understudy:'gu',engineer:'lin',firstLight:'mika',backup:'battery'});assert.equal(r.ok,true);for(const id of ['spot','risk','repeat','battery'])E.resolvePerformanceCue(s,id,.35);assert.equal(s.ending,'closed');});
test('rough ending is reachable',()=>{const s=strongState();s.members.forEach(m=>Object.assign(m,{acting:45,rhythm:45,focus:45,tech:45,reaction:45,trust:45,fatigue:78}));Object.values(s.devices).forEach(d=>d.status=35);Object.keys(s.relationships).forEach(k=>s.relationships[k]=35);s.resources.expectation=30;assert.equal(runEnding(s,[.35,.35,.35,.35]),'rough');});
test('failure ending is reachable',()=>{const s=E.createInitialState();s.members.forEach(m=>Object.assign(m,{acting:20,rhythm:20,focus:20,stamina:20,tech:20,reaction:20,trust:20,fatigue:85,stress:85}));Object.values(s.devices).forEach(d=>d.status=15);Object.keys(s.relationships).forEach(k=>s.relationships[k]=20);Object.assign(s.resources,{expectation:15,parts:0});E.startPerformance(s);E.confirmPerformanceSetup(s,{lead:'lin',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'none'});for(let i=0;i<4;i++){const cue=E.performanceCueInfo(s);E.resolvePerformanceCue(s,cue.options[cue.options.length-1].id,.2);}assert.equal(s.ending,'failure');});
function prepState(){const s=E.createInitialState();E.startPerformance(s);return s;}
const VALID_SETUP={lead:'lin',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'};
function prepSnapshot(s){return JSON.parse(JSON.stringify({performance:s.performance,log:s.log,eventLog:s.eventLog,members:s.members,relationships:s.relationships,resources:s.resources,devices:s.devices,flags:s.flags}));}
function assertRejected(snapshotBefore,s,setup){const r=E.confirmPerformanceSetup(s,setup);assert.equal(r.ok,false);assert.equal(typeof r.reason,'string');assert.ok(r.reason.length>0);assert.deepEqual(prepSnapshot(s),snapshotBefore);return r;}
test('setup rejects one member occupying multiple posts',()=>{
  const s=prepState();const snap=prepSnapshot(s);
  assertRejected(snap,s,{lead:'lin',understudy:'lin',engineer:'gu',firstLight:'mika',backup:'battery'});
  assertRejected(snap,s,{lead:'lin',understudy:'qing',engineer:'mika',firstLight:'mika',backup:'human'});
  assertRejected(snap,s,{lead:'lin',understudy:'lin',engineer:'lin',firstLight:'lin',backup:'none'});
  assert.equal(s.performance.stage,'prep');assert.equal(s.performance.setup,null);assert.equal(s.performance.score,0);
});
test('setup rejects unknown member ids',()=>{
  const s=prepState();const snap=prepSnapshot(s);
  assertRejected(snap,s,{lead:'nobody',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});
  assertRejected(snap,s,{lead:'lin',understudy:'LIN',engineer:'gu',firstLight:'mika',backup:'battery'});
});
test('setup rejects missing fields, nullish and non-string input',()=>{
  const s=prepState();const snap=prepSnapshot(s);
  assertRejected(snap,s,undefined);
  assertRejected(snap,s,null);
  assertRejected(snap,s,{});
  assertRejected(snap,s,{lead:'lin',understudy:'qing',engineer:'gu',firstLight:'mika'});
  assertRejected(snap,s,{lead:'',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});
  assertRejected(snap,s,{lead:'   ',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});
  assertRejected(snap,s,{lead:null,understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});
  assertRejected(snap,s,{lead:42,understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});
  assertRejected(snap,s,['lin','qing','gu','mika','battery']);
  assertRejected(snap,s,{lead:{id:'lin'},understudy:'qing',engineer:'gu',firstLight:'mika',backup:0});
});
test('setup rejects illegal backup values',()=>{
  const s=prepState();const snap=prepSnapshot(s);
  assertRejected(snap,s,{...VALID_SETUP,backup:'BATTERY'});
  assertRejected(snap,s,{...VALID_SETUP,backup:'emergency'});
  assertRejected(snap,s,{...VALID_SETUP,backup:null});
  assertRejected(snap,s,{...VALID_SETUP,backup:''});
});
test('setup accepts a legal four-member config and computes synergy from real pairs',()=>{
  const s=prepState();
  const expected=(E.getRelationship(s,'lin','qing')>=55?8:0)+(E.getRelationship(s,'gu','mika')>=50?6:0);
  const r=E.confirmPerformanceSetup(s,{...VALID_SETUP});
  assert.equal(r.ok,true);assert.equal(r.synergy,expected);
  assert.equal(r.synergy,0);
  assert.deepEqual(s.performance.setup,VALID_SETUP);
  assert.equal(s.performance.score,r.synergy);
  assert.ok(Object.isFrozen(s.performance.setup));
  assert.equal(s.performance.stage,'cue');assert.equal(s.performance.cue,1);
  assert.ok(s.log.some(x=>x.title==='演出方案锁定'&&x.detail.includes(`默契加成为 ${r.synergy}`)));
});
test('synergy strictly corresponds to the two real member relationships',()=>{
  const s=prepState();
  E.setRelationship(s,'lin','qing',60);E.setRelationship(s,'gu','mika',49);
  const r=E.confirmPerformanceSetup(s,{...VALID_SETUP,backup:'human'});
  assert.equal(r.ok,true);assert.equal(r.synergy,8);assert.equal(s.performance.score,8);
  const t=prepState();
  E.setRelationship(t,'lin','qing',54);E.setRelationship(t,'gu','mika',50);
  const rt=E.confirmPerformanceSetup(t,{...VALID_SETUP,backup:'none'});
  assert.equal(rt.synergy,6);assert.equal(t.performance.score,6);
});
test('legal locked setup cannot resubmit, re-score or mutate',()=>{
  const s=prepState();
  const first=E.confirmPerformanceSetup(s,{...VALID_SETUP});
  assert.equal(first.ok,true);
  const snap=prepSnapshot(s);
  const again=E.confirmPerformanceSetup(s,{lead:'mika',understudy:'qing',engineer:'gu',firstLight:'lin',backup:'human'});
  assert.equal(again.ok,false);assert.equal(typeof again.reason,'string');assert.ok(again.reason.length>0);
  assert.deepEqual(prepSnapshot(s),snap);
  assert.equal(s.performance.score,first.synergy);
  assert.deepEqual(s.performance.setup,VALID_SETUP);
  assert.throws(()=>{s.performance.setup.lead='mika';},TypeError);
});
test('four live cues use the validated setup and finish with a single locked synergy',()=>{
  const s=prepState();
  E.setRelationship(s,'lin','qing',80);E.setRelationship(s,'gu','mika',80);
  const locked=E.confirmPerformanceSetup(s,{...VALID_SETUP,backup:'battery'});
  assert.equal(locked.synergy,14);
  const partsBefore=s.resources.parts;
  const choices=['light','brake','improv','battery'];
  for(const id of choices){
    const cue=E.performanceCueInfo(s);
    const option=cue.options.find(o=>o.id===id);
    assert.ok(option);assert.ok(!option.need||option.need(s,s.performance));
    const r=E.resolvePerformanceCue(s,id,.9);
    assert.equal(r.ok,true);
  }
  assert.equal(s.performance.stage,'result');
  assert.equal(s.ended,true);
  assert.deepEqual(s.performance.setup,VALID_SETUP);
  assert.equal(s.performance.operations.length,4);
  assert.ok(partsBefore>0);
  const total=E.clamp(s.performance.base+s.performance.score,0,110);
  assert.equal(s.performance.total,total);
  assert.ok(['perfect','closed','rough','failure'].includes(s.ending));
  const logLocks=s.log.filter(x=>x.title==='演出方案锁定');
  assert.equal(logLocks.length,1);
});
test('locked setup ids are the ones referenced by later cue conditions',()=>{
  const s=prepState();
  E.confirmPerformanceSetup(s,{...VALID_SETUP});
  E.getMember(s,'mika').tech=59;
  const opening=E.performanceCueInfo(s);
  const lightOption=opening.options.find(o=>o.id==='light');
  assert.equal(lightOption.need(s,s.performance),false);
  E.getMember(s,'mika').tech=60;
  assert.equal(lightOption.need(s,s.performance),true);
});
