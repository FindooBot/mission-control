/**
 * Setup Routes
 * First-run configuration wizard
 */

const express = require('express');
const router = express.Router();
const configManager = require('../config/manager');

/**
 * GET /setup - Show setup form
 */
router.get('/', (req, res) => {
  const config = configManager.getConfig();
  
  // If already configured, redirect to dashboard
  if (config.isConfigured) {
    return res.redirect('/');
  }
  
  res.render('setup', { 
    config: config,
    error: null,
    success: false 
  });
});

/**
 * POST /setup - Save configuration
 */
router.post('/', (req, res) => {
  try {
    const result = configManager.updateFromForm(req.body);
    
    if (result) {
      res.render('setup', {
        config: configManager.getConfig(),
        error: null,
        success: true
      });
    } else {
      res.render('setup', {
        config: configManager.getConfig(),
        error: 'Failed to save configuration. Please try again.',
        success: false
      });
    }
  } catch (error) {
    console.error('Setup error:', error);
    res.render('setup', {
      config: configManager.getConfig(),
      error: error.message,
      success: false
    });
  }
});

/**
 * GET /setup/success - Redirect to dashboard after successful setup
 */
router.get('/success', (req, res) => {
  res.redirect('/');
});

module.exports = router;
