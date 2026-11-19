// Gera os ícones do Oracle Desktop a partir de ts/demo/public/oracle-favicon.svg,
// renderizando o SVG no próprio Chromium do Electron.
//
// Uso (em desktop/):  npx electron scripts/gerar-icones.cjs
// Saída em desktop/recursos/: icon.ico (16–256), icon.png (512), bandeja.png (32),
// bandeja@2x.png (64).
const { app, BrowserWindow } = require("electron");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const svg = readFileSync(path.resolve(raiz, "..", "ts", "demo", "public", "oracle-favicon.svg"), "utf8");
const saida = path.join(raiz, "recursos");

async function renderizar(win, tamanho) {
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"
         style="width:${tamanho}px;height:${tamanho}px;display:block"></body></html>`;
  win.setContentSize(tamanho, tamanho);
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
  await new Promise((r) => setTimeout(r, 150));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: tamanho, height: tamanho });
  return img.resize({ width: tamanho, height: tamanho, quality: "best" }).toPNG();
}

/** ICO com entradas PNG (aceito pelo Windows Vista+ e pelo electron-builder). */
function montarIco(pngs) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(pngs.length, 4);
  const entradas = [];
  let deslocamento = 6 + 16 * pngs.length;
  for (const { tamanho, png } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(deslocamento, 12);
    deslocamento += png.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.png)]);
}

app.whenReady().then(async () => {
  mkdirSync(saida, { recursive: true });
  const win = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  const tamanhosIco = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const t of tamanhosIco) pngs.push({ tamanho: t, png: await renderizar(win, t) });
  writeFileSync(path.join(saida, "icon.ico"), montarIco(pngs));
  writeFileSync(path.join(saida, "icon.png"), await renderizar(win, 512));
  writeFileSync(path.join(saida, "bandeja.png"), await renderizar(win, 32));
  writeFileSync(path.join(saida, "bandeja@2x.png"), await renderizar(win, 64));
  console.log("Ícones gerados em", saida);
  app.quit();
});
