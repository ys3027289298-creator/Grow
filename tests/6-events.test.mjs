import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { EVENTS, resolveEvent, availableChoices, pickEvent } from '../js/engine-events.mjs';

function getEvent(id) {
  return EVENTS.find(e => e.id === id);
}

test('突发事件总数不少于 10 种', () => {
  assert.ok(EVENTS.length >= 10, `实际 ${EVENTS.length} 种`);
});

test('每个事件至少两个选项', () => {
  for (const e of EVENTS) assert.ok(e.choices.length >= 2, `${e.title} 选项不足`);
});

test('断电：技术达标可合闸（供能上升）；否则只能撤离（排练下降+延迟效果）', () => {
  const s1 = freshState();
  s1.members.bob.stats.tech = 8;
  const ev = getEvent('blackout');
  resolveEvent(s1, ev, 0);
  assert.ok(s1.devices.power.integrity > 55);

  const s2 = freshState();
  s2.resources.rehearsal = 40;
  const r0 = s2.resources.rehearsal;
  resolveEvent(s2, ev, 1);
  assert.ok(s2.resources.rehearsal < r0);
  assert.ok(s2.pendingEffects.some(e => e.type === 'blackoutSurge'));
});

test('争执：关系不足时和解选项不可用，强行分开降低关系', () => {
  const s = freshState();
  // 初始 lin-kai 关系 35
  const ev = getEvent('fight');
  const choices = availableChoices(s, ev);
  assert.equal(choices[0].enabled, false);
  assert.equal(choices[1].enabled, true);
  const r0 = s.relations['lin>kai'];
  resolveEvent(s, ev, 1);
  assert.ok(s.relations['lin>kai'] < r0);
});

test('争执：关系达标后和解成功并提升排练', () => {
  const s = freshState();
  s.relations['lin>kai'] = 60;
  s.relations['kai>lin'] = 60;
  const r0 = s.resources.rehearsal;
  resolveEvent(s, getEvent('fight'), 0);
  assert.ok(s.resources.rehearsal > r0);
});

test('道具损坏：三个分支（零件修复/织女星替代/放任）结果不同', () => {
  const s1 = freshState();
  s1.resources.parts = 30;
  const p0 = s1.resources.props;
  resolveEvent(s1, getEvent('props'), 0);
  assert.ok(s1.resources.props > p0);

  const s2 = freshState();
  s2.members.vega.stats.focus = 9;
  resolveEvent(s2, getEvent('props'), 1);
  assert.equal(s2.flags.auroraReady, true);

  const s3 = freshState();
  const p3 = s3.resources.props;
  resolveEvent(s3, getEvent('props'), 2);
  assert.ok(s3.resources.props < p3);
});

test('选择条件不满足的选项会被拒绝', () => {
  const s = freshState();
  s.members.kai.stats.reaction = 2;
  const r = resolveEvent(s, getEvent('earlyAudience'), 0);
  assert.equal(r.ok, false);
});

test('事件被写入事件记录，包含天数与结果', () => {
  const s = freshState();
  resolveEvent(s, getEvent('overheat'), 1);
  assert.equal(s.eventHistory.length, 1);
  assert.equal(s.eventHistory[0].id, 'overheat');
  assert.equal(s.eventHistory[0].day, 1);
  assert.ok(s.eventHistory[0].outcome.length > 0);
});

test('抽取器在未见过事件时优先返回新事件', () => {
  // 已见事件全部排除：池中只剩未见过的一个，必抽中它
  const s = freshState();
  const target = EVENTS[2];
  s.eventHistory = EVENTS.filter(e => e.id !== target.id).map(e => ({ id: e.id }));
  assert.equal(pickEvent(s, () => 0.99).id, target.id);
  assert.equal(pickEvent(s, () => 0).id, target.id);
});

test('撤资事件两个分支都实际改变资金', () => {
  const s1 = freshState();
  s1.members.bob.trust = 80;
  const f0 = s1.resources.funds;
  resolveEvent(s1, getEvent('sponsor'), 0);
  assert.ok(s1.resources.funds > f0);

  const s2 = freshState();
  const f2 = s2.resources.funds;
  resolveEvent(s2, getEvent('sponsor'), 1);
  assert.ok(s2.resources.funds < f2);
});
