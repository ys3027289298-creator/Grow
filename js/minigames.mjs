// 六个可操作小游戏。openMinigame(kind, { member, partner, onDone })

const $ = id => document.getElementById(id);

function overlay() {
  let el = $('mg-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mg-overlay';
    el.className = 'mg-overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  el.style.display = 'flex';
  return el;
}
function close() { const el = $('mg-overlay'); if (el) el.style.display = 'none'; }
let done = false;
function finish(cb, q) { if (done) return; done = true; close(); cb(Math.max(0, Math.min(1, q))); }
function header(el, title, hint) {
  el.innerHTML += `<div class="mg-head"><h2>${title}</h2><p>${hint}</p></div>`;
}
function addQuit(el, onDone, cleanup) {
  const b = document.createElement('button');
  b.className = 'mg-quit';
  b.textContent = '放弃（判定失败）';
  b.onclick = () => { cleanup?.(); finish(onDone, 0.15); };
  el.appendChild(b);
}

export function openMinigame(kind, opts) {
  done = false;
  const el = overlay();
  el.dataset.kind = kind;
  ({ sequence: mgSequence, rhythm: mgRhythm, light: mgLight,
     repair: mgRepair, react: mgReact, team: mgTeam })[kind](el, opts);
}

// 1. 台词接龙：按正确顺序点击台词字
function mgSequence(el, { member, onDone }) {
  const words = ['灯', '亮', '了', '请', '别', '让', '它', '熄灭'];
  const picks = words.slice(0, 7);
  const shuffled = [...picks].map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5);
  header(el, '台词训练 · 接龙', `按剧本顺序点亮台词（${member.name}）`);
  const board = document.createElement('div');
  board.className = 'mg-seq';
  el.appendChild(board);
  const slotsRow = document.createElement('div');
  slotsRow.className = 'mg-slots';
  board.appendChild(slotsRow);
  const slots = picks.map((_, i) => {
    const s = document.createElement('div');
    s.className = 'mg-slot';
    s.textContent = `第${i + 1}句`;
    slotsRow.appendChild(s);
    return s;
  });
  const row = document.createElement('div');
  row.className = 'mg-chips';
  board.appendChild(row);
  let step = 0, mistakes = 0, locked = false;
  shuffled.forEach(({ w, i }) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = w;
    b.onclick = () => {
      if (locked || b.disabled) return;
      if (i === step) {
        b.classList.add('done'); b.disabled = true;
        slots[step].classList.add('filled'); slots[step].textContent = w;
        step++;
        if (step === picks.length) {
          locked = true;
          setTimeout(() => finish(onDone, Math.max(0, 1 - mistakes * 0.13)), 450);
        }
      } else {
        mistakes++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 300);
        if (mistakes >= 4) { locked = true; finish(onDone, 0.3); }
      }
    };
    row.appendChild(b);
  });
  addQuit(el, onDone);
}

