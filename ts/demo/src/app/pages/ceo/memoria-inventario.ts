// ----------------------------------------------------------------------
// Contexto — leitura da pasta de notas .md.
//
// O Repositório tem duas telas sobre a MESMA pasta local: o Grafo (relações entre
// as notas) e a Lista (inventário dos arquivos). Tudo o que as duas precisam
// para chegar aos mesmos itens — handle da pasta no IndexedDB, permissão de
// leitura, varredura recursiva dos .md, título/tags do frontmatter — vive aqui,
// para as duas nunca divergirem sobre o que é "o Repositório".
//
// A gravação de notas fica em utils/memoriaVault.ts, que usa o MESMO handle
// (mesmo banco/chave do IndexedDB) já com permissão de escrita.
//
// Nem todo navegador tem a File System Access API: o Brave a desliga por padrão
// (brave://flags/#file-system-access-api) e Firefox/Safari não a implementam.
// Nesses casos caímos no <input webkitdirectory>, que abre o mesmo seletor de
// pasta do sistema e devolve os arquivos — só que como cópia somente leitura.
// Para o resto do código não haver dois caminhos, essa cópia é embrulhada num
// handle virtual que cumpre o mesmo contrato de FSDirHandle.
// ----------------------------------------------------------------------

import { PASTA_MEMORIA } from "./memoria-pastas";
import { chaveConta, escopoConta } from "@/utils/escopoConta";

// Tipos mínimos da File System Access API (não estão no lib.dom padrão do TS).
export interface FSFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}
export interface FSDirHandle {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, FSFileHandle | FSDirHandle]>;
  queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
  /** Só na raiz de um handle virtual — ver "cópia somente leitura" no topo. */
  copia?: CopiaDaPasta;
}

/**
 * Cópia dos .md feita pelo <input webkitdirectory>. É um retrato do momento da
 * seleção: sem handle, o navegador não consegue reabrir a pasta depois, então
 * guardamos o conteúdo para as telas continuarem funcionando ao recarregar.
 */
export interface CopiaDaPasta {
  nome: string;
  arquivos: ArquivoMd[];
  /** Quando a cópia foi feita (epoch ms) — o quão velho é o retrato. */
  copiadaEm: number;
}

// ---- Persistência do handle da pasta (IndexedDB) ----
const IDB_DB = "ceo-memoria";
const IDB_STORE = "kv";
const IDB_KEY_BASE = "dir-handle";
const IDB_CONFIGURED_BASE = "dir-handle-configured";

/**
 * Repositório cujo handle de pasta as APIs sem parâmetro devem usar.
 * Mantido em sincronia com o contexto ativo (PrototipoContasProvider).
 */
let repositorioPastaAtual: string | null = null;

export function definirRepositorioPastaAtivo(
  repositorioId: string | null,
): void {
  repositorioPastaAtual = repositorioId;
}

export function repositorioPastaAtivo(): string | null {
  return repositorioPastaAtual;
}

function resolveRepositorioId(repositorioId?: string | null): string | null {
  return repositorioId ?? repositorioPastaAtual;
}

function chaveHandle(repositorioId: string): string {
  return chaveConta(`${IDB_KEY_BASE}:${repositorioId}`);
}

function chaveConfigurada(repositorioId: string): string {
  return chaveConta(`${IDB_CONFIGURED_BASE}:${repositorioId}`);
}

/** Chaves anteriores à isolação por repositório (uma pasta por conta). */
function chaveHandleLegada(): string {
  return chaveConta(IDB_KEY_BASE);
}

function chaveConfiguradaLegada(): string {
  return chaveConta(IDB_CONFIGURED_BASE);
}

