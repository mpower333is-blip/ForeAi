// Shared defaults for the ForeAi clubhouse web pages.
//
// Set these ONCE (after you deploy the backend) and every page — hub, register,
// office, board, get — picks them up as its default. Then nobody has to type the
// backend URL or event code; a plain link to any page just works.
//
// Precedence on each page:  ?api=/?code= in the URL  >  saved (this device)  >  these defaults.
window.FOREAI_DEFAULTS = {
  api: "https://foreai-backend.onrender.com", // the live ForeAi backend
  code: "", // Intentionally blank — don't expose the event code in a public file.
            // Share the registration link with ?code=... instead, and the office
            // page asks the organiser to type the code (kept off the site).
};
