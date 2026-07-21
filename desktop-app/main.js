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
      width: 460,
      height: 330,
      title: 'ARASGROUP Control',
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
            padding: 24px;
            direction: rtl;
            background: #f3f6fb;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 48px);
            color: #172033;
          }
          .container {
            width: 100%;
            background: white;
            padding: 25px;
            border: 1px solid #dbe3ef;
            border-radius: 14px;
            box-shadow: 0 14px 36px rgba(20, 51, 93, 0.12);
          }
          .container::before {
            content: 'ARASGROUP CONTROL';
            display: block;
            margin-bottom: 8px;
            color: #1d5fbf;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1.2px;
          }
          h3 {
            margin: 0 0 18px 0;
            color: #172033;
            font-size: 17px;
            line-height: 1.55;
          }
          input {
            width: 100%;
            box-sizing: border-box;
            padding: 13px 14px;
            border: 1px solid #cbd7e6;
            border-radius: 9px;
            font-size: 14px;
            margin-bottom: 18px;
            font-family: inherit;
            background: #f8fafd;
          }
          input:focus {
            outline: none;
            border-color: #1d5fbf;
            background: white;
            box-shadow: 0 0 0 3px rgba(29, 95, 191, 0.12);
          }
          .buttons {
            display: flex;
            gap: 10px;
          }
          button {
            flex: 1;
            padding: 11px;
            border: 1px solid transparent;
            border-radius: 9px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 600;
            font-family: inherit;
          }
          .btn-confirm {
            background: #1d5fbf;
            color: white;
          }
          .btn-cancel {
            background: #f3f6fb;
            border-color: #dbe3ef;
            color: #44536a;
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
  app.setLoginItemSettings({ openAtLogin: false });
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

      // Keep ARASGROUP Control running after Windows restarts once this device
      // has been signed in for the first time.
      app.setLoginItemSettings({ openAtLogin: true });

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
  // Also enable autostart for users already signed in before this version.
  if (store.get('userId') && store.get('authToken')) {
    app.setLoginItemSettings({ openAtLogin: true });
  }
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
