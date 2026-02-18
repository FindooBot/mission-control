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
      timeout: 15000
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
      console.log(`Shortcut user: ${this.user?.name} (${this.userId})`);
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

      let stories = [];

      // Approach 1: Get all stories and filter by owner (most reliable)
      try {
        console.log('Fetching all stories and filtering by owner...');
        // Get stories with workflow_state_id filter to exclude completed
        const response = await this.client.post('/stories/search', {
          archived: false,
          page_size: 100
        });

        const allStories = response.data.data || [];
        console.log(`Fetched ${allStories.length} total stories`);

        // Filter for stories where user is an owner
        stories = allStories.filter(story => {
          const owners = story.owner_ids || [];
          const isOwner = owners.includes(this.userId);
          if (isOwner) {
            console.log(`  → Found owned story: ${story.name.substring(0, 50)}`);
          }
          return isOwner;
        });

        console.log(`Found ${stories.length} stories owned by user`);
      } catch (err1) {
        console.log('Stories search failed:', err1.message);
      }

      // Approach 2: If no stories found, try the stories endpoint with different params
      if (stories.length === 0) {
        try {
          console.log('Trying /stories endpoint...');
          const response = await this.client.get('/stories', {
            params: {
              page_size: 100
            }
          });

          const allStories = response.data || [];
          console.log(`Fetched ${allStories.length} stories from /stories`);

          stories = allStories.filter(story => {
            const owners = story.owner_ids || [];
            return owners.includes(this.userId);
          });

          console.log(`Found ${stories.length} stories owned by user`);
        } catch (err2) {
          console.log('/stories endpoint failed:', err2.message);
        }
      }

      // Approach 3: Try getting user's workspace info
      if (stories.length === 0) {
        try {
          console.log('Trying to get stories from workspace...');
          const response = await this.client.get('/search/stories', {
            params: {
              query: '',
              page_size: 100
            }
          });

          const allStories = response.data.data || [];
          stories = allStories.filter(story => {
            const owners = story.owner_ids || [];
            return owners.includes(this.userId);
          });

          console.log(`Found ${stories.length} stories from workspace search`);
        } catch (err3) {
          console.log('Workspace search failed:', err3.message);
        }
      }

      // Filter for active stories (not completed/archived)
      const activeStories = stories.filter(story => 
        story.completed !== true && 
        story.archived !== true
      );

      console.log(`Returning ${activeStories.length} active stories`);

      return activeStories.map(story => ({
        story_id: story.id,
        name: story.name,
        description: story.description || '',
        story_type: story.story_type,
        state: story.workflow_state_name || 'Unknown',
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
   */
  async getNotifications() {
    console.log('Shortcut notifications not available via API');
    return [];
  }

  /**
   * Mark a notification as read - Not implemented
   */
  async markNotificationRead(notificationId) {
    return true;
  }

  /**
   * Mark all notifications as read - Not implemented
   */
  async markAllNotificationsRead() {
    return true;
  }
}

module.exports = ShortcutService;
