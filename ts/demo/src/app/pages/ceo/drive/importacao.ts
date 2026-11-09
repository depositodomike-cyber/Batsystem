// ----------------------------------------------------------------------
// Importação do Google Drive para o Repositório.
//
// Usa o pipeline existente: cada arquivo vira uma nota .md na pasta do
// Repositório (gravarArquivoMemoria) e é enviado ao índice da IA
// (syncVaultBatch) — o mesmo que o Sincronizar do grafo faz. Nada de
// armazenamento novo. Só LÊ do Drive.
//
// Duplicados: cada nota guarda `drive-id` e `drive-modificado` no
// frontmatter. Reimportar o mesmo arquivo sem mudanças é ignorado; se ele
// mudou no Drive, a MESMA nota é atualizada (mesmo caminho).
// ----------------------------------------------------------------------

import { syncVaultBatch, VAULT_BATCH_SIZE, type VaultNotaInput } from "@/services/api/vault";
import {
  arvoreDriveApi,
  conteudoArquivoDriveApi,
  mensagemDoErro,
  type DriveArquivo,
} from "@/services/api/googleConectores";
import { gravarArquivoMemoria, nomeSeguroMemoria } from "@/utils/memoriaVault";
import { invalidarNotasMemoria } from "@/components/shared/MemoriaMentions/alvos";
import {
  lerArquivosMd,
  pastaContextoSalva,
  permissaoDeLeitura,
} from "../memoria-inventario";

/** Pasta padrão do Repositório para o que vem do Drive. */
export const PASTA_DRIVE = "Google Drive";
/** Teto de arquivos numa importação (pastas grandes). */
export const MAX_ARQUIVOS_IMPORTACAO = 1000;
/** Evento para o grafo e a lista recarregarem da pasta. */
export const EVENTO_REPOSITORIO_ATUALIZADO = "repositorio:atualizado";

export interface NotaDoDrive {
  path: string;
  modificado: string | null;
}

/** drive-id → nota já existente no Repositório. */
export type IndiceDrive = Map<string, NotaDoDrive>;

/** Id do Drive dentro de um link (`/d/<id>/` ou `?id=<id>`). */
function idDoLink(link: string): string | null {
  return link.match(/\/d\/([\w-]{10,})/)?.[1] ?? link.match(/[?&]id=([\w-]{10,})/)?.[1] ?? null;
}

/**
 * Lê as notas da pasta do Repositório e indexa as que vieram do Drive — pelo
 * frontmatter (`drive-id`) ou, nas importações antigas, pelo link na linha
 * "Origem: Google Drive — …". Sem pasta/permissão devolve um índice vazio.
 */
export async function indiceDoRepositorio(): Promise<IndiceDrive> {
  const indice: IndiceDrive = new Map();
  const handle = await pastaContextoSalva();
  if (!handle || !(await permissaoDeLeitura(handle))) return indice;
  const arquivos = await lerArquivosMd(handle);
  for (const a of arquivos) {
    const fm = a.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    let id = fm.match(/^drive-id:\s*(\S+)/m)?.[1] ?? null;
    const modificado = fm.match(/^drive-modificado:\s*(\S+)/m)?.[1] ?? null;
    if (!id) {
      const origem = a.text.match(/^Origem:\s*Google Drive\s*—\s*(\S+)/m)?.[1];
      id = origem ? idDoLink(origem) : null;
    }
    if (id && !indice.has(id)) indice.set(id, { path: a.path, modificado });
  }
  return indice;
}

/** Situação de um arquivo do Drive em relação ao Repositório. */
export function situacaoNoRepositorio(
  a: Pick<DriveArquivo, "id" | "modificadoEm">,
  indice: IndiceDrive,
): "novo" | "existe" | "atualizado" {
  const nota = indice.get(a.id);
  if (!nota) return "novo";
  if (a.modificadoEm && nota.modificado && a.modificadoEm > nota.modificado) return "atualizado";
  return "existe";
}

// ----------------------------------------------------------------- plano

export type StatusItem =
  | "pendente"
  | "importando"
  | "importado"
  | "atualizado"
  | "existe"
  | "nao-suportado"
  | "falha";

export interface ItemImportacao {
  arquivo: DriveArquivo;
  /** Caminho da nota no Repositório. */
  destino: string;
  /** Pasta do Drive de onde veio (quando importado como parte de uma pasta). */
  pastaDriveId: string | null;
  /** Já havia nota deste arquivo (reimportar = atualizar a mesma nota). */
  existente: boolean;
  status: StatusItem;
  erro?: string;
}

/**
 * Expande a seleção (arquivos avulsos + pastas, recursivas) em itens com o
 * caminho final no Repositório, preservando a estrutura de pastas do Drive.
 */
