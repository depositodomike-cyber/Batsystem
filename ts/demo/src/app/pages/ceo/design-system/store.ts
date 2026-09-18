// ----------------------------------------------------------------------
// Marcas / design systems — cache de rede com leitura SÍNCRONA.
//
// Até a V5 este arquivo era o dono do dado: tudo vivia no localStorage, e as
// marcas eram por NAVEGADOR. Agora a autoridade é o backend (`/empresa/marcas`)
// e as marcas pertencem à organização.
//
// O que NÃO mudou, de propósito: toda a leitura continua síncrona. Nove telas
// do AI Studio chamam `useActiveDesignSystem()` no corpo do render e enviam o
// documento para a IA; transformá-la em assíncrona significaria mexer nas nove.
// Por isso o desenho é "cache em memória + hidratação em segundo plano", e não
// um hook de fetch.
//
// Quatro chaves de localStorage, quatro papéis distintos:
//
//   beculture.designSystems:<conta>    LEGADO. Só é lido — pela migração e pelo
//                                      modo offline, que é o único que ainda
//                                      escreve nele.
//   beculture.marcas.cache:<conta>     Cache de rede: só recebe o que o GET
//                                      devolveu. Serve à primeira pintura.
//   beculture.marcaAtiva:<conta>       Preferência do USUÁRIO neste navegador.
//                                      Nunca vai ao servidor — dois membros da
//                                      mesma organização podem ter marcas
//                                      ativas diferentes, e os dois estão
//                                      certos.
//   beculture.marcas.migradoEm:<conta> Marcador ISO da migração concluída.
// ----------------------------------------------------------------------

import {
  PADRAO,
  type Brand,
  type BrandOption,
  type DesignSystem,
} from "./types";
import { chaveConta, escopoConta, lerComMigracao } from "@/utils/escopoConta";
import { sessaoLocalAtiva } from "@/utils/sessaoLocal";
import {
  criarMarcaApi,
  fetchMarcasApi,
  removerMarcaApi,
  salvarMarcaApi,
  type Marca,
} from "@/services/api/marcas";

const LEGADO_UNICO = "beculture.designSystem"; // legado: um único design system
const LEGADO_MULTI = "beculture.designSystems"; // legado: { brands, activeId }
const CACHE = "beculture.marcas.cache";
const ATIVA = "beculture.marcaAtiva";
const MIGRADO = "beculture.marcas.migradoEm";