// 2. 节奏：收缩环进入判定区时点击/空格
function mgRhythm(el, { member, onDone }) {
  header(el, '节奏训练 · 八拍', `圆环进入高亮区时点击或按空格（${member.name}）`);
  const wrap = document.createElement('div');
  wrap.className = 'mg-rhythm';
  wrap.innerHTML = `
    <div class="ring outer"></div><div class="ring hit" id="mg-hit"></div>
    <div class="ring inner" id="mg-inner"></div>
    <div class="beat-count" id="mg-beat">准备…</div>`;
  el.appendChild(wrap);
  const total = 8;
  let beat = 0, score = 0, active = true;
  const start = performance.now() + 1200;
  const beatMs = 850;
  function frame(now) {
    if (!active) return;
    const t = ((now - start) % beatMs + beatMs) % beatMs / beatMs;
    const scale = 1.5 - t * 1.2;
    $('mg-inner').style.transform = `translate(-50%,-50%) scale(${Math.max(0.2, scale)})`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function tap() {
    if (!active) return;
    const now = performance.now();
    if (now < start) return;
    const t = ((now - start) % beatMs) / beatMs;
    const d = Math.min(t, 1 - t);
    const hit = d < 0.1 ? 1 : d < 0.2 ? 0.6 : 0;
    const hitEl = $('mg-hit');
    hitEl.classList.remove('perfect', 'good', 'miss');
    hitEl.classList.add(hit === 1 ? 'perfect' : hit ? 'good' : 'miss');
    setTimeout(() => hitEl.classList.remove('perfect', 'good', 'miss'), 220);
    score += hit; beat++;
    $('mg-beat').textContent = `${beat} / ${total}`;
    if (beat >= total) { active = false; finish(onDone, score / total); }
  }
  wrap.onclick = tap;
  const key = e => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
  window.addEventListener('keydown', key);
  setTimeout(() => { active = false; window.removeEventListener('keydown', key); finish(onDone, score / total); },
    start - performance.now() + total * beatMs + 400);
  addQuit(el, onDone, () => { active = false; window.removeEventListener('keydown', key); });
}

// 3. 灯光：先选区再选颜色，按剧情给对灯光
function mgLight(el, { member, onDone }) {
  header(el, '灯光操作 · 跟光', `读剧情提示，先点舞台区域、再点灯光颜色（${member.name}）`);
  const zones = ['左台', '中台', '右台', '天幕'];
  const colors = [['blue', '冷蓝'], ['gold', '鎏金'], ['red', '暗红'], ['white', '月白']];
  const puzzles = [
    { text: '月神在左台独白回忆地球', zone: '左台', color: 'blue' },
    { text: '火箭点火，中台全员定格', zone: '中台', color: 'gold' },
    { text: '右台风暴逼近，危机降临', zone: '右台', color: 'red' },
    { text: '天幕升起，失重群舞开始', zone: '天幕', color: 'white' },
    { text: '终幕月神停步左台回望地球', zone: '左台', color: 'white' }
  ];
  const cmap = { blue: '#6db4ff', gold: '#ffcf6d', red: '#ff6d6d', white: '#eef6ff' };
  let i = 0, correct = 0;
  const stage = document.createElement('div');
  stage.className = 'mg-light';
  el.appendChild(stage);
  function render() {
    if (i === puzzles.length) return finish(onDone, correct / puzzles.length);
    const p = puzzles[i];
    stage.innerHTML = `<div class="cue-text">「${p.text}」</div>
      <div class="light-stage">${zones.map(z => `<div class="lzone" data-z="${z}">${z}</div>`).join('')}</div>
      <div class="light-colors">${colors.map(([id, n]) => `<button class="lcolor" data-c="${id}">${n}</button>`).join('')}</div>
      <div class="mg-progress">第 ${i + 1}/${puzzles.length} 题 · 正确 ${correct}</div>`;
    let pickedZone = null;
    stage.querySelectorAll('.lzone').forEach(z => z.onclick = () => {
      stage.querySelectorAll('.lzone').forEach(x => x.classList.remove('sel'));
      z.classList.add('sel'); pickedZone = z.dataset.z;
    });
    stage.querySelectorAll('.lcolor').forEach(b => b.onclick = () => {
      if (!pickedZone) { b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 250); return; }
      const ok = pickedZone === p.zone && b.dataset.c === p.color;
      if (ok) {
        correct++;
        const z = stage.querySelector(`.lzone[data-z="${p.zone}"]`);
        z.style.background = cmap[p.color]; z.style.color = '#10131f';
      }
      setTimeout(() => { i++; render(); }, ok ? 420 : 200);
    });
  }
  render();
  addQuit(el, onDone);
}

// 6. 团队排练：把两名成员分配到岗位并选择出场顺序
function mgTeam(el, { member, partner, onDone }) {
  header(el, '团队排练 · 调度', '点击岗位分配成员，再选择开场顺序与任务搭配');
  const people = [member, partner];
  const posts = [
    { id: 'lead', label: '前场主演', prefer: m => m.stats.act },
    { id: 'support', label: '后场调度', prefer: m => m.stats.reaction }
  ];
  const box = document.createElement('div');
  box.className = 'mg-team';
  el.appendChild(box);
  const assign = { lead: null, support: null };
  let orderFirst = member.id;
  let task = 'sync';
  function render() {
    box.innerHTML = `
      <div class="team-posts">${posts.map(p => `
        <div class="tpost" data-p="${p.id}">
          <b>${p.label}</b>
          <div class="tpost-who">${assign[p.id] ? people.find(x => x.id === assign[p.id]).name : '（空）'}</div>
        </div>`).join('')}</div>
      <div class="team-people">${people.map(p => `
        <button class="tperson" data-id="${p.id}">
          ${p.name}<small>表演 ${p.stats.act} · 反应 ${p.stats.reaction}</small></button>`).join('')}</div>
      <div class="team-order">开场顺序：
        ${people.map(p => `<label><input type="radio" name="torder" value="${p.id}" ${orderFirst === p.id ? 'checked' : ''}>${p.name}先出场</label>`).join('')}
      </div>
      <div class="team-task">配合方式：
        <label><input type="radio" name="ttask" value="sync" ${task === 'sync' ? 'checked' : ''}>同步走位（稳）</label>
        <label><input type="radio" name="ttask" value="improv" ${task === 'improv' ? 'checked' : ''}>即兴互动（看默契）</label>
      </div>
      <button class="big-go" id="team-go">开始联排</button>
      <div class="mg-progress" id="team-hint">先把两位成员分配到两个岗位</div>`;
    let picked = null;
    box.querySelectorAll('.tperson').forEach(b => b.onclick = () => {
      picked = b.dataset.id;
      box.querySelectorAll('.tperson').forEach(x => x.classList.toggle('sel', x === b));
    });
    box.querySelectorAll('.tpost').forEach(p => p.onclick = () => {
      if (!picked) return;
      const postId = p.dataset.p;
      const other = postId === 'lead' ? 'support' : 'lead';
      if (assign[other] === picked) assign[other] = null;
      assign[postId] = picked;
      picked = null;
      render();
    });
    box.querySelectorAll('input[name="torder"]').forEach(r => r.onchange = () => (orderFirst = r.value));
    box.querySelectorAll('input[name="ttask"]').forEach(r => r.onchange = () => (task = r.value));
    $('team-go').onclick = () => {
      if (!assign.lead || !assign.lead || assign.lead === assign.support) {
        $('team-hint').textContent = '两个岗位都必须安排不同成员！';
        return;
      }
      // 评分：岗位适配 + 顺序合理 + 配合方式与关系
      const leadM = people.find(x => x.id === assign.lead);
      const supM = people.find(x => x.id === assign.support);
      let fit = 0;
      fit += leadM.stats.act >= supM.stats.act ? 0.4 : 0.1;
      fit += supM.stats.reaction >= leadM.stats.reaction ? 0.3 : 0.05;
      // 顺序：反应高的人后出场更稳；此处用“先出场者表演不低于另一人-2”作宽松判定
      const first = people.find(x => x.id === orderFirst);
      fit += first.stats.act >= 5 ? 0.15 : 0.05;
      fit += task === 'improv' ? 0.15 : 0.1;
      finish(onDone, Math.max(0.2, Math.min(1, fit)));
    };
  }
  render();
  addQuit(el, onDone);
}

