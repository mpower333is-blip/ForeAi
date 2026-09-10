# Clubhouse on Firebase Hosting

The clubhouse website (`clubhouse/` — hub, get, register, board, and the
`manage/` admin tools) is plain static HTML/JS. Firebase Hosting serves it on a
global CDN and — with the included GitHub Action — **redeploys itself on every
push**, so you stop re-uploading files to cPanel `public_html` by hand.

Nothing about the app or the API changes: `clubhouse/config.js` still points the
pages at the Render backend (`https://foreai-backend.onrender.com`, or your
`api.foreai.co.za`). Firebase only replaces where the *static pages* live.

The config already committed:

- `firebase.json` — serves `clubhouse/` as-is, keeps the current file URLs
  (`/get.html`, `/manage/members.html`, …), and tells browsers not to hard-cache
  `config.js` or the HTML so edits show up immediately.
- `.firebaserc` — the project id for local `firebase deploy` (replace the
  placeholder, or run `firebase use <project-id>`).
- `.github/workflows/firebase-hosting.yml` — auto-deploy on push to `main`.

---

## 1. Pick a Firebase project

Reuse the **existing FCM project** (the one already set up for push, per
`docs/push-setup.md`) — one project happily does both push and hosting — or
create a new one at <https://console.firebase.google.com>. Note its
**Project ID** (Project settings → General, e.g. `foreai-12345`).

## 2. Turn on auto-deploy (recommended — no manual uploads ever again)

In GitHub → **Settings → Secrets and variables → Actions**:

1. **Variables** tab → **New repository variable**
   - Name `FIREBASE_PROJECT_ID`, value = your project id.
2. **Secrets** tab → **New repository secret**
   - Name `FIREBASE_SERVICE_ACCOUNT`, value = a service-account JSON key:
     Firebase console → ⚙ **Project settings → Service accounts →
     Generate new private key** → paste the whole downloaded JSON as the secret.
     (That service account already has the Hosting Admin role.)

That's it. The next push that touches `clubhouse/` deploys automatically; you can
also trigger it from the **Actions** tab → *Deploy clubhouse to Firebase
Hosting* → **Run workflow**. Your site goes live at
`https://<project-id>.web.app`.

## 3. Deploy by hand (fallback / first push)

On a laptop with Node:

```bash
npm install -g firebase-tools
firebase login
firebase use <project-id>        # or edit .firebaserc
firebase deploy --only hosting   # run from the repo root
```

## 4. Point foreai.co.za at Firebase (optional)

To serve the site on your own domain instead of `*.web.app`:

Firebase console → **Hosting → Add custom domain** → enter `foreai.co.za` (and/or
`www`), then add the **A records** Firebase gives you at your DNS host (cPanel →
Zone Editor, or your registrar). Firebase provisions the SSL certificate
automatically (can take up to ~24h).

Cut-over note: moving the domain's web records to Firebase replaces cPanel as the
site host. Your email and any other cPanel services are unaffected (those are
separate DNS records). If you'd rather test first, leave the domain on cPanel and
use the `*.web.app` URL until you're happy.

## 5. Keep the `manage/` admin pages private

Firebase Hosting has **no built-in password protection** for a folder, unlike
cPanel's Directory Privacy. That's acceptable here because **every read and write
from the admin pages is gated by the club admin PIN on the backend** — with no
PIN, the Members and Tee Sheet pages load but can't show or change anything.

If you want the pages themselves hidden too, options are:

- **Keep only `manage/` on cPanel** (password-protected) and let Firebase serve
  the public pages — set `firebase.json` `"public"` to a build that excludes
  `manage/`, or add an `ignore` for `manage/**`.
- Put the site behind **Firebase Authentication** / a Cloud Function gate
  (heavier; ask and I can wire it).

For most clubs the admin PIN is enough — just make sure you set one (Members page
→ 🔑 PIN) before sharing the site.
