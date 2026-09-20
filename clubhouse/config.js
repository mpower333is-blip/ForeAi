// Shared defaults for the ForeAi clubhouse web pages.
//
// Set these ONCE (after you deploy the backend) and every page — hub, register,
// office, board, get — picks them up as its default. Then nobody has to type the
// backend URL or event code; a plain link to any page just works.
//
// Precedence on each page:  ?api=/?code= in the URL  >  saved (this device)  >  these defaults.
window.FOREAI_DEFAULTS = {
  api: "", // Render retired — the site runs on Firestore; kept blank for compatibility.
  code: "", // Intentionally blank — don't expose the event code in a public file.
            // Share the registration link with ?code=... instead, and the office
            // page asks the organiser to type the code (kept off the site).

  // Venue location for the live weather / lightning alert on the board.
  // Default: Kempton Park Golf Club (the ECS golf day). Override per-page with
  // ?wxlat=..&wxlng=.. Set to null to hide the weather alert entirely.
  wxLat: -26.106,
  wxLng: 28.212,

  // Weather + lightning now runs on a Firebase Cloud Function (migrated off
  // Render). Pages use this instead of api + "/weather". Override with ?wx=...
  weatherUrl: "https://europe-west1-foreai-f9cfa.cloudfunctions.net/weather",

  // Render → Firebase cutover switch. TRUE = the whole site runs on Firestore —
  // events, club data AND organiser login all use Firebase, and nothing touches
  // Render (so Render can be deleted). Set false to fall back to the Render
  // backend. Per-page override: ?fs=1 / ?fs=0.
  //
  // GO-LIVE = uploading this file with useFirestore:true. Only do it once every
  // phone is on a Firestore app build (EXPO_PUBLIC_USE_FIRESTORE=1) and the
  // Firestore rules are published — ideally between events, since a phone still
  // on an old (Render) build would then write to a different store. See
  // docs/render-firebase-cutover.md.
  useFirestore: true,
};
