// 《失重剧院：终幕排演》主控制器
import { createState, LOCATIONS, ACTIVITIES, TRAITS, STAT_LABELS, STAT_SHORT, TOTAL_DAYS, clamp } from './data.mjs';
import {
  canDoActivity, doSimpleActivity, resolveTraining, pushLog,
  nightlySummary, startNextDay
} from './engine-actions.mjs';
import { EVENTS, pickEvent, availableChoices, resolveEvent, applyDueEffects } from './engine-events.mjs';
import { STORIES, nextStory, storyTriggerInfo, completeStory, checkUnlocks, isLocationOpen } from './engine-story.mjs';
import {
  FINALE_PHASES, defaultLineup, createFinale, resolveCue, computeEnding, routeName
} from './engine-finale.mjs';
import { saveGame, loadGame, hasSave, deleteSave } from './engine-save.mjs';
import { openMinigame } from './minigames.mjs';
import { $, toast, modal, confirmBox, sfx, setSound, isSoundOn, barColor } from './ui.mjs';

let state = null;
let currentLoc = 'stage';
let paused = false;
let eventResolvedToday = false;

// ---------- 启动 ----------
function showScreen(id) {
  $('screen-menu').classList.toggle('hidden', id !== 'menu');
  $('screen-game').classList.toggle('hidden', id !== 'game');
}

function newGame() {
  state = createState();
  currentLoc = 'stage';
  eventResolvedToday = false;
  saveGame(state, 'auto');
  showScreen('game');
  render();
  if (!location.search.includes('autostart')) showIntro();
}

function continueGame() {
  const payload = loadGame();
  if (!payload) { toast('没有找到存档', 'bad'); return; }
  state = payload.state;
  currentLoc = state._loc || 'stage';
  eventResolvedToday = state.phase === 'night' || state.day > (payload._eventDay || 0);
  showScreen('game');
  if (state.phase === 'finale' && state.finale) renderFinale();
  else if (state.ending) showEnding();
  else render();
  toast(`已读取第 ${state.day} 天存档`, 'good');
}

function bindMenu() {
  $('btn-new').onclick = async () => {
    if (hasSave()) {
      if (!(await confirmBox('开始新游戏', '开始新游戏会覆盖当前自动存档，确定吗？', '开始新游戏', true))) return;
    }
    newGame();
  };
  $('btn-continue').onclick = continueGame;
  $('btn-restart').onclick = async () => {
    if (hasSave()) {
      if (!(await confirmBox('重新开始', '这将清除当前存档且无法恢复。确定重新开始吗？', '清除并重新开始', true))) return;
    }
    deleteSave('auto');
    newGame();
  };
  $('btn-settings').onclick = openSettings;
  $('btn-help').onclick = openHelp;
  $('btn-events-log-menu').onclick = () => {
    const payload = loadGame();
    showEventLog(payload ? payload.state : null);
  };
}

// ---------- 介绍 / 帮助 / 设置 ----------
function showIntro() {
  modal(`
    <h2>🚀 第 1 天 · 能源倒计时开始</h2>
    <p class="sub">这座近地轨道旧剧院将在 10 天后永久关闭。你是最后一任舞台监督。</p>
    <div class="help-cols">
      <div>
        <h4>你要做什么</h4>
        <ol>
          <li>每天有 <b>4 个行动点</b> 与有限能源，在地图各区域安排训练、维修、采购与休息。</li>
          <li>训练都是<b>实际操作小游戏</b>，操作与成员属性共同决定结果。</li>
          <li>每天会触发一次<b>突发事件</b>，选项有能力/关系/资源门槛。</li>
          <li>与成员<b>谈心</b>可触发个人剧情，解锁区域与发展路线。</li>
          <li>第 10 天进入最终演出，现场完成三次判定，走向四种结局之一。</li>
        </ol>
      </div>
      <div>
        <h4>必须盯住的红线</h4>
        <ol>
          <li>疲劳/压力过高会受伤、争执，连续高强度会崩溃。</li>
          <li>设备完整度低会直接拖累最终演出。</li>
          <li>能源、零件、资金不会无限增长，零工也有代价。</li>
          <li>成员受伤时只能休息恢复。</li>
        </ol>
      </div>
    </div>
    <div class="help-route">
      🎯 <b>录屏推荐路线（仍需亲自操作）：</b><br>
      第1天 找织女星谈心解锁灯光室 → 老鲍在主舞台应急检修解锁维修舱；
      之后每天“林练台词/凯练反应、织女星练灯光、老鲍深度维修”，穿插团队排练与一次零工；
      第4天观众席开放后路演抬期待值；触发剧情时优先“群戏/极光/稳妥修补”；
      第10天保持全员疲劳低于60，即可冲击完美谢幕。
    </div>
    <div class="row">
      <button class="btn" id="intro-skip">跳过开场，直接开始</button>
      <button class="btn primary" id="intro-go">我准备好了</button>
    </div>`, { closable: false });
  document.querySelectorAll('#intro-go, #intro-skip').forEach(b => b.onclick = () => {
    $('modal-root').innerHTML = '';
    saveGame(state, 'auto');
  });
}

