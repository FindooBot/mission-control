/**
 * Dashboard Routes
 * Main dashboard view and API
 */

const express = require('express');
const DatabaseManager = require('../database/database');
const configManager = require('../config/manager');

/**
 * Create dashboard router with scheduler instance
 */
function createDashboardRouter(scheduler) {
  const router = express.Router();
  const db = new DatabaseManager();

  /**
   * GET / - Main dashboard
   */
  router.get('/', (req, res) => {
    const config = configManager.getConfig();
    
    // If not configured, redirect to setup
    if (!config.isConfigured) {
      return res.redirect('/setup');
    }
    
    // Get initial data for server-side rendering
    const data = db.getDashboardData();
    
    res.render('dashboard', {
      config: config,
      title: 'Mission Control',
      initialData: data,
      lastUpdated: new Date().toISOString()
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

  /**
   * GET /api/data - Get dashboard data (AJAX endpoint)
   */
  router.get('/api/data', (req, res) => {
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

  /**
   * GET /settings - Settings page
   */
  router.get('/settings', (req, res) => {
    const config = configManager.getConfig();
    
    // Mask sensitive data for display
    const safeConfig = {
      calendar: {
        personalIcalUrl: config.calendar?.personalIcalUrl || '',
        workIcalUrl: config.calendar?.workIcalUrl || ''
      },
      shortcut: {
        apiToken: config.shortcut?.apiToken ? '••••••••' : '',
        workspaceName: config.shortcut?.workspaceName || ''
      },
      github: {
        personalAccessToken: config.github?.personalAccessToken ? '••••••••' : '',
        privateRepo: config.github?.privateRepo || 'KimonoIM/web',
        useGhCli: config.github?.useGhCli !== false
      },
      todoist: {
        apiToken: config.todoist?.apiToken ? '••••••••' : ''
      }
    };
    
    res.render('settings', {
      title: 'Settings - Mission Control',
      config: safeConfig,
      isConfigured: config.isConfigured,
      query: req.query
    });
  });

  /**
   * POST /settings/update - Update settings
   */
  router.post('/settings/update', (req, res) => {
    try {
      // Only update fields that were provided (not masked placeholders)
      const currentConfig = configManager.getConfig();
      const updates = {};
      
      if (req.body.personalIcalUrl !== undefined) {
        updates.personalIcalUrl = req.body.personalIcalUrl;
      }
      if (req.body.workIcalUrl !== undefined) {
        updates.workIcalUrl = req.body.workIcalUrl;
      }
      if (req.body.shortcutApiToken && !req.body.shortcutApiToken.includes('•')) {
        updates.shortcutApiToken = req.body.shortcutApiToken;
      } else if (req.body.shortcutApiToken === '') {
        updates.shortcutApiToken = '';
      }
      if (req.body.shortcutWorkspaceName !== undefined) {
        updates.shortcutWorkspaceName = req.body.shortcutWorkspaceName;
      }
      if (req.body.githubToken && !req.body.githubToken.includes('•')) {
        updates.githubToken = req.body.githubToken;
      } else if (req.body.githubToken === '') {
        updates.githubToken = '';
      }
      if (req.body.githubRepo !== undefined) {
        updates.githubRepo = req.body.githubRepo;
      }
      updates.useGhCli = req.body.useGhCli === 'on';
      
      if (req.body.todoistToken && !req.body.todoistToken.includes('•')) {
        updates.todoistToken = req.body.todoistToken;
      } else if (req.body.todoistToken === '') {
        updates.todoistToken = '';
      }
      
      // Merge with current config values for fields not updated
      const formData = {
        personalIcalUrl: updates.personalIcalUrl !== undefined ? updates.personalIcalUrl : currentConfig.calendar?.personalIcalUrl,
        workIcalUrl: updates.workIcalUrl !== undefined ? updates.workIcalUrl : currentConfig.calendar?.workIcalUrl,
        shortcutApiToken: updates.shortcutApiToken !== undefined ? updates.shortcutApiToken : currentConfig.shortcut?.apiToken,
        shortcutWorkspaceName: updates.shortcutWorkspaceName !== undefined ? updates.shortcutWorkspaceName : currentConfig.shortcut?.workspaceName,
        githubToken: updates.githubToken !== undefined ? updates.githubToken : currentConfig.github?.personalAccessToken,
        githubRepo: updates.githubRepo !== undefined ? updates.githubRepo : currentConfig.github?.privateRepo,
        useGhCli: updates.useGhCli,
        todoistToken: updates.todoistToken !== undefined ? updates.todoistToken : currentConfig.todoist?.apiToken
      };
      
      configManager.updateFromForm(formData);
      
      // Restart scheduler with new config
      if (scheduler) {
        scheduler.restart();
        console.log('🔄 Scheduler restarted after settings update');
      }
      
      res.redirect('/settings?success=true');
    } catch (error) {
      res.redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
  });

  return router;
}

module.exports = createDashboardRouter;
