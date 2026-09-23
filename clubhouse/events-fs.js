// events-fs.js — the Firestore events layer for the clubhouse web pages.
//
// This is the WEB half of the Render→Firebase cutover (docs/render-firebase-
// cutover.md). It mirrors the app's native-subcollection model (see the mobile
// app's services/tournamentFirestore.ts) so the app and the website read/write
// exactly the same Firestore store — the coordinated flip.
//
// SAFETY / FLAG: it does nothing unless the Firestore path is switched on, with
// either  window.FOREAI_DEFAULTS.useFirestore === true  or  ?fs=1  in the URL.
// While off, window.fetch is left untouched and every page keeps talking to the
// Render backend exactly as before — so the LIVE ECS / Kempton / Kruinsig pages
// are unaffected until we flip on purpose. Include this script AFTER
// firebase-config.js and the firebase compat SDKs, and BEFORE the page's own
// logic, on any page that talks to /tournaments.
//
// Model (identical to the app):
//   events/{id}                                    meta (serialize() shape)
//   events/{id}/players/{playerId}                 {name,handicap,deviceId,groupId}
//   events/{id}/positions/{playerId}               {lat,lng,lastSeen}
//   events/{id}/groups/{groupId}                   {order}
//   events/{id}/scores/{playerId_hole}             {playerId,hole,strokes}
//   events/{id}/contests/{contestId}               {type,hole}
//   events/{id}/contests/{contestId}/results/{pid} {value}
//   events/{id}/sponsors/{sponsorId}               {name,tier,hole,message,logo}
//   events/{id}/registrations/{regId}              office submissions (RSVP)
//   eventCodes/{CODE} -> {eventId}                 join-code lookup
(function () {
  "use strict";

  // ---- flag -----------------------------------------------------------------
  function flagOn() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("fs") === "1") return true;
      if (q.get("fs") === "0") return false;
    } catch (e) {}
    return !!(window.FOREAI_DEFAULTS && window.FOREAI_DEFAULTS.useFirestore);
  }
  if (!flagOn()) {
    window.EventsFS = { enabled: false };
    return;
  }

  // ---- firebase (compat) ----------------------------------------------------
  if (!window.firebase || !window.FIREBASE_CONFIG) {
    console.error("[events-fs] firebase compat SDK or FIREBASE_CONFIG missing — Firestore path disabled.");
    window.EventsFS = { enabled: false };
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  var db = firebase.firestore();
  var auth = firebase.auth ? firebase.auth() : null;

  // Anonymous sign-in so writes satisfy the security rules (the organiser can
  // additionally sign in with email to OWN their events; that session is used
  // if present). Fire-and-forget — reads are public.
  function ensureSignedIn() {
    if (!auth) return Promise.resolve(null);
    if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
    return auth
      .signInAnonymously()
      .then(function (c) { return c.user.uid; })
      .catch(function () { return null; });
  }

  var ev = function (id) { return db.collection("events").doc(id); };
  var sub = function (id, name) { return ev(id).collection(name); };

  var CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function makeCode(len) {
    len = len || 6;
    var out = "";
    for (var i = 0; i < len; i++) out += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)];
    return out;
  }
  function num(v) { return v === "" || v == null ? null : Number(v); }

  // ---- assemble (matches backend serialize()) -------------------------------
  function assembleEvent(id) {
    var evSnap;
    return ev(id).get().then(function (s) {
      if (!s.exists) return null;
      evSnap = s.data() || {};
      return Promise.all([
        sub(id, "players").get(),
        sub(id, "positions").get(),
        sub(id, "groups").get(),
        sub(id, "scores").get(),
        sub(id, "contests").get(),
        sub(id, "sponsors").get(),
      ]);
    }).then(function (snaps) {
      if (!snaps) return null;
      var playersSnap = snaps[0], posSnap = snaps[1], groupsSnap = snaps[2],
          scoresSnap = snaps[3], contestsSnap = snaps[4], sponsorsSnap = snaps[5];

      var pos = {};
      posSnap.forEach(function (d) { pos[d.id] = d.data(); });

      var players = playersSnap.docs.map(function (d) {
        var p = d.data(), pp = pos[d.id] || {};
        return {
          id: d.id, name: p.name, handicap: p.handicap == null ? 0 : p.handicap,
          deviceId: p.deviceId == null ? null : p.deviceId, groupId: p.groupId == null ? null : p.groupId,
          lastSeen: pp.lastSeen == null ? null : pp.lastSeen, lat: pp.lat == null ? null : pp.lat, lng: pp.lng == null ? null : pp.lng,
        };
      });

      var groups = groupsSnap.docs
        .map(function (d) { var gd = d.data() || {}; return { id: d.id, order: gd.order || 0, startHole: gd.startHole, teeMin: gd.teeMin }; })
        .sort(function (a, b) { return a.order - b.order; })
        .map(function (g) {
          var gg = { id: g.id, playerIds: players.filter(function (p) { return p.groupId === g.id; }).map(function (p) { return p.id; }) };
          if (g.startHole != null) gg.startHole = g.startHole;
          if (g.teeMin != null) gg.teeMin = g.teeMin;
          return gg;
        });

      var scores = {};
      scoresSnap.forEach(function (d) {
        var x = d.data();
        (scores[x.playerId] || (scores[x.playerId] = {}))[x.hole] = x.strokes;
      });

      var sponsors = sponsorsSnap.docs.map(function (d) {
        var x = d.data();
        return { id: d.id, name: x.name, tier: x.tier, hole: x.hole == null ? null : x.hole, message: x.message == null ? null : x.message, logo: x.logo == null ? null : x.logo };
      });

      var contests = [], contestResults = {};
      return Promise.all(contestsSnap.docs.map(function (cd) {
        var c = cd.data();
        contests.push({ id: cd.id, type: c.type, hole: c.hole });
        return sub(id, "contests").doc(cd.id).collection("results").get().then(function (rs) {
          var map = {};
          rs.forEach(function (r) { map[r.id] = (r.data() || {}).value; });
          contestResults[cd.id] = map;
        });
      })).then(function () {
        return {
          id: id, code: evSnap.code,
          hasAdminPin: !!evSnap.ownerUid, // ownership replaces the PIN
          name: evSnap.name, courseId: evSnap.courseId, format: evSnap.format,
          firstTeeMin: evSnap.firstTeeMin, intervalMin: evSnap.intervalMin, shotgun: !!evSnap.shotgun,
          teeId: evSnap.teeId == null ? null : evSnap.teeId,
          cause: evSnap.cause == null ? null : evSnap.cause, causePhoto: evSnap.causePhoto == null ? null : evSnap.causePhoto,
          logo: evSnap.logo == null ? null : evSnap.logo, banking: evSnap.banking == null ? null : evSnap.banking,
          teamFee: evSnap.teamFee == null ? null : evSnap.teamFee, holeFee: evSnap.holeFee == null ? null : evSnap.holeFee,
          playerFee: evSnap.playerFee == null ? null : evSnap.playerFee,
          reminders: Array.isArray(evSnap.reminders) ? evSnap.reminders : [],
          sponsors: sponsors, players: players, groups: groups, scores: scores,
          contests: contests, contestResults: contestResults,
        };
      });
    });
  }

  function idForCode(code) {
    var key = String(code).trim().toUpperCase();
    return db.collection("eventCodes").doc(key).get().then(function (s) {
      return s.exists ? (s.data() || {}).eventId : null;
    });
  }

  // ---- mutations ------------------------------------------------------------
  function createEvent(b) {
    return ensureSignedIn().then(function (uid) {
      var ref = db.collection("events").doc();
      var id = ref.id;
      var code = makeCode();
      var now = Date.now();
      return ref.set({
        id: id, name: b.name, date: new Date().toISOString(), courseId: b.courseId, format: b.format || "stroke",
        firstTeeMin: b.firstTeeMin == null ? 480 : b.firstTeeMin, intervalMin: b.intervalMin == null ? 10 : b.intervalMin,
        shotgun: !!b.shotgun, code: code, ownerUid: uid || null,
        creatorEmail: (auth && auth.currentUser && auth.currentUser.email) || null,
        playerFee: num(b.playerFee),
        createdAt: now, updatedAt: now,
      }).then(function () {
        return db.collection("eventCodes").doc(code).set({ eventId: id });
      }).then(function () { return assembleEvent(id); });
    });
  }

  function addPlayer(id, p) {
    return ensureSignedIn().then(function () {
      return sub(id, "players").add({
        name: p.name, handicap: p.handicap == null ? 0 : p.handicap,
        deviceId: p.deviceId == null ? null : p.deviceId, groupId: p.groupId == null ? null : p.groupId, createdAt: Date.now(),
      });
    }).then(function () { return assembleEvent(id); });
  }

  function removePlayer(id, pid) {
    return ensureSignedIn().then(function () {
      return sub(id, "players").doc(pid).delete();
    }).then(function () {
      return sub(id, "positions").doc(pid).delete().catch(function () {});
    }).then(function () {
      return sub(id, "scores").where("playerId", "==", pid).get();
    }).then(function (snap) {
      if (snap.empty) return;
      var batch = db.batch();
      snap.forEach(function (d) { batch.delete(d.ref); });
      return batch.commit();
    }).then(function () { return assembleEvent(id); });
  }

  function assignPlayer(id, pid, groupId) {
    return ensureSignedIn().then(function () {
      return sub(id, "players").doc(pid).update({ groupId: groupId == null ? null : groupId });
    }).then(function () { return assembleEvent(id); });
  }

  function claimPlayer(id, pid, deviceId) {
    return ensureSignedIn().then(function () {
      if (!deviceId) return null;
      return sub(id, "players").where("deviceId", "==", deviceId).get().then(function (snap) {
        var batch = db.batch();
        snap.forEach(function (d) { if (d.id !== pid) batch.update(d.ref, { deviceId: null }); });
        return batch.commit();
      });
    }).then(function () {
      return sub(id, "players").doc(pid).update({ deviceId: deviceId == null ? null : deviceId });
    }).then(function () { return assembleEvent(id); });
  }

  function addGroup(id) {
    return ensureSignedIn().then(function () {
      return sub(id, "groups").get();
    }).then(function (existing) {
      return sub(id, "groups").add({ order: existing.size, createdAt: Date.now() });
    }).then(function () { return assembleEvent(id); });
  }

  function removeGroup(id, gid) {
    return ensureSignedIn().then(function () {
      return sub(id, "groups").doc(gid).delete();
    }).then(function () {
      return sub(id, "players").where("groupId", "==", gid).get();
    }).then(function (snap) {
      var batch = db.batch();
      snap.forEach(function (d) { batch.update(d.ref, { groupId: null }); });
      return batch.commit();
    }).then(function () { return assembleEvent(id); });
  }

  function setScore(id, pid, hole, strokes) {
    return ensureSignedIn().then(function () {
      var ref = sub(id, "scores").doc(pid + "_" + hole);
      if (strokes == null || strokes <= 0) return ref.delete().catch(function () {});
      return ref.set({ playerId: pid, hole: hole, strokes: strokes, updatedAt: Date.now() });
    }).then(function () { return assembleEvent(id); });
  }

  function addSponsor(id, s) {
    return ensureSignedIn().then(function () {
      return sub(id, "sponsors").add({
        name: s.name, tier: s.tier, hole: s.hole == null ? null : s.hole,
        message: s.message == null ? null : s.message, logo: s.logo == null ? null : s.logo, createdAt: Date.now(),
      });
    }).then(function () { return assembleEvent(id); });
  }

  function removeSponsor(id, sid) {
    return ensureSignedIn().then(function () {
      return sub(id, "sponsors").doc(sid).delete();
    }).then(function () { return assembleEvent(id); });
  }

  function updateEvent(id, patch) {
    return ensureSignedIn().then(function () {
      var clean = {};
      Object.keys(patch || {}).forEach(function (k) { clean[k] = patch[k]; });
      clean.updatedAt = Date.now();
      return ev(id).update(clean);
    }).then(function () { return assembleEvent(id); });
  }

  function addContest(id, type, hole) {
    return ensureSignedIn().then(function () {
      return sub(id, "contests").add({ type: type, hole: hole, createdAt: Date.now() });
    }).then(function () { return assembleEvent(id); });
  }

  function removeContest(id, cid) {
    return ensureSignedIn().then(function () {
      return sub(id, "contests").doc(cid).collection("results").get();
    }).then(function (rs) {
      var batch = db.batch();
      rs.forEach(function (r) { batch.delete(r.ref); });
      batch.delete(sub(id, "contests").doc(cid));
      return batch.commit();
    }).then(function () { return assembleEvent(id); });
  }

  function setContestResult(id, cid, pid, value) {
    return ensureSignedIn().then(function () {
      var ref = sub(id, "contests").doc(cid).collection("results").doc(pid);
      if (value == null || value <= 0) return ref.delete().catch(function () {});
      return ref.set({ value: value, updatedAt: Date.now() });
    }).then(function () { return assembleEvent(id); });
  }

  function ping(id, pid, coord) {
    return ensureSignedIn().then(function () {
      var data = { lastSeen: Date.now() };
      if (coord && typeof coord.lat === "number") { data.lat = coord.lat; data.lng = coord.lng; }
      return sub(id, "positions").doc(pid).set(data, { merge: true });
    }).then(function () { return { ok: true }; }).catch(function () { return { ok: false }; });
  }

  // ---- registrations (office / public RSVP) ---------------------------------
  function regColumns(b) {
    return {
      company: String(b.company), regNumber: b.regNumber || null, vatNumber: b.vatNumber || null,
      address: b.address || null, city: b.city || null, postalCode: b.postalCode || null,
      contactPerson: b.contactPerson || null, cell: b.cell || null, email: b.email || null,
    };
  }
  function contactMessage(b) { return [b.contactPerson, b.cell, b.email].filter(Boolean).join(" · "); }

  function saveRegistration(id, data) {
    var rec = Object.assign({ status: "new", createdAt: Date.now() }, data);
    return sub(id, "registrations").add(rec);
  }

  // Starting tee + tee-off time for a team's groups: explicit payload fields
  // (from the office edit form) win, else parsed from the name ("6th tee 13:46").
  // Only defined keys are returned (Firestore rejects undefined).
  function teeMeta(b) {
    var out = {};
    var nm = (b && b.company) || "";
    var p = (b && b.payload) || {};
    var tm = nm.match(/(\d{1,2})[:h](\d{2})/);
    if (tm) out.teeMin = (+tm[1]) * 60 + (+tm[2]);
    var tn = nm.match(/(\d+)\s*(?:st|nd|rd|th)?\s*tee/i);
    if (tn) out.startHole = parseInt(tn[1], 10);
    if (p.startHole != null) out.startHole = Number(p.startHole);
    if (p.teeTime && /^\d{1,2}:\d{2}$/.test(p.teeTime)) { var ps = p.teeTime.split(":"); out.teeMin = (+ps[0]) * 60 + (+ps[1]); }
    return out;
  }

  function registerTeam(code, b) {
    if (!b.company) return Promise.reject({ status: 400, body: { error: "Company name is required" } });
    var id;
    return ensureSignedIn().then(function () { return idForCode(code); }).then(function (eid) {
      if (!eid) return Promise.reject({ status: 404, body: { error: "No event with that code" } });
      id = eid;
      return sub(id, "groups").get();
    }).then(function (gsnap) {
      var order = gsnap.size;
      var meta = teeMeta(b); // starting tee + tee time shared by this entry's groups
      var teams = Array.isArray(b.teams) && b.teams.length ? b.teams : [{ players: [] }];
      var playersAdded = 0;
      var groupIds = [];
      var chain = Promise.resolve();
      teams.forEach(function (team) {
        chain = chain.then(function () {
          // One group per four-ball — even an empty four-ball gets its group so
          // it shows on the roster as a reserved team (billed at the team fee).
          return sub(id, "groups").add(Object.assign({ order: order++, createdAt: Date.now() }, meta)).then(function (gref) {
            groupIds.push(gref.id);
            var players = Array.isArray(team.players) ? team.players : [];
            var pc = Promise.resolve();
            players.forEach(function (p) {
              var name = (typeof p === "string" ? p : (p && p.name) || "").trim();
              if (!name) return;
              pc = pc.then(function () {
                playersAdded++;
                return sub(id, "players").add({
                  name: name, handicap: Number(typeof p === "object" ? p && p.handicap : 0) || 0,
                  deviceId: null, groupId: gref.id, createdAt: Date.now(),
                });
              });
            });
            return pc;
          });
        });
      });
      return chain.then(function () {
        // Record the groups this registration created so an office edit can later
        // sync name changes back to the exact roster four-balls.
        return saveRegistration(id, Object.assign({ type: "team", groupIds: groupIds }, regColumns(b), { payload: b }));
      }).then(function () { return { ok: true, teamsAdded: teams.length, playersAdded: playersAdded }; });
    });
  }

  function registerHoleSponsor(code, b) {
    if (!b.company) return Promise.reject({ status: 400, body: { error: "Company name is required" } });
    var id;
    return ensureSignedIn().then(function () { return idForCode(code); }).then(function (eid) {
      if (!eid) return Promise.reject({ status: 404, body: { error: "No event with that code" } });
      id = eid;
      return sub(id, "sponsors").add({
        name: b.company, tier: "hole",
        hole: b.holePreference != null && b.holePreference !== "" ? Number(b.holePreference) : null,
        message: contactMessage(b) || null,
        logo: typeof b.logo === "string" && b.logo.indexOf("data:") === 0 ? b.logo : null, createdAt: Date.now(),
      });
    }).then(function (sref) {
      return saveRegistration(id, Object.assign({ type: "hole", sponsorId: sref.id }, regColumns(b), { payload: b }));
    }).then(function () { return { ok: true }; });
  }

  function registerPrizeSponsor(code, b) {
    if (!b.company) return Promise.reject({ status: 400, body: { error: "Company name is required" } });
    var id;
    var prizeBits = b.prizeType === "cash"
      ? ("Cash: " + (b.cashAmount || "")).trim()
      : ((Array.isArray(b.prizes) ? b.prizes.filter(Boolean).join(", ") : "") || "Item prize");
    return ensureSignedIn().then(function () { return idForCode(code); }).then(function (eid) {
      if (!eid) return Promise.reject({ status: 404, body: { error: "No event with that code" } });
      id = eid;
      return sub(id, "sponsors").add({
        name: b.company, tier: "prize", hole: null,
        message: [prizeBits, contactMessage(b)].filter(Boolean).join(" — ") || null,
        logo: typeof b.logo === "string" && b.logo.indexOf("data:") === 0 ? b.logo : null, createdAt: Date.now(),
      });
    }).then(function (sref) {
      return saveRegistration(id, Object.assign({ type: "prize", sponsorId: sref.id }, regColumns(b), { payload: b }));
    }).then(function () { return { ok: true }; });
  }

  function listRegistrations(id) {
    return sub(id, "registrations").get().then(function (snap) {
      var rows = snap.docs.map(function (d) {
        var x = d.data();
        return Object.assign({ id: d.id }, x);
      });
      rows.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      return rows;
    });
  }

  function setRegistrationStatus(id, rid, status) {
    var allowed = ["new", "paid", "confirmed"];
    if (allowed.indexOf(status) < 0) return Promise.reject({ status: 400, body: { error: "status must be new, paid or confirmed" } });
    return ensureSignedIn().then(function () {
      return sub(id, "registrations").doc(rid).update({ status: status });
    }).then(function () {
      return sub(id, "registrations").doc(rid).get();
    }).then(function (s) { return Object.assign({ id: rid }, s.data()); });
  }

  // ---- team-roster sync (office edit → app players) -------------------------
  function orderedGroupPlayers(docs) {
    return docs.slice().sort(function (a, b) {
      return ((a.data().createdAt || 0) - (b.data().createdAt || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }

  // Reconcile one roster four-ball (group) against the edited player list.
  // Exact name matches keep their doc — and with it any live scores or bound
  // phone; remaining names re-use remaining slots in order (a rename in place);
  // extra names are added; dropped slots are deleted only when nothing is bound
  // and no scores exist, so an edit can never wipe a round or a live app user.
  function reconcileGroupPlayers(id, gid, edited) {
    edited = (edited || [])
      .map(function (p) { return { name: String((p && p.name) || "").trim(), handicap: Number(p && p.handicap) || 0 }; })
      .filter(function (p) { return p.name; });
    return sub(id, "players").where("groupId", "==", gid).get().then(function (snap) {
      var existing = orderedGroupPlayers(snap.docs);
      var usedE = {}, usedX = {}, ops = [];
      // 1) exact name match → keep doc, sync handicap only
      existing.forEach(function (d, xi) {
        var dn = String(d.data().name || "").trim().toLowerCase();
        for (var k = 0; k < edited.length; k++) {
          if (usedE[k]) continue;
          if (edited[k].name.toLowerCase() === dn) {
            usedE[k] = true; usedX[xi] = true;
            if ((d.data().handicap || 0) !== edited[k].handicap) ops.push(d.ref.update({ handicap: edited[k].handicap }));
            break;
          }
        }
      });
      var freeX = existing.filter(function (_, xi) { return !usedX[xi]; });
      var fi = 0;
      // 2) remaining names re-use free slots (rename), else 3) add
      for (var k = 0; k < edited.length; k++) {
        if (usedE[k]) continue;
        if (fi < freeX.length) {
          ops.push(freeX[fi++].ref.update({ name: edited[k].name, handicap: edited[k].handicap }));
        } else {
          ops.push(sub(id, "players").add({ name: edited[k].name, handicap: edited[k].handicap, deviceId: null, groupId: gid, createdAt: Date.now() }));
        }
      }
      // 4) leftover slots were removed — delete only when safe
      var delChain = Promise.resolve();
      freeX.slice(fi).forEach(function (d) {
        if (d.data().deviceId) return; // a phone is bound — leave it alone
        delChain = delChain.then(function () {
          return sub(id, "scores").where("playerId", "==", d.id).get().then(function (ss) {
            if (!ss.empty) return; // holds scores — keep the round
            return sub(id, "positions").doc(d.id).delete().catch(function () {}).then(function () { return d.ref.delete(); });
          });
        });
      });
      return Promise.all(ops).then(function () { return delChain; });
    });
  }

  // Which roster groups belong to this team registration. Uses the stored link
  // when present; for legacy rows (created before the link existed) it matches
  // by shared player name, then by nearest creation time, against groups not
  // already claimed by another registration. Returns one entry per edited team
  // (null where nothing could be matched — the caller then creates a group).
  function resolveGroupIds(id, reg) {
    var teams = Array.isArray(reg.payload && reg.payload.teams) && reg.payload.teams.length ? reg.payload.teams : [{ players: [] }];
    if (Array.isArray(reg.groupIds) && reg.groupIds.length) {
      return Promise.resolve(teams.map(function (_, i) { return reg.groupIds[i] != null ? reg.groupIds[i] : null; }));
    }
    return Promise.all([sub(id, "registrations").get(), sub(id, "groups").get(), sub(id, "players").get()]).then(function (r) {
      var claimed = {};
      r[0].forEach(function (d) { if (d.id === reg.id) return; var g = d.data().groupIds; if (Array.isArray(g)) g.forEach(function (x) { claimed[x] = true; }); });
      var groups = r[1].docs.filter(function (g) { return !claimed[g.id]; })
        .sort(function (a, b) { return ((a.data().createdAt || 0) - (b.data().createdAt || 0)) || (a.id < b.id ? -1 : 1); });
      var namesByGroup = {};
      r[2].forEach(function (p) { var gid = p.data().groupId; if (gid) (namesByGroup[gid] = namesByGroup[gid] || []).push(String(p.data().name || "").trim().toLowerCase()); });
      var regAt = reg.createdAt || 0, taken = {};
      return teams.map(function (t) {
        var names = (t.players || []).map(function (p) { return String((p && p.name) || "").trim().toLowerCase(); }).filter(Boolean);
        var pick = null;
        if (names.length) {
          for (var i = 0; i < groups.length && !pick; i++) {
            if (taken[groups[i].id]) continue;
            var gn = namesByGroup[groups[i].id] || [];
            if (gn.some(function (n) { return names.indexOf(n) >= 0; })) pick = groups[i];
          }
        }
        if (!pick) {
          var bestD = Infinity;
          for (var j = 0; j < groups.length; j++) {
            if (taken[groups[j].id]) continue;
            var d = Math.abs(regAt - (groups[j].data().createdAt || 0));
            if (d < bestD) { bestD = d; pick = groups[j]; }
          }
        }
        if (pick) { taken[pick.id] = true; return pick.id; }
        return null;
      });
    });
  }

  // Push an edited team registration's four-balls to the roster: one group per
  // four-ball (empty four-balls kept as empty groups), players reconciled per
  // group. Returns the group ids used, so the caller stores the link.
  function syncTeamRoster(id, reg, payload) {
    var teams = Array.isArray(payload.teams) && payload.teams.length ? payload.teams : [{ players: [] }];
    return resolveGroupIds(id, reg).then(function (resolved) {
      return sub(id, "groups").get().then(function (gsnap) {
        var order = gsnap.size, live = {}, finalIds = new Array(teams.length);
        gsnap.forEach(function (g) { live[g.id] = true; });
        var chain = Promise.resolve();
        teams.forEach(function (t, ti) {
          chain = chain.then(function () {
            var gid = resolved[ti];
            if (gid && live[gid]) { finalIds[ti] = gid; return; }
            return sub(id, "groups").add({ order: order++, createdAt: Date.now() }).then(function (gref) { finalIds[ti] = gref.id; live[gref.id] = true; });
          }).then(function () { return reconcileGroupPlayers(id, finalIds[ti], t.players || []); });
        });
        return chain.then(function () { return finalIds; });
      });
    });
  }

  // Edit a submission from the office. A body of only { status } keeps the old
  // fast path; any other field (company, contact, payload, …) is a full edit.
  function updateRegistration(id, rid, patch) {
    patch = patch || {};
    var keys = Object.keys(patch);
    if (keys.length === 1 && keys[0] === "status") return setRegistrationStatus(id, rid, patch.status);
    var COLS = ["company", "regNumber", "vatNumber", "address", "city", "postalCode", "contactPerson", "cell", "email"];
    return ensureSignedIn().then(function () {
      return sub(id, "registrations").doc(rid).get();
    }).then(function (snap) {
      if (!snap.exists) return Promise.reject({ status: 404, body: { error: "No such registration" } });
      var cur = snap.data() || {};
      var upd = {};
      COLS.forEach(function (k) { if (patch[k] !== undefined) upd[k] = patch[k] === "" ? null : patch[k]; });
      if (patch.status !== undefined) {
        if (["new", "paid", "confirmed"].indexOf(patch.status) < 0) return Promise.reject({ status: 400, body: { error: "status must be new, paid or confirmed" } });
        upd.status = patch.status;
      }
      // Merge the payload so the office card + CSV export stay in step, and mirror
      // the edited columns into it (that's where the import/export reads them).
      var payload = Object.assign({}, cur.payload || {});
      if (patch.payload && typeof patch.payload === "object") payload = Object.assign(payload, patch.payload);
      COLS.forEach(function (k) { if (patch[k] !== undefined) payload[k] = patch[k]; });
      upd.payload = payload;
      // Keep the linked board sponsor (hole / prize) in step with the edit.
      var sponsorUpdate = Promise.resolve();
      if (cur.sponsorId) {
        var sUpd = {};
        if (patch.company !== undefined) sUpd.name = patch.company;
        var msgParts = [payload.contactPerson, payload.cell, payload.email].filter(Boolean).join(" · ");
        if (cur.type === "prize") {
          var prizeBits = payload.prizeType === "cash"
            ? ("Cash: " + (payload.cashAmount || "")).trim()
            : ((Array.isArray(payload.prizes) ? payload.prizes.filter(Boolean).join(", ") : "") || "Item prize");
          sUpd.message = [prizeBits, msgParts].filter(Boolean).join(" — ") || null;
        } else {
          sUpd.message = msgParts || null;
          if (cur.type === "hole" && payload.holePreference !== undefined) {
            sUpd.hole = payload.holePreference != null && payload.holePreference !== "" ? Number(payload.holePreference) : null;
          }
        }
        sponsorUpdate = sub(id, "sponsors").doc(cur.sponsorId).update(sUpd).catch(function () {});
      }
      // Team edits flow through to the live app roster. Non-fatal: if the sync
      // fails the office edit still lands, so the card is never blocked by it.
      var rosterStep = Promise.resolve();
      if (cur.type === "team") {
        rosterStep = syncTeamRoster(id, Object.assign({ id: rid }, cur), payload)
          .then(function (ids) { if (Array.isArray(ids)) upd.groupIds = ids; })
          .catch(function (e) { if (typeof console !== "undefined") console.error("[events-fs] roster sync failed:", e); });
      }
      return rosterStep.then(function () {
        // Push the starting tee + tee-off time onto this team's group docs, so the
        // app starts each group on the right hole at the right time.
        var meta = teeMeta({ company: (upd.company != null ? upd.company : cur.company), payload: payload });
        var gids = (upd.groupIds && upd.groupIds.length) ? upd.groupIds : (cur.groupIds || []);
        var gStep = Promise.resolve();
        if (cur.type === "team" && gids.length && (meta.startHole != null || meta.teeMin != null)) {
          gStep = Promise.all(gids.map(function (gid) { return sub(id, "groups").doc(gid).update(meta).catch(function () {}); }));
        }
        return gStep.then(function () { return sub(id, "registrations").doc(rid).update(upd); });
      }).then(function () { return sponsorUpdate; });
    }).then(function () {
      return sub(id, "registrations").doc(rid).get();
    }).then(function (s) { return Object.assign({ id: rid }, s.data()); });
  }

  function deleteRegistration(id, rid) {
    return ensureSignedIn().then(function () {
      return sub(id, "registrations").doc(rid).get();
    }).then(function (s) {
      var sponsorId = s.exists ? (s.data() || {}).sponsorId : null;
      var p = sponsorId ? sub(id, "sponsors").doc(sponsorId).delete().catch(function () {}) : Promise.resolve();
      return p;
    }).then(function () {
      return sub(id, "registrations").doc(rid).delete();
    }).then(function () { return { ok: true }; });
  }

  // ---- realtime subscription (for the board / live view) --------------------
  // Re-assembles the whole event whenever any subcollection changes. Debounced so
  // a burst of writes coalesces into one repaint. Returns an unsubscribe fn.
  function subscribeEvent(id, cb) {
    var timer = null, dead = false;
    function fire() {
      if (dead) return;
      assembleEvent(id).then(function (e) { if (!dead && e) cb(e); }).catch(function () {});
    }
    function bump() { if (timer) clearTimeout(timer); timer = setTimeout(fire, 150); }
    var unsubs = [
      ev(id).onSnapshot(bump, function () {}),
      sub(id, "players").onSnapshot(bump, function () {}),
      sub(id, "positions").onSnapshot(bump, function () {}),
      sub(id, "groups").onSnapshot(bump, function () {}),
      sub(id, "scores").onSnapshot(bump, function () {}),
      sub(id, "contests").onSnapshot(bump, function () {}),
      sub(id, "sponsors").onSnapshot(bump, function () {}),
    ];
    fire(); // initial paint
    return function () {
      dead = true;
      if (timer) clearTimeout(timer);
      unsubs.forEach(function (u) { try { u(); } catch (e) {} });
    };
  }

  // ---- REST dispatcher (drives the fetch shim) ------------------------------
  // Maps the /tournaments/** REST routes onto the functions above. Returns a
  // Promise of the response body, or rejects with {status, body}.
  var isUuid = function (s) { return /^[0-9a-fA-F-]{20,}$/.test(s) || /^[A-Za-z0-9_-]{18,}$/.test(s); };

  function dispatch(method, path, body) {
    // path is everything after "/tournaments", e.g. "/ID/players" or "/code/ABC".
    var parts = path.replace(/^\/+/, "").split("/").filter(Boolean);
    body = body || {};

    // POST /tournaments  → create
    if (method === "POST" && parts.length === 0) return createEvent(body);

    // /code/... routes
    if (parts[0] === "code") {
      var code = decodeURIComponent(parts[1] || "");
      if (method === "GET" && parts.length === 2) {
        return idForCode(code).then(function (id) {
          if (!id) return Promise.reject({ status: 404, body: { error: "No event with that code" } });
          return assembleEvent(id);
        });
      }
      if (method === "POST" && parts[2] === "register") {
        if (parts[3] === "team") return registerTeam(code, body);
        if (parts[3] === "hole-sponsor") return registerHoleSponsor(code, body);
        if (parts[3] === "prize-sponsor") return registerPrizeSponsor(code, body);
      }
      return Promise.reject({ status: 404, body: { error: "unknown route" } });
    }

    var id = parts[0];
    var seg = parts[1], sub2 = parts[2], sub3 = parts[3];

    if (parts.length === 1) {
      if (method === "GET") return assembleEvent(id);
      if (method === "PATCH") return updateEvent(id, body);
      if (method === "PUT") return assembleEvent(id); // admin-pin no-op
    }

    if (seg === "players") {
      if (method === "POST" && parts.length === 2) return addPlayer(id, body);
      if (parts.length >= 3) {
        var pid = sub2;
        if (method === "DELETE" && parts.length === 3) return removePlayer(id, pid);
        if (method === "PATCH" && parts.length === 3) return assignPlayer(id, pid, body.groupId == null ? null : body.groupId);
        if (method === "PUT" && sub3 === "claim") return claimPlayer(id, pid, body.deviceId == null ? null : body.deviceId);
        if (method === "PUT" && sub3 === "ping") return ping(id, pid, typeof body.lat === "number" ? body : undefined);
      }
    }

    if (seg === "groups") {
      if (method === "POST" && parts.length === 2) return addGroup(id);
      if (method === "DELETE" && parts.length === 3) return removeGroup(id, sub2);
    }

    if (seg === "scores" && method === "PUT") return setScore(id, body.playerId, body.hole, body.strokes);

    if (seg === "sponsors") {
      if (method === "POST" && parts.length === 2) return addSponsor(id, body);
      if (method === "DELETE" && parts.length === 3) return removeSponsor(id, sub2);
    }

    if (seg === "contests") {
      if (method === "POST" && parts.length === 2) return addContest(id, body.type, body.hole);
      if (method === "DELETE" && parts.length === 3) return removeContest(id, sub2);
      if (method === "PUT" && sub3 === "results") return setContestResult(id, sub2, body.playerId, body.value);
    }

    if (seg === "registrations") {
      if (method === "GET" && parts.length === 2) return listRegistrations(id);
      if (method === "PATCH" && parts.length === 3) return updateRegistration(id, sub2, body || {});
      if (method === "DELETE" && parts.length === 3) return deleteRegistration(id, sub2);
    }

    return Promise.reject({ status: 404, body: { error: "unknown route: " + method + " " + path } });
  }

  // ---- fetch shim -----------------------------------------------------------
  // Intercepts requests to <api>/tournaments/** and serves them from Firestore.
  // Anything else (weather, assets, other origins) passes straight through.
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  function jsonResponse(status, obj) {
    var body = JSON.stringify(obj == null ? null : obj);
    if (typeof Response === "function") {
      return new Response(body, { status: status, headers: { "Content-Type": "application/json" } });
    }
    // very old browsers: a minimal duck-typed response
    return { ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(JSON.parse(body)); }, text: function () { return Promise.resolve(body); } };
  }

  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var m = url.match(/\/tournaments(\/[^?#]*)?/);
      if (m) {
        var path = m[1] || "";
        var method = ((init && init.method) || (typeof input === "object" && input.method) || "GET").toUpperCase();
        var rawBody = init && init.body;
        var body = null;
        if (typeof rawBody === "string") { try { body = JSON.parse(rawBody); } catch (e) { body = null; } }
        return dispatch(method, path, body).then(function (data) {
          return jsonResponse(200, data);
        }).catch(function (err) {
          if (err && err.status) return jsonResponse(err.status, err.body || { error: "error" });
          console.error("[events-fs] dispatch failed:", err);
          return jsonResponse(500, { error: "Firestore error" });
        });
      }
    } catch (e) {
      console.error("[events-fs] shim error, passing through:", e);
    }
    return _fetch ? _fetch(input, init) : Promise.reject(new Error("fetch unavailable"));
  };

  // ---- public surface -------------------------------------------------------
  window.EventsFS = {
    enabled: true,
    assembleEvent: assembleEvent,
    subscribeEvent: subscribeEvent,
    ensureSignedIn: ensureSignedIn,
    idForCode: idForCode,
    _dispatch: dispatch, // exposed for debugging
  };
  console.log("[events-fs] Firestore events path ENABLED (writes + realtime).");
})();
