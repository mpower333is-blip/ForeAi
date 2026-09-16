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

  window.FOREAI_AUTH = {
    token: token,
    user: JSON.parse(localStorage.getItem(USER_KEY) || "{}"),
    signOut: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.href = "signin.html";
    },
  };
})();
