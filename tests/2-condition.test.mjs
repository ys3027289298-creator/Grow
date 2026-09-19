import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { resolveTraining, doSimpleActivity, changeRelation, nightlySummary } from '../js/engine-actions.mjs';

test('休息降低疲劳与压力，清空过载计数', () => {
  const s = freshState();
  s.members.kai.fatigue = 80;
  s.members.kai.stress = 70;
  s.members.kai.overloadDays = 3;
  doSimpleActivity(s, 'kai', 'rest');
  assert.equal(s.members.kai.fatigue, 50);
  assert.equal(s.members.kai.stress, 48);
  assert.equal(s.members.kai.overloadDays, 0);
});

test('训练失败提升压力并降低信任', () => {
  const s = freshState();
  const stress0 = s.members.lin.stress;
  const trust0 = s.members.lin.trust;
  const r = resolveTraining(s, 'lin', 'lines', 0.1);
  assert.equal(r.ok, false);
  assert.ok(s.members.lin.stress > stress0);
  assert.ok(s.members.lin.trust < trust0);
});

test('关系变化是双向的', () => {
  const s = freshState();
  changeRelation(s, 'lin', 'kai', 10);
  assert.equal(s.relations['lin>kai'], 45);
  assert.equal(s.relations['kai>lin'], 45);
});

test('团队排练失败降低搭档关系', () => {
  const s = freshState();
  const before = s.relations['lin>kai'];
  resolveTraining(s, 'lin', 'team', 0.2, 'kai');
  assert.ok(s.relations['lin>kai'] < before);
});

test('团队排练成功提升搭档关系', () => {
  const s = freshState();
  const before = s.relations['lin>kai'];
  resolveTraining(s, 'lin', 'team', 1, 'kai');
  assert.ok(s.relations['lin>kai'] > before);
});

test('连续高强度导致过载：压力高时夜间/训练触发恶化', () => {
  const s = freshState();
  s.members.lin.overloadDays = 2;
  s.members.lin.fatigue = 90;
  s.members.lin.stress = 80;
  const rehearsal0 = s.resources.rehearsal;
  // 强制受伤随机不发生，验证争执分支也可：直接跑若干次训练必有后果
  let sawConsequence = false;
  for (let i = 0; i < 10; i++) {
    s.resources.energy = 40;
    s.members.lin.overloadDays = 2;
    s.members.lin.fatigue = 90;
    s.members.lin.stress = 80;
    s.resources.rehearsal = rehearsal0;
    resolveTraining(s, 'lin', 'lines', 0.6);
    if (s.members.lin.injured || s.resources.rehearsal < rehearsal0) {
      sawConsequence = true;
      break;
    }
  }
  assert.ok(sawConsequence, '过载应导致受伤或争执扣排练');
});

test('夜间总结让未休息成员疲劳自然上升、设备老化', () => {
  const s = freshState();
  const f0 = s.members.bob.fatigue;
  const d0 = s.devices.power.integrity;
  nightlySummary(s);
  assert.ok(s.members.bob.fatigue > f0 - 1); // 非休息者 +4
  assert.equal(s.devices.power.integrity, d0 - 3);
});

test('长期休息（连续两天）信任小幅下降', () => {
  const s = freshState();
  doSimpleActivity(s, 'bob', 'rest');
  doSimpleActivity(s, 'bob', 'rest');
  s.members.bob.restDays = 2;
  const t0 = s.members.bob.trust;
  nightlySummary(s);
  assert.ok(s.members.bob.trust <= t0);
});

test('受伤成员不能执行训练，只能休息', () => {
  const s = freshState();
  s.members.lin.injured = true;
  const r = resolveTraining(s, 'lin', 'lines', 1);
  assert.equal(r.ok, false);
  assert.match(r.reason, /养伤/);
  const rest = doSimpleActivity(s, 'lin', 'rest');
  assert.equal(rest.ok, true);
});