function openHelp() {
  modal(`
    <h2>操作说明与推荐路线</h2>
    <div class="help-cols">
      <div>
        <h4>基本操作</h4>
        <ol>
          <li>左侧地图点击区域切换场景（部分区域需解锁）。</li>
          <li>中间场景点击行动卡片：训练会进入操作小游戏，休息/采购/零工立即结算。</li>
          <li>团队排练需选一名搭档；行动会消耗行动点与能源。</li>
          <li>右侧成员卡点击可查看属性、关系、个人目标与剧情。</li>
          <li>点「结束今天」触发夜间总结并进入下一天。</li>
        </ol>
      </div>
      <div>
        <h4>训练小游戏</h4>
        <ol>
          <li>台词：按正确句序点亮字词。</li>
          <li>节奏：收缩环进入判定区时点击/空格。</li>
          <li>灯光：先选舞台区域再选光色。</li>
          <li>维修：按检修流程顺序操作。</li>
          <li>反应：限时选出正确救场方案。</li>
          <li>团队：分配岗位、出场顺序与配合方式。</li>
        </ol>
      </div>
    </div>
    <div class="help-route">
      🎯 <b>推荐路线：</b>织女星谈心 → 老鲍检修 → 主演练表演/凯练反应/织女星练光/老鲍维修并行 →
      团队排练抬排练度 → 第4天起路演抬期待 → 第9天全员休息 → 第10天演出。
    </div>
    <div class="row"><button class="btn primary" id="help-close">明白了</button></div>`);
  $('help-close').onclick = () => $('modal-root').innerHTML = '';
}

function openSettings() {
  const m = modal(`
    <h2>设置</h2>
    <div class="settings-grid">
      <div class="switch-row"><span>音效</span>
        <button class="btn small" id="set-sound">${isSoundOn() ? '已开启' : '已关闭'}</button></div>
      <div class="switch-row"><span>存档</span>
        <button class="btn small" id="set-save">立即保存</button></div>
      <div class="switch-row"><span>危险操作</span>
        <button class="btn small danger" id="set-clear">清除存档</button></div>
    </div>
    <p class="sub" style="margin-top:14px">游戏会在每天结束、训练结算后自动保存到浏览器本地。</p>
    <div class="row"><button class="btn" id="set-close">关闭</button></div>`);
  m.root.querySelector('#set-sound').onclick = (e) => {
    setSound(!isSoundOn());
    e.target.textContent = isSoundOn() ? '已开启' : '已关闭';
  };
  m.root.querySelector('#set-save').onclick = () => {
    if (state) { saveGame(state, 'manual'); toast('已保存到手动存档', 'good'); }
    else toast('游戏进行中才能保存', 'bad');
  };
  m.root.querySelector('#set-clear').onclick = async () => {
    if (await confirmBox('清除存档', '将删除所有本地进度，确定吗？', '清除', true)) {
      deleteSave('auto'); deleteSave('manual');
      toast('存档已清除', 'good');
    }
  };
  m.root.querySelector('#set-close').onclick = () => $('modal-root').innerHTML = '';
}

// ---------- 渲染 ----------
function render() {
  if (!state) return;
  checkUnlocks(state);
  renderHud();
  renderMap();
  renderScene();
  renderCrew();
  renderGoals();
  renderDevices();
  renderTicker();
  $('btn-night').disabled = state.phase === 'finale';
}

function renderHud() {
  const r = state.resources;
  $('hud-day').textContent = state.day;
  $('hud-ap').textContent = state.ap;
  $('hud-energy').textContent = `${Math.round(r.energy)}/${state.dailyEnergyMax}`;
  $('hud-parts').textContent = Math.round(r.parts);
  $('hud-funds').textContent = Math.round(r.funds);
  $('bar-rehearsal').style.width = `${r.rehearsal}%`;
  $('bar-hype').style.width = `${r.hype}%`;
  const devAvg = Object.values(state.devices).reduce((a, d) => a + d.integrity, 0) / 4;
  const st = $('hud-status');
  if (devAvg >= 60) { st.textContent = '正常'; st.className = 'status-ok'; }
  else if (devAvg >= 35) { st.textContent = '恶化'; st.className = 'status-warn'; }
  else { st.textContent = '危险'; st.className = 'status-bad'; }
  const phaseNames = { morning: '晨间安排', work: '训练/工作', event: '突发事件', night: '夜间总结', finale: '最终演出' };
  $('phase-label').textContent = phaseNames[state.phase] || '';
}

function renderMap() {
  const grid = $('map-grid');
  grid.innerHTML = '';
  for (const [id, loc] of Object.entries(LOCATIONS)) {
    const ls = state.locations[id];
    const open = isLocationOpen(state, id);
    const cell = document.createElement('div');
    cell.className = `map-cell ${id === currentLoc ? 'active' : ''} ${!open.open ? (ls.unlocked ? 'closed' : 'locked') : ''}`;
    cell.innerHTML = `<span class="ic">${loc.icon}</span><b>${loc.name}</b>
      <small>${!ls.unlocked ? '🔒 ' + (loc.unlockNeed || '未解锁')
        : open.open ? '可进入' : '⛔ ' + open.reason}</small>`;
    cell.onclick = () => {
      if (!open.open) { toast(ls.unlocked ? open.reason : loc.unlockNeed || '该区域尚未解锁', 'bad'); return; }
      currentLoc = id;
      state._loc = id;
      renderMap(); renderScene();
    };
    grid.appendChild(cell);
  }
  const loc = LOCATIONS[currentLoc];
  const ls = state.locations[currentLoc];
  const open = isLocationOpen(state, currentLoc);
  $('loc-info').textContent = open.open ? loc.desc : open.reason;
}

