/**
 * Shortcut Service
 * Interacts with Shortcut (formerly Clubhouse) REST API v3
 */

const axios = require('axios');

const SHORTCUT_API_BASE = 'https://api.app.shortcut.com/api/v3';

// Workflow state IDs from user's Shortcut workspace
const ACTIVE_WORKFLOW_STATES = [
  500033285, // Ready for Dev
  500033283, // In Dev
  500033286, // Code Review
  500037066, // Product Check
  500033282, // Backlog
  500033374, // Ready for Release
];

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
    this.userIdsToMatch = [];
    this.workflowStateMap = new Map(); // Map state IDs to names
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
      
      if (this.user.member_id) {
        this.userIdsToMatch.push(String(this.user.member_id));
      }
      
      console.log(`Shortcut user: ${this.user?.name}`);
      console.log(`  User ID: ${this.userId}`);
      
      return this.user;
    } catch (error) {
      console.error('Failed to get Shortcut user:', error.message);
      throw error;
    }
  }

  /**
   * Load workflow states to map IDs to names
   */
  async loadWorkflowStates() {
    try {
      const response = await this.client.get('/workflows');
      const workflows = response.data || [];
      
      for (const workflow of workflows) {
        for (const state of workflow.states || []) {
          this.workflowStateMap.set(state.id, state.name);
          this.workflowStateMap.set(String(state.id), state.name);
        }
      }
      
      console.log(`Loaded ${this.workflowStateMap.size / 2} workflow states`);
    } catch (error) {
      console.error('Failed to load workflow states:', error.message);
    }
  }

  /**
   * Get state name from ID
   */
  getStateName(stateId) {
    if (!stateId) return 'Unknown';
    return this.workflowStateMap.get(stateId) || 
           this.workflowStateMap.get(String(stateId)) || 
           'Unknown';
  }

  /**
   * Check if user is owner of story
   */
  isStoryOwner(story) {
    const owners = story.owner_ids || [];
    return owners.some(ownerId => {
      const ownerStr = String(ownerId);
      return this.userIdsToMatch.some(uid => String(uid) === ownerStr);
    });
  }

  /**
   * Get stories where user is owner
   */
  async getMyStories() {
    try {
      if (!this.userId) {
        await this.getCurrentUser();
      }
      
      // Load workflow states for name mapping
      await this.loadWorkflowStates();

      console.log(`Fetching Shortcut stories...`);

      let allStories = [];

      // Approach 1: Fetch stories from specific workflow states
      for (const stateId of ACTIVE_WORKFLOW_STATES) {
        try {
          console.log(`  Fetching from workflow state ${stateId}...`);
          
          // Try using the search endpoint
          const response = await this.client.get('/search/stories', {
            params: {
              query: `state:${stateId}`,
              page_size: 50
            }
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

      console.log(`Total unique stories from workflow states: ${allStories.length}`);

      // Approach 2: If no stories found, try epics
      if (allStories.length === 0) {
        console.log('Trying epics...');
        const epicsResponse = await this.client.get('/epics');
        const epics = epicsResponse.data || [];
        
        for (const epic of epics.slice(0, 10)) {
          try {
            const response = await this.client.get(`/epics/${epic.id}/stories`);
            const stories = response.data || [];
            allStories.push(...stories);
          } catch (e) {
            // Ignore
          }
        }
        
        // Remove duplicates
        const seen2 = new Set();
        allStories = allStories.filter(s => {
          if (seen2.has(s.id)) return false;
          seen2.add(s.id);
          return true;
        });
        
        console.log(`Total from epics: ${allStories.length}`);
      }

      // Filter for user's stories by owner
      console.log(`Filtering ${allStories.length} stories for user ownership...`);
      let myStories = allStories.filter(story => this.isStoryOwner(story));
      console.log(`  Found ${myStories.length} stories by owner`);
      
      // Also try requester
      if (myStories.length === 0) {
        myStories = allStories.filter(story => {
          const requesterId = story.requested_by_id;
          if (!requesterId) return false;
          return this.userIdsToMatch.some(uid => 
            String(uid) === String(requesterId)
          );
        });
        console.log(`  Found ${myStories.length} stories by requester`);
      }

      // Debug if no matches
      if (myStories.length === 0 && allStories.length > 0) {
        console.log('Debug - Sample story info:');
        allStories.slice(0, 3).forEach((story, i) => {
          console.log(`  ${i + 1}. "${story.name?.substring(0, 40)}"`);
          console.log(`     owners: ${JSON.stringify(story.owner_ids)}`);
          console.log(`     workflow_state_id: ${story.workflow_state_id}`);
        });
      }

      // Filter for active (not completed)
      const activeStories = myStories.filter(story => 
        story.completed !== true && story.archived !== true
      );

      console.log(`Returning ${activeStories.length} active stories`);

      return activeStories.map(story => ({
        story_id: story.id,
        name: story.name,
        description: story.description || '',
        story_type: story.story_type,
        state: this.getStateName(story.workflow_state_id),
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

  async getNotifications() {
    return [];
  }

  async markNotificationRead(notificationId) {
    return true;
  }

  async markAllNotificationsRead() {
    return true;
  }
}

module.exports = ShortcutService;