function idbGetRaw<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readonly");
        const g = tx.objectStore(IDB_STORE).get(key);
        g.onsuccess = () => resolve(g.result as T | undefined);
        g.onerror = () => resolve(undefined);
      };
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbPutRaw(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function idbDeleteRaw(key: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Se ainda não há pasta neste repositório, promove o handle legado da conta
 * (pré-isolamento) uma única vez, para não perder a pasta já configurada.
 */
async function migrarHandleLegado(repositorioId: string): Promise<void> {
  const jaConfigurada = await idbGetRaw<boolean>(chaveConfigurada(repositorioId));
  if (jaConfigurada === true) return;

  const legadoConfig = await idbGetRaw<boolean>(chaveConfiguradaLegada());
  if (legadoConfig !== true) return;

  const legadoHandle = await idbGetRaw<unknown>(chaveHandleLegada());
  if (!legadoHandle) return;

  await idbPutRaw(chaveHandle(repositorioId), legadoHandle);
  await idbPutRaw(chaveConfigurada(repositorioId), true);
  await idbDeleteRaw(chaveHandleLegada());
  await idbDeleteRaw(chaveConfiguradaLegada());
}

/** Handle da pasta escolhida na última visita (Grafo, Lista ou Configurações). */
export async function pastaContextoSalva(
  repositorioId?: string | null,
): Promise<FSDirHandle | undefined> {
  if (escopoConta() === "anon") return undefined;

  const repoId = resolveRepositorioId(repositorioId);
  if (!repoId) return undefined;

  await migrarHandleLegado(repoId);

  // Um handle só pertence à conta/repositório quando selecionado explicitamente.
  // Não reutilizamos a chave global legada: isso faria outra conta herdar a
  // configuração de quem usou o navegador anteriormente.
  const configurada = await idbGetRaw<boolean>(chaveConfigurada(repoId));
  if (configurada !== true) return undefined;

  const guardado = await idbGetRaw<unknown>(chaveHandle(repoId));
  if (!guardado) return undefined;
  const copia = comoCopia(guardado);
  return copia ? handleDaCopia(copia) : (guardado as FSDirHandle);
}

export async function guardarPastaContexto(
  handle: FSDirHandle,
  repositorioId?: string | null,
): Promise<void> {
  if (escopoConta() === "anon") return;
  const repoId = resolveRepositorioId(repositorioId);
  if (!repoId) return;
  // Um handle virtual tem funções e não sobrevive à clonagem do IndexedDB;
  // o que guardamos dele é a cópia dos arquivos, que é dado puro.
  await idbPutRaw(chaveHandle(repoId), handle.copia ?? handle);
  await idbPutRaw(chaveConfigurada(repoId), true);
}

function comoCopia(valor: unknown): CopiaDaPasta | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const c = valor as Partial<CopiaDaPasta>;
  return Array.isArray(c.arquivos) && typeof c.nome === "string"
    ? (c as CopiaDaPasta)
    : undefined;
}

/** A pasta desta conta é uma cópia somente leitura, não a pasta viva em disco. */
export function pastaEhCopia(handle: FSDirHandle): boolean {
  return handle.copia !== undefined;
}

/**
 * Conteúdo de uma nota vindo da cópia. É o que permite abrir um nó do grafo em
 * navegadores sem File System Access API, onde não há como reler o arquivo.
 */
export async function lerNotaDaCopia(path: string): Promise<string | undefined> {
  const handle = await pastaContextoSalva();
  return handle?.copia?.arquivos.find((a) => a.path === path)?.text;
}

/** O navegador abre a pasta de verdade (lê e grava direto nos arquivos). */
export function pastaContextoNativa(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

export function pastaContextoSuportada(): boolean {
  return pastaContextoNativa() || selecaoPorInputSuportada();
}

function selecaoPorInputSuportada(): boolean {
  return (
    typeof document !== "undefined" &&
    "webkitdirectory" in document.createElement("input")
  );
}

/**
 * Abre o seletor de pasta e guarda o resultado. `cancelado` cobre tanto o
 * usuário fechar o seletor quanto o navegador recusar a escolha — em nenhum dos
 * dois casos há o que avisar.
 *
 * `repositorioId` opcional: vincula a pasta a um repositório específico
 * (Configurações lista vários). Sem ele, usa o repositório ativo.
 */
export async function escolherPastaContexto(
  repositorioId?: string | null,
): Promise<
  { ok: true; dir: FSDirHandle } | { ok: false; reason: "unsupported" | "cancelado" }
> {
  const picker = (window as unknown as {
    showDirectoryPicker?: () => Promise<FSDirHandle>;
  }).showDirectoryPicker;

  if (!picker) return escolherPastaPorInput(repositorioId);

  try {
    const dir = await picker();
    await guardarPastaContexto(dir, repositorioId);
    return { ok: true, dir };
  } catch {
    return { ok: false, reason: "cancelado" };
  }
}

/**
 * Seletor de pasta sem File System Access API. O <input webkitdirectory> abre o
 * mesmo diálogo do sistema, mas entrega Files avulsos: lemos os .md na hora e
 * seguimos com a cópia, já que não há handle para reabrir a pasta depois.
 */
function escolherPastaPorInput(
  repositorioId?: string | null,
): Promise<
  { ok: true; dir: FSDirHandle } | { ok: false; reason: "unsupported" | "cancelado" }
> {
  if (!selecaoPorInputSuportada()) {
    return Promise.resolve({ ok: false as const, reason: "unsupported" as const });
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    input.style.display = "none";
    document.body.appendChild(input);

    let respondido = false;
    const encerrar = (
      r: { ok: true; dir: FSDirHandle } | { ok: false; reason: "cancelado" },
    ) => {
      if (respondido) return;
      respondido = true;
      input.remove();
      resolve(r);
    };

    input.addEventListener("cancel", () => encerrar({ ok: false, reason: "cancelado" }));
    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])];
      if (!files.length) {
        encerrar({ ok: false, reason: "cancelado" });
        return;
      }
      // Marca antes do await: o `focus` abaixo dispara junto com o change e não
      // pode cancelar uma seleção que está apenas sendo lida.
      respondido = true;
      void copiarPasta(files).then(async (copia) => {
        input.remove();
        const dir = handleDaCopia(copia);
        await guardarPastaContexto(dir, repositorioId);
        resolve({ ok: true, dir });
      });
    });

    // Rede de segurança para navegadores sem o evento `cancel`: ao fechar o
    // diálogo a janela recupera o foco e, se nada foi escolhido, desistimos.
    // Conferimos `files` junto para não cancelar uma seleção cujo `change`
    // ainda não foi despachado.
    window.addEventListener(
      "focus",
      () =>
        setTimeout(() => {
          if (!input.files?.length) encerrar({ ok: false, reason: "cancelado" });
        }, 500),
      { once: true },
    );

    input.click();
  });
}

