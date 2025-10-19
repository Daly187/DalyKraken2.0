/**
 * Firebase Firestore Database Instance
 * Centralized export to avoid circular dependencies
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
