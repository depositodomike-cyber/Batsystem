// Import Dependencies
import { useMemo, useState } from "react";
import {
  ExclamationTriangleIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import type { Membro } from "@/services/api/membros";
import { isolados, montarHierarquia } from "./hierarquia-membros";
import {
  HierarquiaViewSelect,
  lerHierarquiaView,
  salvarHierarquiaView,
  type HierarquiaView,
} from "./HierarquiaViewSelect";
import { ItemMembro } from "./ItemMembro";
import { MembrosArvore } from "./MembrosArvore";
import { MembrosOrganograma } from "./MembrosOrganograma";

// ----------------------------------------------------------------------
// Visualização da estrutura organizacional.
//
// É só CONSULTA: a hierarquia continua sendo editada no cadastro do membro
// (Gestor direto). Nada de arrastar-e-soltar aqui — a intenção é responder
// "como os membros estão organizados?" sem virar um editor de organograma.
//
// A árvore é derivada de `gestorId` por `montarHierarquia`. Clicar num item
// abre o mesmo drawer de detalhe da listagem.
//
// Duas visões sobre a MESMA floresta, montada uma vez aqui:
//   • Organograma — de cima para baixo, com cards e recolher/expandir. Desenha
//     só quem tem vínculo (ver `raizesComEquipe`).
//   • Árvore — a lista indentada, exaustiva: mostra também quem ainda não tem
//     nenhuma relação definida.
// ----------------------------------------------------------------------

export function MembrosHierarquia({
  membros,
  onAbrirMembro,
  onIrParaLista,
}: {
  membros: Membro[];
  onAbrirMembro: (membro: Membro) => void;
  /** Para o estado vazio levar de volta à aba de Membros. */
  onIrParaLista: () => void;
}) {
  const { raizes, foraDaArvore } = useMemo(
    () => montarHierarquia(membros),
    [membros],
  );

  // Inicializador lazy: o localStorage é lido uma vez, não a cada render.
  const [view, setView] = useState<HierarquiaView>(lerHierarquiaView);
  const trocarView = (proxima: HierarquiaView) => {
    setView(proxima);
    salvarHierarquiaView(proxima);
  };

  const comGestor = membros.filter((m) => m.gestorId != null).length;
  const semVinculo = useMemo(() => isolados(raizes), [raizes]);

  if (membros.length === 0) {
    return (
      <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
        <ShareIcon className="dark:text-dark-400 size-10 text-gray-300" />
        <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
          Nenhum membro ainda
        </p>
        <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
          Cadastre as pessoas da organização para desenhar a estrutura.
        </p>
        <Button
          variant="outlined"
          className="mt-4 rounded-lg"
          onClick={onIrParaLista}
        >
          Ir para Membros
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          {raizes.length} no topo
          {" · "}
          {comGestor} com gestor definido
          {comGestor < membros.length &&
            ` · ${membros.length - comGestor} sem gestor`}
        </p>
        <HierarquiaViewSelect value={view} onChange={trocarView} />
      </div>

      {comGestor === 0 && (
        <div className="dark:border-dark-600 dark:bg-dark-700 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="dark:text-dark-200 text-xs-plus text-gray-600">
            Nenhuma relação de gestor definida ainda — por isso todos aparecem
            no mesmo nível. Defina o <strong>Gestor direto</strong> ao editar um
            membro para a estrutura tomar forma.
          </p>
        </div>
      )}

      {/* Sem nenhuma relação não há organograma possível: todo mundo seria uma
          raiz sem filhos. O aviso acima já explica o que fazer, então a árvore
          responde melhor do que um quadro vazio. */}
      {view === "organograma" && comGestor > 0 ? (
        <MembrosOrganograma
          membros={membros}
          raizes={raizes}
          onAbrirMembro={onAbrirMembro}
        />
      ) : (
        <MembrosArvore raizes={raizes} onAbrirMembro={onAbrirMembro} />
      )}

      {/* Quem não tem gestor nem subordinados fica fora do organograma (não há
          aresta que o coloque em lugar nenhum), mas não é silenciado: dizer
          quantos são é o que leva a definir o Gestor direto. */}
      {view === "organograma" && comGestor > 0 && semVinculo.length > 0 && (
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          {semVinculo.length}{" "}
          {semVinculo.length === 1
            ? "membro ainda sem vínculo na hierarquia"
            : "membros ainda sem vínculo na hierarquia"}{" "}
          e por isso fora do desenho
          {": "}
          {semVinculo.map((m) => m.nome).join(", ")}. Defina o{" "}
          <strong>Gestor direto</strong> para incluí-
          {semVinculo.length === 1 ? "lo" : "los"}.
        </p>
      )}

      {/* Só aparece se um ciclo tiver entrado no banco por fora desta API: a
          validação do backend impede, mas silenciar quem ficou de fora da
          árvore seria pior do que mostrar. */}
      {foraDaArvore.length > 0 && (
        <div className="dark:border-dark-600 dark:bg-dark-700 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-warning size-4.5 shrink-0" />
            <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
              Fora da estrutura ({foraDaArvore.length})
            </p>
          </div>
          <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
            Estes membros participam de um ciclo de gestores e não aparecem na
            árvore. Edite o Gestor direto de um deles para desfazer o laço.
          </p>
          <ul className="mt-3 space-y-1">
            {foraDaArvore.map((m) => (
              <li key={m.id}>
                <ItemMembro membro={m} onAbrir={onAbrirMembro} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
