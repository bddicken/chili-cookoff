// Admin ("Pit Boss") page: entries, voting open/closed, QR poster, reset.
const app = $('#app');
const voteUrl = `${location.origin}/`;
let key = '';
let state = null;

(async function init() {
  const res = await requireKey(app);
  key = res.key;
  state = await api('/api/admin/state?board=1', { key });
  renderShell();
  renderAll();
  refreshRaces();
  setInterval(refreshStatus, 5000);
})();

function renderShell() {
  app.innerHTML = `
    <section class="panel">
      <h2>Status</h2>
      <div class="status-grid">
        <div class="stat"><div class="k">Voting</div><div class="v" id="s-open"></div></div>
        <div class="stat"><div class="k">Ballots cast</div><div class="v" id="s-votes"></div></div>
        <div class="stat"><div class="k">Chilis entered</div><div class="v" id="s-entries"></div></div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-fire" style="width:auto" id="toggle-open"></button>
        <a class="btn btn-ghost" href="/wheel" target="_blank" rel="noopener" style="text-decoration:none">🎡 Spin for the winner</a>
        <button class="btn btn-ghost" id="logout" style="margin-left:auto">Lock</button>
      </div>
    </section>

    <section class="panel">
      <h2>After-vote game</h2>
      <p class="hint">When on, guests see a "Play Turkey Racer" button after they vote: a quick 3D farm kart race.</p>
      <div class="row">
        <div class="stat" style="flex:1 1 180px"><div class="k">Turkey Racer</div><div class="v" id="s-game"></div></div>
        <button class="btn btn-ghost" id="toggle-game"></button>
        <a class="btn btn-ghost" href="/race" target="_blank" rel="noopener" style="text-decoration:none">🏁 Try it</a>
      </div>
    </section>

    <section class="panel">
      <h2>Turkey Racer times</h2>
      <p class="hint" id="race-hint">Every finished race is saved. Fastest first; players can add their name on the results screen.</p>
      <ol class="board" id="race-board"></ol>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-danger" id="reset-races">🗑️ Reset race times</button>
        <span class="hint" style="margin:0">Clears every saved time, e.g. after practice runs.</span>
      </div>
    </section>

    <section class="panel">
      <h2>Vote leaderboard</h2>
      <p class="hint">Live vote counts, updated every few seconds. Only visible here, never on guests' phones.</p>
      <ol class="board" id="board"></ol>
    </section>

    <section class="panel">
      <h2>Voting link</h2>
      <p class="hint">Print these and put them by the pots. Two signs per sheet: cut down the dashed line.</p>
      <div class="qr-wrap">
        <div class="qr" id="qr"></div>
        <div style="flex:1 1 220px">
          <div class="url">${esc(voteUrl)}</div>
          <div class="row" style="margin-top:12px">
            <button class="btn btn-ghost btn-small" id="print">🖨️ Print QR posters (2 per page)</button>
            <button class="btn btn-ghost btn-small" id="copy">📋 Copy link</button>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Chilis</h2>
      <p class="hint">Number each pot so tasters can match it on the ballot. The winner card always shows the cook.</p>
      <div class="row" style="margin-bottom:14px">
        <div class="stat" style="flex:1 1 180px"><div class="k">Cook names on the ballot</div><div class="v" id="s-cooks"></div></div>
        <button class="btn btn-ghost" id="toggle-cooks"></button>
      </div>
      <form class="row" id="add-form" style="margin-bottom:14px">
        <input class="field num" name="number" type="number" min="1" placeholder="#" aria-label="Pot number">
        <input class="field grow" name="name" maxlength="80" placeholder="Chili name (e.g. Smoky Brisket Chili)" aria-label="Chili name" required>
        <input class="field grow" name="cook" maxlength="80" placeholder="Cook (optional)" aria-label="Cook">
        <button class="btn btn-ok">Add</button>
      </form>
      <div class="entries" id="entries"></div>
    </section>

    <section class="panel">
      <h2>Event name</h2>
      <form class="row" id="title-form">
        <input class="field grow" name="title" maxlength="80" aria-label="Event name">
        <button class="btn btn-ghost">Save</button>
      </form>
    </section>

    <section class="panel">
      <h2>Danger zone</h2>
      <p class="hint">Clears every ballot (for example after a test run). Entries stay.</p>
      <button class="btn btn-danger" id="reset">Reset all votes</button>
    </section>`;

  $('#reset-races').addEventListener('click', async () => {
    if (!raceData.totalRaces) { toast('No race times to clear'); return; }
    if (!confirm(`Delete all ${raceData.totalRaces} saved Turkey Racer times? This can't be undone.`)) return;
    await run(async () => {
      await api('/api/admin/reset-race-times', { method: 'POST', key });
      await refreshRaces();
      toast('Race times cleared');
    });
  });

  $('#qr').innerHTML = qrSvg(voteUrl);
  document.querySelectorAll('.poster-qr').forEach((el) => { el.innerHTML = qrSvg(voteUrl); });

  $('#toggle-open').addEventListener('click', async () => {
    const open = !state.open;
    if (!open && !confirm('Close voting? Guests will no longer be able to vote.')) return;
    await run(async () => {
      Object.assign(state, await api('/api/admin/settings', { method: 'POST', key, body: { open } }));
      renderStatus();
      toast(open ? 'Voting is open 🔥' : 'Voting closed 🥁');
    });
  });

  $('#toggle-cooks').addEventListener('click', async () => {
    await run(async () => {
      Object.assign(state, await api('/api/admin/settings', { method: 'POST', key, body: { cooks: !state.cooks } }));
      renderStatus();
      toast(state.cooks ? "Cooks' names are showing on the ballot" : "Cooks' names are hidden (blind tasting)");
    });
  });

  $('#toggle-game').addEventListener('click', async () => {
    await run(async () => {
      Object.assign(state, await api('/api/admin/settings', { method: 'POST', key, body: { game: !state.game } }));
      renderStatus();
      toast(state.game ? 'Turkey Racer is on 🦃' : 'Turkey Racer is off');
    });
  });

  $('#logout').addEventListener('click', () => { setKey(''); location.reload(); });
  $('#print').addEventListener('click', () => print());
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(voteUrl); toast('Link copied'); }
    catch { toast(voteUrl); }
  });

  $('#add-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    await run(async () => {
      await api('/api/admin/entries', {
        method: 'POST', key,
        body: { number: f.number.value ? Number(f.number.value) : undefined, name: f.name.value, cook: f.cook.value },
      });
      f.reset();
      f.name.focus();
      await refreshAll();
      toast('Chili added 🌶️');
    });
  });

  $('#title-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await run(async () => {
      Object.assign(state, await api('/api/admin/settings', { method: 'POST', key, body: { title: ev.target.title.value } }));
      renderStatus();
      toast('Saved');
    });
  });

  $('#reset').addEventListener('click', async () => {
    if (!confirm(`Delete all ${state.totalVotes} ballots? This can't be undone.`)) return;
    await run(async () => {
      await api('/api/admin/reset-votes', { method: 'POST', key });
      await refreshAll();
      toast('All votes cleared');
    });
  });
}