const SCENE_ART = {
  stage: '🎭', backstage: '🪞', rehearsal: '🎬', light: '💡',
  repair: '🔧', storage: '📦', audience: '🎪'
};

function renderScene() {
  const loc = LOCATIONS[currentLoc];
  const tags = [];
  if (currentLoc === 'stage') {
    tags.push(`排练进度 ${Math.round(state.resources.rehearsal)}%`);
    tags.push(`道具 ${Math.round(state.resources.props)}%`);
  }
  if (currentLoc === 'light') tags.push(`灯光阵列 ${Math.round(state.devices.lights.integrity)}%`);
  if (currentLoc === 'repair') tags.push(`零件 ${Math.round(state.resources.parts)}`);
  if (currentLoc === 'storage') tags.push(`资金 ${Math.round(state.resources.funds)}`);
  if (currentLoc === 'audience') tags.push(`期待值 ${Math.round(state.resources.hype)}%`);

  $('scene-view').innerHTML = `
    <h2>${loc.icon} ${loc.name}</h2>
    <p class="scene-desc">${loc.desc}</p>
    <div class="scene-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
    <div class="scene-art">${SCENE_ART[currentLoc]}</div>`;

  const list = $('action-list');
  list.innerHTML = '';
  for (const act of Object.values(ACTIVITIES).filter(a => a.loc === currentLoc)) {
    const card = document.createElement('button');
    card.className = 'act-card';
    const costs = [];
    if (act.ap) costs.push(`行动${act.ap}`);
    if (act.energy > 0) costs.push(`能源${act.energy}`);
    if (act.energy < 0) costs.push(`能源+${-act.energy}`);
    if (act.useParts) costs.push(`零件${act.useParts}`);
    if (act.cost) costs.push(`${act.cost.funds ? '资金' + act.cost.funds : ''}`);
    card.innerHTML = `<b>${act.name}</b>${act.desc}<div class="cost">消耗：${costs.join(' · ') || '无'}</div>`;
    // 通用可用性（不针对成员）：资源不足直接禁用并说明
    let lock = null;
    if (state.ap < act.ap) lock = '今日行动点不足';
    else if (act.energy > 0 && state.resources.energy < act.energy) lock = '能源不足';
    else if (act.useParts && state.resources.parts < act.useParts) lock = '零件不足';
    else if (act.cost && state.resources.funds < (act.cost.funds || 0)) lock = '资金不足';
    if (act.id === 'team' && state.ap < 2) lock = '团队排练需要 2 行动点';
    if (lock) { card.disabled = true; card.innerHTML += `<div class="locknote">${lock}</div>`; }
    card.onclick = () => startActivity(act);
    list.appendChild(card);
  }
}

function renderDevices() {
  const box = $('device-list');
  box.innerHTML = '';
  for (const d of Object.values(state.devices)) {
    const row = document.createElement('div');
    row.className = 'dev-row';
    row.innerHTML = `<div class="lbl"><span>${d.name}</span><span>${Math.round(d.integrity)}%</span></div>
      <div class="bar"><i style="width:${d.integrity}%;background:${barColor(d.integrity)}"></i></div>`;
    box.appendChild(row);
  }
}

function renderCrew() {
  const box = $('crew-list');
  box.innerHTML = '';
  for (const id of Object.keys(TRAITS)) {
    const t = TRAITS[id], m = state.members[id];
    const story = nextStory(state, id);
    const sinfo = storyTriggerInfo(state, id);
    const card = document.createElement('div');
    card.className = `crew-card ${sinfo && sinfo.trustReady ? 'ready-story' : ''}`;
    card.innerHTML = `
      <div class="crow-top">
        <div><span class="name">${t.name}</span>
          <span class="role">${t.role} · ${t.trait}</span>
          ${m.injured ? '<span class="badge-injured">养伤</span>' : ''}
          ${sinfo && sinfo.trustReady ? `<span class="badge-story">剧情${sinfo.n}</span>` : ''}
        </div>
        ${m.route ? `<span class="route-badge">${routeName(m.route)}</span>` : ''}
      </div>
      <div class="stat-grid">
        ${Object.entries(STAT_SHORT).map(([k, label]) =>
          `<div class="st"><b>${m.stats[k]}</b>${label}</div>`).join('')}
      </div>
      <div class="meters">
        ${meter('疲劳', m.fatigue, 'fat')}
        ${meter('压力', m.stress, 'str')}
        ${meter('信任', m.trust, 'tru')}
      </div>`;
    card.onclick = () => openMemberDetail(id);
    box.appendChild(card);
  }
}

function meter(label, v, cls) {
  return `<div class="meter ${cls}">${label} ${Math.round(v)}
    <div class="bar"><i style="width:${v}%;background:${barColor(cls === 'tru' ? v : 100 - v)}"></i></div></div>`;
}

