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
    
    console.log('📁 Database initialized at', DB_PATH);
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
        review_requested BOOLEAN DEFAULT 0
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

    console.log('✅ Database tables created');
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
