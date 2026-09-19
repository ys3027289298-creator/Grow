// 最终演出：配置确认 → 三段现场变化（可操作小游戏）→ 四结局结算
import { clamp, TRAITS } from './data.mjs';
import { pushLog } from './engine-actions.mjs';

// 演出配置：站位(主演)、灯光师、工程师、备用调度
export function defaultLineup(state) {
  return {
    lead: 'lin',        // 主演位
    understudy: 'kai',  // 替补/调度
    light: 'vega',      // 灯光位
    engineer: 'bob',    // 设备位
    lightSequence: state.flags.auroraReady ? 'aurora' : 'standard',
    backupPlan: state.flags.understudyReady ? 'ready' : 'none'
  };
}

export const FINALE_PHASES = [
  { id: 'p1', title: '第一幕 · 升空', cue: '灯光',
    prompt: '月神登舱瞬间，灯光必须从冷蓝切到鎏金！', minigame: 'light' },
  { id: 'p2', title: '第二幕 · 风暴', cue: '设备',
    prompt: '液压台在风暴段卡死，必须立刻排查三处电路！', minigame: 'repair' },
  { id: 'p3', title: '第三幕 · 抉择', cue: '调度',
    prompt: '耳麦断线、道具漂浮，主演望向侧台等待你的指令！', minigame: 'react' }
];

export function createFinale(state, lineup) {
  state.finale = {
    step: 0, // 0 配置, 1..3 现场, 4 结算
    lineup,
    cueResults: [],
    startedAt: Date.now(),
    finishedAt: null
  };
  state.phase = 'finale';
  return state.finale;
}

// 每段现场操作的“基础分”：成员对应属性 + 设备状态
export function cueBaseScore(state, phase, lineup) {
  const f = state.finale;
  if (phase.id === 'p1') {
    const vega = state.members[lineup.light];
    return vega.stats.tech * 6 + vega.stats.focus * 3 +
      state.devices.lights.integrity * 0.5 +
      (lineup.lightSequence === 'aurora' ? 12 : 0) +
      (state.flags.vegaFinaleReady ? 8 : 0) - vega.fatigue * 0.15;
  }
  if (phase.id === 'p2') {
    const bob = state.members[lineup.engineer];
    return bob.stats.tech * 6 + state.devices.hydraulics.integrity * 0.45 +
      state.devices.power.integrity * 0.25 +
      (state.flags.bobFinaleReady ? 8 : 0) - bob.fatigue * 0.15;
  }
  const lead = state.members[lineup.lead];
  const sub = state.members[lineup.understudy];
  const relKey = `${lineup.understudy}>${lineup.lead}`;
  return lead.stats.act * 5 + sub.stats.reaction * 4 +
    (state.relations[relKey] ?? 50) * 0.35 +
    state.resources.props * 0.2 +
    (lineup.backupPlan === 'ready' ? 12 : 0) +
    (state.flags.kaiFinaleReady ? 6 : 0) -
    (lead.stress + lead.fatigue) * 0.12;
}

// quality：玩家现场小游戏操作 0~1
export function resolveCue(state, quality) {
  const f = state.finale;
  const phase = FINALE_PHASES[f.step - 1];
  const base = cueBaseScore(state, phase, f.lineup);
  const score = clamp(base * (0.45 + quality * 0.75), 0, 100);
  const rec = { phase: phase.id, title: phase.title, quality, score,
    success: score >= 55 };
  f.cueResults.push(rec);
  pushLog(state, `【演出】${phase.title} 现场判定 ${Math.round(score)} 分（${rec.success ? '成功' : '失误'}）。`,
    rec.success ? 'good' : 'bad');
  return rec;
}

// 总评分与四结局
export function computeEnding(state) {
  const f = state.finale;
  const r = state.resources;
  const cueAvg = f.cueResults.reduce((a, c) => a + c.score, 0) / (f.cueResults.length || 1);
  const successCount = f.cueResults.filter(c => c.success).length;

  // 全局准备分：排练、期待、设备均值、全员信任、疲劳/受伤
  const devAvg = Object.values(state.devices).reduce((a, d) => a + d.integrity, 0) / 4;
  const trustAvg = Object.values(state.members).reduce((a, m) => a + m.trust, 0) / 4;
  const fatiguePenalty = Object.values(state.members)
    .reduce((a, m) => a + Math.max(0, m.fatigue - 50) + (m.injured ? 20 : 0), 0) / 4;
  const prep = r.rehearsal * 0.28 + r.hype * 0.22 + devAvg * 0.22 +
    trustAvg * 0.18 + r.props * 0.1 - fatiguePenalty * 0.3;

  const total = clamp(cueAvg * 0.6 + prep * 0.4, 0, 100);

  let endingId, title;
  if (total >= 82 && successCount === 3) {
    endingId = 'perfect'; title = '完美谢幕';
  } else if (total >= 58 && successCount >= 2) {
    endingId = 'closed'; title = '演出完成，但剧院关闭';
  } else if (total >= 38) {
    endingId = 'rough'; title = '中途失控，勉强结束';
  } else {
    endingId = 'fail'; title = '演出失败';
  }

  const reasons = [];
  if (r.rehearsal < 40) reasons.push('排练进度不足');
  if (r.hype < 35) reasons.push('观众期待过低');
  if (devAvg < 45) reasons.push('设备完整度过低');
  if (fatiguePenalty > 12) reasons.push('成员疲劳或伤病拖累现场');
  f.cueResults.forEach(c => { if (!c.success) reasons.push(`${c.title}现场失误`); });
  if (reasons.length === 0) reasons.push('无——这是一场近乎无瑕的演出');

  f.finishedAt = Date.now();
  const result = {
    endingId, title, total: Math.round(total), prep: Math.round(prep),
    cueAvg: Math.round(cueAvg), successCount, reasons,
    durationMs: f.finishedAt - f.startedAt,
    audience: audienceFeedback(endingId),
    evaluation: evaluationText(endingId, state)
  };
  state.ending = result;
  return result;
}

function audienceFeedback(id) {
  return {
    perfect: '观众席久久无人离开，随后掌声撞在舱壁上，像一场温柔的流星暴雨。转播信号被地面反复回放。',
    closed: '演出完整落幕，观众起立鼓掌。可能源指示灯仍在倒数——剧院按计划关停，但它是带着光走的。',
    rough: '灯光黑过、道具飘过、台词断过。凯们手忙脚乱地把结尾拽了回来，观众的掌声里混着叹息，但没有人提前离场。',
    fail: '第三幕的黑场持续了太久。等灯光再亮，观众席已经空了一半。这座剧院没能等到它的谢幕。'
  }[id];
}

function evaluationText(id, state) {
  const names = Object.values(state.members).map(m => TRAITS[m.id].name).join('、');
  const growth = Object.values(state.members).map(m => {
    const totalExp = Object.values(m.exp).reduce((a, b) => a + b, 0);
    return `${TRAITS[m.id].name}（累计成长 ${totalExp}，${m.route ? routeName(m.route) : '未定型'}）`;
  }).join('；');
  return { team: names, growth };
}

export function routeName(r) {
  return {
    ensemble: '群戏核心', solo: '独角主演',
    rhythm: '节奏担当', saver: '现场救场人',
    classic: '经典守光', aurora: '极光作者',
    reliable: '可靠工程师', overclock: '极限改造师'
  }[r] || r;
}
