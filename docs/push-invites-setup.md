# Real push for open-game invites

When a member is invited to an open game, a Cloud Function pushes a notification
to their phone — even when the app is closed. Until the one-time setup below is
done, invites still arrive **in-app** (the "Invitations for you" inbox on the
Open Games screen); only the phone push is inactive.

## How it works

1. The member app registers this device's **Expo push token** against the member
   at `clubs/{clubKey}/pushTokens/{memberId}` (see `mobile/src/lib/clubPush.ts`,
   called from `MemberContext` once membership is linked).
2. Creating an invite writes `clubs/{clubKey}/invites/{inviteId}`.
3. The Cloud Function **`onGameInviteCreated`** (`functions/index.js`) triggers on
   that write, looks up the recipient's tokens, and sends via **Expo Push**
   (which relays to APNs/FCM). Invalid tokens are pruned.

No Apple/Google keys live in the function — Expo holds them for the project.

## One-time setup

### 1. Expo project + push credentials
The app needs an EAS project id and push credentials (same requirement as the
lightning alerts — see `docs/push-setup.md`):
- Create/lin an Expo project and set **`EAS_PROJECT_ID`** in the Kempton build
  workflows (`codemagic.yaml`), or `app.config.js` → `extra.eas.projectId`.
- **Android:** upload the FCM key to Expo (`eas credentials`) / provide
  `google-services.json`.
- **iOS:** upload an APNs key to Expo and ship a build **with** the push
  entitlement (the Kempton build currently strips it via
  `plugins/withoutPushEntitlement` — keep it in for the push build).

Without `EAS_PROJECT_ID`, `clubPush` no-ops and no token is stored (the in-app
inbox still works).

### 2. Deploy the Cloud Function
Cloud Functions need the **Blaze (pay-as-you-go)** plan on `foreai-f9cfa`
(there's a generous free tier; invite volume is tiny).

```
cd /path/to/foreai
firebase deploy --only functions
```

(`firebase.json` already points `functions.source` at `functions/`.) The first
deploy also enables the required Google APIs.

### 3. Publish the rules
`firestore.rules` adds `clubs/{clubKey}/pushTokens` (members write their own
token; only the Admin SDK reads them). Publish the rules if you haven't:

```
firebase deploy --only firestore:rules
```

## Test
1. Build the Kempton app with `EAS_PROJECT_ID` set; link membership on two
   devices (two members).
2. On device A, post an open game → **Invite players** → invite member B.
3. Device B should get a phone notification ("… invited you to a game"). Tapping
   opens the app; the invite is in the Open Games inbox to Accept/Decline.

## Not included (easy follow-ups)
- **Tap-to-deep-link** straight to the Open Games screen (currently tapping just
  opens the app).
- Pushing on **join/accept** ("X joined your game") — same pattern, another
  trigger.
