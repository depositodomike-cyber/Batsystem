// ----------------------------------------------------------------------
// Perfil Pessoal → arquivos Markdown do Repositório.
//
// Puro (sem I/O). Gera SEMPRE os mesmos 7 arquivos, com nomes fixos em
// `Personal/Profile/`: salvar de novo sobrescreve, nunca cria um arquivo novo,
// e um item excluído some do texto. Os caminhos e títulos batem com
// ARQUIVOS_PERFIL em ts/api/src/perfil/perfil.service.ts (citação de fonte).
//
// Grafo: `overview.md` tem a tag `pessoa` e o NOME do usuário como título — é
// assim que o inventário o classifica como Pessoa e o grafo cria a entidade.
// As entidades ligadas (habilidades, interesses, idiomas, objetivos…) são
// declaradas em notas `Tags/<Item>.md` por sincronizar.ts; aqui elas aparecem
// como [[wikilinks]] no bloco "🔗 Conexões no Vault", com a relação escrita
// depois do link e a origem "(Perfil Pessoal)".
// ----------------------------------------------------------------------

import type { PerfilDados } from "@/services/api/perfil";
import { TITULO_CONEXOES } from "../memoria-grafo-modelo";
import { nomeSeguroMemoria } from "@/utils/memoriaVault";
import {
  relacaoTipoInteresse,
  rotuloHorizonte,
  rotuloTipoInteresse,
} from "./rotulos";

export const PASTA_PERFIL = "Personal/Profile";
/** Marca de origem de toda linha/arquivo gerado pelo perfil. */
export const ORIGEM_PERFIL = "(Perfil Pessoal)";

export type ChaveArquivo =
  | "overview"
  | "basico"
  | "formacao"
  | "interesses"
  | "comunicacao"
  | "objetivos"
  | "estiloVida";

export const ARQUIVOS: Record<ChaveArquivo, { arquivo: string; titulo: string }> = {
  overview: { arquivo: "overview", titulo: "" /* nome do usuário */ },
  basico: { arquivo: "basic-information", titulo: "Perfil Pessoal — Informações básicas" },
  formacao: { arquivo: "education-and-skills", titulo: "Perfil Pessoal — Formação e conhecimento" },
  interesses: { arquivo: "interests-and-activities", titulo: "Perfil Pessoal — Interesses e atividades" },
  comunicacao: { arquivo: "communication-preferences", titulo: "Perfil Pessoal — Preferências de comunicação" },
  objetivos: { arquivo: "personal-goals", titulo: "Perfil Pessoal — Objetivos pessoais" },
  estiloVida: { arquivo: "lifestyle-and-preferences", titulo: "Perfil Pessoal — Estilo de vida e preferências" },
};

export const caminhoArquivo = (k: ChaveArquivo) =>
  `${PASTA_PERFIL}/${ARQUIVOS[k].arquivo}.md`;

export const TODOS_OS_CAMINHOS = (Object.keys(ARQUIVOS) as ChaveArquivo[]).map(caminhoArquivo);

/** Nome que representa o dono do perfil (título da nota de Pessoa). */
export function nomeDoDono(d: PerfilDados): string {
  return (
    nomeSeguroMemoria(d.basico?.nomeCompleto || d.basico?.nomePreferido || "") ||
    "Eu"
  ).replace(/^nota$/, "Eu");
}

/** Uma entidade do grafo ligada ao dono, com a relação em texto. */
export interface EntidadePerfil {
  /** Rótulo da entidade (vira `Tags/<rótulo>.md`). */
  rotulo: string;
  /** "domina", "deseja aprender", "possui objetivo"… */
  relacao: string;
  /** Arquivo do perfil de onde ela vem. */
  origem: ChaveArquivo;
}

