import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { resolveTraining } from '../js/engine-actions.mjs';
import { checkUnlocks, isLocationOpen, completeStory, nextStory } from '../js/engine-story.mjs';

test('初始：灯光室/维修舱/观众席锁定，其余开放', () => {
  const s = freshState();
  assert.equal(s.locations.light.unlocked, false);
  assert.equal(s.locations.repair.unlocked, false);
  assert.equal(s.locations.audience.unlocked, false);
  assert.equal(isLocationOpen(s, 'stage').open, true);
  assert.equal(isLocationOpen(s, 'light').open, false);
});

test('完成一次主舞台应急检修后维修舱解锁', () => {
  const s = freshState();
  s.resources.parts = 50;
  resolveTraining(s, 'bob', 'fixQuick', 0.9);
  checkUnlocks(s);
  assert.equal(s.flags.fixedStageOnce, true);
  assert.equal(s.locations.repair.unlocked, true);
});

test('与织女星完成第1段剧情后灯光室解锁', () => {
  const s = freshState();
  s.members.vega.trust = 40;
  const story = nextStory(s, 'vega');
  assert.ok(story);
  completeStory(s, 'vega', story, 0);
  assert.equal(s.locations.light.unlocked, true);
});

test('第4天观众席自动开放', () => {
  const s = freshState();
  s.day = 4;
  checkUnlocks(s);
  assert.equal(s.locations.audience.unlocked, true);
});

test('设备状态随维修改变（完整度提升）', () => {
  const s = freshState();
  s.resources.parts = 100;
  const before = s.devices.hydraulics.integrity;
  resolveTraining(s, 'bob', 'repair', 1);
  assert.ok(s.devices.hydraulics.integrity > before);
});

test('设备完整度上下限被钳制在 0-100', () => {
  const s = freshState();
  s.resources.parts = 999;
  for (let i = 0; i < 30; i++) {
    s.resources.parts = 999;
    resolveTraining(s, 'bob', 'repair', 1);
  }
  for (const d of Object.values(s.devices)) {
    assert.ok(d.integrity <= 100);
    assert.ok(d.integrity >= 0);
  }
});

test('区域可因事故暂时关闭并在到期后开放', () => {
  const s = freshState();
  s.locations.stage.closedUntil = 3;
  s.day = 2;
  assert.equal(isLocationOpen(s, 'stage').open, false);
  s.day = 3;
  checkUnlocks(s);
  assert.equal(isLocationOpen(s, 'stage').open, true);
});
