const fetch = require('node-fetch');

class ApiClient {
  constructor(apiUrl, userId, authToken) {
    this.apiUrl = apiUrl;
    this.userId = userId;
    this.authToken = authToken;
  }

  async sendActivities(activities, screenshot = null) {
    const logs = activities.map((activity) => ({
      userId: this.userId,
      activityType: activity.activityType,
      windowTitle: activity.windowTitle,
      applicationName: activity.applicationName,
      url: activity.url,
      startTime: activity.startTime,
      endTime: activity.endTime,
      durationSeconds: activity.durationSeconds,
      isIdle: activity.isIdle || false,
      deviceName: activity.deviceName,
      ipAddress: activity.ipAddress,
      authToken: this.authToken,
    }));

    const payload = { logs };

    // Add screenshot if available
    if (screenshot) {
      payload.screenshot = screenshot;
    }

    const response = await fetch(`${this.apiUrl}/api/activity-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send activities');
    }

    return data;
  }
}

module.exports = ApiClient;
