// Shared helpers for all pages.
const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(path, { method = 'GET', body, key } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (key) headers['x-admin-key'] = key;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const e = new Error(data?.error || `Request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

// ---------- toast ----------
let toastTimer;
function toast(msg, bad = false) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('bad', bad);
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- falling leaves ----------
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function spawnLeaves(count = 12) {
  const box = $('.leaves');
  if (!box || reducedMotion) return;
  const glyphs = ['🍂', '🍁', '🍂', '🍁', '🌶️'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'leaf';
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.setProperty('--size', `${24 + Math.random() * 22}px`);
    s.style.setProperty('--dur', `${11 + Math.random() * 12}s`);
    s.style.setProperty('--delay', `${-Math.random() * 20}s`);
    s.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    s.style.setProperty('--spin', `${(Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360)}deg`);
    box.appendChild(s);
  }
}

// ---------- confetti (chili + leaf + paper) ----------
function confetti({ duration = 2500, amount = 140, emoji = true } = {}) {
  if (reducedMotion) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  resize();
  addEventListener('resize', resize);
  const colors = ['#ff6a2b', '#ffb52e', '#c8321f', '#fff3df', '#9aab45'];
  const glyphs = ['🌶️', '🔥', '🍂', '🌽', '🏆'];
  const parts = Array.from({ length: amount }, () => ({
    x: Math.random() * c.width,
    y: -Math.random() * c.height * 0.6,
    vx: (Math.random() - 0.5) * 4 * dpr,
    vy: (2 + Math.random() * 4) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: (6 + Math.random() * 8) * dpr,
    h: (8 + Math.random() * 10) * dpr,
    color: colors[(Math.random() * colors.length) | 0],
    glyph: emoji && Math.random() < 0.28 ? glyphs[(Math.random() * glyphs.length) | 0] : null,
  }));
  const start = performance.now();
  (function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, c.width, c.height);
    let alive = 0;
    for (const p of parts) {
      if (elapsed < duration && p.y > c.height) { p.y = -20; p.x = Math.random() * c.width; }
      p.x += p.vx + Math.sin((t / 400) + p.r) * 0.8 * dpr;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y < c.height + 40) alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      if (p.glyph) {
        ctx.font = `${28 * dpr}px serif`;
        ctx.fillText(p.glyph, -14 * dpr, 10 * dpr);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
      }
      ctx.restore();
    }
    if (alive > 0) requestAnimationFrame(frame);
    else { removeEventListener('resize', resize); c.remove(); }
  })(start);
}

// ---------- QR code (uses qrcode-generator from CDN) ----------
function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

// ---------- admin key (shared by /admin and /wheel) ----------
const KEY_STORE = 'chili-admin-key';
const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
const setKey = (k) => { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch {} };

// Renders a login card into `mount`, resolves with a working key.
function requireKey(mount) {
  return new Promise((resolve) => {
    const tryKey = async (key) => {
      try {
        const state = await api('/api/admin/state', { key });
        setKey(key);
        resolve({ key, state });
        return true;
      } catch (e) {
        if (e.status !== 401) toast(e.message, true);
        return false;
      }
    };
    const showForm = (msg) => {
      mount.innerHTML = `
        <form class="card login" id="login-form">
          <div class="big-emoji">🔐</div>
          <h2>Pit Boss Only</h2>
          <p>${esc(msg || 'Enter the admin key to continue.')}</p>
          <div class="row" style="margin-top:16px">
            <input class="field grow" id="key-in" type="password" autocomplete="current-password" placeholder="Admin key" style="background:#fff;color:#2b170e" required>
            <button class="btn btn-fire" style="width:auto">Unlock</button>
          </div>
        </form>`;
      $('#key-in', mount).focus();
      $('#login-form', mount).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const ok = await tryKey($('#key-in', mount).value.trim());
        if (!ok) toast('That key is not right.', true);
      });
    };
    const saved = getKey();
    if (saved) tryKey(saved).then((ok) => ok || showForm('Saved key no longer works. Enter it again.'));
    else showForm();
  });
}
