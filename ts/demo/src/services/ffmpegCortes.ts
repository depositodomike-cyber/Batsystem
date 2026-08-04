// Editor de cortes — motor de vídeo 100% no navegador (ffmpeg.wasm), portado do
// beculture/Confi (que usa ffmpeg local). Sem servidor: o vídeo é processado na
// própria máquina do usuário via WebAssembly.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// O core (js + wasm, build UMD single-thread) é buscado do CDN e convertido em
// blob URL em runtime — padrão do ffmpeg.wasm. O pacote @ffmpeg/core bloqueia o
// import direto do subpath dist/umd (exports map), e o worker precisa do UMD
// (classic), não do ESM; por isso carregamos por URL. Não há CSP na app.
const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

export type Aspecto = "original" | "9:16" | "1:1" | "16:9";
export type TextoPos = "top" | "center" | "bottom";

export interface Segmento {
  inicio: number; // segundos
  fim: number;
}

export interface ExportarSpec {
  file: File;
  segmentos: Segmento[];
  /** Dimensões de saída já resolvidas (aspecto aplicado). */
  ow: number;
  oh: number;
  velocidade: number; // 0.5 | 1 | 1.5 | 2
  volume: number; // 0..2
  texto?: string;
  textoPos?: TextoPos;
  onProgress?: (p: number) => void;
}

let _ffmpeg: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

/** Carrega o ffmpeg.wasm uma única vez (singleton). */
export function carregarFfmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (_ffmpeg) return Promise.resolve(_ffmpeg);
  if (_loading) return _loading;
  _loading = (async () => {
    const ffmpeg = new FFmpeg();
    if (onProgress) ffmpeg.on("progress", ({ progress }) => onProgress(Math.max(0, Math.min(1, progress))));
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    _ffmpeg = ffmpeg;
    return ffmpeg;
  })();
  return _loading;
}

/** Desenha o texto num PNG transparente do tamanho do quadro (overlay do ffmpeg). */
async function overlayPng(texto: string, pos: TextoPos, ow: number, oh: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = ow;
  canvas.height = oh;
  const ctx = canvas.getContext("2d")!;
  const fontSize = Math.round(oh * 0.06);
  ctx.font = `700 ${fontSize}px Inter, system-ui, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Quebra o texto em linhas que caibam na largura (com margem).
  const maxW = ow * 0.86;
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width > maxW && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);

  const lineH = fontSize * 1.25;
  const blocoH = linhas.length * lineH;
  const margem = oh * 0.06;
  let y0: number;
  if (pos === "top") y0 = margem + lineH / 2;
  else if (pos === "bottom") y0 = oh - margem - blocoH + lineH / 2;
  else y0 = (oh - blocoH) / 2 + lineH / 2;

  linhas.forEach((linha, i) => {
    const y = y0 + i * lineH;
    ctx.lineWidth = Math.max(2, fontSize * 0.14);
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(linha, ow / 2, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(linha, ow / 2, y);
  });

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function buildFilterComplex(spec: ExportarSpec, temTexto: boolean): string {
  const { segmentos, ow, oh, velocidade, volume } = spec;
  const partes: string[] = [];
  const vlabels: string[] = [];
  const alabels: string[] = [];
  segmentos.forEach((s, i) => {
    const ini = Math.max(0, s.inicio).toFixed(3);
    const fim = Math.max(s.inicio + 0.05, s.fim).toFixed(3);
    partes.push(`[0:v]trim=start=${ini}:end=${fim},setpts=PTS-STARTPTS[v${i}]`);
    partes.push(`[0:a]atrim=start=${ini}:end=${fim},asetpts=PTS-STARTPTS[a${i}]`);
    vlabels.push(`[v${i}]`);
    alabels.push(`[a${i}]`);
  });
  const n = segmentos.length;
  partes.push(`${vlabels.join("")}${alabels.join("")}concat=n=${n}:v=1:a=1[vc][ac]`);

  // Vídeo: reframe (crop central para o aspecto + scale para ow×oh) → velocidade → texto.
  let v = "[vc]";
  partes.push(
    `${v}crop='min(iw,ih*${ow}/${oh})':'min(ih,iw*${oh}/${ow})',scale=${ow}:${oh},setsar=1[vr]`,
  );
  v = "[vr]";
  if (velocidade !== 1) {
    partes.push(`${v}setpts=PTS/${velocidade}[vs]`);
    v = "[vs]";
  }
  if (temTexto) {
    partes.push(`[1:v]format=rgba[ov]`);
    partes.push(`${v}[ov]overlay=0:0[vo]`);
    v = "[vo]";
  }
  partes.push(`${v}format=yuv420p[vout]`);

  // Áudio: velocidade (atempo) → volume.
  let a = "[ac]";
  if (velocidade !== 1) {
    partes.push(`${a}atempo=${velocidade}[as]`);
    a = "[as]";
  }
  if (volume !== 1) {
    partes.push(`${a}volume=${volume}[av]`);
    a = "[av]";
  }
  partes.push(`${a}anull[aout]`);

  return partes.join(";");
}

/** Renderiza o corte final e devolve o MP4 como Blob. */
export async function exportarCorte(spec: ExportarSpec): Promise<Blob> {
  const ffmpeg = await carregarFfmpeg();
  if (spec.onProgress) ffmpeg.on("progress", ({ progress }) => spec.onProgress!(Math.max(0, Math.min(1, progress))));

  const temTexto = !!(spec.texto && spec.texto.trim());
  await ffmpeg.writeFile("input.mp4", await fetchFile(spec.file));
  if (temTexto) {
    await ffmpeg.writeFile("overlay.png", await overlayPng(spec.texto!.trim(), spec.textoPos ?? "bottom", spec.ow, spec.oh));
  }

  const fc = buildFilterComplex(spec, temTexto);
  const args = ["-i", "input.mp4"];
  if (temTexto) args.push("-i", "overlay.png");
  args.push(
    "-filter_complex",
    fc,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "24",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "output.mp4",
  );

  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile("output.mp4");
  // Limpa o FS do worker para não acumular entre exports.
  await ffmpeg.deleteFile("input.mp4").catch(() => {});
  await ffmpeg.deleteFile("output.mp4").catch(() => {});
  if (temTexto) await ffmpeg.deleteFile("overlay.png").catch(() => {});

  const bytes = data as Uint8Array;
  // Copia para um ArrayBuffer próprio (o buffer do worker pode ser
  // SharedArrayBuffer, que não é um BlobPart válido).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: "video/mp4" });
}

/** Dimensões de saída conforme o aspecto e as dimensões da fonte. */
export function dimensoesSaida(aspecto: Aspecto, sw: number, sh: number): { ow: number; oh: number } {
  const par = (n: number) => (n % 2 === 0 ? n : n + 1);
  if (aspecto === "9:16") return { ow: 720, oh: 1280 };
  if (aspecto === "1:1") return { ow: 1080, oh: 1080 };
  if (aspecto === "16:9") return { ow: 1280, oh: 720 };
  return { ow: par(sw || 1280), oh: par(sh || 720) };
}