/** Marca no cache local — o `Brand` do store mais os carimbos do servidor. */
export interface MarcaLocal extends Brand {
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface EstadoMarcas {
  marcas: MarcaLocal[];
  /** Id resolvido da marca ativa. Vazio quando a organização não tem nenhuma. */
  activeId: string;
  /** Há um GET em voo. */
  carregando: boolean;
  /** Já houve UMA resposta (200 ou falha) — é o que decide o estado vazio. */
  hidratado: boolean;
  /**
   * As escritas ficam SÓ neste navegador: modo local (token de protótipo) ou
   * servidor inalcançável. A UI de gestão avisa em voz alta; o protótipo
   * continua utilizável, que é o requisito.
   */
  offline: boolean;
  erro: string | null;
  /** Marcas deste navegador ainda não enviadas para a organização. */
  legadoPendente: number;
  /** A migração parou porque a role do usuário não permite escrever. */
  migracaoBloqueada: boolean;
}

interface EstadoInterno extends EstadoMarcas {
  /** Conta a que este estado pertence — ver `garantirEscopo`. */
  escopo: string;
}

function vazio(escopo: string): EstadoInterno {
  return {
    escopo,
    marcas: [],
    activeId: "",
    carregando: false,
    hidratado: false,
    offline: false,
    erro: null,
    legadoPendente: 0,
    migracaoBloqueada: false,
  };
}

let estado: EstadoInterno = vazio(escopoConta());
let versao = 0;
let pendente: Promise<void> | null = null;

// ---------------------------------------------------------------- utilidades

const uid = () =>
  "b" +
  Math.random().toString(36).slice(2, 9) +
  Date.now().toString(36).slice(-4);

/**
 * Mescla profunda (o `over` sobrescreve o `base`), usada para completar lacunas
 * de um design salvo com os valores do PADRAO — é o que deixa um campo novo em
 * `types.ts` entrar sem quebrar o que já está gravado.
 */
function mesclar<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || Array.isArray(over)) return base;
  const out = base as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = mesclar((out[k] ?? {}) as Record<string, unknown>, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

const clonePadrao = (): DesignSystem => structuredClone(PADRAO);

const nomeDe = (m: MarcaLocal) => m.ds?.marca?.nome?.trim() || "Sem nome";
const chaveNome = (nome: string) => nome.trim().toLowerCase();

function lerJson<T>(chave: string): T | null {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function gravarJson(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Cota estourada (os logos são data URLs) ou modo privado. O cache é uma
    // conveniência de primeira pintura: perdê-lo custa um spinner, não um dado.
  }
}

const toMarcaLocal = (m: Marca): MarcaLocal => ({
  id: m.id,
  ds: m.ds,
  criadoEm: m.criadoEm,
  atualizadoEm: m.atualizadoEm,
});

/** Marcas da chave legada deste navegador (os formatos pré-V5). */
function lerLegado(): MarcaLocal[] {
  const raw = lerComMigracao(LEGADO_MULTI);
  if (raw) {
    try {
      const st = JSON.parse(raw) as { brands?: Brand[] } | null;
      if (st?.brands?.length) {
        return st.brands.map((b) => ({ id: b.id, ds: b.ds }));
      }
    } catch {
      /* json inválido — segue para o legado de um só design system */
    }
  }

  const unico = lerJson<unknown>(LEGADO_UNICO);
  if (unico) return [{ id: uid(), ds: mesclar(clonePadrao(), unico) }];
  return [];
}

function gravarLegado(marcas: MarcaLocal[]) {
  gravarJson(chaveConta(LEGADO_MULTI), {
    brands: marcas.map((m) => ({ id: m.id, ds: m.ds })),
    activeId: estado.activeId,
  });
}

/** Preferência crua de marca ativa — pode apontar para uma marca já excluída. */
function lerAtivaCrua(): string {
  try {
    return localStorage.getItem(chaveConta(ATIVA)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Resolve a preferência contra a lista real.
 *
 * Guardamos a preferência CRUA e resolvemos na leitura: assim a marca que sumiu
 * da lista por um instante — durante a hidratação, ou porque outro membro a
 * excluiu e recriou — não apaga a escolha de quem estava usando.
 */
function resolverAtiva(marcas: MarcaLocal[]): string {
  const preferida = lerAtivaCrua();
  if (marcas.some((m) => m.id === preferida)) return preferida;
  return marcas[0]?.id ?? "";
}

function mensagemErro(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  }
  return "Não foi possível falar com o servidor.";
}

function statusDe(e: unknown): number | null {
  if (e && typeof e === "object" && "statusCode" in e) {
    const s = (e as { statusCode?: unknown }).statusCode;
    if (typeof s === "number") return s;
  }
  return null;
}

// ---------------------------------------------------------------- assinatura

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notificar() {
  versao += 1;
  listeners.forEach((fn) => fn());
}

/**
 * Snapshot barato e estável para o `useSyncExternalStore`.
 *
 * É a ÚNICA `getSnapshot` do store, e devolve um número. Nenhum getter
 * incrementa `versao`: se algum incrementasse, as nove telas de IA que assinam
 * este store entrariam em laço de render na mesma hora.
 */
export function getVersao(): number {
  return versao;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key) return;

    // A marca ativa continua sincronizando entre abas — é preferência local.
    if (e.key === chaveConta(ATIVA)) {
      estado = { ...estado, activeId: resolverAtiva(estado.marcas) };
      notificar();
      return;
    }

    // As marcas em si, não: a autoridade é o servidor, e duas abas convergem no
    // próximo carregamento — mesmo comportamento de Áreas e Cargos. A exceção é
    // o modo offline, em que a chave legada volta a ser a fonte da verdade.
    if (estado.offline && e.key === chaveConta(LEGADO_MULTI)) {
      const marcas = lerLegado();
      estado = { ...estado, marcas, activeId: resolverAtiva(marcas) };
      notificar();
    }
  });
}

// ---------------------------------------------------------------- hidratação

