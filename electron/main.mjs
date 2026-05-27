import { app, BrowserWindow, Menu, Notification, ipcMain, shell, inAppPurchase } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

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

// ---------------------------------------------------------------
// In-App Purchase (Mac App Store)
//
// Electron 標準の inAppPurchase モジュールを使う。MAS ビルド以外
// (Developer ID / dev) では canMakePayments() が false を返すので、
// ハンドラはそのまま登録しても安全。
//
// フロー:
//   1. Renderer → "iap:get-products" で価格表示用に取得
//   2. Renderer → "iap:purchase" で購入開始
//   3. Apple StoreKit の transactions-updated イベントで完了通知
//   4. Main がレシートを base64 で読んで Renderer に渡す
//   5. Renderer が Cloud Function verifyApplePurchase に検証依頼
//   6. Renderer が finalize を呼んで finishTransaction を実行
// ---------------------------------------------------------------

const IAP_TRANSACTION_EVENT = "contribution-arc:iap-transaction";

function broadcastIapTransaction(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IAP_TRANSACTION_EVENT, payload);
    }
  }
}

async function readReceiptBase64() {
  const url = inAppPurchase.getReceiptURL();
  if (!url) return null;
  // url は file:// 形式
  const filePath = url.startsWith("file://") ? fileURLToPath(url) : url;
  try {
    const buf = await fs.readFile(filePath);
    return buf.toString("base64");
  } catch (err) {
    console.error("[iap] receipt read failed:", err);
    return null;
  }
}

inAppPurchase.on("transactions-updated", async (_event, transactions) => {
  if (!Array.isArray(transactions)) return;

  for (const tx of transactions) {
    if (tx.transactionState === "purchased" || tx.transactionState === "restored") {
      const receiptBase64 = await readReceiptBase64();
      broadcastIapTransaction({
        kind: "completed",
        productId: tx.payment?.productIdentifier ?? null,
        transactionIdentifier: tx.transactionIdentifier ?? null,
        transactionDate: tx.transactionDate ?? null,
        receiptBase64,
      });
    } else if (tx.transactionState === "failed") {
      broadcastIapTransaction({
        kind: "failed",
        productId: tx.payment?.productIdentifier ?? null,
        errorMessage: tx.errorMessage ?? "Purchase failed",
      });
      // 失敗トランザクションも必ず finish しないと残り続ける
      if (tx.transactionIdentifier) {
        inAppPurchase.finishTransactionByDate(tx.transactionDate ?? "");
      }
    }
  }
});

ipcMain.handle("contribution-arc:iap-can-make-payments", () => {
  try {
    return inAppPurchase.canMakePayments();
  } catch {
    return false;
  }
});

ipcMain.handle("contribution-arc:iap-get-products", async (_event, productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  try {
    const products = await inAppPurchase.getProducts(productIds);
    return products.map((p) => ({
      productIdentifier: p.productIdentifier,
      localizedTitle: p.localizedTitle,
      localizedDescription: p.localizedDescription,
      formattedPrice: p.formattedPrice,
      price: p.price,
      currencyCode: p.priceLocale?.currencyCode ?? null,
    }));
  } catch (err) {
    console.error("[iap] getProducts failed:", err);
    return [];
  }
});

ipcMain.handle("contribution-arc:iap-purchase", async (_event, productId) => {
  if (typeof productId !== "string" || productId.length === 0) {
    return { ok: false, reason: "invalid-product-id" };
  }
  if (!inAppPurchase.canMakePayments()) {
    return { ok: false, reason: "cannot-make-payments" };
  }
  try {
    const started = await inAppPurchase.purchaseProduct(productId, 1);
    return { ok: started, reason: started ? null : "purchase-not-started" };
  } catch (err) {
    console.error("[iap] purchase failed:", err);
    return { ok: false, reason: "exception" };
  }
});

ipcMain.handle("contribution-arc:iap-finalize", (_event, transactionDate) => {
  if (typeof transactionDate !== "string" || transactionDate.length === 0) {
    // 日付が無い場合は安全側で全完了済みトランザクションをまとめて finish
    try {
      inAppPurchase.finishAllTransactions();
      return true;
    } catch {
      return false;
    }
  }
  try {
    inAppPurchase.finishTransactionByDate(transactionDate);
    return true;
  } catch {
    return false;
  }
});

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
