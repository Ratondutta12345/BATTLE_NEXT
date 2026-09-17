const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const express = require('express');
const cors = require('cors');
const pool = require('./lib/db');
const { initDatabase } = require('./lib/initDb');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const announcementsRouter = require('./routes/announcements');
const notificationsRouter = require('./routes/notifications');
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

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';
let server;
let isShuttingDown = false;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
app.use('/api/announcements', announcementsRouter);
app.use('/api/notifications', notificationsRouter);
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
