/**
 * Service Integrations
 * Placeholder services for external API calls
 */

class CalendarService {
  constructor(config) {
    this.config = config;
  }

  async fetchEvents() {
    // TODO: Implement iCal parsing
    console.log('CalendarService: Fetch events not implemented');
    return [];
  }
}

class ShortcutService {
  constructor(config) {
    this.config = config;
  }

  async fetchStories() {
    // TODO: Implement Shortcut API calls
    console.log('ShortcutService: Fetch stories not implemented');
    return [];
  }

  async fetchNotifications() {
    // TODO: Implement Shortcut notifications
    console.log('ShortcutService: Fetch notifications not implemented');
    return [];
  }
}

class GitHubService {
  constructor(config) {
    this.config = config;
  }

  async fetchPRs() {
    // TODO: Implement GitHub PR fetching
    console.log('GitHubService: Fetch PRs not implemented');
    return [];
  }

  async fetchNotifications() {
    // TODO: Implement GitHub notifications
    console.log('GitHubService: Fetch notifications not implemented');
    return [];
  }
}

class TodoistService {
  constructor(config) {
    this.config = config;
  }

  async fetchTasks() {
    // TODO: Implement Todoist API calls
    console.log('TodoistService: Fetch tasks not implemented');
    return [];
  }
}

module.exports = {
  CalendarService,
  ShortcutService,
  GitHubService,
  TodoistService
};
