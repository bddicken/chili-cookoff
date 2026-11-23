// Spin-the-wheel page: every chili gets an equal slice; the spin always lands on the winner.
const stage = $('#stage');
const controls = $('#controls');
const SLICE_COLORS = [
  ['#c8321f', '#fff3df'],
  ['#ffb52e', '#2b170e'],
  ['#ff6a2b', '#fff3df'],
  ['#fff3df', '#2b170e'],
  ['#9aab45', '#1d2307'],
  ['#7f4f24', '#fff3df'],
];
let key = '';
let state = null;
let rotation = 0; // degrees, clockwise; grows with every spin
let spinning = false;
let audio = null;

(async function init() {
  const res = await requireKey(stage);
  key = res.key;
  state = res.state;
  spawnLeaves(12);
  try { await document.fonts.ready; } catch {}
  render(); // after fonts load, so label measuring is accurate
})();

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if ($('.win-overlay')) closeOverlay(); else spin(); }
  if (e.key === 'Escape') closeOverlay();
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

// ---------- rendering ----------
function render() {
  const n = state.entries.length;
  stage.innerHTML = `
    <div class="wheel-wrap">
      <h1 class="title wheel-title">${esc(state.title)}</h1>
      ${n
        ? `<div class="wheel-box">
             <div class="pointer" id="pointer" aria-hidden="true"></div>
             ${wheelSvg(state.entries)}
           </div>
           <button class="btn btn-fire spin-btn" id="spin">🎡 Spin for the winner!</button>`
        : `<div class="card"><div class="big-emoji">🍲</div><h2>No chilis yet</h2><p>Add the entries in the admin panel first.</p></div>`}
    </div>`;
  $('#spin')?.addEventListener('click', spin);
  fitLabels();
  setRotation(rotation);
  setControls(`
    <button class="btn btn-ghost btn-small" id="fs">⛶ Fullscreen</button>
    <a class="btn btn-ghost btn-small" href="/admin" style="text-decoration:none">← Admin</a>`);
}

function wheelSvg(entries) {
  const n = entries.length;
  const R = 100;
  const seg = 360 / n;
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [(r * Math.cos(a)).toFixed(3), (r * Math.sin(a)).toFixed(3)];
  };
  const font = n <= 4 ? 10 : n <= 6 ? 8.5 : n <= 10 ? 7 : n <= 16 ? 5.6 : 4.4;

  const slices = entries
    .map((e, i) => {
      let ci = i % SLICE_COLORS.length;
      if (i === n - 1 && n > 1 && ci === 0) ci = 2; // don't match the first slice's color
      const [fill, ink] = SLICE_COLORS[ci];
      const [x0, y0] = pt(i * seg, R);
      const [x1, y1] = pt((i + 1) * seg, R);
      const shape =
        n === 1
          ? `<circle r="${R}" fill="${fill}" />`
          : `<path d="M0 0 L${x0} ${y0} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${fill}" stroke="#2b170e" stroke-width="0.8" />`;
      const label = `#${e.number} ${e.name}`;
      const mid = i * seg + seg / 2;
      return `
        <g class="slice" data-id="${e.id}">
          ${shape}
          <text transform="rotate(${mid - 90})" x="${R - 9}" y="0" text-anchor="end" dominant-baseline="central"
                fill="${ink}" font-size="${font}" font-weight="800">${esc(label)}</text>
        </g>`;
    })
    .join('');

  const bulbCount = Math.max(16, Math.min(40, n * 2));
  const bulbs = Array.from({ length: bulbCount }, (_, i) => {
    const [x, y] = pt((i * 360) / bulbCount, R + 5);
    return `<circle class="bulb" cx="${x}" cy="${y}" r="2.1" style="animation-delay:${(i % 2) * 0.5}s" />`;
  }).join('');

  return `
    <svg class="wheel" viewBox="-112 -112 224 224" role="img" aria-label="Prize wheel with ${n} chilis">
      <circle r="${R + 10}" fill="#2b170e" />
      <circle r="${R + 10}" fill="none" stroke="#ffb52e" stroke-width="1.2" />
      <g id="rot">${slices}</g>
      ${bulbs}
      <circle r="17" fill="#fff3df" stroke="#c8321f" stroke-width="3" />
      <text y="1" text-anchor="middle" dominant-baseline="central" font-size="17">🌶️</text>
    </svg>`;
}

// Shrink each label (down to 70%) to fit between the hub and the rim, then truncate if still too long.
function fitLabels() {
  const room = 100 - 9 - 22; // rim inset to hub edge, in wheel units
  document.querySelectorAll('.slice text').forEach((t) => {
    const base = parseFloat(t.getAttribute('font-size'));
    const len = t.getComputedTextLength();
    if (len <= room) return;
    const size = Math.max(base * 0.7, (base * room) / len);
    t.setAttribute('font-size', size.toFixed(2));
    const full = t.textContent;
    let cut = full.length;
    while (t.getComputedTextLength() > room && cut > 4) t.textContent = `${full.slice(0, --cut).trimEnd()}…`;
  });
}

function setRotation(deg) {
  $('#rot')?.setAttribute('transform', `rotate(${deg})`);
}

