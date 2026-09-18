import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

/**
 * Cliente da API de Marcas — os guias de marca da organização (backend ts/api,
 * módulo `marcas`).
 *
 * Uma Marca é um design system completo com identidade própria: é o que decide
 * a cara do que o AI Studio gera. Até a V5 as marcas viviam no localStorage de
 * cada navegador; agora pertencem à organização, e este é o único caminho até
 * elas.
 *
 * Leitura liberada a todo o tenant; criar, salvar e excluir exigem
 * `configuracoes.gerenciar` — a API responde 403 com a mensagem pronta para
 * exibir.
 */

export interface Marca {
  id: string;
  empresaId: string;
  /**
   * O design system inteiro, com `logos` já remontado. O nome da marca mora
   * aqui dentro (`ds.marca.nome`) e não num campo irmão: duas cópias do mesmo
   * dado no payload seriam duas fontes de verdade.
   */
  ds: DesignSystem;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

/** GET /empresa/marcas → todas as marcas da organização, em ordem de nome. */
export async function fetchMarcasApi(): Promise<Marca[]> {
  const { data } = await axios.get<Marca[]>("/empresa/marcas");
  return data;
}

/** GET /empresa/marcas/:id */
export async function fetchMarcaApi(id: string): Promise<Marca> {
  const { data } = await axios.get<Marca>(
    `/empresa/marcas/${encodeURIComponent(id)}`,
  );
  return data;
}

/** POST /empresa/marcas → cria. 409 quando o nome já existe na organização. */
export async function criarMarcaApi(ds: DesignSystem): Promise<Marca> {
  const { data } = await axios.post<Marca>("/empresa/marcas", ds);
  return data;
}

/**
 * PUT /empresa/marcas/:id → substitui o design system inteiro.
 *
 * PUT e não PATCH porque o editor é um formulário de oito seções com estado
 * único: ele sempre tem o documento completo em mãos.
 */
export async function salvarMarcaApi(
  id: string,
  ds: DesignSystem,
): Promise<Marca> {
  const { data } = await axios.put<Marca>(
    `/empresa/marcas/${encodeURIComponent(id)}`,
    ds,
  );
  return data;
}

/**
 * DELETE /empresa/marcas/:id
 *
 * Sem realocação e sem 409, ao contrário de áreas e cargos: nada referencia uma
 * marca, e o conteúdo já gerado carrega o design embutido — excluir não muda
 * nenhuma apresentação existente.
 */
export async function removerMarcaApi(id: string): Promise<void> {
  await axios.delete(`/empresa/marcas/${encodeURIComponent(id)}`);
}