function renderGoals() {
  const goals = [
    { done: state.flags.fixedStageOnce, text: '检修主舞台设备（解锁维修舱）' },
    { done: state.locations.light.unlocked, text: '与织女星谈心，解锁灯光室' },
    { done: state.resources.rehearsal >= 60, text: '把排练进度提升到 60%' },
    { done: state.resources.hype >= 50, text: '把观众期待值提升到 50%' },
    { done: Object.values(state.devices).every(d => d.integrity >= 55), text: '所有设备完整度 ≥ 55%' },
    { done: Object.values(state.members).every(m => m.story[1]), text: '完成每名成员的第 1 段剧情' },
    { done: false, text: '第 10 天完成最终演出' }
  ];
  $('goal-list').innerHTML = goals.map(g =>
    `<li class="${g.done ? 'done' : ''}">${g.done ? '✓ ' : '○ '}${g.text}</li>`).join('');
}

function renderTicker() {
  const last = state.log[0];
  $('log-ticker').innerHTML = last
    ? `<b>第${last.day}天</b> · ${last.text}`
    : '欢迎来到失重剧院。点击地图区域，开始安排今天的工作。';
}

// ---------- 成员详情 ----------
function openMemberDetail(id) {
  const t = TRAITS[id], m = state.members[id];
  const story = nextStory(state, id);
  const sinfo = storyTriggerInfo(state, id);
  const rels = Object.keys(TRAITS).filter(x => x !== id).map(x => {
    const v = state.relations[`${id}>${x}`] ?? 50;
    return `<div class="meter">${TRAITS[x].name} ${v}
      <div class="bar"><i style="width:${v}%;background:${barColor(v)}"></i></div></div>`;
  }).join('');
  const storyList = [1, 2, 3].map(n =>
    `<li class="${m.story[n] ? 'done' : ''}">${m.story[n] ? '✓' : sinfo?.n === n && sinfo.trustReady ? '💬' : '🔒'} 第${n}段个人剧情
    ${sinfo?.n === n && !sinfo.trustReady ? `（信任达到 ${sinfo.needTrust} 后可触发）` : ''}</li>`).join('');
  const expTotal = Object.values(m.exp).reduce((a, b) => a + b, 0);
  const mo = modal(`
    <button class="close-x" id="md-x">✕</button>
    <h2>${t.name} <small style="font-size:13px;color:#9aa3c7">${t.role} · ${t.trait}</small></h2>
    <p class="sub">个人目标：${t.goal}<br>${t.desc}</p>
    <div class="kv">
      <dt>发展路线</dt><dd>${m.route ? routeName(m.route) : '尚未定型（剧情第 2 段选择路线）'}</dd>
      <dt>累计成长</dt><dd>${expTotal} 点属性经验</dd>
      <dt>状态</dt><dd>${m.injured ? '养伤中（仅可休息）' : `疲劳 ${Math.round(m.fatigue)} · 压力 ${Math.round(m.stress)} · 信任 ${Math.round(m.trust)}`}</dd>
    </div>
    <h4 style="color:#f0c674;margin:10px 0 6px">关系</h4>
    <div class="meters" style="grid-template-columns:repeat(3,1fr)">${rels}</div>
    <h4 style="color:#b39dff;margin:12px 0 6px">个人剧情</h4>
    <ul class="goal-list">${storyList}</ul>
    <div class="row">
      ${story && sinfo.trustReady ? '<button class="btn primary" id="md-story">💬 触发剧情：' + story.title + '</button>' : ''}
      <button class="btn" id="md-close">关闭</button>
    </div>`);
  mo.root.querySelector('#md-x').onclick = mo.close;
  mo.root.querySelector('#md-close').onclick = mo.close;
  mo.root.querySelector('#md-story')?.addEventListener('click', () => {
    mo.close();
    triggerStory(id, story);
  });
}

function triggerStory(id, story) {
  const body = story.choices
    ? `<div class="finale-lineup">${story.choices.map((c, i) =>
        `<button class="event-choice" data-i="${i}" ${c.when && !c.when(state) ? 'disabled' : ''}>
          ${c.label}${c.when && !c.when(state) ? '<span class="why">当前条件不满足</span>' : ''}</button>`).join('')}</div>`
    : `<div class="row"><button class="btn primary" id="st-go">继续</button></div>`;
  const mo = modal(`
    <h2>💬 ${TRAITS[id].name} · ${story.title}</h2>
    <p class="sub">${story.text}</p>${body}`, { closable: false });
  if (story.choices) {
    mo.root.querySelectorAll('.event-choice').forEach(b => b.onclick = () => {
      const res = completeStory(state, id, story, Number(b.dataset.i));
      if (!res.ok) { toast(res.reason, 'bad'); return; }
      mo.close();
      sfx('event'); toast(`剧情：${res.outcome}`, 'story', 5200);
      afterAction(true);
    });
  } else {
    mo.root.querySelector('#st-go').onclick = () => {
      const res = completeStory(state, id, story, 0);
      mo.close();
      sfx('event'); toast(`剧情：${res.outcome}`, 'story', 5200);
      afterAction(true);
    };
  }
}

// ---------- 行动流程 ----------
function startActivity(act) {
  if (state.phase === 'finale') return;
  // 采购类不需要选人
  if (act.id.startsWith('shop')) {
    const memberId = 'bob';
    const res = doSimpleActivity(state, memberId, act.id);
    handleSimpleResult(res, act);
    return;
  }
  // 选择成员
  const pick = $('member-pick');
  pick.classList.remove('hidden');
  const isTeam = act.id === 'team';
  pick.innerHTML = `<h4>为「${act.name}」选择成员${isTeam ? '（第一名主演，随后选择搭档）' : ''}</h4>
    <div class="pick-grid" id="pick-grid"></div>`;
  const grid = pick.querySelector('#pick-grid');
  for (const id of Object.keys(TRAITS)) {
    const m = state.members[id];
    const check = canDoActivity(state, id, act.id);
    const b = document.createElement('button');
    b.textContent = `${TRAITS[id].name}${m.injured ? '（养伤）' : ''}${!check.ok ? '：' + check.reason : ''}`;
    b.disabled = !check.ok;
    b.onclick = () => {
      pick.classList.add('hidden');
      if (isTeam) pickPartner(act, id);
      else runActivityFor(act, id);
    };
    grid.appendChild(b);
  }
}

