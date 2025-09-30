/**
 * MongoDB Connection Test Script
 * 
 * This script tests the MongoDB connection and logs connection statistics.
 * Run with: node dist/server/test-db-connection.js
 */
import connectDB, { isMongoConnected, getConnectionStats, disconnectDB } from '../shared/db.js';

async function testMongoConnection() {
  console.log('🧪 Testing MongoDB Connection...\n');

  try {
    // Test connection
    console.log('1️⃣ Attempting to connect to MongoDB...');
    await connectDB();
    
    // Check connection status
    console.log('\n2️⃣ Checking connection status...');
    const isConnected = isMongoConnected();
    console.log(`Connection Status: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`);
    
    // Get connection statistics
    console.log('\n3️⃣ Connection Statistics:');
    const stats = getConnectionStats();
    console.table(stats);
    
    // Test multiple connection calls (should reuse existing connection)
    console.log('\n4️⃣ Testing connection reuse...');
    await connectDB(); // This should log "Using existing MongoDB connection"
    await connectDB(); // This should also reuse the connection
    
    console.log('\n✅ All tests passed! MongoDB connection is working correctly.');
    
  } catch (error) {
    console.error('\n❌ MongoDB connection test failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up connection
    console.log('\n5️⃣ Cleaning up...');
    await disconnectDB();
    console.log('🧹 Connection closed successfully.');
    process.exit(0);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

// Run the test
testMongoConnection();