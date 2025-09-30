import mongoose from 'mongoose';
import connectDB from '../shared/db';
import AdminModel, { AdminRole } from '../shared/models/Admin';
import ReportModel from '../shared/models/report';
import AlertModel from '../shared/models/Alert';
import { AuthService } from './utils/auth';

/**
 * Database Setup and Migration Script for Whistle App
 * Handles initial database setup, indexes, and admin account creation
 */

async function createIndexes() {
  console.log('🔧 Creating database indexes...');

  try {
    // Admin collection indexes
    await AdminModel.collection.createIndex({ username: 1 }, { unique: true });
    await AdminModel.collection.createIndex({ email: 1 }, { unique: true });
    await AdminModel.collection.createIndex({ role: 1 });
    await AdminModel.collection.createIndex({ isActive: 1 });
    await AdminModel.collection.createIndex({ createdAt: -1 });
    console.log('✅ Admin collection indexes created');

    // Report collection indexes
    await ReportModel.collection.createIndex({ status: 1 });
    await ReportModel.collection.createIndex({ severity: 1 });
    await ReportModel.collection.createIndex({ created_at: -1 });
    await ReportModel.collection.createIndex({ shortId: 1 }, { unique: true });
    await ReportModel.collection.createIndex({ category: 1 });
    console.log('✅ Report collection indexes created');

    // Alert collection indexes
    await AlertModel.collection.createIndex({ reportId: 1 });
    await AlertModel.collection.createIndex({ alertType: 1 });
    await AlertModel.collection.createIndex({ created_at: -1 });
    await AlertModel.collection.createIndex({ is_acknowledged: 1 });
    console.log('✅ Alert collection indexes created');

    console.log('🎯 All database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

async function createInitialAdmin() {
  console.log('👤 Creating initial admin account...');

  try {
    // Check if any admin already exists
    const existingAdmin = await AdminModel.findOne({});
    if (existingAdmin) {
      console.log('✅ Admin account already exists. Skipping creation.');
      return;
    }

    // Use environment variables for initial admin
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const email = process.env.ADMIN_EMAIL || 'admin@whistle.com';

    // Hash password
    const hashedPassword = await AuthService.hashPassword(password);

    // Create initial superadmin
    const initialAdmin = new AdminModel({
      username,
      password: hashedPassword,
      email,
      role: AdminRole.SUPERADMIN,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true
    });

    await initialAdmin.save();

    console.log('✅ Initial admin account created:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${AdminRole.SUPERADMIN}`);
    console.log('⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Error creating initial admin:', error);
    throw error;
  }
}

async function validateConfiguration() {
  console.log('🔍 Validating configuration...');

  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'ENCRYPTION_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    throw new Error('Configuration validation failed');
  }

  // Check JWT secret length
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    console.warn('⚠️  JWT_SECRET is shorter than recommended 32 characters');
  }

  // Check encryption key length
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  if (encryptionKey.length < 32) {
    console.warn('⚠️  ENCRYPTION_KEY is shorter than recommended 32 characters');
  }

  console.log('✅ Configuration validation passed');
}

async function setupDatabase() {
  try {
    console.log('🚀 Starting Whistle database setup...');

    // Validate environment configuration
    await validateConfiguration();

    // Connect to database
    await connectDB();

    // Create indexes
    await createIndexes();

    // Create initial admin account
    await createInitialAdmin();

    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Login with your admin credentials');
    console.log('3. Create additional admin accounts as needed');
    console.log('4. Change default passwords in production');

  } catch (error) {
    console.error('💥 Database setup failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

export { setupDatabase, createIndexes, createInitialAdmin, validateConfiguration };