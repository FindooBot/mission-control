/**
 * Todoist Service
 * Interacts with Todoist REST API v2
 */

const axios = require('axios');

const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';

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
      // Simple request without filters - API returns only active tasks by default
      const response = await this.client.get('/tasks');
      
      return response.data.map(task => this.formatTask(task));
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
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Use filter parameter correctly - just due date
      const response = await this.client.get('/tasks', {
        params: {
          filter: `due: ${today}`
        }
      });

      return response.data.map(task => this.formatTask(task));
    } catch (error) {
      console.error('Failed to fetch today\'s tasks:', error.message);
      // Fallback to filtering all tasks
      const allTasks = await this.getTasks();
      return allTasks.filter(task => task.due_date === new Date().toISOString().split('T')[0]);
    }
  }

  /**
   * Get tasks by project ID
   */
  async getTasksByProject(projectId) {
    try {
      const response = await this.client.get('/tasks', {
        params: {
          project_id: projectId
        }
      });

      return response.data.map(task => this.formatTask(task));
    } catch (error) {
      console.error(`Failed to fetch tasks for project ${projectId}:`, error.message);
      return [];
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
   * Get all projects
   */
  async getProjects() {
    try {
      const response = await this.client.get('/projects');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch projects:', error.message);
      return [];
    }
  }

  /**
   * Format task from API response to database format
   */
  formatTask(task) {
    return {
      task_id: task.id,
      content: task.content,
      description: task.description || '',
      project_id: task.project_id || null,
      section_id: task.section_id || null,
      parent_id: task.parent_id || null,
      priority: task.priority || 1,
      due_date: task.due?.date || null,
      due_datetime: task.due?.datetime || null,
      due_string: task.due?.string || null,
      is_completed: 0, // API only returns active tasks
      labels: JSON.stringify(task.labels || []),
      assignee_id: task.assignee_id || null,
      creator_id: task.creator_id || null,
      created_at: task.created_at,
      url: `https://todoist.com/app/task/${task.id}`
    };
  }

  /**
   * Check if a task is due today
   */
  isDueToday(task) {
    if (!task.due_date) return false;
    
    const today = new Date().toISOString().split('T')[0];
    return task.due_date === today;
  }

  /**
   * Check if a task is overdue
   */
  isOverdue(task) {
    if (!task.due_date) return false;
    
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today;
  }
}

module.exports = TodoistService;
