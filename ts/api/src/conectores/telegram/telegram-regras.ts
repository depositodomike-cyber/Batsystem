// Regras puras do bot do Telegram: textos de resposta, limites de áudio e
// leitura do código de vínculo. Sem I/O — testável isoladamente.
import type { TgArquivo, TgMessage } from './telegram-api.service';

/** Respostas curtas enviadas ao usuário no Telegram. */
export const MSG = {
  vinculado: '✅ Conta conectada ao Oracle. Envie um texto ou áudio para criar uma nota.',
  jaVinculado: '✅ Esta conta já está conectada ao Oracle. Envie um texto ou áudio para criar uma nota.',
  codigoInvalido: '❌ Código inválido ou expirado. Gere outro em Configurações → Conectores → Telegram.',
  contaOcupada: '❌ Esta conta do Telegram já está conectada a outro usuário do Oracle.',
  privado: '🔒 Este bot é privado. Para usar, conecte sua conta em Configurações → Conectores → Telegram.',
  textoRecebido: '📝 Nota recebida.',
  audioRecebido: '🎙️ Áudio recebido, transcrevendo…',
  transcrito: '✅ Transcrição salva como nota.',
  semFala: '✅ Áudio salvo como nota (não reconheci fala para transcrever).',
  falhaTranscricao: '⚠️ Não consegui transcrever agora. O áudio ficou guardado e vou tentar de novo.',
  naoSuportado: '⚠️ Formato não suportado. Envie texto, mensagem de voz ou arquivo de áudio (até 20 MB).',
  grandeDemais: '⚠️ Áudio grande demais (máx. 20 MB e 60 min).',
  ajuda: 'Envie um texto, uma mensagem de voz ou um arquivo de áudio (com legenda, se quiser) e ele vira uma nota no Oracle.',
} as const;

/** getFile da Bot API só baixa até 20 MB; o Whisper aceita 25 MB. */
export const LIMITE_AUDIO_BYTES = 20 * 1024 * 1024;
export const LIMITE_AUDIO_SEGUNDOS = 60 * 60;

/** MIME aceitos → extensão que o Whisper reconhece. */
export const MIME_AUDIO: Readonly<Record<string, string>> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

export const VALIDADE_CODIGO_MS = 10 * 60_000;
export const MAX_TENTATIVAS_CODIGO = 5;
/** 32 símbolos sem ambíguos (0/O, 1/I): 8 símbolos = 40 bits. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Lê um código de vínculo de "/start ABCD1234", "ABCD-1234" ou "abcd 1234".
 * Null quando o texto não é um código (8 símbolos do alfabeto).
 */
export function extrairCodigo(texto: string): string | null {
  const semStart = texto.trim().replace(/^\/start(@\w+)?\s*/i, '');
  const limpo = semStart.toUpperCase().replace(/[\s-]/g, '');
  if (limpo.length !== 8) return null;
  for (const c of limpo) if (!ALFABETO_CODIGO.includes(c)) return null;
  return limpo;
}

export type Classificacao =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'voz' | 'audio'; arquivo: TgArquivo; mime: string; legenda: string | null }
  | { tipo: 'rejeitado'; motivo: 'formato' | 'tamanho'; legenda: string | null; arquivo?: TgArquivo }
  | { tipo: 'comando'; texto: string }
  | { tipo: 'ignorado' };

/** Como tratar uma mensagem de quem já está vinculado. */
export function classificar(m: TgMessage): Classificacao {
  if (typeof m.text === 'string') {
    if (m.text.trim().startsWith('/')) return { tipo: 'comando', texto: m.text.trim() };
    if (!m.text.trim()) return { tipo: 'ignorado' };
    return { tipo: 'texto', texto: m.text };
  }
  const legenda = m.caption ?? null;
  const voz = m.voice;
  const audio = m.audio ?? (m.document?.mime_type?.startsWith('audio/') ? m.document : undefined);
  const arquivo = voz ?? audio;
  if (!arquivo) {
    // Foto, vídeo, figurinha, documento não-áudio…
    return { tipo: 'rejeitado', motivo: 'formato', legenda };
  }
  const mime = (arquivo.mime_type ?? (voz ? 'audio/ogg' : '')).toLowerCase().split(';')[0].trim();
  if (!MIME_AUDIO[mime]) return { tipo: 'rejeitado', motivo: 'formato', legenda, arquivo };
  if ((arquivo.file_size ?? 0) > LIMITE_AUDIO_BYTES || (arquivo.duration ?? 0) > LIMITE_AUDIO_SEGUNDOS) {
    return { tipo: 'rejeitado', motivo: 'tamanho', legenda, arquivo };
  }
  return { tipo: voz ? 'voz' : 'audio', arquivo, mime, legenda };
}

/** Nome de arquivo para o Whisper (ele decide o formato pela extensão). */
export function nomeParaTranscricao(tipo: string, mime: string | null, nome: string | null): string {
  const ext = (mime && MIME_AUDIO[mime]) || 'ogg';
  if (tipo === 'voz') return `voz.${ext}`;
  const base = (nome ?? 'audio').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'audio';
  return `${base}.${ext}`;
}

/** Backoff das retentativas de transcrição; depois disso fica em `falha` (áudio guardado). */
export const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export function proximaTentativa(tentativas: number, agora = Date.now()): Date | null {
  const atraso = BACKOFF_MS[tentativas - 1];
  return atraso === undefined ? null : new Date(agora + atraso);
}
