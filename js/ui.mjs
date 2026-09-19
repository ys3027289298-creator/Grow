// UI 辅助：模态框、Toast、音效

export const $ = id => document.getElementById(id);

export function toast(text, kind = 'info', ms = 3600) {
  const zone = $('toast-zone');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  zone.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, ms - 400);
  setTimeout(() => el.remove(), ms);
}

export function modal(html, { closable = true } = {}) {
  const root = $('modal-root');
  root.innerHTML = `<div class="modal-back"><div class="modal">
    ${closable ? '<button class="close-x" id="modal-x">✕</button>' : ''}
    ${html}</div></div>`;
  const close = () => { root.innerHTML = ''; };
  if (closable) {
    $('modal-x')?.addEventListener('click', close);
    root.querySelector('.modal-back').addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  }
  return { close, root: root.querySelector('.modal') };
}

export function confirmBox(title, text, okLabel = '确定', danger = false) {
  return new Promise(resolve => {
    const m = modal(`
      <h2>${title}</h2><p class="sub">${text}</p>
      <div class="row">
        <button class="btn" id="cf-no">取消</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${okLabel}</button>
      </div>`);
    m.root.querySelector('#cf-no').onclick = () => { m.close(); resolve(false); };
    m.root.querySelector('#cf-ok').onclick = () => { m.close(); resolve(true); };
  });
}

// 简易 WebAudio 音效（无外部资源）
let actx = null;
let soundOn = true;
export function setSound(on) { soundOn = on; }
export function isSoundOn() { return soundOn; }
function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
export function sfx(kind) {
  if (!soundOn) return;
  try {
    const ctx = ac();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    const notes = {
      good: [523, 659, 784], bad: [220, 180], event: [392, 330, 262],
      click: [440], finale: [523, 659, 784, 1046]
    }[kind] || [440];
    notes.forEach((f, i) => {
      const oo = ctx.createOscillator(), gg = ctx.createGain();
      oo.connect(gg); gg.connect(ctx.destination);
      oo.type = kind === 'bad' ? 'sawtooth' : 'sine';
      oo.frequency.value = f;
      gg.gain.setValueAtTime(0.0001, now + i * 0.09);
      gg.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.16);
      oo.start(now + i * 0.09); oo.stop(now + i * 0.09 + 0.18);
    });
    g.gain.value = 0.0001; o.stop(now + 0.02);
  } catch { /* 无音频环境时忽略 */ }
}

export function barColor(v) {
  if (v >= 66) return 'linear-gradient(90deg,#3fae5f,#78e08f)';
  if (v >= 33) return 'linear-gradient(90deg,#c99a3a,#f0c674)';
  return 'linear-gradient(90deg,#c24552,#ff6f7d)';
}
