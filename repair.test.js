import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.js';

const snap=s=>JSON.stringify(s);
function assertCleanFailure(s,fn){
  const before=snap(s);
  let r;
  assert.doesNotThrow(()=>{r=fn();});
  assert.equal(r.ok,false);
  assert.equal(typeof r.reason,'string');
  assert.ok(r.reason.length>0);
  assert.equal(snap(s),before,'失败调用不得改变任何状态');
  return r;
}
function repairableState(){
  const s=E.createInitialState();
  Object.values(s.devices).forEach(d=>d.status=90);
  s.devices.lift.status=40;
  return s;
}

test('repair fails cleanly when every device is above the threshold',()=>{
  const s=E.createInitialState();
  Object.values(s.devices).forEach(d=>d.status=95);
  const r=assertCleanFailure(s,()=>E.repairAction(s,'gu'));
  assert.match(r.reason,/无需维修/);
});

test('repair fails cleanly for unknown member id',()=>{
  const s=repairableState();
  assertCleanFailure(s,()=>E.repairAction(s,'ghost'));
});

test('repair fails cleanly outside the morning phase',()=>{
  for(const phase of ['afternoon','event','night','performance']){
    const s=repairableState();
    s.phase=phase;
    assertCleanFailure(s,()=>E.repairAction(s,'gu'));
  }
});

test('repair fails cleanly when actions are exhausted',()=>{
  const s=repairableState();
  s.actions=0;
  assertCleanFailure(s,()=>E.repairAction(s,'gu'));
});

test('repair fails cleanly when energy or parts are insufficient',()=>{
  const a=repairableState();
  a.resources.energy=4;
  assertCleanFailure(a,()=>E.repairAction(a,'gu'));
  const b=repairableState();
  b.resources.parts=0;
  assertCleanFailure(b,()=>E.repairAction(b,'gu'));
});

test('repair fails cleanly on empty or missing device collections',()=>{
  const a=repairableState();
  a.devices={};
  assertCleanFailure(a,()=>E.repairAction(a,'gu'));
  const b=repairableState();
  b.devices=null;
  assertCleanFailure(b,()=>E.repairAction(b,'gu'));
});

test('repair fails cleanly when saved data pushed devices to or beyond the cap',()=>{
  const s=repairableState();
  s.devices.lift.status=100;
  s.devices.power.status=200;
  s.devices.audio.status=85;
  assertCleanFailure(s,()=>E.repairAction(s,'gu'));
});

test('repair never throws TypeError on hellish save shapes',()=>{
  const shapes=[
    s=>{s.devices={power:{name:'母线',status:NaN}};},
    s=>{s.devices={power:{name:'母线',status:'high'}};},
    s=>{s.devices={power:null,lights:42};},
    s=>{s.resources={};},
    s=>{s.devices={broken:{status:30}};},
  ];
  for(const mutate of shapes){
    const s=repairableState();
    mutate(s);
    let r;
    assert.doesNotThrow(()=>{r=E.repairAction(s,'gu');});
    assert.equal(typeof r.ok,'boolean');
    if(!r.ok)assert.equal(typeof r.reason,'string');
  }
});

test('repair target ties resolve deterministically regardless of key order',()=>{
  const build=()=>{const s=repairableState();s.devices.lift.status=40;s.devices.audio.status=40;return s;};
  const a=build();
  const b=build();
  b.devices=Object.fromEntries(Object.entries(b.devices).reverse());
  assert.notDeepEqual(Object.keys(a.devices),Object.keys(b.devices));
  assert.equal(E.selectRepairTarget(a),E.selectRepairTarget(b));
  const ra=E.repairAction(a,'gu'),rb=E.repairAction(b,'gu');
  assert.equal(ra.ok,true);
  assert.equal(ra.target,rb.target);
});

test('repair picks the lowest status device and spends resources exactly once',()=>{
  const s=repairableState();
  const r=E.repairAction(s,'gu');
  assert.equal(r.ok,true);
  assert.equal(r.target,'lift');
  assert.equal(s.devices.lift.status,40+r.gain);
  assert.equal(s.actions,3);
  assert.equal(s.resources.energy,68-5);
  assert.equal(s.resources.parts,8-1);
  assert.equal(s.stats.repairs,1);
  assert.equal(E.getMember(s,'gu').assignment,'设备维修');
  assert.ok(s.log.some(x=>x.kind==='success'&&x.title==='设备维修完成'));
});

test('resource boundary: exactly 5 energy and 1 part succeeds, one less fails',()=>{
  const s=repairableState();
  s.resources.energy=5;
  s.resources.parts=1;
  const r=E.repairAction(s,'gu');
  assert.equal(r.ok,true);
  assert.equal(s.resources.energy,0);
  assert.equal(s.resources.parts,0);
  const t=repairableState();
  t.resources.energy=5;
  t.resources.parts=0;
  assertCleanFailure(t,()=>E.repairAction(t,'gu'));
});

test('calling repair again after everything is repaired fails without side effects',()=>{
  const s=repairableState();
  s.devices.lift.status=84;
  const first=E.repairAction(s,'gu');
  assert.equal(first.ok,true);
  assert.ok(s.devices.lift.status>=85);
  assertCleanFailure(s,()=>E.repairAction(s,'gu'));
});

test('a failed repair does not pollute a later successful repair',()=>{
  const s=repairableState();
  s.phase='night';
  assertCleanFailure(s,()=>E.repairAction(s,'gu'));
  s.phase='morning';
  const r=E.repairAction(s,'gu');
  assert.equal(r.ok,true);
  assert.equal(s.actions,3);
  assert.equal(s.resources.energy,68-5);
  assert.equal(s.resources.parts,8-1);
  assert.equal(s.stats.repairs,1);
});

test('repairing power reopens the lighting room only above the safety line',()=>{
  const s=repairableState();
  s.devices.power.status=20;
  Object.keys(s.devices).forEach(k=>{if(k!=='power')s.devices[k].status=90;});
  E.adjustDevice(s,'power',0);
  assert.equal(s.locations.lighting.closed,true);
  const r=E.repairAction(s,'gu');
  assert.equal(r.ok,true);
  assert.equal(r.target,'power');
  assert.ok(s.devices.power.status>=30);
  assert.equal(s.locations.lighting.closed,false);
  const t=repairableState();
  t.devices.power.status=5;
  Object.keys(t.devices).forEach(k=>{if(k!=='power')t.devices[k].status=90;});
  E.adjustDevice(t,'power',0);
  const r2=E.repairAction(t,'gu');
  assert.equal(r2.ok,true);
  assert.ok(t.devices.power.status<30);
  assert.equal(t.locations.lighting.closed,true);
});

test('free repair from training also respects the atomic boundary',()=>{
  const s=E.createInitialState();
  Object.values(s.devices).forEach(d=>d.status=95);
  const before=snap(s);
  let r;
  assert.doesNotThrow(()=>{r=E.repairAction(s,'gu',12,false);});
  assert.equal(r.ok,false);
  assert.equal(snap(s),before);
});
