// Renderizador de Markdown estilizado (light/dark), com tabelas via remark-gfm.
// Reutilizado por Análise de conteúdo e Criar artigo.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// As notas geradas para o Repositório (Documento, Ata, Áudio) começam com um
// frontmatter YAML no estilo Obsidian (---\n...\n---). O react-markdown não
// entende frontmatter e o renderiza como um <hr> seguido de um heading setext
// gigante (o "---" de fechamento transforma o bloco inteiro num H2), quebrando
// todo o layout. Como o título já aparece fora do corpo, removemos o bloco.
const FRONTMATTER_RE = /^﻿?\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

function stripFrontmatter(md: string): string {
  const m = md.match(FRONTMATTER_RE);
  return m ? md.slice(m[0].length).replace(/^\s+/, "") : md;
}

const MD_COMPONENTS = {
  h1: (p: React.ComponentProps<"h1">) => <h1 className="dark:text-dark-50 mt-5 mb-2 text-xl font-semibold text-gray-800" {...p} />,
  h2: (p: React.ComponentProps<"h2">) => <h2 className="dark:text-dark-50 dark:border-dark-600 mt-5 mb-2 border-t border-gray-100 pt-4 text-lg font-semibold text-gray-800" {...p} />,
  h3: (p: React.ComponentProps<"h3">) => <h3 className="dark:text-dark-100 mt-3 mb-1 text-base font-semibold text-gray-800" {...p} />,
  p: (p: React.ComponentProps<"p">) => <p className="dark:text-dark-200 my-2 text-sm leading-relaxed text-gray-700" {...p} />,
  ul: (p: React.ComponentProps<"ul">) => <ul className="dark:text-dark-200 my-2 list-disc space-y-1 pl-5 text-sm text-gray-700" {...p} />,
  ol: (p: React.ComponentProps<"ol">) => <ol className="dark:text-dark-200 my-2 list-decimal space-y-1 pl-5 text-sm text-gray-700" {...p} />,
  li: (p: React.ComponentProps<"li">) => <li className="leading-relaxed" {...p} />,
  strong: (p: React.ComponentProps<"strong">) => <strong className="dark:text-dark-50 font-semibold text-gray-900" {...p} />,
  em: (p: React.ComponentProps<"em">) => <em className="italic" {...p} />,
  blockquote: (p: React.ComponentProps<"blockquote">) => <blockquote className="dark:border-dark-500 dark:text-dark-300 my-3 border-l-4 border-gray-300 pl-3 text-sm text-gray-600 italic" {...p} />,
  a: (p: React.ComponentProps<"a">) => <a className="text-primary-600 dark:text-primary-400 underline" target="_blank" rel="noreferrer" {...p} />,
  code: (p: React.ComponentProps<"code">) => <code className="dark:bg-dark-600 dark:text-dark-100 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800" {...p} />,
  hr: (p: React.ComponentProps<"hr">) => <hr className="dark:border-dark-600 my-4 border-gray-200" {...p} />,
  table: (p: React.ComponentProps<"table">) => (
    <div className="my-3 overflow-x-auto">
      <table className="dark:border-dark-600 w-full border-collapse border border-gray-200 text-sm" {...p} />
    </div>
  ),
  thead: (p: React.ComponentProps<"thead">) => <thead className="dark:bg-dark-700 bg-gray-50" {...p} />,
  th: (p: React.ComponentProps<"th">) => <th className="dark:border-dark-600 dark:text-dark-100 border border-gray-200 px-3 py-2 text-start font-semibold text-gray-800" {...p} />,
  td: (p: React.ComponentProps<"td">) => <td className="dark:border-dark-600 dark:text-dark-200 border border-gray-200 px-3 py-2 align-top text-gray-700" {...p} />,
};

export function MarkdownView({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {stripFrontmatter(children)}
    </ReactMarkdown>
  );
}
