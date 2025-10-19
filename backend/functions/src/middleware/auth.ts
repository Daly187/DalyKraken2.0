/**
 * Authentication Middleware
 * Protects routes by verifying JWT tokens
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import admin from 'firebase-admin';

// Lazy initialization - get db and authService when needed
let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    const db = admin.firestore();
    authService = new AuthService(db);
  }
  return authService;
}

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const service = getAuthService();
    const decoded = service.verifyToken(token);

    if (!decoded) {
      res.status(403).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}
