// club-fs.js — the Firestore club layer for the clubhouse manage pages
// (members, tee sheet, competitions, news). The club-data half of the
// Render→Firebase cutover, twin to events-fs.js.
//
// SAFETY / FLAG: inert unless window.FOREAI_DEFAULTS.useFirestore === true or
// ?fs=1 in the URL (?fs=0 forces off). While off, window.fetch is untouched and
// the pages talk to Render exactly as today. Include AFTER firebase-config.js +
// the firebase compat SDKs (app, firestore, auth) and AFTER auth-guard.js, so
// its fetch shim wraps the token layer: /club|/members|/bookings|/competitions|
// /news → Firestore, everything else (e.g. /auth) → passthrough.
//
// IDENTITY: admin writes need the organiser's Firebase session. signin.html
// signs the organiser into Firebase (email/Google) and that session persists
// here, so writes run under their uid and satisfy isClubAdmin(clubKey) in
// firestore.rules (given their adminUsers/{uid} doc). Anonymous fallback
// covers the public read paths.
//
// Model (matches firestore.rules):
//   clubs/{clubKey}                                   settings
//   clubs/{clubKey}/members/{memberId}                roster
//   clubs/{clubKey}/bookings/{bookingId}              tee bookings (teeMs keyed)
//   clubs/{clubKey}/competitions/{compId}(/entries)   competitions
//   clubs/{clubKey}/notices/{noticeId}                noticeboard
(function () {
  "use strict";

  function flagOn() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("fs") === "1") return true;
      if (q.get("fs") === "0") return false;
    } catch (e) {}
    return !!(window.FOREAI_DEFAULTS && window.FOREAI_DEFAULTS.useFirestore);
  }
  if (!flagOn()) { window.ClubFS = { enabled: false }; return; }
  if (!window.firebase || !window.FIREBASE_CONFIG) {
    console.error("[club-fs] firebase compat SDK or FIREBASE_CONFIG missing — disabled.");
    window.ClubFS = { enabled: false }; return;
  }
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  var db = firebase.firestore();
  var auth = firebase.auth ? firebase.auth() : null;

  function ensureSignedIn() {
    if (!auth) return Promise.resolve(null);
    if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
    return auth.signInAnonymously().then(function (c) { return c.user.uid; }).catch(function () { return null; });
  }

  var clubRef = function (ck) { return db.collection("clubs").doc(ck); };
  var clubCol = function (ck, name) { return clubRef(ck).collection(name); };
  var num = function (v, d) { return Number.isFinite(Number(v)) ? Number(v) : d; };

  // ---- club-local time (SAST +02:00) — ported from routes/bookings.ts --------
  var SAST = "+02:00";
  var pad = function (n) { return String(n).padStart(2, "0"); };
  function slotMs(dateStr, minute) {
    var h = Math.floor(minute / 60), m = minute % 60;
    return new Date(dateStr + "T" + pad(h) + ":" + pad(m) + ":00" + SAST).getTime();
  }
  function dayBounds(dateStr) {
    var start = new Date(dateStr + "T00:00:00" + SAST).getTime();
    return [start, start + 24 * 3600 * 1000];
  }
  function weekday(dateStr) { return new Date(dateStr + "T12:00:00" + SAST).getUTCDay(); }
  var timeLabel = function (minute) { return pad(Math.floor(minute / 60)) + ":" + pad(minute % 60); };
  function todayStrSAST() { return new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10); }

  // ---- WHS scoring (verified port of backend lib/scoring.ts) ------------------
  function courseHandicap(index, slope, courseRating, par) {
    slope = slope == null ? 113 : slope; par = par == null ? 72 : par;
    var cr = courseRating == null ? par : courseRating;
    return Math.round(index * (slope / 113) + (cr - par));
  }
  function playingHandicap(ch, allow) { allow = allow == null ? 100 : allow; return Math.round((ch * allow) / 100); }
  function strokesOnHole(ph, si, holes) {
    holes = holes || 18;
    if (ph < 0) { var give = -ph; return si > holes - give ? -1 : 0; }
    var base = Math.floor(ph / holes), extra = ph % holes;
    return base + (si <= extra ? 1 : 0);
  }
  function stablefordHole(gross, par, strokes) {
    if (!gross || gross <= 0) return 0;
    return Math.max(0, 2 + (par - (gross - strokes)));
  }
  function scoreRound(holeScores, card, ph) {
    var gross = 0, net = 0, stableford = 0, holesIn = 0, netPerHole = [], ptsPerHole = [];
    for (var i = 0; i < 18; i++) {
      var g = Number(holeScores[i]) || 0;
      var s = strokesOnHole(ph, card.sis[i] == null ? i + 1 : card.sis[i]);
      var pts = stablefordHole(g, card.pars[i] == null ? 4 : card.pars[i], s);
      if (g > 0) { gross += g; net += g - s; holesIn++; stableford += pts; }
      netPerHole.push(g > 0 ? g - s : 0);
      ptsPerHole.push(pts);
    }
    return { gross: gross, net: net, stableford: stableford, holesIn: holesIn, netPerHole: netPerHole, ptsPerHole: ptsPerHole };
  }
  function countback(perHole) {
    var sum = function (from) { return perHole.slice(from).reduce(function (a, b) { return a + (b || 0); }, 0); };
    return [sum(9), sum(12), sum(15), sum(17)];
  }
  var KEMPTON_CARD = {
    pars: [5, 4, 4, 4, 3, 4, 4, 5, 3, 4, 3, 5, 5, 4, 4, 4, 3, 4],
    sis: [4, 16, 8, 2, 10, 6, 14, 12, 18, 13, 17, 11, 5, 1, 3, 9, 15, 7],
  };
  function cardFor(ck) {
    if (ck === "kempton") return { pars: KEMPTON_CARD.pars.slice(), sis: KEMPTON_CARD.sis.slice() };
    var pars = [], sis = [];
    for (var i = 0; i < 18; i++) { pars.push(4); sis.push(i + 1); }
    return { pars: pars, sis: sis };
  }
  function compCard(c) {
    var fb = cardFor(c.clubKey || "");
    return {
      pars: Array.isArray(c.pars) && c.pars.length === 18 ? c.pars : fb.pars,
      sis: Array.isArray(c.sis) && c.sis.length === 18 ? c.sis : fb.sis,
    };
  }
  var parTotal = function (pars) { return pars.reduce(function (a, b) { return a + (b || 0); }, 0); };

  // ---- settings --------------------------------------------------------------
  var SETTINGS_DEFAULTS = {
    courseId: "", firstTeeMin: 360, lastTeeMin: 960, intervalMin: 10,
    slotCapacity: 4, bookingWindowDays: 14, openDays: "0,1,2,3,4,5,6",
  };
  function getSettings(ck) {
    return clubRef(ck).get().then(function (s) {
      var base = Object.assign({ name: ck.charAt(0).toUpperCase() + ck.slice(1) }, SETTINGS_DEFAULTS);
      return s.exists ? Object.assign(base, s.data()) : base;
    });
  }
  function publicSettings(ck, s) {
    return {
      clubKey: ck, name: s.name, courseId: s.courseId, firstTeeMin: s.firstTeeMin, lastTeeMin: s.lastTeeMin,
      intervalMin: s.intervalMin, slotCapacity: s.slotCapacity, bookingWindowDays: s.bookingWindowDays,
      openDays: s.openDays, hasAdminPin: !!s.hasAdminPin,
    };
  }

  // ---- members ---------------------------------------------------------------
  function memberOut(id, ck, m) { return Object.assign({ id: id, clubKey: ck }, m); }
  function memberData(b) {
    var d = {};
    var str = function (k) { return b[k] != null ? String(b[k]) : undefined; };
    if (str("memberNumber") !== undefined) d.memberNumber = str("memberNumber");
    if (str("firstName") !== undefined) d.firstName = str("firstName");
    if (str("lastName") !== undefined) d.lastName = str("lastName");
    if ("email" in b) d.email = b.email ? String(b.email) : null;
    if ("cell" in b) d.cell = b.cell ? String(b.cell) : null;
    if (str("category") !== undefined) d.category = str("category");
    if (str("status") !== undefined) d.status = str("status");
    if ("hnaId" in b) d.hnaId = b.hnaId ? String(b.hnaId) : null;
    if ("photo" in b) d.photo = b.photo ? String(b.photo) : null;
    if (b.handicapIndex != null && Number.isFinite(Number(b.handicapIndex))) d.handicapIndex = Number(b.handicapIndex);
    return d;
  }
  function findMemberByNumber(ck, memberNumber) {
    return clubCol(ck, "members").where("memberNumber", "==", String(memberNumber).trim()).get()
      .then(function (s) { return s.empty ? null : s.docs[0]; });
  }
  function listMembers(ck, q) {
    return clubCol(ck, "members").get().then(function (snap) {
      var rows = snap.docs.map(function (d) { return memberOut(d.id, ck, d.data()); });
      if (q) {
        var needle = q.toLowerCase();
        rows = rows.filter(function (m) {
          return [m.firstName, m.lastName, m.memberNumber, m.email].some(function (v) {
            return v && String(v).toLowerCase().indexOf(needle) >= 0;
          });
        });
      }
      rows.sort(function (a, b) {
        return String(a.lastName || "").localeCompare(String(b.lastName || "")) ||
               String(a.firstName || "").localeCompare(String(b.firstName || ""));
      });
      return rows;
    });
  }
  function createMember(ck, b) {
    var d = memberData(b);
    if (!d.memberNumber || !d.firstName || !d.lastName)
      return Promise.reject({ status: 400, body: { error: "memberNumber, firstName, lastName required" } });
    return findMemberByNumber(ck, d.memberNumber).then(function (existing) {
      if (existing) return Promise.reject({ status: 409, body: { error: "That membership number already exists" } });
      return ensureSignedIn().then(function () { return clubCol(ck, "members").add(Object.assign({ createdAt: Date.now() }, d)); });
    }).then(function (ref) { return memberOut(ref.id, ck, d); });
  }
  function updateMember(ck, id, b) {
    return ensureSignedIn().then(function () { return clubCol(ck, "members").doc(id).update(memberData(b)); })
      .then(function () { return clubCol(ck, "members").doc(id).get(); })
      .then(function (s) { if (!s.exists) return Promise.reject({ status: 404, body: { error: "Member not found" } }); return memberOut(id, ck, s.data()); });
  }
  function deleteMember(ck, id) {
    return ensureSignedIn().then(function () { return clubCol(ck, "members").doc(id).delete(); }).then(function () { return { ok: true }; });
  }
  function importMembers(ck, rows) {
    rows = Array.isArray(rows) ? rows : [];
    var created = 0, updated = 0, skipped = 0;
    var chain = ensureSignedIn();
    rows.forEach(function (row) {
      chain = chain.then(function () {
        var d = memberData(row);
        if (!d.memberNumber || !d.firstName || !d.lastName) { skipped++; return; }
        var mn = d.memberNumber; delete d.memberNumber;
        return findMemberByNumber(ck, mn).then(function (existing) {
          if (existing) { updated++; return existing.ref.update(d); }
          created++; return clubCol(ck, "members").add(Object.assign({ memberNumber: mn, createdAt: Date.now() }, d));
        }).catch(function () { skipped++; });
      });
    });
    return chain.then(function () { return { ok: true, created: created, updated: updated, skipped: skipped, total: rows.length }; });
  }
  // Manual handicap entries only (a live HNA pull needs a server).
  function syncHna(ck, b) {
    if (b && b.live) return Promise.resolve({ ok: false, notConfigured: true, updated: 0, candidates: 0 });
    var entries = Array.isArray(b && b.entries) ? b.entries : [];
    var updated = 0;
    var chain = ensureSignedIn();
    entries.forEach(function (e) {
      chain = chain.then(function () {
        var idx = Number(e.handicapIndex);
        if (!Number.isFinite(idx)) return;
        var find = e.memberId
          ? clubCol(ck, "members").doc(String(e.memberId)).get().then(function (s) { return s.exists ? s : null; })
          : e.memberNumber ? findMemberByNumber(ck, e.memberNumber)
          : e.hnaId ? clubCol(ck, "members").where("hnaId", "==", String(e.hnaId)).get().then(function (s) { return s.empty ? null : s.docs[0]; })
          : Promise.resolve(null);
        return find.then(function (docSnap) {
          if (!docSnap) return;
          updated++;
          return docSnap.ref.update({ handicapIndex: idx, handicapSyncedAt: new Date().toISOString() });
        });
      });
    });
    return chain.then(function () { return { ok: true, updated: updated, total: entries.length }; });
  }

  // ---- bookings --------------------------------------------------------------
  function bookingOut(id, ck, b) {
    return {
      id: id, clubKey: ck, teeAt: b.teeAt || new Date(b.teeMs || Date.now()).toISOString(), courseId: b.courseId || "",
      memberId: b.memberId || null, partySize: b.partySize || 1, players: Array.isArray(b.players) ? b.players : null,
      note: b.note || null, status: b.status || "booked",
    };
  }
  function daySlots(ck, date) {
    return getSettings(ck).then(function (s) {
      var day = (date || todayStrSAST()).slice(0, 10);
      var openDays = String(s.openDays).split(",").map(function (x) { return Number(x.trim()); });
      var open = openDays.indexOf(weekday(day)) >= 0;
      var b = dayBounds(day);
      return clubCol(ck, "bookings").where("teeMs", ">=", b[0]).where("teeMs", "<", b[1]).get().then(function (snap) {
        var byMs = {};
        snap.forEach(function (d) {
          var bk = d.data();
          if (bk.status !== "booked" && bk.status !== "blocked") return;
          var g = byMs[bk.teeMs] || { seats: 0, names: [], blocked: false };
          if (bk.status === "blocked") g.blocked = true;
          g.seats += bk.partySize || 1;
          if (Array.isArray(bk.players)) g.names = g.names.concat(bk.players.map(String));
          byMs[bk.teeMs] = g;
        });
        var slots = [];
        for (var minute = s.firstTeeMin; minute <= s.lastTeeMin; minute += s.intervalMin) {
          var ms = slotMs(day, minute);
          var g2 = byMs[ms];
          var seats = g2 ? g2.seats : 0;
          slots.push({
            minute: minute, time: timeLabel(minute), teeAt: new Date(ms).toISOString(), capacity: s.slotCapacity,
            booked: seats, available: g2 && g2.blocked ? 0 : Math.max(0, s.slotCapacity - seats),
            blocked: !!(g2 && g2.blocked), names: g2 ? g2.names : [],
          });
        }
        return { date: day, open: open, courseId: s.courseId, bookingWindowDays: s.bookingWindowDays, slotCapacity: s.slotCapacity, slots: slots };
      });
    });
  }
  function dayBookings(ck, date) {
    var day = (date || todayStrSAST()).slice(0, 10);
    var b = dayBounds(day);
    return clubCol(ck, "bookings").where("teeMs", ">=", b[0]).where("teeMs", "<", b[1]).get().then(function (snap) {
      var rows = snap.docs.map(function (d) { return bookingOut(d.id, ck, d.data()); })
        .sort(function (a, x) { return Date.parse(a.teeAt) - Date.parse(x.teeAt); });
      return { date: day, bookings: rows };
    });
  }
  function blockSlot(ck, b) {
    return getSettings(ck).then(function (s) {
      var date = String((b && b.date) || "").slice(0, 10);
      var minute = Number(b && b.minute);
      var on = !(b && b.on === false);
      if (!date || !Number.isFinite(minute)) return Promise.reject({ status: 400, body: { error: "date and minute required" } });
      var ms = slotMs(date, minute);
      return ensureSignedIn().then(function () {
        if (on) {
          var rec = { teeMs: ms, teeAt: new Date(ms).toISOString(), memberId: null, partySize: s.slotCapacity, status: "blocked", note: b && b.note ? String(b.note) : "Blocked", createdAt: Date.now() };
          return clubCol(ck, "bookings").add(rec).then(function (ref) { return bookingOut(ref.id, ck, rec); });
        }
        return clubCol(ck, "bookings").where("teeMs", "==", ms).where("status", "==", "blocked").get().then(function (snap) {
          var batch = db.batch();
          snap.forEach(function (d) { batch.delete(d.ref); });
          return batch.commit();
        }).then(function () { return { ok: true }; });
      });
    });
  }
  function cancelBooking(ck, id, b) {
    var ref = clubCol(ck, "bookings").doc(id);
    return ref.get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Booking not found" } });
      var bk = s.data();
      var asMember = b && b.memberId && String(b.memberId) === bk.memberId;
      // Admin (organiser) is authorised via the Firestore rules; allow the write.
      return ensureSignedIn().then(function () { return ref.update({ status: "cancelled" }); })
        .then(function () { return bookingOut(id, ck, Object.assign({}, bk, { status: "cancelled" })); });
    });
  }

  // ---- competitions ----------------------------------------------------------
  function compSummary(id, c, count) {
    return {
      id: id, clubKey: c.clubKey, name: c.name, date: c.date, format: c.format, courseId: c.courseId || "",
      status: c.status || "open", handicapAllowance: c.handicapAllowance == null ? 95 : c.handicapAllowance,
      description: c.description == null ? null : c.description, entryCount: count,
    };
  }
  function entryOut(id, e) {
    return {
      id: id, memberId: e.memberId || null, playerName: e.playerName, handicapIndex: e.handicapIndex == null ? null : e.handicapIndex,
      playingHandicap: e.playingHandicap || 0, holeScores: e.holeScores || [], grossTotal: e.grossTotal == null ? null : e.grossTotal,
      netTotal: e.netTotal == null ? null : e.netTotal, stableford: e.stableford == null ? null : e.stableford, status: e.status || "entered",
    };
  }
  function leaderboard(comp, entries) {
    var card = compCard(comp), stab = comp.format === "stableford";
    var rows = entries.filter(function (e) { return e.data.status !== "withdrawn"; })
      .map(function (e) { var r = scoreRound(e.data.holeScores || [], card, e.data.playingHandicap || 0); r.e = e; return r; });
    rows.sort(function (a, b) {
      if ((a.holesIn > 0) !== (b.holesIn > 0)) return a.holesIn > 0 ? -1 : 1;
      if (stab) {
        if (b.stableford !== a.stableford) return b.stableford - a.stableford;
        var ca = countback(a.ptsPerHole), cb = countback(b.ptsPerHole);
        for (var i = 0; i < 4; i++) if (cb[i] !== ca[i]) return cb[i] - ca[i];
      } else {
        if (a.net !== b.net) return a.net - b.net;
        var cc = countback(a.netPerHole), cd = countback(b.netPerHole);
        for (var j = 0; j < 4; j++) if (cc[j] !== cd[j]) return cc[j] - cd[j];
      }
      return 0;
    });
    return rows.map(function (r, i) {
      return {
        pos: r.holesIn > 0 ? i + 1 : null, entryId: r.e.id, memberId: r.e.data.memberId || null, name: r.e.data.playerName,
        playingHandicap: r.e.data.playingHandicap || 0, handicapIndex: r.e.data.handicapIndex == null ? null : r.e.data.handicapIndex,
        gross: r.gross, net: r.net, stableford: r.stableford, thru: r.holesIn, status: r.e.data.status || "entered",
        holeScores: r.e.data.holeScores || [],
      };
    });
  }
  function loadEntries(ck, id) {
    return clubCol(ck, "competitions").doc(id).collection("entries").get().then(function (snap) {
      return snap.docs.map(function (d) { return { id: d.id, data: d.data() }; });
    });
  }
  function compData(ck, b, existing) {
    var card = cardFor(ck);
    var arr = function (v, d) { return Array.isArray(v) && v.length === 18 ? v.map(function (x) { return Number(x) || 0; }) : d; };
    var e = existing || {};
    return {
      clubKey: ck,
      name: b.name != null ? String(b.name) : e.name,
      date: b.date != null ? String(b.date) : e.date,
      format: b.format != null ? String(b.format) : (e.format || "stableford"),
      courseId: b.courseId != null ? String(b.courseId) : (e.courseId || ""),
      status: b.status != null ? String(b.status) : (e.status || "open"),
      handicapAllowance: b.handicapAllowance != null ? Number(b.handicapAllowance) : (e.handicapAllowance == null ? 95 : e.handicapAllowance),
      slope: b.slope != null ? Number(b.slope) : (e.slope == null ? 113 : e.slope),
      courseRating: b.courseRating != null ? Number(b.courseRating) : (e.courseRating == null ? null : e.courseRating),
      pars: arr(b.pars, e.pars || card.pars),
      sis: arr(b.sis, e.sis || card.sis),
      description: b.description != null ? String(b.description) : (e.description == null ? null : e.description),
    };
  }
  function listComps(ck, status) {
    return clubCol(ck, "competitions").get().then(function (snap) {
      return Promise.all(snap.docs.map(function (d) {
        return d.ref.collection("entries").get().then(function (es) { return { id: d.id, c: d.data(), cnt: es.size }; });
      }));
    }).then(function (rows) {
      return rows.filter(function (r) { return r.c.status !== "draft" && (!status || r.c.status === status); })
        .sort(function (a, b) { return String(b.c.date).localeCompare(String(a.c.date)); })
        .map(function (r) { return compSummary(r.id, r.c, r.cnt); });
    });
  }
  function compDetail(ck, id, memberId) {
    return clubCol(ck, "competitions").doc(id).get().then(function (cs) {
      if (!cs.exists) return Promise.reject({ status: 404, body: { error: "Competition not found" } });
      var comp = cs.data();
      return loadEntries(ck, id).then(function (entries) {
        var mine = memberId ? entries.find(function (e) { return e.data.memberId === memberId; }) : null;
        var cc = compCard(comp);
        return Object.assign(compSummary(id, comp, entries.length), {
          pars: cc.pars, sis: cc.sis, leaderboard: leaderboard(comp, entries), myEntry: mine ? entryOut(mine.id, mine.data) : null,
        });
      });
    });
  }
  function createComp(ck, b) {
    var d = compData(ck, b);
    if (!d.name || !d.date) return Promise.reject({ status: 400, body: { error: "name and date required" } });
    return ensureSignedIn().then(function () { return clubCol(ck, "competitions").add(Object.assign({ createdAt: Date.now() }, d)); })
      .then(function (ref) { return Object.assign({ id: ref.id }, d); });
  }
  function updateComp(ck, id, b) {
    var ref = clubCol(ck, "competitions").doc(id);
    return ref.get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Competition not found" } });
      var d = compData(ck, b, s.data());
      return ensureSignedIn().then(function () { return ref.update(d); }).then(function () { return Object.assign({ id: id }, d); });
    });
  }
  function deleteComp(ck, id) {
    var ref = clubCol(ck, "competitions").doc(id);
    return ensureSignedIn().then(function () { return ref.collection("entries").get(); }).then(function (snap) {
      var batch = db.batch();
      snap.forEach(function (d) { batch.delete(d.ref); });
      batch.delete(ref);
      return batch.commit();
    }).then(function () { return { ok: true }; });
  }
  function enterComp(ck, id, b) {
    return clubCol(ck, "competitions").doc(id).get().then(function (cs) {
      if (!cs.exists) return Promise.reject({ status: 404, body: { error: "Competition not found" } });
      var comp = cs.data();
      if (comp.status !== "open") return Promise.reject({ status: 409, body: { error: "Entries are closed for this competition" } });
      var entriesCol = clubCol(ck, "competitions").doc(id).collection("entries");
      var memberId = b.memberId ? String(b.memberId) : null;
      if (memberId) {
        return clubCol(ck, "members").doc(memberId).get().then(function (ms) {
          if (!ms.exists) return Promise.reject({ status: 404, body: { error: "Member not found" } });
          var m = ms.data();
          if (m.status !== "active") return Promise.reject({ status: 403, body: { error: "Membership is not active" } });
          return entriesCol.where("memberId", "==", memberId).get().then(function (dupSnap) {
            if (!dupSnap.empty) {
              var dup = dupSnap.docs[0];
              if (dup.data().status !== "withdrawn") return Promise.reject({ status: 409, body: { error: "You're already entered" } });
              return dup.ref.update({ status: "entered" }).then(function () { return entryOut(dup.id, Object.assign({}, dup.data(), { status: "entered" })); });
            }
            return addEntry(ck, id, comp, memberId, m.firstName + " " + m.lastName, m.handicapIndex == null ? null : m.handicapIndex, entriesCol);
          });
        });
      }
      // Guest (admin only, gated by rules)
      var playerName = b.playerName ? String(b.playerName) : "";
      if (!playerName) return Promise.reject({ status: 400, body: { error: "playerName required for a guest" } });
      var index = b.handicapIndex != null ? Number(b.handicapIndex) : null;
      return addEntry(ck, id, comp, null, playerName, index, entriesCol);
    });
  }
  function addEntry(ck, id, comp, memberId, playerName, index, entriesCol) {
    var ch = index != null ? courseHandicap(index, comp.slope == null ? 113 : comp.slope, comp.courseRating == null ? undefined : comp.courseRating, parTotal(compCard(comp).pars)) : 0;
    var ph = playingHandicap(ch, comp.handicapAllowance == null ? 95 : comp.handicapAllowance);
    var rec = { memberId: memberId, playerName: playerName, handicapIndex: index, playingHandicap: ph, holeScores: [], grossTotal: null, netTotal: null, stableford: null, status: "entered", createdAt: Date.now() };
    return ensureSignedIn().then(function () { return entriesCol.add(rec); }).then(function (ref) { return entryOut(ref.id, rec); });
  }
  function scoreComp(ck, id, b) {
    return clubCol(ck, "competitions").doc(id).get().then(function (cs) {
      if (!cs.exists) return Promise.reject({ status: 404, body: { error: "Competition not found" } });
      var comp = cs.data();
      var scores = Array.isArray(b.holeScores) ? b.holeScores.map(function (x) { return Number(x) || 0; }).slice(0, 18) : [];
      while (scores.length < 18) scores.push(0);
      var entriesCol = clubCol(ck, "competitions").doc(id).collection("entries");
      var find = b.entryId
        ? entriesCol.doc(String(b.entryId)).get().then(function (s) { return s.exists ? s : null; })
        : b.memberId ? entriesCol.where("memberId", "==", String(b.memberId)).get().then(function (s) { return s.empty ? null : s.docs[0]; })
        : Promise.resolve(null);
      return find.then(function (entryDoc) {
        if (!entryDoc) return Promise.reject({ status: 404, body: { error: "Entry not found — enter the competition first" } });
        var entry = entryDoc.data();
        var r = scoreRound(scores, compCard(comp), entry.playingHandicap || 0);
        var patch = { holeScores: scores, grossTotal: r.gross || null, netTotal: r.holesIn ? r.net : null, stableford: r.holesIn ? r.stableford : null, status: r.holesIn >= 18 ? "submitted" : "entered" };
        return ensureSignedIn().then(function () { return entryDoc.ref.update(patch); })
          .then(function () { return { entry: entryOut(entryDoc.id, Object.assign({}, entry, patch)), result: r }; });
      });
    });
  }

  // ---- news ------------------------------------------------------------------
  function noticeOut(id, ck, n) {
    return {
      id: id, clubKey: ck, title: n.title, body: n.body, category: n.category || "news", pinned: !!n.pinned,
      image: n.image == null ? null : n.image, authorName: n.authorName == null ? null : n.authorName,
      status: n.status || "published", publishAt: n.publishAt || new Date().toISOString(),
    };
  }
  function noticeData(b) {
    var d = {};
    if (b.title != null) d.title = String(b.title);
    if (b.body != null) d.body = String(b.body);
    if (b.category != null) d.category = String(b.category);
    if (b.pinned != null) d.pinned = !!b.pinned;
    if ("image" in b) d.image = b.image ? String(b.image) : null;
    if ("authorName" in b) d.authorName = b.authorName ? String(b.authorName) : null;
    if (b.status != null) d.status = String(b.status);
    if (b.publishAt != null) d.publishAt = String(b.publishAt);
    return d;
  }
  var pubMs = function (n) { var t = typeof n.publishAt === "number" ? n.publishAt : Date.parse(n.publishAt || ""); return Number.isFinite(t) ? t : 0; };
  function listNotices(ck, all) {
    return clubCol(ck, "notices").get().then(function (snap) {
      var now = Date.now();
      var rows = snap.docs.map(function (d) { return { id: d.id, data: d.data() }; });
      if (!all) rows = rows.filter(function (x) { return (x.data.status || "published") === "published" && pubMs(x.data) <= now; });
      rows.sort(function (a, b) {
        var pin = (b.data.pinned ? 1 : 0) - (a.data.pinned ? 1 : 0);
        return pin !== 0 ? pin : pubMs(b.data) - pubMs(a.data);
      });
      return rows.slice(0, all ? 1000 : 100).map(function (x) { return noticeOut(x.id, ck, x.data); });
    });
  }
  function createNotice(ck, b) {
    var d = noticeData(b);
    if (!d.title || !d.body) return Promise.reject({ status: 400, body: { error: "title and body required" } });
    if (!d.status) d.status = "published";
    if (!d.publishAt) d.publishAt = new Date().toISOString();
    return ensureSignedIn().then(function () { return clubCol(ck, "notices").add(Object.assign({ createdAt: Date.now() }, d)); })
      .then(function (ref) { return noticeOut(ref.id, ck, d); });
  }
  function updateNotice(ck, id, b) {
    var ref = clubCol(ck, "notices").doc(id);
    return ensureSignedIn().then(function () { return ref.update(noticeData(b)); })
      .then(function () { return ref.get(); })
      .then(function (s) { if (!s.exists) return Promise.reject({ status: 404, body: { error: "Notice not found" } }); return noticeOut(id, ck, s.data()); });
  }
  function deleteNotice(ck, id) {
    return ensureSignedIn().then(function () { return clubCol(ck, "notices").doc(id).delete(); }).then(function () { return { ok: true }; });
  }
  function getNotice(ck, id) {
    return clubCol(ck, "notices").doc(id).get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Notice not found" } });
      return noticeOut(id, ck, s.data());
    });
  }

  // ---- dispatcher ------------------------------------------------------------
  function dispatch(method, root, rest, query, body) {
    // root = club|members|bookings|competitions|news ; rest = path parts after it
    var ck = rest[0];
    var a = rest[1], id = rest[1], c = rest[2];
    body = body || {};

    if (root === "club") {
      if (method === "GET" && rest.length === 1) return getSettings(ck).then(function (s) { return publicSettings(ck, s); });
      if (method === "POST" && a === "settings") {
        return getSettings(ck).then(function (s) {
          var upd = {
            name: body.name != null ? String(body.name) : s.name,
            courseId: body.courseId != null ? String(body.courseId) : s.courseId,
            firstTeeMin: num(body.firstTeeMin, s.firstTeeMin), lastTeeMin: num(body.lastTeeMin, s.lastTeeMin),
            intervalMin: Math.max(1, num(body.intervalMin, s.intervalMin)), slotCapacity: Math.max(1, num(body.slotCapacity, s.slotCapacity)),
            bookingWindowDays: Math.max(0, num(body.bookingWindowDays, s.bookingWindowDays)),
            openDays: body.openDays != null ? String(body.openDays) : s.openDays,
          };
          return ensureSignedIn().then(function () { return clubRef(ck).set(upd, { merge: true }); })
            .then(function () { return publicSettings(ck, Object.assign({}, s, upd)); });
        });
      }
      if (method === "POST" && a === "pin") {
        // PINs are replaced by Firebase auth; store only the hasAdminPin flag.
        var on = body.newPin != null && String(body.newPin).trim() !== "";
        return ensureSignedIn().then(function () { return clubRef(ck).set({ hasAdminPin: on }, { merge: true }); })
          .then(function () { return { ok: true, hasAdminPin: on }; });
      }
    }

    if (root === "members") {
      if (method === "GET" && a === "all") return listMembers(ck, query.get("q") || "");
      if (method === "POST" && rest.length === 1) return createMember(ck, body);
      if (method === "POST" && a === "import") return importMembers(ck, body.members);
      if (method === "POST" && a === "sync-hna") return syncHna(ck, body);
      if (method === "PUT" && rest.length === 2) return updateMember(ck, id, body);
      if (method === "DELETE" && rest.length === 2) return deleteMember(ck, id);
      if (method === "GET" && a === "lookup") {
        var num2 = query.get("number"), email = query.get("email");
        return listMembers(ck, "").then(function (rows) {
          var hit = num2 ? rows.find(function (m) { return String(m.memberNumber) === String(num2).trim(); })
            : rows.find(function (m) { return m.email && m.email.toLowerCase() === String(email).trim().toLowerCase(); });
          if (!hit) return Promise.reject({ status: 404, body: { error: "No member found" } });
          return hit;
        });
      }
    }

    if (root === "bookings") {
      if (method === "GET" && a === "slots") return daySlots(ck, query.get("date"));
      if (method === "GET" && a === "day") return dayBookings(ck, query.get("date"));
      if (method === "POST" && a === "block") return blockSlot(ck, body);
      if (method === "POST" && c === "cancel") return cancelBooking(ck, id, body);
      if (method === "GET" && a === "mine") {
        var memberId = query.get("memberId");
        return clubCol(ck, "bookings").where("memberId", "==", memberId).get().then(function (snap) {
          var now = Date.now();
          return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function (b2) { return b2.status === "booked" && (b2.teeMs || 0) >= now; })
            .sort(function (x, y) { return (x.teeMs || 0) - (y.teeMs || 0); })
            .map(function (b2) { return bookingOut(b2.id, ck, b2); });
        });
      }
    }

    if (root === "competitions") {
      if (method === "GET" && rest.length === 1) return listComps(ck, query.get("status"));
      if (method === "POST" && rest.length === 1) return createComp(ck, body);
      if (method === "GET" && rest.length === 2) return compDetail(ck, id, query.get("memberId"));
      if (method === "PUT" && rest.length === 2) return updateComp(ck, id, body);
      if (method === "DELETE" && rest.length === 2) return deleteComp(ck, id);
      if (method === "POST" && c === "enter") return enterComp(ck, id, body);
      if (method === "POST" && c === "withdraw") {
        return clubCol(ck, "competitions").doc(id).collection("entries").where("memberId", "==", String(body.memberId)).get().then(function (snap) {
          if (snap.empty) return Promise.reject({ status: 404, body: { error: "Entry not found" } });
          return ensureSignedIn().then(function () { return snap.docs[0].ref.update({ status: "withdrawn" }); }).then(function () { return { ok: true }; });
        });
      }
      if (method === "POST" && c === "score") return scoreComp(ck, id, body);
      if (method === "GET" && c === "leaderboard") return compDetail(ck, id, null).then(function (d) { return { id: id, name: d.name, format: d.format, status: d.status, leaderboard: d.leaderboard }; });
    }

    if (root === "news") {
      if (method === "GET" && rest.length === 1) return listNotices(ck, false);
      if (method === "GET" && a === "all") return listNotices(ck, true);
      if (method === "GET" && a === "item") return getNotice(ck, c);
      if (method === "POST" && rest.length === 1) return createNotice(ck, body);
      if (method === "PUT" && rest.length === 2) return updateNotice(ck, id, body);
      if (method === "DELETE" && rest.length === 2) return deleteNotice(ck, id);
    }

    return Promise.reject({ status: 404, body: { error: "unknown route: " + method + " /" + root + "/" + rest.join("/") } });
  }

  // ---- fetch shim ------------------------------------------------------------
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  var ROOTS = /\/(club|members|bookings|competitions|news)(\/[^?#]*)?(\?[^#]*)?$/;
  function jsonResponse(status, obj) {
    var body = JSON.stringify(obj == null ? null : obj);
    if (typeof Response === "function") return new Response(body, { status: status, headers: { "Content-Type": "application/json" } });
    return { ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(JSON.parse(body)); }, text: function () { return Promise.resolve(body); } };
  }
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var m = url.match(ROOTS);
      if (m) {
        var root = m[1];
        var rest = (m[2] || "").replace(/^\/+/, "").split("/").filter(Boolean).map(decodeURIComponent);
        var query = new URLSearchParams(m[3] || "");
        var method = ((init && init.method) || (typeof input === "object" && input.method) || "GET").toUpperCase();
        var rawBody = init && init.body, body = null;
        if (typeof rawBody === "string") { try { body = JSON.parse(rawBody); } catch (e) { body = null; } }
        return dispatch(method, root, rest, query, body)
          .then(function (data) { return jsonResponse(200, data); })
          .catch(function (err) {
            if (err && err.status) return jsonResponse(err.status, err.body || { error: "error" });
            console.error("[club-fs] dispatch failed:", err);
            return jsonResponse(500, { error: "Firestore error" });
          });
      }
    } catch (e) { console.error("[club-fs] shim error, passing through:", e); }
    return _fetch ? _fetch(input, init) : Promise.reject(new Error("fetch unavailable"));
  };

  window.ClubFS = { enabled: true, _dispatch: dispatch, ensureSignedIn: ensureSignedIn };
  console.log("[club-fs] Firestore club path ENABLED (members, tee sheet, competitions, news).");
})();
