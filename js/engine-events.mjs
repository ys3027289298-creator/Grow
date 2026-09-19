// 突发事件：每个事件至少两个选项，部分有能力/关系/资源门槛，部分产生延迟影响
import { clamp } from './data.mjs';
import { pushLog, changeRelation } from './engine-actions.mjs';

const has = (s, id, stat, v) => s.members[id].stats[stat] >= v;
const rel = (s, a, b) => s.relations[`${a}>${b}`] ?? 50;

export const EVENTS = [
  {
    id: 'blackout', title: '舞台断电', icon: '⚡',
    text: '午后主舞台灯光成片熄灭，供能母线发出焦糊味。',
    choices: [
      { text: '让老鲍冒险手动合闸（技术≥6）',
        when: s => has(s, 'bob', 'tech', 6),
        run: s => {
          s.devices.power.integrity = clamp(s.devices.power.integrity + 18);
          s.members.bob.fatigue = clamp(s.members.bob.fatigue + 14);
          s.resources.energy = clamp(s.resources.energy - 6, 0);
          return '老鲍凭经验绕过烧毁的继电器，供能恢复。供能 +18，疲劳 +14。';
        } },
      { text: '全员撤离等待系统重启（损失排练时间）',
        run: s => {
          s.resources.rehearsal = clamp(s.resources.rehearsal - 10);
          s.resources.energy = clamp(s.resources.energy - 4, 0);
          s.pendingEffects.push({ day: s.day + 1, type: 'blackoutSurge', text: '断电后遗症：母线再次跳火' });
          return '保守撤离，排练 -10，且明天母线可能再出问题。';
        } }
    ]
  },
  {
    id: 'fight', title: '成员争执', icon: '🗯️',
    text: '林认为凯在即兴时毁掉了台词节奏，两人在后台吵了起来。',
    choices: [
      { text: '让他们当场对戏和解（林凯关系≥55）',
        when: s => rel(s, 'lin', 'kai') >= 55,
        run: s => {
          changeRelation(s, 'lin', 'kai', 12);
          s.members.lin.stress = clamp(s.members.lin.stress - 8);
          s.members.kai.stress = clamp(s.members.kai.stress - 8);
          s.resources.rehearsal = clamp(s.resources.rehearsal + 6);
          return '一次激烈的对戏反而磨出了火花，关系 +12，排练 +6。';
        } },
      { text: '强行分开，各自加训两小时',
        run: s => {
          changeRelation(s, 'lin', 'kai', -10);
          s.members.lin.fatigue = clamp(s.members.lin.fatigue + 12);
          s.members.kai.fatigue = clamp(s.members.kai.fatigue + 12);
          s.members.lin.stats.act = clamp(s.members.lin.stats.act + 1, 0, 10);
          s.members.kai.exp.act += 1;
          return '两人被分开加训，表演略涨但关系 -10、疲劳 +12。';
        } }
    ]
  },
  {
    id: 'props', title: '道具损坏', icon: '🪑',
    text: '失重环境中固定不当的月神雕像摔裂，这是第三幕的核心道具。',
    choices: [
      { text: '动用 15 零件立即修复',
        when: s => s.resources.parts >= 15,
        run: s => {
          s.resources.parts -= 15;
          s.resources.props = clamp(s.resources.props + 20);
          return '雕像被修得几乎看不出裂纹，道具完整度 +20。';
        } },
      { text: '改用灯光投影替代（织女星专注≥7）',
        when: s => has(s, 'vega', 'focus', 7),
        run: s => {
          s.resources.props = clamp(s.resources.props + 5);
          s.devices.lights.integrity = clamp(s.devices.lights.integrity - 8);
          s.flags.auroraReady = true;
          return '一束冷光投出雕像剪影，意外地惊艳，「极光」获得灵感。';
        } },
      { text: '暂不处理，让第三幕空着',
        run: s => {
          s.resources.props = clamp(s.resources.props - 15);
          s.resources.hype = clamp(s.resources.hype - 5);
          return '第三幕缺少核心道具（道具 -15，期待 -5）。';
        } }
    ]
  },
  {
    id: 'earlyAudience', title: '观众提前入场', icon: '🚪',
    text: '运输船提前抵达，三名观众代表飘进观众席要求先睹为快。',
    choices: [
      { text: '立刻安排凯来一段即兴（反应≥7）',
        when: s => has(s, 'kai', 'reaction', 7),
        run: s => {
          s.resources.hype = clamp(s.resources.hype + 16);
          s.members.kai.stress = clamp(s.members.kai.stress + 8);
          s.members.kai.stats.act = clamp(s.members.kai.stats.act + 1, 0, 10);
          return '凯的零重力即兴逗笑代表，期待 +16，收获表演经验。';
        } },
      { text: '礼貌婉拒，送出旧节目单',
        run: s => {
          s.resources.hype = clamp(s.resources.hype - 4);
          s.resources.funds += 10;
          return '代表略感失望（期待 -4），但买下纪念品，资金 +10。';
        } }
    ]
  },
  {
    id: 'signal', title: '外部信号干扰', icon: '📡',
    text: '地面转播卫星的信号扫过剧院，耳麦里全是杂音，灯光控制跳帧。',
    choices: [
      { text: '织女星改用手动光控（技术≥7）',
        when: s => has(s, 'vega', 'tech', 7),
        run: s => {
          s.devices.comms.integrity = clamp(s.devices.comms.integrity + 10);
          s.devices.lights.integrity = clamp(s.devices.lights.integrity + 8);
          s.flags.auroraReady = true;
          return '她甩开自动程序纯手动跟光，设备恢复且「极光」成型。';
        } },
      { text: '关闭所有无线设备硬扛干扰',
        run: s => {
          s.resources.energy = clamp(s.resources.energy - 8, 0);
          s.pendingEffects.push({ day: s.day + 1, type: 'commsDown', text: '耳麦频道仍串线，需重新校准' });
          return '靠断电屏蔽干扰（能源 -8），明天耳麦仍需校准。';
        } }
    ]
  },
  {
    id: 'accident', title: '排练事故', icon: '🩹',
    text: '液压台升起时猛顿了一下，站在上面的林摔了下来。',
    choices: [
      { text: '凯飞身接住（反应≥8 且林凯关系≥50）',
        when: s => has(s, 'kai', 'reaction', 8) && rel(s, 'lin', 'kai') >= 50,
        run: s => {
          changeRelation(s, 'lin', 'kai', 14);
          s.members.lin.trust = clamp(s.members.lin.trust + 8);
          s.resources.rehearsal = clamp(s.resources.rehearsal + 5);
          return '凯横扑接住林，全场欢呼。关系 +14，林信任 +8。';
        } },
      { text: '立即停排检修液压台',
        run: s => {
          s.members.lin.fatigue = clamp(s.members.lin.fatigue + 10);
          s.resources.rehearsal = clamp(s.resources.rehearsal - 6);
          s.devices.hydraulics.integrity = clamp(s.devices.hydraulics.integrity - 10);
          s.pendingEffects.push({ day: s.day + 1, type: 'hydraulicLeak', text: '液压台存在暗漏' });
          return '林只是扭伤，但液压台暴露暗漏（设备 -10，排练 -6）。';
        } }
    ]
  },
  {
    id: 'understudy', title: '临时演员缺席', icon: '🕳️',
    text: '客串第三幕旁白的驻站宇航员临时来不了，旁白段落无人顶上。',
    choices: [
      { text: '让林一人分饰两角（表演≥8，压力+12）',
        when: s => has(s, 'lin', 'act', 8),
        run: s => {
          s.members.lin.stress = clamp(s.members.lin.stress + 12);
          s.resources.rehearsal = clamp(s.resources.rehearsal + 8);
          s.flags.understudyReady = true;
          return '林挑战独角双角，排练 +8，但压力陡增。';
        } },
      { text: '老鲍戴上旁白耳麦顶上',
        run: s => {
          s.members.bob.stats.act = clamp(s.members.bob.stats.act + 1, 0, 10);
          s.members.bob.fatigue = clamp(s.members.bob.fatigue + 8);
          s.flags.understudyReady = true;
          return '老鲍用三十年舞台记忆念出旁白，备用方案确定。';
        } }
    ]
  },
  {
    id: 'overheat', title: '设备过热', icon: '🌡️',
    text: '调光台散热器报警，继续运行可能烧毁主灯控板。',
    choices: [
      { text: '消耗 10 能源强制冷却并加装导热片',
        when: s => s.resources.energy >= 10,
        run: s => {
          s.resources.energy -= 10;
          s.devices.lights.integrity = clamp(s.devices.lights.integrity + 12);
          return '灯控板被抢救回来，灯光阵列 +12。';
        } },
      { text: '关掉一半灯硬排',
        run: s => {
          s.devices.lights.integrity = clamp(s.devices.lights.integrity - 14);
          s.resources.hype = clamp(s.resources.hype - 6);
          return '昏暗的排练让人心里没底（灯光 -14，期待 -6）。';
        } }
    ]
  },
  {
    id: 'sponsor', title: '赞助方撤资', icon: '💸',
    text: '运输集团通知：剧院关停在即，最后一笔 60 资金的赞助取消。',
    choices: [
      { text: '老鲍拿私人积蓄垫上（信任≥60）',
        when: s => s.members.bob.trust >= 60,
        run: s => {
          s.resources.funds += 40;
          s.members.bob.trust = clamp(s.members.bob.trust - 6);
          s.flags.sponsorPulled = true;
          return '老鲍默默转账：“这船得有个像样的结尾。”资金 +40。';
        } },
      { text: '接受现实，砍掉非必要开支',
        run: s => {
          s.resources.funds = clamp(s.resources.funds - 25, 0);
          s.resources.parts = clamp(s.resources.parts - 10, 0);
          s.flags.sponsorPulled = true;
          return '资金 -25、零件 -10，采购计划必须重新权衡。';
        } }
    ]
  },
  {
    id: 'rewrite', title: '剧本修改', icon: '📝',
    text: '林深夜改出新结局：月神选择留在轨道，而不是返回地球。',
    choices: [
      { text: '采用新结局，全队紧急复排（需排练≥25）',
        when: s => s.resources.rehearsal >= 25,
        run: s => {
          s.flags.scriptRewritten = true;
          s.resources.rehearsal = clamp(s.resources.rehearsal - 8);
          s.resources.hype = clamp(s.resources.hype + 12);
          for (const id of ['lin', 'kai']) s.members[id].stress = clamp(s.members[id].stress + 8);
          s.pendingEffects.push({ day: s.day + 1, type: 'newLines', text: '新结局台词还需磨合' });
          return '新结局更大胆：期待 +12，排练 -8、主演压力 +8，明天还要磨词。';
        } },
      { text: '保留原结局，求稳',
        run: s => {
          s.members.lin.stress = clamp(s.members.lin.stress + 6);
          s.members.lin.trust = clamp(s.members.lin.trust - 4);
          return '林没说话，把稿纸收了起来（压力 +6，信任 -4）。';
        } }
    ]
  },
  {
    id: 'oxygen', title: '氧气循环波动', icon: '🌬️',
    text: '生命维持系统的循环扇停转十分钟，排练厅空气浑浊。',
    choices: [
      { text: '老鲍与织女星联手抢修（技术合计≥14）',
        when: s => s.members.bob.stats.tech + s.members.vega.stats.tech >= 14,
        run: s => {
          s.devices.power.integrity = clamp(s.devices.power.integrity + 10);
          changeRelation(s, 'bob', 'vega', 8);
          s.resources.energy = clamp(s.resources.energy - 4, 0);
          return '一老一少配合默契，循环扇重启，供能 +10、关系 +8。';
        } },
      { text: '提前结束今日安排，全员吸氧休息',
        run: s => {
          s.ap = 0;
          for (const m of Object.values(s.members)) m.fatigue = clamp(m.fatigue - 6);
          return '今日剩余行动取消（行动点清零），大家缓了过来。';
        } }
    ]
  },
  {
    id: 'meteor', title: '微陨石警报', icon: '☄️',
    text: '碎片云逼近，剧院需要把主舞台旋转到装甲面迎击。',
    choices: [
      { text: '凯带队固定布景（体力≥7）',
        when: s => has(s, 'kai', 'stamina', 7),
        run: s => {
          s.members.kai.fatigue = clamp(s.members.kai.fatigue + 14);
          s.resources.props = clamp(s.resources.props + 12);
          s.devices.hydraulics.integrity = clamp(s.devices.hydraulics.integrity + 6);
          return '凯用安全绳穿梭固定布景，道具 +12、液压 +6，疲劳 +14。';
        } },
      { text: '放弃固定，优先保人',
        run: s => {
          s.resources.props = clamp(s.resources.props - 18);
          s.devices.hydraulics.integrity = clamp(s.devices.hydraulics.integrity - 8);
          s.pendingEffects.push({ day: s.day + 2, type: 'debrisClutter', text: '漂浮的布景碎片仍需清理' });
          return '人员安全，但布景与液压受损（道具 -18），两天后还要清理碎片。';
        } }
    ]
  }
];

