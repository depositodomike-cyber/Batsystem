// Substitui o módulo `electron` nos testes (node --require test/electron-falso.cjs):
// os controles de segurança do processo principal rodam sem abrir o app.
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const pastaTeste = fs.mkdtempSync(path.join(os.tmpdir(), "oracle-desktop-teste-"));

class WebContentsFalso {
  constructor() {
    this.mainFrame = { url: "" };
    this.handlers = {};
  }
  on() {}
  once() {}
  setWindowOpenHandler() {}
  getURL() {
    return this.mainFrame.url;
  }
  executeJavaScript() {
    return Promise.resolve();
  }
}

class BrowserWindowFalsa {
  constructor() {
    this.webContents = new WebContentsFalso();
    this.destruida = false;
  }
  on() {}
  once() {}
  loadURL(url) {
    this.webContents.mainFrame.url = url;
    return Promise.resolve();
  }
  isDestroyed() {
    return this.destruida;
  }
  isMinimized() {
    return false;
  }
  show() {}
  focus() {}
  hide() {}
}

const sessaoFalsa = {
  setPermissionCheckHandler() {},
  setPermissionRequestHandler() {},
  protocol: { handle() {} },
};

const electron = {
  app: {
    isPackaged: false,
    getPath: () => pastaTeste,
    getVersion: () => "0.0.0-teste",
    setPath() {},
    on() {},
  },
  BrowserWindow: BrowserWindowFalsa,
  WebContentsFalso,
  ipcMain: { on() {}, handle() {} },
  shell: { openExternal: async () => {} },
  session: { defaultSession: sessaoFalsa, fromPartition: () => sessaoFalsa },
  protocol: { registerSchemesAsPrivileged() {}, handle() {} },
  net: { fetch: async () => new Response("") },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(`cifrado:${s}`),
    decryptString: (b) => b.toString().replace(/^cifrado:/, ""),
  },
  nativeImage: { createFromPath: () => ({ addRepresentation() {}, toPNG: () => Buffer.alloc(0) }) },
  globalShortcut: { register: () => true, unregister() {}, unregisterAll() {} },
  Notification: class {
    static isSupported() {
      return false;
    }
  },
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
  Tray: class {},
  dialog: {},
  utilityProcess: {},
};

const carregarOriginal = Module._load;
Module._load = function (pedido, ...resto) {
  if (pedido === "electron") return electron;
  return carregarOriginal.call(this, pedido, ...resto);
};
