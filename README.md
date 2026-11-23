# 🌶️ Chili Cook-Off Voting

A tiny people's-choice voting app for a chili & soup party. Guests scan a QR code, tap their favorite, and vote from their phone. The host sees a live leaderboard, then reveals the winner with a spin-the-wheel animation.

Runs on **Cloudflare Workers** (static pages + a small API) with **D1** (SQLite) for storage. No framework and no build step. The free tier is plenty.

## Pages

| URL | Who | What |
| --- | --- | --- |
| `/` | Guests | The ballot. Honor system: after voting, **Submit another vote** lets a shared phone vote again (each ballot counts). |
| `/admin` | Host | Live vote leaderboard, Turkey Racer times (every finished race is saved; players can add a name), add/rename/number chilis, open/close voting, print QR signs (two per sheet), reset votes. |
| `/race` | Guests (optional) | **Turkey Racer**: a 2-lap low-poly farm kart race offered after voting. Pick a turkey, pig or sheep and one of three rides; bonk pumpkins, hit leaf boost pads. On by default; switch it off with **After-vote game** in `/admin`. Admins can still preview it while it's off. |
| `/wheel` | Host, on a TV | A prize wheel with every chili. **Spin** closes voting and the wheel always lands on the winner (on a tie, it lands on one of the tied chilis and announces the tie). |

`/admin` and `/wheel` need the admin key. It's remembered in that browser after the first time.

Wheel keys: `Space` or `Enter` spins, `F` toggles fullscreen, `Esc` closes the winner card.

## Run locally

```bash
npm install
npm run dev
```

Before the first run, copy `.dev.vars.example` to `.dev.vars` and pick a local admin key (`.dev.vars` is git-ignored). Then open http://localhost:8787. Local data lives in `.wrangler/`.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create chili-cookoff
```

Copy the `database_id` it prints into `wrangler.jsonc`, then:

```bash
npx wrangler secret put ADMIN_KEY
npm run deploy
```

You'll get a URL like `https://chili-cookoff.<you>.workers.dev`. Tables are created automatically on the first request.

## Party-day checklist

1. Go to `/admin`, add each chili with its pot number (tape the number to the pot). The cook's name stays hidden from voters until the reveal.
2. Do a test vote, then **Reset all votes** in the Danger zone.
3. Print the QR signs from `/admin` (landscape sheet, two portrait signs; cut down the middle).
4. When it's time, open `/wheel` on a TV and hit **Spin** (or just read the leaderboard out loud).

## Notes

- Voting is on the honor system: anyone can submit several ballots. Each ballot is stored with an anonymous device cookie, so you can spot one phone stuffing the box if you need to.
- Vote counts are only returned to admin requests (leaderboard and wheel). Guests' phones never see results.
