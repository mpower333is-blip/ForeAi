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
  // Matchmaking: active members ranked by handicap proximity to the requester
  // (or an explicit `near` index). Returns card-safe fields only (no email/cell).
  function suggestPlayers(ck, opts) {
    var memberId = opts && opts.memberId ? String(opts.memberId) : "";
    var nearRaw = opts && opts.near != null && opts.near !== "" ? Number(opts.near) : NaN;
    var limit = Math.max(1, Math.min(50, Number(opts && opts.limit) || 12));
    return listMembers(ck, "").then(function (rows) {
      var me = memberId ? rows.filter(function (m) { return m.id === memberId; })[0] : null;
      var near = Number.isFinite(nearRaw) ? nearRaw : (me && me.handicapIndex != null ? Number(me.handicapIndex) : null);
      var out = rows.filter(function (m) {
        return (m.status || "active") === "active" && m.id !== memberId;
      }).map(function (m) {
        var h = m.handicapIndex == null ? null : Number(m.handicapIndex);
        var delta = (near != null && h != null) ? Math.abs(h - near) : null;
        return { id: m.id, name: ((m.firstName || "") + " " + (m.lastName || "")).trim(), memberNumber: m.memberNumber || null, handicapIndex: h, delta: delta };
      });
      out.sort(function (a, b) {
        if (a.delta == null && b.delta == null) return String(a.name).localeCompare(String(b.name));
        if (a.delta == null) return 1;
        if (b.delta == null) return -1;
        return a.delta - b.delta;
      });
      return out.slice(0, limit);
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

  // Member app: verify identity (number + email OR surname) and bind this device.
  // The Firestore rules only permit a member to change the deviceId field.
  function claimMember(ck, b) {
    var number = b && b.memberNumber ? String(b.memberNumber).trim() : "";
    if (!number) return Promise.reject({ status: 400, body: { error: "memberNumber required" } });
    return findMemberByNumber(ck, number).then(function (doc) {
      if (!doc) return Promise.reject({ status: 404, body: { error: "No member with that number" } });
      var m = doc.data();
      var email = b.email ? String(b.email).trim().toLowerCase() : "";
      var lastName = b.lastName ? String(b.lastName).trim().toLowerCase() : "";
      var okEmail = email && m.email && email === String(m.email).toLowerCase();
      var okName = lastName && m.lastName && lastName === String(m.lastName).toLowerCase();
      if (!okEmail && !okName) return Promise.reject({ status: 403, body: { error: "Details don't match our records" } });
      var deviceId = b.deviceId ? String(b.deviceId) : null;
      var out = memberOut(doc.id, ck, Object.assign({}, m, deviceId ? { deviceId: deviceId } : {}));
      // Sign in, bind the device (if given), and link any shared-directory entries
      // that share this member's phone so they can "select themselves". Linking is
      // best-effort — never fail the claim over it.
      return ensureSignedIn()
        .then(function () { return deviceId ? doc.ref.update({ deviceId: deviceId }) : null; })
        .then(function () { return linkPlayerToMember(ck, m, doc.id); })
        .then(function () { return out; });
    });
  }

  // ---- players (shared club buddy directory) --------------------------------
  // A club-wide directory of playing partners. When you build a 4-ball you can
  // pick someone already in here or add a new name + phone; new people are saved
  // so every member can reuse them next time. Deduped by phone number. When a
  // person later links their membership (claim) with the SAME phone, their
  // directory entry is tied to that member — so they "select themselves" as the
  // real member rather than a typed-in guest.
  function normPhone(s) { return String(s == null ? "" : s).replace(/[^0-9]/g, ""); }
  function playerOut(id, ck, p) {
    return {
      id: id, clubKey: ck, name: p.name || "", phone: p.phone || "",
      memberId: p.memberId || null, memberNumber: p.memberNumber || null,
    };
  }
  function findPlayerByPhone(ck, phone) {
    var digits = normPhone(phone);
    if (!digits) return Promise.resolve(null);
    return clubCol(ck, "players").where("phoneKey", "==", digits).get()
      .then(function (s) { return s.empty ? null : s.docs[0]; });
  }
  function listPlayers(ck, q) {
    return clubCol(ck, "players").get().then(function (snap) {
      var rows = snap.docs.map(function (d) { return playerOut(d.id, ck, d.data()); });
      if (q) {
        var needle = String(q).toLowerCase();
        var digits = normPhone(q);
        rows = rows.filter(function (p) {
          return (p.name && p.name.toLowerCase().indexOf(needle) >= 0) ||
                 (digits && normPhone(p.phone).indexOf(digits) >= 0);
        });
      }
      rows.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
      return rows;
    });
  }
  function upsertPlayer(ck, b) {
    var name = b && b.name ? String(b.name).trim() : "";
    var phone = b && b.phone ? String(b.phone).trim() : "";
    if (!name) return Promise.reject({ status: 400, body: { error: "name required" } });
    var digits = normPhone(phone);
    return ensureSignedIn().then(function () {
      // No phone → can't dedupe, so just add the name.
      if (!digits) {
        var rec0 = { name: name, phone: phone, phoneKey: "", memberId: null, memberNumber: null, createdAt: Date.now() };
        return clubCol(ck, "players").add(rec0).then(function (ref) { return playerOut(ref.id, ck, rec0); });
      }
      return findPlayerByPhone(ck, digits).then(function (doc) {
        if (doc) {
          return doc.ref.update({ name: name, phone: phone })
            .then(function () { return playerOut(doc.id, ck, Object.assign({}, doc.data(), { name: name, phone: phone })); });
        }
        var rec = { name: name, phone: phone, phoneKey: digits, memberId: null, memberNumber: null, createdAt: Date.now() };
        return clubCol(ck, "players").add(rec).then(function (ref) { return playerOut(ref.id, ck, rec); });
      });
    });
  }
  // Link a directory entry with this member's phone to the member (best-effort).
  function linkPlayerToMember(ck, member, memberId) {
    var digits = normPhone(member && member.cell);
    if (!digits) return Promise.resolve();
    return findPlayerByPhone(ck, digits).then(function (doc) {
      if (!doc) return null;
      return doc.ref.update({ memberId: memberId, memberNumber: member.memberNumber || null });
    }).catch(function () { return null; });
  }

  // ---- bookings --------------------------------------------------------------
  function bookingOut(id, ck, b) {
    var members = Array.isArray(b.members) ? b.members : [];
    var max = b.maxPlayers || b.partySize || 1;
    return {
      id: id, clubKey: ck, teeAt: b.teeAt || new Date(b.teeMs || Date.now()).toISOString(), courseId: b.courseId || "",
      memberId: b.memberId || null, partySize: b.partySize || 1, players: Array.isArray(b.players) ? b.players : null,
      note: b.note || null, status: b.status || "booked",
      // Open game (Playtomic-style): host reserves the 4-ball and members join the
      // open spots. `members` carries each joined player + handicap for matching.
      open: !!b.open, maxPlayers: max, hostMemberId: b.hostMemberId || b.memberId || null,
      members: members, openSpots: b.open ? Math.max(0, max - members.length) : 0,
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

  // Member app: book a tee time. Mirrors backend/routes/bookings.ts (validate the
  // slot, open day, booking window, capacity, no double-booking).
  function createBooking(ck, b) {
    return getSettings(ck).then(function (s) {
      var memberId = b && b.memberId ? String(b.memberId) : "";
      var date = b && b.date ? String(b.date).slice(0, 10) : "";
      var minute = Number(b && b.minute);
      // An open game reserves the whole 4-ball (maxPlayers seats), then members
      // join the open spots; a normal booking just reserves its party size.
      var isOpen = !!(b && b.open);
      var partySize = isOpen
        ? Math.max(2, Math.min(s.slotCapacity, Number(b && b.maxPlayers) || s.slotCapacity))
        : Math.max(1, Math.min(s.slotCapacity, Number(b && b.partySize) || 1));
      if (!memberId || !date || !Number.isFinite(minute)) return Promise.reject({ status: 400, body: { error: "memberId, date and minute required" } });
      return clubCol(ck, "members").doc(memberId).get().then(function (msnap) {
        if (!msnap.exists) return Promise.reject({ status: 404, body: { error: "Member not found" } });
        var member = msnap.data();
        if (member.status !== "active") return Promise.reject({ status: 403, body: { error: "Membership is not active" } });
        var aligned = minute >= s.firstTeeMin && minute <= s.lastTeeMin && (minute - s.firstTeeMin) % s.intervalMin === 0;
        if (!aligned) return Promise.reject({ status: 400, body: { error: "Not a valid tee time" } });
        var openDays = String(s.openDays).split(",").map(function (x) { return Number(x.trim()); });
        if (openDays.indexOf(weekday(date)) < 0) return Promise.reject({ status: 400, body: { error: "The course is closed that day" } });
        var daysAhead = Math.round((slotMs(date, 0) - slotMs(todayStrSAST(), 0)) / 86400000);
        if (daysAhead < 0) return Promise.reject({ status: 400, body: { error: "That day has passed" } });
        if (daysAhead > s.bookingWindowDays) return Promise.reject({ status: 400, body: { error: "Bookings open " + s.bookingWindowDays + " days ahead" } });
        var ms = slotMs(date, minute);
        return clubCol(ck, "bookings").where("teeMs", "==", ms).get().then(function (snap) {
          var existing = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function (e) { return e.status === "booked" || e.status === "blocked"; });
          if (existing.some(function (e) { return e.status === "blocked"; })) return Promise.reject({ status: 409, body: { error: "That slot is blocked" } });
          if (existing.some(function (e) { return e.memberId === memberId; })) return Promise.reject({ status: 409, body: { error: "You already have this slot" } });
          var seats = existing.reduce(function (n, e) { return n + (e.partySize || 1); }, 0);
          if (seats + partySize > s.slotCapacity) return Promise.reject({ status: 409, body: { error: "Only " + (s.slotCapacity - seats) + " seat(s) left in that slot" } });
          var hostName = ((member.firstName || "") + " " + (member.lastName || "")).trim();
          var rec;
          if (isOpen) {
            var hostEntry = { memberId: memberId, name: hostName, handicapIndex: member.handicapIndex == null ? null : member.handicapIndex };
            rec = { teeMs: ms, teeAt: new Date(ms).toISOString(), courseId: s.courseId || "", memberId: memberId, partySize: partySize, players: [hostName], note: b.note ? String(b.note) : null, status: "booked", open: true, maxPlayers: partySize, hostMemberId: memberId, members: [hostEntry], createdAt: Date.now() };
          } else {
            var players = Array.isArray(b.players) ? b.players.map(String).slice(0, partySize) : [hostName];
            rec = { teeMs: ms, teeAt: new Date(ms).toISOString(), courseId: s.courseId || "", memberId: memberId, partySize: partySize, players: players, note: b.note ? String(b.note) : null, status: "booked", createdAt: Date.now() };
          }
          return ensureSignedIn().then(function () { return clubCol(ck, "bookings").add(rec); }).then(function (ref) { return bookingOut(ref.id, ck, rec); });
        });
      });
    });
  }

  // ---- open games (Playtomic-style social matchmaking) -----------------------
  // An open game is a booking the host posted with open spots. Members join
  // instantly until the 4-ball is full; handicaps travel with each player so the
  // board can be filtered/matched by level.
  function listOpenGames(ck) {
    var now = Date.now();
    return clubCol(ck, "bookings").where("open", "==", true).get().then(function (snap) {
      return snap.docs.map(function (d) { return bookingOut(d.id, ck, d.data()); })
        .filter(function (g) { return g.status === "booked" && Date.parse(g.teeAt) >= now && g.openSpots > 0; })
        .sort(function (a, b) { return Date.parse(a.teeAt) - Date.parse(b.teeAt); });
    });
  }
  function joinOpenGame(ck, id, b) {
    var memberId = b && b.memberId ? String(b.memberId) : "";
    if (!memberId) return Promise.reject({ status: 400, body: { error: "memberId required" } });
    var ref = clubCol(ck, "bookings").doc(id);
    return ref.get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Game not found" } });
      var bk = s.data();
      if (bk.status !== "booked" || !bk.open) return Promise.reject({ status: 409, body: { error: "That game isn't open" } });
      var members = Array.isArray(bk.members) ? bk.members.slice() : [];
      var max = bk.maxPlayers || bk.partySize || 4;
      if (members.some(function (m) { return String(m.memberId) === memberId; })) return Promise.reject({ status: 409, body: { error: "You're already in this game" } });
      if (members.length >= max) return Promise.reject({ status: 409, body: { error: "This game is full" } });
      return clubCol(ck, "members").doc(memberId).get().then(function (msnap) {
        if (!msnap.exists) return Promise.reject({ status: 404, body: { error: "Member not found" } });
        var member = msnap.data();
        if (member.status !== "active") return Promise.reject({ status: 403, body: { error: "Membership is not active" } });
        var name = ((member.firstName || "") + " " + (member.lastName || "")).trim();
        members.push({ memberId: memberId, name: name, handicapIndex: member.handicapIndex == null ? null : member.handicapIndex });
        var players = members.map(function (m) { return m.name; });
        return ensureSignedIn().then(function () { return ref.update({ members: members, players: players }); })
          .then(function () { return bookingOut(id, ck, Object.assign({}, bk, { members: members, players: players })); });
      });
    });
  }
  function leaveOpenGame(ck, id, b) {
    var memberId = b && b.memberId ? String(b.memberId) : "";
    if (!memberId) return Promise.reject({ status: 400, body: { error: "memberId required" } });
    var ref = clubCol(ck, "bookings").doc(id);
    return ref.get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Game not found" } });
      var bk = s.data();
      if (String(bk.hostMemberId || bk.memberId) === memberId) return Promise.reject({ status: 400, body: { error: "You're the host — cancel the game instead" } });
      var members = (Array.isArray(bk.members) ? bk.members : []).filter(function (m) { return String(m.memberId) !== memberId; });
      var players = members.map(function (m) { return m.name; });
      return ensureSignedIn().then(function () { return ref.update({ members: members, players: players }); })
        .then(function () { return bookingOut(id, ck, Object.assign({}, bk, { members: members, players: players })); });
    });
  }

  // ---- game invites (invite/notify a member to an open game) -----------------
  // An invite is a Firestore doc addressed to a member. They see it in their
  // in-app invites inbox and Accept (instant-join) or Decline. (A push Cloud
  // Function on this collection could later also ping their phone.)
  function createInvites(ck, b) {
    var gameId = b && b.gameId ? String(b.gameId) : "";
    var fromMemberId = b && b.fromMemberId ? String(b.fromMemberId) : "";
    var toIds = Array.isArray(b && b.toMemberIds) ? b.toMemberIds.map(String) : (b && b.toMemberId ? [String(b.toMemberId)] : []);
    if (!gameId || !fromMemberId || toIds.length === 0) return Promise.reject({ status: 400, body: { error: "gameId, fromMemberId and toMemberIds required" } });
    var gref = clubCol(ck, "bookings").doc(gameId);
    return gref.get().then(function (gs) {
      if (!gs.exists) return Promise.reject({ status: 404, body: { error: "Game not found" } });
      var g = gs.data();
      if (g.status !== "booked" || !g.open) return Promise.reject({ status: 409, body: { error: "That game isn't open" } });
      var inGame = (Array.isArray(g.members) ? g.members : []).map(function (m) { return String(m.memberId); });
      return clubCol(ck, "members").doc(fromMemberId).get().then(function (ms) {
        var fromName = ms.exists ? (((ms.data().firstName || "") + " " + (ms.data().lastName || "")).trim()) : "A member";
        return clubCol(ck, "invites").where("gameId", "==", gameId).get().then(function (inv) {
          var pending = {};
          inv.forEach(function (d) { var r = d.data(); if (r.status === "pending") pending[String(r.toMemberId)] = true; });
          var targets = toIds.filter(function (id) { return id !== fromMemberId && inGame.indexOf(id) < 0 && !pending[id]; });
          if (targets.length === 0) return { ok: true, invited: 0 };
          var chain = ensureSignedIn();
          targets.forEach(function (id) {
            chain = chain.then(function () {
              return clubCol(ck, "invites").add({ gameId: gameId, teeAt: g.teeAt || null, teeMs: g.teeMs || null, courseId: g.courseId || "", fromMemberId: fromMemberId, fromName: fromName, toMemberId: id, status: "pending", createdAt: Date.now() });
            });
          });
          return chain.then(function () { return { ok: true, invited: targets.length }; });
        });
      });
    });
  }
  function listMyInvites(ck, memberId) {
    if (!memberId) return Promise.reject({ status: 400, body: { error: "memberId required" } });
    var now = Date.now();
    return clubCol(ck, "invites").where("toMemberId", "==", String(memberId)).get().then(function (snap) {
      var pending = snap.docs.map(function (d) { return { id: d.id, data: d.data() }; }).filter(function (x) { return x.data.status === "pending"; });
      return Promise.all(pending.map(function (x) {
        return clubCol(ck, "bookings").doc(x.data.gameId).get().then(function (gs) {
          if (!gs.exists) return null;
          var g = bookingOut(gs.id, ck, gs.data());
          if (g.status !== "booked" || !g.open || Date.parse(g.teeAt) < now) return null;
          return { id: x.id, gameId: x.data.gameId, teeAt: g.teeAt, fromName: x.data.fromName || "A member", openSpots: g.openSpots, players: (g.members || []).map(function (m) { return m.name; }) };
        });
      })).then(function (rows) {
        return rows.filter(function (r) { return !!r; }).sort(function (a, b) { return Date.parse(a.teeAt) - Date.parse(b.teeAt); });
      });
    });
  }
  function listGameInvites(ck, gameId) {
    return clubCol(ck, "invites").where("gameId", "==", String(gameId)).get().then(function (snap) {
      return snap.docs.map(function (d) { var r = d.data(); return { id: d.id, toMemberId: String(r.toMemberId), status: r.status || "pending" }; });
    });
  }
  function respondInvite(ck, id, b) {
    var memberId = b && b.memberId ? String(b.memberId) : "";
    var accept = !!(b && b.accept);
    var ref = clubCol(ck, "invites").doc(id);
    return ref.get().then(function (s) {
      if (!s.exists) return Promise.reject({ status: 404, body: { error: "Invite not found" } });
      var inv = s.data();
      if (memberId && String(inv.toMemberId) !== memberId) return Promise.reject({ status: 403, body: { error: "Not your invite" } });
      if (!accept) {
        return ensureSignedIn().then(function () { return ref.update({ status: "declined" }); }).then(function () { return { ok: true, status: "declined" }; });
      }
      return joinOpenGame(ck, inv.gameId, { memberId: inv.toMemberId }).then(function () {
        return ref.update({ status: "accepted" }).then(function () { return { ok: true, status: "accepted" }; });
      });
    });
  }

  // ---- push tokens (for invite notifications) --------------------------------
  // The member app stores its Expo push token here so the Cloud Function can push
  // an invite to their phone. arrayUnion keeps multiple devices without a read
  // (the pushTokens rule blocks client reads — only the Admin SDK reads them).
  function savePushToken(ck, b) {
    var memberId = b && b.memberId ? String(b.memberId) : "";
    var token = b && b.token ? String(b.token) : "";
    if (!memberId || !token) return Promise.reject({ status: 400, body: { error: "memberId and token required" } });
    var rec = { tokens: firebase.firestore.FieldValue.arrayUnion(token), platform: b.platform ? String(b.platform) : null, updatedAt: Date.now() };
    return ensureSignedIn().then(function () { return clubCol(ck, "pushTokens").doc(memberId).set(rec, { merge: true }); }).then(function () { return { ok: true }; });
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
  function paymentsCheckout(ck, b) {
    var invoiceId = b && b.invoiceId ? String(b.invoiceId) : "";
    if (!invoiceId) return Promise.reject({ status: 400, body: { error: "invoiceId required" } });
    return Promise.all([getSettings(ck), clubCol(ck, "invoices").doc(invoiceId).get()]).then(function (r) {
      var s = r[0], inv = r[1];
      if (!inv.exists) return Promise.reject({ status: 404, body: { error: "Invoice not found" } });
      var d = inv.data();
      if (d.status === "paid") return Promise.reject({ status: 409, body: { error: "Already paid" } });
      if (d.status === "cancelled") return Promise.reject({ status: 409, body: { error: "Invoice cancelled" } });
      // No server-side PayFast in Firestore mode — members pay by EFT with the reference.
      return { mode: "manual", banking: s.bankingDetails || null, reference: d.number, amountCents: d.amountCents, currency: s.currency || "ZAR" };
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
      if (method === "GET" && a === "suggest") return suggestPlayers(ck, { memberId: query.get("memberId"), near: query.get("near"), limit: query.get("limit") });
      if (method === "POST" && rest.length === 1) return createMember(ck, body);
      if (method === "POST" && a === "claim") return claimMember(ck, body);
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

    if (root === "players") {
      if (method === "GET" && rest.length === 1) return listPlayers(ck, query.get("q") || "");
      if (method === "POST" && rest.length === 1) return upsertPlayer(ck, body);
    }

    if (root === "invites") {
      if (method === "POST" && rest.length === 1) return createInvites(ck, body);
      if (method === "GET" && rest.length === 1) return query.get("gameId") ? listGameInvites(ck, query.get("gameId")) : listMyInvites(ck, query.get("memberId"));
      if (method === "POST" && c === "respond") return respondInvite(ck, id, body);
    }

    if (root === "push") {
      if (method === "POST" && rest.length === 1) return savePushToken(ck, body);
    }

    if (root === "bookings") {
      if (method === "POST" && rest.length === 1) return createBooking(ck, body);
      if (method === "GET" && a === "slots") return daySlots(ck, query.get("date"));
      if (method === "GET" && a === "day") return dayBookings(ck, query.get("date"));
      if (method === "GET" && a === "open") return listOpenGames(ck);
      if (method === "POST" && a === "block") return blockSlot(ck, body);
      if (method === "POST" && c === "cancel") return cancelBooking(ck, id, body);
      if (method === "POST" && c === "join") return joinOpenGame(ck, id, body);
      if (method === "POST" && c === "leave") return leaveOpenGame(ck, id, body);
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
      if (method === "POST" && a === "checkout") return paymentsCheckout(ck, body);
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
var ROOTS = /\/(club|members|players|bookings|invites|push|competitions|news|payments)(\/[^?#]*)?(\?[^#]*)?$/;
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
