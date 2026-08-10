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

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`ForeAi server running on port ${PORT}`);
});

export default app;
