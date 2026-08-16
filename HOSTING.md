# Hosting ForeAi on foreai.co.za (cPanel)

Two pieces: the **web pages** (static — live on your cPanel hosting) and the
**API** (Node + PostgreSQL — needed only for the multi-device golf-day sync:
shared events, the live clubhouse board, and the online registration/office).

## 1. Web pages → cPanel `public_html`

The files in [`clubhouse/`](./clubhouse) are the whole website.

1. cPanel → **File Manager** → open **`public_html`**.
2. **Upload** the zip of the `clubhouse/` files (index, get, register, office,
   board, config.js, ecs-logo.png).
3. Select the zip → **Extract** into `public_html`, then delete the zip and any
   default placeholder page.
4. Live pages:
   - `https://foreai.co.za/` — the **Hub** (organiser control centre)
   - `https://foreai.co.za/get.html` — public **download + join** page (this is `LANDING_URL`)
   - `register.html` · `office.html` · `board.html` — the other tools

To update later, re-upload the changed file(s) and overwrite.

## 2. API → free Node host (recommended for shared cPanel)

Most shared cPanel packages can't run a Node app, so host the API on Render:

- Follow [`backend/DEPLOY.md`](./backend/DEPLOY.md): Render → New → Blueprint →
  connect this repo → Apply. You get `https://foreai-backend.onrender.com`.
- Optional on-brand URL: cPanel → **Zone Editor** → add a **CNAME** `api` →
  the Render host, then set `api.foreai.co.za` as a custom domain in Render.

**Self-hosting on cPanel instead** is only possible if the cPanel home page has
**both** "Setup Node.js App" and "PostgreSQL Databases". If so: create a Postgres
DB + user, create a Node.js app pointing at `backend/` with startup file
`dist/server.js`, run `npm install && npm run build && npm run db:push` in its
virtualenv, set the `DATABASE_URL` env var, and start it.

## 3. Wire the pages to the API (one file)

Edit `public_html/config.js`:

```js
window.FOREAI_DEFAULTS = { api: "https://api.foreai.co.za", code: "" };
```

Every page reads this as its default backend (URL params and saved-on-device
settings still override it). Nobody has to type the URL again.

## 4. The phone app

The APK reads `EXPO_PUBLIC_API_URL` at build time. Add it as a GitHub repo
secret (Settings → Secrets → Actions) set to the API URL, and the next build
ships pointing at it. Until then the app still works fully offline for the
caddie, swing coach and solo round tracking.