function pickPartner(act, firstId) {
  const pick = $('member-pick');
  pick.classList.remove('hidden');
  pick.innerHTML = `<h4>选择搭档（与 ${TRAITS[firstId].name} 联排）</h4>
    <div class="pick-grid" id="pick-grid"></div>`;
  const grid = pick.querySelector('#pick-grid');
  for (const id of Object.keys(TRAITS)) {
    if (id === firstId) continue;
    const m = state.members[id];
    const check = canDoActivity(state, id, 'team');
    const b = document.createElement('button');
    b.textContent = `${TRAITS[id].name}${m.injured ? '（养伤）' : ''}`;
    b.disabled = !check.ok || m.injured;
    b.onclick = () => {
      pick.classList.add('hidden');
      runActivityFor(act, firstId, id);
    };
    grid.appendChild(b);
  }
}

function runActivityFor(act, memberId, partnerId = null) {
  if (!act.minigame) {
    const res = doSimpleActivity(state, memberId, act.id);
    handleSimpleResult(res, act, memberId);
    return;
  }
  const member = { id: memberId, name: TRAITS[memberId].name, ...state.members[memberId] };
  const partner = partnerId
    ? { id: partnerId, name: TRAITS[partnerId].name, ...state.members[partnerId] } : null;
  openMinigame(act.minigame, {
    member, partner,
    onDone: quality => {
      const res = resolveTraining(state, memberId, act.id, quality, partnerId);
      if (res.cancelled) {
        toast(res.reason, 'bad');
        render();
        return;
      }
      sfx(res.ok ? 'good' : 'bad');
      if (res.ok) {
        const gains = Object.entries(res.gains).map(([k, v]) => `${STAT_LABELS[k]}+${v}`).join('、');
        let extra = '';
        if (res.rehearsalGain) extra += `，排练+${res.rehearsalGain}`;
        if (res.hypeGain) extra += `，期待+${res.hypeGain}`;
        if (res.deviceFix && Object.keys(res.deviceFix).length)
          extra += '，设备维修+' + Object.values(res.deviceFix).reduce((a, b) => a + b, 0);
        toast(`《${act.name}》成功：${gains}${extra}`, 'good', 4200);
      } else {
        toast(`《${act.name}》失败：${res.messages.join('，')}`, 'bad', 4600);
      }
      afterAction();
    }
  });
}

function handleSimpleResult(res, act, memberId = 'bob') {
  if (!res.ok) { toast(res.reason, 'bad'); render(); return; }
  sfx('click');
  if (act.id === 'rest') toast(`${TRAITS[memberId].name} 休息了一天，状态恢复。`, 'good');
  else if (act.id === 'gig') toast('零工完成，资金增加，疲劳上升。', 'good');
  else if (act.id === 'talk') {
    toast('谈心完成，信任提升。', 'good');
    const st = nextStory(state, memberId);
    const sinfo = storyTriggerInfo(state, memberId);
    if (st && sinfo && sinfo.trustReady) {
      setTimeout(() => triggerStory(memberId, st), 350);
    }
  } else toast(`${act.name}完成。`, 'info');
  afterAction();
}

function afterAction(silent = false) {
  saveGame(state, 'auto');
  render();
}

// ---------- 每日事件、夜间总结、天数推进 ----------
function bindGameButtons() {
  $('btn-night').onclick = endDay;
  $('btn-save').onclick = () => { saveGame(state, 'auto'); toast('进度已保存', 'good'); };
  $('btn-pause').onclick = () => {
    paused = true;
    const m = modal(`
      <h2>⏸ 已暂停</h2><p class="sub">游戏时间已停止，进度已自动保存。</p>
      <div class="row">
        <button class="btn" id="pa-menu">返回主菜单</button>
        <button class="btn primary" id="pa-go">继续游戏</button>
      </div>`);
    m.root.querySelector('#pa-go').onclick = () => { paused = false; m.close(); };
    m.root.querySelector('#pa-menu').onclick = () => {
      saveGame(state, 'auto');
      m.close(); showScreen('menu');
    };
  };
  $('btn-menu').onclick = async () => {
    saveGame(state, 'auto');
    showScreen('menu');
    toast('进度已保存，可从主菜单继续', 'good');
  };
  $('btn-event-log').onclick = () => showEventLog(state);
}

