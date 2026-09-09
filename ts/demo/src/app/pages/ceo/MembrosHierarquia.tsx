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
  membroSelecionadoId,
  onAbrirMembro,
  onIrParaLista,
}: {
  membros: Membro[];
  /** Só atravessa até o organograma, que dá ênfase às conexões desse membro. */
  membroSelecionadoId: string | null;
  onAbrirMembro: (membro: Membro) => void;
  /** Para o estado vazio levar de volta à aba de Membros. */
  onIrParaLista: () => void;
}) {
  /**
   * A estrutura da organização, SEM os convidados. Este é o ponto único de
   * filtragem da aba inteira.
   *
   * Convidado não tem posição hierárquica: sem gestor e sem liderados, ele
   * cairia em `isolados` e a tela o listaria com a instrução "defina o Gestor
   * direto para incluí-lo" — que a regra de convidado torna impossível de
   * cumprir.
   *
   * Filtrar AQUI, e não dentro de `hierarquia-membros.ts`: aquele módulo
   * deriva de `gestorId` e só disso, e um teste de tipo lá faria a lista, o
   * drawer e esta aba discordarem sobre o que é uma equipe. E não em
   * `Administracao`, que precisa da lista inteira para a tabela e o detalhe.
   */
  const estruturais = useMemo(
    () => membros.filter((m) => m.tipo !== "convidado"),
    [membros],
  );

  const { raizes, foraDaArvore } = useMemo(
    () => montarHierarquia(estruturais),
    [estruturais],
  );

  // Inicializador lazy: o localStorage é lido uma vez, não a cada render.
  const [view, setView] = useState<HierarquiaView>(lerHierarquiaView);
  const trocarView = (proxima: HierarquiaView) => {
    setView(proxima);
    salvarHierarquiaView(proxima);
  };

  const comGestor = estruturais.filter((m) => m.gestorId != null).length;
  const semVinculo = useMemo(() => isolados(raizes), [raizes]);
  const convidados = membros.length - estruturais.length;

  // Organização só de convidados: sem este ramo a tela diria "Nenhum membro
  // ainda / Cadastre as pessoas" ao lado de uma aba Membros com linhas.
  if (membros.length > 0 && estruturais.length === 0) {
    return (
      <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
        <ShareIcon className="dark:text-dark-400 size-10 text-gray-300" />
        <p className="dark:text-dark-100 mt-3 font-medium text-gray-800">
          Nenhum membro na estrutura
        </p>
        <p className="dark:text-dark-300 text-xs-plus mt-1 max-w-sm text-gray-500">
          {convidados === 1
            ? "A única pessoa cadastrada é um convidado, e convidados não participam do organograma."
            : `As ${convidados} pessoas cadastradas são convidados, e convidados não participam do organograma.`}
        </p>
        <Button
          onClick={onIrParaLista}
          color="primary"
          className="mt-4 h-9 gap-1.5 rounded-lg px-3"
        >
          Ver membros
        </Button>
      </div>
    );
  }

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
          {/* `estruturais` nos DOIS lados. Este contador e o "no topo" acima
              ficam a uma linha de distância e derivam de fontes diferentes;
              deixar `membros.length` aqui faria todo convidado inflar "sem
              gestor" — sendo que convidado nem aparece no desenho. */}
          {comGestor < estruturais.length &&
            ` · ${estruturais.length - comGestor} sem gestor`}
          {convidados > 0 &&
            ` · ${convidados} ${convidados === 1 ? "convidado" : "convidados"} fora da estrutura`}
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
          // `estruturais`, e é a passagem mais fácil de esquecer: o
          // organograma usa a lista para agrupar cargos na legenda, montar as
          // conexões indiretas e indexar por id. Com a lista cheia, uma aresta
          // tracejada de um convidado sobreviveria (`conexoesIndiretas` só
          // descarta a ponta que não está na lista recebida) e a medição
          // procuraria um card que nunca foi desenhado.
          membros={estruturais}
          raizes={raizes}
          membroSelecionadoId={membroSelecionadoId}
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
