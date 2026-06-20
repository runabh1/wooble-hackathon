const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const QueueEngine = require('./queueEngine');
const { registerSocketHandlers } = require('./socketHandlers');

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// --- Build allowed origins ---
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
].filter(Boolean);

// --- Initialize Express ---
const app = express();
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any Vercel preview or the configured frontend URL
    if (allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    callback(null, true); // Allow all for hackathon demo
  },
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// --- Create HTTP Server ---
const server = http.createServer(app);

// --- Initialize Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      callback(null, true); // Allow all origins for hackathon demo
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

// --- Initialize Queue Engine ---
const queueEngine = new QueueEngine();

// --- Register Socket Handlers ---
registerSocketHandlers(io, queueEngine);

// --- REST API (for health check and basic info) ---
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/state', (req, res) => {
  res.json(queueEngine.getFullState());
});

// --- Serve static files in production ---
const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendBuildPath));
app.get('*', (req, res) => {
  const indexPath = path.join(frontendBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not built yet. Run npm run build in frontend/' });
    }
  });
});

// --- Start Server ---
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        🏥 Queue Cure Server Running         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Port:      ${PORT}                            ║`);
  console.log(`║  Frontend:  ${FRONTEND_URL}       ║`);
  console.log('║  Status:    Ready                            ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  const db = require('./db');
  db.closeDb();
  server.close(() => {
    console.log('[Server] Closed.');
    process.exit(0);
  });
});

module.exports = { app, server, io };
