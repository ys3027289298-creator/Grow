import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from './helpers.mjs';
import { resolveTraining } from '../js/engine-actions.mjs';
import { applyDueEffects } from '../js/engine-events.mjs';

test('训练成功：对应属性成长且疲劳上升（有代价）', () => {
  const s = freshState();
  const stat0 = s.members.vega.stats.tech;
  const fat0 = s.members.vega.fatigue;
  resolveTraining(s, 'vega', 'light', 0.9);
  assert.ok(s.members.vega.stats.tech > stat0);
  assert.ok(s.members.vega.fatigue > fat0);
});

test('训练失败：浪费能源且损坏相关设备', () => {
  const s = freshState();
  const e0 = s.resources.energy;
  const l0 = s.devices.lights.integrity;
  const r = resolveTraining(s, 'vega', 'light', 0.1);
  assert.equal(r.ok, false);
  assert.ok(s.resources.energy < e0, '能源已被消耗（浪费）');
  assert.ok(s.devices.lights.integrity < l0, '灯光设备受损');
});

test('维修失败损坏设备；维修成功修复设备', () => {
  const sOk = freshState();
  sOk.resources.parts = 50;
  const h0 = sOk.devices.hydraulics.integrity;
  resolveTraining(sOk, 'bob', 'repair', 1);
  assert.ok(sOk.devices.hydraulics.integrity > h0);

  const sBad = freshState();
  sBad.resources.parts = 50;
  const l0 = sBad.devices.lights.integrity;
  resolveTraining(sBad, 'bob', 'repair', 0.1);
  assert.ok(sBad.devices.lights.integrity < l0);
});

test('成功的灯光训练提升灯光阵列完整度', () => {
  const s = freshState();
  const l0 = s.devices.lights.integrity;
  resolveTraining(s, 'vega', 'light', 0.95);
  assert.ok(s.devices.lights.integrity > l0);
});

test('延迟影响在到期日才生效（断电余波扣供能）', () => {
  const s = freshState();
  s.day = 2;
  s.pendingEffects.push({ day: 3, type: 'blackoutSurge', text: '母线再跳火' });
  const p0 = s.devices.power.integrity;
  applyDueEffects(s); // 第2天调用，不生效
  assert.equal(s.devices.power.integrity, p0);
  s.day = 3;
  applyDueEffects(s);
  assert.equal(s.devices.power.integrity, p0 - 10);
  assert.equal(s.pendingEffects.length, 0);
});

test('新台词延迟影响：到期扣排练并增加林压力', () => {
  const s = freshState();
  s.day = 5;
  s.resources.rehearsal = 20;
  s.pendingEffects.push({ day: 5, type: 'newLines', text: '磨词' });
  const r0 = s.resources.rehearsal;
  const p0 = s.members.lin.stress;
  applyDueEffects(s);
  assert.ok(s.resources.rehearsal < r0);
  assert.ok(s.members.lin.stress > p0);
});

test('性格修正：织女星做灯光训练有加成（高质量下稳定成功）', () => {
  const s = freshState();
  const r = resolveTraining(s, 'vega', 'light', 0.6);
  assert.equal(r.ok, true);
});

test('高疲劳高压力会拉低有效质量（同样操作可能翻车）', () => {
  // 0.62 操作分在状态极差时可能低于 0.55 阈值
  const fresh = freshState();
  fresh.members.lin.fatigue = 95;
  fresh.members.lin.stress = 95;
  fresh.members.lin.stats.act = 2;
  const r = resolveTraining(fresh, 'lin', 'lines', 0.62);
  assert.equal(r.ok, false);
});
