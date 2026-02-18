/**
 * Dashboard Routes
 * Main dashboard view and API
 */

const express = require('express');
const DatabaseManager = require('../database/database');
const configManager = require('../config/manager');
const GitHubService = require('../services/github');
const ShortcutService = require('../services/shortcut');
const TodoistService = require('../services/todoist');
const FigmaService = require('../services/figma');

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

  /**
   * POST /api/notifications/github/:id/read - Mark GitHub notification as read
   */
  router.post('/api/notifications/github/:id/read', async (req, res) => {
    try {
      const config = configManager.getConfig();
      if (!config.github?.personalAccessToken) {
        return res.status(400).json({ success: false, error: 'GitHub not configured' });
      }

      const github = new GitHubService(config.github);
      const result = await github.markNotificationRead(req.params.id);

      if (result) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: 'Failed to mark as read' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/notifications/github/read-all - Mark all GitHub notifications as read
   */
  router.post('/api/notifications/github/read-all', async (req, res) => {
    try {
      const config = configManager.getConfig();
      if (!config.github?.personalAccessToken) {
        return res.status(400).json({ success: false, error: 'GitHub not configured' });
      }

      // Mark all as read via API
      const github = new GitHubService(config.github);

      // Get current notifications and mark each as read
      const notifications = await github.getNotifications();
      for (const notif of notifications) {
        await github.markNotificationRead(notif.thread_id);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/notifications/shortcut/:id/read - Mark Shortcut notification as read
   */
  router.post('/api/notifications/shortcut/:id/read', async (req, res) => {
    try {
      const config = configManager.getConfig();
      if (!config.shortcut?.apiToken) {
        return res.status(400).json({ success: false, error: 'Shortcut not configured' });
      }

      const shortcut = new ShortcutService(config.shortcut.apiToken);
      const result = await shortcut.markNotificationRead(req.params.id);

      if (result) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: 'Failed to mark as read' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/notifications/shortcut/read-all - Mark all Shortcut notifications as read
   */
  router.post('/api/notifications/shortcut/read-all', async (req, res) => {
    try {
      const config = configManager.getConfig();
      if (!config.shortcut?.apiToken) {
        return res.status(400).json({ success: false, error: 'Shortcut not configured' });
      }

      const shortcut = new ShortcutService(config.shortcut.apiToken);
      const result = await shortcut.markAllNotificationsRead();

      if (result) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: 'Failed to mark all as read' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/todoist/tasks/:id/complete - Complete a Todoist task
   */
  router.post('/api/todoist/tasks/:id/complete', async (req, res) => {
    try {
      const config = configManager.getConfig();
      if (!config.todoist?.apiToken) {
        return res.status(400).json({ success: false, error: 'Todoist not configured' });
      }

      const todoist = new TodoistService(config.todoist.apiToken);
      const result = await todoist.completeTask(req.params.id);

      if (result) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: 'Failed to complete task' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/todoist/tasks - Create a new Todoist task
   */
  router.post('/api/todoist/tasks', async (req, res) => {
    try {
      const config = configManager.getConfig();
      if (!config.todoist?.apiToken) {
        return res.status(400).json({ success: false, error: 'Todoist not configured' });
      }

      const { content, due_date, priority } = req.body;
      
      if (!content) {
        return res.status(400).json({ success: false, error: 'Task content is required' });
      }

      const todoist = new TodoistService(config.todoist.apiToken);
      
      const options = {};
      if (due_date) options.due_date = due_date;
      if (priority) options.priority = parseInt(priority);
      
      const task = await todoist.createTask(content, options);
      res.json({ success: true, task });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createDashboardRouter;
