/**
 * Environment Configuration
 *
 * This file handles environment-specific configuration for API endpoints.
 * In production, it will use the deployed backend URLs.
 * In development, it will use localhost.
 */

const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Get the base URL for production
const getProductionBaseUrl = () => {
  // If deployed on Firebase, use the same domain for API
  if (window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com')) {
    return window.location.origin;
  }
  return window.location.origin;
};

export const config = {
  isDevelopment,
  api: {
    // Main backend API
    mainUrl: isDevelopment
      ? 'http://localhost:5001/api'
      : `${getProductionBaseUrl()}/api`,

    // Cache API (fallback)
    cacheUrl: isDevelopment
      ? 'http://localhost:5055'
      : `${getProductionBaseUrl()}/cache`,

    // Snapshot API (fallback)
    snapshotUrl: isDevelopment
      ? 'http://localhost:5002'
      : `${getProductionBaseUrl()}/snapshot`,

    // Timeout settings
    timeout: {
      main: 10000,
      cache: 5000,
      snapshot: 5000,
    },
  },

  // WebSocket configuration
  websocket: {
    url: isDevelopment
      ? 'ws://localhost:5001'
      : `wss://${window.location.host}`,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
  },
};

// Log configuration in development
if (isDevelopment) {
  console.log('[Config] Environment configuration:', {
    mode: isDevelopment ? 'development' : 'production',
    apiUrl: config.api.mainUrl,
    wsUrl: config.websocket.url,
  });
}

export default config;
