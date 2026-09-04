// Local Imports
import type { Membro } from "@/services/api/membros";
import { type NoHierarquia } from "./hierarquia-membros";
import { ItemMembro } from "./ItemMembro";

// ----------------------------------------------------------------------
// Árvore indentada — a visualização original da hierarquia.
//
// Movida de MembrosHierarquia.tsx sem alteração de comportamento, quando o
// organograma entrou como segunda opção: o contêiner ficou responsável pelos
// dados e pelo alternador, e cada visão passou a ter o seu arquivo.
//
// Mostra TODAS as raízes, inclusive quem não tem gestor nem subordinados —
// diferente do organograma, que só desenha quem tem vínculo. Aqui a lista
// exaustiva é a proposta: responder "onde cada pessoa está".
// ----------------------------------------------------------------------

export function MembrosArvore({
  raizes,
  onAbrirMembro,
}: {
  raizes: NoHierarquia[];
  onAbrirMembro: (membro: Membro) => void;
}) {
  return (
    <div className="dark:border-dark-600 dark:bg-dark-700 overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 sm:p-3">
      <ul className="min-w-md">
        {raizes.map((no) => (
          <NoDaArvore key={no.membro.id} no={no} onAbrir={onAbrirMembro} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Um nó e a sua subárvore.
 *
 * A indentação vem do padding progressivo por nível; a guia vertical é uma
 * borda no `<ul>` dos filhos, o que mantém a marcação simples e sem SVG.
 */
function NoDaArvore({
  no,
  onAbrir,
}: {
  no: NoHierarquia;
  onAbrir: (membro: Membro) => void;
}) {
  return (
    <li>
      <ItemMembro membro={no.membro} onAbrir={onAbrir} nivel={no.nivel} />
      {no.filhos.length > 0 && (
        <ul className="dark:border-dark-500 ms-4 border-s border-gray-200 ps-2">
          {no.filhos.map((filho) => (
            <NoDaArvore key={filho.membro.id} no={filho} onAbrir={onAbrir} />
          ))}
        </ul>
      )}
    </li>
  );
}
