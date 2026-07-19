const activeWin = require('active-win');
const os = require('os');
const screenshot = require('screenshot-desktop');

class ActivityTracker {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.trackingInterval = null;
    this.sendInterval = null;
    this.screenshotInterval = null;
    this.activityQueue = [];
    this.currentActivity = null;
    this.lastActiveTime = Date.now();
    this.idleThreshold = 60000; // 1 minute
    this.lastScreenshot = null;
  }

  start() {
    console.log('Starting activity tracking...');

    // Track activity every 5 seconds
    this.trackingInterval = setInterval(() => {
      this.trackActivity();
    }, 5000);

    // Send queued activities every 60 seconds
    this.sendInterval = setInterval(() => {
      this.sendActivities();
    }, 60000);

    // Take screenshot every 1.5 minutes
    this.screenshotInterval = setInterval(() => {
      this.takeScreenshot();
    }, 90000); // 1.5 minutes

    // Take first screenshot immediately
    this.takeScreenshot();
  }

  stop() {
    console.log('Stopping activity tracking...');

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }

    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }

    // Send remaining activities
    this.sendActivities();
  }

  async trackActivity() {
    try {
      const activeWindow = await activeWin();

      if (!activeWindow) {
        this.handleIdleState();
        return;
      }

      this.lastActiveTime = Date.now();

      const activity = {
        applicationName: this.getApplicationName(activeWindow.owner.name),
        windowTitle: activeWindow.title,
        url: this.extractUrl(activeWindow.title, activeWindow.owner.name),
        activityType: this.determineActivityType(activeWindow.owner.name),
      };

      // Check if this is a new activity or continuation of current
      if (this.isNewActivity(activity)) {
        // End current activity if exists
        if (this.currentActivity) {
          this.endCurrentActivity();
        }

        // Start new activity
        this.currentActivity = {
          ...activity,
          startTime: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }

  handleIdleState() {
    const now = Date.now();
    const idleDuration = now - this.lastActiveTime;

    if (idleDuration > this.idleThreshold) {
      // User is idle
      if (this.currentActivity && !this.currentActivity.isIdle) {
        this.endCurrentActivity();

        // Start idle activity
        this.currentActivity = {
          activityType: 'IDLE',
          applicationName: null,
          windowTitle: null,
          url: null,
          startTime: new Date().toISOString(),
          isIdle: true,
        };
      }
    }
  }

  isNewActivity(activity) {
    if (!this.currentActivity) return true;
    if (this.currentActivity.isIdle) return true;

    return (
      this.currentActivity.applicationName !== activity.applicationName ||
      this.currentActivity.windowTitle !== activity.windowTitle
    );
  }

  endCurrentActivity() {
    if (!this.currentActivity) return;

    const endTime = new Date();
    const startTime = new Date(this.currentActivity.startTime);
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Only log activities longer than 3 seconds
    if (durationSeconds >= 3) {
      this.activityQueue.push({
        ...this.currentActivity,
        endTime: endTime.toISOString(),
        durationSeconds,
        deviceName: os.hostname(),
        ipAddress: this.getLocalIP(),
      });
    }

    this.currentActivity = null;
  }

  async sendActivities() {
    if (this.activityQueue.length === 0) return;

    // End current activity before sending
    if (this.currentActivity) {
      this.endCurrentActivity();
    }

    const activities = [...this.activityQueue];
    this.activityQueue = [];

    console.log(`Sending ${activities.length} activities...`);

    try {
      await this.apiClient.sendActivities(activities, this.lastScreenshot);
      console.log('Activities sent successfully');

      // Clear screenshot after successful send
      this.lastScreenshot = null;
    } catch (error) {
      console.error('Failed to send activities:', error);
      // Re-queue failed activities
      this.activityQueue.unshift(...activities);
    }
  }

  getApplicationName(ownerName) {
    // Clean up application name
    return ownerName
      .replace('.exe', '')
      .replace(/\..+$/, '')
      .trim();
  }

  extractUrl(title, ownerName) {
    // Try to extract URL from browser titles
    const browsers = ['chrome', 'firefox', 'edge', 'brave', 'opera', 'safari'];
    const lowerOwner = ownerName.toLowerCase();

    if (browsers.some((browser) => lowerOwner.includes(browser))) {
      // Simple URL extraction - look for http/https in title
      const urlMatch = title.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        return urlMatch[0];
      }

      // Try to extract domain from title (common pattern: "Page Title - Domain")
      const parts = title.split(' - ');
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) {
          return `https://${lastPart}`;
        }
      }
    }

    return null;
  }

  determineActivityType(ownerName) {
    const lowerOwner = ownerName.toLowerCase();

    if (
      lowerOwner.includes('chrome') ||
      lowerOwner.includes('firefox') ||
      lowerOwner.includes('edge') ||
      lowerOwner.includes('brave')
    ) {
      return 'WEBSITE_VISIT';
    }

    return 'APPLICATION_USE';
  }

  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '127.0.0.1';
  }

  async takeScreenshot() {
    try {
      console.log('Taking screenshot...');

      // Take screenshot (returns buffer)
      const imgBuffer = await screenshot({ format: 'jpg', quality: 60 });

      // Convert buffer to base64
      const base64Image = imgBuffer.toString('base64');

      // Store screenshot to send with next activity batch
      this.lastScreenshot = {
        timestamp: new Date().toISOString(),
        image: base64Image,
      };

      console.log('Screenshot captured successfully');
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }
}

module.exports = ActivityTracker;
