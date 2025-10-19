/**
 * Authentication Routes
 * Handles login, TOTP setup, and token verification
 */

import express, { Request, Response } from 'express';
import { Firestore } from 'firebase-admin/firestore';
import { AuthService } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

export function createAuthRouter(db: Firestore) {
  const router = express.Router();
  const authService = new AuthService(db);

  /**
   * POST /auth/login
   * Initial login with username and password
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Username and password are required',
        });
        return;
      }

      // Get user
      const user = await authService.getUserByUsername(username);

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid username or password',
        });
        return;
      }

      // Verify password
      const validPassword = await authService.verifyPassword(password, user.passwordHash);

      if (!validPassword) {
        res.status(401).json({
          success: false,
          error: 'Invalid username or password',
        });
        return;
      }

      // Check if TOTP is enabled
      if (user.totpEnabled && user.totpSecret) {
        // Return that TOTP is required (don't give token yet)
        res.json({
          success: true,
          requiresTOTP: true,
          userId: user.userId,
          username: user.username,
        });
      } else {
        // TOTP not set up, require setup
        res.json({
          success: true,
          requiresTOTPSetup: true,
          userId: user.userId,
          username: user.username,
        });
      }
    } catch (error: any) {
      console.error('[Auth] Login error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  });

  /**
   * POST /auth/verify-totp
   * Verify TOTP token and return JWT
   */
  router.post('/verify-totp', async (req: Request, res: Response) => {
    try {
      const { userId, token } = req.body;

      if (!userId || !token) {
        res.status(400).json({
          success: false,
          error: 'User ID and TOTP token are required',
        });
        return;
      }

      // Get user
      const user = await authService.getUserById(userId);

      if (!user || !user.totpSecret) {
        res.status(401).json({
          success: false,
          error: 'Invalid user or TOTP not set up',
        });
        return;
      }

      // Verify TOTP token
      const valid = authService.verifyTOTPToken(token, user.totpSecret);

      if (!valid) {
        res.status(401).json({
          success: false,
          error: 'Invalid TOTP token',
        });
        return;
      }

      // Update last login
      await authService.updateLastLogin(userId);

      // Create JWT token
      const jwtToken = authService.createToken(userId, user.username);

      res.json({
        success: true,
        token: jwtToken,
        user: {
          userId: user.userId,
          username: user.username,
        },
      });
    } catch (error: any) {
      console.error('[Auth] TOTP verification error:', error.message);
      res.status(500).json({
        success: false,
        error: 'TOTP verification failed',
      });
    }
  });

  /**
   * POST /auth/setup-totp
   * Generate TOTP secret and QR code for initial setup
   */
  router.post('/setup-totp', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      // Get user
      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Generate TOTP secret
      const { secret, otpauth_url } = authService.generateTOTPSecret(user.username);

      // Generate QR code
      const qrCode = await authService.generateQRCode(otpauth_url);

      res.json({
        success: true,
        secret,
        qrCode,
      });
    } catch (error: any) {
      console.error('[Auth] TOTP setup error:', error.message);
      res.status(500).json({
        success: false,
        error: 'TOTP setup failed',
      });
    }
  });

  /**
   * POST /auth/confirm-totp-setup
   * Verify TOTP token and enable TOTP for user
   */
  router.post('/confirm-totp-setup', async (req: Request, res: Response) => {
    try {
      const { userId, secret, token } = req.body;

      if (!userId || !secret || !token) {
        res.status(400).json({
          success: false,
          error: 'User ID, secret, and token are required',
        });
        return;
      }

      // Verify TOTP token
      const valid = authService.verifyTOTPToken(token, secret);

      if (!valid) {
        res.status(401).json({
          success: false,
          error: 'Invalid TOTP token',
        });
        return;
      }

      // Get user
      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Enable TOTP
      await authService.enableTOTP(userId, secret);

      // Update last login
      await authService.updateLastLogin(userId);

      // Create JWT token
      const jwtToken = authService.createToken(userId, user.username);

      res.json({
        success: true,
        token: jwtToken,
        user: {
          userId: user.userId,
          username: user.username,
        },
      });
    } catch (error: any) {
      console.error('[Auth] TOTP confirmation error:', error.message);
      res.status(500).json({
        success: false,
        error: 'TOTP confirmation failed',
      });
    }
  });

  /**
   * GET /auth/verify
   * Verify current JWT token (protected route)
   */
  router.get('/verify', authenticateToken, async (req: Request, res: Response) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  /**
   * POST /auth/create-user (for initial setup)
   * Create a new user - in production, you'd want to protect this
   */
  router.post('/create-user', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Username and password are required',
        });
        return;
      }

      // Check if user already exists
      const existingUser = await authService.getUserByUsername(username);

      if (existingUser) {
        res.status(400).json({
          success: false,
          error: 'Username already exists',
        });
        return;
      }

      // Create user
      const userId = await authService.createUser(username, password);

      res.json({
        success: true,
        userId,
        username,
      });
    } catch (error: any) {
      console.error('[Auth] User creation error:', error.message);
      res.status(500).json({
        success: false,
        error: 'User creation failed',
      });
    }
  });

  return router;
}
