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
test('closed ending is reachable',()=>{const s=strongState();s.members.forEach(m=>Object.assign(m,{acting:62,rhythm:62,focus:62,tech:62,reaction:62,trust:62,fatigue:45}));Object.values(s.devices).forEach(d=>d.status=55);Object.keys(s.relationships).forEach(k=>s.relationships[k]=45);s.resources.expectation=40;E.startPerformance(s);E.confirmPerformanceSetup(s,{lead:'gu',understudy:'lin',engineer:'lin',firstLight:'qing',backup:'battery'});for(const id of ['spot','risk','repeat','battery'])E.resolvePerformanceCue(s,id,.35);assert.equal(s.ending,'closed');});
test('rough ending is reachable',()=>{const s=strongState();s.members.forEach(m=>Object.assign(m,{acting:45,rhythm:45,focus:45,tech:45,reaction:45,trust:45,fatigue:78}));Object.values(s.devices).forEach(d=>d.status=35);Object.keys(s.relationships).forEach(k=>s.relationships[k]=35);s.resources.expectation=30;assert.equal(runEnding(s,[.35,.35,.35,.35]),'rough');});
test('failure ending is reachable',()=>{const s=E.createInitialState();s.members.forEach(m=>Object.assign(m,{acting:20,rhythm:20,focus:20,stamina:20,tech:20,reaction:20,trust:20,fatigue:85,stress:85}));Object.values(s.devices).forEach(d=>d.status=15);Object.keys(s.relationships).forEach(k=>s.relationships[k]=20);Object.assign(s.resources,{expectation:15,parts:0});E.startPerformance(s);E.confirmPerformanceSetup(s,{lead:'lin',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'none'});for(let i=0;i<4;i++){const cue=E.performanceCueInfo(s);E.resolvePerformanceCue(s,cue.options[cue.options.length-1].id,.2);}assert.equal(s.ending,'failure');});

function snapshot(s){return JSON.stringify(s);}
function repairNoThrow(s,...args){try{return E.repairAction(s,...args);}catch(err){assert.ok(false,`repairAction threw ${err && err.constructor && err.constructor.name}: ${err && err.message}`);}}

test('repair failure matrix never throws and leaves the whole state untouched',()=>{
  const base=()=>{const s=E.createInitialState();s.locations.repair.unlocked=true;return s;};
  const cases=[
    ['all devices healthy',s=>{Object.values(s.devices).forEach(d=>{d.status=85;});},'gu'],
    ['all devices at cap',s=>{Object.values(s.devices).forEach(d=>{d.status=100;});},'gu'],
    ['unknown member',s=>s,'nobody'],
    ['wrong phase night',s=>{s.phase='night';},'gu'],
    ['wrong phase performance',s=>{s.phase='performance';},'gu'],
    ['no actions left',s=>{s.actions=0;},'gu'],
    ['energy missing',s=>{s.resources.energy=4;},'gu'],
    ['parts missing',s=>{s.resources.parts=0;},'gu'],
    ['empty device collection',s=>{s.devices={};},'gu'],
    ['null device collection',s=>{s.devices=null;},'gu'],
    ['devices pushed over cap by save data',s=>{Object.values(s.devices).forEach(d=>{d.status=120;});},'gu']
  ];
  for(const [name,setup,id] of cases){
    const s=base();setup(s);const before=snapshot(s);
    const r=repairNoThrow(s,id,10,true);
    assert.equal(r.ok,false,`${name} should fail`);
    assert.equal(typeof r.reason,'string',`${name} should explain the failure`);
    assert.equal(r.target,null,`${name} should report no target`);
    assert.equal(r.gain,0,`${name} should report zero gain`);
    assert.equal(snapshot(s),before,`${name} mutated state`);
  }
});

test('repair failures do not poison a later successful repair',()=>{
  const s=E.createInitialState();s.locations.repair.unlocked=true;
  const failures=[
    x=>E.repairAction(x,'ghost',10,true),
    x=>{x.phase='night';const r=E.repairAction(x,'gu',10,true);x.phase='morning';return r;},
    x=>{const a=x.actions;x.actions=0;const r=E.repairAction(x,'gu',10,true);x.actions=a;return r;},
    x=>{const e=x.resources.energy;x.resources.energy=1;const r=E.repairAction(x,'gu',10,true);x.resources.energy=e;return r;},
    x=>{const p=x.resources.parts;x.resources.parts=0;const r=E.repairAction(x,'gu',10,true);x.resources.parts=p;return r;},
    x=>{const saved=Object.fromEntries(Object.entries(x.devices).map(([k,v])=>[k,v.status]));Object.values(x.devices).forEach(v=>{v.status=100;});const r=E.repairAction(x,'gu',10,true);Object.entries(saved).forEach(([k,v])=>{x.devices[k].status=v;});return r;}
  ];
  for(const setup of failures){
    const before=snapshot(s);const r=setup(s);
    assert.equal(r.ok,false);
    assert.equal(snapshot(s),before);
  }
  const lowest=Object.entries(s.devices).sort((a,b)=>a[1].status-b[1].status)[0][0];
  const targetStatus=s.devices[lowest].status;
  const before={actions:s.actions,energy:s.resources.energy,parts:s.resources.parts,repairs:s.stats.repairs,logs:s.log.length};
  const ok=repairNoThrow(s,'gu',10,true);
  assert.equal(ok.ok,true);
  assert.equal(ok.target,lowest);
  assert.equal(s.actions,before.actions-1);
  assert.equal(s.resources.energy,before.energy-5);
  assert.equal(s.resources.parts,before.parts-1);
  assert.equal(s.stats.repairs,before.repairs+1);
  assert.equal(s.log.length,before.logs+1);
  assert.ok(s.devices[lowest].status>targetStatus);
});

