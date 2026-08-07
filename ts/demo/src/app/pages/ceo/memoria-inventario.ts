// ----------------------------------------------------------------------
// Contexto — leitura da pasta de notas .md.
//
// O Contexto tem duas telas sobre a MESMA pasta local: o Grafo (relações entre
// as notas) e a Lista (inventário dos arquivos). Tudo o que as duas precisam
// para chegar aos mesmos itens — handle da pasta no IndexedDB, permissão de
// leitura, varredura recursiva dos .md, título/tags do frontmatter — vive aqui,
// para as duas nunca divergirem sobre o que é "o Contexto".
//
// A gravação de notas fica em utils/memoriaVault.ts, que usa o MESMO handle
// (mesmo banco/chave do IndexedDB) já com permissão de escrita.
// ----------------------------------------------------------------------

import { PASTA_MEMORIA } from "./memoria-pastas";

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
}

// ---- Persistência do handle da pasta (IndexedDB) ----
const IDB_DB = "ceo-memoria";
const IDB_STORE = "kv";
const IDB_KEY = "dir-handle";

/** Handle da pasta escolhida na última visita (Grafo, Lista ou Configurações). */
export function pastaContextoSalva(): Promise<FSDirHandle | undefined> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readonly");
        const g = tx.objectStore(IDB_STORE).get(IDB_KEY);
        g.onsuccess = () => resolve(g.result as FSDirHandle | undefined);
        g.onerror = () => resolve(undefined);
      };
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export function guardarPastaContexto(handle: FSDirHandle): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function pastaContextoSuportada(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

/**
 * Abre o seletor de pasta e guarda o handle. `cancelado` cobre tanto o usuário
 * fechar o seletor quanto o navegador recusar a escolha — em nenhum dos dois
 * casos há o que avisar.
 */
export async function escolherPastaContexto(): Promise<
  { ok: true; dir: FSDirHandle } | { ok: false; reason: "unsupported" | "cancelado" }
> {
  const picker = (window as unknown as {
    showDirectoryPicker?: () => Promise<FSDirHandle>;
  }).showDirectoryPicker;
  if (!picker) return { ok: false, reason: "unsupported" };
  try {
    const dir = await picker();
    await guardarPastaContexto(dir);
    return { ok: true, dir };
  } catch {
    return { ok: false, reason: "cancelado" };
  }
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
  /** Caminho relativo à pasta do Contexto ("Reuniões/ata.md"). */
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
 * Uma nota do Contexto como item de lista. É o mesmo conjunto que o grafo mostra
 * como nós de nota — os hubs de tag e de pasta são sintéticos e ficam de fora,
 * porque não existem como arquivo.
 */
export interface ItemContexto {
  /** Caminho relativo à pasta do Contexto — o mesmo id usado pelo nó do grafo. */
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
