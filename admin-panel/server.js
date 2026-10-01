const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const express = require('express');
const cors = require('cors');
const pool = require('./lib/db');
const { initDatabase } = require('./lib/initDb');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const adminLoginRouter = require('./routes/adminLogin');
const announcementsRouter = require('./routes/announcements');
const notificationsRouter = require('./routes/notifications');
const deviceTokensRouter = require('./routes/deviceTokens');
const adminNotificationsRouter = require('./routes/adminNotifications');
const walletRouter = require('./routes/wallet');
const playersRouter = require('./routes/players');
const settingsRouter = require('./routes/settings');
const bannersRouter = require('./routes/banners');
const contestsRouter = require('./routes/contests');
const gamesRouter = require('./routes/games');
const matchesRouter = require('./routes/matches');
const rulesRouter = require('./routes/rules');
const matchBannersRouter = require('./routes/matchBanners');
const publicMatchesRouter = require('./routes/publicMatches');
const { staffRouter, managementRouter: staffManagementRouter } = require('./routes/staff');
const { uploadRoot } = require('./lib/uploads');

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';
const staffPanelHost = normalizeHostname(process.env.STAFF_PANEL_HOST);
const allowedCorsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
let server;
let isShuttingDown = false;

function normalizeHostname(value = '') {
  if (!value.trim()) return '';
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
app.use('/api/wallet/zapupi-webhook', express.raw({
  type: ['application/json', 'application/x-www-form-urlencoded'],
  limit: '100kb',
}), (req, res, next) => {
  req.rawBody = Buffer.from(req.body || []);
  try {
    req.body = req.is('application/json')
      ? JSON.parse(req.rawBody.toString('utf8'))
      : Object.fromEntries(new URLSearchParams(req.rawBody.toString('utf8')));
    next();
  } catch {
    res.status(400).json({ error: 'Invalid webhook body.' });
  }
});
app.use(express.json());
app.use((req, res, next) => {
  if (!staffPanelHost || normalizeHostname(req.get('host')) !== staffPanelHost) return next();
  if (req.path === '/' || req.path === '/index.html') {
    return res.redirect('/stuff-admin-panel/login.html');
  }
  if (req.path.startsWith('/api/')) {
    const staffApi = req.path === '/api/staff' || req.path.startsWith('/api/staff/');
    const matchApi = req.path === '/api/admin/matches' || req.path.startsWith('/api/admin/matches/')
      || req.path === '/api/matches' || req.path.startsWith('/api/matches/');
    if (staffApi || matchApi) return next();
    return res.status(404).json({ error: 'This API endpoint is not available on the staff domain.' });
  }
  const staffAsset = req.path === '/app.js' || req.path === '/styles.css'
    || req.path === '/stuff-admin-panel' || req.path.startsWith('/stuff-admin-panel/')
    || req.path.startsWith('/uploads/');
  return staffAsset ? next() : res.redirect('/stuff-admin-panel/login.html');
});
app.use('/uploads', express.static(uploadRoot));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/stuff-admin-panel', express.static(path.join(__dirname, '..', 'stuff-admin-panel')));
app.get('/stuff-admin-panel', (_req, res) => res.redirect('/stuff-admin-panel/login.html'));
app.get('/stuff-admin-panel/', (_req, res) => res.redirect('/stuff-admin-panel/login.html'));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'mysql' });
  } catch (error) {
    console.error(error);
    res.status(503).json({ ok: false, database: 'mysql' });
  }
});

app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin/auth', adminLoginRouter);
app.use('/api/staff', staffRouter);
app.use('/api/admin/staff', staffManagementRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/notifications', deviceTokensRouter);
app.use('/api/admin/notifications', adminNotificationsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/players', playersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/contests', contestsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/admin', matchesRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/match-banners', matchBannersRouter);
app.use('/api/matches', publicMatchesRouter);

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function closeServer() {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }

    server.close(() => resolve());
  });
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} received — shutting down...`);

  closeServer()
    .then(() => pool.end())
    .finally(() => process.exit(0));

  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function listen() {
  await closeServer();

  return new Promise((resolve, reject) => {
    const nextServer = app.listen(port, host, () => {
      server = nextServer;
      console.log(`Node backend running at http://localhost:${port}`);
      if (host === '0.0.0.0') {
        console.log(`Also reachable on your local network at http://<your-ip>:${port}`);
      }
      resolve();
    });

    nextServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. The existing backend may already be running.`);
        reject(error);
        return;
      }

      reject(error);
    });
  });
}

async function start() {
  try {
    await pool.query('SELECT 1');
    await initDatabase();
    await listen();
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) {
          console.log(`Backend is already running at http://localhost:${port}`);
          await pool.end();
          process.exit(0);
        }
      } catch {
        // The port is occupied by another process, not this backend.
      }
    }

    if (error.code !== 'EADDRINUSE') {
      console.error('Backend startup failed. Check MySQL connectivity and database schema.');
      console.error(error.message);
    }
    process.exit(1);
  }
}

start();