/**
 * Garante que o estado em memória pertence à conta logada AGORA.
 *
 * Chamado no topo de toda leitura, e nunca notifica: é a versão em memória do
 * que o `carregar()` antigo fazia a cada chamada — recomputar a chave do
 * localStorage, que muda quando o usuário entra, sai ou troca de organização.
 * Sem isto, as marcas de uma conta apareceriam para a seguinte no mesmo
 * navegador.
 */
function garantirEscopo(): void {
  const escopo = escopoConta();
  if (escopo === estado.escopo) return;

  const cache = lerJson<MarcaLocal[]>(chaveConta(CACHE)) ?? [];
  estado = { ...vazio(escopo), marcas: cache, activeId: resolverAtiva(cache) };
  // A promessa em voo é de outra conta: ela se descarta sozinha no confronto de
  // escopo, e aqui só liberamos o slot para a hidratação nova.
  pendente = null;
}

/**
 * Dispara o GET uma única vez por conta. Idempotente, e chamada SEMPRE de um
 * `useEffect` — nunca do corpo do render. É a guarda `hidratado || pendente`
 * que a torna segura sob o StrictMode, que monta cada efeito duas vezes.
 */
export function garantirHidratacao(): void {
  garantirEscopo();
  if (estado.hidratado || pendente) return;
  void buscar();
}

/** Re-GET explícito — o "Tentar de novo" da aba de Configurações. */
export function recarregar(): Promise<void> {
  garantirEscopo();
  if (pendente) return pendente;
  return buscar();
}

function buscar(): Promise<void> {
  const escopo = estado.escopo;

  // Modo local: o backend responde 401 em TODA rota autenticada (ver
  // utils/sessaoLocal.ts). Não adianta tentar — o store cai direto na chave
  // legada e funciona como sempre funcionou, offline.
  if (sessaoLocalAtiva()) {
    const marcas = lerLegado();
    estado = {
      ...estado,
      marcas,
      activeId: resolverAtiva(marcas),
      offline: true,
      hidratado: true,
      carregando: false,
      erro: null,
    };
    notificar();
    return Promise.resolve();
  }

  const cache = lerJson<MarcaLocal[]>(chaveConta(CACHE));
  estado = {
    ...estado,
    carregando: true,
    // Primeira pintura pelo cache: indistinguível do estado final na maioria
    // esmagadora dos casos, e evita o piscar de "nenhuma marca".
    marcas: estado.marcas.length ? estado.marcas : (cache ?? []),
  };

  pendente = fetchMarcasApi()
    .then(async (remotas) => {
      if (estado.escopo !== escopo) return; // trocou de conta no meio do voo
      const marcas = remotas.map(toMarcaLocal);
      gravarJson(chaveConta(CACHE), marcas);
      estado = {
        ...estado,
        marcas,
        activeId: resolverAtiva(marcas),
        offline: false,
        erro: null,
      };
      await migrarLegadoSePreciso();
    })
    .catch((e: unknown) => {
      if (estado.escopo !== escopo) return;
      // 401 (sessão expirada) ou servidor fora: segue com o que houver em
      // cache, mas ASSUME offline — as escritas passam a ficar locais e a UI de
      // gestão diz isso, em vez de fingir que salvou na organização.
      estado = { ...estado, offline: true, erro: mensagemErro(e) };
    })
    .finally(() => {
      if (estado.escopo !== escopo) return;
      estado = {
        ...estado,
        carregando: false,
        hidratado: true,
        legadoPendente: contarLegadoPendente(),
      };
      pendente = null;
      // UMA notificação por ciclo, sempre no fim. Nunca no caminho síncrono de
      // uma leitura — é o outro lado da defesa contra o laço de render.
      notificar();
    });

  return pendente;
}

// ------------------------------------------------------------------- leitura

function dsDe(marca: MarcaLocal | undefined): DesignSystem {
  return mesclar(clonePadrao(), marca?.ds);
}

let cacheAtivo: { versao: number; id: string; ds: DesignSystem } | null = null;

