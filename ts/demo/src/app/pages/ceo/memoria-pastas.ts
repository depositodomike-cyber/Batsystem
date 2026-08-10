// ----------------------------------------------------------------------
// Pastas do Repositório por ação de IA — fonte única de verdade.
//
// Cada ação do IA Studio grava o conteúdo gerado numa subpasta com o nome da
// própria ação ("Artigos", "Imagens", "Dashboards"…). A subpasta é criada na
// primeira gravação (escreverNotaMemoria usa `create: true`), então basta
// nomeá-la aqui. Reuniões/Documentos casam com as categorias que o backend já
// usa e com as cores fixas do grafo (PASTA_COR em MemoriaGrafo).
// ----------------------------------------------------------------------

export const PASTA_MEMORIA = {
  analise: "Análises",
  apresentacao: "Apresentações",
  artigo: "Artigos",
  ata: "Atas",
  carrossel: "Carrosséis",
  cortes: "Cortes",
  dashboard: "Dashboards",
  documento: "Documentos",
  imagem: "Imagens",
  melhorar: "Textos",
  pessoas: "Pessoas",
  reunioes: "Reuniões",
  video: "Vídeos",
} as const;
