// Voter page: pick one chili and submit. Honor system: a shared phone can submit
// another vote afterward (one vote per person).
const view = $('#view');
const dock = $('#dock');
const submitBtn = $('#submit');

const state = {
  mode: 'loading', // loading | ballot | voted | error
  title: 'Chili Cook-Off',
  open: true,
  game: false, // admin switch: offer Turkey Racer after voting
  entries: [],
  lastVote: null, // what this phone voted for last (this visit only)
  selected: null,
  sending: false,
};

const entryById = (id) => state.entries.find((e) => e.id === id);

async function load() {
  try {
    const data = await api('/api/ballot');
    Object.assign(state, { title: data.title, open: data.open, game: !!data.game, entries: data.entries });
    if (state.mode === 'loading' || state.mode === 'error') state.mode = 'ballot';
    if (state.selected && !entryById(state.selected)) state.selected = null;
    if (state.lastVote && !entryById(state.lastVote)) state.lastVote = null;
    // Don't yank someone off the "vote's in" screen on a background refresh.
    if (state.mode === 'voted' && state.open && state.entries.length) return;
    render();
  } catch (e) {
    if (state.mode === 'loading') { state.mode = 'error'; render(e.message); }
  }
}

function render(errMsg) {
  $('#title').textContent = state.title;
  document.title = `${state.title} · Vote`;

  const showDock = state.mode === 'ballot' && state.open && state.entries.length > 0;
  dock.hidden = !showDock;

  if (state.mode === 'error') {
    $('#sub').textContent = '';
    view.innerHTML = card('🥵', 'Kitchen trouble', errMsg || "Couldn't load the ballot.", `<button class="btn btn-ghost" onclick="location.reload()">Try again</button>`);
    return;
  }

  if (!state.open) {
    $('#sub').textContent = 'The ballot box is sealed.';
    const mine = entryById(state.lastVote);
    view.innerHTML = card(
      '🥁',
      'Voting is closed',
      'Hang tight. The winner is about to be announced!',
      '',
      mine ? `You voted for <b>#${mine.number} ${esc(mine.name)}</b>` : '',
    );
    return;
  }

  if (state.entries.length === 0) {
    $('#sub').textContent = 'The pots are still simmering…';
    view.innerHTML = card('🍲', 'No chilis yet', "Entries haven't been added. Check back in a minute!");
    return;
  }

  if (state.mode === 'voted') {
    const mine = entryById(state.lastVote);
    $('#sub').textContent = 'Thanks for voting!';
    view.innerHTML = card(
      '🏆',
      "Your vote's in!",
      'Sharing a phone? Hand it over and vote again.',
      `<button class="btn btn-fire" id="again"><span class="ico">🗳️</span><span>Submit another vote</span></button>` +
        (state.game ? `<a class="btn btn-ghost" href="/race"><span class="ico">🦃</span><span>Play Turkey Racer</span></a>` : ''),
      mine ? `#${mine.number} ${esc(mine.name)}` : '',
    );
    $('#again').addEventListener('click', () => {
      state.mode = 'ballot';
      state.selected = null;
      render();
      scrollTo({ top: 0, behavior: 'smooth' });
    });
    return;
  }

  // Ballot
  $('#sub').textContent = "Try 'em, then pick your favorite.";
  view.innerHTML = `
    <div class="picks" role="radiogroup" aria-label="Chili entries">
      ${state.entries
        .map(
          (e) => `
        <button class="pick" role="radio" aria-checked="${e.id === state.selected}" data-id="${e.id}">
          <span class="num">${e.number}</span>
          <span class="name">${esc(e.name)}${e.cook ? `<small class="cook">${esc(e.cook)}</small>` : ''}</span>
          <span class="tick" aria-hidden="true">✓</span>
        </button>`,
        )
        .join('')}
    </div>`;
  view.querySelectorAll('.pick').forEach((b) =>
    b.addEventListener('click', () => {
      state.selected = Number(b.dataset.id);
      view.querySelectorAll('.pick').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      updateButton();
      if (navigator.vibrate) navigator.vibrate(8);
    }),
  );
  updateButton();
}

function updateButton() {
  const sel = entryById(state.selected);
  submitBtn.disabled = !sel || state.sending;
  if (state.sending) submitBtn.textContent = 'Stoking the fire…';
  else if (!sel) submitBtn.textContent = 'Pick a chili above';
  else submitBtn.textContent = `🔥 Vote for #${sel.number}`;
}

function card(emoji, heading, text, actions = '', votedFor = '') {
  return `
    <div class="card">
      <div class="big-emoji">${emoji}</div>
      <h2>${heading}</h2>
      <p>${text}</p>
      ${votedFor ? `<div class="voted-for">${votedFor}</div>` : ''}
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>`;
}

submitBtn.addEventListener('click', async () => {
  if (!state.selected || state.sending) return;
  state.sending = true;
  updateButton();
  try {
    const res = await api('/api/vote', { method: 'POST', body: { entryId: state.selected } });
    state.lastVote = res.entryId;
    state.selected = null;
    state.mode = 'voted';
    render();
    scrollTo({ top: 0, behavior: 'smooth' });
    confetti({ duration: 1400, amount: 90 });
  } catch (e) {
    toast(e.message, true);
    load();
  } finally {
    state.sending = false;
    updateButton();
  }
});

spawnLeaves(10);
load();
// Pick up late entries / voting closing without a manual refresh.
setInterval(() => { if (!state.sending && document.visibilityState === 'visible') load(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
