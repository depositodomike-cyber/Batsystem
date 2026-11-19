import { app, session, type WebContents } from "electron";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ORIGEM_JANELA } from "./config";
import { janelaPrincipal } from "./janela";
import { origemDe } from "./origem";
import { arquivoLog } from "./servicos/caminhos";

/**
 * Permissões de navegador da interface. Sem handler o Electron concede TUDO;
 * aqui é lista fechada e vale SÓ para o documento da janela principal na
 * origem do app (GD-01): janelas filhas, iframes, documentos `blob:` e
 * qualquer outra origem recebem "não".
 *
 * - `media`: só microfone (wake word, ditado), nunca câmera.
 * - `fileSystem`: File System Access do Repositório. A pasta que o usuário
 *   escolhe no seletor nativo fica registrada (com o modo concedido) em
 *   `userData/pastas-autorizadas.json`, para não pedir de novo a cada
 *   abertura; pode ser revogada em Configurações → Oracle Desktop. Pastas do
 *   sistema e do perfil (lista do SR-13) nunca são autorizadas (GD-06).
 * - escrita na área de transferência, tela cheia e armazenamento persistente.
 *   `clipboard-read` NÃO é concedido (GD-09).
 */

const PERMITIDAS = new Set(["clipboard-sanitized-write", "fullscreen", "persistent-storage"]);

export type ModoPasta = "readable" | "writable";
export interface PastaAutorizada {
  caminho: string;
  modo: ModoPasta;
}

function arquivoPastas(): string {
  return path.join(app.getPath("userData"), "pastas-autorizadas.json");
}

let pastas: PastaAutorizada[] | null = null;

function lerPastas(): PastaAutorizada[] {
  if (pastas) return pastas;
  try {
    const v: unknown = JSON.parse(readFileSync(arquivoPastas(), "utf8"));
    pastas = Array.isArray(v)
      ? v.flatMap((x): PastaAutorizada[] => {
          // Formato antigo: só o caminho → só leitura.
          if (typeof x === "string") return [{ caminho: x, modo: "readable" }];
          const o = x as Partial<PastaAutorizada>;
          return typeof o?.caminho === "string" && (o.modo === "readable" || o.modo === "writable")
            ? [{ caminho: o.caminho, modo: o.modo }]
            : [];
        })
      : [];
  } catch {
    pastas = [];
  }
  return pastas;
}

function gravarPastas(lista: PastaAutorizada[]): void {
  pastas = lista;
  try {
    writeFileSync(arquivoPastas(), JSON.stringify(lista, null, 2));
  } catch (err) {
    console.warn("[permissoes] não foi possível salvar as pastas:", err);
  }
}

const norm = (p: string) => path.resolve(p).toLowerCase();
const dentro = (alvo: string, raiz: string) => alvo === raiz || alvo.startsWith(raiz + path.sep);

/**
 * Pastas que nunca recebem permissão (SR-13): raiz de unidade, a própria pasta
 * do usuário (inteira), AppData, Windows, Program Files, ProgramData e chaves.
 */
export function pastaSensivel(caminho: string): boolean {
  const alvo = norm(caminho);
  if (/^[a-z]:\\?$/.test(alvo) || alvo.startsWith("\\\\")) return true;
  const casa = norm(os.homedir());
  if (alvo === casa) return true;
  const proibidas = [
    path.join(casa, "AppData"),
    path.join(casa, ".ssh"),
    process.env.SystemRoot ?? "C:\\Windows",
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    process.env.ProgramData ?? "C:\\ProgramData",
  ].map(norm);
  return proibidas.some((r) => dentro(alvo, r));
}

export function pastaAutorizada(p: string | undefined, modo: ModoPasta = "readable"): boolean {
  if (!p || pastaSensivel(p)) return false;
  const alvo = norm(p);
  return lerPastas().some(
    (a) => dentro(alvo, norm(a.caminho)) && (modo === "readable" || a.modo === "writable"),
  );
}

function registrarPasta(caminho: string, modo: ModoPasta): void {
  const atual = lerPastas();
  const i = atual.findIndex((a) => norm(a.caminho) === norm(caminho));
  if (i >= 0) {
    if (atual[i].modo === "writable" || modo === "readable") return;
    const nova = [...atual];
    nova[i] = { caminho: atual[i].caminho, modo };
    gravarPastas(nova);
    return;
  }
  gravarPastas([...atual, { caminho: path.resolve(caminho), modo }]);
}

export function listarPastasAutorizadas(): PastaAutorizada[] {
  return [...lerPastas()];
}

export function revogarPasta(caminho: string): boolean {
  const atual = lerPastas();
  const nova = atual.filter((a) => norm(a.caminho) !== norm(caminho));
  if (nova.length === atual.length) return false;
  gravarPastas(nova);
  return true;
}

