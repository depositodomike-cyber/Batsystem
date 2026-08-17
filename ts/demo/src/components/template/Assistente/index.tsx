// Host da UI do assistente: bolinha + painel, em portal no body. Montado no
// layout Sideblock, o mesmo que traz a barra de prompt no header; o estado da
// conversa vive em <AssistenteHostProvider>, acima do RouterProvider, então
// sobrevive à navegação.
import { createPortal } from "react-dom";

import { useAssistente } from "@/app/contexts/assistente/context";
import { Bubble } from "./Bubble";
import { Panel } from "./Panel";

// ----------------------------------------------------------------------

export function AssistenteHost() {
  const { status } = useAssistente();

  return createPortal(
    <>
      {status !== "open" && <Bubble />}
      {/* Minimizado segue montado: preserva o rascunho do campo e o scroll. */}
      {status !== "closed" && <Panel />}
    </>,
    document.body,
  );
}
