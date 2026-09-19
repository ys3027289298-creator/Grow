import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { saveGame, loadGame, hasSave, deleteSave, SAVE_FIELDS } from '../js/engine-save.mjs';
import { resolveTraining } from '../js/engine-actions.mjs';
import { createFinale } from '../js/engine-finale.mjs';

test('保存后可读取，日期/成员/资源一致', () => {
  deleteSave('auto');
  const s = freshState();
  s.day = 5;
  resolveTraining(s, 'lin', 'lines', 0.9);
  saveGame(s, 'auto');
  assert.equal(hasSave(), true);
  const p = loadGame('auto');
  assert.equal(p.state.day, 5);
  assert.ok(p.state.members.lin.exp.act > 0);
  assert.equal(p.state.resources.energy, s.resources.energy);
});

test('存档包含所有规定字段：设备、事件、区域、演出进度', () => {
  const s = freshState();
  s.eventHistory.push({ id: 'blackout', title: '舞台断电', day: 2 });
  createFinale(s, defaultLineupSafe(s));
  saveGame(s, 'auto');
  const loaded = loadGame('auto').state;
  for (const f of SAVE_FIELDS) {
    assert.ok(f in loaded, `缺少字段 ${f}`);
  }
  assert.ok(loaded.finale !== null);
  assert.equal(loaded.eventHistory.length, 1);
  assert.ok(loaded.locations && 'light' in loaded.locations);
  assert.ok(loaded.devices && 'hydraulics' in loaded.devices);
});

function defaultLineupSafe(s) {
  return { lead: 'lin', understudy: 'kai', light: 'vega', engineer: 'bob',
    lightSequence: 'standard', backupPlan: 'none' };
}

test('删除存档后无法继续', () => {
  const s = freshState();
  saveGame(s, 'auto');
  deleteSave('auto');
  assert.equal(loadGame('auto'), null);
  assert.equal(hasSave(), false);
});

test('手动存档与自动存档互不覆盖（读取最近一次）', () => {
  deleteSave('auto'); deleteSave('manual');
  const a = freshState(); a.day = 2; saveGame(a, 'auto');
  const m = freshState(); m.day = 7; saveGame(m, 'manual');
  assert.equal(loadGame('manual').state.day, 7);
  assert.equal(loadGame('auto').state.day, 2);
});