/** Files do <input webkitdirectory> → cópia dos .md, com caminhos relativos. */
async function copiarPasta(files: File[]): Promise<CopiaDaPasta> {
  const raiz = files[0]?.webkitRelativePath?.split("/")[0] || "Repositório";
  const arquivos: ArquivoMd[] = [];

  for (const file of files) {
    // webkitRelativePath inclui a pasta escolhida; o resto do código trabalha
    // com caminhos relativos a ela ("Reuniões/ata.md").
    const rel = file.webkitRelativePath
      ? file.webkitRelativePath.split("/").slice(1).join("/")
      : file.name;
    const segmentos = rel.split("/");
    if (!rel.toLowerCase().endsWith(".md")) continue;
    if (segmentos.some((s) => s.startsWith("."))) continue; // .obsidian, .git…
    try {
      arquivos.push({
        path: rel,
        name: segmentos[segmentos.length - 1],
        text: await file.text(),
        modificadoEm: file.lastModified,
      });
    } catch {
      /* arquivo ilegível — ignora */
    }
  }

  return { nome: raiz, arquivos, copiadaEm: Date.now() };
}

interface NoDaCopia {
  pastas: Map<string, NoDaCopia>;
  arquivos: Map<string, ArquivoMd>;
}

/** Cópia → handle virtual, para lerArquivosMd e companhia não saberem a diferença. */
function handleDaCopia(copia: CopiaDaPasta): FSDirHandle {
  const raiz: NoDaCopia = { pastas: new Map(), arquivos: new Map() };
  for (const arquivo of copia.arquivos) {
    const segmentos = arquivo.path.split("/");
    const nome = segmentos.pop();
    if (!nome) continue;
    let no = raiz;
    for (const seg of segmentos) {
      let filho = no.pastas.get(seg);
      if (!filho) {
        filho = { pastas: new Map(), arquivos: new Map() };
        no.pastas.set(seg, filho);
      }
      no = filho;
    }
    no.arquivos.set(nome, arquivo);
  }
  return handleDoNo(copia.nome, raiz, copia);
}

