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

export interface AuthTokenPayload {
  adminId: string;
  username: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  admin?: AuthTokenPayload;
}

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
  });
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
