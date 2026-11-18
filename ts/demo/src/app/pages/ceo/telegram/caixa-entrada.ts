// ----------------------------------------------------------------------
// Caixa de entrada do Telegram → Notas → Repositório.
//
// O bot (ts/api) só recebe e transcreve. As Notas e o Repositório pessoal
// vivem neste navegador, então é aqui que a mensagem vira nota, pelo MESMO
// caminho das outras importações (notas-autoadesivas/importacao.ts):
//
//   1. entra na lista de Notas (assunto "Telegram")       → confirma "notas"
//   2. vira Telegram/<título>.md (+ áudio original) na pasta do Repositório,
//      indexado com syncVaultBatch                         → confirma "repositorio"
//
// Duplicados: o id da nota é `tg-<id da mensagem>` e o .md guarda
// `telegram-id: <chat>:<mensagem>` no frontmatter. Gravar na pasta exige
// permissão de escrita; sem ela (precisa de um clique) a nota fica nas Notas
// e o servidor guarda tudo até o "Gravar agora".
// ----------------------------------------------------------------------

import {
  audioTelegramApi,
  confirmarTelegramApi,
  pendentesTelegramApi,
  type MensagemTelegram,
} from "@/services/api/telegram";
import { syncVaultBatch, VAULT_BATCH_SIZE, type VaultNotaInput } from "@/services/api/vault";
import { gravarArquivoMemoria, nomeSeguroMemoria } from "@/utils/memoriaVault";
import { invalidarNotasMemoria } from "@/components/shared/MemoriaMentions/alvos";
import { chaveConta } from "@/utils/escopoConta";
import {
  lerArquivosMd,
  pastaContextoSalva,
  repositorioPastaAtivo,
} from "../memoria-inventario";
import { EVENTO_REPOSITORIO_ATUALIZADO } from "../drive/importacao";
import { adicionarNotas, atualizarNota, lerNotas, tituloAuto, type Nota } from "../notas-armazenamento";

export const PASTA_TELEGRAM = "Telegram";
export const ASSUNTO_TELEGRAM = "Telegram";

export interface ResultadoCaixa {
  /** Notas criadas agora na lista de Notas. */
  novas: number;
  /** Mensagens gravadas no Repositório agora. */
  noRepositorio: number;
  /** Há mensagens esperando permissão de escrita na pasta. */
  semPermissao: boolean;
  erro?: string;
}

const VAZIO: ResultadoCaixa = { novas: 0, noRepositorio: 0, semPermissao: false };

const EXT_AUDIO: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

// Ids já trazidos para as Notas: se o usuário apagar a nota antes de ela ir ao
// Repositório, ela não reaparece no próximo ciclo.
const IMPORTADAS_BASE = "ceo-telegram-importadas";

function lerImportadas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveConta(IMPORTADAS_BASE)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function marcarImportadas(ids: string[]) {
  if (!ids.length) return;
  const s = lerImportadas();
  ids.forEach((id) => s.add(id));
  try {
    // Mantém só os mais recentes (a fila do servidor é pequena).
    localStorage.setItem(chaveConta(IMPORTADAS_BASE), JSON.stringify([...s].slice(-500)));
  } catch {
    /* cota */
  }
}

export function idNota(m: Pick<MensagemTelegram, "id">): string {
  return `tg-${m.id}`;
}

function dataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Corpo da nota: o texto original intacto, ou a transcrição do áudio. */
export function corpoDaMensagem(m: MensagemTelegram): string {
  if (m.tipo === "texto") return m.texto ?? "";
  return m.transcricao?.trim() ? m.transcricao : "(Áudio sem fala reconhecível.)";
}

export function tituloDaMensagem(m: MensagemTelegram): string {
  if (m.tipo === "texto") return tituloAuto(m.texto ?? "");
  if (m.legenda?.trim()) return tituloAuto(m.legenda);
  const rotulo = m.tipo === "voz" ? "Mensagem de voz" : "Áudio";
  return `${rotulo} do Telegram — ${dataHora(m.recebidaEm)}`;
}