/** Entidades do perfil, sem repetir rótulo (a primeira relação vence). */
export function entidadesDoPerfil(d: PerfilDados): EntidadePerfil[] {
  const out: EntidadePerfil[] = [];
  const vistos = new Set<string>();
  const add = (rotulo: string, relacao: string, origem: ChaveArquivo) => {
    const r = nomeSeguroMemoria(rotulo.trim());
    if (!rotulo.trim() || r === "nota") return;
    const chave = r.toLowerCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    out.push({ rotulo: r, relacao, origem });
  };
  const b = d.basico;
  if (b?.idiomaPrincipal) add(b.idiomaPrincipal, "fala (idioma principal)", "basico");
  for (const i of b?.outrosIdiomas ?? []) add(i, "fala", "basico");
  const f = d.formacao;
  for (const x of f?.formacoes ?? []) if (x.curso) add(x.curso, "possui formação em", "formacao");
  for (const x of f?.cursos ?? []) add(x, "fez o curso", "formacao");
  for (const x of f?.certificacoes ?? []) add(x, "possui a certificação", "formacao");
  for (const x of f?.areas ?? []) add(x, "conhece a área", "formacao");
  for (const x of f?.especialidades ?? []) add(x, "é especialista em", "formacao");
  for (const x of f?.habilidadesTecnicas ?? []) add(x, "domina", "formacao");
  for (const x of f?.habilidadesComportamentais ?? []) add(x, "tem a habilidade", "formacao");
  for (const x of d.interesses?.itens ?? []) add(x.nome, relacaoTipoInteresse(x.tipo), "interesses");
  for (const x of d.objetivos?.itens ?? []) if (x.titulo) add(x.titulo, "possui o objetivo", "objetivos");
  return out;
}

// --------------------------------------------------------------- arquivos

function frontmatter(titulo: string, tags: string[], extra: Record<string, string> = {}): string {
  const linhas = [
    `título: ${titulo.replace(/\n/g, " ")}`,
    `tags: [${tags.join(", ")}]`,
    `origem: perfil-pessoal`,
    ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
    `gerado: automaticamente — edite em Configurações de usuário › Perfil Pessoal`,
  ];
  return `---\n${linhas.join("\n")}\n---\n\n`;
}

const lista = (itens: string[]) => (itens.length ? itens.map((i) => `- ${i}`).join("\n") : "_Nada cadastrado._");
const campo = (rotulo: string, v?: string) => (v?.trim() ? `- ${rotulo}: ${v.trim()}` : "");
const juntar = (...partes: string[]) => partes.filter((p) => p !== "").join("\n\n");

function blocoConexoes(entidades: EntidadePerfil[]): string {
  if (!entidades.length) return "";
  return `${TITULO_CONEXOES}\n\n${entidades
    .map((e) => `- [[${e.rotulo}]] — ${e.relacao} ${ORIGEM_PERFIL}`)
    .join("\n")}`;
}

