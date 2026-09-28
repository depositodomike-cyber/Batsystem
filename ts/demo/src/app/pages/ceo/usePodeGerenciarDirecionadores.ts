import { useEffect, useState } from "react";
import {
  fetchMinhasPermissoesApi,
  type MinhasPermissoes,
} from "@/services/api/roles";
import { sessaoLocalAtiva } from "@/utils/sessaoLocal";

/**
 * Quem pode criar, editar, ativar/desativar e excluir direcionamentos de
 * insights. Mesmo desenho de `usePodeGerenciarMarcas`: a fonte é
 * `GET /empresa/roles/minhas-permissoes` (mesma condição do `PermissoesGuard`
 * do backend), uma requisição por sessão, e sem resposta (modo local) assume
 * que pode — o servidor é a autoridade e recusaria de qualquer forma.
 *
 * Começa em `false` para não piscar botões de gestão para quem não pode.
 */

const PERMISSAO = "insights.gerenciar_direcionadores";

let promessa: Promise<MinhasPermissoes | null> | null = null;

function carregar(): Promise<MinhasPermissoes | null> {
  if (sessaoLocalAtiva()) return Promise.resolve(null);
  promessa ??= fetchMinhasPermissoesApi().catch(() => null);
  return promessa;
}

export function usePodeGerenciarDirecionadores(): boolean {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    let vivo = true;
    void carregar().then((r) => {
      if (!vivo) return;
      setPode(
        r == null || r.administradorDaConta || r.permissoes.includes(PERMISSAO),
      );
    });
    return () => {
      vivo = false;
    };
  }, []);
  return pode;
}
