import { io, Socket } from 'socket.io-client';
import type { WSMessage, WSRequest, WSResponse } from '@/types';

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private pendingRequests: Map<string, { resolve: (data: any) => void; reject: (error: any) => void; timeout: NodeJS.Timeout }> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;

  connect(url: string = 'http://localhost:5001'): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(url, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        this.socket.on('connect', () => {
          console.log('[SocketClient] Connected to server');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          this.emit('system:connected', { timestamp: Date.now() });
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[SocketClient] Disconnected:', reason);
          this.emit('system:disconnected', { reason, timestamp: Date.now() });
        });

        this.socket.on('connect_error', (error) => {
          console.error('[SocketClient] Connection error:', error);
          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.isConnecting = false;
            reject(new Error('Max reconnection attempts reached'));
          }
        });

        this.socket.on('message', (message: WSMessage) => {
          this.handleMessage(message);
        });

        this.socket.on('response', (response: WSResponse) => {
          this.handleResponse(response);
        });

        // Topic-based broadcasts
        this.socket.on('market_update', (data) => this.emit('market_update', data));
        this.socket.on('portfolio_update', (data) => this.emit('portfolio_update', data));
        this.socket.on('trade_update', (data) => this.emit('trade_update', data));
        this.socket.on('system_alert', (data) => this.emit('system_alert', data));
        this.socket.on('trends_update', (data) => this.emit('trends_update', data));

        // Set a timeout for initial connection
        setTimeout(() => {
          if (!this.socket?.connected) {
            this.isConnecting = false;
            reject(new Error('Connection timeout'));
          }
        }, 20000);

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingRequests.clear();
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SocketClient] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  joinRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join', room);
    }
  }

  leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave', room);
    }
  }

  async apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<T> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: WSRequest = {
      id: requestId,
      endpoint,
      method,
      data,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.socket!.emit('api_request', request);
    });
  }

  private handleMessage(message: WSMessage): void {
    this.emit(message.type, message.data);
  }

  private handleResponse(response: WSResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);

      if (response.success) {
        pending.resolve(response.data);
      } else {
        pending.reject(new Error(response.error || 'Unknown error'));
      }
    }
  }
}

export const socketClient = new SocketClient();