function renderAll() {
  renderStatus();
  renderBoard();
  renderEntries();
  $('#title-form').title.value = state.title;
}

function renderStatus() {
  $('#title').textContent = state.title;
  document.querySelectorAll('.poster-title').forEach((el) => { el.textContent = state.title; });
  $('#s-open').innerHTML = state.open ? '<span class="dot on"></span>Open' : '<span class="dot off"></span>Closed';
  $('#s-votes').textContent = state.totalVotes;
  $('#s-entries').textContent = state.entries.length;
  $('#toggle-open').textContent = state.open ? 'Close voting' : 'Open voting';
  $('#s-game').innerHTML = state.game ? '<span class="dot on"></span>On' : '<span class="dot off"></span>Off';
  $('#toggle-game').textContent = state.game ? 'Turn off' : 'Turn on';
  $('#s-cooks').innerHTML = state.cooks ? '<span class="dot on"></span>Shown' : '<span class="dot off"></span>Hidden';
  $('#toggle-cooks').textContent = state.cooks ? 'Hide cooks' : 'Show cooks';
}

function renderBoard() {
  const box = $('#board');
  if (!state.entries.length) {
    box.innerHTML = `<li class="empty">No chilis yet.</li>`;
    return;
  }
  const total = state.totalVotes;
  const rows = [...state.entries].sort((a, b) => b.votes - a.votes || a.number - b.number);
  let rank = 0;
  let prev = null;
  box.innerHTML = rows
    .map((e, i) => {
      if (e.votes !== prev) { rank = i + 1; prev = e.votes; }
      const medal = e.votes > 0 && rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank;
      const pct = total ? Math.round((e.votes / total) * 100) : 0;
      return `
        <li class="board-row${e.votes > 0 && rank === 1 ? ' lead' : ''}">
          <span class="rank">${medal}</span>
          <span class="who"><b>#${e.number} ${esc(e.name)}</b>${e.cook ? `<small>${esc(e.cook)}</small>` : ''}</span>
          <span class="votes"><b>${e.votes}</b><small>${pct}%</small></span>
          <span class="meter"><i style="width:${pct}%"></i></span>
        </li>`;
    })
    .join('');
}

