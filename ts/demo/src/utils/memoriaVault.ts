// Gravação de notas na "Pasta do Repositório" (File System Access API).
//
// A telo Repositório (grafo) monta os nós a partir dos arquivos .md de uma pasta
// local que o usuário seleciona; o handle dessa pasta é persistido no IndexedDB
// (ceo-memoria/kv/dir-handle:<conta>) — o MESMO banco/chave usado por MemoriaGrafo e
// Configuracoes. Este utilitário reaproveita esse handle para ESCREVER novas
// notas na pasta, de modo que — por exemplo — uma ata gerada a partir de uma
// transcrição vire um .md e apareça imediatamente no grafo (subpasta Reuniões).

import {
  lerNotaDaCopia,
  pastaContextoSalva,
  pastaEhCopia,
} from "@/app/pages/ceo/memoria-inventario";

// Tipos mínimos da File System Access API (não estão no lib.dom padrão do TS).
interface FSWritable {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FSFileHandle {
  createWritable(): Promise<FSWritable>;
  getFile(): Promise<File>;
}
interface FSDirHandle {
  name: string;
  kind?: "file" | "directory";
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FSDirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FSFileHandle>;
  entries?: () => AsyncIterableIterator<[string, { kind?: "file" | "directory" }]>;
  queryPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
}

export function memoriaVaultSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function"
  );
}

// Base de nome de arquivo segura (mesma limpeza usada no download .md dos modais).
// Exportada porque quem monta caminhos (ex.: a pasta de um grupo) precisa da
// MESMA limpeza para chegar sempre na mesma pasta/arquivo.
export function nomeSeguroMemoria(titulo: string): string {
  return titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().slice(0, 60) || "nota";
}

function nomeBase(titulo: string): string {
  return nomeSeguroMemoria(titulo);
}

// Nome de anexo seguro — preserva a extensão (imagem.png, corte.mp4, painel.html).
function nomeAnexo(nome: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(nome);
  const ext = m ? m[1].toLowerCase() : "bin";
  const base = nomeBase(nome.slice(0, m ? nome.length - m[0].length : undefined));
  return `${base}.${ext}`;
}

// Arquivo binário/HTML que acompanha a nota (imagem gerada, MP4 do corte,
// dashboard .html…). Fica na mesma subpasta e é embutido na nota via ![[…]].
export interface AnexoMemoria {
  nome: string;
  dados: Blob;
}

export type VaultFalha = "no-folder" | "denied" | "unsupported" | "not-found" | "error";

// A pasta viva em disco, não a cópia somente leitura que navegadores sem File
// System Access API produzem (Brave com a flag desligada, Firefox, Safari):
// nela não há o que gravar nem o que listar, então vale como "sem suporte".
async function pastaViva(): Promise<
  { ok: true; dir: FSDirHandle } | { ok: false; reason: "no-folder" | "unsupported" }
> {
  if (!memoriaVaultSupported()) return { ok: false, reason: "unsupported" };
  const handle = await pastaContextoSalva();
  if (!handle) return { ok: false, reason: "no-folder" };
  if (pastaEhCopia(handle)) return { ok: false, reason: "unsupported" };
  return { ok: true, dir: handle as unknown as FSDirHandle };
}

// Pega o handle da Pasta do Repositório já com a permissão pedida. `requestPermission`
// só funciona a partir de um gesto do usuário — daí as chamadas partirem sempre
// de um clique (salvar/abrir nó do grafo).
async function pastaComPermissao(
  mode: "read" | "readwrite",
): Promise<{ ok: true; dir: FSDirHandle } | { ok: false; reason: VaultFalha }> {
  const pasta = await pastaViva();
  if (!pasta.ok) return pasta;
  const handle = pasta.dir;
  try {
    const query = handle.queryPermission ? await handle.queryPermission({ mode }) : "prompt";
    if (query !== "granted") {
      const req = handle.requestPermission ? await handle.requestPermission({ mode }) : "denied";
      if (req !== "granted") return { ok: false, reason: "denied" };
    }
  } catch {
    return { ok: false, reason: "denied" };
  }
  return { ok: true, dir: handle };
}

// Caminho de pasta relativo ("Plano LATAM/Conversas") → handle do diretório.
// Aceita caminhos aninhados: a File System Access API só resolve um nível por
// chamada, então caminhamos segmento a segmento.
async function pastaDoCaminho(
  dir: FSDirHandle,
  path: string,
  create = false,
): Promise<FSDirHandle> {
  let atual = dir;
  for (const seg of path.split("/").map((s) => s.trim()).filter(Boolean)) {
    atual = await atual.getDirectoryHandle(seg, { create });
  }
  return atual;
}

