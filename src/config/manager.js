/**
 * Configuration Manager
 * Handles reading/writing config.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine config path based on environment
function getConfigPath() {
  // If MISSION_CONTROL_CONFIG env var is set, use it
  if (process.env.MISSION_CONTROL_CONFIG) {
    return process.env.MISSION_CONTROL_CONFIG;
  }
  
  // If running from Tauri bundled app, use app data directory
  if (process.env.TAURI_PLATFORM) {
    const appDataDir = path.join(os.homedir(), '.mission-control');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    return path.join(appDataDir, 'config.json');
  }
  
  // Default: development path (relative to git repo)
  return path.join(__dirname, '../../config/config.json');
}

const CONFIG_PATH = getConfigPath();
console.log('Config path:', CONFIG_PATH);

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
  },
  figma: {
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
      },
      figma: {
        apiToken: formData.figmaToken || ''
      }
    };

    return this.saveConfig(newConfig);
  }
}

module.exports = new ConfigManager();
