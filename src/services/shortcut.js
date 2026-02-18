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
      console.log(`  Workspace: ${this.user?.workspace2?.name || 'unknown'}`);
      
      // Check for member ID (numeric) which might be used in owner_ids
      if (this.user?.member_id) {
        console.log(`  Member ID: ${this.user.member_id}`);
      }
      
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

      // Approach 1: Try to get iterations/sprints and their stories
      try {
        console.log('Trying iterations endpoint...');
        const response = await this.client.get('/iterations');
        const iterations = response.data || [];
        console.log(`Found ${iterations.length} iterations`);

        for (const iteration of iterations.slice(0, 3)) {
          try {
            const storiesResponse = await this.client.get(`/iterations/${iteration.id}/stories`);
            const iterationStories = storiesResponse.data || [];
            const myStories = iterationStories.filter(story => {
              const owners = story.owner_ids || [];
              return owners.includes(this.userId);
            });
            stories.push(...myStories);
          } catch (e) {
            // Ignore
          }
        }
        console.log(`Found ${stories.length} stories from iterations`);
      } catch (err) {
        console.log('Iterations failed:', err.message);
      }

      // Approach 2: Get workflows and filter by workflow state
      if (stories.length === 0) {
        try {
          console.log('Trying workflows...');
          const workflowsResponse = await this.client.get('/workflows');
          const workflows = workflowsResponse.data || [];
          console.log(`Found ${workflows.length} workflows`);

          // Get unstarted and started states
          const activeStateIds = [];
          for (const workflow of workflows) {
            for (const state of workflow.states || []) {
              if (state.type === 'unstarted' || state.type === 'started') {
                activeStateIds.push(state.id);
              }
            }
          }
          console.log(`Found ${activeStateIds.length} active workflow states`);

          // Try to search by workflow state
          for (const stateId of activeStateIds.slice(0, 3)) {
            try {
              const response = await this.client.post('/stories/search', {
                workflow_state_id: stateId,
                archived: false
              });
              const stateStories = response.data?.data || [];
              const myStories = stateStories.filter(story => {
                const owners = story.owner_ids || [];
                return owners.includes(this.userId);
              });
              stories.push(...myStories);
            } catch (e) {
              // Ignore
            }
          }
          
          // Remove duplicates
          const seen = new Set();
          stories = stories.filter(s => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          
          console.log(`Found ${stories.length} unique stories from workflows`);
        } catch (err2) {
          console.log('Workflows failed:', err2.message);
        }
      }

      // Approach 3: Epic stories
      if (stories.length === 0) {
        try {
          console.log('Trying epics...');
          const epicsResponse = await this.client.get('/epics');
          const epics = epicsResponse.data || [];
          console.log(`Found ${epics.length} epics`);

          for (const epic of epics.slice(0, 3)) {
            try {
              const storiesResponse = await this.client.get(`/epics/${epic.id}/stories`);
              const epicStories = storiesResponse.data || [];
              const myStories = epicStories.filter(story => {
                const owners = story.owner_ids || [];
                return owners.includes(this.userId);
              });
              stories.push(...myStories);
            } catch (e) {
              // Ignore
            }
          }
          console.log(`Found ${stories.length} stories from epics`);
        } catch (err3) {
          console.log('Epics failed:', err3.message);
        }
      }

      // Filter for active stories
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
