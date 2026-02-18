/**
 * Dashboard JavaScript
 * Handles dynamic loading, real-time updates, dark mode, and PR review integration
 */

// Global state
let dashboardData = null;
let lastUpdated = null;
let autoRefreshInterval = null;
const REFRESH_INTERVAL = 60000; // 60 seconds

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Mission Control Dashboard loaded');
  
  // Initialize theme
  initTheme();
  
  // Load initial data from server-rendered JSON
  loadInitialData();
  
  // Initialize dashboard
  initDashboard();
  
  // Set up event listeners
  setupEventListeners();
});

/**
 * Initialize theme toggle and respect system preference
 */
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');
  
  // Check for saved preference or system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    setTheme('dark');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    setTheme('light');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Load initial data embedded in the page
 */
function loadInitialData() {
  const dataScript = document.getElementById('initialData');
  if (dataScript) {
    try {
      dashboardData = JSON.parse(dataScript.textContent);
      console.log('Initial data loaded:', dashboardData);
    } catch (e) {
      console.error('Failed to parse initial data:', e);
      dashboardData = {
        calendar: [],
        shortcutStories: [],
        shortcutNotifications: [],
        githubPRs: [],
        githubNotifications: [],
        todoistTasks: []
      };
    }
  }
}

/**
 * Initialize dashboard
 */
function initDashboard() {
  // Render widgets with initial data
  renderAllWidgets();
  
  // Update last updated timestamp
  updateLastUpdated();
  
  // Set up auto-refresh
  startAutoRefresh();
  
  // Load config status
  loadConfigStatus();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Refresh link
  const refreshLink = document.getElementById('refreshLink');
  if (refreshLink) {
    refreshLink.addEventListener('click', (e) => {
      e.preventDefault();
      manualRefresh();
    });
  }
}

/**
 * Start auto-refresh interval
 */
function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  autoRefreshInterval = setInterval(() => {
    refreshData();
  }, REFRESH_INTERVAL);
  
  console.log(`Auto-refresh enabled (${REFRESH_INTERVAL / 1000}s interval)`);
}

/**
 * Manual refresh trigger
 */
async function manualRefresh() {
  showToast('Refreshing data...', 'info');
  await refreshData();
  showToast('Data refreshed!', 'success');
}

/**
 * Fetch fresh data from API
 */
async function refreshData() {
  try {
    const response = await fetch('/api/data');
    const result = await response.json();
    
    if (result.success) {
      dashboardData = result.data;
      lastUpdated = result.lastUpdated;
      
      renderAllWidgets();
      updateLastUpdated();
    } else {
      console.error('API error:', result.error);
    }
  } catch (error) {
    console.error('Failed to refresh data:', error);
    showToast('Failed to refresh data', 'error');
  }
}

/**
 * Update last updated timestamp display
 */
function updateLastUpdated() {
  const element = document.getElementById('lastUpdated');
  if (element) {
    const time = lastUpdated || new Date().toISOString();
    element.textContent = `Last updated: ${timeAgo(time)}`;
  }
}

/**
 * Render all widgets
 */
function renderAllWidgets() {
  if (!dashboardData) return;
  
  renderCalendarWidget();
  renderTodoistWidget();
  renderShortcutWidget();
  renderGitHubWidget();
}

/**
 * Render Calendar widget
 */
function renderCalendarWidget() {
  const container = document.getElementById('calendarContent');
  const countElement = document.getElementById('calendarCount');
  const events = dashboardData.calendar || [];
  
  // Update count
  countElement.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;
  if (events.length > 0) {
    countElement.classList.add('has-items');
  }
  
  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>No events today</p>
        <span class="empty-state-help">Your calendar is free!</span>
      </div>
    `;
    return;
  }
  
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.start_time) - new Date(b.start_time)
  );
  
  const html = sortedEvents.map(event => {
    const startTime = formatTime(event.start_time);
    const endTime = event.end_time ? formatTime(event.end_time) : null;
    const duration = event.end_time ? formatDuration(event.start_time, event.end_time) : 'All day';
    const calendarClass = event.calendar_type === 'work' ? 'work' : '';
    
    return `
      <div class="calendar-event" onclick="openLink('${event.uid || ''}')">
        <div class="event-time">
          <div class="event-time-start">${startTime}</div>
          ${endTime ? `<div class="event-time-end">${endTime}</div>` : ''}
          <div class="event-duration">${duration}</div>
        </div>
        <div class="event-details">
          <div class="event-title">${escapeHtml(event.summary || 'Untitled')}</div>
          ${event.location ? `<div class="event-location">📍 ${escapeHtml(event.location)}</div>` : ''}
          <span class="event-calendar-type ${calendarClass}">${event.calendar_type || 'personal'}</span>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `<ul class="calendar-list">${html}</ul>`;
}

