import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { IAdmin, AdminRole } from '../../shared/models/Admin';

/**
 * JWT Authentication Utility for Whistle Admin System
 * Handles token generation, validation, and role-based access control
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

interface TokenPayload {
  adminId: string;
  username: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthRequest extends Request {
  admin?: TokenPayload;
}

export class AuthService {
  private static validateJWTSecret() {
    if (JWT_SECRET.length < 32) {
      console.warn('WARNING: JWT_SECRET is too short. Use a secure 32+ character secret in production.');
    }
  }

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password
   * @returns Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare a plain text password with its hash
   * @param password - Plain text password
   * @param hash - Hashed password from database
   * @returns True if password matches
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }
    
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access and refresh tokens for admin
   * @param admin - Admin user object
   * @returns Object with access and refresh tokens
   */
  static generateTokens(admin: IAdmin): AuthTokens {
    this.validateJWTSecret();
    
    const payload: TokenPayload = {
      adminId: admin._id.toString(),
      username: admin.username,
      role: admin.role
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'whistle-app',
      audience: 'whistle-admin'
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { adminId: admin._id.toString(), type: 'refresh' },
      JWT_SECRET,
      {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        issuer: 'whistle-app',
        audience: 'whistle-admin'
      } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode JWT token
   * @param token - JWT token string
   * @returns Decoded token payload
   */
  static verifyToken(token: string): TokenPayload {
    this.validateJWTSecret();
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'whistle-app',
        audience: 'whistle-admin'
      }) as TokenPayload;
      
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
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Valid refresh token
   * @param admin - Current admin data for new token
   * @returns New access token
   */
  static refreshAccessToken(refreshToken: string, admin: IAdmin): string {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      
      if (decoded.type !== 'refresh' || decoded.adminId !== admin._id.toString()) {
        throw new Error('Invalid refresh token');
      }

      const payload: TokenPayload = {
        adminId: admin._id.toString(),
        username: admin.username,
        role: admin.role
      };

      return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'whistle-app',
        audience: 'whistle-admin'
      } as jwt.SignOptions);
    } catch (error) {
      throw new Error('Refresh token is invalid or expired');
    }
  }

  /**
   * Middleware to authenticate admin requests
   * Validates JWT token and attaches admin info to request
   */
  static authenticateAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        error: 'Access token required. Please provide Bearer token in Authorization header.' 
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = AuthService.verifyToken(token);
      req.admin = decoded;
      next();
    } catch (error) {
      res.status(401).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Invalid token' 
      });
    }
  };

  /**
   * Middleware to check if admin has required role
   * @param requiredRole - Minimum role required for access
   */
  static requireRole = (requiredRole: AdminRole) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.admin) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        });
        return;
      }

      const roleHierarchy: Record<AdminRole, number> = {
        [AdminRole.MODERATOR]: 1,
        [AdminRole.SUPERADMIN]: 2
      };

      if (roleHierarchy[req.admin.role] < roleHierarchy[requiredRole]) {
        res.status(403).json({ 
          success: false, 
          error: `Access denied. ${requiredRole} role required.` 
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check if admin is superadmin
   */
  static requireSuperAdmin = AuthService.requireRole(AdminRole.SUPERADMIN);

  /**
   * Extract admin info from authenticated request
   * @param req - Authenticated request object
   * @returns Admin payload or null
   */
  static getAdminFromRequest(req: AuthRequest): TokenPayload | null {
    return req.admin || null;
  }

  /**
   * Generate secure random string for additional security tokens
   * @param length - Length of random string
   * @returns Random string
   */
  static generateSecureToken(length: number = 32): string {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }
}

export type { AuthRequest, TokenPayload, AuthTokens };