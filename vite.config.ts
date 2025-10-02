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
      
      // Try to connect to MongoDB in the background (non-blocking)
      (async () => {
        try {
          const connectDB = (await import("./shared/db")).default;
          await connectDB();
          
          // Initialize admin accounts after MongoDB connection
          const { AdminService } = await import("./server/utils/admin-service");
          await AdminService.initializeAdminAccounts();
          
          // Initialize escalation service
          const { EscalationService } = await import("./server/utils/escalation-service");
          EscalationService.initialize();
          EscalationService.startEscalationMonitoring();
          
        } catch (error) {
          console.error("❌ MongoDB connection failed in dev mode:", error.message);
          console.log("⚠️  Continuing with in-memory storage for development");
        }
      })();
      
      const { createServer } = await import("./server");
      const { app } = createServer();
      
      // Add debugging middleware
      app.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          console.log(`📡 API Request: ${req.method} ${req.url}`);
        }
        next();
      });

      // Only add Express app for API routes - let Vite handle everything else
      server.middlewares.use('/api', app);
      
      console.log("✅ Express server integrated with Vite (API routes only)");
    },
  };
}
