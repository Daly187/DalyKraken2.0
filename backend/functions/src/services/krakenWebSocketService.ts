import * as admin from 'firebase-admin';
import crypto from 'crypto';
import WebSocket from 'ws';

/**
 * Service for managing Kraken WebSocket connection for real-time balance updates
 * This avoids REST API rate limits by subscribing to balance change events
 */
export class KrakenWebSocketService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private apiSecret: string;
  private db: admin.firestore.Firestore;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.db = admin.firestore();
  }

  /**
   * Connect to Kraken WebSocket and subscribe to balance updates
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://ws-auth.kraken.com/v2');

      this.ws.on('open', async () => {
        console.log('[KrakenWS] Connected to Kraken WebSocket');
        await this.authenticate();
        await this.subscribeToBalances();
        this.isConnected = true;
        this.startHeartbeat();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        console.error('[KrakenWS] WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[KrakenWS] Connection closed');
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      });
    });
  }

  /**
   * Authenticate with Kraken WebSocket API
   */
  private async authenticate(): Promise<void> {
    const nonce = Date.now().toString();
    const authPayload = nonce;

    // Create signature
    const hash = crypto.createHash('sha256').update(authPayload).digest();
    const hmac = crypto.createHmac('sha512', Buffer.from(this.apiSecret, 'base64'));
    const signature = hmac.update(hash).digest('base64');

    const authMessage = {
      method: 'subscribe',
      params: {
        channel: 'balances',
        token: this.apiKey,
        snapshot: true,
      },
    };

    this.send(authMessage);
  }

  /**
   * Subscribe to balance updates channel
   */
  private async subscribeToBalances(): Promise<void> {
    const message = {
      method: 'subscribe',
      params: {
        channel: 'balances',
        snapshot: true,
      },
    };

    this.send(message);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      // Handle balance snapshot
      if (message.channel === 'balances' && message.type === 'snapshot') {
        await this.updateBalanceCache(message.data);
      }

      // Handle balance updates
      if (message.channel === 'balances' && message.type === 'update') {
        await this.updateBalanceCache(message.data);
      }

      // Handle subscription confirmation
      if (message.method === 'subscribe' && message.success) {
        console.log('[KrakenWS] Successfully subscribed to balances');
      }

      // Handle errors
      if (message.error) {
        console.error('[KrakenWS] Error from Kraken:', message.error);
      }
    } catch (error) {
      console.error('[KrakenWS] Error parsing message:', error);
    }
  }

  /**
   * Update balance cache in Firestore
   */
  private async updateBalanceCache(balances: any): Promise<void> {
    try {
      const cacheData: { [key: string]: number } = {};

      // Parse balance data from WebSocket
      if (Array.isArray(balances)) {
        balances.forEach((balance: any) => {
          if (balance.asset && balance.balance) {
            cacheData[balance.asset] = parseFloat(balance.balance);
          }
        });
      }

      // Store in Firestore with timestamp
      await this.db.collection('krakenBalanceCache').doc('latest').set({
        balances: cacheData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'websocket',
      });

      console.log(`[KrakenWS] Updated balance cache with ${Object.keys(cacheData).length} assets`);
    } catch (error) {
      console.error('[KrakenWS] Error updating balance cache:', error);
    }
  }

  /**
   * Send message to WebSocket
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ method: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('[KrakenWS] Attempting to reconnect...');
      this.connect().catch((error) => {
        console.error('[KrakenWS] Reconnection failed:', error);
      });
    }, 5000); // Retry after 5 seconds
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Get cached balances from Firestore
   */
  static async getCachedBalances(): Promise<{ [key: string]: number }> {
    const db = admin.firestore();
    const cacheDoc = await db.collection('krakenBalanceCache').doc('latest').get();

    if (!cacheDoc.exists) {
      return {};
    }

    const data = cacheDoc.data();
    return data?.balances || {};
  }
}
