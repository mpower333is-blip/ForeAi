import express from "express";
import cors from "cors";
import shotRoutes from "./routes/shots";
import caddieRoutes from "./routes/caddie";
import clubRoutes from "./routes/clubs";
import strategyRoutes from "./routes/strategy";

const app = express();

app.use("/shots",shotRoutes);
app.use(cors());
app.use(express.json());
app.use("/caddie", caddieRoutes);
app.use("/clubs",clubRoutes);
app.use("/strategy",strategyRoutes);

app.get("/", (req,res)=>{
  res.send("ForeAi API Running");
});

app.listen(5000,()=>{
 console.log("Server running on port 5000");
});