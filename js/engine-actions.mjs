// 行动结算：训练、休息、工作、采购、谈心、团队排练
import { ACTIVITIES, TRAITS, STAT_LABELS, clamp } from './data.mjs';

export function pushLog(state, text, kind = 'info') {
  state.log.unshift({ day: state.day, text, kind, t: Date.now() });
  if (state.log.length > 120) state.log.pop();
}

// 尝试支付行动成本，返回是否可行（不实际扣减）
export function canDoActivity(state, memberId, activityId) {
  const m = state.members[memberId];
  const a = ACTIVITIES[activityId];
  if (!a) return { ok: false, reason: '未知行动' };
  if (state.ap < a.ap) return { ok: false, reason: '今日行动点不足（可进入夜间总结）' };
  if (a.energy > 0 && state.resources.energy < a.energy)
    return { ok: false, reason: `能源不足（需要 ${a.energy}）` };
  if (a.cost) {
    for (const [k, v] of Object.entries(a.cost))
      if (state.resources[k] < v) return { ok: false, reason: '资金不足' };
  }
  if (a.useParts && state.resources.parts < a.useParts)
    return { ok: false, reason: `零件不足（需要 ${a.useParts}）` };
  if (m.injured && activityId !== 'rest')
    return { ok: false, reason: `${TRAITS[memberId].name} 正在养伤` };
  return { ok: true };
}

function applyFatigueStress(m, intensity) {
  const f = Math.round(6 + intensity * 8 + m.overloadDays * 3);
  m.fatigue = clamp(m.fatigue + f);
  return f;
}

// 通用行动（非小游戏）
export function doSimpleActivity(state, memberId, activityId) {
  const check = canDoActivity(state, memberId, activityId);
  if (!check.ok) return check;
  const m = state.members[memberId];
  const a = ACTIVITIES[activityId];
  state.ap -= a.ap;
  if (a.energy > 0) state.resources.energy -= a.energy;
  else if (a.energy < 0) state.resources.energy = clamp(state.resources.energy + (-a.energy), 0, state.dailyEnergyMax + 20);
  if (a.cost) for (const [k, v] of Object.entries(a.cost)) state.resources[k] -= v;
  if (a.gain) for (const [k, v] of Object.entries(a.gain))
    state.resources[k] = k === 'energy' ? clamp(state.resources[k] + v, 0, state.dailyEnergyMax + 20) : state.resources[k] + v;

  if (activityId === 'rest') {
    const fDown = clamp(m.fatigue - 30);
    const sDown = clamp(m.stress - 22);
    m.fatigue = fDown; m.stress = sDown;
    m.overloadDays = 0;
    m.restDays += 1;
    if (m.injured && Math.random() < 0.5) {
      m.injured = false;
      pushLog(state, `${TRAITS[memberId].name} 的伤势好转，重新归队。`, 'good');
    }
    pushLog(state, `${TRAITS[memberId].name} 充分休息，疲劳 -30，压力 -22。`, 'good');
  } else if (activityId === 'gig') {
    state.resources.funds += 55;
    const f = applyFatigueStress(m, 1.2);
    // 老鲍技术高，零工更稳；其他人高压力下可能出小事故
    if (m.stats.tech >= 7) state.resources.funds += 15;
    if (m.fatigue > 75 && Math.random() < 0.35) {
      m.injured = true;
      pushLog(state, `${TRAITS[memberId].name} 零工中被松动的舱门撞伤，进入养伤状态！`, 'bad');
    } else {
      pushLog(state, `${TRAITS[memberId].name} 完成舱外零工，资金 +${m.stats.tech >= 7 ? 70 : 55}，疲劳 +${f}。`, 'info');
    }
    m.overloadDays += 1;
  } else if (activityId === 'talk') {
    m.trust = clamp(m.trust + 8);
    m.stats.trust = clamp(m.stats.trust + 1, 0, 10);
    m.exp.trust += 1;
    m.stress = clamp(m.stress - 8);
    pushLog(state, `你与${TRAITS[memberId].name}深谈，信任 +8，压力 -8。`, 'good');
    return { ok: true, talk: true };
  } else if (activityId.startsWith('shop')) {
    pushLog(state, `完成采购：${a.desc}。`, 'info');
  }
  return { ok: true };
}

