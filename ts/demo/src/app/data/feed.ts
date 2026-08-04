// Dados do Feed de notícias — compartilhados entre a listagem (Feed) e a
// página de detalhe (FeedDetail). Os ids e as imagens são estáveis para que o
// detalhe sempre exiba a notícia correta, inclusive em acesso direto pela URL.

export interface FeedItem {
  /** Slug usado na URL: /<produto>/feed/<id> */
  id: string;
  title: string;
  /** Resumo curto exibido nos cards. */
  description: string;
  author: string;
  /** Cargo/área do autor — exibido na página de detalhe. */
  authorRole: string;
  date: string;
  category: string;
  /** Minutos estimados de leitura. */
  readMinutes: number;
  face: string;
  image: string;
  /** Métricas fictícias para a página de detalhe. */
  likes: number;
  comments: number;
}

const face = (n: number) => `/images/feed/faces/${n}.jpg`;
const image = (n: number) => `/images/feed/${n}.jpg`;

export const FEED_ITEMS: FeedItem[] = [
  {
    id: "liderar-em-cenarios-de-incerteza",
    title: "Liderar em cenários de incerteza",
    description:
      "Como líderes estão tomando decisões mais rápidas e humanas em momentos críticos.",
    author: "Mariana Lopes",
    authorRole: "Head de Liderança & Cultura",
    date: "12/02/2026 09:45",
    category: "Liderança & Gestão",
    readMinutes: 4,
    face: face(7),
    image: image(1),
    likes: 142,
    comments: 18,
  },
  {
    id: "o-novo-perfil-do-colaborador-moderno",
    title: "O novo perfil do colaborador moderno",
    description:
      "Autonomia, propósito e aprendizado contínuo moldam as expectativas profissionais atuais.",
    author: "Rafael Monteiro",
    authorRole: "Especialista em Experiência do Colaborador",
    date: "12/02/2026 10:10",
    category: "Cultura",
    readMinutes: 5,
    face: face(12),
    image: image(2),
    likes: 98,
    comments: 12,
  },
  {
    id: "crescimento-sustentavel-nas-empresas-brasileiras",
    title: "Crescimento sustentável nas empresas brasileiras",
    description:
      "Estratégias que equilibram resultado financeiro e longevidade organizacional.",
    author: "Fernanda Azevedo",
    authorRole: "Diretora de Estratégia",
    date: "12/02/2026 10:42",
    category: "Mercado",
    readMinutes: 6,
    face: face(3),
    image: image(3),
    likes: 211,
    comments: 27,
  },
  {
    id: "ia-aplicada-a-gestao-corporativa",
    title: "IA aplicada à gestão corporativa",
    description:
      "Como inteligência artificial está otimizando processos e decisões nas empresas.",
    author: "Lucas Ferreira",
    authorRole: "Líder de Transformação Digital",
    date: "12/02/2026 11:05",
    category: "Tecnologia & IA",
    readMinutes: 5,
    face: face(18),
    image: image(4),
    likes: 305,
    comments: 41,
  },
  {
    id: "avaliacoes-mais-justas-e-continuas",
    title: "Avaliações mais justas e contínuas",
    description:
      "Modelos modernos substituem ciclos anuais por feedbacks frequentes.",
    author: "Paula Nogueira",
    authorRole: "Gerente de Performance",
    date: "12/02/2026 11:30",
    category: "Liderança & Gestão",
    readMinutes: 4,
    face: face(9),
    image: image(5),
    likes: 87,
    comments: 9,
  },
  {
    id: "aprender-no-fluxo-do-trabalho",
    title: "Aprender no fluxo do trabalho",
    description:
      "Microlearning se consolida como tendência nas empresas digitais.",
    author: "André Martins",
    authorRole: "Coordenador de Aprendizagem",
    date: "12/02/2026 12:00",
    category: "Tecnologia & IA",
    readMinutes: 3,
    face: face(14),
    image: image(6),
    likes: 64,
    comments: 7,
  },
  {
    id: "transparencia-como-diferencial-competitivo",
    title: "Transparência como diferencial competitivo",
    description:
      "Boas práticas de governança fortalecem confiança interna e externa.",
    author: "Camila Rocha",
    authorRole: "Head de Governança",
    date: "12/02/2026 13:15",
    category: "Mercado",
    readMinutes: 5,
    face: face(5),
    image: image(7),
    likes: 119,
    comments: 14,
  },
  {
    id: "o-papel-do-lider-no-engajamento",
    title: "O papel do líder no engajamento",
    description:
      "Lideranças próximas influenciam diretamente motivação e performance dos times.",
    author: "Eduardo Pacheco",
    authorRole: "Consultor de Liderança",
    date: "12/02/2026 14:05",
    category: "Liderança & Gestão",
    readMinutes: 4,
    face: face(1),
    image: image(8),
    likes: 176,
    comments: 22,
  },
  {
    id: "saude-mental-no-centro-da-estrategia",
    title: "Saúde mental no centro da estratégia",
    description:
      "Empresas ampliam ações de cuidado emocional para colaboradores.",
    author: "Juliana Farias",
    authorRole: "Líder de Bem-estar",
    date: "12/02/2026 14:40",
    category: "Cultura",
    readMinutes: 6,
    face: face(16),
    image: image(9),
    likes: 254,
    comments: 33,
  },
  {
    id: "dados-como-base-da-decisao",
    title: "Dados como base da decisão",
    description: "Analytics ganha espaço como pilar da gestão moderna.",
    author: "Thiago Rangel",
    authorRole: "Head de Dados & Analytics",
    date: "12/02/2026 15:10",
    category: "Tecnologia & IA",
    readMinutes: 5,
    face: face(6),
    image: image(10),
    likes: 132,
    comments: 16,
  },
  {
    id: "metas-mais-claras-times-mais-produtivos",
    title: "Metas mais claras, times mais produtivos",
    description: "Objetivos bem definidos aumentam foco e reduzem retrabalho.",
    author: "Bruno Almeida",
    authorRole: "Gerente de Operações",
    date: "12/02/2026 15:35",
    category: "Produtos",
    readMinutes: 3,
    face: face(11),
    image: image(11),
    likes: 71,
    comments: 8,
  },
  {
    id: "desenvolvimento-continuo-como-cultura",
    title: "Desenvolvimento contínuo como cultura",
    description:
      "Empresas investem em trilhas personalizadas para evolução profissional.",
    author: "Renata Guedes",
    authorRole: "Head de Desenvolvimento de Pessoas",
    date: "12/02/2026 16:00",
    category: "Cultura",
    readMinutes: 5,
    face: face(1),
    image: image(1),
    likes: 90,
    comments: 11,
  },
];

