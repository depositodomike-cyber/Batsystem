// Integração com a API do HeyGen (avatar falante). Portado do beculture/Confi
// (lib/heygen.js). O vídeo é gerado na nuvem do HeyGen: script + avatar + voz →
// MP4 com lip-sync (assíncrono → polling). A chave fica server-side.

const BASE = 'https://api.heygen.com';

export const DIMS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 720, height: 720 },
  '4:5': { width: 864, height: 1080 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface Avatar {
  id: string;
  nome: string;
  genero: string;
  preview: string;
  previewVideo: string;
  premium: boolean | null;
  tipo: string;
}
export interface Voz {
  id: string;
  nome: string;
  idioma: string;
  genero: string;
}
export interface GerarSpec {
  script: string;
  avatarId: string;
  voiceId: string;
  formato?: string;
  speed?: number;
  fundo?: string;
  avatarStyle?: string;
  titulo?: string;
  teste?: boolean;
}
export interface VideoStatus {
  status: string;
  url: string;
  thumb: string;
  duracao: number;
  erro: string;
}

async function api(
  key: string,
  pathname: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<Record<string, unknown>> {
  if (!key) throw new Error('HeyGen não configurado (defina HEYGEN_API_KEY no servidor).');
  const { method = 'GET', body } = opts;
  let r: Response;
  try {
    r = await fetch(BASE + pathname, {
      method,
      headers: {
        'X-Api-Key': key,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Não consegui falar com o HeyGen (rede): ' + (e as Error).message);
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await r.json()) as Record<string, unknown>;
  } catch {
    /* corpo não-JSON */
  }
  const err = data && (data.error as { message?: string; detail?: string; code?: string } | null);
  if (!r.ok || err) {
    let msg: string =
      (err && (err.message || err.detail || err.code)) ||
      (data.message as string) ||
      `HTTP ${r.status}`;
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
    if (r.status === 401 || /unauthor|invalid.*key|api key/i.test(msg)) {
      msg = 'API key do HeyGen inválida ou sem acesso à API neste plano.';
    }
    throw new Error('HeyGen: ' + msg);
  }
  return data;
}

export async function avatares(key: string): Promise<Avatar[]> {
  const d = await api(key, '/v2/avatars');
  const dd = (d.data as Record<string, unknown>) || {};
  const arr = ((dd.avatars || dd.list) as Record<string, unknown>[]) || [];
  const prem = (a: Record<string, unknown>): boolean | null => {
    const v = a.premium != null ? a.premium : a.is_premium != null ? a.is_premium : a.is_paid;
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return null;
  };
  return arr
    .map((a) => ({
      id: (a.avatar_id as string) || '',
      nome: (a.avatar_name as string) || (a.name as string) || (a.avatar_id as string) || '',
      genero: (a.gender as string) || '',
      preview: (a.preview_image_url as string) || (a.preview_image as string) || '',
      previewVideo: (a.preview_video_url as string) || '',
      premium: prem(a),
      tipo: (a.type as string) || (a.avatar_type as string) || (a.tier as string) || '',
    }))
    .filter((a) => a.id);
}

const rankIdioma = (l: string): number => {
  const s = String(l || '').toLowerCase();
  if (s.includes('portug') || s.startsWith('pt')) return 0;
  if (s.includes('span') || s.startsWith('es')) return 1;
  if (s.includes('engl') || s.startsWith('en')) return 2;
  return 3;
};

export async function vozes(key: string): Promise<Voz[]> {
  const d = await api(key, '/v2/voices');
  const dd = (d.data as Record<string, unknown>) || {};
  const arr = ((dd.voices || dd.list) as Record<string, unknown>[]) || [];
  const vs = arr
    .map((v) => ({
      id: (v.voice_id as string) || '',
      nome: (v.name as string) || (v.display_name as string) || (v.voice_id as string) || '',
      idioma: (v.language as string) || (v.locale as string) || '',
      genero: (v.gender as string) || '',
    }))
    .filter((v) => v.id);
  vs.sort(
    (a, b) => rankIdioma(a.idioma) - rankIdioma(b.idioma) || String(a.nome).localeCompare(String(b.nome)),
  );
  return vs;
}

export async function gerar(key: string, spec: GerarSpec): Promise<{ videoId: string; teste: boolean }> {
  const script = String(spec.script || '').trim();
  if (!script) throw new Error('Script vazio — escreva o texto que o avatar vai falar.');
  if (!spec.avatarId) throw new Error('Escolha um avatar.');
  if (!spec.voiceId) throw new Error('Escolha uma voz.');
  const dimension = DIMS[spec.formato || '16:9'] || DIMS['16:9'];

  const voice = {
    type: 'text',
    input_text: script.slice(0, 4900),
    voice_id: spec.voiceId,
    speed: clamp(Number(spec.speed) || 1, 0.5, 1.5),
  };
  const character: Record<string, unknown> = {
    type: 'avatar',
    avatar_id: spec.avatarId,
    avatar_style: spec.avatarStyle || 'normal',
  };
  const video_input: Record<string, unknown> = { character, voice };
  if (spec.fundo) video_input.background = { type: 'color', value: spec.fundo };

  const test = spec.teste !== false; // padrão TESTE (marca d'água, sem gastar créditos)
  const body = {
    title: (spec.titulo || 'beculture').slice(0, 120),
    test,
    dimension,
    video_inputs: [video_input],
  };

  const d = await api(key, '/v2/video/generate', { method: 'POST', body });
  const dd = (d.data as Record<string, unknown>) || {};
  const videoId = (dd.video_id || dd.videoId || dd.id) as string;
  if (!videoId) throw new Error('HeyGen não retornou um video_id.');
  return { videoId, teste: test };
}

export async function status(key: string, videoId: string): Promise<VideoStatus> {
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(String(videoId || ''))) throw new Error('video_id inválido.');
  const d = await api(key, '/v1/video_status.get?video_id=' + encodeURIComponent(videoId));
  const x = (d.data as Record<string, unknown>) || {};
  const erro = x.error as { message?: string; detail?: string } | undefined;
  return {
    status: (x.status as string) || 'unknown',
    url: (x.video_url as string) || (x.video_url_caption as string) || '',
    thumb: (x.thumbnail_url as string) || '',
    duracao: Number(x.duration) || 0,
    erro: erro ? erro.message || erro.detail || JSON.stringify(erro) : '',
  };
}
