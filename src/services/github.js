/**
 * GitHub Service
 * Interacts with GitHub REST API
 */

const axios = require('axios');

const GITHUB_API_BASE = 'https://api.github.com';

class GitHubService {
  constructor(config) {
    this.token = config.personalAccessToken;
    this.privateRepo = config.privateRepo || 'KimonoIM/web';
    
    this.client = axios.create({
      baseURL: GITHUB_API_BASE,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Mission-Control-Dashboard'
      },
      timeout: 15000
    });
  }

  /**
   * Get open PRs from a repository via REST API
   */
  async getPRs(repoFullName) {
    try {
      const [owner, repo] = repoFullName.split('/');
      if (!owner || !repo) {
        throw new Error(`Invalid repo format: ${repoFullName}`);
      }

      console.log(`Fetching PRs for ${owner}/${repo}...`);

      const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, {
        params: {
          state: 'open',
          sort: 'updated',
          direction: 'desc',
          per_page: 50
        }
      });

      console.log(`Found ${response.data.length} PRs for ${repoFullName}`);

      // Fetch reviews for each PR to determine approval status
      const prsWithReviews = await Promise.all(
        response.data.map(async (pr) => {
          const reviews = await this.getPRReviews(owner, repo, pr.number);
          return { ...pr, reviews };
        })
      );

      return prsWithReviews.map(pr => this.formatPR(pr, owner, repo));
    } catch (error) {
      console.error(`Failed to fetch PRs for ${repoFullName}:`, error.message);
      if (error.response?.status === 404) {
        console.log('  → Repository not found or token lacks access');
      } else if (error.response?.status === 401) {
        console.log('  → Authentication failed - check your GitHub token');
      }
      return [];
    }
  }

  /**
   * Get reviews for a specific PR
   */
  async getPRReviews(owner, repo, prNumber) {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch reviews for PR #${prNumber}:`, error.message);
      return [];
    }
  }

  /**
   * Get all PRs for configured repos
   */
  async getAllPRs() {
    const repos = [this.privateRepo];

    const allPRs = [];
    
    for (const repo of repos) {
      const prs = await this.getPRs(repo);
      allPRs.push(...prs);
    }

    // Sort by updated_at descending
    return allPRs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  /**
   * Get GitHub notifications
   */
  async getNotifications() {
    try {
      const response = await this.client.get('/notifications', {
        params: {
          all: false, // Only unread
          participating: false
        }
      });

      return response.data.map(notification => ({
        notification_id: notification.id,
        thread_id: notification.id,
        reason: notification.reason,
        unread: notification.unread ? 1 : 0,
        subject_title: notification.subject?.title || '',
        subject_type: notification.subject?.type || '',
        subject_url: notification.subject?.url || '',
        repository_name: notification.repository?.name || '',
        repository_owner: notification.repository?.owner?.login || '',
        updated_at: notification.updated_at,
        last_read_at: notification.last_read_at
      }));
    } catch (error) {
      console.error('Failed to fetch GitHub notifications:', error.message);
      return [];
    }
  }

  /**
   * Mark a notification as read
   */
  async markNotificationRead(threadId) {
    try {
      await this.client.patch(`/notifications/threads/${threadId}`);
      return true;
    } catch (error) {
      console.error('Failed to mark GitHub notification as read:', error.message);
      return false;
    }
  }

  /**
   * Format PR from API response to database format
   */
  formatPR(pr, owner, repo) {
    // Check review status
    const reviews = pr.reviews || [];
    const latestReviews = this.getLatestReviews(reviews);
    const hasApproval = latestReviews.some(r => r.state === 'APPROVED');
    const hasChangesRequested = latestReviews.some(r => r.state === 'CHANGES_REQUESTED');
    const reviewCount = latestReviews.length;

    return {
      pr_id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      repo_owner: owner,
      repo_name: repo,
      author_login: pr.user?.login || 'unknown',
      author_avatar: pr.user?.avatar_url || '',
      head_branch: pr.head?.ref || '',
      base_branch: pr.base?.ref || '',
      draft: pr.draft ? 1 : 0,
      mergeable: null,
      merged: pr.merged ? 1 : 0,
      merged_at: pr.merged_at,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      html_url: pr.html_url,
      review_requested: pr.requested_reviewers?.length > 0 ? 1 : 0,
      has_approval: hasApproval ? 1 : 0,
      has_changes_requested: hasChangesRequested ? 1 : 0,
      review_count: reviewCount
    };
  }

  /**
   * Get latest review from each reviewer
   */
  getLatestReviews(reviews) {
    const reviewMap = new Map();
    
    // Sort by submitted_at to get chronological order
    const sortedReviews = [...reviews].sort((a, b) => 
      new Date(a.submitted_at) - new Date(b.submitted_at)
    );

    // Keep only the latest review from each user
    for (const review of sortedReviews) {
      reviewMap.set(review.user?.login || review.user?.id, review);
    }

    return Array.from(reviewMap.values());
  }
}

module.exports = GitHubService;