function maybeDailyEvent() {
  if (eventResolvedToday) return;
  eventResolvedToday = true;
  state.phase = 'event';
  const ev = pickEvent(state);
  sfx('event');
  const choices = availableChoices(state, ev);
  const mo = modal(`
    <div class="event-head">
      <div class="big-icon">${ev.icon}</div>
      <h2>突发事件 · ${ev.title}</h2>
      <p class="sub">${ev.text}</p>
    </div>
    <div>${choices.map(c =>
      `<button class="event-choice" data-i="${c.index}" ${c.enabled ? '' : 'disabled'}>
        ${c.choice.text}${c.enabled ? '' : '<span class="why">条件不满足：成员能力 / 关系 / 资源未达到要求</span>'}
      </button>`).join('')}</div>`, { closable: false });
  mo.root.querySelectorAll('.event-choice').forEach(b => b.onclick = () => {
    const res = resolveEvent(state, ev, Number(b.dataset.i));
    if (!res.ok) { toast(res.reason, 'bad'); return; }
    mo.close();
    toast(`【${ev.title}】${res.outcome}`, 'event', 5600);
    render();
  });
}

async function endDay() {
  if (state.phase === 'finale') return;
  if (state.day === TOTAL_DAYS) {
    startFinale();
    return;
  }
  // 当天未处理事件时先弹事件
  if (!eventResolvedToday) {
    maybeDailyEvent();
    setTimeout(() => toast('请先处理突发事件，再结束今天。', 'event'), 200);
    return;
  }
  state.phase = 'night';
  const sum = nightlySummary(state);
  const fx = applyDueEffects(state);
  startNextDay(state);
  checkUnlocks(state);
  eventResolvedToday = false;
  saveGame(state, 'auto');
  render();
  sfx('click');
  const devAvg = Math.round(Object.values(state.devices).reduce((a, d) => a + d.integrity, 0) / 4);
  modal(`
    <h2>🌙 第 ${state.day - 1} 天 · 夜间总结</h2>
    <p class="sub">剧院在舷窗外安静地旋转，成员们陆续回到休眠舱。</p>
    <ul class="timeline">
      <li><small>休整</small><br>全员疲劳 +4（休眠舱在失重中并不安稳），设备自然老化 -3，道具 -2。</li>
      ${sum.lines.map(l => `<li style="border-color:#ff6f7d"><small>警报</small><br>${l}</li>`).join('')}
      ${fx.map(f => `<li style="border-color:#6dd3ff"><small>延迟影响</small><br>${f.text}</li>`).join('')}
      <li><small>新的一天</small><br>能源配额更新为 ${state.dailyEnergyMax}，行动点恢复为 4。
      ${state.day === TOTAL_DAYS ? '<b style="color:#ffd98a">明天就是最终演出。</b>' : ''}</li>
    </ul>
    <div class="row"><button class="btn primary" id="night-go">进入第 ${state.day} 天</button></div>`);
  $('night-go').onclick = () => {
    $('modal-root').innerHTML = '';
    if (state.day === 4 && !state._audienceNoted) {
      state._audienceNoted = true;
      toast('观众席已开放，可以去路演提升期待值！', 'fx', 4200);
    }
  };
}

// ---------- 事件记录 ----------
function showEventLog(s) {
  const history = s?.eventHistory || [];
  const pending = s?.pendingEffects || [];
  const mo = modal(`
    <button class="close-x" id="el-x">✕</button>
    <h2>📜 事件记录</h2>
    <p class="sub">已处理 ${history.length} 个事件${pending.length ? `，另有 ${pending.length} 个延迟影响待发生` : ''}</p>
    ${history.length ? `<ul class="timeline">${history.map(e =>
      `<li><small>第 ${e.day} 天</small><br>${e.icon} <b>${e.title}</b><br>${e.outcome}</li>`).join('')}</ul>`
      : '<p class="sub">还没有发生突发事件。</p>'}
    ${pending.length ? `<h4 style="color:#6dd3ff;margin-top:12px">即将到来</h4>
      <ul class="timeline">${pending.map(p =>
        `<li style="border-color:#6dd3ff"><small>第 ${p.day} 天</small><br>${p.text}</li>`).join('')}</ul>` : ''}
    <div class="row"><button class="btn" id="el-close">关闭</button></div>`);
  mo.root.querySelector('#el-x').onclick = mo.close;
  mo.root.querySelector('#el-close').onclick = mo.close;
}

