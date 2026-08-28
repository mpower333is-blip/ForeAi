import express from "express";
import cors from "cors";

import userRoutes from "./routes/users";
import roundRoutes from "./routes/round";
import shotRoutes from "./routes/shots";
import caddieRoutes from "./routes/caddie";
import clubRoutes from "./routes/clubs";
import strategyRoutes from "./routes/strategy";
import tournamentRoutes from "./routes/tournaments";

const app = express();

// Global middleware must run BEFORE the routers so request bodies are parsed
// and CORS headers are applied to every response. (Previously /shots was
// mounted ahead of express.json(), so its handler never saw a parsed body.)
app.use(cors());
app.use(express.json());

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
});

export default app;
