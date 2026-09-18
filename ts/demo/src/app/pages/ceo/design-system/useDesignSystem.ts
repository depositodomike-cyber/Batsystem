import { useEffect, useSyncExternalStore } from "react";
import * as store from "./store";
import type { EstadoMarcas, MarcaLocal } from "./store";
import type { BrandOption, DesignSystem } from "./types";

/**
 * Hooks do store de marcas.
 *
 * `store.garantirHidratacao()` é chamada de dentro de um `useEffect` em todos
 * eles, e nunca do corpo do render: notificar durante o render faria as nove
 * telas de IA que assinam este store entrarem em laço. A guarda de
 * idempotência mora no store.
 */

/**
 * Lista de marcas + marca ativa, já reativas — o que o seletor do AI Studio
 * precisa, e só isso. Nenhuma ação de escrita: administrar marca é da aba Guia
 * de marca, que usa `useGestaoMarcas`.
 */
export function useDesignSystems(): {
  brands: BrandOption[];
  activeId: string;
  setActive: (id: string) => void;
  carregando: boolean;
  /** Já houve uma resposta — é o que separa "carregando" de "não há marca". */
  hidratado: boolean;
} {
  useSyncExternalStore(store.subscribe, store.getVersao, store.getVersao);
  useEffect(() => {
    store.garantirHidratacao();
  }, []);

  const estado = store.getEstado();
  return {
    brands: store.listBrands(),
    activeId: estado.activeId,
    setActive: store.setActive,
    carregando: estado.carregando,
    hidratado: estado.hidratado,
  };
}

/**
 * Design system da marca ativa (reativo).
 *
 * Assinatura SÍNCRONA e inalterada desde antes de as marcas irem para o
 * servidor: é o que permite que as nove telas do AI Studio continuem lendo o
 * documento no corpo do render e enviando-o para a IA sem nenhuma alteração.
 * Antes da primeira resposta, devolve o PADRAO.
 */
export function useActiveDesignSystem(): DesignSystem {
  useSyncExternalStore(store.subscribe, store.getVersao, store.getVersao);
  useEffect(() => {
    store.garantirHidratacao();
  }, []);
  return store.getActive();
}

/**
 * Estado completo e ações de escrita — só a aba Guia de marca, em
 * Configurações, precisa disto.
 *
 * As três ações podem LANÇAR (409 de nome duplicado, 403 de permissão, servidor
 * fora); quem chama trata e mostra a mensagem, que já vem pronta do backend.
 */
export function useGestaoMarcas(): EstadoMarcas & {
  marcas: MarcaLocal[];
  recarregar: () => Promise<void>;
  criar: (nome?: string) => Promise<string>;
  salvar: (id: string, ds: DesignSystem) => Promise<void>;
  remover: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  migrarLocais: () => Promise<{
    migradas: number;
    falhas: number;
    bloqueada: boolean;
  }>;
} {
  useSyncExternalStore(store.subscribe, store.getVersao, store.getVersao);
  useEffect(() => {
    store.garantirHidratacao();
  }, []);

  return {
    ...store.getEstado(),
    recarregar: store.recarregar,
    criar: store.criarAsync,
    salvar: store.salvarAsync,
    remover: store.removerAsync,
    setActive: store.setActive,
    migrarLocais: store.migrarLocaisAsync,
  };
}
