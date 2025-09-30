import { Request, Response } from 'express';
import AdminModel, { IAdmin, AdminRole } from '../../shared/models/Admin';
import { AuthService, AuthRequest } from '../utils/auth';

/**
 * Admin Authentication and Management Routes for Whistle App
 * Handles admin login, registration, role management, and profile updates
 */

interface LoginRequest {
  username: string;
  password: string;
}

interface CreateAdminRequest {
  username: string;
  password: string;
  email: string;
  role: AdminRole;
  firstName?: string;
  lastName?: string;
}

interface UpdateAdminRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: AdminRole;
  isActive?: boolean;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Admin login with JWT token generation
 * POST /api/admin/login
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body as LoginRequest;

    // Validate request
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
      return;
    }

    // Find admin by username
    const admin = await AdminModel.findOne({ username }).select('+password');
    if (!admin) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Check if admin account is active
    if (!admin.isActive) {
      res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await AuthService.comparePassword(password, admin.password);
    if (!isPasswordValid) {
      // Update failed login attempts
      admin.lastFailedLogin = new Date();
      await admin.save();

      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT tokens
    const tokens = AuthService.generateTokens(admin);

    // Return admin info (without password) and tokens
    const adminResponse = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt
    };

    res.json({
      success: true,
      data: {
        admin: adminResponse,
        tokens
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

/**
 * Create new admin account (superadmin only)
 * POST /api/admin/create
 */
export const createAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, email, role, firstName, lastName } = req.body as CreateAdminRequest;

    // Validate request
    if (!username || !password || !email || !role) {
      res.status(400).json({
        success: false,
        error: 'Username, password, email, and role are required'
      });
      return;
    }

    // Check if username or email already exists
    const existingAdmin = await AdminModel.findOne({
      $or: [{ username }, { email }]
    });

    if (existingAdmin) {
      res.status(400).json({
        success: false,
        error: 'Username or email already exists'
      });
      return;
    }

    // Hash password
    const hashedPassword = await AuthService.hashPassword(password);

    // Create new admin
    const newAdmin = new AdminModel({
      username,
      password: hashedPassword,
      email,
      role,
      firstName,
      lastName,
      createdBy: req.admin?.adminId
    });

    await newAdmin.save();

    // Return admin info (without password)
    const adminResponse = {
      id: newAdmin._id,
      username: newAdmin.username,
      email: newAdmin.email,
      role: newAdmin.role,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      isActive: newAdmin.isActive,
      createdAt: newAdmin.createdAt
    };

    res.status(201).json({
      success: true,
      data: adminResponse,
      message: 'Admin account created successfully'
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin account'
    });
  }
};

/**
 * Get admin profile information
 * GET /api/admin/profile
 */
export const getAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.admin?.adminId;
    
    const admin = await AdminModel.findById(adminId);
    if (!admin) {
      res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
      return;
    }

    const adminResponse = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
      lastLogin: admin.lastLogin,
      lastFailedLogin: admin.lastFailedLogin,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };

    res.json({
      success: true,
      data: adminResponse
    });

  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

/**
 * Update admin profile
 * PUT /api/admin/profile
 */
export const updateAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.admin?.adminId;
    const updates = req.body as UpdateAdminRequest;

    // Remove fields that shouldn't be updated via this endpoint
    delete (updates as any).password;
    delete (updates as any).username;

    const admin = await AdminModel.findByIdAndUpdate(
      adminId,
      updates,
      { new: true, runValidators: true }
    );

    if (!admin) {
      res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
      return;
    }

    const adminResponse = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
      isActive: admin.isActive,
      updatedAt: admin.updatedAt
    };

    res.json({
      success: true,
      data: adminResponse,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

/**
 * Change admin password
 * PUT /api/admin/change-password
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.admin?.adminId;
    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
      return;
    }

    const admin = await AdminModel.findById(adminId).select('+password');
    if (!admin) {
      res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await AuthService.comparePassword(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const hashedNewPassword = await AuthService.hashPassword(newPassword);
    
    // Update password
    admin.password = hashedNewPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

/**
 * Get all admins (superadmin only)
 * GET /api/admin/list
 */
export const listAdmins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      AdminModel.find({})
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AdminModel.countDocuments({})
    ]);

    res.json({
      success: true,
      data: {
        admins,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin list'
    });
  }
};

/**
 * Update admin status/role (superadmin only)
 * PUT /api/admin/:id
 */
export const updateAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateAdminRequest;
    const currentAdminId = req.admin?.adminId;

    // Prevent self-deactivation
    if (id === currentAdminId && updates.isActive === false) {
      res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
      return;
    }

    // Remove fields that shouldn't be updated
    delete (updates as any).password;
    delete (updates as any).username;

    const admin = await AdminModel.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) {
      res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
      return;
    }

    res.json({
      success: true,
      data: admin,
      message: 'Admin updated successfully'
    });

  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin'
    });
  }
};

/**
 * Refresh access token
 * POST /api/admin/refresh
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
      return;
    }

    // Verify refresh token and extract admin ID
    const decoded = AuthService.verifyToken(refreshToken) as any;
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }

    // Get admin data
    const admin = await AdminModel.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      res.status(401).json({
        success: false,
        error: 'Admin not found or account deactivated'
      });
      return;
    }

    // Generate new access token
    const newAccessToken = AuthService.refreshAccessToken(refreshToken, admin);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    });
  }
};