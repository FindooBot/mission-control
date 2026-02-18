/**
 * Mission Control - Main Server
 * Express server with first-run setup wizard
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const Database = require('./database/database');
const configManager = require('./config/manager');

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
const db = new Database();

// Routes
const setupRoutes = require('./routes/setup');
const dashboardRoutes = require('./routes/dashboard');

// Setup middleware to check config
app.use((req, res, next) => {
  const config = configManager.getConfig();
  
  // Allow setup routes and static assets always
  if (req.path.startsWith('/setup') || req.path.startsWith('/css') || req.path.startsWith('/js')) {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mission Control running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  
  const config = configManager.getConfig();
  if (!config.isConfigured) {
    console.log(`⚙️  First run detected - visit http://localhost:${PORT}/setup to configure`);
  }
});

module.exports = app;
