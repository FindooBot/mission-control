/**
 * Configuration Manager
 * Handles reading/writing config.json
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');

// Default configuration
const defaultConfig = {
  isConfigured: false,
  calendar: {
    personalIcalUrl: '',
    workIcalUrl: ''
  },
  shortcut: {
    apiToken: '',
    workspaceName: ''
  },
  github: {
    personalAccessToken: '',
    privateRepo: 'KimonoIM/web',
    useGhCli: true
  },
  todoist: {
    apiToken: ''
  }
};

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or return defaults
   */
  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return { ...defaultConfig, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Error loading config:', error.message);
    }
    return { ...defaultConfig };
  }

  /**
   * Save configuration to file
   */
  saveConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving config:', error.message);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update configuration from setup form
   */
  updateFromForm(formData) {
    const newConfig = {
      isConfigured: true,
      calendar: {
        personalIcalUrl: formData.personalIcalUrl || '',
        workIcalUrl: formData.workIcalUrl || ''
      },
      shortcut: {
        apiToken: formData.shortcutApiToken || '',
        workspaceName: formData.shortcutWorkspaceName || ''
      },
      github: {
        personalAccessToken: formData.githubToken || '',
        privateRepo: formData.githubRepo || 'KimonoIM/web',
        useGhCli: formData.useGhCli === 'on'
      },
      todoist: {
        apiToken: formData.todoistToken || ''
      }
    };

    return this.saveConfig(newConfig);
  }
}

module.exports = new ConfigManager();
