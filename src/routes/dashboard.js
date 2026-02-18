/**
 * Dashboard Routes
 * Main dashboard view
 */

const express = require('express');
const router = express.Router();
const configManager = require('../config/manager');

/**
 * GET / - Main dashboard
 */
router.get('/', (req, res) => {
  const config = configManager.getConfig();
  
  // If not configured, redirect to setup
  if (!config.isConfigured) {
    return res.redirect('/setup');
  }
  
  res.render('dashboard', {
    config: config,
    title: 'Mission Control'
  });
});

/**
 * GET /api/config - Get current configuration (excluding secrets)
 */
router.get('/api/config', (req, res) => {
  const config = configManager.getConfig();
  
  // Return sanitized config (no secrets)
  res.json({
    isConfigured: config.isConfigured,
    calendar: {
      hasPersonalCalendar: !!config.calendar?.personalIcalUrl,
      hasWorkCalendar: !!config.calendar?.workIcalUrl
    },
    shortcut: {
      hasToken: !!config.shortcut?.apiToken,
      workspaceName: config.shortcut?.workspaceName
    },
    github: {
      hasToken: !!config.github?.personalAccessToken,
      privateRepo: config.github?.privateRepo,
      useGhCli: config.github?.useGhCli
    },
    todoist: {
      hasToken: !!config.todoist?.apiToken
    }
  });
});

module.exports = router;