function handleDoNo(nome: string, no: NoDaCopia, copia?: CopiaDaPasta): FSDirHandle {
  return {
    kind: "directory",
    name: nome,
    copia,
    entries: async function* (): AsyncIterableIterator<
      [string, FSFileHandle | FSDirHandle]
    > {
      for (const [n, arquivo] of no.arquivos) yield [n, handleDoArquivo(n, arquivo)];
      for (const [n, filho] of no.pastas) yield [n, handleDoNo(n, filho)];
    },
  };
}

function handleDoArquivo(nome: string, arquivo: ArquivoMd): FSFileHandle {
  return {
    kind: "file",
    name: nome,
    getFile: async () =>
      new File([arquivo.text], nome, {
        type: "text/markdown",
        lastModified: arquivo.modificadoEm,
      }),
  };
}

/**
 * Permissão de leitura do handle guardado. `pedir` só deve ser true a partir de
 * um gesto do usuário (clique) — `requestPermission` é ignorado fora disso.
 */
export async function permissaoDeLeitura(
  handle: FSDirHandle,
  opts?: { pedir?: boolean },
): Promise<boolean> {
  try {
    let estado: PermissionState = handle.queryPermission
      ? await handle.queryPermission({ mode: "read" })
      : "granted";
    if (estado !== "granted" && opts?.pedir && handle.requestPermission) {
      estado = await handle.requestPermission({ mode: "read" });
    }
    return estado === "granted";
  } catch {
    return false;
  }
}

// ---- Leitura dos arquivos ----

export interface ArquivoMd {
  /** Caminho relativo à pasta do Repositório ("Reuniões/ata.md"). */
  path: string;
  name: string;
  text: string;
  /** Última gravação do arquivo em disco (epoch ms). */
  modificadoEm: number;
}

/** Varre a pasta (recursivamente) e devolve todos os .md legíveis. */
export async function lerArquivosMd(
  dir: FSDirHandle,
  prefix = "",
  acc: ArquivoMd[] = [],
): Promise<ArquivoMd[]> {
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith(".")) continue; // ignora ocultos (.obsidian, .git…)
    if (handle.kind === "file") {
      if (!name.toLowerCase().endsWith(".md")) continue;
      try {
        const file = await handle.getFile();
        acc.push({
          path: prefix + name,
          name,
          text: await file.text(),
          modificadoEm: file.lastModified,
        });
      } catch {
        /* arquivo ilegível — ignora */
      }
    } else {
      await lerArquivosMd(handle, prefix + name + "/", acc);
    }
  }
  return acc;
}

