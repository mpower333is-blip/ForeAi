// Shared defaults for the ForeAi clubhouse web pages.
//
// Set these ONCE (after you deploy the backend) and every page — hub, register,
// office, board, get — picks them up as its default. Then nobody has to type the
// backend URL or event code; a plain link to any page just works.
//
// Precedence on each page:  ?api=/?code= in the URL  >  saved (this device)  >  these defaults.
window.FOREAI_DEFAULTS = {
  api: "https://foreai-backend.onrender.com", // the live ForeAi backend
  code: "3YG6JS", // ECS Golf Day — 15 Oct 2026 (pre-selects the event)
};
