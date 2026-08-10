// ----------------------------------------------------------------------
// Persistência das marcas / design systems — portado do beculture/Confi
// (public/design-system.js). Estado: { brands: [{ id, ds }], activeId }.
//
// Uma marca fica ativa por vez; cada ação do AI Studio usa a marca ativa. Fica
// no localStorage (mesmo espírito do app desktop), com migração do formato
// antigo (um único design system em `beculture.designSystem`).
// ----------------------------------------------------------------------

import { PADRAO, type Brand, type BrandOption, type DesignSystem } from "./types";
import { chaveConta, lerComMigracao } from "@/utils/escopoConta";

const STORE = "beculture.designSystem"; // legado: um único design system
const STORE_MULTI_BASE = "beculture.designSystems"; // { brands, activeId }

function storeMultiKey(): string {
  return chaveConta(STORE_MULTI_BASE);
}

interface State {
  brands: Brand[];
  activeId: string;
}

const uid = () =>
  "b" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// Mescla profunda (o `over` sobrescreve o `base`), usada para completar lacunas
// de um design salvo com os valores do PADRAO.
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

function persistir(st: State) {
  try {
    localStorage.setItem(storeMultiKey(), JSON.stringify(st));
  } catch {
    /* quota/modo privado — segue sem persistir */
  }
}

// Carrega o estado multi-marca. Na primeira vez, migra o design system antigo
// (ou cria um a partir do PADRAO) como a marca inicial.
function carregar(): State {
  try {
    const raw = lerComMigracao(STORE_MULTI_BASE);
    if (raw) {
      const st = JSON.parse(raw) as State | null;
      if (st && Array.isArray(st.brands) && st.brands.length) {
        if (!st.brands.some((b) => b.id === st.activeId)) st.activeId = st.brands[0].id;
        return st;
      }
    }
  } catch {
    /* json inválido — recomeça do padrão */
  }

  let legado: unknown = null;
  try {
    const old = localStorage.getItem(STORE);
    if (old) legado = JSON.parse(old);
  } catch {
    /* ignora */
  }

  const id = uid();
  const st: State = { brands: [{ id, ds: mesclar(clonePadrao(), legado) }], activeId: id };
  persistir(st);
  return st;
}

// ---------------------------------------------------------------- assinatura
// Notificação para os componentes React (useSyncExternalStore). Também
// escutamos `storage` para refletir mudanças feitas em outra aba.

type Listener = () => void;
const listeners = new Set<Listener>();
let versao = 0;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notificar() {
  versao += 1;
  listeners.forEach((fn) => fn());
}

/** Snapshot barato e estável para o useSyncExternalStore. */
export function getVersao(): number {
  return versao;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === storeMultiKey() || e.key === STORE_MULTI_BASE) notificar();
  });
}

// ------------------------------------------------------------------- leitura

/** Design system completo de uma marca (lacunas preenchidas com o PADRAO). */
function dsDe(brand: Brand | undefined): DesignSystem {
  return mesclar(clonePadrao(), brand?.ds);
}

function brandAtiva(st: State): Brand | undefined {
  return st.brands.find((b) => b.id === st.activeId) ?? st.brands[0];
}

export function listBrands(): BrandOption[] {
  return carregar().brands.map((b) => ({
    id: b.id,
    nome: b.ds?.marca?.nome?.trim() || "Sem nome",
  }));
}

export function getActiveId(): string {
  return carregar().activeId;
}

/** Design system da marca ativa — é o que as ferramentas do AI Studio enviam. */
export function getActive(): DesignSystem {
  return dsDe(brandAtiva(carregar()));
}

export function getById(id: string): DesignSystem {
  const st = carregar();
  return dsDe(st.brands.find((b) => b.id === id) ?? brandAtiva(st));
}

/** Resumo de uma linha, para chips e títulos ("beculture · Moderno e premium"). */
export function resumo(id?: string): string {
  const d = id ? getById(id) : getActive();
  return `${d.marca.nome} · ${d.marca.tom}`;
}

// ------------------------------------------------------------------- escrita

export function setActive(id: string): string {
  const st = carregar();
  if (st.brands.some((b) => b.id === id)) {
    st.activeId = id;
    persistir(st);
    notificar();
  }
  return st.activeId;
}

/** Cria uma marca a partir do PADRAO e a torna ativa. Devolve o id. */
export function criar(): string {
  const st = carregar();
  const ds = clonePadrao();
  ds.marca.nome = `Marca ${st.brands.length + 1}`;
  const id = uid();
  st.brands.push({ id, ds });
  st.activeId = id;
  persistir(st);
  notificar();
  return id;
}

/** Grava o design system de uma marca e a torna ativa. */
export function salvar(id: string, ds: DesignSystem): void {
  const st = carregar();
  const brand = st.brands.find((b) => b.id === id);
  if (brand) brand.ds = ds;
  else st.brands.push({ id, ds });
  st.activeId = id;
  persistir(st);
  notificar();
}

/** Remove uma marca. A última não pode ser removida. */
export function remover(id: string): void {
  const st = carregar();
  if (st.brands.length <= 1) return;
  st.brands = st.brands.filter((b) => b.id !== id);
  if (!st.brands.some((b) => b.id === st.activeId)) st.activeId = st.brands[0].id;
  persistir(st);
  notificar();
}
