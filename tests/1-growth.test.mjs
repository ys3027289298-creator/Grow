import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { resolveTraining, doSimpleActivity } from '../js/engine-actions.mjs';

test('训练成功：表演属性真实成长，且成长计入经验', () => {
  const s = freshState();
  const before = s.members.lin.stats.act;
  const r = resolveTraining(s, 'lin', 'lines', 0.95);
  assert.equal(r.ok, true);
  assert.ok(s.members.lin.stats.act > before, '表演应上升');
  assert.ok(s.members.lin.exp.act > 0, '经验应累计');
});

test('高质量操作收益高于低质量操作', () => {
  const s1 = freshState();
  const s2 = freshState();
  resolveTraining(s1, 'kai', 'react', 1);
  resolveTraining(s2, 'kai', 'react', 0.56);
  const g1 = s1.members.kai.exp.reaction;
  const g2 = s2.members.kai.exp.reaction;
  assert.ok(g1 > g2, `高质量(${g1}) 应大于低质量(${g2})`);
});

test('属性上限为 10，不会无限增长', () => {
  const s = freshState();
  for (let i = 0; i < 20; i++) {
    s.resources.energy = 40;
    resolveTraining(s, 'bob', 'repair', 1);
    s.members.bob.fatigue = 0; s.members.bob.stress = 0;
  }
  assert.ok(s.members.bob.stats.tech <= 10);
});

test('训练同时提升排练进度（成长真实影响排练）', () => {
  const s = freshState();
  const before = s.resources.rehearsal;
  resolveTraining(s, 'lin', 'lines', 0.9);
  assert.ok(s.resources.rehearsal > before);
});

test('每名成员至少有两条发展路线（剧情第2段提供两个选项）', async () => {
  const { STORIES } = await import('../js/engine-story.mjs');
  for (const id of ['lin', 'kai', 'vega', 'bob']) {
    const routeStory = STORIES[id].find(st => st.choices);
    assert.ok(routeStory, `${id} 应有路线选择剧情`);
    assert.ok(routeStory.choices.length >= 2, `${id} 至少两条路线`);
  }
});

test('每名成员至少三段个人剧情', async () => {
  const { STORIES } = await import('../js/engine-story.mjs');
  for (const id of ['lin', 'kai', 'vega', 'bob']) {
    assert.equal(STORIES[id].length, 3);
  }
});

test('谈心属于成长：提升信任并计入 trust 经验', () => {
  const s = freshState();
  const before = s.members.vega.trust;
  doSimpleActivity(s, 'vega', 'talk');
  assert.ok(s.members.vega.trust > before);
  assert.ok(s.members.vega.exp.trust > 0);
});