/** O pedido vem do documento da janela principal, na origem do app? */
export function doDocumentoPrincipal(wc: WebContents | null, url: string | undefined): boolean {
  const principal = janelaPrincipal()?.webContents;
  if (!wc || !principal || wc !== principal) return false;
  // `blob:` e documentos de outra origem dão null aqui.
  return !!url && origemDe(url) === ORIGEM_JANELA;
}

export type DetalhesPermissao = {
  requestingUrl?: string;
  isMainFrame?: boolean;
  mediaType?: string;
  mediaTypes?: string[];
  filePath?: string;
  isDirectory?: boolean;
  fileAccessType?: string;
};

export function decidirCheck(
  wc: WebContents | null,
  permissao: string,
  origem: string,
  d: DetalhesPermissao,
): boolean {
  if (origemDe(origem) !== ORIGEM_JANELA) return false;
  if (permissao === "fileSystem") {
    // O Electron faz a CHECAGEM de arquivos (ler a pasta, abrir cada nota)
    // sem informar o webContents (null) e sem `isMainFrame`. Exigir a janela
    // principal aqui negava toda leitura depois da escolha da pasta — o grafo
    // ficava vazio. Então: webContents ausente é aceito SÓ com a origem do app;
    // se vier, tem de ser a janela principal. Nenhum outro documento tem a
    // origem do app: não há janelas filhas (window.open é negado), a janela
    // principal não navega para blob:, o CSP só permite iframes https: e
    // oracle-previa:, e as prévias têm origem opaca (GD-01, GD-29).
    if (wc && wc !== janelaPrincipal()?.webContents) return false;
    if (d.requestingUrl && origemDe(d.requestingUrl) !== ORIGEM_JANELA) return false;
    return pastaAutorizada(d.filePath, d.fileAccessType === "writable" ? "writable" : "readable");
  }
  if (!doDocumentoPrincipal(wc, d.requestingUrl ?? wc?.getURL())) return false;
  if (d.isMainFrame === false) return false;
  if (permissao === "media") return d.mediaType === "audio";
  return PERMITIDAS.has(permissao);
}

export function decidirPedido(wc: WebContents, permissao: string, d: DetalhesPermissao): boolean {
  if (!doDocumentoPrincipal(wc, d.requestingUrl ?? wc.getURL())) return false;
  if (permissao !== "fileSystem" && d.isMainFrame === false) return false;
  if (permissao === "media") {
    const tipos = d.mediaTypes ?? [];
    return tipos.length > 0 && tipos.every((t) => t === "audio");
  }
  if (permissao === "fileSystem") {
    // Só chega aqui um handle que o usuário escolheu no seletor nativo.
    if (!d.filePath || pastaSensivel(d.filePath)) return false;
    // A pasta escolhida é a do Repositório, onde o Oracle também GRAVA (notas
    // do Telegram, "Salvar no Repositório", anexos): o desktop a registra já
    // com leitura e gravação. Só a pasta escolhida e o que está dentro dela;
    // pastas do sistema e do perfil continuam recusadas acima, e a autorização
    // pode ser revogada em Configurações → Oracle Desktop.
    if (d.isDirectory) registrarPasta(d.filePath, "writable");
    return true;
  }
  return PERMITIDAS.has(permissao);
}

/**
 * Registro das decisões de acesso a pastas (logs/permissoes.log): só o tipo,
 * o caminho e o resultado — para diagnosticar "a pasta não carrega".
 */
function registrarDecisao(tipo: string, wc: WebContents | null, d: DetalhesPermissao, ok: boolean): void {
  try {
    appendFileSync(
      arquivoLog("permissoes.log"),
      `${new Date().toISOString()} ${tipo} ${ok ? "SIM" : "NAO"} acesso=${d.fileAccessType ?? "-"} ` +
        `dir=${d.isDirectory ?? "-"} principal=${wc === janelaPrincipal()?.webContents} ` +
        `url=${d.requestingUrl ? origemDe(d.requestingUrl) : "-"} caminho=${d.filePath ?? "-"}\n`,
    );
  } catch {
    // log é opcional
  }
}

export function configurarPermissoes(): void {
  const s = session.defaultSession;
  s.setPermissionCheckHandler((wc, permissao, origem, detalhes) => {
    const ok = decidirCheck(wc, permissao, origem, detalhes as DetalhesPermissao);
    if (permissao === "fileSystem") registrarDecisao("checagem", wc, detalhes as DetalhesPermissao, ok);
    return ok;
  });
  s.setPermissionRequestHandler((wc, permissao, responder, detalhes) => {
    const ok = decidirPedido(wc, permissao, detalhes as DetalhesPermissao);
    if (permissao === "fileSystem") registrarDecisao("pedido", wc, detalhes as DetalhesPermissao, ok);
    responder(ok);
  });
}
