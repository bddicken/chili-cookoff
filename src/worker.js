// Chili Cook-Off voting — Cloudflare Worker + D1.
//
// Public:
//   GET  /api/ballot              -> { title, open, game, cooks, entries:[{id,number,name,cook?}] }
//   POST /api/vote {entryId}      -> records one ballot. Honor system: a shared phone can
//                                    vote several times (each ballot is its own row).
//                                    A device cookie is stored with each ballot for reference.
// Admin (header `x-admin-key: <ADMIN_KEY>`):
//   GET    /api/admin/state       -> settings, entries (with cooks), ballot count
//                                     ?board=1 adds per-chili vote counts (admin leaderboard only)
//   POST   /api/admin/settings    -> { title?, open?, game?, cooks? }  (game: Turkey Racer after voting; cooks: show cook names on the ballot)
//   POST   /api/admin/entries     -> { number?, name, cook? }
//   PUT    /api/admin/entries/:id -> { number, name, cook }
//   DELETE /api/admin/entries/:id
//   GET    /api/admin/winner      -> top entry (or entries, on a tie) only
//   POST   /api/admin/reset-votes
//   GET    /api/admin/race-times  -> fastest Turkey Racer times + total races
//   POST   /api/admin/reset-race-times
// Turkey Racer:
//   POST /api/race {time, place, char, car, pumpkins}  -> { id, token } (saved for every finished race)
//   POST /api/race/:id/name {token, name}              -> attach a name to that race

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS entries (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     number INTEGER NOT NULL,
     name TEXT NOT NULL,
     cook TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ballots (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     voter_id TEXT NOT NULL,
     entry_id INTEGER NOT NULL,
     created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ballots_entry ON ballots(entry_id)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS race_times (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL DEFAULT '',
     char TEXT NOT NULL,
     car TEXT NOT NULL,
     time_ms INTEGER NOT NULL,
     place INTEGER NOT NULL,
     pumpkins INTEGER NOT NULL DEFAULT 0,
     token TEXT NOT NULL,
     voter_id TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS race_times_fast ON race_times(time_ms)`,
];

const DEFAULTS = { title: 'Chili Cook-Off', open: '1', game: '1', cooks: '0' }; // cooks: show cook names on the ballot
const VOTER_COOKIE = 'voter';
const MAX_TEXT = 80;

let schemaReady;
function ensureSchema(db) {
  schemaReady ??= migrate(db).catch((e) => {
    schemaReady = undefined;
    throw e;
  });
  return schemaReady;
}

async function migrate(db) {
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // Older versions kept one row per phone in `votes`. Move those into `ballots` once,
  // in a single transaction, then drop the old table.
  const old = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'votes'").first();
  if (old) {
    await db.batch([
      db.prepare('INSERT INTO ballots (voter_id, entry_id, created_at) SELECT voter_id, entry_id, updated_at FROM votes'),
      db.prepare('DROP TABLE votes'),
    ]);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      await ensureSchema(env.DB);
      return await route(req, env, url);
    } catch (e) {
      console.error(e);
      return fail('Something went wrong on the grill. Try again.', 500);
    }
  },
};

async function route(req, env, url) {
  const p = url.pathname;
  const m = req.method;
  const db = env.DB;

  if (p === '/api/ballot' && m === 'GET') return getBallot(req, db);
  if (p === '/api/vote' && m === 'POST') return castVote(req, db, url);
  if (p === '/api/race' && m === 'POST') return saveRace(req, db);
  const nm = p.match(/^\/api\/race\/(\d+)\/name$/);
  if (nm && m === 'POST') return nameRace(req, db, Number(nm[1]));

  if (p.startsWith('/api/admin/')) {
    if (!env.ADMIN_KEY) return fail('ADMIN_KEY is not configured on the server.', 500);
    if (!(await keyMatches(req.headers.get('x-admin-key'), env.ADMIN_KEY))) {
      return fail('That admin key is not right.', 401);
    }
    if (p === '/api/admin/state' && m === 'GET') return adminState(db, url.searchParams.get('board') === '1');
    if (p === '/api/admin/settings' && m === 'POST') return updateSettings(req, db);
    if (p === '/api/admin/entries' && m === 'POST') return addEntry(req, db);
    const em = p.match(/^\/api\/admin\/entries\/(\d+)$/);
    if (em && m === 'PUT') return updateEntry(req, db, Number(em[1]));
    if (em && m === 'DELETE') return deleteEntry(db, Number(em[1]));
    if (p === '/api/admin/winner' && m === 'GET') return winner(db);
    if (p === '/api/admin/race-times' && m === 'GET') return raceTimes(db);
    if (p === '/api/admin/reset-race-times' && m === 'POST') {
      await db.prepare('DELETE FROM race_times').run();
      return json({ ok: true });
    }
    if (p === '/api/admin/reset-votes' && m === 'POST') {
      await db.prepare('DELETE FROM ballots').run();
      return json({ ok: true });
    }
  }
  return fail('Not found', 404);
}

// ---------- public ----------

async function getBallot(req, db) {
  const [settings, entries] = await Promise.all([
    getSettings(db),
    db.prepare('SELECT id, number, name, cook FROM entries ORDER BY number, id').all(),
  ]);
  // Cook names stay off guests' phones unless the admin turns them on.
  const list = entries.results.map(({ cook, ...e }) => (settings.cooks && cook ? { ...e, cook } : e));
  return json({ ...settings, entries: list });
}

async function castVote(req, db, url) {
  const body = await readJson(req);
  const entryId = Number(body?.entryId);
  if (!Number.isInteger(entryId)) return fail('Pick a chili first!');

  const settings = await getSettings(db);
  if (!settings.open) return fail('Voting is closed. Hang tight for the big reveal!', 403);

  const exists = await db.prepare('SELECT id FROM entries WHERE id = ?').bind(entryId).first();
  if (!exists) return fail("That chili isn't on the menu anymore. Pick another!", 404);

  let voter = getCookie(req, VOTER_COOKIE);
  const headers = {};
  if (!voter || !/^[0-9a-f-]{36}$/.test(voter)) {
    voter = crypto.randomUUID();
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    headers['set-cookie'] =
      `${VOTER_COOKIE}=${voter}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax${secure}`;
  }

  await db
    .prepare('INSERT INTO ballots (voter_id, entry_id, created_at) VALUES (?, ?, ?)')
    .bind(voter, entryId, Date.now())
    .run();

  return json({ ok: true, entryId }, 200, headers);
}

// ---------- Turkey Racer times ----------

const RACERS = ['turkey', 'pig', 'sheep'];
const RIDES = ['buggy', 'pickup', 'tractor'];

async function saveRace(req, db) {
  const b = (await readJson(req)) ?? {};
  const timeMs = Math.round(Number(b.time) * 1000);
  const place = Number(b.place);
  const pumpkins = Math.max(0, Math.min(500, Math.round(Number(b.pumpkins) || 0)));
  // Sanity checks: a real 2-lap race takes a while, and only known racers/rides count.
  if (!Number.isFinite(timeMs) || timeMs < 25_000 || timeMs > 900_000) return fail('That lap time looks off.');
  if (!Number.isInteger(place) || place < 1 || place > 4) return fail('Bad place.');
  if (!RACERS.includes(b.char) || !RIDES.includes(b.car)) return fail('Unknown racer or ride.');
  const token = crypto.randomUUID();
  const row = await db
    .prepare(
      `INSERT INTO race_times (char, car, time_ms, place, pumpkins, token, voter_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(b.char, b.car, timeMs, place, pumpkins, token, getCookie(req, VOTER_COOKIE) || '', Date.now())
    .first();
  return json({ id: row.id, token }, 201);
}

async function nameRace(req, db, id) {
  const b = (await readJson(req)) ?? {};
  const name = clean(b.name).slice(0, 24);
  if (!name) return fail('Type a name first!');
  const res = await db
    .prepare('UPDATE race_times SET name = ? WHERE id = ? AND token = ?')
    .bind(name, id, String(b.token || ''))
    .run();
  if (!res.meta.changes) return fail("Couldn't find that race.", 404);
  return json({ ok: true, name });
}

async function raceTimes(db) {
  const [top, count] = await Promise.all([
    db
      .prepare('SELECT id, name, char, car, time_ms, place, pumpkins, created_at FROM race_times ORDER BY time_ms ASC, id ASC LIMIT 25')
      .all(),
    db.prepare('SELECT COUNT(*) AS n FROM race_times').first('n'),
  ]);
  return json({ times: top.results, totalRaces: count ?? 0 });
}

// ---------- admin ----------

// Per-chili counts are only included for the admin leaderboard, so the spin wheel
// page never even receives 2nd/3rd-place information.
async function adminState(db, withVotes = false) {
  const [settings, entries, count] = await Promise.all([
    getSettings(db),
    db
      .prepare(
        withVotes
          ? `SELECT e.id, e.number, e.name, e.cook, COUNT(b.id) AS votes
               FROM entries e LEFT JOIN ballots b ON b.entry_id = e.id
              GROUP BY e.id ORDER BY e.number, e.id`
          : 'SELECT id, number, name, cook FROM entries ORDER BY number, id',
      )
      .all(),
    db.prepare('SELECT COUNT(*) AS n FROM ballots').first('n'),
  ]);
  return json({ ...settings, entries: entries.results, totalVotes: count ?? 0 });
}

async function updateSettings(req, db) {
  const body = (await readJson(req)) ?? {};
  const writes = [];
  if (typeof body.title === 'string') {
    const title = clean(body.title) || DEFAULTS.title;
    writes.push(setSetting(db, 'title', title));
  }
  if (typeof body.open === 'boolean') writes.push(setSetting(db, 'open', body.open ? '1' : '0'));
  if (typeof body.game === 'boolean') writes.push(setSetting(db, 'game', body.game ? '1' : '0'));
  if (typeof body.cooks === 'boolean') writes.push(setSetting(db, 'cooks', body.cooks ? '1' : '0'));
  if (writes.length) await db.batch(writes);
  return json(await getSettings(db));
}

async function addEntry(req, db) {
  const body = (await readJson(req)) ?? {};
  const name = clean(body.name);
  if (!name) return fail('Give the chili a name.');
  let number = Number(body.number);
  if (!Number.isInteger(number) || number < 1) {
    const max = await db.prepare('SELECT MAX(number) AS n FROM entries').first('n');
    number = (max ?? 0) + 1;
  }
  const row = await db
    .prepare('INSERT INTO entries (number, name, cook, created_at) VALUES (?, ?, ?, ?) RETURNING id, number, name, cook')
    .bind(number, name, clean(body.cook), Date.now())
    .first();
  return json(row, 201);
}

async function updateEntry(req, db, id) {
  const body = (await readJson(req)) ?? {};
  const name = clean(body.name);
  const number = Number(body.number);
  if (!name) return fail('Give the chili a name.');
  if (!Number.isInteger(number) || number < 1) return fail('Number must be 1 or higher.');
  const row = await db
    .prepare('UPDATE entries SET number = ?, name = ?, cook = ? WHERE id = ? RETURNING id, number, name, cook')
    .bind(number, name, clean(body.cook), id)
    .first();
  return row ? json(row) : fail('Entry not found', 404);
}

async function deleteEntry(db, id) {
  await db.batch([
    db.prepare('DELETE FROM ballots WHERE entry_id = ?').bind(id),
    db.prepare('DELETE FROM entries WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

// Returns the top spot only (ties included); the spin wheel uses this to know where to land.
async function winner(db) {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.number, e.name, e.cook, COUNT(*) AS votes
         FROM ballots b JOIN entries e ON e.id = b.entry_id
        GROUP BY e.id ORDER BY votes DESC`,
    )
    .all();
  const totalVotes = results.reduce((s, r) => s + r.votes, 0);
  const top = results[0]?.votes ?? 0;
  const winners = top > 0 ? results.filter((r) => r.votes === top) : [];
  return json({ winners, totalVotes });
}

// ---------- helpers ----------

async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULTS };
  for (const r of results) s[r.key] = r.value;
  return { title: s.title, open: s.open === '1', game: s.game === '1', cooks: s.cooks === '1' };
}

function setSetting(db, key, value) {
  return db
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value);
}

async function keyMatches(given, actual) {
  if (!given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all(
    [given, actual].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))),
  );
  return crypto.subtle.timingSafeEqual(a, b);
}

function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function clean(v) {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT) : '';
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function fail(message, status = 400) {
  return json({ error: message }, status);
}
