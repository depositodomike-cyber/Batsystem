// ----------------------------------------------------------------------
// Notas Autoadesivas do Windows (Sticky Notes) → notas .md do Repositório.
//
// O app guarda as notas num SQLite local:
//   %LOCALAPPDATA%\Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\LocalState\plum.sqlite
// Tabela `Note`: Text, Theme (cor), CreatedAt/UpdatedAt/DeletedAt (ticks .NET).
//
// O SQLite está em modo WAL: as edições recentes ficam em `plum.sqlite-wal`
// até o app consolidar. Por isso aceitamos os dois arquivos e aplicamos o WAL
// aqui mesmo (sem ele, notas e edições recentes sumiriam).
//
// Tudo roda no navegador: o banco nunca sai do computador.
// ----------------------------------------------------------------------

import type { SqlJsStatic } from "sql.js";

export const PASTA_STICKY =
  "%LOCALAPPDATA%\\Packages\\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\\LocalState";

export interface NotaAutoadesiva {
  id: string;
  titulo: string;
  /** Corpo já em Markdown. */
  markdown: string;
  /** Texto puro (prévia e busca). */
  texto: string;
  cor: string;
  criadoEm: string | null;
  atualizadoEm: string | null;
}

// ------------------------------------------------------------------ WAL

const u32 = (v: DataView, o: number) => v.getUint32(o, false);

/** Checksum do WAL (soma dupla em palavras de 32 bits; ordem conforme o magic). */
function checksum(
  dados: Uint8Array,
  inicio: number,
  fim: number,
  bigEndian: boolean,
  s: [number, number],
): [number, number] {
  const v = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  let [s0, s1] = s;
  for (let i = inicio; i < fim; i += 8) {
    s0 = (s0 + v.getUint32(i, !bigEndian) + s1) >>> 0;
    s1 = (s1 + v.getUint32(i + 4, !bigEndian) + s0) >>> 0;
  }
  return [s0, s1];
}

/**
 * Aplica as transações confirmadas do `-wal` sobre o arquivo principal e
 * devolve um banco único em modo rollback (o sql.js não lê WAL).
 */
export function aplicarWal(db: Uint8Array, wal: Uint8Array | null): Uint8Array {
  const paginas = new Map<number, Uint8Array>();
  let tamanhoPaginas = 0;
  let pageSize = 0;

  if (wal && wal.byteLength >= 32) {
    const h = new DataView(wal.buffer, wal.byteOffset, wal.byteLength);
    const magic = u32(h, 0);
    if (magic === 0x377f0682 || magic === 0x377f0683) {
      const bigEndian = magic === 0x377f0683;
      pageSize = u32(h, 8);
      const salt1 = u32(h, 16);
      const salt2 = u32(h, 20);
      let s = checksum(wal, 0, 24, bigEndian, [0, 0]);
      if (s[0] === u32(h, 24) && s[1] === u32(h, 28) && pageSize >= 512) {
        const pendentes = new Map<number, Uint8Array>();
        for (let o = 32; o + 24 + pageSize <= wal.byteLength; o += 24 + pageSize) {
          if (u32(h, o + 8) !== salt1 || u32(h, o + 12) !== salt2) break;
          s = checksum(wal, o, o + 8, bigEndian, s);
          s = checksum(wal, o + 24, o + 24 + pageSize, bigEndian, s);
          if (s[0] !== u32(h, o + 16) || s[1] !== u32(h, o + 20)) break;
          pendentes.set(u32(h, o), wal.subarray(o + 24, o + 24 + pageSize));
          const commit = u32(h, o + 4);
          if (commit > 0) {
            for (const [n, p] of pendentes) paginas.set(n, p);
            pendentes.clear();
            tamanhoPaginas = commit;
          }
        }
      }
    }
  }

  if (!paginas.size) {
    // Sem WAL útil: só garante o modo rollback no cabeçalho.
    const copia = db.slice();
    if (copia.byteLength > 19) copia[18] = copia[19] = 1;
    return copia;
  }

  const tamanho = Math.max(tamanhoPaginas * pageSize, 0) || db.byteLength;
  const out = new Uint8Array(tamanho);
  out.set(db.subarray(0, Math.min(db.byteLength, tamanho)));
  for (const [n, p] of paginas) {
    const o = (n - 1) * pageSize;
    if (o + pageSize <= tamanho) out.set(p, o);
  }
  // Bytes 18/19 = versão de escrita/leitura: 2 (WAL) → 1 (rollback).
  out[18] = out[19] = 1;
  return out;
}

