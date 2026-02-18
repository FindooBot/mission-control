/**
 * Database Layer
 * SQLite database using better-sqlite3
 * Tables: calendar_events, shortcut_stories, shortcut_notifications, github_prs, github_notifications, todoist_tasks
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'mission-control.db');

class DatabaseManager {
  constructor() {
    this.initDatabase();
  }

  /**
   * Initialize database directory and connection
   */
  initDatabase() {
    // Ensure data directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // Open database connection
    this.db = new Database(DB_PATH);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    this.createTables();
    
    // Run migrations
    this.runMigrations();
    
    console.log('📁 Database initialized at', DB_PATH);
  }

  /**
   * Run migrations for schema updates
   */
  runMigrations() {
    try {
      // Migration: Add review columns to github_prs if they don't exist
      const tableInfo = this.db.prepare("PRAGMA table_info(github_prs)").all();
      const columns = tableInfo.map(col => col.name);
      
      if (!columns.includes('has_approval')) {
        this.db.exec(`ALTER TABLE github_prs ADD COLUMN has_approval BOOLEAN DEFAULT 0`);
        console.log('🔄 Migration: Added has_approval column to github_prs');
      }
      
      if (!columns.includes('has_changes_requested')) {
        this.db.exec(`ALTER TABLE github_prs ADD COLUMN has_changes_requested BOOLEAN DEFAULT 0`);
        console.log('🔄 Migration: Added has_changes_requested column to github_prs');
      }
      
      if (!columns.includes('review_count')) {
        this.db.exec(`ALTER TABLE github_prs ADD COLUMN review_count INTEGER DEFAULT 0`);
        console.log('🔄 Migration: Added review_count column to github_prs');
      }
    } catch (error) {
      console.error('Migration error:', error.message);
    }
  }

  /**
   * Create all required tables
   */
  createTables() {
    // Calendar Events
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        summary TEXT,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        location TEXT,
        calendar_type TEXT CHECK(calendar_type IN ('personal', 'work')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
      CREATE INDEX IF NOT EXISTS idx_calendar_type ON calendar_events(calendar_type);
    `);

    // Shortcut Stories
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shortcut_stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        story_type TEXT,
        state TEXT,
        workflow_state_id INTEGER,
        project_id INTEGER,
        epic_id INTEGER,
        owner_ids TEXT,
        requested_by_id INTEGER,
        estimate INTEGER,
        deadline DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_stories_state ON shortcut_stories(state);
      CREATE INDEX IF NOT EXISTS idx_stories_deadline ON shortcut_stories(deadline);
    `);

    // Shortcut Notifications
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shortcut_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id TEXT UNIQUE NOT NULL,
        type TEXT,
        story_id INTEGER,
        epic_id INTEGER,
        actor_id INTEGER,
        actor_name TEXT,
        message TEXT,
        read BOOLEAN DEFAULT 0,
        notified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON shortcut_notifications(read);
      CREATE INDEX IF NOT EXISTS idx_notifications_story ON shortcut_notifications(story_id);
    `);

    // GitHub PRs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS github_prs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id INTEGER UNIQUE NOT NULL,
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        state TEXT,
        repo_owner TEXT,
        repo_name TEXT,
        author_login TEXT,
        author_avatar TEXT,
        head_branch TEXT,
        base_branch TEXT,
        draft BOOLEAN DEFAULT 0,
        mergeable BOOLEAN,
        merged BOOLEAN DEFAULT 0,
        merged_at DATETIME,
        created_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        html_url TEXT,
        review_requested BOOLEAN DEFAULT 0,
        has_approval BOOLEAN DEFAULT 0,
        has_changes_requested BOOLEAN DEFAULT 0,
        review_count INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_prs_state ON github_prs(state);
      CREATE INDEX IF NOT EXISTS idx_prs_review ON github_prs(review_requested);
      CREATE INDEX IF NOT EXISTS idx_prs_updated ON github_prs(updated_at);
    `);

    // GitHub Notifications
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS github_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id TEXT UNIQUE NOT NULL,
        thread_id TEXT,
        reason TEXT,
        unread BOOLEAN DEFAULT 1,
        subject_title TEXT,
        subject_type TEXT,
        subject_url TEXT,
        repository_name TEXT,
        repository_owner TEXT,
        updated_at DATETIME,
        last_read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_gh_notif_unread ON github_notifications(unread);
      CREATE INDEX IF NOT EXISTS idx_gh_notif_updated ON github_notifications(updated_at);
    `);

    // Todoist Tasks
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS todoist_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        project_id TEXT,
        section_id TEXT,
        parent_id TEXT,
        priority INTEGER DEFAULT 1,
        due_date DATETIME,
        due_datetime DATETIME,
        due_string TEXT,
        is_completed BOOLEAN DEFAULT 0,
        labels TEXT,
        assignee_id TEXT,
        creator_id TEXT,
        created_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        url TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_todoist_completed ON todoist_tasks(is_completed);
      CREATE INDEX IF NOT EXISTS idx_todoist_due ON todoist_tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_todoist_priority ON todoist_tasks(priority);
    `);

    // Figma Notifications
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS figma_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id TEXT UNIQUE NOT NULL,
        file_key TEXT NOT NULL,
        file_name TEXT,
        comment_id TEXT,
        message TEXT,
        author TEXT,
        author_img TEXT,
        created_at DATETIME,
        is_mention BOOLEAN DEFAULT 0,
        is_reply BOOLEAN DEFAULT 0,
        url TEXT,
        read BOOLEAN DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_figma_unread ON figma_notifications(read);
      CREATE INDEX IF NOT EXISTS idx_figma_created ON figma_notifications(created_at);
    `);

    console.log('✅ Database tables created');
  }

  /**
   * Insert or update calendar events
   */
  upsertCalendarEvents(events) {
    const stmt = this.db.prepare(`
      INSERT INTO calendar_events 
        (uid, summary, description, start_time, end_time, location, calendar_type)
      VALUES 
        (@uid, @summary, @description, @start_time, @end_time, @location, @calendar_type)
      ON CONFLICT(uid) DO UPDATE SET
        summary = excluded.summary,
        description = excluded.description,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        location = excluded.location,
        calendar_type = excluded.calendar_type,
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((events) => {
      for (const event of events) {
        stmt.run(event);
      }
    });

    insertMany(events);
    console.log(`📅 Synced ${events.length} calendar events`);
  }

  /**
   * Insert or update Shortcut stories
   */
  upsertShortcutStories(stories) {
    const stmt = this.db.prepare(`
      INSERT INTO shortcut_stories 
        (story_id, name, description, story_type, state, workflow_state_id, project_id, 
         epic_id, owner_ids, requested_by_id, estimate, deadline, started_at, completed_at, 
         created_at)
      VALUES 
        (@story_id, @name, @description, @story_type, @state, @workflow_state_id, @project_id,
         @epic_id, @owner_ids, @requested_by_id, @estimate, @deadline, @started_at, @completed_at,
         @created_at)
      ON CONFLICT(story_id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        story_type = excluded.story_type,
        state = excluded.state,
        workflow_state_id = excluded.workflow_state_id,
        project_id = excluded.project_id,
        epic_id = excluded.epic_id,
        owner_ids = excluded.owner_ids,
        estimate = excluded.estimate,
        deadline = excluded.deadline,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((stories) => {
      for (const story of stories) {
        stmt.run(story);
      }
    });

    insertMany(stories);
    console.log(`🚀 Synced ${stories.length} Shortcut stories`);
  }

  /**
   * Clear all Shortcut stories (used before fetching fresh data)
   */
  clearShortcutStories() {
    this.db.exec('DELETE FROM shortcut_stories');
    console.log('🗑️ Cleared Shortcut stories from database');
  }

  /**
   * Insert or update Shortcut notifications
   */
  upsertShortcutNotifications(notifications) {
    const stmt = this.db.prepare(`
      INSERT INTO shortcut_notifications 
        (notification_id, type, story_id, epic_id, actor_id, actor_name, message, read, notified_at)
      VALUES 
        (@notification_id, @type, @story_id, @epic_id, @actor_id, @actor_name, @message, @read, @notified_at)
      ON CONFLICT(notification_id) DO UPDATE SET
        type = excluded.type,
        message = excluded.message,
        read = excluded.read,
        notified_at = excluded.notified_at,
        created_at = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((notifications) => {
      for (const notif of notifications) {
        stmt.run(notif);
      }
    });

    insertMany(notifications);
    console.log(`🔔 Synced ${notifications.length} Shortcut notifications`);
  }

  /**
   * Insert or update GitHub PRs
   */
  upsertGitHubPRs(prs) {
    const stmt = this.db.prepare(`
      INSERT INTO github_prs 
        (pr_id, number, title, body, state, repo_owner, repo_name, author_login, 
         author_avatar, head_branch, base_branch, draft, mergeable, merged, merged_at,
         created_at, updated_at, html_url, review_requested, has_approval, has_changes_requested, review_count)
      VALUES 
        (@pr_id, @number, @title, @body, @state, @repo_owner, @repo_name, @author_login,
         @author_avatar, @head_branch, @base_branch, @draft, @mergeable, @merged, @merged_at,
         @created_at, @updated_at, @html_url, @review_requested, @has_approval, @has_changes_requested, @review_count)
      ON CONFLICT(pr_id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        state = excluded.state,
        author_login = excluded.author_login,
        author_avatar = excluded.author_avatar,
        draft = excluded.draft,
        mergeable = excluded.mergeable,
        merged = excluded.merged,
        merged_at = excluded.merged_at,
        updated_at = excluded.updated_at,
        review_requested = excluded.review_requested,
        has_approval = excluded.has_approval,
        has_changes_requested = excluded.has_changes_requested,
        review_count = excluded.review_count
    `);

    const insertMany = this.db.transaction((prs) => {
      for (const pr of prs) {
        stmt.run(pr);
      }
    });

    insertMany(prs);
    console.log(`🐙 Synced ${prs.length} GitHub PRs`);
  }

  /**
   * Clear all GitHub PRs (used before fetching fresh data)
   */
  clearGitHubPRs() {
    this.db.exec('DELETE FROM github_prs');
    console.log('🗑️ Cleared GitHub PRs from database');
  }

  /**
   * Insert or update GitHub notifications
   */
  upsertGitHubNotifications(notifications) {
    const stmt = this.db.prepare(`
      INSERT INTO github_notifications 
        (notification_id, thread_id, reason, unread, subject_title, subject_type, 
         subject_url, repository_name, repository_owner, updated_at, last_read_at)
      VALUES 
        (@notification_id, @thread_id, @reason, @unread, @subject_title, @subject_type,
         @subject_url, @repository_name, @repository_owner, @updated_at, @last_read_at)
      ON CONFLICT(notification_id) DO UPDATE SET
        reason = excluded.reason,
        unread = excluded.unread,
        subject_title = excluded.subject_title,
        updated_at = excluded.updated_at,
        last_read_at = excluded.last_read_at
    `);

    const insertMany = this.db.transaction((notifications) => {
      for (const notif of notifications) {
        stmt.run(notif);
      }
    });

    insertMany(notifications);
    console.log(`🔔 Synced ${notifications.length} GitHub notifications`);
  }

  /**
   * Insert or update Todoist tasks
   */
  upsertTodoistTasks(tasks) {
    const stmt = this.db.prepare(`
      INSERT INTO todoist_tasks 
        (task_id, content, description, project_id, section_id, parent_id, priority,
         due_date, due_datetime, due_string, is_completed, labels, assignee_id, 
         creator_id, created_at, url)
      VALUES 
        (@task_id, @content, @description, @project_id, @section_id, @parent_id, @priority,
         @due_date, @due_datetime, @due_string, @is_completed, @labels, @assignee_id,
         @creator_id, @created_at, @url)
      ON CONFLICT(task_id) DO UPDATE SET
        content = excluded.content,
        description = excluded.description,
        priority = excluded.priority,
        due_date = excluded.due_date,
        due_datetime = excluded.due_datetime,
        due_string = excluded.due_string,
        is_completed = excluded.is_completed,
        labels = excluded.labels,
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((tasks) => {
      for (const task of tasks) {
        stmt.run(task);
      }
    });

    insertMany(tasks);
    console.log(`✅ Synced ${tasks.length} Todoist tasks`);
  }

  /**
   * Clear all Todoist tasks (used before fetching fresh data)
   */
  clearTodoistTasks() {
    this.db.exec('DELETE FROM todoist_tasks');
    console.log('🗑️ Cleared Todoist tasks from database');
  }

  /**
   * Clear all Figma notifications (used before fetching fresh data)
   */
  clearFigmaNotifications() {
    this.db.exec('DELETE FROM figma_notifications');
    console.log('🗑️ Cleared Figma notifications from database');
  }

  /**
   * Insert or update Figma notifications
   */
  upsertFigmaNotifications(notifications) {
    const stmt = this.db.prepare(`
      INSERT INTO figma_notifications 
        (notification_id, file_key, file_name, comment_id, message, author, 
         author_img, created_at, is_mention, is_reply, url, read)
      VALUES 
        (@notification_id, @file_key, @file_name, @comment_id, @message, @author,
         @author_img, @created_at, @is_mention, @is_reply, @url, @read)
      ON CONFLICT(notification_id) DO UPDATE SET
        message = excluded.message,
        read = excluded.read,
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((notifications) => {
      for (const notif of notifications) {
        stmt.run(notif);
      }
    });

    insertMany(notifications);
    console.log(`🎨 Synced ${notifications.length} Figma notifications`);
  }

  /**
   * Get all data for dashboard
   */
  getDashboardData() {
    const today = new Date().toISOString().split('T')[0];
    
    return {
      // Today's calendar events
      calendar: this.db.prepare(`
        SELECT * FROM calendar_events 
        WHERE date(start_time) = date('now')
        ORDER BY start_time ASC
      `).all(),

      // Active Shortcut stories
      shortcutStories: this.db.prepare(`
        SELECT * FROM shortcut_stories 
        WHERE completed_at IS NULL
        ORDER BY deadline ASC NULLS LAST, updated_at DESC
      `).all(),

      // Unread Shortcut notifications
      shortcutNotifications: this.db.prepare(`
        SELECT * FROM shortcut_notifications 
        WHERE read = 0
        ORDER BY notified_at DESC
      `).all(),

      // Open GitHub PRs
      githubPRs: this.db.prepare(`
        SELECT * FROM github_prs 
        WHERE state = 'open'
        ORDER BY updated_at DESC
      `).all(),

      // Unread GitHub notifications
      githubNotifications: this.db.prepare(`
        SELECT * FROM github_notifications 
        WHERE unread = 1
        ORDER BY updated_at DESC
      `).all(),

      // Todoist tasks due today or overdue
      todoistTasks: this.db.prepare(`
        SELECT * FROM todoist_tasks 
        WHERE is_completed = 0 
          AND (due_date IS NULL OR due_date >= date('now'))
        ORDER BY 
          CASE WHEN due_date = date('now') THEN 0 ELSE 1 END,
          priority DESC,
          created_at ASC
      `).all(),

      // Figma notifications
      figmaNotifications: this.db.prepare(`
        SELECT * FROM figma_notifications 
        WHERE read = 0
        ORDER BY created_at DESC
      `).all()
    };
  }

  /**
   * Get database instance
   */
  getDb() {
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('📁 Database connection closed');
    }
  }
}

module.exports = DatabaseManager;
