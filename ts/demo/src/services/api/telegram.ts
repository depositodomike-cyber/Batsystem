import axios from "@/utils/axios";

/**
 * Cliente do conector Telegram (ts/api → /conectores/telegram/*).
 * Conectar = gerar o código e enviá-lo ao bot; desconectar continua sendo
 * DELETE /conectores/telegram (disconnectConectorApi).
 */

export interface StatusTelegram {
  configurado: boolean;
  bot: string | null;
  conectado: boolean;
  conta: string | null;
  telegramUserId: string | null;
  desde: string | null;
  ultimaComunicacaoEm: string | null;
  codigoPendenteAte: string | null;
  fila: {
    processando: number;
    prontas: number;
    aguardandoRepositorio: number;
    falhas: number;
    noRepositorio: number;
  };
  falhas: Array<{
    id: string;
    tipo: string;
    legenda: string | null;
    erro: string | null;
    tentativas: number;
    recebidaEm: string;
    proximaTentativaEm: string | null;
  }>;
}

export interface CodigoTelegram {
  codigo: string;
  expiraEm: string;
  bot: string | null;
  link: string | null;
}

export interface MensagemTelegram {
  id: string;
  chatId: string;
  messageId: number;
  tipo: "texto" | "voz" | "audio";
  texto: string | null;
  legenda: string | null;
  transcricao: string | null;
  audioMime: string | null;
  audioNome: string | null;
  audioTamanho: number | null;
  audioDuracao: number | null;
  status: "pronta" | "nas_notas";
  recebidaEm: string;
  processadaEm: string | null;
  entregueEm: string | null;
  repositorioPath: string | null;
  temAudio: boolean;
}

export interface PendentesTelegram {
  /** Repositório pessoal escolhido ao conectar (null = o ativo). */
  repositorioId: string | null;
  mensagens: MensagemTelegram[];
}

export async function statusTelegramApi(): Promise<StatusTelegram> {
  const { data } = await axios.get<StatusTelegram>("/conectores/telegram/status");
  return data;
}

export async function gerarCodigoTelegramApi(): Promise<CodigoTelegram> {
  const { data } = await axios.post<CodigoTelegram>("/conectores/telegram/codigo");
  return data;
}

export async function cancelarCodigoTelegramApi(): Promise<void> {
  await axios.delete("/conectores/telegram/codigo");
}

export async function pendentesTelegramApi(): Promise<PendentesTelegram> {
  const { data } = await axios.get<PendentesTelegram>("/conectores/telegram/pendentes");
  return data;
}

export async function audioTelegramApi(id: string): Promise<Blob> {
  const { data } = await axios.get<Blob>(
    `/conectores/telegram/mensagens/${encodeURIComponent(id)}/audio`,
    { responseType: "blob" },
  );
  return data;
}

export async function confirmarTelegramApi(
  id: string,
  destino: "notas" | "repositorio",
  path?: string,
): Promise<void> {
  await axios.post(`/conectores/telegram/mensagens/${encodeURIComponent(id)}/confirmar`, {
    destino,
    ...(path ? { path } : {}),
  });
}

export async function tentarNovamenteTelegramApi(id: string): Promise<boolean> {
  const { data } = await axios.post<{ ok: boolean }>(
    `/conectores/telegram/mensagens/${encodeURIComponent(id)}/tentar-novamente`,
  );
  return data.ok;
}
