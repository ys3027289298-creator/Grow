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

// ===== 事件结算：事务性、资源不变量与全分支覆盖（表驱动 + 性质测试） =====
const EVENT_IDS=Object.keys(E.EVENT_DEFS);
const RES_KEYS=E.RESOURCE_KEYS;
function eventReadyState(){const s=E.createInitialState();
Object.assign(s.resources,{energy:100,parts:9,credits:300,rehearsalTime:20,props:100,expectation:95});
s.members.forEach(m=>Object.assign(m,{acting:95,rhythm:90,focus:90,stamina:85,tech:92,reaction:92,trust:95,fatigue:15,stress:12}));
Object.keys(s.relationships).forEach(k=>s.relationships[k]=90);
Object.values(s.devices).forEach(d=>d.status=95);
s.locations.lighting.unlocked=true;s.locations.repair.unlocked=true;s.locations.audience.unlocked=true;
return s;}
function assertEventResourceInvariants(s,label){
for(const k of RES_KEYS){const[lo,hi]=E.RESOURCE_LIMITS[k];const v=s.resources[k];
assert.ok(typeof v==='number'&&Number.isFinite(v),`${label}: 资源 ${k} 必须是有限数值，实际为 ${v}`);
assert.ok(v>=lo&&v<=hi,`${label}: 资源 ${k}=${v} 越出合法范围 [${lo},${hi}]`);}
assert.ok(Number.isInteger(s.actions)&&s.actions>=0&&s.actions<=E.DAILY_ACTION_MAX,`${label}: 行动次数 ${s.actions} 越界`);}
const EVENT_SCENARIOS={
'资源充足':()=>eventReadyState(),
'刚好够用':()=>{const s=eventReadyState();Object.assign(s.resources,{energy:6,parts:2,credits:25,rehearsalTime:2,props:0,expectation:55});return s;},
'资源全为0':()=>{const s=eventReadyState();for(const k of RES_KEYS)s.resources[k]=0;return s;},
'超过上限':()=>{const s=eventReadyState();Object.assign(s.resources,{energy:250,parts:250,credits:1500,rehearsalTime:250,props:250,expectation:250});return s;},
'边界值':()=>{const s=eventReadyState();Object.assign(s.resources,{energy:200,parts:200,credits:999,rehearsalTime:200,props:200,expectation:200});return s;}};
test('事件结算表驱动：全部事件×全部选项×资源场景的不变量、原子性与幂等性',()=>{
for(const[scenario,make]of Object.entries(EVENT_SCENARIOS))
for(const eventId of EVENT_IDS)
for(const option of E.EVENT_DEFS[eventId].options){
const label=`${scenario}/${eventId}/${option.id}`;
const s=make();s.activeEvent={id:eventId,...E.EVENT_DEFS[eventId]};
const before=JSON.stringify(s);
const r=E.resolveEvent(s,option.id);
assertEventResourceInvariants(s,label);
if(!r.ok){assert.equal(JSON.stringify(s),before,`${label}: 失败必须保持深快照不变，不得留下半成品`);}
else{
assert.equal(s.activeEvent,null,`${label}: 成功后 activeEvent 必须清空`);
assert.equal(s.phase,'night',`${label}: 成功后必须进入夜间阶段`);
assert.equal(s.flags.eventDoneToday,true,`${label}: 成功后必须标记今日事件已完成`);
assert.equal(s.eventLog.filter(e=>e.type==='event'&&e.key===eventId).length,1,`${label}: 事件日志必须唯一`);
assert.equal(s.log.filter(l=>l.kind==='event'&&l.title===E.EVENT_DEFS[eventId].title).length,1,`${label}: 通讯日志必须唯一`);
const after=JSON.stringify(s);
const again=E.resolveEvent(s,option.id);
assert.equal(again.ok,false,`${label}: 重复执行同一输入必须被拒绝`);
assert.equal(JSON.stringify(s),after,`${label}: 重复执行不得重复提交或重复写日志`);
assert.equal(s.eventLog.filter(e=>e.type==='event'&&e.key===eventId).length,1,`${label}: 重复执行后事件日志仍必须唯一`);}}});
test('事件结算：资源字段缺失时拒绝执行且不留半成品',()=>{
for(const eventId of EVENT_IDS)for(const option of E.EVENT_DEFS[eventId].options)for(const key of RES_KEYS){
const s=eventReadyState();delete s.resources[key];
s.activeEvent={id:eventId,...E.EVENT_DEFS[eventId]};
const before=JSON.stringify(s);
const r=E.resolveEvent(s,option.id);
assert.equal(r.ok,false,`${eventId}/${option.id} 缺少 ${key} 必须失败`);
assert.equal(JSON.stringify(s),before,`${eventId}/${option.id} 缺少 ${key} 不得改变任何状态`);}});
test('事件结算：非有限资源值视为数据异常并拒绝',()=>{
for(const bad of[NaN,Infinity,-Infinity,'50',null,undefined]){
const s=eventReadyState();s.resources.energy=bad;
s.activeEvent={id:'fight',...E.EVENT_DEFS.fight};
const before=JSON.stringify(s);
assert.equal(E.resolveEvent(s,'side').ok,false,`energy=${bad} 必须被拒绝`);
assert.equal(JSON.stringify(s),before,`energy=${bad} 不得改变任何状态`);}});
test('事件结算：条件不足时拒绝执行且状态不变',()=>{
for(const eventId of EVENT_IDS)for(const option of E.EVENT_DEFS[eventId].options){
if(!option.need)continue;
const s=eventReadyState();
for(const k of RES_KEYS)s.resources[k]=0;
s.members.forEach(m=>Object.assign(m,{acting:0,rhythm:0,focus:0,stamina:0,tech:0,reaction:0,trust:0}));
Object.keys(s.relationships).forEach(k=>s.relationships[k]=0);
Object.values(s.devices).forEach(d=>d.status=0);
s.locations.lighting.unlocked=false;
s.activeEvent={id:eventId,...E.EVENT_DEFS[eventId]};
const before=JSON.stringify(s);
const r=E.resolveEvent(s,option.id);
assert.equal(r.ok,false,`${eventId}/${option.id} 条件不足必须失败`);
assert.equal(JSON.stringify(s),before,`${eventId}/${option.id} 条件不足不得留下半成品`);}});
test('事件结算：异常事件 ID、选项 ID 与空事件不得产生任何写入',()=>{
const s=eventReadyState();s.activeEvent={id:'ghost',options:[{id:'x',run:st=>{st.resources.energy=-50;}}]};
const before=JSON.stringify(s);
assert.equal(E.resolveEvent(s,'x').ok,false,'未知事件必须被拒绝');
assert.equal(JSON.stringify(s),before,'未知事件不得执行任何回调');
const s2=eventReadyState();s2.activeEvent={id:'fight',...E.EVENT_DEFS.fight};
const before2=JSON.stringify(s2);
assert.equal(E.resolveEvent(s2,'nope').ok,false,'未知选项必须被拒绝');
assert.equal(JSON.stringify(s2),before2,'未知选项不得改变任何状态');
const s3=eventReadyState();
assert.equal(E.resolveEvent(s3,'side').ok,false,'没有突发事件时必须拒绝');
assert.equal(s3.phase,'morning');});
test('事件结算：选项回调抛错时整体回滚且事件保留',()=>{
for(const eventId of EVENT_IDS){
const def=E.EVENT_DEFS[eventId];
for(const option of def.options){
const orig=option.run;
option.run=()=>{throw new Error('boom');};
try{
const s=eventReadyState();s.activeEvent={id:eventId,...def};
const before=JSON.stringify(s);
const r=E.resolveEvent(s,option.id);
assert.equal(r.ok,false,`${eventId}/${option.id} 回调抛错必须失败`);
assert.equal(JSON.stringify(s),before,`${eventId}/${option.id} 回调抛错不得留下半成品`);
assert.ok(s.activeEvent,`${eventId}/${option.id} 抛错后事件必须保留可重试`);
assert.equal(s.eventLog.length,0,`${eventId}/${option.id} 抛错不得写入事件日志`);
assert.equal(s.log.length,0,`${eventId}/${option.id} 抛错不得写入通讯日志`);
}finally{option.run=orig;}}}});
test('事件结算：序列化后再执行与直接执行结果一致',()=>{
for(const eventId of EVENT_IDS)for(const option of E.EVENT_DEFS[eventId].options){
const a=eventReadyState();a.activeEvent={id:eventId,...E.EVENT_DEFS[eventId]};
const b=JSON.parse(JSON.stringify(a));
assert.equal(b.activeEvent.options[0].run,undefined,'序列化后的 activeEvent 不应保留函数');
const ra=E.resolveEvent(a,option.id),rb=E.resolveEvent(b,option.id);
assert.equal(ra.ok,rb.ok,`${eventId}/${option.id} 序列化前后成败必须一致`);
assert.equal(JSON.stringify(a),JSON.stringify(b),`${eventId}/${option.id} 序列化前后结算结果必须一致`);}});
test('事件结算：合法选项资源不足时安全落到下限而非负数',()=>{
const s1=eventReadyState();s1.resources.energy=0;s1.resources.expectation=0;
s1.activeEvent={id:'audience',...E.EVENT_DEFS.audience};
assert.equal(E.resolveEvent(s1,'preview').ok,true);
assert.equal(s1.resources.energy,0);assert.equal(s1.resources.expectation,16);
const s2=eventReadyState();s2.resources.energy=0;
s2.activeEvent={id:'overheat',...E.EVENT_DEFS.overheat};
assert.equal(E.resolveEvent(s2,'cool').ok,true);
assert.equal(s2.resources.energy,0);assert.equal(s2.actions,3);
const s3=eventReadyState();s3.resources.credits=25;s3.resources.expectation=0;
s3.activeEvent={id:'absence',...E.EVENT_DEFS.absence};
assert.equal(E.resolveEvent(s3,'robot').ok,true);
assert.equal(s3.resources.credits,0);assert.equal(s3.resources.expectation,0);});
test('回归：多日事件与结算全流程（含序列化分叉一致性）',()=>{
const play=(s,rng,days)=>{for(const day of days){
assert.equal(s.day,day);
const gu=E.getMember(s,'gu');
if(s.actions>=1){
if(gu.fatigue>60)E.restMember(s,'gu');
else if(s.resources.energy>=5&&s.resources.parts>=1&&Object.values(s.devices).some(d=>d.status<85))E.repairAction(s,'gu',12,true);}
const ev=E.maybeTriggerEvent(s,rng);
assert.ok(ev,`第 ${day} 天必须触发事件`);
const option=ev.options.find(o=>!o.need||o.need(s));
assert.ok(option,`第 ${day} 天事件 ${ev.id} 必须存在可行选项`);
const r=E.resolveEvent(s,option.id);
assert.ok(r.ok,`第 ${day} 天事件 ${ev.id}/${option.id} 必须结算成功：${r.reason}`);
assertEventResourceInvariants(s,`第 ${day} 天事件后`);
assert.equal(E.resolveEvent(s,option.id).ok,false,`第 ${day} 天事件不得重复提交`);
E.endDay(s);
assertEventResourceInvariants(s,`第 ${day} 天结算后`);}};
const s=eventReadyState();
play(s,E.makeRng(7),[1,2,3,4]);
const restored=JSON.parse(JSON.stringify(s));
play(s,E.makeRng(99),[5,6,7,8,9]);
play(restored,E.makeRng(99),[5,6,7,8,9]);
assert.equal(JSON.stringify(s),JSON.stringify(restored),'序列化后继续执行必须得到完全一致的状态');
assert.equal(s.day,10);
assert.equal(s.phase,'performance');
const entries=s.eventLog.filter(e=>e.type==='event');
assert.equal(entries.length,9,'每天必须恰好结算一条事件');
assert.equal(new Set(entries.map(e=>e.key)).size,entries.length,'事件日志不得重复');});
