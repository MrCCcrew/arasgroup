const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const ActivityTracker = require('./src/activity-tracker');
const ApiClient = require('./src/api-client');

const store = new Store();
const ADMIN_PASSWORD = 'Admin@123';
let mainWindow = null;
let tray = null;
let activityTracker = null;
let apiClient = null;
let isMonitoring = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 650,
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
      label: isMonitoring ? 'إيقاف التحكم' : 'بدء التحكم',
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
        quitApplication();
      },
    },
  ]);

  tray.setToolTip('ARASGROUP Control');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
}

async function verifyAdminPassword(action) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const promptWindow = new BrowserWindow({
      width: 400,
      height: 200,
      modal: true,
      parent: mainWindow,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      autoHideMenuBar: true,
      resizable: false,
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            direction: rtl;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          }
          h3 {
            margin: 0 0 16px 0;
            color: #333;
            font-size: 18px;
          }
          input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 16px;
            font-family: inherit;
          }
          input:focus {
            outline: none;
            border-color: #667eea;
          }
          .buttons {
            display: flex;
            gap: 8px;
          }
          button {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 600;
            font-family: inherit;
          }
          .btn-confirm {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .btn-cancel {
            background: #e0e0e0;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h3>⚠️ ${action}</h3>
          <input type="password" id="password" placeholder="أدخل كلمة مرور المدير" />
          <div class="buttons">
            <button class="btn-confirm" onclick="verify()">تأكيد</button>
            <button class="btn-cancel" onclick="cancel()">إلغاء</button>
          </div>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          document.getElementById('password').focus();
          document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verify();
          });
          function verify() {
            const password = document.getElementById('password').value;
            ipcRenderer.send('admin-password-response', password);
          }
          function cancel() {
            ipcRenderer.send('admin-password-response', null);
          }
        </script>
      </body>
      </html>
    `;

    promptWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    ipcMain.once('admin-password-response', (event, password) => {
      // Resolve first: closing the window also emits "closed", which previously
      // resolved this prompt as false before the entered password was checked.
      finish(password === ADMIN_PASSWORD);
      if (!promptWindow.isDestroyed()) promptWindow.close();
    });

    promptWindow.on('closed', () => {
      finish(false);
    });
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

async function toggleMonitoring() {
  const userId = store.get('userId');
  const authToken = store.get('authToken');

  if (isMonitoring) {
    // Require admin password to stop monitoring
    const verified = await verifyAdminPassword('إيقاف التحكم يتطلب كلمة مرور المدير');
    if (verified) {
      stopMonitoring();
    }
  } else if (userId && authToken) {
    startMonitoring(userId, authToken);
  }
}

function updateTrayMenu() {
  // Tray might not be created yet during initialization
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'فتح',
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: isMonitoring ? 'إيقاف التحكم' : 'بدء التحكم',
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
        quitApplication();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

async function logout() {
  // Require admin password to logout
  const verified = await verifyAdminPassword('تسجيل الخروج يتطلب كلمة مرور المدير');
  if (!verified) return;

  stopMonitoring();
  store.delete('userId');
  store.delete('authToken');
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.show();
}

async function quitApplication() {
  const verified = await verifyAdminPassword('إنهاء التطبيق يتطلب كلمة مرور المدير');
  if (!verified) return;

  app.isQuiting = true;
  app.quit();
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
