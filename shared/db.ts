import mongoose, { Connection } from 'mongoose';

/**
 * MongoDB Connection Configuration for Whistle Project
 * 
 * This module handles the MongoDB connection using Mongoose with proper
 * error handling, connection pooling, and TypeScript support.
 */

// Connection state tracking to prevent multiple connections
let isConnected: boolean = false;

/**
 * MongoDB Connection Options
 * Optimized for production use with connection pooling and timeouts
 */
const mongooseOptions = {
  // Connection pool settings
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  
  // Timeout settings
  connectTimeoutMS: 10000, // How long to wait when trying to connect before timing out
  
  // Heartbeat settings
  heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
  
  // Retry settings
  retryWrites: true, // Retry failed writes
  retryReads: true, // Retry failed reads
};

/**
 * Connect to MongoDB using Mongoose
 * 
 * Features:
 * - Singleton pattern to prevent multiple connections
 * - Comprehensive error handling with detailed logging
 * - Production-ready connection options
 * - Environment variable validation
 * 
 * @returns Promise<void>
 * @throws Error if MONGODB_URI is not defined or connection fails
 */
const connectDB = async (): Promise<void> => {
  try {
    // Prevent multiple connections
    if (isConnected) {
      console.log('📡 Using existing MongoDB connection');
      return;
    }

    // Validate environment variable
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error(
        '❌ MONGODB_URI environment variable is not defined. ' +
        'Please set MONGODB_URI in your .env file.\n' +
        'Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database'
      );
    }

    console.log('🔄 Connecting to MongoDB...');
    
    // Establish connection with options
    const connection = await mongoose.connect(mongoUri, mongooseOptions);
    
    // Update connection state
    isConnected = true;
    
    // Success logging with connection details (consolidated)
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${connection.connection.name} | Host: ${connection.connection.host}:${connection.connection.port} | State: ${connection.connection.readyState}`);

    // Initialize GridFS after successful connection
    try {
      const { initializeGridFSBucket } = await import('../server/utils/gridfs');
      await initializeGridFSBucket();
    } catch (gridfsError) {
      console.error('⚠️  GridFS initialization failed:', gridfsError);
      console.log('📁 File uploads will fall back to disk storage');
    }

    // Connection event listeners for monitoring
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
      isConnected = false;
    });

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      try {
        console.log('🔌 MongoDB disconnected, cleaning up GridFS...');
        await mongoose.connection.close();
        console.log('🔒 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    
    // Enhanced error logging for common issues
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND')) {
        console.error('🌐 Network Error: Unable to resolve MongoDB host. Check your internet connection and MongoDB URI.');
      } else if (error.message.includes('authentication failed')) {
        console.error('🔐 Authentication Error: Invalid MongoDB credentials. Check your username and password.');
      } else if (error.message.includes('timeout')) {
        console.error('⏰ Timeout Error: MongoDB connection timed out. Check your network and MongoDB cluster status.');
      }
    }
    
    // Exit process on connection failure
    process.exit(1);
  }
};

/**
 * Get the current connection state
 * @returns boolean - true if connected, false otherwise
 */
export const isMongoConnected = (): boolean => {
  return isConnected && mongoose.connection.readyState === 1;
};

/**
 * Get MongoDB connection statistics
 * @returns Object with connection details
 */
export const getConnectionStats = () => {
  const conn = mongoose.connection;
  return {
    readyState: conn.readyState,
    host: conn.host,
    port: conn.port,
    name: conn.name,
    collections: Object.keys(conn.collections),
    isConnected: isMongoConnected(),
  };
};

/**
 * Gracefully close the MongoDB connection
 * @returns Promise<void>
 */
export const disconnectDB = async (): Promise<void> => {
  try {
    if (isConnected) {
      await mongoose.connection.close();
      isConnected = false;
      console.log('🔒 MongoDB connection closed gracefully');
    }
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    throw error;
  }
};

// Export the default mongoose connection for use in models
export const mongooseConnection: Connection = mongoose.connection;

// Default export for backwards compatibility
export default connectDB;