test('repair picks a stable lowest device regardless of key order',()=>{
  const make=(order)=>{const s=E.createInitialState();const values={lift:40,audio:40,power:60,lights:65,life:90,props:90,console:90};const rebuilt={};for(const id of order){rebuilt[id]={name:s.devices[id].name,status:values[id],damaged:false};}s.devices=rebuilt;return s;};
  const a=make(['lift','audio','power','lights','life','props','console']);
  const b=make(['console','props','life','lights','power','audio','lift']);
  assert.equal(E.repairCandidates(a)[0],'audio');
  assert.equal(E.repairCandidates(b)[0],'audio');
  const ra=repairNoThrow(a,'gu',10,true),rb=repairNoThrow(b,'gu',10,true);
  assert.equal(ra.ok,true);assert.equal(rb.ok,true);
  assert.equal(ra.target,'audio');assert.equal(rb.target,'audio');
});

test('repeated repairs deterministically rotate targets and stay idempotent at cap',()=>{
  const s=E.createInitialState();s.locations.repair.unlocked=true;
  Object.values(s.devices).forEach(d=>{d.status=40;});s.resources.energy=200;s.resources.parts=20;s.actions=4;
  const first=repairNoThrow(s,'gu',1,true);
  assert.equal(first.ok,true);
  assert.equal(first.target,'audio');
  assert.equal(first.gain,1);
  const second=repairNoThrow(s,'gu',1,true);
  assert.equal(second.ok,true);
  assert.equal(second.target,'console');
  const third=repairNoThrow(s,'gu',1,true);
  assert.equal(third.target,'life');
  s.actions=4;s.resources.energy=200;s.resources.parts=20;
  Object.values(s.devices).forEach(d=>{d.status=100;});
  const before=snapshot(s);
  const done=repairNoThrow(s,'gu',10,true);
  assert.equal(done.ok,false);
  assert.equal(done.reason,'所有设备完整度充足，无需维修');
  assert.equal(snapshot(s),before);
});

test('repair consumes exactly the resource boundary and opens lighting via power',()=>{
  const s=E.createInitialState();s.locations.repair.unlocked=true;
  Object.values(s.devices).forEach(d=>{d.status=90;});
  s.devices.power.status=20;s.locations.lighting.closed=true;
  s.resources.energy=5;s.resources.parts=1;s.actions=1;
  const r=repairNoThrow(s,'gu',10,true);
  assert.equal(r.ok,true);
  assert.equal(r.target,'power');
  assert.equal(s.resources.energy,0);
  assert.equal(s.resources.parts,0);
  assert.equal(s.actions,0);
  assert.ok(s.devices.power.status>=30);
  assert.equal(s.locations.lighting.closed,false);

  const t=E.createInitialState();t.locations.repair.unlocked=true;
  Object.values(t.devices).forEach(d=>{d.status=90;});
  t.devices.power.status=20;t.locations.lighting.closed=true;
  t.resources.energy=5;t.resources.parts=0;t.actions=1;
  const before=snapshot(t);
  const blocked=repairNoThrow(t,'gu',10,true);
  assert.equal(blocked.ok,false);
  assert.equal(snapshot(t),before);

  const u=E.createInitialState();u.locations.repair.unlocked=true;
  Object.values(u.devices).forEach(d=>{d.status=90;});
  u.devices.power.status=20;u.locations.lighting.closed=true;
  const stay=repairNoThrow(u,'qing',1,false);
  assert.equal(stay.ok,true);
  assert.equal(u.locations.lighting.closed,true);
});

test('repair tolerates hellish save shapes without a TypeError',()=>{
  const weird=[
    s=>{s.devices=null;},
    s=>{s.devices={};},
    s=>{s.devices={broken:{},ghost:{status:NaN},lift:{name:'升降台',status:40}};},
    s=>{const key={toString(){return 'lift';}};s.devices={[key]:{status:40}};},
    s=>{Object.values(s.devices).forEach(d=>{d.status=undefined;});},
    s=>{s.resources=null;}
  ];
  for(const setup of weird){
    const s=E.createInitialState();setup(s);
    const before=snapshot(s);
    const r=repairNoThrow(s,'gu',NaN,true);
    assert.equal(typeof r.ok,'boolean');
    if(r.ok===false)assert.equal(snapshot(s),before);
  }
  const s=E.createInitialState();s.locations.repair.unlocked=true;
  Object.values(s.devices).forEach(d=>{d.status=90;});
  s.devices.lift.status=40;
  const r=repairNoThrow(s,'gu',NaN,true);
  assert.equal(r.ok,true);
  assert.equal(r.target,'lift');
  assert.ok(Number.isFinite(s.devices.lift.status));
});
