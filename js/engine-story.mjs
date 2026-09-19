// 个人剧情：每名成员 3 段；触发后可能解锁区域、确定发展路线、提供加成
import { clamp } from './data.mjs';
import { pushLog, changeRelation } from './engine-actions.mjs';

// condition(state, m) -> bool；effect(state) -> 返回剧情文本
export const STORIES = {
  lin: [
    { n: 1, title: '碎裂的开嗓',
      cond: (s, m) => s.day >= 1,
      text: '林对着镜子反复唱第一句，每一遍都因为“不够好”而重来。你递给她一杯温水。',
      effect: s => {
        const m = s.members.lin;
        m.stress = clamp(m.stress - 10); m.trust = clamp(m.trust + 6);
        return '林答应试着“允许自己不完美”。压力 -10，信任 +6。';
      } },
    { n: 2, title: '两条路：独角或群戏',
      cond: (s, m) => m.story[1] && (m.stats.act >= 9 || m.exp.act >= 10),
      text: '林面临选择：把第三幕改成自己的独角高光，还是相信队友、排成群戏。',
      choices: [
        { label: '相信队友（群戏路线）', run: s => {
          s.members.lin.route = 'ensemble';
          changeRelation(s, 'lin', 'kai', 10);
          s.members.kai.stats.act = clamp(s.members.kai.stats.act + 1, 0, 10);
          s.resources.rehearsal = clamp(s.resources.rehearsal + 8);
          return '林把一段台词分给凯。关系 +10，排练 +8，路线：群戏核心。';
        } },
        { label: '独占高光（独角路线）', run: s => {
          s.members.lin.route = 'solo';
          s.members.lin.stats.act = clamp(s.members.lin.stats.act + 1, 0, 10);
          s.members.lin.stress = clamp(s.members.lin.stress + 8);
          return '林选择独自扛起第三幕，表演 +1、压力 +8，路线：独角主演。';
        } }
      ] },
    { n: 3, title: '给轨道的独白',
      cond: (s, m) => m.story[2] && s.day >= 7 && m.trust >= 55,
      text: '深夜的主舞台，林把最后一段独白念给空无一人的观众席，也念给你听。',
      effect: s => {
        s.members.lin.stats.act = clamp(s.members.lin.stats.act + 1, 0, 10);
        s.resources.hype = clamp(s.resources.hype + 8);
        s.flags.linFinaleReady = true;
        return '那段独白足以让整个近地轨道安静下来。表演 +1，期待 +8。';
      } }
  ],
  kai: [
    { n: 1, title: '悬浮的纸牌',
      cond: (s, m) => s.day >= 1,
      text: '凯在后台玩零重力纸牌魔术，其实是在掩饰背不下来的台词。',
      effect: s => {
        s.members.kai.stats.focus = clamp(s.members.kai.stats.focus + 1, 0, 10);
        s.members.kai.exp.focus += 1;
        return '你陪他把台词写在牌面上，专注 +1。';
      } },
    { n: 2, title: '两条路：收束或燃烧',
      cond: (s, m) => m.story[1] && (m.stats.reaction >= 9 || m.exp.reaction >= 8),
      text: '凯可以把即兴天赋打磨成稳定的舞台节奏，也可以成为专门处理意外的“现场救场人”。',
      choices: [
        { label: '打磨节奏（节奏路线）', run: s => {
          s.members.kai.route = 'rhythm';
          s.members.kai.stats.rhythm = clamp(s.members.kai.stats.rhythm + 2, 0, 10);
          s.resources.rehearsal = clamp(s.resources.rehearsal + 8);
          return '凯第一次完整踩中每个拍点，节奏 +2，排练 +8。';
        } },
        { label: '专职救场（反应路线）', run: s => {
          s.members.kai.route = 'saver';
          s.members.kai.stats.reaction = clamp(s.members.kai.stats.reaction + 1, 0, 10);
          s.flags.understudyReady = true;
          return '任何意外都有凯兜底，反应 +1，备用演员方案就绪。';
        } }
      ] },
    { n: 3, title: '不按剧本的人',
      cond: (s, m) => m.story[2] && s.day >= 7 && (s.relations['kai>lin'] ?? 50) >= 60,
      text: '凯把一张写满即兴点子的纸牌塞进林手里：“结尾我给你兜底，尽管演。”',
      effect: s => {
        changeRelation(s, 'kai', 'lin', 8);
        s.members.kai.stats.act = clamp(s.members.kai.stats.act + 1, 0, 10);
        s.flags.kaiFinaleReady = true;
        return '主演与救场人达成默契，表演 +1，最终演出容错提高。';
      } }
  ],
  vega: [
    { n: 1, title: '调光台上的旧照片',
      cond: (s, m) => s.day >= 1,
      text: '织女星挡在调光台前不让你看——台下压着她父亲在这座剧院的工作照。',
      effect: s => {
        s.locations.light.unlocked = true;
        s.members.vega.trust = clamp(s.members.vega.trust + 8);
        return '她终于开口讲父亲的事，并带你进入灯光室（区域解锁！）。信任 +8。';
      } },
    { n: 2, title: '两条路：复刻或创造',
      cond: (s, m) => m.story[1] && (m.stats.tech >= 9 || m.exp.tech >= 10),
      text: '父亲留下的「极光」序列只剩半本笔记。复刻旧作最稳，补完它却可能失败。',
      choices: [
        { label: '复刻经典（稳定灯光路线）', run: s => {
          s.members.vega.route = 'classic';
          s.devices.lights.integrity = clamp(s.devices.lights.integrity + 15);
          s.resources.rehearsal = clamp(s.resources.rehearsal + 6);
          return '经典序列被完整复原，灯光 +15，排练 +6。';
        } },
        { label: '补完极光（极光路线）', run: s => {
          s.members.vega.route = 'aurora';
          s.flags.auroraReady = true;
          s.members.vega.stats.focus = clamp(s.members.vega.stats.focus + 1, 0, 10);
          return '她决定写完父亲没写完的光（极光序列就绪，专注 +1）。';
        } }
      ] },
    { n: 3, title: '用光说的话',
      cond: (s, m) => m.story[2] && s.day >= 7 && s.devices.lights.integrity >= 70,
      text: '灯光室里，她为每个人打出一束专属颜色的光，什么都没说，又像什么都说了。',
      effect: s => {
        for (const id of Object.keys(s.members)) s.members[id].stress = clamp(s.members[id].stress - 6);
        s.resources.hype = clamp(s.resources.hype + 10);
        s.flags.vegaFinaleReady = true;
        return '全队压力 -6，期待 +10，最终演出灯光段获得加成。';
      } }
  ],
  bob: [
    { n: 1, title: '三十年的检修表',
      cond: (s, m) => s.day >= 1,
      text: '老鲍掏出一张边角磨烂的检修表，上面记着剧院每一颗螺丝的位置。',
      effect: s => {
        s.members.bob.trust = clamp(s.members.bob.trust + 6);
        s.devices.power.integrity = clamp(s.devices.power.integrity + 6);
        return '他按老表重新标定供能，供能 +6，信任 +6。';
      } },
    { n: 2, title: '两条路：修补或改造',
      cond: (s, m) => m.story[1] && (m.stats.tech >= 9 || s.flags.fixedStageOnce),
      text: '老鲍可以让旧设备“再撑十天”，也可以冒险把零件改造成一套高能但不稳定的新系统。',
      choices: [
        { label: '稳妥修补（可靠路线）', run: s => {
          s.members.bob.route = 'reliable';
          for (const d of Object.values(s.devices)) d.integrity = clamp(d.integrity + 10);
          return '每台设备都被他敲回安全线，全设备 +10。';
        } },
        { label: '极限改造（高能路线，耗 20 零件）', when: s => s.resources.parts >= 20, run: s => {
          s.resources.parts -= 20;
          s.members.bob.route = 'overclock';
          s.dailyEnergyMax = clamp(s.dailyEnergyMax + 10, 0, 60);
          s.resources.energy = clamp(s.resources.energy + 10, 0, 60);
          s.devices.power.integrity = clamp(s.devices.power.integrity - 8);
          return '改造成功：每日能源上限 +10！但供能稳定性 -8。';
        } }
      ] },
    { n: 3, title: '最后一次巡检',
      cond: (s, m) => m.story[2] && s.day >= 7 && s.devices.hydraulics.integrity >= 65,
      text: '闭馆前的最后一次巡检，老鲍拍了拍液压台：“老朋友，再陪我们演一场。”',
      effect: s => {
        for (const id of Object.keys(s.members)) s.members[id].trust = clamp(s.members[id].trust + 5);
        s.resources.props = clamp(s.resources.props + 10);
        s.flags.bobFinaleReady = true;
        return '全队信任 +5，道具 +10，最终演出设备段获得加成。';
      } }
  ]
};