// ------------------------------------------------------------- leitura

let sqlPromise: Promise<SqlJsStatic> | null = null;
async function sqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= (async () => {
    const [{ default: init }, { default: wasmUrl }] = await Promise.all([
      import("sql.js"),
      import("sql.js/dist/sql-wasm.wasm?url"),
    ]);
    return init({ locateFile: () => wasmUrl });
  })();
  return sqlPromise;
}

/** Ticks .NET (100 ns desde 01/01/0001) → ISO. */
function ticksParaIso(t: string | null | undefined): string | null {
  if (!t || !/^\d+$/.test(t) || t === "0") return null;
  try {
    const ms = Number((BigInt(t) - 621355968000000000n) / 10000n);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d.toISOString();
  } catch {
    return null;
  }
}

const COR: Record<string, string> = {
  Yellow: "Amarela",
  Green: "Verde",
  Pink: "Rosa",
  Purple: "Roxa",
  Blue: "Azul",
  Gray: "Cinza",
  Charcoal: "Grafite",
};
export const COR_HEX: Record<string, string> = {
  Amarela: "#fde68a",
  Verde: "#bbf7d0",
  Rosa: "#fbcfe8",
  Roxa: "#ddd6fe",
  Azul: "#bfdbfe",
  Cinza: "#e5e7eb",
  Grafite: "#4b5563",
};

/**
 * Lê as notas a partir dos arquivos escolhidos (`plum.sqlite` e, se vier,
 * `plum.sqlite-wal`). Notas apagadas ou vazias ficam de fora.
 */
export async function lerNotasAutoadesivas(arquivos: File[]): Promise<NotaAutoadesiva[]> {
  const principal = arquivos.find((f) => /\.sqlite$/i.test(f.name));
  if (!principal) throw new Error("Selecione o arquivo plum.sqlite.");
  const walFile = arquivos.find((f) => /\.sqlite-wal$/i.test(f.name));
  const db = new Uint8Array(await principal.arrayBuffer());
  if (new TextDecoder().decode(db.subarray(0, 15)) !== "SQLite format 3") {
    throw new Error("Este arquivo não é um banco SQLite.");
  }
  const wal = walFile ? new Uint8Array(await walFile.arrayBuffer()) : null;

  const SQL = await sqlJs();
  const banco = new SQL.Database(aplicarWal(db, wal));
  try {
    const tem = banco.exec("select 1 from sqlite_master where type='table' and name='Note'");
    if (!tem.length) throw new Error("Este banco não é o das Notas Autoadesivas (falta a tabela Note).");
    const res = banco.exec(
      `select Id, Text, Theme,
              cast(CreatedAt as text), cast(UpdatedAt as text), cast(DeletedAt as text)
         from Note`,
    );
    const linhas = res[0]?.values ?? [];
    const notas: NotaAutoadesiva[] = [];
    for (const [id, text, theme, criado, atualizado, apagado] of linhas) {
      if (apagado && apagado !== "0") continue;
      const { markdown, texto } = textoParaMarkdown(String(text ?? ""));
      if (!texto.trim()) continue;
      const criadoEm = ticksParaIso(criado as string | null);
      notas.push({
        id: String(id),
        titulo: tituloDaNota(texto, criadoEm),
        markdown,
        texto,
        cor: COR[String(theme ?? "")] ?? "Amarela",
        criadoEm,
        atualizadoEm: ticksParaIso(atualizado as string | null) ?? criadoEm,
      });
    }
    // Mais recentes primeiro.
    return notas.sort((a, b) => (b.atualizadoEm ?? "").localeCompare(a.atualizadoEm ?? ""));
  } finally {
    banco.close();
  }
}

// -------------------------------------------------------- conversão

interface Trecho {
  texto: string;
  b: boolean;
  i: boolean;
  s: boolean;
}

