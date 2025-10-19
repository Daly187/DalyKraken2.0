/**
 * Authentication Service
 * Handles user authentication with TOTP (Google Authenticator)
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Firestore } from 'firebase-admin/firestore';

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '365d'; // Token expires in 1 year for persistent login

export interface UserAuth {
  userId: string;
  username: string;
  passwordHash: string;
  totpSecret?: string;
  totpEnabled: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export class AuthService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a new TOTP secret for a user
   */
  generateTOTPSecret(username: string): { secret: string; otpauth_url: string } {
    const secret = speakeasy.generateSecret({
      name: `DalyKraken (${username})`,
      issuer: 'DalyKraken',
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url || '',
    };
  }

  /**
   * Generate QR code for TOTP setup
   */
  async generateQRCode(otpauth_url: string): Promise<string> {
    return QRCode.toDataURL(otpauth_url);
  }

  /**
   * Verify a TOTP token
   */
  verifyTOTPToken(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock drift
    });
  }

  /**
   * Create a JWT token for a user
   */
  createToken(userId: string, username: string): string {
    return jwt.sign(
      { userId, username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): { userId: string; username: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserAuth | null> {
    const snapshot = await this.db
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      userId: doc.id,
      ...doc.data(),
    } as UserAuth;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserAuth | null> {
    const doc = await this.db.collection('users').doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      userId: doc.id,
      ...doc.data(),
    } as UserAuth;
  }

  /**
   * Create a new user
   */
  async createUser(username: string, password: string): Promise<string> {
    const passwordHash = await this.hashPassword(password);

    const userRef = await this.db.collection('users').add({
      username,
      passwordHash,
      totpEnabled: false,
      createdAt: new Date(),
    });

    return userRef.id;
  }

  /**
   * Enable TOTP for a user
   */
  async enableTOTP(userId: string, totpSecret: string): Promise<void> {
    await this.db.collection('users').doc(userId).update({
      totpSecret,
      totpEnabled: true,
    });
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.db.collection('users').doc(userId).update({
      lastLogin: new Date(),
    });
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPassword);
    await this.db.collection('users').doc(userId).update({
      passwordHash,
    });
  }
}
