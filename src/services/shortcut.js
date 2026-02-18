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
    this.userIdsToMatch = []; // Array of possible user ID formats
  }

  /**
   * Get current user info and cache user ID
   */
  async getCurrentUser() {
    try {
      const response = await this.client.get('/member');
      this.user = response.data;
      this.userId = this.user.id;
      
      // Collect all possible user ID formats
      this.userIdsToMatch = [this.userId];
      
      // Some workspaces use numeric IDs
      if (this.user.member_id) {
        this.userIdsToMatch.push(String(this.user.member_id));
        this.userIdsToMatch.push(Number(this.user.member_id));
      }
      
      // Also try workspace-specific ID
      if (this.user.workspace2?.id) {
        this.userIdsToMatch.push(this.user.workspace2.id);
      }
      
      console.log(`Shortcut user: ${this.user?.name}`);
      console.log(`  User IDs to match: ${JSON.stringify(this.userIdsToMatch)}`);
      
      return this.user;
    } catch (error) {
      console.error('Failed to get Shortcut user:', error.message);
      throw error;
    }
  }

  /**
   * Check if user is owner of story
   */
  isStoryOwner(story) {
    const owners = story.owner_ids || [];
    
    // Check each possible user ID format
    for (const userId of this.userIdsToMatch) {
      if (owners.includes(userId)) {
        return true;
      }
      // Also try string comparison
      if (owners.some(ownerId => String(ownerId) === String(userId))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get stories where user is owner
   */
  async getMyStories() {
    try {
      if (!this.userId) {
        await this.getCurrentUser();
      }

      console.log(`Fetching Shortcut stories...`);

      let allStories = [];

      // Approach 1: Get all stories from active workflow states (started, unstarted)
      try {
        console.log('Fetching stories from active workflow states...');
        
        const workflowsResponse = await this.client.get('/workflows');
        const workflows = workflowsResponse.data || [];
        
        // Find active states (not 'done' type)
        const activeStates = [];
        for (const workflow of workflows) {
          for (const state of workflow.states || []) {
            if (state.type === 'unstarted' || state.type === 'started') {
              activeStates.push(state);
            }
          }
        }
        
        console.log(`  Found ${activeStates.length} active workflow states`);
        
        // Fetch stories from each active state (limit to first 5 to avoid rate limits)
        for (const state of activeStates.slice(0, 5)) {
          try {
            console.log(`  Fetching from: ${state.name} (${state.id})`);
            const response = await this.client.post('/stories/search', {
              workflow_state_id: state.id,
              archived: false,
              page_size: 50
            });
            
            const stories = response.data?.data || [];
            console.log(`    → ${stories.length} stories`);
            allStories.push(...stories);
          } catch (e) {
            console.log(`    → Failed: ${e.message}`);
          }
        }
        
        // Remove duplicates
        const seen = new Set();
        allStories = allStories.filter(s => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        
        console.log(`  Total unique stories: ${allStories.length}`);
        
        // Log first story's owner_ids for debugging
        if (allStories.length > 0) {
          console.log(`  Sample story owner_ids: ${JSON.stringify(allStories[0].owner_ids)}`);
        }
      } catch (err1) {
        console.log('Workflow stories failed:', err1.message);
      }

      // Approach 2: Get stories from multiple epics
      if (allStories.length === 0) {
        try {
          console.log('Fetching stories from epics...');
          const epicsResponse = await this.client.get('/epics');
          const epics = epicsResponse.data || [];
          console.log(`  Found ${epics.length} epics`);
          
          // Try first 5 epics
          for (const epic of epics.slice(0, 5)) {
            try {
              const response = await this.client.get(`/epics/${epic.id}/stories`);
              const stories = response.data || [];
              if (stories.length > 0) {
                console.log(`  ${epic.name}: ${stories.length} stories`);
                allStories.push(...stories);
              }
            } catch (e) {
              // Ignore errors for individual epics
            }
          }
          
          // Remove duplicates
          const seen = new Set();
          allStories = allStories.filter(s => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          
          console.log(`  Total unique stories from epics: ${allStories.length}`);
          
          if (allStories.length > 0) {
            console.log(`  Sample story owner_ids: ${JSON.stringify(allStories[0].owner_ids)}`);
          }
        } catch (err2) {
          console.log('Epic stories failed:', err2.message);
        }
      }

      // Filter for user's stories
      console.log(`Filtering ${allStories.length} stories for user ownership...`);
      let myStories = allStories.filter(story => this.isStoryOwner(story));
      
      // If no matches, try including stories where user is the requester
      if (myStories.length === 0) {
        console.log('No owner matches, trying requester_id...');
        myStories = allStories.filter(story => {
          const requesterId = story.requested_by_id;
          return requesterId && this.userIdsToMatch.some(id => 
            String(id) === String(requesterId)
          );
        });
      }
      
      console.log(`Found ${myStories.length} stories assigned to user`);

      // If still no matches, log some debug info
      if (myStories.length === 0 && allStories.length > 0) {
        console.log('Debug: First 3 stories owner_ids:');
        allStories.slice(0, 3).forEach((story, i) => {
          console.log(`  ${i + 1}. "${story.name?.substring(0, 40)}..." owners: ${JSON.stringify(story.owner_ids)}, requester: ${story.requested_by_id}`);
        });
      }

      // Filter for active stories
      const activeStories = myStories.filter(story => 
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
   * Get unread activity
   */
  async getNotifications() {
    console.log('Shortcut notifications not available via API');
    return [];
  }

  /**
   * Mark a notification as read
   */
  async markNotificationRead(notificationId) {
    return true;
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead() {
    return true;
  }
}

module.exports = ShortcutService;
