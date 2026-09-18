import { useEffect, useState } from "react";
import {
  fetchMinhasPermissoesApi,
  type MinhasPermissoes,
} from "@/services/api/roles";
import { sessaoLocalAtiva } from "@/utils/sessaoLocal";

/**
 * Quem pode criar, editar e excluir guias de marca.
 *
 * A fonte é `GET /empresa/roles/minhas-permissoes`, e NÃO `user.role`: o
 * endpoint devolve `administradorDaConta` com a MESMA condição do
 * `PermissoesGuard` do backend (bypass de owner/admin, salvo convidado) mais as
 * permissões que a role concede. Checar `user.role === "admin" || "owner"` — o
 * que `McpKeysCard` e `RegrasSection` fazem — esconderia a gestão de um membro
 * cuja role tem `configuracoes.gerenciar`, que a API aceitaria. Nenhuma
 * autorização paralela: é o mesmo código de permissão que o servidor exige.
 *
 * Sem resposta (servidor fora, modo local) assume que PODE. O servidor é a
 * autoridade e recusaria de qualquer forma; bloquear aqui tornaria o protótipo
 * inutilizável offline, que é o oposto do requisito.
 */

const PERMISSAO = "configuracoes.gerenciar";

/**
 * Uma requisição por sessão, compartilhada por todos os componentes que
 * perguntam. As permissões do usuário não mudam no meio de uma navegação, e sem
 * isto cada montagem da aba dispararia um GET.
 */
let promessa: Promise<MinhasPermissoes | null> | null = null;

function carregar(): Promise<MinhasPermissoes | null> {
  if (sessaoLocalAtiva()) return Promise.resolve(null);
  promessa ??= fetchMinhasPermissoesApi().catch(() => null);
  return promessa;
}

export function usePodeGerenciarMarcas(): {
  pode: boolean;
  resolvendo: boolean;
} {
  const [estado, setEstado] = useState<{ pode: boolean; resolvendo: boolean }>({
    pode: true,
    resolvendo: true,
  });

  useEffect(() => {
    let vivo = true;
    void carregar().then((r) => {
      if (!vivo) return;
      setEstado({
        pode:
          r == null ||
          r.administradorDaConta ||
          r.permissoes.includes(PERMISSAO),
        resolvendo: false,
      });
    });
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}