export async function montarPlano(
  selecao: DriveArquivo[],
  pastaDestino: string,
  indice: IndiceDrive,
): Promise<{ itens: ItemImportacao[]; avisos: string[] }> {
  const avisos: string[] = [];
  const brutos: { arquivo: DriveArquivo; subpasta: string; pastaDriveId: string | null }[] = [];
  const vistos = new Set<string>();

  for (const s of selecao.filter((x) => x.pasta)) {
    try {
      const arv = await arvoreDriveApi(s.id);
      if (arv.truncado) avisos.push(`A pasta "${arv.pasta.nome}" é grande: parte do conteúdo ficou de fora.`);
      const raiz = nomeSeguroMemoria(arv.pasta.nome);
      for (const f of arv.arquivos) {
        if (vistos.has(f.id)) continue;
        vistos.add(f.id);
        const sub = [raiz, ...f.caminho.split("/").filter(Boolean).map((p) => nomeSeguroMemoria(p))].join("/");
        brutos.push({ arquivo: f, subpasta: sub, pastaDriveId: f.pais[0] ?? s.id });
      }
    } catch (err) {
      avisos.push(`Não foi possível ler a pasta "${s.nome}": ${mensagemDoErro(err, "erro desconhecido")}`);
    }
  }
  for (const f of selecao.filter((x) => !x.pasta)) {
    if (vistos.has(f.id)) continue;
    vistos.add(f.id);
    brutos.push({ arquivo: f, subpasta: "", pastaDriveId: f.pais[0] ?? null });
  }
  if (brutos.length > MAX_ARQUIVOS_IMPORTACAO) {
    avisos.push(`Só os primeiros ${MAX_ARQUIVOS_IMPORTACAO} arquivos serão importados.`);
    brutos.length = MAX_ARQUIVOS_IMPORTACAO;
  }

  // Nomes de arquivo: nome limpo; se dois arquivos DIFERENTES do Drive caem no
  // mesmo caminho, o segundo ganha o começo do id.
  const usados = new Set<string>([...indice.values()].map((n) => n.path.toLowerCase()));
  const itens = brutos.map(({ arquivo, subpasta, pastaDriveId }): ItemImportacao => {
    const existente = indice.get(arquivo.id);
    let destino = existente?.path;
    if (!destino) {
      const base = nomeSeguroMemoria(arquivo.nome.replace(/\.[a-z0-9]{2,5}$/i, ""));
      const dir = [pastaDestino, subpasta].filter(Boolean).join("/");
      destino = `${dir}/${base}.md`;
      if (usados.has(destino.toLowerCase())) destino = `${dir}/${base} (${arquivo.id.slice(0, 6)}).md`;
    }
    usados.add(destino.toLowerCase());
    const situacao = situacaoNoRepositorio(arquivo, indice);
    return {
      arquivo,
      destino,
      pastaDriveId,
      existente: !!existente,
      status: !arquivo.importavel ? "nao-suportado" : situacao === "existe" ? "existe" : "pendente",
    };
  });
  return { itens, avisos };
}

// ----------------------------------------------------------------- nota

function nota(item: ItemImportacao, texto: string, truncado: boolean): string {
  const a = item.arquivo;
  const titulo = a.nome.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/\n/g, " ");
  const fm = [
    `título: ${titulo}`,
    `tags: [google-drive]`,
    `origem: google-drive`,
    `drive-id: ${a.id}`,
    item.pastaDriveId ? `drive-pasta-id: ${item.pastaDriveId}` : "",
    a.link ? `drive-link: ${a.link}` : "",
    `drive-tipo: ${a.tipoRotulo}`,
    a.modificadoEm ? `drive-modificado: ${a.modificadoEm}` : "",
    `importado-em: ${new Date().toISOString()}`,
  ].filter(Boolean);
  const data = a.modificadoEm
    ? new Date(a.modificadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const cabecalho = [`Origem: Google Drive — ${a.link ?? a.id}`, data ? `Data: ${data}` : ""].filter(Boolean).join("\n");
  const corpo = truncado ? `${texto}\n\n> Conteúdo cortado: o arquivo original é maior.` : texto;
  return `---\n${fm.join("\n")}\n---\n\n${cabecalho}\n\n${corpo.trim()}\n`;
}

/**
 * Importa os itens pendentes (3 por vez). Atualiza o status de cada um via
 * `onProgresso`; uma falha não interrompe os demais. No fim indexa as notas
 * gravadas e avisa o grafo/lista.
 */
export async function executarImportacao(
  itens: ItemImportacao[],
  onProgresso: (itens: ItemImportacao[]) => void,
): Promise<ItemImportacao[]> {
  const estado = itens.map((i) => ({ ...i }));
  const emitir = () => onProgresso(estado.map((i) => ({ ...i })));
  const gravadas: VaultNotaInput[] = [];
  const fila = estado.filter((i) => i.status === "pendente" || i.status === "falha");
  let pararPorPasta: string | null = null;

  const trabalhar = async () => {
    for (;;) {
      const item = fila.shift();
      if (!item || pararPorPasta) return;
      item.status = "importando";
      item.erro = undefined;
      emitir();
      try {
        const { texto, truncado } = await conteudoArquivoDriveApi(item.arquivo.id);
        const conteudo = nota(item, texto, truncado);
        const g = await gravarArquivoMemoria(item.destino, conteudo);
        if (!g.ok) {
          if (g.reason === "no-folder" || g.reason === "denied" || g.reason === "unsupported") {
            pararPorPasta = g.reason;
          }
          throw new Error(
            g.reason === "no-folder"
              ? "Nenhuma pasta do Repositório conectada."
              : g.reason === "denied"
                ? "Sem permissão para gravar na pasta do Repositório."
                : g.reason === "unsupported"
                  ? "Este navegador não grava na pasta do Repositório."
                  : "Falha ao gravar a nota.",
          );
        }
        gravadas.push({ path: item.destino, titulo: item.arquivo.nome, conteudo });
        item.status = item.existente ? "atualizado" : "importado";
      } catch (err) {
        item.status = "falha";
        item.erro = mensagemDoErro(err, err instanceof Error ? err.message : "Falha ao importar.");
      }
      emitir();
    }
  };
  await Promise.all([trabalhar(), trabalhar(), trabalhar()]);

  // Pasta indisponível: o que sobrou na fila também falha, com o mesmo motivo.
  if (pararPorPasta) {
    for (const i of estado) {
      if (i.status === "pendente") {
        i.status = "falha";
        i.erro = "Não gravado: pasta do Repositório indisponível.";
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
