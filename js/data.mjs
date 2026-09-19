// 《失重剧院：终幕排演》核心数据：纯数据与纯函数，浏览器与 Node 测试共用

export const TRAITS = {
  lin: { id: 'lin', name: '林·奥德赛', role: '主演', trait: '完美主义者',
    desc: '对每个音节都吹毛求疵，压力越高越容易在关键台词上失误。',
    goal: '让最后一场戏成为自己被记住的理由',
    stats: { act: 8, rhythm: 4, focus: 7, stamina: 5, tech: 2, reaction: 4, trust: 6 } },
  kai: { id: 'kai', name: '凯·脉冲', role: '演员 / 替身', trait: '即兴派',
    desc: '讨厌固定剧本，但意外发生时总能接住场面。',
    goal: '证明即兴不比剧本差',
    stats: { act: 6, rhythm: 7, focus: 4, stamina: 8, tech: 3, reaction: 9, trust: 5 } },
  vega: { id: 'vega', name: '织女星', role: '灯光师', trait: '精密冷静',
    desc: '把情绪藏在调光台后面，认为光才是舞台的语言。',
    goal: '完成父亲未完成的灯光序列「极光」',
    stats: { act: 2, rhythm: 6, focus: 9, stamina: 4, tech: 8, reaction: 6, trust: 4 } },
  bob: { id: 'bob', name: '老鲍', role: '舞台工程师', trait: '老派可靠',
    desc: '在这座剧院修了三十年，膝盖和管道一样吱呀作响。',
    goal: '让这艘老剧院体面地谢幕',
    stats: { act: 3, rhythm: 3, focus: 6, stamina: 6, tech: 9, reaction: 5, trust: 7 } }
};

export const STAT_LABELS = {
  act: '表演', rhythm: '节奏', focus: '专注', stamina: '体力',
  tech: '技术', reaction: '临场反应', trust: '团队信任'
};

export const STAT_SHORT = {
  act: '表演', rhythm: '节奏', focus: '专注', stamina: '体力',
  tech: '技术', reaction: '反应', trust: '信任'
};

export const LOCATIONS = {
  stage: { id: 'stage', name: '主舞台', icon: '🎭', unlocked: true,
    desc: '剧院的心脏，最终演出将在这里发生。' },
  backstage: { id: 'backstage', name: '后台', icon: '🪞', unlocked: true,
    desc: '化妆镜与待命区，成员在这里休息与交谈。' },
  rehearsal: { id: 'rehearsal', name: '排练室', icon: '🎬', unlocked: true,
    desc: '台词、节奏与团队排练在此进行。' },
  light: { id: 'light', name: '灯光室', icon: '💡', unlocked: false,
    unlockNeed: '与织女星完成第 1 段谈心剧情后解锁',
    desc: '调光台与灯光序列「极光」的所在地。' },
  repair: { id: 'repair', name: '维修舱', icon: '🔧', unlocked: false,
    unlockNeed: '在主舞台完成一次应急检修后解锁',
    desc: '零件堆与电路检修台，可进行深度维修。' },
  storage: { id: 'storage', name: '储藏间', icon: '📦', unlocked: true,
    desc: '用资金采购零件与补给，也能接零工。' },
  audience: { id: 'audience', name: '观众席', icon: '🎪', unlocked: false,
    unlockNeed: '第 4 天自动开放（观众代表提前抵达）',
    desc: '路演彩排可以提升观众期待值。' }
};

