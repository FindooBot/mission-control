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
    this.user = null;
  }

  /**
   * Get current user info and cache user ID
   */
  async getCurrentUser() {
    try {
      const response = await this.client.get('/member');
      this.userId = response.data.id;
      this.user = response.data;
      return response.data;
    } catch (error) {
      console.error('Failed to get Shortcut user:', error.message);
      throw error;
    }
  }

  /**
   * Get stories where user is owner
   */
  async getMyStories() {
    try {
      if (!this.userId) {
        await this.getCurrentUser();
      }

      console.log(`Fetching Shortcut stories for user ${this.userId} (${this.user?.name || 'unknown'})`);

      // Try multiple approaches to get stories
      let stories = [];

      // Approach 1: Search for stories with owner_id filter
      try {
        const response = await this.client.get('/search/stories', {
          params: {
            query: '',  // Empty query, filter by owner
            page_size: 50
          }
        });

        // Filter stories where user is owner
        const allStories = response.data.data || [];
        stories = allStories.filter(story => {
          const owners = story.owner_ids || [];
          return owners.includes(this.userId) || story.requested_by_id === this.userId;
        });

        console.log(`Found ${stories.length} stories from search`);
      } catch (searchError) {
        console.error('Search approach failed:', searchError.message);
      }

      // Approach 2: If search failed, try fetching all stories and filtering
      if (stories.length === 0) {
        try {
          console.log('Trying direct stories endpoint...');
          const response = await this.client.get('/stories', {
            params: {
              page_size: 100
            }
          });

          const allStories = response.data || [];
          stories = allStories.filter(story => {
            const owners = story.owner_ids || [];
            return owners.includes(this.userId) || story.requested_by_id === this.userId;
          });

          console.log(`Found ${stories.length} stories from direct endpoint`);
        } catch (directError) {
          console.error('Direct approach failed:', directError.message);
        }
      }

      // Filter for active stories (not completed/archived)
      const activeStories = stories.filter(story => 
        story.completed === false && 
        story.archived === false
      );

      console.log(`Found ${activeStories.length} active stories assigned to user`);

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
      return [];
    }
  }

  /**
   * Get unread notifications - Note: This endpoint may not exist in all Shortcut plans
   */
  async getNotifications() {
    try {
      console.log('Fetching Shortcut notifications...');

      // Try the notifications endpoint
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
      // Notifications API might not be available on all plans
      if (error.response?.status === 404) {
        console.log('Shortcut notifications endpoint not available (may require different plan)');
      } else {
        console.error('Failed to fetch Shortcut notifications:', error.message);
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
