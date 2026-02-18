/**
 * Mission Control - Main Server
 * Express server with first-run setup wizard and scheduled data fetching
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const DatabaseManager = require('./database/database');
const configManager = require('./config/manager');
const Scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 1337;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// View engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// Initialize database
const db = new DatabaseManager();

// Initialize scheduler
const scheduler = new Scheduler();

// Routes
const setupRoutes = require('./routes/setup');
const dashboardRoutes = require('./routes/dashboard');

// Setup middleware to check config
app.use((req, res, next) => {
  const config = configManager.getConfig();
  
  // Allow setup routes and static assets always
  if (req.path.startsWith('/setup') || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/api')) {
    return next();
  }
  
  // Redirect to setup if not configured
  if (!config.isConfigured && req.path !== '/') {
    return res.redirect('/setup');
  }
  
  next();
});

// Mount routes
app.use('/setup', setupRoutes);
app.use('/', dashboardRoutes);

// API endpoint for manual fetch trigger
app.post('/api/fetch/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const times = await scheduler.manualFetch(service);
    res.json({ success: true, lastFetchTimes: times });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// API endpoint for data (used by dashboard AJAX)
app.get('/api/data', (req, res) => {
  try {
    const data = db.getDashboardData();
    res.json({
      success: true,
      data: data,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    schedulerRunning: scheduler.isRunning,
    lastFetchTimes: scheduler.getLastFetchTimes()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mission Control running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  
  const config = configManager.getConfig();
  if (!config.isConfigured) {
    console.log(`⚙️  First run detected - visit http://localhost:${PORT}/setup to configure`);
  } else {
    // Start scheduler if configured
    scheduler.start();
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  scheduler.stop();
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  scheduler.stop();
  db.close();
  process.exit(0);
});

module.exports = app;
