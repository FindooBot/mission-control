/**
 * Todoist Service
 * Interacts with Todoist REST API v1
 */

const axios = require('axios');

const TODOIST_API_BASE = 'https://api.todoist.com/api/v1';

class TodoistService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL: TODOIST_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Get all active (non-completed) tasks
   */
  async getTasks() {
    try {
      console.log('Making Todoist API request to /tasks...');
      const response = await this.client.get('/tasks');
      
      console.log('Todoist response type:', typeof response.data);
      console.log('Todoist response keys:', Object.keys(response.data || {}));
      
      // Handle different response structures
      let tasks = [];
      if (Array.isArray(response.data)) {
        tasks = response.data;
      } else if (response.data?.results && Array.isArray(response.data.results)) {
        tasks = response.data.results;
      } else if (response.data?.items && Array.isArray(response.data.items)) {
        tasks = response.data.items;
      } else if (response.data?.tasks && Array.isArray(response.data.tasks)) {
        tasks = response.data.tasks;
      } else {
        console.error('Unexpected Todoist response structure:', JSON.stringify(response.data).slice(0, 200));
        return [];
      }
      
      console.log(`Todoist returned ${tasks.length} total tasks`);
      
      // Filter out completed tasks - check both is_completed and completed fields
      const activeTasks = tasks.filter(task => {
        // Check all possible completed field names
        if (task.is_completed === true) return false;
        if (task.completed === true) return false;
        if (task.checked === true) return false;
        // Also check for string "true"
        if (String(task.is_completed).toLowerCase() === 'true') return false;
        if (String(task.completed).toLowerCase() === 'true') return false;
        return true;
      });
      console.log(`Filtered to ${activeTasks.length} active tasks`);
      
      return activeTasks.map(task => this.formatTask(task));
    } catch (error) {
      console.error('Failed to fetch Todoist tasks:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return [];
    }
  }

  /**
   * Get tasks due today
   */
  async getTodayTasks() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await this.client.get('/tasks', {
        params: { filter: `due: ${today}` }
      });

      let tasks = [];
      if (Array.isArray(response.data)) {
        tasks = response.data;
      } else if (response.data?.results) {
        tasks = response.data.results;
      }

      return tasks.map(task => this.formatTask(task));
    } catch (error) {
      console.error('Failed to fetch today\'s tasks:', error.message);
      const allTasks = await this.getTasks();
      return allTasks.filter(task => task.due_date === new Date().toISOString().split('T')[0]);
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId) {
    try {
      await this.client.post(`/tasks/${taskId}/close`);
      return true;
    } catch (error) {
      console.error(`Failed to complete task ${taskId}:`, error.message);
      return false;
    }
  }

  /**
   * Uncomplete a task
   */
  async uncompleteTask(taskId) {
    try {
      await this.client.post(`/tasks/${taskId}/reopen`);
      return true;
    } catch (error) {
      console.error(`Failed to uncomplete task ${taskId}:`, error.message);
      return false;
    }
  }

  /**
   * Format task from API response to database format
   */
  formatTask(task) {
    // Todoist priority: 1=default, 2=low, 3=medium, 4=high
    // Ensure priority is 1-4, default to 1 if missing
    let priority = task.priority || 1;
    if (priority < 1 || priority > 4) {
      priority = 1;
    }

    return {
      task_id: task.id,
      content: task.content,
      description: task.description || '',
      project_id: task.project_id || null,
      section_id: task.section_id || null,
      parent_id: task.parent_id || null,
      priority: priority,
      due_date: task.due?.date || null,
      due_datetime: task.due?.datetime || null,
      due_string: task.due?.string || null,
      is_completed: 0,
      labels: JSON.stringify(task.labels || []),
      assignee_id: task.assignee_id || null,
      creator_id: task.creator_id || null,
      created_at: task.created_at,
      url: `https://todoist.com/app/task/${task.id}`
    };
  }
}

module.exports = TodoistService;