// ---------- 最终演出 ----------
function startFinale() {
  state.phase = 'finale';
  const lineup = defaultLineup(state);
  const options = Object.keys(TRAITS).map(id =>
    `<option value="${id}">${TRAITS[id].name}</option>`).join('');
  const mo = modal(`
    <h2>🎭 第 10 天 · 最终演出开场前</h2>
    <p class="sub">确认站位、灯光顺序与备用方案。开场后无法再训练或维修。</p>
    <div class="finale-lineup">
      <div class="lineup-slot"><label>前场主演</label>
        <select id="ln-lead">${options.replace(`value="${lineup.lead}"`, `value="${lineup.lead}" selected`)}</select></div>
      <div class="lineup-slot"><label>替补 / 现场调度</label>
        <select id="ln-sub">${options.replace(`value="${lineup.understudy}"`, `value="${lineup.understudy}" selected`)}</select></div>
      <div class="lineup-slot"><label>灯光师</label>
        <select id="ln-light">${options.replace(`value="${lineup.light}"`, `value="${lineup.light}" selected`)}</select></div>
      <div class="lineup-slot"><label>舞台工程师</label>
        <select id="ln-eng">${options.replace(`value="${lineup.engineer}"`, `value="${lineup.engineer}" selected`)}</select></div>
    </div>
    <div class="kv">
      <dt>灯光顺序</dt><dd>${state.flags.auroraReady
        ? '✅ 可用「极光」序列（更高上限）'
        : '标准灯光序列（在织女星剧情中可准备极光）'}</dd>
      <dt>备用方案</dt><dd>${state.flags.understudyReady
        ? '✅ 备用演员 / 救场方案已就绪'
        : '⛔ 无备用方案，现场容错更低'}</dd>
      <dt>当前排练度</dt><dd>${Math.round(state.resources.rehearsal)}% · 期待值 ${Math.round(state.resources.hype)}%</dd>
    </div>
    <div class="row">
      <button class="btn" id="ln-cancel">再准备一下（返回）</button>
      <button class="btn primary" id="ln-go">🎬 正式开场</button>
    </div>`, { closable: false });
  mo.root.querySelector('#ln-cancel').onclick = () => {
    state.phase = 'morning';
    mo.close(); render();
  };
  mo.root.querySelector('#ln-go').onclick = () => {
    const chosen = {
      lead: $('ln-lead').value,
      understudy: $('ln-sub').value,
      light: $('ln-light').value,
      engineer: $('ln-eng').value,
      lightSequence: state.flags.auroraReady ? 'aurora' : 'standard',
      backupPlan: state.flags.understudyReady ? 'ready' : 'none'
    };
    const ids = Object.entries(chosen).filter(([k]) => ['lead', 'understudy', 'light', 'engineer'].includes(k));
    const vals = ids.map(([, v]) => v);
    if (new Set(vals).size < 4) { toast('四个岗位必须安排不同成员！', 'bad'); return; }
    createFinale(state, chosen);
    mo.close();
    saveGame(state, 'auto');
    renderFinale();
  };
}

function renderFinale() {
  renderHud();
  const f = state.finale;
  const scene = $('scene-view');
  $('map-grid').querySelectorAll('.map-cell').forEach(c => c.style.pointerEvents = 'none');

  if (f.step === 0 || !FINALE_PHASES[f.step - 1]) {
    f.step = 1;
  }
  showFinaleCue();
}

function showFinaleCue() {
  const f = state.finale;
  const phase = FINALE_PHASES[f.step - 1];
  sfx('finale');
  const memberForCue = {
    p1: state.members[f.lineup.light],
    p2: state.members[f.lineup.engineer],
    p3: state.members[f.lineup.understudy]
  }[phase.id];
  const mo = modal(`
    <h2>🎭 ${phase.title}</h2>
    <div class="finale-stage" style="margin:8px 0">
      <div class="cue-banner">⚠️ 现场变化：${phase.prompt}</div>
      <p class="sub" style="margin-top:12px">负责人：${TRAITS[memberForCue.id].name}
      （关键属性 ${phase.id === 'p1' ? '技术/专注' : phase.id === 'p2' ? '技术' : '反应'}，
      疲劳 ${Math.round(memberForCue.fatigue)}）。操作得分与成员能力、设备状态共同决定判定。</p>
      <div style="text-align:center;font-size:60px" class="scene-art">
        ${phase.minigame === 'light' ? '💡' : phase.minigame === 'repair' ? '🔧' : '🆘'}</div>
    </div>
    <div class="row"><button class="btn primary" id="cue-go">立即处理（${phase.cue}操作）</button></div>`,
    { closable: false });
  mo.root.querySelector('#cue-go').onclick = () => {
    mo.close();
    openMinigame(phase.minigame, {
      member: { id: memberForCue.id, name: TRAITS[memberForCue.id].name, ...memberForCue },
      onDone: quality => {
        const rec = resolveCue(state, quality);
        sfx(rec.success ? 'good' : 'bad');
        toast(`${phase.title}判定 ${Math.round(rec.score)} 分：${rec.success ? '稳住了！' : '出现失误！'}`,
          rec.success ? 'good' : 'bad', 4000);
        saveGame(state, 'auto');
        f.step += 1;
        if (f.step > FINALE_PHASES.length) {
          showEnding();
        } else {
          setTimeout(showFinaleCue, 700);
        }
      }
    });
  };
}