function renderEntries() {
  const box = $('#entries');
  if (!state.entries.length) {
    box.innerHTML = `<div class="empty">No chilis yet. Add the first one above.</div>`;
    return;
  }
  box.innerHTML = state.entries
    .map(
      (e) => `
      <form class="entry-row" data-id="${e.id}">
        <input class="field num" name="number" type="number" min="1" value="${e.number}" aria-label="Pot number">
        <input class="field grow" name="name" maxlength="80" value="${esc(e.name)}" aria-label="Chili name" required>
        <input class="field grow" name="cook" maxlength="80" value="${esc(e.cook)}" placeholder="Cook" aria-label="Cook">
        <button class="btn btn-ghost btn-small" name="save">Save</button>
        <button class="btn btn-danger btn-small" type="button" name="del" aria-label="Delete ${esc(e.name)}">✕</button>
      </form>`,
    )
    .join('');

  box.querySelectorAll('form').forEach((f) => {
    const id = f.dataset.id;
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await run(async () => {
        await api(`/api/admin/entries/${id}`, {
          method: 'PUT', key,
          body: { number: Number(f.number.value), name: f.name.value, cook: f.cook.value },
        });
        await refreshAll();
        toast('Saved');
      });
    });
    f.del.addEventListener('click', async () => {
      if (!confirm(`Remove "${f.name.value}"? Any votes for it are deleted too.`)) return;
      await run(async () => {
        await api(`/api/admin/entries/${id}`, { method: 'DELETE', key });
        await refreshAll();
        toast('Removed');
      });
    });
  });
}

async function refreshAll() {
  state = await api('/api/admin/state?board=1', { key });
  renderAll();
  refreshRaces();
}

// ---------- Turkey Racer leaderboard ----------
let raceData = { times: [], totalRaces: 0 };
const RACER_EMOJI = { turkey: '🦃', pig: '🐷', sheep: '🐑' };
const RIDE_EMOJI = { buggy: '🎃', pickup: '🛻', tractor: '🚜' };
const raceTime = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`;
const nth = (n) => n + (['th', 'st', 'nd', 'rd'][n] || 'th');
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : new Date(ts).toLocaleDateString();
}
async function refreshRaces() {
  try {
    raceData = await api('/api/admin/race-times', { key });
    renderRaces();
  } catch {}
}
function renderRaces() {
  const box = $('#race-board');
  if (!box) return;
  const n = raceData.totalRaces;
  $('#race-hint').textContent = n
    ? `${n} race${n === 1 ? '' : 's'} finished so far. Fastest ${Math.min(n, raceData.times.length)} shown; players can add their name on the results screen.`
    : 'Every finished race is saved here, fastest first. Players can add their name on the results screen.';
  if (!raceData.times.length) {
    box.innerHTML = `<li class="empty">No races yet. 🦃 Try it to set the first time!</li>`;
    return;
  }
  box.innerHTML = raceData.times
    .map((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || i + 1;
      const who = r.name ? esc(r.name) : '<span style="opacity:.6">Anonymous</span>';
      return `
        <li class="board-row${i === 0 ? ' lead' : ''}">
          <span class="rank">${medal}</span>
          <span class="who"><b>${RACER_EMOJI[r.char] || ''} ${who}</b>
            <small>${RIDE_EMOJI[r.car] || ''} ${nth(r.place)} place · 🎃 ${r.pumpkins} · ${ago(r.created_at)}</small></span>
          <span class="votes"><b>${raceTime(r.time_ms)}</b></span>
        </li>`;
    })
    .join('');
}

// Light poll: only the status numbers, so in-progress edits aren't clobbered.
async function refreshStatus() {
  if (document.visibilityState !== 'visible') return;
  try {
    const s = await api('/api/admin/state?board=1', { key });
    const strip = (list) => JSON.stringify(list.map(({ votes, ...e }) => e));
    const entriesChanged = strip(s.entries) !== strip(state.entries);
    state = s;
    renderStatus();
    renderBoard();
    refreshRaces();
    if (entriesChanged && !$('#entries').contains(document.activeElement)) renderEntries();
  } catch {}
}

async function run(fn) {
  try { await fn(); }
  catch (e) {
    if (e.status === 401) { setKey(''); location.reload(); return; }
    toast(e.message, true);
  }
}
