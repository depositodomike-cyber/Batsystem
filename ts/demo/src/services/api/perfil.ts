import axios from "@/utils/axios";

// Perfil Pessoal (Configurações do Usuário) — chama /perfil no ts/api.
// O perfil pertence ao usuário logado: o servidor usa o id do JWT, nunca um
// id vindo daqui, e não olha a organização ativa.
//
// Espelho do formato em ts/api/src/perfil/perfil.tipos.ts — mudou lá, mude
// aqui.

export interface FormacaoItem {
  id: string;
  curso: string;
  instituicao: string;
  nivel: string;
  ano: string;
}
export type TipoInteresse =
  | "interesse"
  | "hobby"
  | "atividade"
  | "assunto"
  | "quer-aprender"
  | "quer-experimentar";
export interface InteresseItem {
  id: string;
  nome: string;
  categoria: string;
  tipo: TipoInteresse;
}
export type Horizonte = "curto" | "medio" | "longo";
export interface ObjetivoItem {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  horizonte: Horizonte | "";
  data: string;
  status: string;
  observacoes: string;
}
export interface EstiloVidaItem {
  id: string;
  categoria: string;
  texto: string;
}

export interface PerfilBasico {
  nomeCompleto: string;
  nomePreferido: string;
  nascimento: string;
  cidade: string;
  estado: string;
  pais: string;
  idiomaPrincipal: string;
  outrosIdiomas: string[];
}
export interface PerfilFormacao {
  formacoes: FormacaoItem[];
  cursos: string[];
  certificacoes: string[];
  areas: string[];
  especialidades: string[];
  habilidadesTecnicas: string[];
  habilidadesComportamentais: string[];
}
export interface PerfilComunicacao {
  idiomaResposta: string;
  tom: string;
  detalhe: string;
  profundidade: string;
  apresentacao: string;
  instrucoes: string;
}

export interface PerfilDados {
  basico?: PerfilBasico;
  formacao?: PerfilFormacao;
  interesses?: { itens: InteresseItem[] };
  comunicacao?: PerfilComunicacao;
  objetivos?: { itens: ObjetivoItem[] };
  estiloVida?: { itens: EstiloVidaItem[] };
}
export type CategoriaPerfil = keyof PerfilDados;

export interface PerfilResposta {
  dados: PerfilDados;
  atualizadoEm: string | null;
}

export async function obterPerfilApi(): Promise<PerfilResposta> {
  const { data } = await axios.get<PerfilResposta>("/perfil");
  return data;
}

export async function salvarCategoriaPerfilApi<C extends CategoriaPerfil>(
  categoria: C,
  valor: NonNullable<PerfilDados[C]>,
): Promise<PerfilResposta> {
  const { data } = await axios.put<PerfilResposta>(
    `/perfil/${encodeURIComponent(categoria)}`,
    { valor },
  );
  return data;
}

export async function excluirPerfilApi(): Promise<void> {
  await axios.delete("/perfil");
}

/** Tira notas do Perfil Pessoal do índice da IA (só `Personal/Profile/`). */
export async function removerNotasPerfilDoIndiceApi(paths: string[]): Promise<void> {
  await axios.post("/ai/vault/remover", { paths });
}
