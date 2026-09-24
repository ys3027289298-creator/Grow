import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.js';

const RESOURCE_KEYS=Object.keys(E.RESOURCE_LIMITS);
const fresh=()=>{const s=E.createInitialState();s.rngSeed=1;return s;};
const forceEvent=(s,id)=>{s.activeEvent={id,...E.EVENT_DEFS[id]};s.phase='event';return s.activeEvent;};
const snap=s=>JSON.stringify(s);

function assertResourceInvariants(s,ctx){
  assert.ok(s.resources&&typeof s.resources==='object',`${ctx}: resources 必须存在`);
  for(const k of RESOURCE_KEYS){
    const[min,max]=E.RESOURCE_LIMITS[k];
    const v=s.resources[k];
    assert.equal(typeof v,'number',`${ctx}: ${k} 必须是数字，实际为 ${String(v)}`);
    assert.ok(Number.isFinite(v),`${ctx}: ${k} 必须是有限值，实际为 ${String(v)}`);
    assert.ok(v>=min&&v<=max,`${ctx}: ${k}=${v} 越界 [${min},${max}]`);
  }
}

const fixtures={
  '全为0':s=>{for(const k of RESOURCE_KEYS)s.resources[k]=0;},
  '边界值1':s=>{for(const k of RESOURCE_KEYS)s.resources[k]=1;},
  '中等':s=>{Object.assign(s.resources,{energy:50,parts:3,credits:60,rehearsalTime:2,props:50,expectation:50});},
  '刚好上限':s=>{for(const k of RESOURCE_KEYS)s.resources[k]=E.RESOURCE_LIMITS[k][1];},
  '超过上限':s=>{for(const k of RESOURCE_KEYS)s.resources[k]=E.RESOURCE_LIMITS[k][1]+50;},
  '字段全缺':s=>{s.resources={};},
  '字段部分缺':s=>{delete s.resources.energy;delete s.resources.parts;delete s.resources.expectation;},
  '非法值':s=>{Object.assign(s.resources,{energy:NaN,parts:undefined,credits:Infinity,rehearsalTime:-30,props:'x',expectation:null});},
  '条件充裕':s=>{Object.assign(s.resources,{energy:200,parts:200,credits:999,rehearsalTime:200,props:200,expectation:200});s.members.forEach(m=>Object.assign(m,{acting:95,tech:95,reaction:95,trust:95}));Object.keys(s.relationships).forEach(k=>s.relationships[k]=90);Object.values(s.devices).forEach(d=>d.status=95);s.locations.lighting.unlocked=true;},
};

test('表驱动：全部事件 × 全部选项 × 全部资源状态，不变量与事务性成立',()=>{
  let okCount=0,failCount=0;
  for(const[eventId,def]of Object.entries(E.EVENT_DEFS)){
    for(const option of def.options){
      for(const[fxName,fx]of Object.entries(fixtures)){
        const s=fresh();fx(s);forceEvent(s,eventId);
        const before=snap(s);
        const r=E.resolveEvent(s,option.id);
        const ctx=`${eventId}/${option.id}/${fxName}`;
        if(r.ok){
          okCount++;
          assertResourceInvariants(s,ctx);
          assert.equal(s.activeEvent,null,`${ctx}: 成功后 activeEvent 必须清空`);
          assert.equal(s.phase,'night',`${ctx}: 成功后阶段必须为 night`);
          assert.equal(s.flags.eventDoneToday,true,`${ctx}: 成功后必须标记今日事件已完成`);
          const entries=s.eventLog.filter(e=>e.type==='event'&&e.key===eventId&&e.day===s.day);
          assert.equal(entries.length,1,`${ctx}: 事件日志必须唯一`);
          assert.equal(entries[0].choice,option.label,`${ctx}: 日志选项必须一致`);
        }else{
          failCount++;
          assert.equal(snap(s),before,`${ctx}: 失败必须完整回滚，不得留下任何半成品`);
        }
      }
    }
  }
  assert.ok(okCount>0&&failCount>0,`表驱动必须同时覆盖成功(${okCount})与失败(${failCount})分支`);
});

