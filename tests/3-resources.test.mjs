import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { resolveTraining, doSimpleActivity, canDoActivity } from '../js/engine-actions.mjs';

test('行动消耗能源与行动点', () => {
  const s = freshState();
  const e0 = s.resources.energy;
  resolveTraining(s, 'lin', 'lines', 0.9);
  assert.equal(s.resources.energy, e0 - 8);
  assert.equal(s.ap, 3);
});

test('能源不足时训练取消且不扣行动点', () => {
  const s = freshState();
  s.resources.energy = 5;
  const ap0 = s.ap;
  const r = resolveTraining(s, 'lin', 'lines', 0.9);
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true);
  assert.equal(s.ap, ap0);
});

test('零件不足时维修取消', () => {
  const s = freshState();
  s.resources.parts = 0;
  const r = resolveTraining(s, 'bob', 'repair', 1);
  assert.equal(r.ok, false);
  assert.match(r.reason, /零件/);
});

test('资金不足无法采购', () => {
  const s = freshState();
  s.resources.funds = 10;
  const check = canDoActivity(s, 'bob', 'shopParts');
  assert.equal(check.ok, false);
});

test('采购零件真实扣资金加零件，不能无限获得', () => {
  const s = freshState();
  const f0 = s.resources.funds;
  const p0 = s.resources.parts;
  doSimpleActivity(s, 'bob', 'shopParts');
  assert.equal(s.resources.funds, f0 - 40);
  assert.equal(s.resources.parts, p0 + 25);
});

test('零工获取资金但消耗体力与时间（不能白嫖）', () => {
  const s = freshState();
  const f0 = s.resources.funds;
  const fat0 = s.members.kai.fatigue;
  doSimpleActivity(s, 'kai', 'gig');
  assert.ok(s.resources.funds > f0);
  assert.ok(s.members.kai.fatigue > fat0);
  assert.equal(s.ap, 2);
});

test('行动点耗尽后不能再安排行动', () => {
  const s = freshState();
  s.ap = 0;
  const check = canDoActivity(s, 'lin', 'lines');
  assert.equal(check.ok, false);
});

test('维修训练消耗零件（资源取舍）', () => {
  const s = freshState();
  s.resources.parts = 50;
  resolveTraining(s, 'bob', 'repair', 0.9);
  assert.equal(s.resources.parts, 42);
});

test('后期每日能源上限恶化（资源压力随时间增加）', async () => {
  const { startNextDay } = await import('../js/engine-actions.mjs');
  const s = freshState();
  s.day = 8;
  startNextDay(s);
  assert.equal(s.day, 9);
  assert.ok(s.dailyEnergyMax < 40);
});
