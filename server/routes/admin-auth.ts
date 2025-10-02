import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

const getJWTSecret = () => process.env.JWT_SECRET || 'whistle-default-jwt-secret-32-characters-minimum';
const getAdminUsername = () => process.env.ADMIN_USERNAME ;
const getAdminPassword = () => process.env.ADMIN_PASSWORD ;

/**
 * Simple Admin Login using Environment Variables
 * POST /api/admin/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    const adminUsername = getAdminUsername();
    const adminPassword = getAdminPassword();

    // Verify credentials against environment variables
    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        adminId: 'admin-env',
        username: adminUsername,
        role: 'admin',
        isAdmin: true
      },
      getJWTSecret(),
      { expiresIn: '24h' }
    );

    console.log(`✅ Admin login successful: ${adminUsername}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        username: adminUsername,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * Verify admin token
 * GET /api/admin/verify
 */
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authentication token is required'
      });
    }

    const decoded = jwt.verify(token, getJWTSecret()) as any;

    res.json({
      valid: true,
      admin: {
        username: decoded.username,
        role: decoded.role || 'admin'
      }
    });

  } catch (error) {
    res.status(403).json({
      valid: false,
      error: 'Invalid token',
      message: 'Token verification failed'
    });
  }
});

export default router;