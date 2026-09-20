/* eslint-disable */
// The app's Firestore data layer for the Kempton club — members, tee sheet,
// competitions, news and payments. PORTED VERBATIM from clubhouse/club-fs.js
// (same collections + logic) so the app and the web portal share one backend
// (clubs/{clubKey}/...). Keep the handler body in sync with club-fs.js.
//
// Uses the firebase compat SDK (same API surface as the web) and long-polling
// for reliable Firestore over React Native. The member-facing app runs as an
// anonymous Firebase user (ensureSignedIn) — the Firestore security rules must
// permit member operations (see firestore.rules).
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { FIREBASE_CONFIG } from "../config/firebase";

if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
var db = firebase.firestore();
try { db.settings({ experimentalForceLongPolling: true }); } catch (e) {}
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
      currency: s.currency || "ZAR",
      bankingDetails: s.bankingDetails || null,
      chargeGreenFeeOnBooking: !!s.chargeGreenFeeOnBooking,
      paymentsMode: s.paymentsMode || "manual",
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
  // ---- payments (dues, green fees, competition entries, levies) --------------
  // Firestore: clubs/{ck}/fees/{id}, clubs/{ck}/invoices/{id}. Amounts are
  // integer cents in the club currency (settings.currency, default ZAR).
  var FEE_TYPES = ["dues", "green_fee", "comp_entry", "levy"];
  function genInvoiceNumber() {
    var now = new Date();
    var ym = String(now.getFullYear()).slice(2) + ("0" + (now.getMonth() + 1)).slice(-2);
    return "INV-" + ym + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  function feeData(b) {
    var d = {};
    if (b.type != null && FEE_TYPES.indexOf(String(b.type)) >= 0) d.type = String(b.type);
    if (b.name != null) d.name = String(b.name);
    d.category = b.category ? String(b.category) : null;
    d.period = b.period ? String(b.period) : null;
    if (b.amountCents != null && Number.isFinite(Number(b.amountCents))) d.amountCents = Math.max(0, Math.round(Number(b.amountCents)));
    d.active = ("active" in b) ? !!b.active : true;
    return d;
  }
  function invoiceOut(id, d) {
    return {
      id: id, number: d.number, memberId: d.memberId || null, payerName: d.payerName,
      payerEmail: d.payerEmail || null, type: d.type, description: d.description,
      amountCents: d.amountCents, status: d.status, dueAt: d.dueAt || null,
      paidAt: d.paidAt || null, feeId: d.feeId || null, createdAt: d.createdAt || null,
    };
  }
  function paymentsConfig(ck) {
    return getSettings(ck).then(function (s) {
      return { mode: s.paymentsMode || "manual", currency: s.currency || "ZAR", banking: s.bankingDetails || null };
    });
  }
  function listFees(ck) {
    return clubCol(ck, "fees").get().then(function (snap) {
      return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return String(a.type).localeCompare(String(b.type)) || String(a.name || "").localeCompare(String(b.name || "")); });
    });
  }
  function createFee(ck, b) {
    var d = feeData(b);
    if (!d.type || !d.name || d.amountCents == null) return Promise.reject({ status: 400, body: { error: "type, name and amountCents required" } });
    return ensureSignedIn().then(function () { return clubCol(ck, "fees").add(Object.assign({ createdAt: Date.now() }, d)); })
      .then(function (ref) { return Object.assign({ id: ref.id }, d); });
  }
  function updateFee(ck, id, b) {
    return ensureSignedIn().then(function () { return clubCol(ck, "fees").doc(id).update(feeData(b)); })
      .then(function () { return clubCol(ck, "fees").doc(id).get(); })
      .then(function (s) { if (!s.exists) return Promise.reject({ status: 404, body: { error: "Fee not found" } }); return Object.assign({ id: id }, s.data()); });
  }
  function deleteFee(ck, id) {
    return ensureSignedIn().then(function () { return clubCol(ck, "fees").doc(id).delete(); }).then(function () { return { ok: true }; });
  }
  function listInvoices(ck, query) {
    var status = query.get("status") || "", type = query.get("type") || "", q = (query.get("q") || "").trim().toLowerCase();
    return clubCol(ck, "invoices").get().then(function (snap) {
      var all = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      var totals = {};
      all.forEach(function (r) { totals[r.status] = (totals[r.status] || 0) + (r.amountCents || 0); });
      var rows = all;
      if (status) rows = rows.filter(function (r) { return r.status === status; });
      if (type) rows = rows.filter(function (r) { return r.type === type; });
      if (q) rows = rows.filter(function (r) { return String(r.payerName || "").toLowerCase().indexOf(q) >= 0 || String(r.number || "").toLowerCase().indexOf(q) >= 0; });
      rows.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      return {
        invoices: rows.map(function (r) { return invoiceOut(r.id, r); }),
        totals: Object.keys(totals).map(function (k) { return { status: k, _sum: { amountCents: totals[k] } }; }),
      };
    });
  }
  function createInvoice(ck, b) {
    var amountCents = Math.round(Number(b.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) return Promise.reject({ status: 400, body: { error: "amountCents required" } });
    var doc = {
      number: genInvoiceNumber(),
      memberId: b.memberId ? String(b.memberId) : null,
      payerName: b.payerName ? String(b.payerName) : "",
      payerEmail: b.payerEmail ? String(b.payerEmail) : null,
      type: FEE_TYPES.indexOf(String(b.type)) >= 0 ? String(b.type) : "levy",
      description: b.description ? String(b.description) : "Charge",
      amountCents: amountCents, status: "unpaid",
      dueAt: b.dueAt || null, feeId: b.feeId ? String(b.feeId) : null, createdAt: Date.now(),
    };
    var pre = Promise.resolve();
    if (doc.memberId && !doc.payerName) {
      pre = clubCol(ck, "members").doc(doc.memberId).get().then(function (s) {
        if (s.exists) { var m = s.data(); doc.payerName = ((m.firstName || "") + " " + (m.lastName || "")).trim(); doc.payerEmail = doc.payerEmail || m.email || null; }
      });
    }
    return pre.then(function () {
      if (!doc.payerName) return Promise.reject({ status: 400, body: { error: "payerName or memberId required" } });
      return ensureSignedIn().then(function () { return clubCol(ck, "invoices").add(doc); });
    }).then(function (ref) { return invoiceOut(ref.id, doc); });
  }
  function markInvoicePaid(ck, id, b) {
    var ref = clubCol(ck, "invoices").doc(id);
    return ref.get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Invoice not found" } });
      if (s.data().status === "paid") return invoiceOut(id, s.data());
      var upd = { status: "paid", paidAt: Date.now(), paymentMethod: b.method ? String(b.method) : "EFT", paymentRef: b.ref ? String(b.ref) : null };
      return ensureSignedIn().then(function () { return ref.update(upd); }).then(function () { return invoiceOut(id, Object.assign({}, s.data(), upd)); });
    });
  }
  function cancelInvoice(ck, id) {
    var ref = clubCol(ck, "invoices").doc(id);
    return ensureSignedIn().then(function () { return ref.update({ status: "cancelled" }); })
      .then(function () { return ref.get(); })
      .then(function (s) { if (!s.exists) return Promise.reject({ status: 404, body: { error: "Invoice not found" } }); return invoiceOut(id, s.data()); });
  }
  function issueDues(ck, b) {
    var feeId = b.feeId ? String(b.feeId) : "";
    if (!feeId) return Promise.reject({ status: 400, body: { error: "A dues fee is required" } });
    return clubCol(ck, "fees").doc(feeId).get().then(function (fs) {
      if (!fs.exists || fs.data().type !== "dues") return Promise.reject({ status: 400, body: { error: "A dues fee is required" } });
      var fee = fs.data();
      return Promise.all([clubCol(ck, "members").get(), clubCol(ck, "invoices").where("feeId", "==", feeId).get()]).then(function (res) {
        var members = res[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
          .filter(function (m) { return (m.status || "active") === "active" && (!fee.category || m.category === fee.category); });
        var already = {};
        res[1].docs.forEach(function (d) { var r = d.data(); if (r.memberId && r.status !== "cancelled") already[r.memberId] = true; });
        var dueAt = b.dueAt || null, created = 0, skipped = 0;
        var chain = ensureSignedIn();
        members.forEach(function (m) {
          chain = chain.then(function () {
            if (already[m.id]) { skipped++; return; }
            created++;
            return clubCol(ck, "invoices").add({
              number: genInvoiceNumber(), memberId: m.id, payerName: ((m.firstName || "") + " " + (m.lastName || "")).trim(),
              payerEmail: m.email || null, type: "dues", description: fee.name, amountCents: fee.amountCents,
              status: "unpaid", dueAt: dueAt, feeId: feeId, createdAt: Date.now(),
            });
          });
        });
        return chain.then(function () { return { ok: true, created: created, skipped: skipped, candidates: members.length }; });
      });
    });
  }
  function myInvoices(ck, memberId) {
    if (!memberId) return Promise.reject({ status: 400, body: { error: "memberId required" } });
    return clubCol(ck, "invoices").where("memberId", "==", String(memberId)).get().then(function (snap) {
      var rows = snap.docs.map(function (d) { return invoiceOut(d.id, d.data()); });
      var outstanding = rows.filter(function (r) { return r.status === "unpaid"; }).reduce(function (n, r) { return n + r.amountCents; }, 0);
      rows.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      return { invoices: rows, outstandingCents: outstanding };
    });
  }

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
            currency: body.currency != null ? String(body.currency) : (s.currency || "ZAR"),
            bankingDetails: "bankingDetails" in body ? (body.bankingDetails ? String(body.bankingDetails) : null) : (s.bankingDetails || null),
            chargeGreenFeeOnBooking: "chargeGreenFeeOnBooking" in body ? !!body.chargeGreenFeeOnBooking : !!s.chargeGreenFeeOnBooking,
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

    if (root === "payments") {
      if (method === "GET" && a === "config") return paymentsConfig(ck);
      if (method === "GET" && a === "mine") return myInvoices(ck, query.get("memberId"));
      if (method === "POST" && a === "issue-dues") return issueDues(ck, body);
      if (a === "fees") {
        if (method === "GET" && rest.length === 2) return listFees(ck);
        if (method === "POST" && rest.length === 2) return createFee(ck, body);
        if (method === "PUT" && rest.length === 3) return updateFee(ck, c, body);
        if (method === "DELETE" && rest.length === 3) return deleteFee(ck, c);
      }
      if (a === "invoices") {
        if (method === "GET" && rest.length === 2) return listInvoices(ck, query);
        if (method === "POST" && rest.length === 2) return createInvoice(ck, body);
        if (method === "POST" && rest[3] === "mark-paid") return markInvoicePaid(ck, c, body);
        if (method === "POST" && rest[3] === "cancel") return cancelInvoice(ck, c);
      }
    }

    return Promise.reject({ status: 404, body: { error: "unknown route: " + method + " /" + root + "/" + rest.join("/") } });
  }


