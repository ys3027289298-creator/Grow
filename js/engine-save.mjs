// 本地存档：localStorage（浏览器）/ 内存兜底（Node 测试）
const KEY = 'zgt_save_v1';
let memStore = {};

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return {
    getItem: k => (k in memStore ? memStore[k] : null),
    setItem: (k, v) => { memStore[k] = String(v); },
    removeItem: k => { delete memStore[k]; }
  };
}

export function saveGame(state, slot = 'auto') {
  const payload = {
    slot,
    savedAt: Date.now(),
    state: JSON.parse(JSON.stringify(state))
  };
  storage().setItem(`${KEY}_${slot}`, JSON.stringify(payload));
  storage().setItem(`${KEY}_last`, slot);
  return payload;
}

export function loadGame(slot = null) {
  const key = slot || storage().getItem(`${KEY}_last`);
  if (!key) return null;
  const raw = storage().getItem(`${KEY}_${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!storage().getItem(`${KEY}_last`);
}

export function deleteSave(slot = 'auto') {
  storage().removeItem(`${KEY}_${slot}`);
  const last = storage().getItem(`${KEY}_last`);
  if (last === slot) storage().removeItem(`${KEY}_last`);
}

export function listSaves() {
  const out = [];
  for (const slot of ['auto', 'manual']) {
    const raw = storage().getItem(`${KEY}_${slot}`);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        out.push({ slot, savedAt: p.savedAt, day: p.state?.day });
      } catch { /* ignore */ }
    }
  }
  return out;
}

export const SAVE_FIELDS = [
  'day', 'ap', 'resources', 'members', 'devices',
  'locations', 'log', 'eventHistory', 'flags', 'pendingEffects', 'finale'
];
