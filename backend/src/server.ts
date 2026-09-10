import express from "express";
import cors from "cors";

import userRoutes from "./routes/users";
import roundRoutes from "./routes/round";
import shotRoutes from "./routes/shots";
import caddieRoutes from "./routes/caddie";
import clubRoutes from "./routes/clubs";
import strategyRoutes from "./routes/strategy";
import tournamentRoutes from "./routes/tournaments";
import weatherRoutes from "./routes/weather";
import pushRoutes from "./routes/push";
import clubSettingsRoutes from "./routes/club";
import memberRoutes from "./routes/members";
import bookingRoutes from "./routes/bookings";
import { startLightningWatcher } from "./lib/lightningWatcher";
import { seedClubs } from "./lib/seedClub";

const app = express();

// Global middleware must run BEFORE the routers so request bodies are parsed
// and CORS headers are applied to every response. (Previously /shots was
// mounted ahead of express.json(), so its handler never saw a parsed body.)
app.use(cors());
// Registrations and event setup carry images as data URLs (logos, sponsor
// artwork, the beneficiary photo), so allow bodies well above the 100kb default.
app.use(express.json({ limit: "8mb" }));

app.get("/", (_req, res) => {
  res.send("ForeAi API Running");
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "foreai-api" });
});

app.use("/users", userRoutes);
app.use("/rounds", roundRoutes);
app.use("/shots", shotRoutes);
app.use("/caddie", caddieRoutes);
app.use("/clubs", clubRoutes);
app.use("/strategy", strategyRoutes);
app.use("/tournaments", tournamentRoutes);
app.use("/weather", weatherRoutes);
app.use("/push", pushRoutes);
// Club "complete package": settings/tee-sheet config, membership roster, tee
// bookings. (/clubs above is the per-user bag of golf clubs — different thing.)
app.use("/club", clubSettingsRoutes);
app.use("/members", memberRoutes);
app.use("/bookings", bookingRoutes);

// Catch-all error handler: a route that throws (e.g. a database hiccup) returns
// a clean 500 instead of leaving the request hanging. Must be registered last.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled route error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Server error" });
});

// A single failing request must never take the whole service down (which shows
// up as a 502 to clients). Log and keep serving — /health stays up so the
// platform doesn't kill an otherwise-healthy instance.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`ForeAi server running on port ${PORT}`);
  // Seed club settings (course + tee hours) so a club app is turnkey on first
  // boot. Idempotent + fail-soft — never blocks startup.
  seedClubs();
  // Start the background lightning watcher (pushes alerts to registered phones
  // even when the app is closed). No-ops when no devices are registered.
  startLightningWatcher();
});

export default app;