test('异常事件 ID 与选项 ID 不产生任何副作用',()=>{
  const s=fresh();const before=snap(s);
  assert.equal(E.resolveEvent(s,'x').ok,false);
  assert.equal(snap(s),before,'无活动事件时不得改动状态');
  forceEvent(s,'blackout');const armed=snap(s);
  for(const bad of['nope','',null,undefined,42,{},['cut']]){
    assert.equal(E.resolveEvent(s,bad).ok,false,`非法选项 ${String(bad)}`);
    assert.equal(snap(s),armed,'非法选项不得改动状态');
  }
  const ghost=fresh();ghost.activeEvent={id:'ghost-event'};ghost.phase='event';const g=snap(ghost);
  assert.equal(E.resolveEvent(ghost,'a').ok,false);
  assert.equal(snap(ghost),g,'异常事件 ID 不得改动状态');
  const noOpts=fresh();noOpts.activeEvent={id:'blackout',title:'t'};noOpts.phase='event';
  assert.equal(E.resolveEvent(noOpts,'cut').ok,true,'选项表缺失时应回退到 EVENT_DEFS 定义');
});

test('选项回调抛错时完整回滚（资源、设备、成员、标记、日志、阶段、activeEvent）',()=>{
  const s=fresh();
  s.activeEvent={id:'blackout',title:'舞台断电',options:[{id:'boom',label:'爆炸',run:st=>{st.resources.credits=0;st.devices.power.status=1;st.members[0].fatigue=99;st.flags.sponsorLeft=true;st.eventLog.push({day:1,type:'event',key:'blackout'});st.log.unshift({day:1,title:'x'});st.phase='night';st.activeEvent=null;throw new Error('boom');}}]};
  s.phase='event';
  const before=snap(s);
  const r=E.resolveEvent(s,'boom');
  assert.equal(r.ok,false);
  assert.equal(snap(s),before,'回调抛错后状态必须与执行前完全一致');
  assert.ok(s.activeEvent,'activeEvent 必须保留且可重试');
  assert.equal(E.resolveEvent(s,'boom').ok,false,'重试仍失败且不累积副作用');
  assert.equal(snap(s),before);
});

test('条件判断抛错同样完整回滚',()=>{
  const s=fresh();
  s.activeEvent={id:'fight',title:'成员争执',options:[{id:'bad',label:'坏条件',need:()=>{throw new Error('need boom');},run:()=>'x'}]};
  s.phase='event';
  const before=snap(s);
  assert.equal(E.resolveEvent(s,'bad').ok,false);
  assert.equal(snap(s),before);
});

test('资源不足时安全落到下限且其余结果一致',()=>{
  const s=fresh();s.resources.energy=3;s.locations.lighting.unlocked=true;s.devices.lights.status=80;
  forceEvent(s,'audience');
  const r=E.resolveEvent(s,'preview');
  assert.equal(r.ok,true);
  assert.equal(s.resources.energy,0,'能源落到下限 0 而非负数');
  assert.equal(s.resources.expectation,42+16,'期待值照常结算');
  assert.equal(s.flags.earlyAudience,true,'标记照常写入');
  assertResourceInvariants(s,'preview/能源不足');
  const s2=fresh();s2.resources.credits=10;
  forceEvent(s2,'absence');
  assert.equal(E.resolveEvent(s2,'robot').ok,false,'条件不足不得扣款');
  assert.equal(s2.resources.credits,10);
});

test('资源增加仍遵守原上限',()=>{
  const s=fresh();s.resources.credits=995;s.resources.energy=195;
  forceEvent(s,'sponsor');
  assert.equal(E.resolveEvent(s,'crowd').ok,true);
  assert.equal(s.resources.credits,999,'资金封顶 999');
  assert.equal(s.resources.energy,187);
  const s2=fresh();s2.resources.energy=195;s2.resources.expectation=198;
  forceEvent(s2,'blackout');
  assert.equal(E.resolveEvent(s2,'cut').ok,true);
  assert.equal(s2.resources.energy,200,'能源封顶 200');
  assert.equal(s2.resources.expectation,198-9);
});

test('资源字段缺失时被修复为完整合法状态',()=>{
  const s=fresh();s.resources={credits:10};
  forceEvent(s,'fight');
  assert.equal(E.resolveEvent(s,'side').ok,true);
  assertResourceInvariants(s,'字段缺失修复');
  for(const k of RESOURCE_KEYS)assert.ok(k in s.resources,`${k} 必须被补齐`);
});

