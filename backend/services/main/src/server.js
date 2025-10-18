import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes/index.js';
import { setupWebSocket } from './websocket/index.js';
import { logger } from './utils/logger.js';
import { initializeDCA } from './services/dcaService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://dalydough.web.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://dalydough.web.app'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Setup routes
setupRoutes(app);

// Setup WebSocket
setupWebSocket(io);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 DalyKraken Backend Server running on port ${PORT}`);
  logger.info(`📊 WebSocket server ready`);
  logger.info(`🔗 REST API available at http://localhost:${PORT}/api`);

  // Initialize DCA service if enabled
  if (process.env.DCA_ENABLED === 'true') {
    initializeDCA(io);
    logger.info('🤖 DCA service initialized');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, io };