// 每日事件抽取：按日期权重，保证 10 天内尽量不重复
export function pickEvent(state, rng = Math.random) {
  const seen = new Set(state.eventHistory.map(e => e.id));
  let pool = EVENTS.filter(e => !seen.has(e.id));
  if (pool.length === 0) pool = EVENTS.slice();
  // 第 4 天后观众席事件优先；最后两天偏向高压事件
  const weighted = [];
  for (const e of pool) {
    let w = 1;
    if (state.day >= 8 && ['sponsor', 'overheat', 'signal', 'rewrite'].includes(e.id)) w = 2;
    if (state.day <= 3 && ['earlyAudience'].includes(e.id)) w = 0;
    for (let i = 0; i < w * 4; i++) weighted.push(e);
  }
  return weighted[Math.floor(rng() * weighted.length)] || pool[0];
}

export function availableChoices(state, event) {
  return event.choices.map((c, i) => ({ index: i, choice: c, enabled: !c.when || c.when(state) }));
}

export function resolveEvent(state, event, choiceIndex) {
  const c = event.choices[choiceIndex];
  if (!c) return { ok: false, reason: '无效选项' };
  if (c.when && !c.when(state)) return { ok: false, reason: '当前条件不满足' };
  const outcome = c.run(state);
  state.eventHistory.push({ id: event.id, title: event.title, icon: event.icon,
    choice: c.text, outcome, day: state.day });
  pushLog(state, `【事件】${event.title}：${outcome}`, 'event');
  return { ok: true, outcome };
}