test('安全网：未来选项直接裸写资源也被钳制，不依赖调用方自觉',()=>{
  const s=fresh();s.resources.energy=3;
  s.activeEvent={id:'blackout',title:'t',options:[{id:'raw',label:'raw',run:st=>{st.resources.energy-=7;st.resources.credits+=5000;st.resources.expectation-=999;st.resources.props=NaN;return'raw';}}]};
  s.phase='event';
  assert.equal(E.resolveEvent(s,'raw').ok,true);
  assert.equal(s.resources.energy,0);
  assert.equal(s.resources.credits,999);
  assert.equal(s.resources.expectation,0);
  assertResourceInvariants(s,'裸写安全网');
});

test('确定性：同一输入多次执行结果一致，且不得重复提交或重复写日志',()=>{
  for(const[eventId,def]of Object.entries(E.EVENT_DEFS)){
    for(const option of def.options){
      const a=fresh(),b=fresh();
      fixtures['条件充裕'](a);fixtures['条件充裕'](b);
      forceEvent(a,eventId);forceEvent(b,eventId);
      const ra=E.resolveEvent(a,option.id),rb=E.resolveEvent(b,option.id);
      assert.equal(ra.ok,rb.ok,`${eventId}/${option.id} 确定性`);
      assert.equal(snap(a),snap(b),`${eventId}/${option.id} 相同输入必须产生相同状态`);
      const settled=snap(a),logLen=a.log.length,evLen=a.eventLog.length;
      const again=E.resolveEvent(a,option.id);
      assert.equal(again.ok,false,`${eventId}/${option.id} 重复执行必须被拒绝`);
      assert.equal(snap(a),settled,`${eventId}/${option.id} 重复执行不得改动状态`);
      assert.equal(a.log.length,logLen,'不得重复写通讯日志');
      assert.equal(a.eventLog.length,evLen,'不得重复写事件日志');
    }
  }
});

test('序列化往返后再执行，与直接执行结果完全一致',()=>{
  for(const eventId of Object.keys(E.EVENT_DEFS)){
    for(const option of E.EVENT_DEFS[eventId].options){
      const direct=fresh();fixtures['条件充裕'](direct);forceEvent(direct,eventId);
      const revived=JSON.parse(JSON.stringify(direct));
      const r1=E.resolveEvent(direct,option.id);
      const r2=E.resolveEvent(revived,option.id);
      assert.equal(r2.ok,r1.ok,`${eventId}/${option.id} 序列化后结果一致`);
      assert.equal(r1.ok,true,`${eventId}/${option.id} 条件充裕时必须成功`);
      assert.equal(snap(revived),snap(direct),`${eventId}/${option.id} 序列化后状态一致`);
    }
  }
});

test('回归：多天事件与结算流程，不变量、日志唯一性全程成立',()=>{
  const s=fresh();const rng=E.makeRng(42);
  let guard=0,resolved=0;
  while(!s.ended&&guard++<80){
    assertResourceInvariants(s,`第${s.day}天 ${s.phase}`);
    if(s.phase==='morning'&&s.day<10){
      const ev=E.maybeTriggerEvent(s,rng);
      if(ev){
        const chosen=ev.options.find(o=>{try{return!o.need||o.need(s);}catch{return false;}})||ev.options[0];
        const r=E.resolveEvent(s,chosen.id);
        assert.equal(r.ok,true,`第${s.day}天事件 ${ev.id}/${chosen.id} 必须成功`);
        resolved++;
        assertResourceInvariants(s,`第${s.day}天事件后`);
      }
      E.endDay(s);
    }else if(s.phase==='performance'){
      if(s.performance.stage==='prep')E.confirmPerformanceSetup(s,{lead:'lin',understudy:'qing',engineer:'gu',firstLight:'mika',backup:'battery'});
      else if(s.performance.stage==='cue'){const cue=E.performanceCueInfo(s);const o=cue.options.find(x=>{try{return!x.need||x.need(s,s.performance);}catch{return false;}})||cue.options[0];E.resolvePerformanceCue(s,o.id,.7);}
      else break;
    }else E.endDay(s);
  }
  assert.ok(resolved>=5,'回归流程必须覆盖多个事件');
  assert.equal(s.ended,true,'流程必须推进到演出结算');
  assert.ok(s.performance&&typeof s.performance.total==='number'&&Number.isFinite(s.performance.total),'演出总分必须有限');
  const eventKeys=s.eventLog.filter(e=>e.type==='event').map(e=>`${e.day}:${e.key}`);
  assert.equal(new Set(eventKeys).size,eventKeys.length,'事件日志全程不得重复');
  assertResourceInvariants(s,'结算后');
});
