import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

const app = express();
const PORT = process.env.PORT || 5055;
const DATA_DIR = path.join(__dirname, '../../../data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshots', 'latest.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// In-memory cache
let cachedSnapshot = null;
let lastSnapshotLoad = 0;
const CACHE_TTL = 5000; // 5 seconds

// Load snapshot from file
async function loadSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && now - lastSnapshotLoad < CACHE_TTL) {
    return cachedSnapshot;
  }

  try {
    const data = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    cachedSnapshot = JSON.parse(data);
    lastSnapshotLoad = now;
    return cachedSnapshot;
  } catch (error) {
    logger.error('Failed to load snapshot:', error.message);
    return null;
  }
}

// Load recent events
async function loadRecentEvents(limit = 100) {
  try {
    const data = await fs.readFile(EVENTS_FILE, 'utf8');
    const lines = data.trim().split('\n');
    const events = lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return events;
  } catch (error) {
    logger.error('Failed to load events:', error.message);
    return [];
  }
}

// Compatibility endpoints (match main API structure)

app.get('/account-info', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot?.data?.account) {
      return res.status(503).json({ error: 'Account data not available' });
    }
    res.json(snapshot.data.account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/portfolio', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot?.data?.portfolio) {
      return res.status(503).json({ error: 'Portfolio data not available' });
    }
    res.json(snapshot.data.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/market-overview', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot?.data?.market) {
      return res.status(503).json({ error: 'Market data not available' });
    }
    res.json(snapshot.data.market);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/risk-status', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot?.data?.riskStatus) {
      return res.status(503).json({ error: 'Risk status not available' });
    }
    res.json(snapshot.data.riskStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/scanner-data', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot?.data?.scannerData) {
      return res.status(503).json({ error: 'Scanner data not available' });
    }
    res.json(snapshot.data.scannerData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/dca-status', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot?.data?.dcaStatus) {
      return res.status(503).json({ error: 'DCA status not available' });
    }
    res.json(snapshot.data.dcaStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Raw snapshot endpoint
app.get('/snapshot', async (req, res) => {
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot) {
      return res.status(503).json({ error: 'Snapshot not available' });
    }
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Events endpoint
app.get('/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const events = await loadRecentEvents(limit);
    res.json({ events, count: events.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recent events by type
app.get('/events/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const allEvents = await loadRecentEvents(limit * 2);
    const filteredEvents = allEvents.filter((e) => e.type === type).slice(0, limit);
    res.json({ events: filteredEvents, count: filteredEvents.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const snapshot = await loadSnapshot();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    snapshotAvailable: !!snapshot,
    snapshotAge: snapshot ? Date.now() - new Date(snapshot.timestamp).getTime() : null,
  });
});

// Cache stats
app.get('/stats', async (req, res) => {
  const snapshot = await loadSnapshot();
  const events = await loadRecentEvents(10);

  res.json({
    snapshot: {
      available: !!snapshot,
      timestamp: snapshot?.timestamp || null,
      version: snapshot?.version || null,
      ageMs: snapshot ? Date.now() - new Date(snapshot.timestamp).getTime() : null,
    },
    events: {
      recentCount: events.length,
      lastEventTime: events[events.length - 1]?.timestamp || null,
    },
    cache: {
      ttl: CACHE_TTL,
      lastLoad: lastSnapshotLoad ? new Date(lastSnapshotLoad).toISOString() : null,
    },
  });
});

// Clear cache
app.post('/clear-cache', (req, res) => {
  cachedSnapshot = null;
  lastSnapshotLoad = 0;
  logger.info('Cache cleared');
  res.json({ success: true, message: 'Cache cleared' });
});

app.listen(PORT, () => {
  logger.info(`💾 Cache API Service running on port ${PORT}`);
  logger.info(`📂 Data directory: ${DATA_DIR}`);
  logger.info(`⚡ Cache TTL: ${CACHE_TTL}ms`);
});

export default app;