// 小游戏训练结算：quality 为玩家操作得分 0~1；partnerId 用于团队排练
export function resolveTraining(state, memberId, activityId, quality, partnerId = null) {
  const check = canDoActivity(state, memberId, activityId);
  if (!check.ok) return { ...check, cancelled: true };
  const m = state.members[memberId];
  const a = ACTIVITIES[activityId];
  state.ap -= a.ap;
  state.resources.energy -= a.energy;
  if (a.useParts) state.resources.parts -= a.useParts;

  const statKey = a.stat;
  const statNow = m.stats[statKey] || 5;
  const cond = clamp(1 - (m.fatigue + m.stress) / 260, 0.25, 1);
  const effective = clamp(quality * cond + statNow / 40, 0, 1);

  // 性格修正
  let traitMod = 0;
  if (memberId === 'lin' && statKey === 'act' && m.stress > 55) traitMod = -0.12;
  if (memberId === 'kai' && (statKey === 'reaction' || activityId === 'react')) traitMod = 0.1;
  if (memberId === 'vega' && activityId === 'light') traitMod = 0.12;
  if (memberId === 'bob' && (activityId === 'repair' || activityId === 'fixQuick')) traitMod = 0.12;
  const eff = clamp(effective + traitMod, 0, 1);
  const r = { ok: eff >= 0.5, gains: {}, messages: [], rehearsalGain: 0, hypeGain: 0, deviceFix: {} };

  if (r.ok) {
    const gain = Math.round(2 + eff * 5 + (quality >= 0.9 ? 2 : 0));
    m.stats[statKey] = clamp(m.stats[statKey] + gain, 0, 10);
    m.exp[statKey] += gain;
    r.gains[statKey] = gain;
    r.messages.push(`${STAT_LABELS[statKey]} +${gain}`);
    if (statKey === 'trust') m.trust = clamp(m.trust + gain * 3);
    m.stress = clamp(m.stress - 3);

    if (['team', 'lines', 'rhythm', 'react'].includes(activityId)) {
      const rg = Math.round(4 + eff * 8);
      state.resources.rehearsal = clamp(state.resources.rehearsal + rg);
      r.rehearsalGain = rg;
    }
    if (activityId === 'preview') {
      const hg = Math.round(5 + eff * 10);
      state.resources.hype = clamp(state.resources.hype + hg);
      r.hypeGain = hg;
    }
    if (activityId === 'fixQuick' || activityId === 'repair') {
      const pw = Math.round(eff * 10), hy = Math.round(eff * 12), lt = Math.round(eff * 6);
      state.devices.power.integrity = clamp(state.devices.power.integrity + pw);
      state.devices.hydraulics.integrity = clamp(state.devices.hydraulics.integrity + hy);
      state.devices.lights.integrity = clamp(state.devices.lights.integrity + lt);
      r.deviceFix = { power: pw, hydraulics: hy, lights: lt };
      state.flags.fixedStageOnce = true;
    }
    if (activityId === 'light') {
      const lt = Math.round(8 + eff * 10);
      state.devices.lights.integrity = clamp(state.devices.lights.integrity + lt);
      r.deviceFix = { lights: lt };
    }
    pushLog(state, `${TRAITS[memberId].name}《${a.name}》成功：${r.messages.join('，')}。`, 'good');
  } else {
    // 失败后果：能源已花，压力/疲劳上升，可能损坏设备、降低信任
    const stressUp = 8 + Math.round((0.55 - quality) * 20);
    m.stress = clamp(m.stress + stressUp);
    m.trust = clamp(m.trust - 4);
    r.messages.push(`压力 +${stressUp}`, '信任 -4');
    if (['repair', 'fixQuick', 'light'].includes(activityId)) {
      state.devices.lights.integrity = clamp(state.devices.lights.integrity - 6);
      state.devices.power.integrity = clamp(state.devices.power.integrity - 4);
      r.deviceFix = { lights: -6, power: -4 };
      state.resources.props = clamp(state.resources.props - 5);
      r.messages.push('设备在慌乱中受损');
    }
    if (activityId === 'team' && partnerId) {
      changeRelation(state, memberId, partnerId, -8);
      r.messages.push('搭档关系 -8');
    }
    pushLog(state, `${TRAITS[memberId].name}《${a.name}》失败：${r.messages.join('，')}。`, 'bad');
  }

  // 疲劳与过载
  const fGain = Math.round(5 + (1 - eff) * 6 + (a.ap >= 2 ? 4 : 0));
  m.fatigue = clamp(m.fatigue + fGain);
  r.fatigue = fGain;
  if (fGain >= 9 || a.ap >= 2) m.overloadDays += 1; else m.overloadDays = Math.max(0, m.overloadDays - 1);
  m.restDays = 0;

  // 过载/崩溃连锁
  if (m.overloadDays >= 2) {
    if (m.fatigue > 80 && !m.injured && Math.random() < 0.8) {
      m.injured = true;
      pushLog(state, `连续高强度工作压垮了${TRAITS[memberId].name}，TA 受伤了！`, 'bad');
    } else if (m.stress > 70) {
      m.stress = clamp(m.stress + 10);
      state.resources.rehearsal = clamp(state.resources.rehearsal - 4);
      pushLog(state, `${TRAITS[memberId].name} 情绪崩溃与人争执，排练进度 -4。`, 'bad');
    }
  }

  // 团队排练的搭档结算
  if (activityId === 'team' && partnerId) {
    const p = state.members[partnerId];
    const relNow = state.relations[`${memberId}>${partnerId}`] ?? 50;
    if (r.ok) {
      const bonus = Math.round(eff * 6 + relNow / 25);
      p.stats.trust = clamp(p.stats.trust + 1, 0, 10);
      p.exp.trust += 1;
      changeRelation(state, memberId, partnerId, 6 + bonus);
      const extra = Math.round(relNow / 25);
      state.resources.rehearsal = clamp(state.resources.rehearsal + extra);
      r.rehearsalGain += extra;
      r.messages.push(`默契加成，排练 +${extra}`);
    }
    p.fatigue = clamp(p.fatigue + 6);
  }
  return r;
}

