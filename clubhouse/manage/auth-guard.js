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
