import { logger } from '../utils/logger.js';
import { krakenService } from '../services/krakenService.js';
import { dcaService } from '../services/dcaService.js';
import { dataStore } from '../services/dataStore.js';

/**
 * Setup WebSocket server with rooms and event handlers
 * @param {Server} io - Socket.IO server instance
 */
export function setupWebSocket(io) {
  // Track connected clients and their rooms
  const clientRooms = new Map();

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    // Initialize client data
    clientRooms.set(socket.id, new Set());

    /**
     * Join a specific room
     */
    socket.on('join_room', (data) => {
      const { room } = data;

      if (!room) {
        socket.emit('error', { message: 'Room name required' });
        return;
      }

      const validRooms = ['market', 'portfolio', 'trading', 'trends'];

      if (!validRooms.includes(room)) {
        socket.emit('error', { message: `Invalid room. Valid rooms: ${validRooms.join(', ')}` });
        return;
      }

      socket.join(room);
      clientRooms.get(socket.id).add(room);

      logger.info(`Client ${socket.id} joined room: ${room}`);

      socket.emit('joined_room', {
        room,
        timestamp: new Date().toISOString(),
      });

      // Send initial data for the room
      sendInitialRoomData(socket, room);
    });

    /**
     * Leave a specific room
     */
    socket.on('leave_room', (data) => {
      const { room } = data;

      if (!room) {
        socket.emit('error', { message: 'Room name required' });
        return;
      }

      socket.leave(room);
      clientRooms.get(socket.id).delete(room);

      logger.info(`Client ${socket.id} left room: ${room}`);

      socket.emit('left_room', {
        room,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * RPC-style API request handler
     */
    socket.on('api_request', async (data) => {
      const { requestId, endpoint, method = 'GET', params = {} } = data;

      logger.debug(`API request via WebSocket: ${method} ${endpoint}`, { requestId });

      try {
        const response = await handleApiRequest(endpoint, method, params);

        socket.emit('api_response', {
          requestId,
          success: true,
          data: response,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error(`API request error: ${endpoint}`, error);

        socket.emit('api_response', {
          requestId,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    /**
     * Subscribe to specific data streams
     */
    socket.on('subscribe', (data) => {
      const { topics } = data;

      if (!Array.isArray(topics)) {
        socket.emit('error', { message: 'Topics must be an array' });
        return;
      }

      topics.forEach(topic => {
        socket.join(`topic:${topic}`);
        logger.debug(`Client ${socket.id} subscribed to topic: ${topic}`);
      });

      socket.emit('subscribed', {
        topics,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Unsubscribe from data streams
     */
    socket.on('unsubscribe', (data) => {
      const { topics } = data;

      if (!Array.isArray(topics)) {
        socket.emit('error', { message: 'Topics must be an array' });
        return;
      }

      topics.forEach(topic => {
        socket.leave(`topic:${topic}`);
        logger.debug(`Client ${socket.id} unsubscribed from topic: ${topic}`);
      });

      socket.emit('unsubscribed', {
        topics,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Ping/pong for connection health check
     */
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Client disconnect
     */
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
      clientRooms.delete(socket.id);
    });

    /**
     * Error handler
     */
    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${socket.id}:`, error);
    });
  });

  // Store io instance for broadcasting
  global.io = io;

  // Start periodic broadcasts
  startPeriodicBroadcasts(io);

  logger.info('WebSocket server initialized with rooms: market, portfolio, trading, trends');
}

/**
 * Send initial data when client joins a room
 */
async function sendInitialRoomData(socket, room) {
  try {
    let data;

    switch (room) {
      case 'market':
        data = await krakenService.getMarketOverview();
        socket.emit('market_update', data);
        break;

      case 'portfolio':
        const balance = await krakenService.getBalance();
        const prices = await krakenService.getCurrentPrices();
        data = { balance, prices };
        socket.emit('portfolio_update', data);
        break;

      case 'trading':
        const recentTrades = await krakenService.getTradeHistory({ limit: 10 });
        socket.emit('trade_update', { recent: recentTrades });
        break;

      case 'trends':
        const top20 = await krakenService.getTop20Assets();
        socket.emit('trends_update', top20);
        break;
    }
  } catch (error) {
    logger.error(`Error sending initial data for room ${room}:`, error);
    socket.emit('error', { message: `Failed to load ${room} data` });
  }
}

/**
 * Handle RPC-style API requests over WebSocket
 */
async function handleApiRequest(endpoint, method, params) {
  // Route the request to appropriate service
  switch (endpoint) {
    case '/account/balance':
      return await krakenService.getBalance();

    case '/market/prices':
      return await krakenService.getCurrentPrices(params.pairs);

    case '/market/top20':
      return await krakenService.getTop20Assets();

    case '/portfolio/overview':
      const balance = await krakenService.getBalance();
      const prices = await krakenService.getCurrentPrices();
      return { balance, prices };

    case '/dca/status':
      return await dcaService.getStatus();

    case '/dca/strategies':
      return await dcaService.getAllStrategies();

    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

/**
 * Broadcast market updates to all clients in market room
 */
export async function broadcastMarketUpdate(data) {
  if (!global.io) return;

  try {
    global.io.to('market').emit('market_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Also send to subscribed topics
    global.io.to('topic:market').emit('market_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.debug('Market update broadcast');
  } catch (error) {
    logger.error('Error broadcasting market update:', error);
  }
}

/**
 * Broadcast portfolio updates
 */
export async function broadcastPortfolioUpdate(data) {
  if (!global.io) return;

  try {
    global.io.to('portfolio').emit('portfolio_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    global.io.to('topic:portfolio').emit('portfolio_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.debug('Portfolio update broadcast');
  } catch (error) {
    logger.error('Error broadcasting portfolio update:', error);
  }
}

/**
 * Broadcast trade updates
 */
export async function broadcastTradeUpdate(data) {
  if (!global.io) return;

  try {
    global.io.to('trading').emit('trade_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    global.io.to('topic:trades').emit('trade_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.debug('Trade update broadcast');
  } catch (error) {
    logger.error('Error broadcasting trade update:', error);
  }
}

/**
 * Broadcast system alerts
 */
export async function broadcastSystemAlert(alert) {
  if (!global.io) return;

  try {
    global.io.emit('system_alert', {
      ...alert,
      timestamp: new Date().toISOString(),
    });

    logger.info(`System alert broadcast: ${alert.message}`);
  } catch (error) {
    logger.error('Error broadcasting system alert:', error);
  }
}

/**
 * Broadcast DCA execution events
 */
export async function broadcastDCAExecution(execution) {
  if (!global.io) return;

  try {
    global.io.to('trading').emit('dca_execution', {
      ...execution,
      timestamp: new Date().toISOString(),
    });

    global.io.to('topic:dca').emit('dca_execution', {
      ...execution,
      timestamp: new Date().toISOString(),
    });

    logger.info(`DCA execution broadcast: ${execution.strategyId}`);
  } catch (error) {
    logger.error('Error broadcasting DCA execution:', error);
  }
}

/**
 * Start periodic data broadcasts
 */
function startPeriodicBroadcasts(io) {
  // Broadcast market updates every 30 seconds
  setInterval(async () => {
    try {
      if (io.sockets.adapter.rooms.has('market')) {
        const marketData = await krakenService.getMarketOverview();
        await broadcastMarketUpdate(marketData);
      }
    } catch (error) {
      logger.error('Error in periodic market broadcast:', error);
    }
  }, 30000);

  // Broadcast portfolio updates every 60 seconds
  setInterval(async () => {
    try {
      if (io.sockets.adapter.rooms.has('portfolio')) {
        const balance = await krakenService.getBalance();
        const prices = await krakenService.getCurrentPrices();
        await broadcastPortfolioUpdate({ balance, prices });
      }
    } catch (error) {
      logger.error('Error in periodic portfolio broadcast:', error);
    }
  }, 60000);

  logger.info('Periodic WebSocket broadcasts started');
}

// Export broadcast functions for use in other modules
export {
  broadcastMarketUpdate as emitMarketUpdate,
  broadcastPortfolioUpdate as emitPortfolioUpdate,
  broadcastTradeUpdate as emitTradeUpdate,
  broadcastSystemAlert as emitSystemAlert,
  broadcastDCAExecution as emitDCAExecution,
};