export function notaDaMensagem(m: MensagemTelegram): Nota {
  const criada = Date.parse(m.recebidaEm) || Date.now();
  return {
    id: idNota(m),
    assunto: ASSUNTO_TELEGRAM,
    titulo: tituloDaMensagem(m),
    corpo: corpoDaMensagem(m),
    criadaEm: criada,
    atualizadaEm: criada,
    origem: "telegram",
    telegram: {
      mensagemId: m.id,
      chatId: m.chatId,
      messageId: m.messageId,
      tipo: m.tipo,
      legenda: m.legenda,
      recebidaEm: m.recebidaEm,
      processadaEm: m.processadaEm,
      status: "nas_notas",
      repositorioPath: null,
    },
  };
}

/** .md da nota no Repositório (frontmatter + cabeçalho "Origem:" + corpo). */
export function mdDaMensagem(m: MensagemTelegram, titulo: string, anexo: string | null): string {
  const fm = [
    `título: ${titulo.replace(/\n/g, " ")}`,
    `tags: [nota, telegram]`,
    `origem: telegram`,
    `telegram-id: ${m.chatId}:${m.messageId}`,
    `telegram-tipo: ${m.tipo}`,
    `recebida: ${m.recebidaEm}`,
    m.processadaEm ? `processada: ${m.processadaEm}` : "",
    anexo ? `arquivo-original: ${anexo}` : "",
  ].filter(Boolean);
  const data = new Date(m.recebidaEm).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const cabecalho = [
    `Origem: Telegram${m.tipo === "texto" ? "" : m.tipo === "voz" ? " (mensagem de voz)" : " (arquivo de áudio)"}`,
    `Data: ${data}`,
    m.legenda?.trim() ? `Legenda: ${m.legenda.replace(/\s*\n\s*/g, " ").trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const partes = [cabecalho, corpoDaMensagem(m), anexo ? `![[${anexo}]]` : ""].filter(Boolean);
  return `---\n${fm.join("\n")}\n---\n\n${partes.join("\n\n")}\n`;
}

/** telegram-id → caminho do .md já gravado. */
async function indiceTelegram(handle: Parameters<typeof lerArquivosMd>[0]): Promise<Map<string, string>> {
  const indice = new Map<string, string>();
  for (const a of await lerArquivosMd(handle)) {
    const fm = a.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    const id = fm.match(/^telegram-id:\s*(\S+)/m)?.[1];
    if (id && !indice.has(id)) indice.set(id, a.path);
  }
  return indice;
}

let emAndamento: Promise<ResultadoCaixa> | null = null;

/** Processa a caixa (uma execução por vez). */
export function sincronizarCaixaTelegram(): Promise<ResultadoCaixa> {
  if (!emAndamento) {
    emAndamento = executar().finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

/**
 * Para um clique ("Gravar agora"): pede a permissão de escrita da pasta
 * enquanto o gesto do usuário ainda vale e então processa a caixa.
 */
export async function gravarCaixaTelegramComPermissao(): Promise<ResultadoCaixa> {
  const handle = await pastaContextoSalva();
  if (!handle) return { ...VAZIO, semPermissao: true, erro: "Nenhuma pasta do Repositório conectada." };
  try {
    const estado = handle.requestPermission
      ? await handle.requestPermission({ mode: "readwrite" })
      : "granted";
    if (estado !== "granted") return { ...VAZIO, semPermissao: true };
  } catch {
    return { ...VAZIO, semPermissao: true };
  }
  return sincronizarCaixaTelegram();
}

async function executar(): Promise<ResultadoCaixa> {
  const { repositorioId, mensagens } = await pendentesTelegramApi();
  if (!mensagens.length) return VAZIO;

  // 1) Notas: cria as que ainda não entraram e confirma ao servidor.
  const importadas = lerImportadas();
  const existentes = new Set(lerNotas().map((n) => n.id));
  const paraNotas = mensagens.filter((m) => !importadas.has(idNota(m)) && !existentes.has(idNota(m)));
  const novas = adicionarNotas(paraNotas.map(notaDaMensagem), ASSUNTO_TELEGRAM);
  marcarImportadas(mensagens.map(idNota));
  for (const m of mensagens) {
    if (m.status === "pronta") await confirmarTelegramApi(m.id, "notas").catch(() => undefined);
  }

  // 2) Repositório: só no repositório escolhido ao conectar (ou no ativo).
  const ativo = repositorioPastaAtivo();
  if (!ativo || (repositorioId && repositorioId !== ativo)) {
    return { novas: novas.length, noRepositorio: 0, semPermissao: false };
  }
  const handle = await pastaContextoSalva();
  if (!handle) return { novas: novas.length, noRepositorio: 0, semPermissao: true };
  try {
    const estado = handle.queryPermission ? await handle.queryPermission({ mode: "readwrite" }) : "granted";
    if (estado !== "granted") return { novas: novas.length, noRepositorio: 0, semPermissao: true };
  } catch {
    return { novas: novas.length, noRepositorio: 0, semPermissao: true };
  }

  const indice = await indiceTelegram(handle);
  const usados = new Set([...indice.values()].map((p) => p.toLowerCase()));
  const gravadas: VaultNotaInput[] = [];
  let noRepositorio = 0;
  let semPermissao = false;
  let erro: string | undefined;

  for (const m of mensagens) {
    const chave = `${m.chatId}:${m.messageId}`;
    const titulo = tituloDaMensagem(m);
    let path = indice.get(chave);
    if (!path) {
      const nome = nomeSeguroMemoria(titulo);
      path = `${PASTA_TELEGRAM}/${nome}.md`;
      for (let i = 2; usados.has(path.toLowerCase()); i++) path = `${PASTA_TELEGRAM}/${nome} (${i}).md`;
      usados.add(path.toLowerCase());
      const base = path.slice(PASTA_TELEGRAM.length + 1, -3);

      let anexo: string | null = null;
      if (m.temAudio) {
        try {
          const blob = await audioTelegramApi(m.id);
          anexo = `${base}-audio.${EXT_AUDIO[m.audioMime ?? ""] ?? "ogg"}`;
          const g = await gravarArquivoMemoria(`${PASTA_TELEGRAM}/${anexo}`, blob);
          if (!g.ok) {
            if (g.reason === "denied" || g.reason === "no-folder") {
              semPermissao = true;
              break;
            }
            erro = "Falha ao gravar o áudio no Repositório.";
            continue;
          }
        } catch {
          erro = "Não consegui baixar o áudio do servidor.";
          continue;
        }
      }

      const conteudo = mdDaMensagem(m, titulo, anexo);
      const g = await gravarArquivoMemoria(path, conteudo);
      if (!g.ok) {
        if (g.reason === "denied" || g.reason === "no-folder") {
          semPermissao = true;
          break;
        }
        erro = "Falha ao gravar a nota no Repositório.";
        continue;
      }
      gravadas.push({ path, titulo, conteudo });
    }

    try {
      await confirmarTelegramApi(m.id, "repositorio", path);
    } catch {
      erro = "Nota gravada, mas não consegui avisar o servidor. Tento de novo em instantes.";
      continue;
    }
    const caminho = path;
    atualizarNota(idNota(m), (n) =>
      n.telegram
        ? { ...n, telegram: { ...n.telegram, status: "no_repositorio", repositorioPath: caminho } }
        : n,
    );
    noRepositorio++;
  }

  if (gravadas.length) {
    for (let i = 0; i < gravadas.length; i += VAULT_BATCH_SIZE) {
      await syncVaultBatch(gravadas.slice(i, i + VAULT_BATCH_SIZE)).catch(() => undefined);
    }
    invalidarNotasMemoria();
    window.dispatchEvent(new CustomEvent(EVENTO_REPOSITORIO_ATUALIZADO));
  }
  return { novas: novas.length, noRepositorio, semPermissao, erro };
}