export function getFeedItem(id: string): FeedItem | undefined {
  return FEED_ITEMS.find((item) => item.id === id);
}

/** Notícias relacionadas: mesma categoria primeiro, completando com outras. */
export function getRelatedFeedItems(id: string, limit = 3): FeedItem[] {
  const current = getFeedItem(id);
  if (!current) return FEED_ITEMS.slice(0, limit);
  const others = FEED_ITEMS.filter((item) => item.id !== id);
  const sameCategory = others.filter((i) => i.category === current.category);
  const rest = others.filter((i) => i.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

// ----------------------------------------------------------------------
// Pessoas que podem ser marcadas (@) em comentários.

export interface Person {
  name: string;
  avatarUrl: string;
}

/** Autores únicos do feed, usados como sugestões de menção (@). */
export function getMentionablePeople(): Person[] {
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const item of FEED_ITEMS) {
    if (!seen.has(item.author)) {
      seen.add(item.author);
      people.push({ name: item.author, avatarUrl: item.face });
    }
  }
  return people;
}

/**
 * Corpo do artigo. Gerado a partir do título/resumo da notícia para que cada
 * página de detalhe tenha uma leitura completa e coerente, sem hardcode
 * extenso por item. Retorna blocos renderizáveis pela página de detalhe.
 */
export type ArticleBlock =
  | { type: "lead"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string; cite: string };

export function getArticleBody(item: FeedItem): ArticleBlock[] {
  const tema = item.title.toLowerCase();
  return [
    {
      type: "lead",
      text: `${item.description} Esse movimento deixou de ser uma aposta isolada para se tornar prioridade na agenda de lideranças que querem manter times engajados e resultados consistentes.`,
    },
    {
      type: "paragraph",
      text: `Nos últimos meses, o debate sobre ${tema} ganhou força em conversas de gestão e nos comitês executivos. A pressão por velocidade convive com a necessidade de decisões mais humanas, e organizações que encontram esse equilíbrio têm se destacado diante de concorrentes que ainda operam no piloto automático.`,
    },
    {
      type: "heading",
      text: "Por que isso importa agora",
    },
    {
      type: "paragraph",
      text: "O contexto mudou: equipes esperam clareza, propósito e espaço para contribuir. Quando esses elementos estão presentes, a produtividade cresce de forma sustentável e a rotatividade diminui. Quando faltam, mesmo os melhores processos perdem tração.",
    },
    {
      type: "quote",
      text: "Cultura não é o que está escrito na parede — é o que acontece quando ninguém está olhando.",
      cite: item.author,
    },
    {
      type: "heading",
      text: "Como aplicar na prática",
    },
    {
      type: "paragraph",
      text: "Comece pequeno e observe os sinais. Estabeleça rituais curtos de alinhamento, dê visibilidade às metas e crie canais reais de escuta. O segredo está na consistência: pequenas ações repetidas constroem confiança mais do que grandes anúncios pontuais.",
    },
    {
      type: "paragraph",
      text: `${item.author}, ${item.authorRole.toLowerCase()}, reforça que a transformação acontece no dia a dia. "O papel da liderança é remover obstáculos e dar contexto. O resto, as pessoas resolvem melhor do que imaginamos", afirma.`,
    },
  ];
}