// 返回当前可触发的下一段剧情（null 表示没有）
export function nextStory(state, memberId) {
  const m = state.members[memberId];
  const list = STORIES[memberId];
  for (const st of list) {
    if (!m.story[st.n]) {
      const trustOk = st.n === 1 ? m.trust >= 30 : st.n === 2 ? m.trust >= 45 : m.trust >= 50;
      if (trustOk && st.cond(state, m)) return st;
    }
  }
  return null;
}

export function storyTriggerInfo(state, memberId) {
  const m = state.members[memberId];
  const n = [1, 2, 3].find(x => !m.story[x]);
  if (!n) return null;
  const needTrust = n === 1 ? 30 : n === 2 ? 45 : 50;
  return { n, trustReady: m.trust >= needTrust, needTrust };
}

export function completeStory(state, memberId, story, choiceIndex = 0) {
  const m = state.members[memberId];
  let outcome;
  if (story.choices) {
    const c = story.choices[choiceIndex];
    if (c.when && !c.when(state)) return { ok: false, reason: '条件不满足' };
    outcome = c.run(state);
  } else {
    outcome = story.effect(state);
  }
  m.story[story.n] = true;
  pushLog(state, `【剧情】${story.title}：${outcome}`, 'story');
  checkUnlocks(state);
  return { ok: true, outcome };
}

// 区域解锁检查
export function checkUnlocks(state) {
  if (state.flags.fixedStageOnce) state.locations.repair.unlocked = true;
  if (state.day >= 4) state.locations.audience.unlocked = true;
  for (const loc of Object.values(state.locations)) {
    if (loc.closedUntil && state.day >= loc.closedUntil) loc.closedUntil = 0;
  }
}

export function isLocationOpen(state, locId) {
  const loc = state.locations[locId];
  if (!loc.unlocked) return { open: false, reason: '尚未解锁' };
  if (loc.closedUntil > state.day) return { open: false, reason: `因安全事故关闭至第 ${loc.closedUntil} 天` };
  return { open: true };
}
