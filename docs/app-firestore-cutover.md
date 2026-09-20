# App → Firestore cutover (club data)

The web portal (foreai.co.za) runs the club on **Firestore**. This wires the
**mobile app** to the *same* Firestore for club data — members, tee times,
competitions, news and **payments** — so the app and the portal share one store
(no Render backend for club data). The member-facing "My account" then shows the
invoices the office raises in the portal.

## What's in place (code, committed)

- `mobile/src/services/clubFs.js` — the app's Firestore data layer, **ported
  verbatim from `clubhouse/club-fs.js`** (same collections + logic:
  `clubs/{clubKey}/members|bookings|competitions|notices|fees|invoices`). Uses the
  firebase **compat** SDK with long-polling for React Native. Keep in sync with
  `club-fs.js`.
- `mobile/src/services/clubBackend.ts` — `clubRequest()`: routes club calls to
  Firestore when `USE_FIRESTORE`, else to the Render backend over HTTP.
- The club clients (`membershipApi`, `competitionsApi`, `newsApi`, `paymentsApi`)
  now go through `clubRequest` — no other change to the screens.
- `mobile/src/config/firebase.ts` — the public Firebase config (project
  `foreai-f9cfa`), mirrors `clubhouse/firebase-config.js`.
- `mobile/src/config/appVariant.ts` — `USE_FIRESTORE` flag, **OFF by default**.

The app still uses the Render backend until the flag is turned on, so nothing
breaks in the meantime.

## Before turning it on — two things MUST be done first

**1. Firestore security rules.** The member app signs in **anonymously** and then
reads/writes club data. The project's current rules gate the *organiser portal*
(authenticated owners / club accounts). Turning on the app without rules that also
permit the member operations will fail every call with `permission-denied`.

> ⚠️ Do not blind-deploy a new `firestore.rules` — it **replaces** the live rules
> and could break the portal or expose data. Share the **current** rules (Firebase
> Console → Firestore → Rules) so they can be extended safely.

**2. Member lookup must not expose the roster.** `club-fs.js`'s member
lookup/claim reads the whole `members` collection and filters client-side. That's
fine for an authenticated organiser, but an **anonymous member app must not be
able to list every member's PII**. The correct fix is a small **Cloud Function**
(callable) that does lookup/claim server-side and returns only card-safe fields —
the app calls that instead of listing `members`. (Bookings / competition entries
may also want a Function to enforce capacity and prevent abuse.)

## Turning it on (after the two items above)

1. Add `EXPO_PUBLIC_USE_FIRESTORE: "1"` to the Kempton phone workflows in
   `codemagic.yaml` (`foreai-kempton-android`, `foreai-kempton-android-play`,
   `foreai-kempton-ios`).
2. Rebuild and test on a device: link membership, book a tee time, enter a
   competition and post a score, read news, and open **My account** — the
   invoices raised in the portal must appear.
3. Only then retire the Render club backend (`foreai-kempton-backend`).

## Not in scope here

The ForeAi core (GPS, rounds, strokes-gained) is on-device / the shared ForeAi
backend, and the golf-day **tournaments** feature is its own system — neither is
club data, so both are unchanged by this cutover.
