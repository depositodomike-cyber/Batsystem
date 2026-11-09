// ----------------------------------------------------------------------
// Perfil Pessoal — formato dos dados e normalização.
//
// O cliente manda uma categoria por vez (PUT /perfil/:categoria). Em vez de um
// DTO aninhado por campo, cada categoria tem um "esquema" pequeno abaixo e o
// valor recebido é reduzido a ele: campos desconhecidos somem, textos são
// aparados e limitados, listas têm teto. Assim o JSON gravado tem sempre o
// mesmo formato — o que o gerador de Markdown e a IA esperam.
//
// O espelho deste formato no cliente está em
// ts/demo/src/services/api/perfil.ts — mudou aqui, mude lá.
// ----------------------------------------------------------------------

export const CATEGORIAS_PERFIL = [
  'basico',
  'formacao',
  'interesses',
  'comunicacao',
  'objetivos',
  'estiloVida',
] as const;
export type CategoriaPerfil = (typeof CATEGORIAS_PERFIL)[number];

export function ehCategoriaPerfil(v: string): v is CategoriaPerfil {
  return (CATEGORIAS_PERFIL as readonly string[]).includes(v);
}

export interface FormacaoItem {
  id: string;
  curso: string;
  instituicao: string;
  nivel: string;
  ano: string;
}
export interface InteresseItem {
  id: string;
  nome: string;
  categoria: string;
  /** interesse | hobby | atividade | assunto | quer-aprender | quer-experimentar */
  tipo: string;
}
export interface ObjetivoItem {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  /** curto | medio | longo */
  horizonte: string;
  data: string;
  status: string;
  observacoes: string;
}
export interface EstiloVidaItem {
  id: string;
  categoria: string;
  texto: string;
}

export interface PerfilDados {
  basico?: {
    nomeCompleto: string;
    nomePreferido: string;
    nascimento: string;
    cidade: string;
    estado: string;
    pais: string;
    idiomaPrincipal: string;
    outrosIdiomas: string[];
  };
  formacao?: {
    formacoes: FormacaoItem[];
    cursos: string[];
    certificacoes: string[];
    areas: string[];
    especialidades: string[];
    habilidadesTecnicas: string[];
    habilidadesComportamentais: string[];
  };
  interesses?: { itens: InteresseItem[] };
  comunicacao?: {
    idiomaResposta: string;
    tom: string;
    detalhe: string;
    profundidade: string;
    apresentacao: string;
    instrucoes: string;
  };
  objetivos?: { itens: ObjetivoItem[] };
  estiloVida?: { itens: EstiloVidaItem[] };
}

// --------------------------------------------------------------- esquemas

type Campo =
  | { t: 'texto'; max: number }
  | { t: 'lista'; max: number; maxItem: number }
  | { t: 'itens'; max: number; campos: Record<string, Campo> };

const TXT = (max = 200): Campo => ({ t: 'texto', max });
const LISTA = (max = 60, maxItem = 120): Campo => ({ t: 'lista', max, maxItem });

const ESQUEMAS: Record<CategoriaPerfil, Record<string, Campo>> = {
  basico: {
    nomeCompleto: TXT(160),
    nomePreferido: TXT(80),
    nascimento: TXT(10),
    cidade: TXT(),
    estado: TXT(),
    pais: TXT(),
    idiomaPrincipal: TXT(60),
    outrosIdiomas: LISTA(20, 60),
  },
  formacao: {
    formacoes: {
      t: 'itens',
      max: 30,
      campos: {
        id: TXT(40),
        curso: TXT(),
        instituicao: TXT(),
        nivel: TXT(60),
        ano: TXT(10),
      },
    },
    cursos: LISTA(),
    certificacoes: LISTA(),
    areas: LISTA(),
    especialidades: LISTA(),
    habilidadesTecnicas: LISTA(),
    habilidadesComportamentais: LISTA(),
  },
  interesses: {
    itens: {
      t: 'itens',
      max: 150,
      campos: {
        id: TXT(40),
        nome: TXT(120),
        categoria: TXT(80),
        tipo: TXT(30),
      },
    },
  },
  comunicacao: {
    idiomaResposta: TXT(60),
    tom: TXT(60),
    detalhe: TXT(60),
    profundidade: TXT(60),
    apresentacao: TXT(60),
    instrucoes: TXT(2000),
  },
  objetivos: {
    itens: {
      t: 'itens',
      max: 60,
      campos: {
        id: TXT(40),
        titulo: TXT(160),
        descricao: TXT(1500),
        categoria: TXT(80),
        horizonte: TXT(10),
        data: TXT(10),
        status: TXT(30),
        observacoes: TXT(1500),
      },
    },
  },
  estiloVida: {
    itens: {
      t: 'itens',
      max: 100,
      campos: {
        id: TXT(40),
        categoria: TXT(40),
        texto: TXT(600),
      },
    },
  },
};

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function normalizarCampo(campo: Campo, v: unknown): unknown {
  if (campo.t === 'texto') return texto(v, campo.max);
  if (campo.t === 'lista') {
    if (!Array.isArray(v)) return [];
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const item of v) {
      const s = texto(item, campo.maxItem);
      const chave = s.toLowerCase();
      if (!s || vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(s);
      if (out.length >= campo.max) break;
    }
    return out;
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .slice(0, campo.max)
    .map((i) => normalizarObjeto(campo.campos, i))
    .filter((i) =>
      Object.entries(i).some(([k, val]) => k !== 'id' && val !== '' && !(Array.isArray(val) && !val.length)),
    )
    .map((i, n) => ({ ...i, id: (i.id as string) || `item-${Date.now()}-${n}` }));
}

function normalizarObjeto(
  campos: Record<string, Campo>,
  v: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, campo] of Object.entries(campos)) out[k] = normalizarCampo(campo, v[k]);
  return out;
}

/** Reduz o valor recebido ao formato da categoria. */
export function normalizarCategoria(
  categoria: CategoriaPerfil,
  valor: unknown,
): Record<string, unknown> {
  const obj = valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
  return normalizarObjeto(ESQUEMAS[categoria], obj);
}
