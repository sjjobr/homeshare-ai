/**
 * backend/src/server.js
 * Express server entry point for HomeShare AI.
 */

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

// Route handlers
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const listingRoutes      = require('./routes/listings');
const matchRoutes        = require('./routes/matches');
const appointmentRoutes  = require('./routes/appointments');
const messageRoutes      = require('./routes/messages');
const tavusRoutes        = require('./routes/tavus');

const app  = express();
const PORT = process.env.PORT || 4000;

// Trust the platform proxy (Vercel/Railway/etc) so req.ip and rate limiting
// pick up the real client IP from X-Forwarded-For instead of the load balancer.
app.set('trust proxy', 1);

// -----------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));

// Raw body for Tavus webhook signature verification
app.use('/api/tavus/webhook', express.raw({ type: 'application/json' }));

// JSON body parser for all other routes
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// -----------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/listings',     listingRoutes);
app.use('/api/matches',      matchRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/tavus',        tavusRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// -----------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------
// On Vercel, the platform invokes the exported Express app directly — no listen().
// In local dev (no VERCEL env var) we start the HTTP server.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`HomeShare AI API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
