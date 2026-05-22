import { app, BrowserWindow, Menu, Notification, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173/Contribution-Arc/";

function openSettings() {
  BrowserWindow.getFocusedWindow()?.webContents.send("contribution-arc:open-settings");
}

function readNotificationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const title = typeof payload.title === "string" ? payload.title.slice(0, 80) : "";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 180) : "";

  if (!title || !body) {
    return null;
  }

  return { title, body };
}

ipcMain.handle("contribution-arc:notify", (_event, payload) => {
  const notificationPayload = readNotificationPayload(payload);

  if (!notificationPayload || !Notification.isSupported()) {
    return false;
  }

  new Notification({
    title: notificationPayload.title,
    body: notificationPayload.body,
    silent: true,
  }).show();

  return true;
});

function createApplicationMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Settings...",
                accelerator: "Command+,",
                click: openSettings,
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    ...(process.platform !== "darwin"
      ? [
          {
            label: "File",
            submenu: [
              {
                label: "Settings...",
                accelerator: "Control+,",
                click: openSettings,
              },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload", accelerator: "CommandOrControl+R" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ type: "separator" }, { role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close", accelerator: "CommandOrControl+W" },
        { role: "zoom" },
        ...(process.platform === "darwin"
          ? [{ type: "separator" }, { role: "front" }, { type: "separator" }, { role: "window" }]
          : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function loadContributionArc(window) {
  if (isDev) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: "#FAFAF8",
    title: "Contribution Arc",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 22, y: 20 },
    icon: path.join(__dirname, "..", "assets", "icon.icns"),
    vibrancy: process.platform === "darwin" ? "under-window" : undefined,
    visualEffectState: process.platform === "darwin" ? "active" : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(devServerUrl)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isLocalDevNavigation = isDev && url.startsWith(devServerUrl);
    const isPackagedFileNavigation = !isDev && url.startsWith("file://");

    if (isLocalDevNavigation || isPackagedFileNavigation) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  void loadContributionArc(mainWindow);
}

app.setName("Contribution Arc");

app.whenReady().then(() => {
  createApplicationMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