/** Título e tags do frontmatter (inline, bloco ou CSV) + corpo sem o frontmatter. */
export function parseNotaMd(text: string): {
  titulo: string;
  tags: string[];
  body: string;
} {
  let titulo = "";
  let tags: string[] = [];
  let body = text;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    const yaml = fm[1];
    body = text.slice(fm[0].length);
    const tm = yaml.match(/^\s*t[íi]tulo\s*:\s*(.+)$/im) || yaml.match(/^\s*title\s*:\s*(.+)$/im);
    if (tm) titulo = tm[1].trim().replace(/^["']|["']$/g, "");
    const inline = yaml.match(/^\s*tags\s*:\s*\[(.*)\]\s*$/im);
    if (inline) {
      tags = inline[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "").replace(/^#/, "")).filter(Boolean);
    } else {
      const block = yaml.match(/^\s*tags\s*:\s*\r?\n((?:\s*-\s*.+\r?\n?)+)/im);
      if (block) {
        tags = block[1].split(/\r?\n/).map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "").replace(/^#/, "")).filter(Boolean);
      } else {
        const csv = yaml.match(/^\s*tags\s*:\s*(.+)$/im);
        if (csv && !csv[1].includes("[")) tags = csv[1].split(/[,\s]+/).map((s) => s.replace(/^#/, "").trim()).filter(Boolean);
      }
    }
  }
  return { titulo, tags, body };
}

/** Nome do arquivo sem a extensão — título de quem não tem frontmatter. */
export function tituloPadrao(name: string): string {
  return name.replace(/\.md$/i, "");
}

/** Payload de indexação na IA (`/ai/vault`) a partir dos arquivos lidos. */
export function notasParaVault(
  arquivos: ArquivoMd[],
): { path: string; titulo: string; conteudo: string }[] {
  return arquivos.map((a) => ({
    path: a.path,
    titulo: parseNotaMd(a.text).titulo || tituloPadrao(a.name),
    conteudo: a.text,
  }));
}

// ---- Inventário (a Lista) ----

/**
 * Uma nota do Repositório como item de lista. É o mesmo conjunto que o grafo mostra
 * como nós de nota — os hubs de tag e de pasta são sintéticos e ficam de fora,
 * porque não existem como arquivo.
 */
export interface ItemContexto {
  /** Caminho relativo à pasta do Repositório — o mesmo id usado pelo nó do grafo. */
  path: string;
  titulo: string;
  /** Primeiro segmento do caminho; "Raiz" para notas soltas na pasta. */
  pasta: string;
  /** Segmentos do meio ("Conversas" em "Plano LATAM/Conversas/x.md"). */
  subpasta: string;
  tags: string[];
  /** Rótulo derivado das tags/pasta — não é um campo gravado na nota. */
  tipo: string;
  /** Linha `Origem:` do corpo, quando a nota veio de um conector ou de Notas. */
  origem: string;
  modificadoEm: number;
}

/** Pasta usada como "tema" no grafo e na lista: o primeiro segmento do caminho. */
export const PASTA_RAIZ = "Raiz";

// Tipo do item: primeiro pelas tags (mais específicas), depois pela pasta. As
// tags vêm de quem gravou a nota (ver memoria-conteudo/memoria-grupos e os
// modais do IA Studio) e a ordem abaixo é a prioridade quando há mais de uma —
// um resumo de áudio, por exemplo, é tagueado como reunião E áudio.
const TIPO_POR_TAG: [RegExp, string][] = [
  [/^transcri[çc][ãa]o$/i, "Transcrição"],
  [/^[áa]udio$/i, "Áudio"],
  [/^(reuni[ãa]o|ata)$/i, "Reunião"],
  [/^pessoa$/i, "Pessoa"],
  [/^e-?mail$/i, "E-mail"],
  [/^slack$/i, "Slack"],
  [/^conversa$/i, "Conversa"],
  [/^documento$/i, "Documento"],
  [/^nota$/i, "Nota"],
];

const TIPO_POR_PASTA: Record<string, string> = {
  [PASTA_MEMORIA.analise]: "Análise",
  [PASTA_MEMORIA.apresentacao]: "Apresentação",
  [PASTA_MEMORIA.artigo]: "Artigo",
  [PASTA_MEMORIA.ata]: "Reunião",
  [PASTA_MEMORIA.carrossel]: "Carrossel",
  [PASTA_MEMORIA.cortes]: "Corte",
  [PASTA_MEMORIA.dashboard]: "Dashboard",
  [PASTA_MEMORIA.documento]: "Documento",
  [PASTA_MEMORIA.imagem]: "Imagem",
  [PASTA_MEMORIA.melhorar]: "Texto",
  [PASTA_MEMORIA.pessoas]: "Pessoa",
  [PASTA_MEMORIA.reunioes]: "Reunião",
  [PASTA_MEMORIA.video]: "Vídeo",
};

/**
 * `true` para tags que classificam o TIPO da nota ("reunião", "e-mail",
 * "documento"…), escritas pelo próprio app ao gravar. O grafo usa isto como
 * stoplist: essas tags marcam o formato do conteúdo, não um assunto, e viram
 * mega-hubs ligados a tudo se entrarem no mapa de entidades.
 */
export function ehTagDeTipo(tag: string): boolean {
  const t = tag.trim();
  if (!t) return false;
  if (/^(grupo|conversa)$/i.test(t)) return true;
  return TIPO_POR_TAG.some(([padrao]) => padrao.test(t));
}

function tipoDoItem(tags: string[], pasta: string): string {
  for (const [padrao, rotulo] of TIPO_POR_TAG) {
    if (tags.some((t) => padrao.test(t))) return rotulo;
  }
  return TIPO_POR_PASTA[pasta] ?? "Nota";
}

function origemDoCorpo(body: string): string {
  const m = body.match(/^\s*Origem\s*:\s*(.+)$/im);
  return m ? m[1].trim() : "";
}

/** Arquivos lidos da pasta → itens de lista, do mais recente para o mais antigo. */
export function montarInventario(arquivos: ArquivoMd[]): ItemContexto[] {
  return arquivos
    .map((a) => {
      const { titulo, tags, body } = parseNotaMd(a.text);
      const seg = a.path.split("/");
      const pasta = seg.length > 1 ? seg[0] : PASTA_RAIZ;
      const limpas = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
      return {
        path: a.path,
        titulo: titulo || tituloPadrao(a.name),
        pasta,
        subpasta: seg.slice(1, -1).join("/"),
        tags: limpas,
        tipo: tipoDoItem(limpas, pasta),
        origem: origemDoCorpo(body),
        modificadoEm: a.modificadoEm,
      };
    })
    .sort((a, b) => b.modificadoEm - a.modificadoEm);
}

/** Pastas presentes no inventário, com a contagem de notas de cada uma. */
export function pastasDoInventario(
  itens: ItemContexto[],
): { pasta: string; total: number }[] {
  const contagem = new Map<string, number>();
  for (const i of itens) contagem.set(i.pasta, (contagem.get(i.pasta) ?? 0) + 1);
  return [...contagem.entries()]
    .map(([pasta, total]) => ({ pasta, total }))
    // "Raiz" por último: é o resto, não um tema.
    .sort((a, b) =>
      a.pasta === PASTA_RAIZ
        ? 1
        : b.pasta === PASTA_RAIZ
          ? -1
          : a.pasta.localeCompare(b.pasta, "pt-BR"),
    );
}

/** Filtro da lista: pasta selecionada + busca por título, tags, tipo e caminho. */
export function filtrarInventario(
  itens: ItemContexto[],
  opts: { pasta?: string | null; busca?: string },
): ItemContexto[] {
  const q = (opts.busca ?? "").trim().toLowerCase();
  return itens.filter((i) => {
    if (opts.pasta && i.pasta !== opts.pasta) return false;
    if (!q) return true;
    return (
      i.titulo.toLowerCase().includes(q) ||
      i.path.toLowerCase().includes(q) ||
      i.tipo.toLowerCase().includes(q) ||
      i.origem.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}
