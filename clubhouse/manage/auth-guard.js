// Gate a management page behind the organiser login.
//
// FLAG-AWARE: when the Firestore cutover is ON (FOREAI_DEFAULTS.useFirestore or
// ?fs=1), the page is gated by the FIREBASE session alone — no Render token, no
// /auth calls — so Render can be retired. When it's OFF, this behaves exactly as
// before: it requires the Render organiser token and attaches it to API calls.
//
// Include in a manage page's <head>, AFTER ../config.js and (for the Firestore
// path) the firebase compat SDKs + ../firebase-config.js:
//   <script src="../config.js"></script>
//   <script src="auth-guard.js"></script>
(function () {
  var D = window.FOREAI_DEFAULTS || {};
  var P = new URLSearchParams(location.search);
  var TOKEN_KEY = "foreai.auth.token", USER_KEY = "foreai.auth.user";
  var OWNER_EMAILS = ["marcell.laubscher@outlook.com", "mpower333is@gmail.com"];

  function flagOn() {
    if (P.get("fs") === "1") return true;
    if (P.get("fs") === "0") return false;
    return !!D.useFirestore;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function mountBar() {
    if (document.getElementById("foreai-userbar")) return;
    var u = (window.FOREAI_AUTH && window.FOREAI_AUTH.user) || {};
    var who = u.name || u.email || "organiser";
    var style = document.createElement("style");
    style.textContent =
      "#foreai-userbar{position:fixed;bottom:14px;right:14px;z-index:99998;display:flex;align-items:center;gap:10px;" +
      "background:rgba(8,18,38,.92);border:1px solid #26407A;border-radius:999px;padding:8px 14px;" +
      "font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#B7C6E6;" +
      "-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 4px 16px rgba(0,0,0,.35)}" +
      "#foreai-userbar .fu-who{max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#foreai-userbar .fu-out{color:#F3C33B;font-weight:800;text-decoration:none;cursor:pointer}" +
      "#foreai-userbar .fu-out:hover{text-decoration:underline}";
    document.head.appendChild(style);
    var bar = document.createElement("div");
    bar.id = "foreai-userbar";
    bar.innerHTML = '<span class="fu-who">🔓 ' + esc(who) + '</span><span style="opacity:.5">·</span><a class="fu-out" href="#">Sign out</a>';
    bar.querySelector(".fu-out").addEventListener("click", function (e) { e.preventDefault(); window.FOREAI_AUTH.signOut(); });
    document.body.appendChild(bar);
  }
  function mountBarWhenReady() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBar);
    else mountBar();
  }
  function toSignin() {
    var here = (location.pathname.split("/").pop() || "index.html") + location.search;
    var fs = flagOn() ? "fs=1&" : "";
    location.href = "signin.html?" + fs + "next=" + encodeURIComponent(here);
  }

  // ===================== Firestore path (no Render) =========================
  if (flagOn()) {
    // Hide the page until the Firebase auth state is known (avoid a flash).
    var gate = document.createElement("style");
    gate.id = "foreai-authgate";
    gate.textContent = "body{visibility:hidden !important}";
    (document.head || document.documentElement).appendChild(gate);
    var reveal = function () { var s = document.getElementById("foreai-authgate"); if (s) s.remove(); };

    var signOutFs = function () {
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
      location.href = "signin.html?signout=1";
    };

    var start = function () {
      if (!window.firebase || !window.FIREBASE_CONFIG) { return setTimeout(start, 40); }
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      var auth = firebase.auth(), db = firebase.firestore();
      auth.onAuthStateChanged(function (u) {
        if (!u) { toSignin(); return; }
        var mail = (u.email || "").trim().toLowerCase();
        db.collection("adminUsers").doc(u.uid).get().then(function (s) {
          var d = s.exists ? s.data() : {};
          var isOwner = OWNER_EMAILS.indexOf(mail) >= 0; // hardcoded owners only
          var clubKey = d.clubKey || null;
          window.FOREAI_AUTH = {
            user: { email: mail, name: u.displayName || d.name || null, role: isOwner ? "owner" : (d.role || "organiser"), clubKey: clubKey },
            signOut: signOutFs,
          };
          var REQ = window.FOREAI_REQUIRE_CLUB || null;
          if (REQ && !isOwner && clubKey !== REQ) {
            alert("This page is only available to the " + REQ + " club account.");
            location.href = "index.html"; return;
          }
          reveal(); mountBarWhenReady();
        }).catch(function () {
          // Firestore unreachable — allow a hardcoded owner in, else bounce.
          if (OWNER_EMAILS.indexOf(mail) < 0) { reveal(); location.href = "index.html"; return; }
          window.FOREAI_AUTH = { user: { email: mail, name: u.displayName || null, role: "owner", clubKey: null }, signOut: signOutFs };
          reveal(); mountBarWhenReady();
        });
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
    return; // Firestore path handled — skip the legacy Render logic below.
  }

  // ===================== Legacy Render-token path ===========================
  var API = (P.get("api") || localStorage.getItem("foreai.api") || D.api || "").replace(/\/$/, "");
  var token = localStorage.getItem(TOKEN_KEY);

  if (!token) { toSignin(); return; }

  // Attach the token to every backend API request.
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (API && url.indexOf(API) === 0) {
        init = init || {};
        var h = new Headers(init.headers || (typeof input !== "string" && input && input.headers) || {});
        if (!h.has("Authorization")) h.set("Authorization", "Bearer " + token);
        init.headers = h;
      }
    } catch (e) {}
    return _fetch(input, init);
  };

  var user = {};
  try { user = JSON.parse(localStorage.getItem(USER_KEY) || "{}"); } catch (e) {}

  window.FOREAI_AUTH = {
    token: token,
    user: user,
    signOut: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.href = "signin.html?signout=1";
    },
  };

  mountBarWhenReady();

  var REQUIRE_CLUB = window.FOREAI_REQUIRE_CLUB || null;
  if (REQUIRE_CLUB) {
    var bounce = function () {
      alert("This page is only available to the " + REQUIRE_CLUB + " club account.");
      location.href = "index.html";
    };
    if (user && user.clubKey === REQUIRE_CLUB) {
      // fast path — already known to belong to this club
    } else {
      var style = document.createElement("style");
      style.id = "foreai-clubgate";
      style.textContent = "body{visibility:hidden !important}";
      (document.head || document.documentElement).appendChild(style);
      _fetch(API + "/auth/me", { headers: { Authorization: "Bearer " + token } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var ck = d && d.user && d.user.clubKey;
          if (ck === REQUIRE_CLUB) {
            try { localStorage.setItem(USER_KEY, JSON.stringify(d.user)); } catch (e) {}
            window.FOREAI_AUTH.user = d.user;
            var s = document.getElementById("foreai-clubgate"); if (s) s.remove();
          } else { bounce(); }
        })
        .catch(function () { bounce(); });
    }
  }
})();