/**
 * Pastas de primeiro nível da Pasta do Repositório — é ESTA a lista de "temas"
 * oferecida em toda opção de gravar no Repositório (Regras, Notas, conectores,
 * IA Studio). Primeiro nível porque é o que o grafo trata como "pasta" de um nó
 * (usa o primeiro segmento do caminho), então cada pasta daqui é um hub de cor
 * própria; subpastas de grupo ("Plano LATAM/Conversas") são gravadas pelos
 * helpers de memoria-grupos.ts, não escolhidas à mão.
 *
 * Só CONSULTA a permissão: `requestPermission` exige um gesto do usuário e esta
 * leitura acontece ao abrir a tela/modal. Sem permissão (ou sem pasta definida)
 * devolve a falha e quem chama usa a lista padrão — ver usePastasMemoria.
 */
export async function listarPastasMemoria(): Promise<
  { ok: true; pastas: string[] } | { ok: false; reason: VaultFalha }
> {
  const pasta = await pastaViva();
  if (!pasta.ok) return pasta;
  const handle = pasta.dir;
  try {
    const estado = handle.queryPermission
      ? await handle.queryPermission({ mode: "read" })
      : "granted";
    if (estado !== "granted") return { ok: false, reason: "denied" };
    if (!handle.entries) return { ok: false, reason: "error" };

    const pastas: string[] = [];
    for await (const [nome, filho] of handle.entries()) {
      // Ignora arquivos e pastas de sistema do vault (.obsidian, .trash…).
      if (filho.kind !== "directory" || nome.startsWith(".")) continue;
      pastas.push(nome);
    }
    pastas.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { ok: true, pastas };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Cria (quando ainda não existe) uma subpasta do Repositório, inclusive aninhada
 * ("Plano LATAM/Conversas"). Usado ao criar um grupo, para a pasta do grupo
 * existir no vault antes mesmo da primeira conversa.
 */
export async function criarPastaMemoria(
  subpasta: string,
): Promise<{ ok: true; pasta: string } | { ok: false; reason: VaultFalha }> {
  const pasta = await pastaComPermissao("readwrite");
  if (!pasta.ok) return pasta;
  try {
    await pastaDoCaminho(pasta.dir, subpasta, true);
    return { ok: true, pasta: subpasta };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// Caminho relativo ("Reuniões/ata.md") → handle do arquivo. É o mesmo id que o
// grafo usa nos nós, então dá para ir do nó clicado direto ao arquivo.
async function arquivoDoCaminho(
  dir: FSDirHandle,
  path: string,
  create = false,
): Promise<FSFileHandle | null> {
  const seg = path.split("/").filter(Boolean);
  const nome = seg.pop();
  if (!nome) return null;
  const atual = await pastaDoCaminho(dir, seg.join("/"), create);
  return atual.getFileHandle(nome, { create });
}

/** Lê o .md de um nó do grafo (caminho relativo à Pasta do Repositório). */
export async function lerNotaMemoria(
  path: string,
): Promise<{ ok: true; conteudo: string } | { ok: false; reason: VaultFalha }> {
  // Sem acesso à pasta viva a nota ainda pode ser lida da cópia feita na
  // seleção — é o que mantém os nós do grafo abríveis nesses navegadores.
  const daCopia = await lerNotaDaCopia(path);
  if (daCopia !== undefined) return { ok: true, conteudo: daCopia };

  const pasta = await pastaComPermissao("read");
  if (!pasta.ok) return pasta;
  try {
    const fh = await arquivoDoCaminho(pasta.dir, path);
    if (!fh) return { ok: false, reason: "not-found" };
    const file = await fh.getFile();
    return { ok: true, conteudo: await file.text() };
  } catch {
    return { ok: false, reason: "not-found" };
  }
}

/** Regrava o .md de um nó do grafo com o conteúdo editado. */
export async function salvarNotaMemoria(
  path: string,
  conteudo: string,
): Promise<{ ok: true } | { ok: false; reason: VaultFalha }> {
  const pasta = await pastaComPermissao("readwrite");
  if (!pasta.ok) return pasta;
  try {
    const fh = await arquivoDoCaminho(pasta.dir, path);
    if (!fh) return { ok: false, reason: "not-found" };
    const w = await fh.createWritable();
    await w.write(conteudo);
    await w.close();
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// ----------------------------------------------------------------------
// Notas de PESSOAS criadas automaticamente.
//
// Uma ata cita participantes como [[Fulano]]. No grafo, um [[wikilink]] só vira
// conexão quando existe uma nota com aquele título/nome — senão o link some (não
// queremos nós "fantasma" soltos, que sujam o grafo). Então, ao salvar uma ata,
// garantimos uma nota .md real para cada pessoa citada que ainda não tem uma:
// ela nasce na pasta "Pessoas" (cor própria no grafo) e as reuniões que a citam
// passam a conectar-se a ela.
// ----------------------------------------------------------------------

/** Nomes dos `participantes:` do frontmatter de uma ata (inline, bloco ou CSV). */
export function nomesDeParticipantes(markdown: string): string[] {
  const fm = (markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const yaml = fm[1];
  const limpar = (s: string) =>
    s
      .trim()
      .replace(/^["']|["']$/g, "")
      // tira papel/observação após "(", "—" ou " - " ("Ana Souza (CEO)" → "Ana Souza").
      .replace(/\s*[(—].*$/, "")
      .replace(/\s+-\s+.*$/, "")
      .trim();

  let nomes: string[] = [];
  const inline = yaml.match(/^\s*participantes\s*:\s*\[(.*)\]\s*$/im);
  if (inline) {
    nomes = inline[1].split(",").map(limpar);
  } else {
    const bloco = yaml.match(/^\s*participantes\s*:\s*\r?\n((?:\s*-\s*.+\r?\n?)+)/im);
    if (bloco) {
      nomes = bloco[1].split(/\r?\n/).map((l) => limpar(l.replace(/^\s*-\s*/, "")));
    } else {
      const csv = yaml.match(/^\s*participantes\s*:\s*(.+)$/im);
      if (csv && !csv[1].includes("[")) nomes = csv[1].split(",").map(limpar);
    }
  }
  // Descarta vazios, "N/A" e frases longas (não são nomes).
  return [
    ...new Map(
      nomes
        .filter((n) => n && n.length <= 60 && !/^n\/?a$/i.test(n))
        .map((n) => [n.toLowerCase(), n]),
    ).values(),
  ];
}

/** Índice (minúsculo) de todas as notas do vault: nome-base do arquivo + título do frontmatter. */
async function indiceNotasExistentes(dir: FSDirHandle): Promise<Set<string>> {
  const idx = new Set<string>();
  const walk = async (d: FSDirHandle) => {
    if (!d.entries) return;
    for await (const [nome, filho] of d.entries()) {
      if (nome.startsWith(".")) continue;
      if (filho.kind === "directory") {
        await walk(filho as unknown as FSDirHandle);
      } else if (nome.toLowerCase().endsWith(".md")) {
        idx.add(nome.replace(/\.md$/i, "").toLowerCase());
        try {
          const file = await (filho as unknown as FSFileHandle).getFile();
          const txt = await file.text();
          const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          const tm = fm && (fm[1].match(/^\s*t[íi]tulo\s*:\s*(.+)$/im) || fm[1].match(/^\s*title\s*:\s*(.+)$/im));
          if (tm) idx.add(tm[1].trim().replace(/^["']|["']$/g, "").toLowerCase());
        } catch {
          /* arquivo ilegível — ignora */
        }
      }
    }
  };
  await walk(dir);
  return idx;
}

/** Nota-stub de uma pessoa recém-criada — devolvida para indexar na IA. */
export interface NotaPessoaCriada {
  path: string;
  titulo: string;
  texto: string;
}

/**
 * Garante uma nota .md para cada nome que ainda não tem nota no vault, na pasta
 * `subpasta` ("Pessoas" por padrão). Não sobrescreve nada: pula quem já tem nota
 * (por nome de arquivo ou título). Devolve só as que foram criadas.
 */
export async function garantirNotasDePessoas(
  nomes: string[],
  subpasta = "Pessoas",
): Promise<{ ok: true; criadas: NotaPessoaCriada[] } | { ok: false; reason: VaultFalha }> {
  const limpos = [
    ...new Map(nomes.map((n) => [n.trim().toLowerCase(), n.trim()])).values(),
  ].filter(Boolean);
  if (!limpos.length) return { ok: true, criadas: [] };

  const pasta = await pastaComPermissao("readwrite");
  if (!pasta.ok) return pasta;

  try {
    const existentes = await indiceNotasExistentes(pasta.dir);
    const criadas: NotaPessoaCriada[] = [];
    // A pasta "Pessoas" só é criada quando há de fato alguém a criar.
    let dir: FSDirHandle | null = null;
    for (const nome of limpos) {
      const base = nomeSeguroMemoria(nome);
      if (existentes.has(nome.toLowerCase()) || existentes.has(base.toLowerCase())) continue;

      if (!dir) dir = await pastaDoCaminho(pasta.dir, subpasta, true);
      const arquivo = `${base}.md`;
      const fh = await dir.getFileHandle(arquivo, { create: true });
      const texto =
        `---\ntítulo: ${nome}\ntipo: pessoa\ntags: [pessoa]\n---\n\n` +
        `# ${nome}\n\n` +
        `> Nota criada automaticamente para reunir as reuniões, sistemas e notas que citam **${nome}**. ` +
        `Complete com papel, contato e histórico.\n`;
      const w = await fh.createWritable();
      await w.write(texto);
      await w.close();

      existentes.add(nome.toLowerCase());
      existentes.add(base.toLowerCase());
      criadas.push({ path: `${subpasta}/${arquivo}`, titulo: nome, texto });
    }
    return { ok: true, criadas };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export type WriteResult =
  // `texto` é o arquivo como ficou no disco (frontmatter + corpo) — quem grava
  // pode mandá-lo direto ao índice da IA sem reler a pasta.
  | { ok: true; pasta: string; arquivo: string; texto: string }
  | { ok: false; reason: "no-folder" | "denied" | "unsupported" | "error" };

/**
 * Grava uma nota .md na Pasta do Repositório, dentro da subpasta indicada (ex.:
 * "Reuniões" ou, para grupos, "Plano LATAM/Conversas"). A subpasta é criada
 * quando ainda não existe — inclusive aninhada. Escreve um
 * frontmatter mínimo (título + tags) para o grafo resolver o título do nó e as
 * tags; os [[wikilinks]] no corpo já são lidos como conexões.
 *
 * Quando a ação produz um arquivo (imagem, MP4, dashboard .html), passe-o em
 * `anexos`: ele é gravado na mesma subpasta e embutido na nota como ![[…]] —
 * assim o grafo (que só lê .md) continua mostrando um nó para o conteúdo.
 *
 * Devolve o resultado sem lançar — o chamador decide o feedback.
 */
export async function escreverNotaMemoria(opts: {
  subpasta: string;
  titulo: string;
  conteudo: string;
  tags?: string[];
  anexos?: AnexoMemoria[];
}): Promise<WriteResult> {
  const pasta = await pastaViva();
  if (!pasta.ok) return pasta;
  const handle = pasta.dir;

  // Precisa de permissão de escrita — o handle da telo Repositório é só de leitura.
  try {
    const query = handle.queryPermission
      ? await handle.queryPermission({ mode: "readwrite" })
      : "prompt";
    if (query !== "granted") {
      const req = handle.requestPermission
        ? await handle.requestPermission({ mode: "readwrite" })
        : "denied";
      if (req !== "granted") return { ok: false, reason: "denied" };
    }
  } catch {
    return { ok: false, reason: "denied" };
  }

  try {
    const dir = await pastaDoCaminho(handle, opts.subpasta, true);
    const base = nomeBase(opts.titulo);
    const arquivo = `${base}.md`;

    // Anexos primeiro: prefixados com a base da nota para não colidirem entre
    // ações diferentes que gerem, por exemplo, "imagem-1.png".
    const embeds: string[] = [];
    for (const anexo of opts.anexos ?? []) {
      const nome = nomeAnexo(`${base}-${anexo.nome}`);
      const fh = await dir.getFileHandle(nome, { create: true });
      const w = await fh.createWritable();
      await w.write(anexo.dados);
      await w.close();
      // Mídia é embutida (![[…]]); os demais viram link para não poluir a nota.
      embeds.push(`${/\.(png|jpe?g|webp|gif|svg|mp4|webm|mp3|wav|m4a)$/i.test(nome) ? "!" : ""}[[${nome}]]`);
    }

    const file = await dir.getFileHandle(arquivo, { create: true });
    const writable = await file.createWritable();

    const tags = (opts.tags ?? []).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
    const frontmatter =
      `---\ntítulo: ${opts.titulo.replace(/\n/g, " ").trim()}\n` +
      (tags.length ? `tags: [${tags.join(", ")}]\n` : "") +
      `---\n\n`;
    const corpo = [opts.conteudo.trim(), embeds.join("\n")].filter(Boolean).join("\n\n");

    const texto = frontmatter + corpo + "\n";
    await writable.write(texto);
    await writable.close();
    return { ok: true, pasta: opts.subpasta, arquivo, texto };
  } catch {
    return { ok: false, reason: "error" };
  }
}
