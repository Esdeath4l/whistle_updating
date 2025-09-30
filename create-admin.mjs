// Quick admin creation script
import mongoose from 'mongoose';
import AdminModel, { AdminRole } from './shared/models/Admin.js';
import { AuthService } from './server/utils/auth.js';

const MONGODB_URI = 'mongodb+srv://whistleDB:v6twFgtD5yey9TMM@cluster0.bzvnydu.mongodb.net/whistle';

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    // Check if admin exists
    const existingAdmin = await AdminModel.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Admin already exists!');
      console.log('Username: admin');
      console.log('Try the password you set, or use: admin123');
      return;
    }

    // Create admin
    const hashedPassword = await AuthService.hashPassword('admin123');
    const admin = new AdminModel({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@whistle.com',
      role: AdminRole.SUPERADMIN,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true
    });

    await admin.save();
    console.log('✅ Admin created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Email: admin@whistle.com');
    console.log('Role: superadmin');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();