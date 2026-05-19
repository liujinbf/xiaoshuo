const { app, BrowserWindow, dialog, shell } = require("electron");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const appUrl = `http://127.0.0.1:${port}`;

let mainWindow;

function checkServerReady() {
  return new Promise((resolve) => {
    const request = http.get(appUrl, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(800, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await checkServerReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`本地服务启动超时，请检查端口 ${port} 是否被占用。`);
}

async function ensureBackend() {
  if (await checkServerReady()) {
    return;
  }

  // server.js 以当前工作目录作为静态资源根目录，桌面启动时需要先切到项目根目录。
  process.chdir(rootDir);
  await import(pathToFileURL(path.join(rootDir, "server.js")).href);
  await waitForServer();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: "盐选短篇故事工作台",
    backgroundColor: "#f4f0e7",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadURL(appUrl);
}

app.whenReady().then(async () => {
  try {
    await ensureBackend();
    createMainWindow();
  } catch (error) {
    dialog.showErrorBox("桌面版启动失败", error.message || "未知错误");
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
