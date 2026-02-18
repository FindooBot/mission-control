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
      console.log(`Shortcut user: ${this.user.name} (${this.userId})`);
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

      console.log(`Fetching Shortcut stories for user ${this.userId}...`);

      // Use search with owner filter - try different query formats
      let stories = [];

      // Approach 1: Search with owner:me
      try {
        console.log('Trying search with owner:me...');
        const response = await this.client.get('/search/stories', {
          params: {
            query: 'owner:me',
            page_size: 50
          }
        });

        stories = response.data.data || [];
        console.log(`Found ${stories.length} stories with owner:me search`);
      } catch (err1) {
        console.log('owner:me search failed:', err1.message);
        
        // Approach 2: Search with specific user ID
        try {
          console.log(`Trying search with owner:${this.userId}...`);
          const response = await this.client.get('/search/stories', {
            params: {
              query: `owner:${this.userId}`,
              page_size: 50
            }
          });

          stories = response.data.data || [];
          console.log(`Found ${stories.length} stories with owner ID search`);
        } catch (err2) {
          console.log('owner ID search failed:', err2.message);
        }
      }

      // Approach 3: Get user's workspace stories via member endpoint
      if (stories.length === 0) {
        try {
          console.log('Trying member endpoint...');
          const response = await this.client.get(`/member`);
          const workspace2 = response.data.workspace2;
          
          if (workspace2?.stories) {
            stories = workspace2.stories;
            console.log(`Found ${stories.length} stories from member endpoint`);
          }
        } catch (err3) {
          console.log('Member endpoint failed:', err3.message);
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
   * Get unread activity - Note: Shortcut doesn't have a traditional notifications API
   * Instead we can look at recent activity on user's stories
   */
  async getNotifications() {
    try {
      console.log('Fetching Shortcut activity...');

      // Get recent stories and check for updates
      const stories = await this.getMyStories();
      const notifications = [];

      // Check for stories with recent updates that aren't by the user
      for (const story of stories) {
        // If story was updated recently and has comments/activity
        // This is a simplified approach - Shortcut doesn't have a true notifications API
      }

      console.log('Shortcut activity check complete (no notifications API available)');
      return [];
    } catch (error) {
      console.log('Shortcut notifications not available:', error.message);
      return [];
    }
  }

  /**
   * Mark a notification as read - Not implemented (no notifications API)
   */
  async markNotificationRead(notificationId) {
    return true; // No-op since we don't have real notifications
  }

  /**
   * Mark all notifications as read - Not implemented (no notifications API)
   */
  async markAllNotificationsRead() {
    return true; // No-op since we don't have real notifications
  }
}

module.exports = ShortcutService;
