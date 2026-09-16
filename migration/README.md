# Postgres → Firestore migration

One-off copy of the Render Postgres data into the Firestore model
(`docs/firestore-data-model.md`), for retiring Render. Non-destructive and
re-runnable (each document is keyed by its source row id).

## Run

```bash
cd migration
npm install

# Firebase credentials (a service account with Firestore write access):
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
#   …or:  export FIREBASE_SERVICE_ACCOUNT='{ ...service account json... }'

# Run ONCE PER DATABASE, into the same Firestore project:
export DATABASE_URL='postgres://…@…render.com/…'   # ForeAi backend DB (events)
node migrate-to-firestore.mjs --dry                # preview counts, writes nothing
node migrate-to-firestore.mjs                      # do it

export DATABASE_URL='postgres://…@…render.com/…'   # Kempton backend DB (club data)
node migrate-to-firestore.mjs
```

Get each `DATABASE_URL` from Render → the database → **External Database URL**.

## What it does / doesn't

- Migrates: users + rounds/shots/clubs, events + all subcollections + eventCodes,
  clubs/{clubKey} + members/bookings/competitions/entries/notices, pushDevices.
- **Skips AdminUser** — organiser accounts are re-created under their Firebase
  Auth uid on next sign-in (the `provisionOrganiser` function). Migrated events
  therefore get `ownerUid = null` (any organiser may manage them — the legacy
  path in `firestore.rules`).
- All timestamps become epoch millis (numbers), matching the realtime read-model.

## When to run

At the **cutover** (migration plan step 5), after the apps + web are pointed at
Firestore and `firestore.rules` is deployed. Running
earlier is harmless (it just seeds Firestore), but the backend mirror also keeps
events in sync until then.
