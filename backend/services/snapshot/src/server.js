import express from 'express';
import axios from 'axios';
import cron from 'node-cron';
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
const PORT = process.env.PORT || 5002;
const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:5001/api';
const SNAPSHOT_DIR = path.join(__dirname, '../../../data/snapshots');
const SNAPSHOT_INTERVAL = process.env.SNAPSHOT_INTERVAL || '*/30 * * * * *'; // Every 30 seconds

// Ensure snapshot directory exists
await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

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

// In-memory cache for latest snapshot
let latestSnapshot = null;

// Fetch data from main API
async function fetchFromMainAPI(endpoint) {
  try {
    const response = await axios.get(`${MAIN_API_URL}${endpoint}`, {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    logger.error(`Failed to fetch ${endpoint}:`, error.message);
    return null;
  }
}

// Create a complete snapshot
async function createSnapshot() {
  logger.info('Creating snapshot...');

  const timestamp = new Date().toISOString();
  const snapshot = {
    timestamp,
    version: '2.0.0',
    data: {
      account: await fetchFromMainAPI('/account/info'),
      portfolio: await fetchFromMainAPI('/portfolio/overview'),
      market: await fetchFromMainAPI('/market/overview'),
      dcaStatus: await fetchFromMainAPI('/dca/status'),
      riskStatus: await fetchFromMainAPI('/portfolio/risk-status'),
      scannerData: await fetchFromMainAPI('/scanner/opportunities'),
    },
  };

  // Save versioned snapshot
  const filename = `snapshot_${Date.now()}.json`;
  const filepath = path.join(SNAPSHOT_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));

  // Update latest pointer
  const latestPath = path.join(SNAPSHOT_DIR, 'latest.json');
  await fs.writeFile(latestPath, JSON.stringify(snapshot, null, 2));

  // Update in-memory cache
  latestSnapshot = snapshot;

  logger.info(`Snapshot created: ${filename}`);

  // Cleanup old snapshots (keep last 100)
  await cleanupOldSnapshots();

  return snapshot;
}

// Cleanup old snapshots
async function cleanupOldSnapshots() {
  try {
    const files = await fs.readdir(SNAPSHOT_DIR);
    const snapshotFiles = files
      .filter((f) => f.startsWith('snapshot_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (snapshotFiles.length > 100) {
      const toDelete = snapshotFiles.slice(100);
      for (const file of toDelete) {
        await fs.unlink(path.join(SNAPSHOT_DIR, file));
      }
      logger.info(`Cleaned up ${toDelete.length} old snapshots`);
    }
  } catch (error) {
    logger.error('Failed to cleanup snapshots:', error);
  }
}

// API Endpoints

// Get latest snapshot
app.get('/latest', (req, res) => {
  if (!latestSnapshot) {
    return res.status(503).json({ error: 'No snapshot available yet' });
  }
  res.json(latestSnapshot);
});

// Get specific data from latest snapshot
app.get('/account', (req, res) => {
  if (!latestSnapshot?.data?.account) {
    return res.status(503).json({ error: 'Account data not available' });
  }
  res.json(latestSnapshot.data.account);
});

app.get('/portfolio', (req, res) => {
  if (!latestSnapshot?.data?.portfolio) {
    return res.status(503).json({ error: 'Portfolio data not available' });
  }
  res.json(latestSnapshot.data.portfolio);
});

app.get('/market', (req, res) => {
  if (!latestSnapshot?.data?.market) {
    return res.status(503).json({ error: 'Market data not available' });
  }
  res.json(latestSnapshot.data.market);
});

app.get('/dca-status', (req, res) => {
  if (!latestSnapshot?.data?.dcaStatus) {
    return res.status(503).json({ error: 'DCA status not available' });
  }
  res.json(latestSnapshot.data.dcaStatus);
});

app.get('/risk', (req, res) => {
  if (!latestSnapshot?.data?.riskStatus) {
    return res.status(503).json({ error: 'Risk status not available' });
  }
  res.json(latestSnapshot.data.riskStatus);
});

app.get('/scanner', (req, res) => {
  if (!latestSnapshot?.data?.scannerData) {
    return res.status(503).json({ error: 'Scanner data not available' });
  }
  res.json(latestSnapshot.data.scannerData);
});

// List all snapshots
app.get('/snapshots', async (req, res) => {
  try {
    const files = await fs.readdir(SNAPSHOT_DIR);
    const snapshots = files
      .filter((f) => f.startsWith('snapshot_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 50); // Return last 50

    res.json({ snapshots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

// Get specific snapshot by filename
app.get('/snapshots/:filename', async (req, res) => {
  try {
    const filepath = path.join(SNAPSHOT_DIR, req.params.filename);
    const data = await fs.readFile(filepath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(404).json({ error: 'Snapshot not found' });
  }
});

// Force create snapshot
app.post('/snapshot', async (req, res) => {
  try {
    const snapshot = await createSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    latestSnapshot: latestSnapshot?.timestamp || null,
  });
});

// Schedule periodic snapshots
cron.schedule(SNAPSHOT_INTERVAL, async () => {
  try {
    await createSnapshot();
  } catch (error) {
    logger.error('Scheduled snapshot failed:', error);
  }
});

// Initial snapshot on startup
createSnapshot().catch((error) => {
  logger.error('Initial snapshot failed:', error);
});

app.listen(PORT, () => {
  logger.info(`📸 Snapshot Service running on port ${PORT}`);
  logger.info(`📂 Snapshots saved to: ${SNAPSHOT_DIR}`);
  logger.info(`⏱️  Snapshot interval: ${SNAPSHOT_INTERVAL}`);
});

export default app;
