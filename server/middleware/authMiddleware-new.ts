/**
 * Enhanced Authentication Middleware for Multi-Admin System
 * Supports role-based authentication with JWT tokens
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../utils/admin-service';
import { AdminRole } from '../../shared/models/Admin';

const getJWTSecret = () => process.env.JWT_SECRET || 'whistle-admin-secret-key-2024';

export interface AuthTokenPayload extends jwt.JwtPayload {
  adminId: string;
  username: string;
  role: AdminRole;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  admin?: AuthTokenPayload;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as AuthTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Authentication middleware - verify JWT token
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
    
    // Verify token using AdminService
    const verificationResult = await AdminService.verifyAdminToken(token);
    
    if (!verificationResult.valid) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }
    
    // Add admin info to request
    req.admin = {
      adminId: verificationResult.admin.id,
      username: verificationResult.admin.username,
      role: verificationResult.admin.role,
      isAdmin: true
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
};

/**
 * Admin authorization middleware
 */
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

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: AdminRole | AdminRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // Primary admin always has access
      if (req.admin.role === AdminRole.PRIMARY || roles.includes(req.admin.role)) {
        next();
        return;
      }
      
      res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    } catch (error) {
      res.status(403).json({
        success: false,
        error: 'Role authorization failed'
      });
    }
  };
};

/**
 * Primary admin only access
 */
export const requirePrimaryAdmin = requireRole(AdminRole.PRIMARY);

/**
 * Legacy function for backward compatibility
 */
export const validateAdminCredentials = async (username: string, password: string): Promise<boolean> => {
  try {
    const result = await AdminService.authenticateAdmin({ username, password });
    return result.success;
  } catch (error) {
    console.error('Credential validation error:', error);
    return false;
  }
};

export default {
  requireAuth,
  requireAdmin,
  requireRole,
  requirePrimaryAdmin,
  verifyToken,
  validateAdminCredentials
};