import path from "path";
import { createServer } from "./index";
import * as express from "express";
import connectDB from "../shared/db";
import dotenv from "dotenv";
import { initializeEscalationMonitoring } from "./utils/escalation";

dotenv.config();

const port = process.env.PORT || 3000;

async function startServer() {
  console.log("🚀 Starting Whistle server with enhanced features...");
  
  await connectDB(); // Connect to MongoDB first
  console.log("✅ Database connected");
  
  const { app, initializeSocketIO } = createServer();

  // Serve SPA
  const __dirname = import.meta.dirname;
  const distPath = path.join(__dirname, "../spa");
  app.app.use(express.static(distPath));

  app.app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  const server = app.app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📱 Frontend: http://localhost:${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
    
    // Initialize Socket.io for real-time notifications
    const httpServer = server;
    initializeSocketIO(httpServer);
    console.log("✅ Real-time notifications initialized");
    
    // Initialize automated escalation monitoring
    initializeEscalationMonitoring();
    console.log("✅ Escalation monitoring initialized");
    
    console.log("🎯 All enhanced features activated!");
  });
}

startServer();
