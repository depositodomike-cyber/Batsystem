import axios from "@/utils/axios";

/**
 * Cliente de Configurações > Organização > Ambiente local (ts/api → /desktop/*).
 * O controle do computador em si acontece pelo orquestrador (chat e voz);
 * aqui ficam só conexão, permissões, segurança e privacidade.
 */

export type EstadoDispositivo =
  | "pendente"
  | "conectado"
  | "desconectado"
  | "inicializando"
  | "sincronizando"
  | "atualizando"
  | "bloqueado"
  | "erro"
  | "revogado";

export interface AppInventario {
  id: string;
  nome: string;
  alvo: string;
}

export interface Dispositivo {
  id: string;
  nome: string;
  estado: EstadoDispositivo;
  versaoAgente: string;
  impressaoDigital: string;
  ultimoContato: string | null;
  politicaAplicada: number;
  confirmacaoLocalPendente: boolean;
  autoinicio: boolean;
  criadoEm: string;
  inventario: AppInventario[];
}

export type Categoria =
  | "apps"
  | "processos"
  | "janelas"
  | "arquivos_busca"
  | "documentos"
  | "arquivos_escrita"
  | "navegador"
  | "midia"
  | "energia";

export interface PoliticaDesktop {
  versao: number;
  permissoes: Partial<Record<Categoria, boolean>>;
  confirmar: string[];
  apps: string[];
  observaveis: string[];
  diretorios: string[];
  dominios: string[];
  retencaoDias: number;
  autoinicio: boolean;
}

export interface EstadoAmbienteLocal {
  liberacao: { ativo: boolean; motivo?: string };
  dispositivos: Dispositivo[];
  politica: PoliticaDesktop;
  catalogo: {
    categorias: Categoria[];
    operacoes: { id: string; categoria: Categoria; base: "baixo" | "moderado" | "alto" }[];
    extensoesDocumento: string[];
    extensoesAlto: string[];
    bloqueadas: string[];
  };
}

export interface EventoHistorico {
  id: string;
  evento: string;
  ferramenta: string | null;
  risco: string | null;
  detalhes: Record<string, unknown> | null;
  criadoEm: string;
}

export const estadoAmbienteLocalApi = () =>
  axios.get<EstadoAmbienteLocal>("/desktop/estado").then((r) => r.data);

export const alterarPoliticaDesktopApi = (alteracao: Partial<Omit<PoliticaDesktop, "versao">>) =>
  axios.patch<{ versao: number }>("/desktop/politica", alteracao).then((r) => r.data);

export const gerarCodigoPareamentoApi = () =>
  axios
    .post<{ codigo: string; expiraEm: string; impressaoServidor: string }>("/desktop/pareamento")
    .then((r) => r.data);

export const confirmarDispositivoApi = (id: string, impressaoDigital: string) =>
  axios.post(`/desktop/dispositivos/${encodeURIComponent(id)}/confirmar`, { impressaoDigital }).then((r) => r.data);

export const revogarDispositivoApi = (id: string) =>
  axios.post(`/desktop/dispositivos/${encodeURIComponent(id)}/revogar`).then((r) => r.data);

export const retomarDispositivoApi = (id: string) =>
  axios.post(`/desktop/dispositivos/${encodeURIComponent(id)}/retomar`).then((r) => r.data);

/** "Parar tudo" (SR-31): bloqueia todos os computadores do usuário. */
export const pararDesktopApi = () =>
  axios.post<{ ok: true; dispositivos: number }>("/desktop/parar").then((r) => r.data);

export const historicoDesktopApi = (limite = 50) =>
  axios.get<EventoHistorico[]>("/desktop/historico", { params: { limite } }).then((r) => r.data);

export { ehPararTudo } from "./desktop-comandos";
