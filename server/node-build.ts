import path from "path";
import { createServer } from "./index";
import * as express from "express";
import connectDB from "../shared/db";
import dotenv from "dotenv";

dotenv.config();

const port = process.env.PORT || 3000;

async function startServer() {
  await connectDB(); // Connect to MongoDB first
  const app = createServer();

  // Serve SPA
  const __dirname = import.meta.dirname;
  const distPath = path.join(__dirname, "../spa");
  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📱 Frontend: http://localhost:${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
  });
}

startServer();
