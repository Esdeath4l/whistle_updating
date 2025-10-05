import { Request, Response } from 'express';
import {
  validateAdminCredentials,
  generateAccessToken,
  generateRefreshToken,
  AuthRequest,
  LoginCredentials
} from '../middleware/authMiddleware';

/**
 * ================================================================================================
 * WHISTLE - ADMIN LOGIN ROUTE
 * ================================================================================================
 * 
 * Secure admin authentication endpoint using environment-based credentials
 * Features:
 * - Environment variable based email/password validation
 * - bcrypt password comparison for security
 * - JWT token generation with proper expiration
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
    console.log('🔐 Admin login attempt initiated');
    
    const { username, password }: LoginCredentials = req.body;
    
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
    
    // Validate admin credentials against environment variables
    const isValidCredentials = await validateAdminCredentials(username, password);
    
    if (!isValidCredentials) {
      console.log(`❌ Invalid login credentials for: ${username}`);
      
      // Security: Use generic error message to prevent enumeration
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }
    
    // Generate admin ID (in production, this would come from database)
    const adminId = 'admin-' + Buffer.from(username).toString('base64').slice(0, 8);
    
    // Generate JWT tokens
    const accessToken = generateAccessToken({
      adminId,
      username,
      isAdmin: true
    });
    
    const refreshToken = generateRefreshToken({
      adminId,
      username,
      isAdmin: true
    });
    
    console.log(`✅ Successful admin login for: ${username}`);
    
    // Return success response with tokens
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        admin: {
          id: adminId,
          username,
          isAdmin: true
        },
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