// 处理当天到期的延迟效果
export function applyDueEffects(state) {
  const due = state.pendingEffects.filter(e => e.day <= state.day);
  state.pendingEffects = state.pendingEffects.filter(e => e.day > state.day);
  const results = [];
  for (const e of due) {
    let text = e.text;
    switch (e.type) {
      case 'blackoutSurge':
        state.devices.power.integrity = clamp(state.devices.power.integrity - 10);
        text += '——供能系统 -10。';
        break;
      case 'commsDown':
        state.devices.comms.integrity = clamp(state.devices.comms.integrity - 12);
        state.resources.rehearsal = clamp(state.resources.rehearsal - 4);
        text += '——通讯耳麦 -12，排练 -4。';
        break;
      case 'hydraulicLeak':
        state.devices.hydraulics.integrity = clamp(state.devices.hydraulics.integrity - 12);
        text += '——液压舞台 -12。';
        break;
      case 'newLines':
        state.members.lin.stress = clamp(state.members.lin.stress + 6);
        state.resources.rehearsal = clamp(state.resources.rehearsal - 3);
        text += '——林压力 +6，排练 -3。';
        break;
      case 'debrisClutter':
        state.resources.energy = clamp(state.resources.energy - 6, 0);
        text += '——清理碎片消耗 6 能源。';
        break;
    }
    results.push({ type: e.type, text });
    pushLog(state, `【延迟影响】${text}`, 'event');
  }
  return results;
}
