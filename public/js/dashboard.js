/**
 * Dashboard JavaScript
 * Handles dynamic loading and real-time updates
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Mission Control Dashboard loaded');
  
  // Initialize dashboard
  initDashboard();
});

function initDashboard() {
  // Load configuration status
  loadConfigStatus();
  
  // Set up auto-refresh (every 60 seconds)
  setInterval(() => {
    refreshWidgets();
  }, 60000);
}

async function loadConfigStatus() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    
    console.log('Config loaded:', config);
    
    // Update connection indicators
    updateConnectionStatus('calendar', config.calendar.hasPersonalCalendar || config.calendar.hasWorkCalendar);
    updateConnectionStatus('shortcut', config.shortcut.hasToken);
    updateConnectionStatus('github', config.github.hasToken);
    updateConnectionStatus('todoist', config.todoist.hasToken);
    
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

function updateConnectionStatus(service, isConnected) {
  const widget = document.querySelector(`.widget-${service}`);
  if (widget) {
    const badge = widget.querySelector('.widget-count');
    if (badge) {
      badge.style.background = isConnected ? 'rgba(52, 199, 89, 0.1)' : 'var(--bg-primary)';
      badge.style.color = isConnected ? '#34C759' : 'var(--text-secondary)';
    }
  }
}

async function refreshWidgets() {
  console.log('Refreshing widgets...');
  // TODO: Implement widget refresh logic
  // This will fetch data from API endpoints once implemented
}

// Utility function for formatting dates
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Utility function for relative time
function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