/**
 * Render Todoist widget
 */
function renderTodoistWidget() {
  const container = document.getElementById('todoistContent');
  const countElement = document.getElementById('todoistCount');
  const tasks = dashboardData.todoistTasks || [];
  
  // Update count
  const activeCount = tasks.filter(t => !t.is_completed).length;
  countElement.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''}`;
  if (activeCount > 0) {
    countElement.classList.add('has-items');
  }
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <p>No tasks</p>
        <span class="empty-state-help">Add tasks in Todoist</span>
      </div>
    `;
    return;
  }
  
  // Sort tasks: today first, then by priority
  const sortedTasks = [...tasks].sort((a, b) => {
    const aDueToday = isDueToday(a);
    const bDueToday = isDueToday(b);
    if (aDueToday && !bDueToday) return -1;
    if (!aDueToday && bDueToday) return 1;
    return (b.priority || 1) - (a.priority || 1);
  });
  
  const html = sortedTasks.slice(0, 10).map(task => {
    const completed = task.is_completed ? 'completed' : '';
    const dueClass = getDueClass(task);
    const dueText = getDueText(task);
    
    return `
      <div class="todoist-task ${completed}" onclick="toggleTask('${task.task_id}', ${task.is_completed})" data-task-id="${task.task_id}">
        <div class="task-checkbox"></div>
        <div class="task-info">
          <div class="task-content">${escapeHtml(task.content)}</div>
          <div class="task-meta">
            <div class="task-priority priority-${task.priority || 1}"></div>
            ${dueText ? `<span class="task-due ${dueClass}">${dueText}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `<ul class="todoist-list">${html}</ul>`;
}

/**
 * Render Shortcut widget
 */
function renderShortcutWidget() {
  const container = document.getElementById('shortcutContent');
  const countElement = document.getElementById('shortcutCount');
  const stories = dashboardData.shortcutStories || [];
  const notifications = dashboardData.shortcutNotifications || [];
  
  // Update count with notification badge
  countElement.textContent = `${stories.length} stor${stories.length !== 1 ? 'ies' : 'y'}`;
  if (stories.length > 0) {
    countElement.classList.add('has-items');
  }
  if (notifications.length > 0) {
    countElement.classList.add('has-notifications');
    countElement.textContent = `${stories.length} (${notifications.length})`;
  }
  
  if (stories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚀</div>
        <p>No active stories</p>
        <span class="empty-state-help">You're all caught up!</span>
      </div>
    `;
    return;
  }
  
  // Sort by deadline (urgent first), then updated
  const sortedStories = [...stories].sort((a, b) => {
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    return new Date(b.updated_at) - new Date(a.updated_at);
  });
  
  const html = sortedStories.slice(0, 10).map(story => {
    const deadlineClass = isUrgent(story.deadline) ? 'urgent' : '';
    const deadlineText = story.deadline ? `Due ${formatDate(story.deadline)}` : '';
    const storyUrl = story.url || `https://app.shortcut.com/story/${story.story_id}`;
    
    return `
      <div class="shortcut-story" onclick="openLink('${storyUrl}')">
        <div class="story-header">
          <span class="story-id">#${story.story_id}</span>
          <span class="story-type ${story.story_type}">${story.story_type || 'story'}</span>
        </div>
        <div class="story-name">${escapeHtml(story.name)}</div>
        <div class="story-meta">
          <span class="story-state">${escapeHtml(story.state || 'In Progress')}</span>
          ${deadlineText ? `<span class="story-deadline ${deadlineClass}">⏰ ${deadlineText}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `<ul class="shortcut-list">${html}</ul>`;
}

/**
 * Render GitHub widget
 */
function renderGitHubWidget() {
  const container = document.getElementById('githubContent');
  const countElement = document.getElementById('githubCount');
  const prs = dashboardData.githubPRs || [];
  const notifications = dashboardData.githubNotifications || [];
  
  // Update count with notification badge
  countElement.textContent = `${prs.length} PR${prs.length !== 1 ? 's' : ''}`;
  if (prs.length > 0) {
    countElement.classList.add('has-items');
  }
  if (notifications.length > 0) {
    countElement.classList.add('has-notifications');
    countElement.textContent = `${prs.length} (${notifications.length})`;
  }
  
  if (prs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🐙</div>
        <p>No open PRs</p>
        <span class="empty-state-help">All pull requests are merged!</span>
      </div>
    `;
    return;
  }
  
  // Sort by updated date
  const sortedPRs = [...prs].sort((a, b) => 
    new Date(b.updated_at) - new Date(a.updated_at)
  );
  
  const html = sortedPRs.slice(0, 10).map(pr => {
    const draftBadge = pr.draft ? '<span class="pr-draft-badge">Draft</span>' : '';
    const timeAgoText = timeAgo(pr.updated_at);
    
    return `
      <div class="github-pr">
        <div class="pr-header">
          <span class="pr-repo">${escapeHtml(pr.repo_owner)}/${escapeHtml(pr.repo_name)}</span>
          <span class="pr-number">#${pr.number}</span>
          ${draftBadge}
        </div>
        <div class="pr-title" onclick="openLink('${pr.html_url}')">${escapeHtml(pr.title)}</div>
        <div class="pr-footer">
          <div class="pr-author">
            ${pr.author_avatar ? `<img src="${pr.author_avatar}" alt="" class="pr-author-avatar">` : ''}
            <span>${escapeHtml(pr.author_login)}</span>
          </div>
          <span class="pr-time">${timeAgoText}</span>
          <button class="btn btn-review" onclick="copyReviewPrompt(event, '${pr.html_url}', '${escapeHtml(pr.title)}')">Review with Claude</button>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `<ul class="github-list">${html}</ul>`;
}

/**
 * Copy PR review prompt to clipboard (Phase 4)
 */
function copyReviewPrompt(event, prUrl, prTitle) {
  event.stopPropagation();
  
  const prompt = `Review this PR: ${prUrl}

Please analyze:
1. Code quality and potential bugs
2. Architecture and design patterns
3. Test coverage
4. Security considerations

Fetch the PR diff and any related context using your GitHub MCP tools, then provide specific, actionable feedback.`;

  navigator.clipboard.writeText(prompt).then(() => {
    showToast('Review prompt copied! Paste into Claude Desktop.', 'success');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy prompt', 'error');
  });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Toggle task completion (stub - would need API endpoint)
 */
function toggleTask(taskId, currentState) {
  console.log('Toggle task:', taskId, !currentState);
  // This would call an API endpoint to toggle the task
  showToast('Task toggled (refresh to see changes)', 'info');
}

/**
 * Open external link
 */
function openLink(url) {
  if (url) {
    window.open(url, '_blank');
  }
}

/**
 * Load config status
 */
async function loadConfigStatus() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    
    console.log('Config loaded:', config);
    
    // Show warnings for unconfigured services
    if (!config.shortcut.hasToken) {
      console.log('⚠️ Shortcut not configured');
    }
    if (!config.github.hasToken) {
      console.log('⚠️ GitHub not configured');
    }
    if (!config.todoist.hasToken) {
      console.log('⚠️ Todoist not configured');
    }
    
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format time for display
 */
function formatTime(dateString) {
  if (!dateString) return 'All day';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format duration for display
 */
function formatDuration(startTime, endTime) {
  if (!endTime) return 'All day';
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Get relative time (e.g., "2h ago")
 */
function timeAgo(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Check if task is due today
 */
function isDueToday(task) {
  if (!task.due_date) return false;
  const today = new Date().toISOString().split('T')[0];
  return task.due_date === today;
}

/**
 * Check if task is overdue
 */
function isOverdue(task) {
  if (!task.due_date) return false;
  const today = new Date().toISOString().split('T')[0];
  return task.due_date < today;
}

/**
 * Get CSS class for due date
 */
function getDueClass(task) {
  if (isOverdue(task)) return 'overdue';
  if (isDueToday(task)) return 'today';
  return '';
}

/**
 * Get display text for due date
 */
function getDueText(task) {
  if (!task.due_date) return '';
  if (isDueToday(task)) return 'Today';
  if (isOverdue(task)) return `Overdue`;
  return formatDate(task.due_date);
}

/**
 * Check if deadline is urgent (within 2 days)
 */
function isUrgent(deadline) {
  if (!deadline) return false;
  const due = new Date(deadline);
  const now = new Date();
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);
  return diffDays <= 2;
}