/**
 * Design system da marca ativa — é o que as ferramentas do AI Studio enviam.
 *
 * Sem nenhuma marca (organização nova, ou antes da primeira resposta) devolve o
 * PADRAO. É o que garante que as nove telas de IA nunca fiquem sem design para
 * mandar: o conteúdo sai no estilo padrão da plataforma, não em erro.
 *
 * Memorizado por `(versao, activeId)`: `mesclar` clona o PADRAO inteiro, e sem
 * a memo isso rodaria a cada render de cada tela que assina o store.
 */
export function getActive(): DesignSystem {
  garantirEscopo();
  const id = estado.activeId;
  if (cacheAtivo && cacheAtivo.versao === versao && cacheAtivo.id === id) {
    return cacheAtivo.ds;
  }
  const ds = dsDe(estado.marcas.find((m) => m.id === id) ?? estado.marcas[0]);
  cacheAtivo = { versao, id, ds };
  return ds;
}

export function getActiveId(): string {
  garantirEscopo();
  return estado.activeId;
}

export function listBrands(): BrandOption[] {
  garantirEscopo();
  return estado.marcas.map((m) => ({ id: m.id, nome: nomeDe(m) }));
}

export function getById(id: string): DesignSystem {
  garantirEscopo();
  const achada = estado.marcas.find((m) => m.id === id);
  return dsDe(achada ?? estado.marcas.find((m) => m.id === estado.activeId));
}

/** A marca inteira, com os carimbos do servidor — para a tabela e o editor. */
export function getMarca(id: string): MarcaLocal | undefined {
  garantirEscopo();
  return estado.marcas.find((m) => m.id === id);
}

/** Resumo de uma linha, para chips e títulos ("beculture · Moderno e premium"). */
export function resumo(id?: string): string {
  const d = id ? getById(id) : getActive();
  return `${d.marca.nome} · ${d.marca.tom}`;
}

export function getEstado(): EstadoMarcas {
  garantirEscopo();
  return estado;
}

// ------------------------------------------------------------------- escrita

/**
 * Marca ativa. Preferência LOCAL: síncrona, sem rede, como sempre foi.
 *
 * Não vai ao servidor de propósito — qual marca está selecionada é escolha de
 * quem está usando o produto naquele navegador, não um atributo da organização.
 */
export function setActive(id: string): string {
  garantirEscopo();
  if (!estado.marcas.some((m) => m.id === id)) return estado.activeId;
  try {
    localStorage.setItem(chaveConta(ATIVA), id);
  } catch {
    /* cota/modo privado — a escolha vale para esta sessão */
  }
  estado = { ...estado, activeId: id };
  notificar();
  return id;
}

/** Cria uma marca a partir do PADRAO e a torna ativa. Devolve o id. */
export async function criarAsync(nomeSugerido?: string): Promise<string> {
  garantirEscopo();
  const ds = clonePadrao();
  ds.marca.nome = nomeSugerido?.trim() || `Marca ${estado.marcas.length + 1}`;

  const nova = await gravarNova(ds);
  estado = { ...estado, marcas: [...estado.marcas, nova] };
  sincronizarArmazenamento();
  setActive(nova.id); // já notifica
  return nova.id;
}

/**
 * Grava o design system de uma marca.
 *
 * NÃO a torna ativa — o store antigo fazia isso, porque salvar só acontecia a
 * partir da barra, onde a marca já era a selecionada. Na aba de Configurações,
 * editar a marca B não pode sequestrar a preferência de quem usa a A.
 */
export async function salvarAsync(id: string, ds: DesignSystem): Promise<void> {
  garantirEscopo();
  const atualizada: MarcaLocal = estado.offline
    ? { id, ds, atualizadoEm: new Date().toISOString() }
    : toMarcaLocal(await salvarMarcaApi(id, ds));

  const existe = estado.marcas.some((m) => m.id === id);
  estado = {
    ...estado,
    marcas: existe
      ? estado.marcas.map((m) => (m.id === id ? atualizada : m))
      : [...estado.marcas, atualizada],
  };
  sincronizarArmazenamento();
  notificar();
}

export async function removerAsync(id: string): Promise<void> {
  garantirEscopo();
  if (!estado.offline) await removerMarcaApi(id);

  const marcas = estado.marcas.filter((m) => m.id !== id);
  estado = { ...estado, marcas, activeId: resolverAtiva(marcas) };
  sincronizarArmazenamento();
  notificar();
}

