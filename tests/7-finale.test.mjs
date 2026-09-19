import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import {
  defaultLineup, createFinale, FINALE_PHASES, resolveCue, computeEnding
} from '../js/engine-finale.mjs';

function buffState(s) {
  s.resources.rehearsal = 100;
  s.resources.hype = 100;
  s.resources.props = 100;
  for (const d of Object.values(s.devices)) d.integrity = 100;
  for (const m of Object.values(s.members)) {
    for (const k of Object.keys(m.stats)) m.stats[k] = 10;
    m.fatigue = 0; m.stress = 0; m.trust = 100;
  }
  for (const k of Object.keys(s.relations)) s.relations[k] = 100;
  s.flags.auroraReady = true;
  s.flags.understudyReady = true;
  s.flags.linFinaleReady = true;
  s.flags.kaiFinaleReady = true;
  s.flags.vegaFinaleReady = true;
  s.flags.bobFinaleReady = true;
}

function weakenState(s) {
  s.resources.rehearsal = 5;
  s.resources.hype = 10;
  s.resources.props = 15;
  for (const d of Object.values(s.devices)) d.integrity = 15;
  for (const m of Object.values(s.members)) {
    for (const k of Object.keys(m.stats)) m.stats[k] = 2;
    m.fatigue = 95; m.stress = 90; m.trust = 10;
  }
  for (const k of Object.keys(s.relations)) s.relations[k] = 20;
}

function runAllCues(s, quality) {
  for (let i = 0; i < FINALE_PHASES.length; i++) {
    s.finale.step = i + 1;
    resolveCue(s, quality);
  }
}

test('结局1：完美谢幕（全满准备 + 玩家全完美操作）', () => {
  const s = freshState();
  buffState(s);
  createFinale(s, defaultLineup(s));
  runAllCues(s, 1);
  const r = computeEnding(s);
  assert.equal(r.endingId, 'perfect', `总分 ${r.total}`);
  assert.equal(r.successCount, 3);
});

test('结局4：演出失败（准备极差 + 玩家失误操作）', () => {
  const s = freshState();
  weakenState(s);
  createFinale(s, defaultLineup(s));
  runAllCues(s, 0);
  const r = computeEnding(s);
  assert.equal(r.endingId, 'fail', `总分 ${r.total}`);
});

test('结局3：中途失控勉强结束（中等准备 + 操作一般）', () => {
  const s = freshState();
  s.resources.rehearsal = 35;
  s.resources.hype = 35;
  s.resources.props = 40;
  for (const d of Object.values(s.devices)) d.integrity = 40;
  for (const m of Object.values(s.members)) {
    m.fatigue = 55; m.stress = 50; m.trust = 40;
  }
  createFinale(s, defaultLineup(s));
  runAllCues(s, 0.35);
  const r = computeEnding(s);
  assert.equal(r.endingId, 'rough', `总分 ${r.total}, 成功 ${r.successCount}`);
  assert.ok(r.reasons.length >= 1);
});

test('结局2：演出完成但剧院关闭（准备不错 + 操作稳但不完美）', () => {
  const s = freshState();
  s.resources.rehearsal = 70;
  s.resources.hype = 65;
  s.resources.props = 70;
  for (const d of Object.values(s.devices)) d.integrity = 65;
  for (const m of Object.values(s.members)) {
    m.fatigue = 30; m.stress = 30; m.trust = 60;
  }
  s.flags.understudyReady = true;
  createFinale(s, defaultLineup(s));
  runAllCues(s, 0.7);
  const r = computeEnding(s);
  assert.ok(['closed', 'perfect'].includes(r.endingId), `总分 ${r.total}`);
  // 若出现 perfect，则将光控员换成低技术者并降到一般操作，验证 closed 档位
  if (r.endingId === 'perfect') {
    const s2 = freshState();
    s2.resources.rehearsal = 58;
    s2.resources.hype = 55;
    s2.resources.props = 55;
    for (const d of Object.values(s2.devices)) d.integrity = 55;
    for (const m of Object.values(s2.members)) { m.fatigue = 40; m.stress = 40; m.trust = 50; }
    createFinale(s2, defaultLineup(s2));
    runAllCues(s2, 0.55);
    const r2 = computeEnding(s2);
    assert.equal(r2.endingId, 'closed', `档位测试总分 ${r2.total}`);
  }
});

test('现场操作分真实受成员属性影响：高技术灯光师得分更高', () => {
  const sHi = freshState();
  buffState(sHi);
  createFinale(sHi, defaultLineup(sHi));
  sHi.finale.step = 1;
  const hi = resolveCue(sHi, 0.7);

  const sLo = freshState();
  weakenState(sLo);
  createFinale(sLo, defaultLineup(sLo));
  sLo.finale.step = 1;
  const lo = resolveCue(sLo, 0.7);
  assert.ok(hi.score > lo.score);
});

test('结局结果包含观众反馈、成员成长与失败原因', () => {
  const s = freshState();
  weakenState(s);
  createFinale(s, defaultLineup(s));
  runAllCues(s, 0.1);
  const r = computeEnding(s);
  assert.ok(r.audience.length > 10);
  assert.ok(r.evaluation.growth.length > 0);
  assert.ok(r.reasons.length >= 1);
  assert.ok(typeof r.durationMs === 'number');
});

test('演出必须经历三次现场判定，不能一键结算', () => {
  const s = freshState();
  buffState(s);
  createFinale(s, defaultLineup(s));
  assert.equal(s.finale.cueResults.length, 0);
  s.finale.step = 1;
  resolveCue(s, 1);
  assert.equal(s.finale.cueResults.length, 1);
  s.finale.step = 2;
  resolveCue(s, 1);
  assert.equal(s.finale.cueResults.length, 2);
  s.finale.step = 3;
  resolveCue(s, 1);
  assert.equal(s.finale.cueResults.length, 3);
});
