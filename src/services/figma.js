/**
 * Figma Service
 * Interacts with Figma REST API
 */

const axios = require('axios');

const FIGMA_API_BASE = 'https://api.figma.com/v1';

class FigmaService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL: FIGMA_API_BASE,
      headers: {
        'X-Figma-Token': apiToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    this.userId = null;
    this.userEmail = null;
    this.userHandle = null;
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    try {
      const response = await this.client.get('/me');
      this.userId = response.data.id;
      this.userEmail = response.data.email;
      this.userHandle = response.data.handle;
      console.log(`Figma user: ${this.userHandle} (${this.userEmail})`);
      return response.data;
    } catch (error) {
      console.error('Failed to get Figma user:', error.message);
      throw error;
    }
  }

  /**
   * Get recent files
   */
  async getRecentFiles() {
    try {
      const response = await this.client.get('/me/files');
      return response.data.files || [];
    } catch (error) {
      console.error('Failed to get Figma files:', error.message);
      return [];
    }
  }

  /**
   * Get comments for a specific file
   */
  async getFileComments(fileKey) {
    try {
      const response = await this.client.get(`/files/${fileKey}/comments`);
      return response.data.comments || [];
    } catch (error) {
      console.error(`Failed to get comments for file ${fileKey}:`, error.message);
      return [];
    }
  }

  /**
   * Get "notifications" - comments that mention the user or are replies to their comments
   * Note: Figma doesn't have a dedicated notifications API, so we fetch recent comments
   */
  async getNotifications() {
    try {
      if (!this.userId) {
        await this.getCurrentUser();
      }

      console.log('Fetching Figma notifications (recent comments)...');

      // Get recent files
      const files = await this.getRecentFiles();
      console.log(`Found ${files.length} Figma files`);

      const notifications = [];

      // Check comments on each file (limit to first 10 files to avoid rate limits)
      for (const file of files.slice(0, 10)) {
        try {
          const comments = await this.getFileComments(file.key);
          
          for (const comment of comments) {
            // Check if comment mentions the user
            const mentionsUser = this.commentMentionsUser(comment);
            const isReplyToUser = this.isReplyToUser(comment);
            
            if (mentionsUser || isReplyToUser) {
              notifications.push({
                notification_id: `${file.key}-${comment.id}`,
                file_key: file.key,
                file_name: file.name,
                comment_id: comment.id,
                message: this.extractCommentText(comment),
                author: comment.user?.handle || 'Unknown',
                author_img: comment.user?.img_url || '',
                created_at: comment.created_at,
                is_mention: mentionsUser,
                is_reply: isReplyToUser,
                url: `https://www.figma.com/file/${file.key}?comment-id=${comment.id}`
              });
            }
          }
        } catch (e) {
          // Skip files we can't access
        }
      }

      // Sort by date (newest first)
      notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      console.log(`Found ${notifications.length} Figma notifications`);
      return notifications;
    } catch (error) {
      console.error('Failed to fetch Figma notifications:', error.message);
      return [];
    }
  }

  /**
   * Check if a comment mentions the current user
   */
  commentMentionsUser(comment) {
    if (!comment.message) return false;
    
    const message = comment.message.toLowerCase();
    const handle = this.userHandle?.toLowerCase();
    const email = this.userEmail?.toLowerCase();
    
    // Check for @mention
    if (handle && message.includes(`@${handle}`)) return true;
    if (email && message.includes(`@${email.split('@')[0]}`)) return true;
    
    return false;
  }

  /**
   * Check if a comment is a reply to the user's comment
   * (simplified - checks if user is in reply chain)
   */
  isReplyToUser(comment) {
    // Figma comments don't have a direct "reply_to" field in the basic API
    // This would require tracking comment threads
    // For now, we focus on mentions
    return false;
  }

  /**
   * Extract plain text from comment message
   */
  extractCommentText(comment) {
    if (!comment.message) return '';
    
    // Figma comments can have formatting, extract plain text
    // Simple extraction - remove HTML-like tags if present
    let text = comment.message;
    text = text.replace(/<[^>]+>/g, ''); // Remove HTML tags
    
    // Truncate if too long
    if (text.length > 100) {
      text = text.substring(0, 97) + '...';
    }
    
    return text;
  }
}

module.exports = FigmaService;