export const ACTIVITIES = {
  lines: { id: 'lines', name: '台词训练', loc: 'rehearsal', ap: 1, energy: 8, stat: 'act', minigame: 'sequence',
    desc: '按提示顺序完成台词接龙。' },
  rhythm: { id: 'rhythm', name: '节奏训练', loc: 'rehearsal', ap: 1, energy: 8, stat: 'rhythm', minigame: 'rhythm',
    desc: '在节拍收窄的判定窗内按键。' },
  light: { id: 'light', name: '灯光操作', loc: 'light', ap: 1, energy: 7, stat: 'tech', minigame: 'light',
    desc: '根据剧情节点为舞台区域选择正确灯光。' },
  repair: { id: 'repair', name: '深度维修', loc: 'repair', ap: 1, energy: 9, stat: 'tech', minigame: 'repair', useParts: 8,
    desc: '按正确顺序排查电路与液压设备（耗 8 零件）。' },
  react: { id: 'react', name: '临场反应', loc: 'stage', ap: 1, energy: 7, stat: 'reaction', minigame: 'react',
    desc: '舞台条件随机突变，限时处理。' },
  team: { id: 'team', name: '团队排练', loc: 'stage', ap: 2, energy: 10, stat: 'trust', minigame: 'team',
    desc: '安排两名成员的站位、出场顺序与任务。' },
  rest: { id: 'rest', name: '充分休息', loc: 'backstage', ap: 1, energy: -6, stat: null, minigame: null,
    desc: '恢复体力与压力、解除过载，但今天不成长。' },
  talk: { id: 'talk', name: '谈心对话', loc: 'backstage', ap: 1, energy: 2, stat: 'trust', minigame: null,
    desc: '深入交谈提升信任，可能触发个人剧情。' },
  gig: { id: 'gig', name: '舱外零工', loc: 'storage', ap: 2, energy: 12, stat: null, minigame: null,
    desc: '为运输站做检修零工赚 55 资金，消耗体力。' },
  shopParts: { id: 'shopParts', name: '采购零件', loc: 'storage', ap: 1, energy: 0,
    cost: { funds: 40 }, gain: { parts: 25 }, stat: null, minigame: null,
    desc: '花 40 资金购入 25 零件。' },
  shopCells: { id: 'shopCells', name: '采购能源电池', loc: 'storage', ap: 1, energy: 0,
    cost: { funds: 30 }, gain: { energy: 30 }, stat: null, minigame: null,
    desc: '花 30 资金购入 30 能源。' },
  preview: { id: 'preview', name: '观众席路演', loc: 'audience', ap: 1, energy: 8, stat: 'act', minigame: 'sequence',
    desc: '面向观众代表的小型彩排，提升期待值。' },
  fixQuick: { id: 'fixQuick', name: '应急检修', loc: 'stage', ap: 1, energy: 6, stat: 'tech', minigame: 'repair', useParts: 10,
    desc: '在主舞台就地检修设备（耗 10 零件）。' }
};

export const DAY_AP = 4;
export const DAY_ENERGY = 40;
export const TOTAL_DAYS = 10;

export function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

export function createMembers() {
  const members = {};
  for (const id of Object.keys(TRAITS)) {
    const t = TRAITS[id];
    members[id] = {
      id,
      stats: { ...t.stats },
      fatigue: 20,
      stress: 15,
      trust: t.stats.trust * 10,
      injured: false,
      overloadDays: 0,
      restDays: 0,
      exp: { act: 0, rhythm: 0, focus: 0, stamina: 0, tech: 0, reaction: 0, trust: 0 },
      story: { 1: false, 2: false, 3: false },
      assignment: null,
      route: null
    };
  }
  const rel = {};
  const lowPairs = [['lin', 'kai']];
  for (const a of Object.keys(TRAITS))
    for (const b of Object.keys(TRAITS))
      if (a !== b) {
        const low = lowPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
        rel[`${a}>${b}`] = low ? 35 : 50;
      }
  return { members, relations: rel };
}

export function createState() {
  const { members, relations } = createMembers();
  return {
    version: 1,
    day: 1,
    phase: 'morning',
    ap: DAY_AP,
    resources: { energy: DAY_ENERGY, parts: 30, funds: 120, rehearsal: 0, props: 80, hype: 20 },
    dailyEnergyMax: DAY_ENERGY,
    members,
    relations,
    devices: {
      power: { name: '供能系统', integrity: 55 },
      lights: { name: '灯光阵列', integrity: 45 },
      hydraulics: { name: '液压舞台', integrity: 40 },
      comms: { name: '通讯耳麦', integrity: 60 }
    },
    locations: Object.fromEntries(
      Object.entries(LOCATIONS).map(([k, v]) => [k, { unlocked: v.unlocked, closedUntil: 0 }])
    ),
    log: [],
    eventHistory: [],
    flags: { fixedStageOnce: false, sponsorPulled: false, scriptRewritten: false,
      auroraReady: false, understudyReady: false },
    pendingEffects: [],
    finale: null,
    startedAt: Date.now()
  };
}
