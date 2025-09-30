import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      console.log("🔧 Setting up Express server in Vite dev mode...");
      
      // Simple express setup without complex imports during vite startup
      const express = await import("express");
      const cors = await import("cors");
      
      const app = express.default();
      app.use(cors.default());
      app.use(express.default.json({ limit: "50mb" }));
      
      // Basic health check route
      app.get("/api/ping", (req, res) => {
        res.json({ message: "Server is running" });
      });
      
      // Add debugging middleware
      app.use((req, res, next) => {
        if (req.path.startsWith("/api/")) {
          console.log(`🔍 API Request: ${req.method} ${req.path}`);
        }
        next();
      });
      
      // Use vite's middleware
      server.middlewares.use(app);
    },
  };
}