async function gravarNova(ds: DesignSystem): Promise<MarcaLocal> {
  if (estado.offline) {
    const agora = new Date().toISOString();
    return { id: uid(), ds, criadoEm: agora, atualizadoEm: agora };
  }
  return toMarcaLocal(await criarMarcaApi(ds));
}

/** Espelha o estado na chave certa: cache de rede online, legado offline. */
function sincronizarArmazenamento() {
  if (estado.offline) gravarLegado(estado.marcas);
  else gravarJson(chaveConta(CACHE), estado.marcas);
}

// ------------------------------------------------------------------ migração

function contarLegadoPendente(): number {
  if (estado.offline) return 0;
  try {
    if (localStorage.getItem(chaveConta(MIGRADO))) return 0;
  } catch {
    return 0;
  }
  const noServidor = new Set(estado.marcas.map((m) => chaveNome(nomeDe(m))));
  return lerLegado().filter((m) => !noServidor.has(chaveNome(nomeDe(m))))
    .length;
}

/**
 * Envia para a organização as marcas que ainda só existem neste navegador.
 *
 * Roda sozinha depois de um GET bem-sucedido, e pode ser chamada de novo pela
 * aba de Configurações ("Enviar agora") quando alguma falhar.
 *
 * Três camadas contra duplicata: o marcador local impede o segundo disparo
 * neste navegador; a comparação por nome pula o que o servidor já tem; e a
 * unique da tabela, com o 409 tratado como sucesso, é a única defesa que
 * funciona entre navegadores e membros diferentes — o objetivo era "esta marca
 * existe na organização", e ela existe.
 *
 * A chave legada NUNCA é apagada: é a rede de segurança. Uma migração parcial
 * que apagasse a origem perderia dado sem volta.
 */
export async function migrarLocaisAsync(): Promise<{
  migradas: number;
  falhas: number;
  bloqueada: boolean;
}> {
  garantirEscopo();
  if (estado.offline) return { migradas: 0, falhas: 0, bloqueada: false };

  const noServidor = new Set(estado.marcas.map((m) => chaveNome(nomeDe(m))));
  const pendentes = lerLegado().filter(
    (m) => !noServidor.has(chaveNome(nomeDe(m))),
  );

  let migradas = 0;
  let falhas = 0;
  let bloqueada = false;
  const puladas: string[] = [];

  // Sequencial, e não Promise.all: os logos são data URLs pesadas, e o 409 da
  // segunda marca de mesmo nome depende de a primeira já ter sido gravada.
  for (const local of pendentes) {
    try {
      const nova = toMarcaLocal(await criarMarcaApi(local.ds));
      estado = { ...estado, marcas: [...estado.marcas, nova] };
      migradas += 1;
    } catch (e) {
      const status = statusDe(e);
      if (status === 409) {
        // Outro membro já enviou uma marca com este nome. Ele venceu; as
        // edições locais desta marca ficam na chave legada, recuperáveis.
        puladas.push(nomeDe(local));
        continue;
      }
      if (status === 403) {
        // A role não permite escrever. Parar aqui evita N requisições que
        // voltariam 403 — a aba de Configurações explica o que fazer.
        bloqueada = true;
        break;
      }
      falhas += 1;
    }
  }

  if (puladas.length) {
    console.info(
      "[marcas] já existiam na organização e não foram enviadas:",
      puladas.join(", "),
    );
  }

  if (!falhas && !bloqueada) {
    try {
      localStorage.setItem(chaveConta(MIGRADO), new Date().toISOString());
    } catch {
      /* cota — tenta de novo no próximo carregamento */
    }
  }

  estado = {
    ...estado,
    activeId: resolverAtiva(estado.marcas),
    migracaoBloqueada: bloqueada,
  };
  sincronizarArmazenamento();
  estado = { ...estado, legadoPendente: contarLegadoPendente() };
  notificar();

  return { migradas, falhas, bloqueada };
}

/** Migração automática, dentro do ciclo de hidratação. Silenciosa por desenho. */
async function migrarLegadoSePreciso(): Promise<void> {
  try {
    if (localStorage.getItem(chaveConta(MIGRADO))) return;
  } catch {
    return;
  }
  if (!lerLegado().length) return;
  await migrarLocaisAsync();
}
