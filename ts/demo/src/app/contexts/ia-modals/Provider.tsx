import { ReactNode, useCallback, useMemo, useState } from "react";

import {
  IaModalStatus,
  IaModalsContextValue,
  IaModalsProvider as Ctx,
} from "./context";
import { IA_MODALS } from "./registry";
import { MinimizedDock } from "./MinimizedDock";

// ----------------------------------------------------------------------
// Host global das janelas de IA. Fica acima do RouterProvider, então os modais
// permanecem montados ao navegar entre telas — é isso que permite minimizar um
// modal (ex.: uma geração em andamento) e continuar usando a plataforma.
//
// Um id presente em `states` está montado ("open" ou "minimized"); ausente,
// está fechado e desmontado (ao reabrir, começa do zero).
// ----------------------------------------------------------------------

export function IaModalsHostProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<Record<string, IaModalStatus>>({});

  const setStatus = useCallback((id: string, status: IaModalStatus) => {
    setStates((prev) => ({ ...prev, [id]: status }));
  }, []);

  const open = useCallback((id: string) => setStatus(id, "open"), [setStatus]);
  const minimize = useCallback((id: string) => setStatus(id, "minimized"), [setStatus]);
  const restore = useCallback((id: string) => setStatus(id, "open"), [setStatus]);

  const close = useCallback((id: string) => {
    setStates((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const value = useMemo<IaModalsContextValue>(
    () => ({ states, open, close, minimize, restore }),
    [states, open, close, minimize, restore],
  );

  return (
    <Ctx value={value}>
      {children}

      {/* Modais montados globalmente. Renderizamos apenas os que estão em
          `states`: assim minimizar preserva o estado interno (segue montado,
          só invisível) e fechar reseta (desmonta). */}
      {IA_MODALS.map(({ id, Component }) =>
        id in states ? (
          <Component
            key={id}
            isOpen={states[id] === "open"}
            close={() => close(id)}
            onMinimize={() => minimize(id)}
          />
        ) : null,
      )}

      <MinimizedDock />
    </Ctx>
  );
}