export function changeRelation(state, a, b, delta) {
  const k = `${a}>${b}`;
  state.relations[k] = clamp((state.relations[k] ?? 50) + delta);
  state.relations[`${b}>${a}`] = clamp((state.relations[`${b}>${a}`] ?? 50) + delta);
}

// 夜间总结：自然恢复/恶化、设备自然损耗
export function nightlySummary(state) {
  const out = { lines: [] };
  for (const id of Object.keys(state.members)) {
    const m = state.members[id];
    if (m.restDays > 0) {
      m.stress = clamp(m.stress - 5);
    } else {
      m.fatigue = clamp(m.fatigue + 4);   // 失重舱内睡眠质量差
    }
    // 长期闲置降低成长势头（信任小降）
    if (m.restDays >= 2) m.trust = clamp(m.trust - 2);
    if (m.fatigue >= 90 && !m.injured && Math.random() < 0.4) {
      m.injured = true;
      out.lines.push(`${TRAITS[id].name} 过劳受伤。`);
    }
  }
  // 设备自然老化
  for (const d of Object.values(state.devices)) d.integrity = clamp(d.integrity - 3);
  state.resources.props = clamp(state.resources.props - 2);
  return out;
}

export function startNextDay(state) {
  state.day += 1;
  state.ap = 4;
  state.dailyEnergyMax = clamp(40 - (state.day - 6) * 3, 22, 40); // 能源逐渐恶化
  state.resources.energy = state.dailyEnergyMax;
  state.phase = 'morning';
}
