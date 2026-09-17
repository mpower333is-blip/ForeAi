# Clubhouse on Firebase Hosting

The clubhouse website (`clubhouse/` — hub, get, register, board, and the
`manage/` admin tools) is plain static HTML/JS. Firebase Hosting serves it on a
global CDN and — with the included GitHub Action — **redeploys itself on every
push**, so you stop re-uploading files to cPanel `public_html` by hand.

Nothing about the app or the data changes: the site now runs on **Firestore**
(events, club data and organiser login all use Firebase — see
`docs/render-firebase-cutover.md`), and `clubhouse/config.js` has
`useFirestore: true`. Firebase Hosting only replaces *where the static pages
live* — swapping the manual cPanel upload for an automatic deploy.

The config already committed:

- `firebase.json` — serves `clubhouse/` as-is, keeps the current file URLs
  (`/get.html`, `/manage/office.html`, …), and tells browsers not to hard-cache
  `config.js` or any HTML, so edits show up immediately (no cPanel/LiteSpeed
  cache to purge).
- `.firebaserc` — the project id (`foreai-f9cfa`) for local `firebase deploy`.
- `.github/workflows/firebase-hosting.yml` — auto-deploy on push to `main`. The
  project id is pinned in the workflow, so only one secret is needed.

---

## 1. Firebase project

The project is **`foreai-f9cfa`** — the same one used for Firestore and push.
Nothing to pick or create.

## 2. Turn on auto-deploy (one secret — no manual uploads ever again)

In GitHub → **Settings → Secrets and variables → Actions → Secrets tab →
New repository secret**:

- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: a service-account JSON key —
  Firebase console (project `foreai-f9cfa`) → ⚙ **Project settings →
  Service accounts → Generate new private key** → paste the **entire** downloaded
  JSON file contents as the secret value. (That service account already carries
  the Firebase Hosting Admin role.)

That's it — no variable to add, the project id is pinned in the workflow. The
next push that touches `clubhouse/` deploys automatically; you can also trigger
it from the **Actions** tab → *Deploy clubhouse to Firebase Hosting* →
**Run workflow**. The site goes live at `https://foreai-f9cfa.web.app`.

Until the secret is set, the workflow **passes with the deploy skipped** (it logs
a notice) instead of failing — so no more failure emails.

## 3. Deploy by hand (fallback / first push)

On a laptop with Node:

```bash
npm install -g firebase-tools
firebase login
firebase use foreai-f9cfa         # already the default in .firebaserc
firebase deploy --only hosting    # run from the repo root
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
from the admin pages is gated by the Firestore security rules** — an organiser
must sign in, and the owner console is limited to hard-coded owner emails, so the
`manage/` pages load but can't show or change anything without a valid session.

If you want the pages themselves hidden too, options are:

- **Keep only `manage/` on cPanel** (password-protected) and let Firebase serve
  the public pages — set `firebase.json` `"public"` to a build that excludes
  `manage/`, or add an `ignore` for `manage/**`.
- Put the site behind **Firebase Authentication** / a Cloud Function gate
  (heavier; ask and I can wire it).

For most clubs the admin PIN is enough — just make sure you set one (Members page
→ 🔑 PIN) before sharing the site.
