/**
 * Shortcut Service
 * Interacts with Shortcut (formerly Clubhouse) REST API v3
 */

const axios = require('axios');

const SHORTCUT_API_BASE = 'https://api.app.shortcut.com/api/v3';

class ShortcutService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL: SHORTCUT_API_BASE,
      headers: {
        'Shortcut-Token': apiToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    this.userId = null;
  }

  /**
   * Get current user info and cache user ID
   */
  async getCurrentUser() {
    try {
      const response = await this.client.get('/member');
      this.userId = response.data.id;
      return response.data;
    } catch (error) {
      console.error('Failed to get Shortcut user:', error.message);
      throw error;
    }
  }

  /**
   * Get stories where user is owner using search API
   */
  async getMyStories() {
    try {
      if (!this.userId) {
        await this.getCurrentUser();
      }

      // Use search endpoint to find stories owned by current user
      // Search query: owner:me state:unstarted,started
      const response = await this.client.get('/search/stories', {
        params: {
          query: `owner:me is:story`,
          page_size: 25
        }
      });

      const stories = response.data.data || [];

      // Filter for active stories (not completed/archived)
      const activeStories = stories.filter(story => 
        story.completed === false && 
        story.archived === false
      );

      return activeStories.map(story => ({
        story_id: story.id,
        name: story.name,
        description: story.description || '',
        story_type: story.story_type,
        state: story.workflow_state_name || story.workflow_state_id,
        workflow_state_id: story.workflow_state_id,
        project_id: story.project_id,
        epic_id: story.epic_id,
        owner_ids: JSON.stringify(story.owner_ids || []),
        requested_by_id: story.requested_by_id,
        estimate: story.estimate,
        deadline: story.deadline,
        started_at: story.started_at,
        completed_at: story.completed_at,
        created_at: story.created_at,
        updated_at: story.updated_at,
        url: story.app_url || `https://app.shortcut.com/story/${story.id}`
      }));
    } catch (error) {
      console.error('Failed to fetch Shortcut stories:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return [];
    }
  }

  /**
   * Get unread notifications for mentions and assignments
   */
  async getNotifications() {
    try {
      const response = await this.client.get('/notifications');

      // Filter for unread notifications
      const unreadNotifications = response.data.filter(
        notification => notification.read === false
      );

      return unreadNotifications.map(notification => ({
        notification_id: notification.id.toString(),
        type: notification.type,
        story_id: notification.story_id,
        epic_id: notification.epic_id,
        actor_id: notification.actor_id,
        actor_name: notification.actor?.name || 'Unknown',
        message: notification.text || notification.message || '',
        read: notification.read ? 1 : 0,
        notified_at: notification.updated_at || notification.created_at
      }));
    } catch (error) {
      console.error('Failed to fetch Shortcut notifications:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
      }
      return [];
    }
  }

  /**
   * Mark a notification as read
   */
  async markNotificationRead(notificationId) {
    try {
      await this.client.put(`/notifications/${notificationId}`, {
        read: true
      });
      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error.message);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead() {
    try {
      await this.client.put('/notifications', {
        read: true
      });
      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error.message);
      return false;
    }
  }
}

module.exports = ShortcutService;