/** Os 7 arquivos do perfil: caminho → { título, conteúdo }. */
export function gerarArquivosPerfil(
  d: PerfilDados,
): { chave: ChaveArquivo; path: string; titulo: string; conteudo: string }[] {
  const dono = nomeDoDono(d);
  const ents = entidadesDoPerfil(d);
  const entsDe = (k: ChaveArquivo) => ents.filter((e) => e.origem === k);
  // O wikilink resolve pelo título da nota (frontmatter), então vai o título
  // como está — não o nome de arquivo limpo.
  const linkPara = (k: ChaveArquivo) => `[[${ARQUIVOS[k].titulo}]]`;
  const titulo = (k: ChaveArquivo) => (k === "overview" ? dono : ARQUIVOS[k].titulo);
  const voltar = `Perfil de [[${dono}]].`;

  const b = d.basico;
  const f = d.formacao;
  const c = d.comunicacao;
  const local = [b?.cidade, b?.estado, b?.pais].filter(Boolean).join(", ");

  const corpos: Record<ChaveArquivo, string> = {
    overview: juntar(
      `# ${dono}`,
      "Visão consolidada do Perfil Pessoal do dono deste Oracle.",
      juntar(
        campo("Prefere ser chamado de", b?.nomePreferido),
        campo("Mora em", local),
        campo("Idioma principal", b?.idiomaPrincipal),
        campo("Outros idiomas", b?.outrosIdiomas?.join(", ")),
      ).replace(/\n\n/g, "\n"),
      "## Resumo",
      [
        `- Habilidades técnicas: ${f?.habilidadesTecnicas?.length ?? 0}`,
        `- Interesses e atividades: ${d.interesses?.itens.length ?? 0}`,
        `- Objetivos: ${d.objetivos?.itens.length ?? 0}`,
      ].join("\n"),
      "## Categorias",
      (["basico", "formacao", "interesses", "comunicacao", "objetivos", "estiloVida"] as ChaveArquivo[])
        .map((k) => `- ${linkPara(k)}`)
        .join("\n"),
      blocoConexoes(ents),
    ),
    basico: juntar(
      voltar,
      b
        ? [
            campo("Nome completo", b.nomeCompleto),
            campo("Prefere ser chamado de", b.nomePreferido),
            campo("Data de nascimento", b.nascimento),
            campo("Cidade", b.cidade),
            campo("Estado", b.estado),
            campo("País", b.pais),
            campo("Idioma principal", b.idiomaPrincipal),
            campo("Outros idiomas", b.outrosIdiomas.join(", ")),
          ]
            .filter(Boolean)
            .join("\n") || "_Nada cadastrado._"
        : "_Nada cadastrado._",
      blocoConexoes(entsDe("basico")),
    ),
    formacao: juntar(
      voltar,
      "## Formação acadêmica",
      lista(
        (f?.formacoes ?? []).map(
          (x) =>
            `${[x.nivel, x.curso].filter(Boolean).join(" — ")}${x.instituicao ? ` · ${x.instituicao}` : ""}${x.ano ? ` (${x.ano})` : ""}`,
        ),
      ),
      "## Cursos realizados",
      lista(f?.cursos ?? []),
      "## Certificações",
      lista(f?.certificacoes ?? []),
      "## Áreas de conhecimento",
      lista(f?.areas ?? []),
      "## Especialidades",
      lista(f?.especialidades ?? []),
      "## Habilidades técnicas",
      lista(f?.habilidadesTecnicas ?? []),
      "## Habilidades comportamentais",
      lista(f?.habilidadesComportamentais ?? []),
      blocoConexoes(entsDe("formacao")),
    ),
    interesses: juntar(
      voltar,
      lista(
        (d.interesses?.itens ?? []).map(
          (x) => `${x.nome} — ${rotuloTipoInteresse(x.tipo)}${x.categoria ? ` · ${x.categoria}` : ""}`,
        ),
      ),
      blocoConexoes(entsDe("interesses")),
    ),
    comunicacao: juntar(
      voltar,
      c
        ? [
            campo("Idioma preferencial de resposta", c.idiomaResposta),
            campo("Tom de comunicação", c.tom),
            campo("Nível de detalhamento", c.detalhe),
            campo("Objetivas ou aprofundadas", c.profundidade),
            campo("Apresentação das informações", c.apresentacao),
          ]
            .filter(Boolean)
            .join("\n") || "_Nada cadastrado._"
        : "_Nada cadastrado._",
      c?.instrucoes?.trim() ? `## Outras instruções para a IA\n\n${c.instrucoes.trim()}` : "",
    ),
    objetivos: juntar(
      voltar,
      (d.objetivos?.itens ?? []).length
        ? (d.objetivos?.itens ?? [])
            .map((x) =>
              juntar(
                `## ${x.titulo || "Objetivo"}`,
                [
                  campo("Categoria", x.categoria),
                  campo("Horizonte", rotuloHorizonte(x.horizonte)),
                  campo("Data desejada", x.data),
                  campo("Status", x.status),
                ]
                  .filter(Boolean)
                  .join("\n"),
                x.descricao?.trim() ?? "",
                x.observacoes?.trim() ? `> ${x.observacoes.trim().replace(/\n/g, "\n> ")}` : "",
              ),
            )
            .join("\n\n")
        : "_Nada cadastrado._",
      blocoConexoes(entsDe("objetivos")),
    ),
    estiloVida: juntar(
      voltar,
      lista((d.estiloVida?.itens ?? []).map((x) => `${x.categoria ? `${x.categoria}: ` : ""}${x.texto}`)),
    ),
  };

  return (Object.keys(ARQUIVOS) as ChaveArquivo[]).map((k) => {
    const t = titulo(k);
    const tags = k === "overview" ? ["pessoa", "perfil-pessoal"] : ["perfil-pessoal"];
    return {
      chave: k,
      path: caminhoArquivo(k),
      titulo: t,
      conteudo: frontmatter(t, tags) + corpos[k].trim() + "\n",
    };
  });
}