// ---------- spin ----------
async function spin() {
  if (spinning || !state.entries.length) return;
  if (state.open && !confirm('Spinning closes voting and picks the winner. Ready?')) return;
  spinning = true;
  $('#spin').disabled = true;
  unlockAudio();

  let result;
  try {
    if (state.open) Object.assign(state, await api('/api/admin/settings', { method: 'POST', key, body: { open: false } }));
    const fresh = await api('/api/admin/state', { key });
    const changed = JSON.stringify(fresh.entries.map((e) => [e.id, e.number, e.name])) !==
      JSON.stringify(state.entries.map((e) => [e.id, e.number, e.name]));
    state = fresh;
    if (changed) render();
    result = await api('/api/admin/winner', { key });
  } catch (e) {
    toast(e.message, true);
    spinning = false;
    if ($('#spin')) $('#spin').disabled = false;
    return;
  }

  if (!result.winners.length) {
    spinning = false;
    $('#spin').disabled = false;
    showOverlay(`
      <div class="trophy">🤷</div>
      <div class="wname tied">No votes yet!</div>
      <div class="meta">Get those spoons moving and try again.</div>`);
    return;
  }

  const n = state.entries.length;
  const seg = 360 / n;
  // The server's winner list only ever contains the top vote-getter(s).
  const landOn = result.winners[Math.floor(Math.random() * result.winners.length)];
  const idx = state.entries.findIndex((e) => e.id === landOn.id);
  const jitter = (Math.random() - 0.5) * 0.6; // land inside the slice, not dead center
  const from = rotation;
  const to = landingRotation(from, idx, n, reducedMotion ? 1 : 7, jitter);

  await animateSpin(from, to, reducedMotion ? 1500 : 8500, seg);
  rotation = to;
  // Safety net: if the pointer somehow isn't on the winner, snap to the slice's center.
  if (sliceUnderPointer(rotation, n) !== idx) {
    rotation = landingRotation(rotation, idx, n, 0, 0);
    setRotation(rotation);
  }
  document.querySelectorAll('.slice').forEach((s) =>
    s.classList.toggle('won', result.winners.some((w) => String(w.id) === s.dataset.id)),
  );
  spinning = false;
  $('#spin').disabled = false;
  showWinner(result);
}

// Slices are laid out clockwise from 12 o'clock. Rotating the wheel clockwise by `deg`
// puts the slice that started at angle -deg under the pointer.
function sliceUnderPointer(deg, n) {
  return Math.floor(((((-deg) % 360) + 360) % 360) / (360 / n)) % n;
}

// Rotation (always forward from `from`, plus `spins` full turns) that stops with slice
// `idx` under the pointer. `jitter` in [-0.5, 0.5) offsets from the slice center.
function landingRotation(from, idx, n, spins, jitter) {
  const seg = 360 / n;
  const target = (idx + 0.5 + jitter) * seg;
  const want = (((-target) % 360) + 360) % 360;
  return from + ((((want - (from % 360)) % 360) + 360) % 360) + 360 * spins;
}

function animateSpin(from, to, duration, seg) {
  const pointer = $('#pointer');
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  let lastSlice = null;
  let lastTick = 0;
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const r = from + (to - from) * ease(t);
      setRotation(r);
      const under = sliceUnderPointer(r, Math.round(360 / seg));
      if (under !== lastSlice) {
        if (lastSlice !== null) { lastTick = now; tick(); }
        lastSlice = under;
      }
      const flick = Math.max(0, 1 - (now - lastTick) / 140);
      pointer.style.transform = `translateX(-50%) rotate(${-28 * flick}deg)`;
      if (t < 1) requestAnimationFrame(frame);
      else { pointer.style.transform = 'translateX(-50%)'; resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

// ---------- result ----------
function showWinner({ winners, totalVotes }) {
  const tie = winners.length > 1;
  const w = winners[0];
  const votes = `${w.votes} vote${w.votes === 1 ? '' : 's'}`;
  const byline = (x) => (x.cook ? ` · by <strong>${esc(x.cook)}</strong>` : '');
  showOverlay(`
    <div class="trophy">🏆</div>
    <div class="kicker">${tie ? "It's a tie!" : 'And the winner is'}</div>
    <div class="wname${tie ? ' tied' : ''}">${winners.map((x) => esc(x.name)).join('<br><span style="font-size:.5em">&amp;</span><br>')}</div>
    <div class="meta">
      ${winners.map((x) => `<div><span class="chip">#${x.number}</span>${byline(x)}</div>`).join('')}
      <div style="margin-top:.6em;font-size:.75em">${tie ? 'each with' : 'with'} ${votes} of ${totalVotes} cast</div>
    </div>`);
  winFanfare();
  setTimeout(() => confetti({ duration: 6000, amount: 220 }), 300);
}

function showOverlay(inner) {
  closeOverlay();
  const el = document.createElement('div');
  el.className = 'win-overlay';
  el.innerHTML = `
    <div class="winner">${inner}</div>
    <div class="win-actions">
      <button class="btn btn-ghost" id="ov-close">Show wheel</button>
      <button class="btn btn-ghost" id="ov-again">🎉 More confetti</button>
    </div>`;
  document.body.appendChild(el);
  $('#ov-close').addEventListener('click', closeOverlay);
  $('#ov-again').addEventListener('click', () => confetti({ duration: 3000, amount: 180 }));
}

function closeOverlay() {
  $('.win-overlay')?.remove();
}

// ---------- sound (tiny synthesized clicks; no files) ----------
function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {}
}

function blip(freq, dur, type = 'triangle', vol = 0.08, when = 0) {
  if (!audio) return;
  const t = audio.currentTime + when;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const tick = () => blip(1400, 0.03, 'square', 0.04);
const winFanfare = () => [523, 659, 784, 1047].forEach((f, i) => blip(f, i === 3 ? 0.5 : 0.16, 'triangle', 0.1, i * 0.13));

// ---------- controls ----------
function setControls(html) {
  controls.innerHTML = html;
  controls.hidden = !html;
  $('#fs', controls)?.addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