function showEnding() {
  const result = state.ending || computeEnding(state);
  state.ending = result;
  saveGame(state, 'auto');
  sfx(result.endingId === 'fail' ? 'bad' : 'finale');
  const minutes = Math.max(1, Math.round((result.durationMs || 60000) / 60000));
  const growth = Object.values(state.members).map(m => {
    const totalExp = Object.values(m.exp).reduce((a, b) => a + b, 0);
    const t = TRAITS[m.id];
    const cond = m.injured ? '最终带伤上场'
      : (m.fatigue + m.stress) > 130 ? '疲惫登台'
      : (m.fatigue + m.stress) > 70 ? '状态一般' : '状态完好';
    return `<li>${t.name}：${m.route ? routeName(m.route) : '未定型'}，累计成长 ${totalExp}，${cond}</li>`;
  }).join('');
  const keyChoices = state.eventHistory.slice(-5).map(e =>
    `<li>第${e.day}天 ${e.icon}${e.title}：${e.choice}</li>`).join('');
  const failOrWeak = result.endingId === 'perfect'
    ? '<li>所有三个现场环节全部成功，准备分与现场分都达到顶级。</li>'
    : result.reasons.map(r => `<li>${r}</li>`).join('');
  modal(`
    <div class="ending-card ${result.endingId === 'fail' ? 'fail' : ''}">
      <div style="font-size:50px">${
        { perfect: '🌟', closed: '🎭', rough: '🌀', fail: '🥀' }[result.endingId]}</div>
      <div class="ending-title">${result.title}</div>
      <div class="score-big">${result.total} 分</div>
      <p class="sub">准备分 ${result.prep} · 现场均分 ${result.cueAvg} · 成功环节 ${result.successCount}/3</p>
      <div class="audience-says">${result.audience}</div>
      <div style="text-align:left">
        <h4 style="color:#f0c674">成员成长与最终状态</h4>
        <ul class="growth-list">${growth}</ul>
        <h4 style="color:#b39dff">关键选择（近 5 件）</h4>
        <ul class="growth-list">${keyChoices || '<li>无重大事件记录</li>'}</ul>
        <h4 style="color:${result.endingId === 'fail' ? '#ff8a95' : '#78e08f'}">
          ${result.endingId === 'perfect' ? '完美成因' : '失败 / 失分原因'}</h4>
        <ul class="growth-list">${failOrWeak}</ul>
        <p class="sub">最终演出现场操作耗时约 ${minutes} 分钟；完整 10 天流程约 10 分钟。</p>
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn" id="end-replay">♻️ 再录一次（重新开始）</button>
        <button class="btn primary" id="end-menu">返回主菜单</button>
      </div>
    </div>`, { closable: false });
  $('end-replay').onclick = async () => {
    if (await confirmBox('重新开始', '将清除本次通关存档并开始新游戏，确定吗？', '重新开始', true)) {
      deleteSave('auto');
      $('modal-root').innerHTML = '';
      newGame();
    }
  };
  $('end-menu').onclick = () => { $('modal-root').innerHTML = ''; showScreen('menu'); };
}

// ---------- 启动 ----------
bindMenu();
bindGameButtons();
$('btn-continue').disabled = !hasSave();
showScreen('menu');

// 自动化/录屏调试：?autostart=1 直接以新存档进入游戏（不影响正常入口）
if (location.search.includes('autostart')) {
  newGame();
}

// 自动化调试：?finale=perfect|rough|fail 直接进入最终演出配置界面
if (location.search.includes('finale=')) {
  newGame();
  const mode = new URLSearchParams(location.search).get('finale');
  if (mode === 'perfect' || mode === 'rough') {
    state.resources.rehearsal = mode === 'perfect' ? 95 : 45;
    state.resources.hype = mode === 'perfect' ? 90 : 40;
    state.resources.props = mode === 'perfect' ? 90 : 45;
    for (const d of Object.values(state.devices))
      d.integrity = mode === 'perfect' ? 90 : 45;
    if (mode === 'perfect') {
      for (const m of Object.values(state.members)) {
        for (const k of Object.keys(m.stats)) m.stats[k] = 9;
        m.trust = 85; m.fatigue = 15; m.stress = 15;
      }
      state.flags.auroraReady = true;
      state.flags.understudyReady = true;
    }
  }
  state.day = 10;
  render();
  startFinale();
}

// 自动化调试：?ending=perfect|closed|rough|fail 直接展示对应结局页
if (location.search.includes('ending=')) {
  const mode = new URLSearchParams(location.search).get('ending');
  newGame();
  state.day = 10;
  const setups = {
    perfect: () => {
      state.resources = { energy: 30, parts: 50, funds: 80, rehearsal: 98, props: 95, hype: 95 };
      for (const d of Object.values(state.devices)) d.integrity = 95;
      for (const m of Object.values(state.members)) {
        for (const k of Object.keys(m.stats)) m.stats[k] = 10;
        m.fatigue = 10; m.stress = 10; m.trust = 95;
      }
      for (const k of Object.keys(state.relations)) state.relations[k] = 95;
      Object.assign(state.flags, { auroraReady: true, understudyReady: true,
        linFinaleReady: true, kaiFinaleReady: true, vegaFinaleReady: true, bobFinaleReady: true });
      return 1;
    },
    closed: () => {
      state.resources = { energy: 25, parts: 30, funds: 40, rehearsal: 65, props: 65, hype: 60 };
      for (const d of Object.values(state.devices)) d.integrity = 62;
      for (const m of Object.values(state.members)) {
        m.fatigue = 35; m.stress = 30; m.trust = 58;
      }
      state.flags.understudyReady = true;
      return 0.72;
    },
    rough: () => {
      state.resources = { energy: 20, parts: 15, funds: 20, rehearsal: 35, props: 40, hype: 35 };
      for (const d of Object.values(state.devices)) d.integrity = 40;
      for (const m of Object.values(state.members)) {
        m.fatigue = 55; m.stress = 50; m.trust = 40;
      }
      return 0.35;
    },
    fail: () => {
      state.resources = { energy: 10, parts: 5, funds: 5, rehearsal: 5, props: 12, hype: 8 };
      for (const d of Object.values(state.devices)) d.integrity = 12;
      for (const m of Object.values(state.members)) {
        for (const k of Object.keys(m.stats)) m.stats[k] = 2;
        m.fatigue = 95; m.stress = 90; m.trust = 10;
      }
      for (const k of Object.keys(state.relations)) state.relations[k] = 15;
      return 0.05;
    }
  };
  const q = (setups[mode] || setups.fail)();
  createFinale(state, defaultLineup(state));
  for (let i = 0; i < FINALE_PHASES.length; i++) {
    state.finale.step = i + 1;
    resolveCue(state, q);
  }
  showEnding();
}