// ---- app entry point (replaces the browser fetch shim) --------------------
// Parse a REST-style path (e.g. "/members/kempton/all?q=foo") and run it against
// Firestore via dispatch(). Returns a fetch-like { ok, status, json() } so the
// existing API clients need almost no change.
var ROOTS = /\/(club|members|bookings|competitions|news|payments)(\/[^?#]*)?(\?[^#]*)?$/;
function makeQuery(qs) {
  var params = {};
  String(qs || "").replace(/^\?/, "").split("&").forEach(function (p) {
    if (!p) return;
    var i = p.indexOf("=");
    var k = decodeURIComponent(i < 0 ? p : p.slice(0, i));
    var v = i < 0 ? "" : decodeURIComponent(p.slice(i + 1).replace(/\+/g, "%20"));
    params[k] = v;
  });
  return { get: function (k) { return Object.prototype.hasOwnProperty.call(params, k) ? params[k] : null; } };
}
export function clubFetch(path, init) {
  var url = String(path || "");
  var m = url.match(ROOTS);
  if (!m) return Promise.reject(new Error("clubFetch: unsupported path " + url));
  var root = m[1];
  var rest = (m[2] || "").replace(/^\/+/, "").split("/").filter(Boolean).map(decodeURIComponent);
  var query = makeQuery(m[3] || "");
  var method = ((init && init.method) || "GET").toUpperCase();
  var body = null;
  var rawBody = init && init.body;
  if (typeof rawBody === "string") { try { body = JSON.parse(rawBody); } catch (e) {} }
  return dispatch(method, root, rest, query, body).then(function (data) {
    return { ok: true, status: 200, json: function () { return Promise.resolve(data); }, text: function () { return Promise.resolve(JSON.stringify(data)); } };
  }).catch(function (err) {
    var status = (err && err.status) || 500;
    var bodyObj = (err && err.body) || { error: (err && err.message) || "Firestore error" };
    if (!(err && err.status)) console.warn("[clubFs] dispatch failed:", err);
    return { ok: false, status: status, json: function () { return Promise.resolve(bodyObj); }, text: function () { return Promise.resolve(JSON.stringify(bodyObj)); } };
  });
}
export var CLUB_FS_ENABLED = true;