// 4. 维修：按正确流程顺序操作
function mgRepair(el, { member, onDone }) {
  header(el, '舞台维修 · 排查', `按检修流程依次操作（${member.name}）`);
  const steps = [
    ['off', '🔌', '切断母线'], ['find', '🔎', '万用表定位'],
    ['replace', '🧰', '更换模块'], ['test', '🧪', '低压试通'], ['on', '⚡', '恢复供电']
  ];
  const grid = document.createElement('div');
  grid.className = 'mg-repair';
  el.appendChild(grid);
  let step = 0, errors = 0;
  function render() {
    grid.innerHTML = `<div class="repair-flow">${steps.map(([id, icon, label], i) =>
      `<button class="rstep ${i < step ? 'done' : ''}" data-id="${id}" ${i < step ? 'disabled' : ''}>
        <span>${icon}</span><b>${label}</b></button>${i < steps.length - 1 ? '<i>→</i>' : ''}`).join('')}</div>
      <div class="mg-progress">流程 ${step}/${steps.length} · 误操作 ${errors}</div>`;
    grid.querySelectorAll('.rstep').forEach(b => b.onclick = () => {
      if (b.dataset.id === steps[step][0]) {
        step++;
        if (step === steps.length) finish(onDone, Math.max(0.35, 1 - errors * 0.2));
        else render();
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 300);
        if (errors >= 3) finish(onDone, 0.35);
        else render();
      }
    });
  }
  render();
  addQuit(el, onDone);
}

// 5. 临场反应：随机突变 + 限时选择
function mgReact(el, { member, onDone }) {
  header(el, '临场反应 · 救场', `在时限内选出正确处理，越快越好（${member.name}）`);
  const crises = [
    { text: '⚠️ 耳麦突然失声！', good: '手势提示', bad: ['原地等待', '大声喊台词'] },
    { text: '💨 道具被气流吹向观众！', good: '安全绳回收', bad: ['跳下台去捡', '假装没看见'] },
    { text: '🌑 追光灯突然熄灭！', good: '移动到亮区', bad: ['停在黑暗中', '用手电照观众'] },
    { text: '🔊 配乐提前 3 秒响起！', good: '提前起跳入拍', bad: ['等原拍点', '跑回后台'] }
  ];
  const box = document.createElement('div');
  box.className = 'mg-react';
  el.appendChild(box);
  let round = 0, score = 0;
  const total = 4;
  function render() {
    if (round === total) return finish(onDone, score / total);
    const c = crises[Math.floor(Math.random() * crises.length)];
    const opts = [c.good, ...c.bad].sort(() => Math.random() - 0.5);
    box.innerHTML = `<div class="crisis">${c.text}</div>
      <div class="timer-bar"><i id="react-timer"></i></div>
      <div class="crisis-opts">${opts.map(o => `<button>${o}</button>`).join('')}</div>
      <div class="mg-progress">第 ${round + 1}/${total} 轮</div>`;
    const bar = $('react-timer');
    const t0 = performance.now(), limit = 3600;
    let answered = false;
    (function anim(now) {
      if (answered) return;
      const left = Math.max(0, 1 - (now - t0) / limit);
      bar.style.width = `${left * 100}%`;
      if (left <= 0) { answered = true; round++; setTimeout(render, 250); return; }
      requestAnimationFrame(anim);
    })(t0);
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (answered) return;
      answered = true;
      const speed = 1 - (performance.now() - t0) / limit;
      if (b.textContent === c.good) score += 0.55 + Math.max(0, speed) * 0.45;
      round++;
      b.classList.add(b.textContent === c.good ? 'right' : 'wrong');
      setTimeout(render, 280);
    });
  }
  render();
  addQuit(el, onDone);
}
