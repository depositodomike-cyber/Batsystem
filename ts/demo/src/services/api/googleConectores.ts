import axios from "@/utils/axios";

// Leitura dos conectores Google (somente leitura) — Calendar e Drive.
// Os tokens ficam cifrados no servidor; o navegador só recebe os dados já
// normalizados.

export interface AgendaEvento {
  id: string;
  titulo: string;
  descricao?: string;
  local?: string;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  organizador?: string;
  participantes?: { email: string; nome?: string; confirmacao?: string }[];
  link?: string;
  reuniaoUrl?: string;
  cancelado?: boolean;
}

export async function listarEventosAgendaApi(
  limite = 100,
): Promise<{ conta: string | null; eventos: AgendaEvento[] }> {
  const { data } = await axios.get<{ conta: string | null; eventos: AgendaEvento[] }>(
    "/conectores/agenda/google-calendar/eventos",
    { params: { limite } },
  );
  return data;
}

export interface DriveArquivo {
  id: string;
  nome: string;
  tipo: string;
  tipoRotulo: string;
  modificadoEm: string | null;
  dono: string | null;
  link: string | null;
  tamanho: number | null;
  importavel: boolean;
  /** Pasta (navegável; importar = importar o conteúdo). */
  pasta: boolean;
  pais: string[];
}

export interface DriveArquivoNaArvore extends DriveArquivo {
  /** Subpastas entre a pasta importada e o arquivo ("" = direto nela). */
  caminho: string;
}

const DRIVE = "/conectores/drive/google-drive";

/**
 * Conteúdo de uma pasta (`pasta`: "root", "compartilhados" ou id) ou, com
 * `busca`, arquivos e pastas de todo o Drive.
 */
export async function listarArquivosDriveApi(opts: {
  pasta?: string;
  busca?: string;
  pagina?: string;
} = {}): Promise<{ arquivos: DriveArquivo[]; proximaPagina: string | null }> {
  const { data } = await axios.get<{ arquivos: DriveArquivo[]; proximaPagina: string | null }>(
    `${DRIVE}/arquivos`,
    {
      params: {
        ...(opts.pasta ? { pasta: opts.pasta } : {}),
        ...(opts.busca ? { q: opts.busca } : {}),
        ...(opts.pagina ? { pagina: opts.pagina } : {}),
      },
    },
  );
  return data;
}

/** Pasta e o caminho da raiz até ela (breadcrumb). */
export async function pastaDriveApi(
  id: string,
): Promise<{ id: string; nome: string; caminho: { id: string; nome: string }[] }> {
  const { data } = await axios.get(`${DRIVE}/pastas/${encodeURIComponent(id)}`);
  return data;
}

/** Todos os arquivos dentro da pasta, recursivamente, com caminho relativo. */
export async function arvoreDriveApi(id: string): Promise<{
  pasta: { id: string; nome: string };
  arquivos: DriveArquivoNaArvore[];
  truncado: boolean;
}> {
  const { data } = await axios.get(`${DRIVE}/pastas/${encodeURIComponent(id)}/arvore`);
  return data;
}

/** Conta Google conectada ao Drive. */
export async function contaDriveApi(): Promise<string> {
  const { data } = await axios.get<{ conta: string }>(`${DRIVE}/conta`);
  return data.conta;
}

export async function conteudoArquivoDriveApi(
  id: string,
): Promise<{ arquivo: DriveArquivo; texto: string; truncado: boolean }> {
  const { data } = await axios.get<{ arquivo: DriveArquivo; texto: string; truncado: boolean }>(
    `/conectores/drive/google-drive/arquivos/${encodeURIComponent(id)}/conteudo`,
  );
  return data;
}

// O interceptor de `@/utils/axios` rejeita com `{ statusCode, message }`; um
// erro cru do axios traz `response.data.message`. Aceita os dois formatos.
type ErroApi = {
  statusCode?: number;
  message?: string | string[];
  response?: { status?: number; data?: { message?: string | string[] } };
};

function partes(err: unknown): { status?: number; msg: string } {
  const e = (err ?? {}) as ErroApi;
  const m = e.response?.data?.message ?? e.message;
  return {
    status: e.response?.status ?? e.statusCode,
    msg: Array.isArray(m) ? m.join(" ") : (m ?? ""),
  };
}

/** Mensagem do servidor (NestJS) ou a padrão. */
export function mensagemDoErro(err: unknown, padrao: string): string {
  return partes(err).msg || padrao;
}

/** O conector ainda não foi autorizado ("ainda não foi autorizado"). */
export function ehNaoConectado(err: unknown): boolean {
  return /ainda não foi autorizado/i.test(partes(err).msg);
}
