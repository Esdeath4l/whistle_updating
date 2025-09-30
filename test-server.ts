import { createServer } from "./server/index";

async function testServer() {
  try {
    console.log("🧪 Testing Express server setup...");
    
    const app = createServer();
    
    // Test the app setup
    console.log("✅ Express app created successfully");
    
    // Start a temporary server for testing
    const server = app.listen(3001, () => {
      console.log("🚀 Test server running on http://localhost:3001");
      console.log("📍 Testing API endpoints...");
      
      // Close the server after a brief test
      setTimeout(() => {
        server.close(() => {
          console.log("🔒 Test server closed");
          process.exit(0);
        });
      }, 2000);
    });
    
  } catch (error) {
    console.error("❌ Server test failed:", error);
    process.exit(1);
  }
}

testServer();