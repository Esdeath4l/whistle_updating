/**
 * Admin Management Service
 * Handles multi-admin account creation, authentication, and management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminModel, { IAdmin, AdminRole, ADMIN_ACCOUNTS, AdminLoginRequest, AdminLoginResponse } from '../../shared/models/Admin';

const JWT_SECRET = process.env.JWT_SECRET || 'whistle-admin-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export class AdminService {
  
  /**
   * Initialize admin accounts from configuration
   * Creates admin accounts if they don't exist with hashed passwords
   */
  static async initializeAdminAccounts(): Promise<void> {
    console.log('🔧 Initializing admin accounts...');
    
    try {
      for (const adminConfig of ADMIN_ACCOUNTS) {
        const existingAdmin = await AdminModel.findOne({ username: adminConfig.username });
        
        if (!existingAdmin) {
          // Hash password before storing
          const passwordHash = await bcrypt.hash(adminConfig.password, 12);
          
          const newAdmin = new AdminModel({
            username: adminConfig.username,
            passwordHash,
            email: adminConfig.email,
            role: adminConfig.role,
            isActive: true
          });
          
          await newAdmin.save();
          console.log(`✅ Created admin account: ${adminConfig.username} (${adminConfig.role})`);
        } else {
          console.log(`👤 Admin account exists: ${adminConfig.username} (${existingAdmin.role})`);
        }
      }
      
      console.log('✅ Admin accounts initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize admin accounts:', error);
      throw error;
    }
  }
  
  /**
   * Authenticate admin login
   * Validates credentials and returns JWT token
   */
  static async authenticateAdmin(loginRequest: AdminLoginRequest): Promise<AdminLoginResponse> {
    try {
      const { username, password } = loginRequest;
      
      console.log(`🔐 Attempting admin login for: ${username}`);
      
      // Find admin with password hash (select: true to include password)
      const admin = await AdminModel.findOne({ 
        username, 
        isActive: true 
      }).select('+passwordHash');
      
      if (!admin) {
        console.log(`❌ Admin not found or inactive: ${username}`);
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
      
      if (!isPasswordValid) {
        console.log(`❌ Invalid password for admin: ${username}`);
        // Update last failed login
        admin.lastFailedLogin = new Date();
        await admin.save();
        
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }
      
      // Update last login
      admin.lastLogin = new Date();
      await admin.save();
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          adminId: admin._id,
          username: admin.username,
          role: admin.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      console.log(`✅ Admin login successful: ${username} (${admin.role})`);
      
      return {
        success: true,
        token,
        admin: {
          username: admin.username,
          role: admin.role,
          email: admin.email
        }
      };
      
    } catch (error) {
      console.error('❌ Admin authentication error:', error);
      return {
        success: false,
        message: 'Authentication failed'
      };
    }
  }
  
  /**
   * Verify JWT token and get admin info
   */
  static async verifyAdminToken(token: string): Promise<{ valid: boolean; admin?: any; }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if admin still exists and is active
      const admin = await AdminModel.findById(decoded.adminId);
      
      if (!admin || !admin.isActive) {
        return { valid: false };
      }
      
      return {
        valid: true,
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role,
          email: admin.email
        }
      };
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      return { valid: false };
    }
  }
  
  /**
   * Get primary admin (ritika) for escalation emails
   */
  static async getPrimaryAdmin(): Promise<IAdmin | null> {
    try {
      return await AdminModel.findOne({ 
        role: AdminRole.PRIMARY, 
        isActive: true 
      });
    } catch (error) {
      console.error('❌ Failed to get primary admin:', error);
      return null;
    }
  }
  
  /**
   * Get all active admins
   */
  static async getAllActiveAdmins(): Promise<IAdmin[]> {
    try {
      return await AdminModel.find({ isActive: true }).select('-passwordHash');
    } catch (error) {
      console.error('❌ Failed to get active admins:', error);
      return [];
    }
  }
  
  /**
   * Check if admin has required role
   */
  static hasRole(adminRole: AdminRole, requiredRole: AdminRole | AdminRole[]): boolean {
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(adminRole);
    }
    
    // Primary admin has access to everything
    if (adminRole === AdminRole.PRIMARY) {
      return true;
    }
    
    return adminRole === requiredRole;
  }
  
  /**
   * Create new admin account (only primary admin can do this)
   */
  static async createAdmin(adminData: {
    username: string;
    password: string;
    email: string;
    role: AdminRole;
  }, createdBy: string): Promise<{ success: boolean; message: string; admin?: any; }> {
    try {
      // Check if username already exists
      const existingAdmin = await AdminModel.findOne({ username: adminData.username });
      if (existingAdmin) {
        return {
          success: false,
          message: 'Username already exists'
        };
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(adminData.password, 12);
      
      // Get creator admin ID
      const creatorAdmin = await AdminModel.findOne({ username: createdBy });
      
      const newAdmin = new AdminModel({
        username: adminData.username,
        passwordHash,
        email: adminData.email,
        role: adminData.role,
        isActive: true,
        createdBy: creatorAdmin?._id
      });
      
      await newAdmin.save();
      
      console.log(`✅ New admin created: ${adminData.username} by ${createdBy}`);
      
      return {
        success: true,
        message: 'Admin account created successfully',
        admin: {
          username: newAdmin.username,
          email: newAdmin.email,
          role: newAdmin.role
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to create admin:', error);
      return {
        success: false,
        message: 'Failed to create admin account'
      };
    }
  }
  
  /**
   * Update admin password
   */
  static async updatePassword(username: string, newPassword: string): Promise<{ success: boolean; message: string; }> {
    try {
      const admin = await AdminModel.findOne({ username, isActive: true });
      
      if (!admin) {
        return {
          success: false,
          message: 'Admin not found'
        };
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      admin.passwordHash = passwordHash;
      await admin.save();
      
      console.log(`✅ Password updated for admin: ${username}`);
      
      return {
        success: true,
        message: 'Password updated successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to update password:', error);
      return {
        success: false,
        message: 'Failed to update password'
      };
    }
  }
}

export default AdminService;