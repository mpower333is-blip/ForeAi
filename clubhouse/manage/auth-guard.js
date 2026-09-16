// Gate a management page behind the organiser login, and attach the organiser
// token to every backend request so signing in replaces typing an admin PIN.
//
// Include it in a manage page's <head>, AFTER ../config.js:
//   <script src="../config.js"></script>
//   <script src="auth-guard.js"></script>
(function () {
  var D = window.FOREAI_DEFAULTS || {};
  var P = new URLSearchParams(location.search);
  var API = (P.get("api") || localStorage.getItem("foreai.api") || D.api || "").replace(/\/$/, "");
  var TOKEN_KEY = "foreai.auth.token", USER_KEY = "foreai.auth.user";
  var token = localStorage.getItem(TOKEN_KEY);

  // Not signed in → go to the sign-in page and come back here afterwards.
  if (!token) {
    var here = (location.pathname.split("/").pop() || "index.html") + location.search;
    location.href = "signin.html?next=" + encodeURIComponent(here);
    return;
  }

  // Attach the token to every backend API request (so admin actions are
  // authorised by the login instead of a PIN). Leaves non-API requests alone.
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
      // ?signout=1 tells the sign-in page to also end the Firebase session,
      // otherwise it would silently re-exchange it and sign us back in.
      location.href = "signin.html?signout=1";
    },
  };

  // Optional club gate: a page can require a specific club account by setting
  //   <script>window.FOREAI_REQUIRE_CLUB = 'kempton';</script>
  // BEFORE this script. Only an organiser whose account carries that clubKey may
  // see the page; everyone else is bounced back to the management hub. The DB is
  // the source of truth, so a stale local copy is re-checked against /auth/me
  // before blocking (and refreshed if the account was just granted access).
  // Inject a small "signed in as … · Sign out" bar so an organiser can sign out
  // from any management page (bottom-right, clear of the back button/toolbars).
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mountBar() {
    if (document.getElementById("foreai-userbar")) return;
    var u = window.FOREAI_AUTH.user || {};
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBar);
  else mountBar();

  var REQUIRE_CLUB = window.FOREAI_REQUIRE_CLUB || null;
  if (REQUIRE_CLUB) {
    var bounce = function () {
      alert("This page is only available to the " + REQUIRE_CLUB + " club account.");
      location.href = "index.html";
    };
    if (user && user.clubKey === REQUIRE_CLUB) {
      // fast path — already known to belong to this club
    } else {
      // Hide the page while we confirm with the backend, to avoid a content flash.
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
          } else {
            bounce();
          }
        })
        .catch(function () { bounce(); });
    }
  }
})();
