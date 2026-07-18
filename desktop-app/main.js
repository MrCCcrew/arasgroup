const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const ActivityTracker = require('./src/activity-tracker');
const ApiClient = require('./src/api-client');

const store = new Store();
let mainWindow = null;
let tray = null;
let activityTracker = null;
let apiClient = null;
let isMonitoring = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    resizable: false,
  });

  // Check if user is logged in
  const userId = store.get('userId');
  const authToken = store.get('authToken');

  if (userId && authToken) {
    // User is logged in, show monitor screen (hidden)
    mainWindow.hide();
    startMonitoring(userId, authToken);
  } else {
    // Show login screen
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // Create a simple colored icon for the tray
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFJSURBVDiNpZPPKwRhGMc/77uzs7Oz2V3WkpwcODg4uThwsnFwcHRw4ODg4ODk5ODg4ODg4uTk4ODi4uDk4OLi4uTk5OTk5OTk5OTk5OTkZHd2Z973fZ7nfd7n+T7P8z4v/FdYAEeBK+AZ6AHqgElgGXgBuoE6YAKYBl6BHqAO6AcWgDegE6gDRoEF4A3oBGqBEWAReAc6gBqgHVgE3oF2oAYYBpaAD6ANqAGGgGXgE2gBqoEBYAX4AlqBKqAfWAW+gRagEugDVoEfoAmoAPqANeAXaAQqgF5gHfgDGoAyoBdYB/6BRqAM6AE2gH+gHigFuoFN4B9oAEqBLmAL+AcagBKgE9gG/oF6oAToAHaAf6AOKAE6gF3gH6gDioF2YA/4BxqAIqAN2Af+gXqgCGgF9oEAaASKgBZgHwiBBqAQaAIOgBBoBAqAJuAACIEmIA84AA6BEGgC8v4AvwG5TlFfAAAAAElFTkSuQmCC'
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'فتح',
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: isMonitoring ? 'إيقاف المراقبة' : 'بدء المراقبة',
      click: () => {
        toggleMonitoring();
      },
    },
    { type: 'separator' },
    {
      label: 'تسجيل الخروج',
      click: () => {
        logout();
      },
    },
    {
      label: 'إنهاء',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Rashid Activity Monitor');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
}

function startMonitoring(userId, authToken) {
  if (isMonitoring) return;

  const apiUrl = store.get('apiUrl') || 'http://localhost:3000';

  apiClient = new ApiClient(apiUrl, userId, authToken);
  activityTracker = new ActivityTracker(apiClient);

  activityTracker.start();
  isMonitoring = true;

  updateTrayMenu();
}

function stopMonitoring() {
  if (!isMonitoring) return;

  if (activityTracker) {
    activityTracker.stop();
    activityTracker = null;
  }

  isMonitoring = false;
  updateTrayMenu();
}

function toggleMonitoring() {
  const userId = store.get('userId');
  const authToken = store.get('authToken');

  if (isMonitoring) {
    stopMonitoring();
  } else if (userId && authToken) {
    startMonitoring(userId, authToken);
  }
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'فتح',
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: isMonitoring ? 'إيقاف المراقبة' : 'بدء المراقبة',
      click: () => {
        toggleMonitoring();
      },
    },
    { type: 'separator' },
    {
      label: 'تسجيل الخروج',
      click: () => {
        logout();
      },
    },
    {
      label: 'إنهاء',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function logout() {
  stopMonitoring();
  store.delete('userId');
  store.delete('authToken');
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.show();
}

// IPC Handlers
ipcMain.handle('login', async (event, { email, password, apiUrl }) => {
  try {
    const fetch = require('node-fetch');
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success && data.user) {
      store.set('userId', data.user.id);
      store.set('authToken', data.user.id); // Simple token for now
      store.set('apiUrl', apiUrl);
      store.set('userName', data.user.nameAr);

      mainWindow.hide();
      startMonitoring(data.user.id, data.user.id);

      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'فشل تسجيل الدخول' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getStatus', async () => {
  return {
    isMonitoring,
    userName: store.get('userName'),
  };
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Keep app running in background on all platforms
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  stopMonitoring();
});