/** Uma linha com marcas (\b, \b0, \i, \strike…) → trechos com estilo. */
function trechosDaLinha(linha: string, estado: { b: boolean; i: boolean; s: boolean }): Trecho[] {
  const out: Trecho[] = [];
  let buf = "";
  const fechar = () => {
    if (buf) out.push({ texto: buf, ...estado });
    buf = "";
  };
  for (let k = 0; k < linha.length; k++) {
    const c = linha[k];
    if (c !== "\\") {
      buf += c;
      continue;
    }
    if (linha[k + 1] === "\\") {
      buf += "\\";
      k++;
      continue;
    }
    const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(linha.slice(k + 1));
    if (!m) {
      buf += c;
      continue;
    }
    fechar();
    const liga = m[2] === undefined || m[2] !== "0";
    if (m[1] === "b") estado.b = liga;
    else if (m[1] === "i") estado.i = liga;
    else if (m[1] === "strike") estado.s = liga;
    // \ul, \id e outras marcas: sem equivalente em Markdown — só somem.
    k += m[0].length;
  }
  fechar();
  return out;
}

function trechoParaMd(t: Trecho): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t.texto)!;
  const nucleo = m[2];
  if (!nucleo) return t.texto;
  let s = nucleo;
  if (t.s) s = `~~${s}~~`;
  if (t.i) s = `*${s}*`;
  if (t.b) s = `**${s}**`;
  return m[1] + s + m[3];
}

const ITEM_LISTA = /^\s*(?:[-*+•▪◦]|\d+[.)])\s/;

/** Texto bruto da nota → Markdown (e texto puro para título/prévia). */
export function textoParaMarkdown(bruto: string): { markdown: string; texto: string } {
  const estado = { b: false, i: false, s: false };
  const linhasMd: string[] = [];
  const linhasTxt: string[] = [];
  for (const original of bruto.split(/\r?\n/)) {
    const linha = original.replace(/^\\id=[0-9a-fA-F-]{36} ?/, "");
    const trechos = trechosDaLinha(linha, estado);
    linhasTxt.push(trechos.map((t) => t.texto).join(""));
    linhasMd.push(trechos.map(trechoParaMd).join("").replace(/^(\s*)[•▪◦]\s/, "$1- "));
  }
  // Uma quebra de linha da nota é uma quebra de linha no Markdown (dois
  // espaços no fim), exceto entre itens de lista e antes de linha vazia.
  const md = linhasMd
    .map((l, idx) => {
      const prox = linhasMd[idx + 1];
      if (!l.trim() || prox === undefined || !prox.trim()) return l.trimEnd();
      if (ITEM_LISTA.test(l) && ITEM_LISTA.test(prox)) return l.trimEnd();
      return `${l.trimEnd()}  `;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { markdown: md, texto: linhasTxt.join("\n").trim() };
}

function tituloDaNota(texto: string, criadoEm: string | null): string {
  const primeira = texto
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*+•▪◦]|\d+[.)]|#+)\s*/, "").replace(/\s+/g, " ").trim())
    .find((l) => l);
  if (primeira) return primeira.length > 80 ? `${primeira.slice(0, 77).trimEnd()}…` : primeira;
  const d = criadoEm ? new Date(criadoEm) : null;
  return d ? `Nota de ${d.toLocaleDateString("pt-BR")}` : "Nota autoadesiva";
}

/** Nota completa (.md) com frontmatter. */
export function notaParaMd(n: NotaAutoadesiva): string {
  const fm = [
    `título: ${n.titulo.replace(/\n/g, " ")}`,
    `tags: [notas-autoadesivas]`,
    `origem: notas-autoadesivas`,
    `cor: ${n.cor}`,
    n.criadoEm ? `criado: ${n.criadoEm}` : "",
    n.atualizadoEm ? `atualizado: ${n.atualizadoEm}` : "",
    `sticky-id: ${n.id}`,
    n.atualizadoEm ? `sticky-modificado: ${n.atualizadoEm}` : "",
    `importado-em: ${new Date().toISOString()}`,
  ].filter(Boolean);
  const data = n.atualizadoEm
    ? new Date(n.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const cabecalho = ["Origem: Notas Autoadesivas do Windows", data ? `Data: ${data}` : ""]
    .filter(Boolean)
    .join("\n");
  return `---\n${fm.join("\n")}\n---\n\n${cabecalho}\n\n${n.markdown}\n`;
}
