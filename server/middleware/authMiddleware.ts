import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const getJWTSecret = () => process.env.JWT_SECRET || 'whistle-default-jwt-secret-32-characters-minimum';
const getJWTExpiresIn = () => process.env.JWT_EXPIRES_IN || '24h';
const getEncryptionKey = () => process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!';
const getAdminUsername = () => process.env.ADMIN_USERNAME || 'admin';
const getAdminPassword = () => process.env.ADMIN_PASSWORD || 'admin123';
const ALGORITHM = 'aes-256-gcm';

export interface AuthTokenPayload extends jwt.JwtPayload {
  adminId: string;
  username: string;
  isAdmin: boolean;
  role?: string;
  isLocked?: boolean; // Add the missing property
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  admin?: AuthTokenPayload;
  user?: AuthTokenPayload;
  adminUser?: IAdmin;
}

// Minimal admin interface placeholder for type checking
export interface IAdmin {
  _id: any;
  email: string;
  role?: string;
  is_active?: boolean;
  isLocked?: boolean;
  permissions?: Record<string, boolean>;
  hasPermission?: (perm: string) => boolean;
}

// Minimal AdminModel placeholder for type checking (DB model is provided at runtime)
const AdminModel: any = (global as any).AdminModel || {
  findById: async (id: any) => null
};

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const encryptSensitiveData = (data: string): EncryptedData => {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key as any, iv as any);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt sensitive data');
  }
};

export const decryptSensitiveData = (encryptedData: string, iv: string, authTag: string): string => {
  try {
    const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key as any, Buffer.from(iv, 'hex') as any);
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex') as any);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt sensitive data');
  }
};

export const generateAccessToken = (adminData: {
  adminId: string;
  username: string;
  isAdmin: boolean;
}): string => {
  const payload: AuthTokenPayload = {
    adminId: adminData.adminId,
    username: adminData.username,
    isAdmin: adminData.isAdmin
  };
  
  const secret = getJWTSecret();
  const expiresIn = getJWTExpiresIn();
  
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn,
    issuer: 'whistle-server',
    audience: 'whistle-admin'
  } as jwt.SignOptions);
};

export const generateRefreshToken = (adminData: {
  adminId: string;
  username: string;
  isAdmin: boolean;
}): string => {
  const payload: AuthTokenPayload = {
    adminId: adminData.adminId,
    username: adminData.username,
    isAdmin: adminData.isAdmin
  };
  
  const secret = getJWTSecret();
  
  return jwt.sign(payload, secret, {
    expiresIn: '7d',
    issuer: 'whistle-server',
    audience: 'whistle-admin'
  });
};

export const verifyToken = (token: string): AuthTokenPayload => {
  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret, {
      issuer: 'whistle-server',
      audience: 'whistle-admin'
    }) as AuthTokenPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
      return;
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    req.admin = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.admin || !req.admin.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
      return;
    }
    
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Admin authorization failed'
    });
  }
};

export const validateAdminCredentials = async (username: string, password: string): Promise<boolean> => {
  try {
    const adminUsername = getAdminUsername();
    const adminPassword = getAdminPassword();
    
    if (username !== adminUsername || password !== adminPassword) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Credential validation error:', error);
    return false;
  }
};

setTimeout(() => {
  console.log(' Whistle Security System Initialized');
  const adminUsername = getAdminUsername();
  const adminPassword = getAdminPassword();

  if (adminUsername === 'admin' && adminPassword === 'admin123') {
    console.warn('  WARNING: Using default admin credentials!');
  }
  console.log(` Admin login configured for username: ${adminUsername}`);
}, 100);

/**
 * Enhanced admin authentication middleware with database verification
 */
export const authenticateAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Admin access token required' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, getJWTSecret()) as AuthTokenPayload;
    
    // Fetch admin from database to ensure they're still active
    const admin = await AdminModel.findById(decoded.adminId).select('+permissions');
    
    if (!admin || !admin.is_active) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Admin account not found or inactive' 
      });
    }

    // Check if account is locked
    if (admin.isLocked) {
      return res.status(423).json({ 
        error: 'Account locked',
        message: 'Account is temporarily locked due to failed login attempts' 
      });
    }

    // Attach admin to request object
    req.adminUser = admin;
    req.admin = { 
      adminId: admin._id.toString(), 
      username: admin.email, 
      isAdmin: true,
      role: admin.role 
    };
    req.user = req.admin;
    
    next();
  } catch (error) {
    console.error('❌ Admin authentication error:', error);
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'Please log in again' 
    });
  }
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: keyof IAdmin['permissions']) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in first' 
      });
    }

    if (!req.adminUser.hasPermission(permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires ${permission.replace(/_/g, ' ')} permission` 
      });
    }

    next();
  };
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in first' 
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.adminUser.role)) {
      return res.status(403).json({ 
        error: 'Insufficient role privileges',
        message: `This action requires ${allowedRoles.join(' or ')} role` 
      });
    }

    next();
  };
};

/**
 * Enhanced JWT generation for admin users
 */
export const generateAdminToken = (admin: IAdmin): string => {
  const payload: AuthTokenPayload = {
    adminId: admin._id.toString(),
    username: admin.email,
    isAdmin: true,
    role: admin.role
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: getJWTExpiresIn()
  } as jwt.SignOptions);
};
