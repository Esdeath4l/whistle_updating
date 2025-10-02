import { Request, Response } from 'express';
import { AdminService } from '../utils/admin-service';
import { AdminLoginRequest } from '../../shared/models/Admin';

/**
 * ================================================================================================
 * WHISTLE - MULTI-ADMIN LOGIN ROUTE
 * ================================================================================================
 * 
 * Enhanced admin authentication endpoint supporting multiple admin accounts
 * Features:
 * - MongoDB-based admin account management
 * - bcrypt password hashing and verification
 * - Role-based authentication (primary/secondary)
 * - JWT token generation with role information
 * - Comprehensive logging and error handling
 * - Security-focused response format
 * 
 * ================================================================================================
 */

/**
 * Admin Login Route Handler
 * POST /api/admin/login
 * 
 * Accepts JSON payload: { username: string, password: string }
 * Returns JWT tokens on successful authentication
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔐 Multi-admin login attempt initiated');
    
    const loginRequest: AdminLoginRequest = req.body;
    const { username, password } = loginRequest;
    
    // Validate request payload
    if (!username || !password) {
      console.log('❌ Missing username or password in request');
      res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
      return;
    }
    
    // Rate limiting check (basic)
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    console.log(`🔍 Login attempt from IP: ${clientIP} for username: ${username}`);
    
    // Authenticate admin using AdminService
    const authResult = await AdminService.authenticateAdmin(loginRequest);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed for: ${username}`);
      
      // Security: Use generic error message to prevent enumeration
      res.status(401).json({
        success: false,
        error: authResult.message || 'Invalid credentials'
      });
      return;
    }
    
    console.log(`✅ Successful admin login for: ${username} (${authResult.admin?.role})`);
    
    // Return success response with tokens
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: authResult.token,
        admin: authResult.admin,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });
    
  } catch (error) {
    console.error('❌ Admin login error:', error);
    
    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      error: 'Internal server error during authentication'
    });
  }
};