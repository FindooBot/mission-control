/**
 * Data Scheduler
 * Runs scheduled fetches using node-cron
 * Stores results in SQLite database
 */

const cron = require('node-cron');
const DatabaseManager = require('./database/database');
const ShortcutService = require('./services/shortcut');
const GitHubService = require('./services/github');
const TodoistService = require('./services/todoist');
const CalendarService = require('./services/calendar');
const FigmaService = require('./services/figma');
const configManager = require('./config/manager');

class Scheduler {
  constructor() {
    this.db = new DatabaseManager();
    this.config = configManager.getConfig();
    this.tasks = [];
    this.lastFetchTimes = {
      shortcut: null,
      github: null,
      todoist: null,
      figma: null,
      calendar: null
    };
    this.isRunning = false;
  }

  /**
   * Initialize and start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    if (!this.config.isConfigured) {
      console.log('⚠️ Not configured - scheduler will start after setup');
      return;
    }

    console.log('⏰ Starting data scheduler...');

    // Every 10 min (9am-6pm weekdays): fetch Shortcut, GitHub, Todoist
    this.tasks.push(cron.schedule('*/10 9-17 * * 1-5', () => {
      this.fetchWorkData();
    }, {
      scheduled: true,
      timezone: 'Europe/London'
    }));

    // Every 15 min: fetch Calendars
    this.tasks.push(cron.schedule('*/15 * * * *', () => {
      this.fetchCalendarData();
    }, {
      scheduled: true,
      timezone: 'Europe/London'
    }));

    // Initial fetch
    this.fetchWorkData();
    this.fetchCalendarData();

    this.isRunning = true;
    console.log('✅ Scheduler started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    this.isRunning = false;
    console.log('⏹️ Scheduler stopped');
  }

  /**
   * Restart with new config
   */
  restart() {
    this.stop();
    this.config = configManager.getConfig();
    this.start();
  }

  /**
   * Fetch Shortcut, GitHub, and Todoist data
   */
  async fetchWorkData() {
    console.log('📊 Fetching work data...');
    const startTime = Date.now();

    try {
      // Fetch Shortcut data
      await this.fetchShortcutData();

      // Fetch GitHub data
      await this.fetchGitHubData();

      // Fetch Todoist data
      await this.fetchTodoistData();

      // Fetch Figma data
      await this.fetchFigmaData();

      const duration = Date.now() - startTime;
      console.log(`✅ Work data fetch completed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Error fetching work data:', error.message);
    }
  }

  /**
   * Fetch Shortcut stories and notifications
   */
  async fetchShortcutData() {
    try {
      if (!this.config.shortcut?.apiToken) {
        console.log('⚠️ Shortcut not configured, skipping');
        return;
      }

      console.log('🚀 Fetching Shortcut data...');
      const shortcut = new ShortcutService(this.config.shortcut.apiToken);
      
      // Clear old stories first
      this.db.clearShortcutStories();
      
      // Fetch stories
      const stories = await shortcut.getMyStories();
      
      if (stories.length === 0) {
        console.log('⚠️ No Shortcut stories found for current user');
      } else {
        console.log(`🚀 Fetched ${stories.length} Shortcut stories`);
      }
      
      this.db.upsertShortcutStories(stories);

      // Fetch notifications
      const notifications = await shortcut.getNotifications();
      this.db.upsertShortcutNotifications(notifications);

      this.lastFetchTimes.shortcut = new Date().toISOString();
      console.log('🚀 Shortcut data updated');
    } catch (error) {
      console.error('❌ Shortcut fetch error:', error.message);
    }
  }

  /**
   * Fetch GitHub PRs and notifications
   */
  async fetchGitHubData() {
    try {
      if (!this.config.github?.personalAccessToken) {
        console.log('⚠️ GitHub not configured, skipping');
        return;
      }

      const github = new GitHubService(this.config.github);
      
      // Clear old PRs first
      this.db.clearGitHubPRs();
      
      // Fetch PRs
      const prs = await github.getAllPRs();
      this.db.upsertGitHubPRs(prs);

      // Fetch notifications
      const notifications = await github.getNotifications();
      this.db.upsertGitHubNotifications(notifications);

      this.lastFetchTimes.github = new Date().toISOString();
      console.log('🐙 GitHub data updated');
    } catch (error) {
      console.error('❌ GitHub fetch error:', error.message);
    }
  }

  /**
   * Fetch Todoist tasks
   */
  async fetchTodoistData() {
    try {
      if (!this.config.todoist?.apiToken) {
        console.log('⚠️ Todoist not configured, skipping');
        return;
      }

      console.log('📋 Fetching Todoist tasks...');
      const todoist = new TodoistService(this.config.todoist.apiToken);
      
      // Clear old tasks first
      this.db.clearTodoistTasks();
      
      // Fetch all tasks
      const tasks = await todoist.getTasks();
      
      if (tasks.length === 0) {
        console.log('⚠️ No Todoist tasks returned from API');
      } else {
        console.log(`📋 Fetched ${tasks.length} Todoist tasks`);
      }
      
      this.db.upsertTodoistTasks(tasks);

      this.lastFetchTimes.todoist = new Date().toISOString();
      console.log('✅ Todoist data updated');
    } catch (error) {
      console.error('❌ Todoist fetch error:', error.message);
    }
  }

  /**
   * Fetch Calendar data
   */
  async fetchCalendarData() {
    try {
      const calendarService = new CalendarService();
      
      // Add configured calendars
      if (this.config.calendar?.personalIcalUrl) {
        calendarService.addCalendar('personal', this.config.calendar.personalIcalUrl);
      }
      if (this.config.calendar?.workIcalUrl) {
        calendarService.addCalendar('work', this.config.calendar.workIcalUrl);
      }

      // Fetch and store events
      const events = await calendarService.getAllEvents();
      this.db.upsertCalendarEvents(events);

      this.lastFetchTimes.calendar = new Date().toISOString();
      console.log('📅 Calendar data updated');
    } catch (error) {
      console.error('❌ Calendar fetch error:', error.message);
    }
  }

  /**
   * Fetch Figma notifications
   */
  async fetchFigmaData() {
    try {
      if (!this.config.figma?.apiToken) {
        console.log('⚠️ Figma not configured, skipping');
        return;
      }

      console.log('🎨 Fetching Figma notifications...');
      const figma = new FigmaService(this.config.figma.apiToken);
      
      // Clear old notifications first
      this.db.clearFigmaNotifications();
      
      // Fetch notifications
      const notifications = await figma.getNotifications();
      
      if (notifications.length === 0) {
        console.log('⚠️ No Figma notifications found');
      } else {
        console.log(`🎨 Fetched ${notifications.length} Figma notifications`);
      }
      
      this.db.upsertFigmaNotifications(notifications);

      this.lastFetchTimes.figma = new Date().toISOString();
      console.log('🎨 Figma data updated');
    } catch (error) {
      console.error('❌ Figma fetch error:', error.message);
    }
  }

  /**
   * Manual fetch trigger (for API endpoint)
   */
  async manualFetch(service) {
    switch (service) {
      case 'shortcut':
        await this.fetchShortcutData();
        break;
      case 'github':
        await this.fetchGitHubData();
        break;
      case 'todoist':
        await this.fetchTodoistData();
        break;
      case 'figma':
        await this.fetchFigmaData();
        break;
      case 'calendar':
        await this.fetchCalendarData();
        break;
      case 'all':
        await this.fetchWorkData();
        await this.fetchCalendarData();
        break;
      default:
        throw new Error(`Unknown service: ${service}`);
    }
    return this.lastFetchTimes;
  }

  /**
   * Get last fetch times
   */
  getLastFetchTimes() {
    return this.lastFetchTimes;
  }

  /**
   * Get database manager for querying data
   */
  getDatabase() {
    return this.db;
  }
}

module.exports = Scheduler;
