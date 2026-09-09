// Import Dependencies
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

// ----------------------------------------------------------------------
// Rótulo de campo de formulário, com a explicação num ícone de ajuda em vez de
// um parágrafo abaixo do campo.
//
// O ícone vem À DIREITA do texto do rótulo, e a explicação aparece no tooltip
// global do template — o `<Tooltip>` montado no `Root` e ancorado em
// `[data-tooltip]`. Ele tem `zIndex: 1000`, acima do `z-100` dos modais, então
// funciona dentro deles.
//
// UM tooltip, nunca dois: só `data-tooltip`. Um `title` junto faria o navegador
// abrir o nativo por cima do do template — dois balões com o mesmo texto no
// mesmo hover. Quem cobre teclado e leitor de tela é o `aria-label`, que não
// renderiza balão nenhum.
//
// Por que tooltip e não o modal de ajuda do `PageTitle`: aquele padrão abre um
// segundo Dialog, e os modais desta área já estão em `z-100` — empilhar um
// sobre o outro não tem ordem confiável. O ícone é o mesmo (`?`), o mecanismo
// é o que cabe dentro de um modal.
//
// O que NÃO deve virar ícone: aviso condicional que pede uma ação ("nenhuma
// área cadastrada — crie em Estrutura", "use Desativar membro no menu"). Aquilo
// não descreve o campo, destrava o fluxo — e escondê-lo num hover deixaria o
// operador diante de um select vazio sem saber por quê. Esses continuam
// visíveis abaixo do campo.
// ----------------------------------------------------------------------

/** Classe do rótulo, idêntica à que os modais usavam inline. */
const CLASSE_ROTULO =
  "dark:text-dark-200 mb-1 flex items-center gap-1.5 font-medium text-gray-600";

export function RotuloCampo({
  rotulo,
  ajuda,
  opcional = false,
}: {
  rotulo: string;
  /** A explicação. Omitida = sem ícone, só o rótulo. */
  ajuda?: string;
  /** Acrescenta o sufixo "(opcional)", como os campos já faziam. */
  opcional?: boolean;
}) {
  return (
    <span className={CLASSE_ROTULO}>
      <span>
        {rotulo}
        {opcional && (
          <span className="ml-1 font-normal text-gray-400">(opcional)</span>
        )}
      </span>
      {ajuda && <AjudaCampo texto={ajuda} rotulo={rotulo} />}
    </span>
  );
}

function AjudaCampo({ texto, rotulo }: { texto: string; rotulo: string }) {
  return (
    <span
      // `data-tooltip` é o gancho do tooltip do template, e é o ÚNICO: um
      // `title` aqui somaria o balão nativo do navegador ao do template, e o
      // hover abriria dois com o mesmo texto.
      data-tooltip
      data-tooltip-content={texto}
      // Focável e rotulado: sem isto a explicação existiria só para quem usa
      // mouse. Com `aria-label` o texto inteiro é anunciado, que é o mesmo que
      // o parágrafo abaixo do campo entregava antes — e sem renderizar balão.
      tabIndex={0}
      role="note"
      aria-label={`${rotulo}: ${texto}`}
      // Dentro de um `<label>`, um clique aqui focaria o campo e abriria o
      // select. O tooltip abre no hover e no foco, então o clique não tem
      // função nenhuma.
      onClick={(e) => e.preventDefault()}
      className="dark:text-dark-400 dark:hover:text-primary-400 hover:text-primary-600 inline-flex shrink-0 cursor-help text-gray-400"
    >
      <QuestionMarkCircleIcon className="size-4" />
    </span>
  );
}
