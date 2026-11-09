// ----------------------------------------------------------------------
// Importação das Notas Autoadesivas para o Repositório — mesmo pipeline do
// Google Drive (drive/importacao.ts): cada nota vira um .md na pasta do
// Repositório (gravarArquivoMemoria) e vai ao índice da IA (syncVaultBatch).
// Sem IA, sem tokens: o texto entra como está.
//
// Duplicados: o frontmatter guarda `sticky-id` e `sticky-modificado`.
// Reimportar uma nota sem mudanças é ignorado; se ela mudou, a MESMA nota do
// Repositório é atualizada (mesmo caminho).
// ----------------------------------------------------------------------

import { syncVaultBatch, VAULT_BATCH_SIZE, type VaultNotaInput } from "@/services/api/vault";
import { gravarArquivoMemoria, nomeSeguroMemoria } from "@/utils/memoriaVault";
import { invalidarNotasMemoria } from "@/components/shared/MemoriaMentions/alvos";
import { lerArquivosMd, pastaContextoSalva, permissaoDeLeitura } from "../memoria-inventario";
import { EVENTO_REPOSITORIO_ATUALIZADO } from "../drive/importacao";
import { notaParaMd, type NotaAutoadesiva } from "./conversor";

export const PASTA_NOTAS_AUTOADESIVAS = "Notas Autoadesivas";

export interface NotaNoRepositorio {
  path: string;
  modificado: string | null;
}

/** sticky-id → nota já importada. Sem pasta/permissão devolve vazio. */
export async function indiceNotasAutoadesivas(): Promise<Map<string, NotaNoRepositorio>> {
  const indice = new Map<string, NotaNoRepositorio>();
  const handle = await pastaContextoSalva();
  if (!handle || !(await permissaoDeLeitura(handle))) return indice;
  for (const a of await lerArquivosMd(handle)) {
    const fm = a.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    const id = fm.match(/^sticky-id:\s*(\S+)/m)?.[1];
    if (id && !indice.has(id)) {
      indice.set(id, { path: a.path, modificado: fm.match(/^sticky-modificado:\s*(\S+)/m)?.[1] ?? null });
    }
  }
  return indice;
}

export type SituacaoNota = "nova" | "existe" | "atualizada";

export function situacaoDaNota(n: NotaAutoadesiva, indice: Map<string, NotaNoRepositorio>): SituacaoNota {
  const ja = indice.get(n.id);
  if (!ja) return "nova";
  if (n.atualizadoEm && ja.modificado && n.atualizadoEm > ja.modificado) return "atualizada";
  return "existe";
}

export type StatusImportacao = "pendente" | "importando" | "importada" | "atualizada" | "falha";

export interface ItemNota {
  nota: NotaAutoadesiva;
  destino: string;
  existente: boolean;
  status: StatusImportacao;
  erro?: string;
}

/**
 * Caminho de cada nota: a já importada mantém o seu; as novas ganham
 * `<pasta>/<título>.md`, com sufixo quando dois títulos coincidem.
 */
export function montarPlanoNotas(
  notas: NotaAutoadesiva[],
  indice: Map<string, NotaNoRepositorio>,
  pasta: string,
): ItemNota[] {
  const base = pasta.replace(/^\/+|\/+$/g, "") || PASTA_NOTAS_AUTOADESIVAS;
  const usados = new Set([...indice.values()].map((v) => v.path.toLowerCase()));
  // Ordem estável (mais antigas primeiro) para os sufixos não trocarem entre importações.
  const ordem = [...notas].sort((a, b) => (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""));
  const destinos = new Map<string, string>();
  for (const n of ordem) {
    const ja = indice.get(n.id);
    if (ja) {
      destinos.set(n.id, ja.path);
      continue;
    }
    const nome = nomeSeguroMemoria(n.titulo);
    let destino = `${base}/${nome}.md`;
    for (let i = 2; usados.has(destino.toLowerCase()); i++) destino = `${base}/${nome} (${i}).md`;
    usados.add(destino.toLowerCase());
    destinos.set(n.id, destino);
  }
  return notas.map((n) => ({
    nota: n,
    destino: destinos.get(n.id)!,
    existente: indice.has(n.id),
    status: "pendente",
  }));
}

/** Grava as notas (4 por vez), indexa na IA e avisa o grafo/lista. */
export async function importarNotas(
  itens: ItemNota[],
  onProgresso: (itens: ItemNota[]) => void,
): Promise<ItemNota[]> {
  const estado = itens.map((i) => ({ ...i }));
  const emitir = () => onProgresso(estado.map((i) => ({ ...i })));
  const gravadas: VaultNotaInput[] = [];
  const fila = estado.filter((i) => i.status === "pendente" || i.status === "falha");
  let pastaIndisponivel = false;

  const trabalhar = async () => {
    for (;;) {
      const item = fila.shift();
      if (!item || pastaIndisponivel) return;
      item.status = "importando";
      item.erro = undefined;
      emitir();
      const conteudo = notaParaMd(item.nota);
      const g = await gravarArquivoMemoria(item.destino, conteudo);
      if (g.ok) {
        gravadas.push({ path: item.destino, titulo: item.nota.titulo, conteudo });
        item.status = item.existente ? "atualizada" : "importada";
      } else {
        if (g.reason === "no-folder" || g.reason === "denied" || g.reason === "unsupported") {
          pastaIndisponivel = true;
        }
        item.status = "falha";
        item.erro =
          g.reason === "no-folder"
            ? "Nenhuma pasta do Repositório conectada."
            : g.reason === "denied"
              ? "Sem permissão para gravar na pasta do Repositório."
              : g.reason === "unsupported"
                ? "Este navegador não grava na pasta do Repositório."
                : "Falha ao gravar a nota.";
      }
      emitir();
    }
  };
  await Promise.all([trabalhar(), trabalhar(), trabalhar(), trabalhar()]);

  if (pastaIndisponivel) {
    for (const i of estado) {
      if (i.status === "pendente") {
        i.status = "falha";
        i.erro = "Não gravada: pasta do Repositório indisponível.";
      }
    }
    emitir();
  }

  if (gravadas.length) {
    for (let i = 0; i < gravadas.length; i += VAULT_BATCH_SIZE) {
      await syncVaultBatch(gravadas.slice(i, i + VAULT_BATCH_SIZE)).catch(() => undefined);
    }
    invalidarNotasMemoria();
    window.dispatchEvent(new CustomEvent(EVENTO_REPOSITORIO_ATUALIZADO));
  }
  return estado;
}
